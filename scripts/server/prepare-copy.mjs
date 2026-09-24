import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { LocalDatabase } from '../../src/server/sqlite.mjs';
const [path,envFile]=process.argv.slice(2);
if(!path||!envFile)throw new Error('Usage: prepare-copy.mjs copied.sqlite protected.env');
const env=parseEnv(await readFile(envFile,'utf8'));
if(!env.SERVER_SITE_SUFFIX||!env.ASSET_SIGNING_KEY)throw new Error('Missing copy configuration');
const db=new LocalDatabase(path);
db.sqlite.exec('CREATE TABLE IF NOT EXISTS server_import_archive(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id));');
if(db.sqlite.prepare("SELECT id FROM server_import_archive WHERE kind='migration' AND id='isolated-copy-v1'").get())throw new Error('Copy preparation already applied');
async function crypt(value,id,decrypt=false){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('web-radar/outreach/v1:'+env.ASSET_SIGNING_KEY));
  const key=await crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt']);
  if(decrypt){const record=JSON.parse(value);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv),additionalData:new TextEncoder().encode(id)},key,new Uint8Array(record.data)));}
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(value));
  return JSON.stringify({iv:[...iv],data:[...new Uint8Array(data)]});
}
// Decrypt before opening the write transaction; never await external work in it.
const configs=[];
for(const provider of db.sqlite.prepare('SELECT id,config FROM edm_providers WHERE config IS NOT NULL').all()){
  const config=JSON.parse(await crypt(provider.config,provider.id+':config',true));
  for(const key of ['resendWebhookId','resendWebhookSecret','resendWebhookConnectedAt'])delete config[key];
  configs.push({id:provider.id,original:provider.config,value:await crypt(JSON.stringify(config),provider.id+':config')});
}
const archive=db.sqlite.prepare('INSERT INTO server_import_archive VALUES(?,?,?)');
db.sqlite.exec('BEGIN IMMEDIATE');
try {
  db.sqlite.exec('DELETE FROM sessions; DELETE FROM handoffs; DELETE FROM auth_attempts;');
  for(const row of db.sqlite.prepare('SELECT * FROM project_domains').all())archive.run('project_domains',row.id,JSON.stringify(row));
  db.sqlite.exec('DELETE FROM project_domains;');
  for(const row of db.sqlite.prepare('SELECT id,data FROM projects').all()) {
    const project=JSON.parse(row.data);archive.run('projects',row.id,row.data);
    if(project.publishedReleaseId)project.siteUrl=`https://${project.id}.${env.SERVER_SITE_SUFFIX}`;
    db.sqlite.prepare('UPDATE projects SET data=? WHERE id=?').run(JSON.stringify(project),row.id);
  }
  for(const row of db.sqlite.prepare('SELECT id,project_id,data FROM releases').all()){
    archive.run('releases',row.id,row.data);const release=JSON.parse(row.data);
    release.url=`https://${row.project_id}.${env.SERVER_SITE_SUFFIX}`;
    db.sqlite.prepare('UPDATE releases SET data=? WHERE id=?').run(JSON.stringify(release),row.id);
  }
  for(const row of db.sqlite.prepare("SELECT id,data FROM jobs WHERE status IN ('queued','running','unknown')").all()){
    archive.run('jobs',row.id,row.data);const job=JSON.parse(row.data);
    job.status='paused';job.error='从 Cloudflare 复制的历史任务已隔离，请核对原任务后重新操作。';
    db.sqlite.prepare("UPDATE jobs SET status='paused',data=? WHERE id=?").run(JSON.stringify(job),row.id);
  }
  for(const provider of configs){archive.run('provider_config',provider.id,provider.original);db.sqlite.prepare('UPDATE edm_providers SET config=? WHERE id=?').run(provider.value,provider.id);}
  archive.run('migration','isolated-copy-v1',JSON.stringify({createdAt:new Date().toISOString(),origin:env.APP_ORIGIN}));
  db.sqlite.exec('COMMIT');
  console.log('Copy prepared: sessions cleared, original hosting bindings archived, independent site URLs, historical active jobs isolated, new webhook setup required.');
}catch(error){db.sqlite.exec('ROLLBACK');throw error;}finally{db.close();}
