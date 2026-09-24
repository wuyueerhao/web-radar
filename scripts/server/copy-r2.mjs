import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { LocalDatabase } from '../../src/server/sqlite.mjs';
import { LocalBucket } from '../../src/server/storage.mjs';
const [envFile,root]=process.argv.slice(2);
if(!envFile||!root) throw new Error('Usage: copy-r2.mjs protected-env data-root');
const env=parseEnv(await readFile(envFile,'utf8'));
const base=`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/web-radar-private/objects`;
async function request(url) {
  for(let attempt=0;attempt<5;attempt++) {
    try {
      const response=await fetch(url,{headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`},signal:AbortSignal.timeout(180000)});
      if(response.ok)return response;
      await response.body?.cancel();
      if(response.status<500&&response.status!==429)throw new Error(`R2 HTTP ${response.status}`);
    }catch(e){if(attempt===4)throw new Error('R2 copy request failed',{cause:e});}
    await new Promise(r=>setTimeout(r,1000*(attempt+1)));
  }
  throw new Error('R2 retry limit');
}
const manifest=[];
let cursor='';
do {
  const url=new URL(base);url.searchParams.set('per_page','1000');if(cursor)url.searchParams.set('cursor',cursor);
  const page=await(await request(url)).json();
  if(!page.success||!Array.isArray(page.result))throw new Error('Invalid R2 inventory');
  manifest.push(...page.result);
  cursor=page.result_info?.is_truncated?page.result_info.cursor:'';
  console.log('Inventory objects',manifest.length);
}while(cursor);
await writeFile(root+'/r2-manifest.json',JSON.stringify(manifest),{mode:0o600});
console.log('Inventory total bytes',manifest.reduce((n,o)=>n+Number(o.size),0));
const db=new LocalDatabase(root+'/app.sqlite3'),bucket=new LocalBucket(root+'/media',db);
let next=0,done=0;
try {
  await Promise.all(Array.from({length:4},async()=>{
    while(next<manifest.length) {
      const object=manifest[next++];
      const existing=await bucket.head(object.key);
      if(!existing||existing.size!==Number(object.size)||existing.sourceEtag!==object.etag) {
        const response=await request(base+'/'+object.key.split('/').map(encodeURIComponent).join('/'));
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength!==Number(object.size))throw new Error('Object size changed during copy; take another snapshot');
        const saved=await bucket.put(object.key,bytes,{httpMetadata:object.http_metadata,customMetadata:object.custom_metadata});
        const metadata={...saved,uploaded:object.last_modified,sourceEtag:object.etag,etag:object.etag};
        delete metadata.httpEtag;delete metadata.checksums;
        db.sqlite.prepare('UPDATE server_objects SET metadata=? WHERE key=?').run(JSON.stringify(metadata),object.key);
      }
      done++;if(done%25===0||done===manifest.length)console.log('Copied objects',done,'/',manifest.length);
    }
  }));
  console.log('Object copy complete');
}finally{db.close();}
