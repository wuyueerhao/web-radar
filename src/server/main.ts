import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import app from '../worker/app';
import { DomainService } from '../worker/domain-service';
import type { AppEnv } from '../worker/env';
import { serverProviders, hostedSite } from './hosting';
import { allowCloudflareMutation } from './cloudflare-guard';
import { outreachQueue } from '../worker/outreach';
// @ts-ignore Node-only adapter is separately tested with node:test.
import { LocalDatabase } from './sqlite.mjs';
// @ts-ignore Node-only adapter is separately tested with node:test.
import { LocalBucket } from './storage.mjs';
// @ts-ignore Node-only durable adapter.
import { DurableQueue } from './queue.mjs';

const root = resolve(process.env.DATA_ROOT || 'data/server');
await mkdir(root, {recursive:true,mode:0o700});
const db = new LocalDatabase(resolve(root, 'app.sqlite3'));
db.sqlite.exec('CREATE TABLE IF NOT EXISTS server_runtime(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
const origin = new URL(process.env.APP_ORIGIN || 'http://127.0.0.1:3000');
const assetRoot = resolve(process.env.ASSETS_ROOT || 'dist');
const pending = new Set<Promise<unknown>>();
const context = {
  waitUntil(promise:Promise<unknown>) { pending.add(promise); promise.catch(e=>console.error('Background task failed', e instanceof Error ? e.name : 'unknown')).finally(()=>pending.delete(promise)); },
  passThroughOnException() {}, props: {}
};
const mime:Record<string,string> = {'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain'};
async function assets(request:Request) {
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
  let pathname:string;
  try { pathname=decodeURIComponent(new URL(request.url).pathname); } catch { return new Response(null,{status:400}); }
  if (pathname.includes('\0') || pathname.split('/').some(p=>p==='..'||p.startsWith('.'))) return new Response(null,{status:404});
  let path = resolve(assetRoot, '.'+pathname);
  if (!path.startsWith(assetRoot+sep)) path=resolve(assetRoot,'index.html');
  try { if (!(await stat(path)).isFile()) throw new Error('directory'); }
  catch {
    if (extname(pathname)) return new Response('Not found',{status:404});
    path=resolve(assetRoot,'index.html');
  }
  const data = await readFile(path);
  return new Response(request.method==='HEAD'?null:data,{headers:{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':String(data.length)}});
}
const env = {...process.env, DB:db, MEDIA:new LocalBucket(resolve(root,'media'),db), ASSETS:{fetch:assets}} as unknown as AppEnv;
const emailQueue=new DurableQueue(db,'web-radar-edm-email');
const recoveryQueue=new DurableQueue(db,'web-radar-edm-email-dlq',{maxAttempts:20});
const siteQueue=new DurableQueue(db,'web-radar-edm-sites',{maxAttempts:8});
env.EDM_EMAIL_QUEUE=emailQueue;env.EDM_SITE_QUEUE=siteQueue;
if(process.env.SERVER_BROWSER_WS)env.BROWSER={} as Fetcher;
let stopped=false, ticking=false;
const domain = new DomainService(env, {schedule:async time=>{
  db.sqlite.prepare("INSERT INTO server_runtime VALUES('alarm',?) ON CONFLICT(key) DO UPDATE SET value=CAST(MIN(CAST(value AS INTEGER),CAST(excluded.value AS INTEGER)) AS TEXT)").run(String(time));
}},serverProviders(env));
env.COORDINATOR = {getByName:()=>({fetch:async(request:Request)=>{
  const response=await domain.fetch(request);
  if(!['GET','HEAD'].includes(request.method)&&response.ok) context.waitUntil(tick());
  return response;
}})} as unknown as AppEnv['COORDINATOR'];
async function tick() {
  if(stopped || ticking || process.env.SERVER_TASKS_ENABLED!=='true') return;
  ticking=true;
  try { db.sqlite.prepare("DELETE FROM server_runtime WHERE key='alarm'").run(); await domain.tick(); }
  catch(error) { console.error('Coordinator tick failed',error instanceof Error?error.name:'unknown');
    db.sqlite.prepare("INSERT OR IGNORE INTO server_runtime VALUES('alarm',?)").run(String(Date.now()+30000));
  } finally { ticking=false; }
}
const timer=setInterval(()=>{
  const alarm=db.sqlite.prepare("SELECT value FROM server_runtime WHERE key='alarm'").get();
  if(alarm&&Number(alarm.value)<=Date.now()) context.waitUntil(tick());
  if(!stopped&&process.env.SERVER_TASKS_ENABLED==='true') {
    for(const queue of [emailQueue,recoveryQueue,siteQueue])context.waitUntil(queue.process((batch:any)=>outreachQueue(batch,env)));
  }
},1000);

// Enforce independent Pages/DNS ownership at the network boundary.
const nativeFetch=globalThis.fetch;
globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(!await allowCloudflareMutation(env,url,method,init?.body??(input instanceof Request?await input.clone().text():undefined)))
    throw new Error('Cloudflare operation is outside this server’s managed namespace');
  const options:any={...init};
  if(options.body instanceof ReadableStream) options.duplex='half';
  return nativeFetch(input,options);
}) as typeof fetch;

const server=createServer(async(req,res)=>{
  try {
    const path=req.url||'/';
    if(!path.startsWith('/')||path.startsWith('//')) {res.writeHead(400).end();return;}
    // Nginx is the sole trusted ingress and replaces, rather than appends, this header.
    const headers=new Headers();
    for(const [name,value] of Object.entries(req.headers)) if(value) headers.set(name,Array.isArray(value)?value.join(', '):value);
    const host=headers.get('host')||'';
    const siteHost=!!env.SERVER_SITE_SUFFIX&&host.endsWith('.'+env.SERVER_SITE_SUFFIX);
    const publicHost=!!env.PUBLIC_SITE_ORIGIN&&host===new URL(env.PUBLIC_SITE_ORIGIN).host;
    const custom=(!siteHost&&!publicHost&&host!==origin.host)?db.sqlite.prepare("SELECT project_id FROM project_domains WHERE hostname=? AND status='active'").get(host):null;
    if(host!==origin.host&&!siteHost&&!publicHost&&!custom) {res.writeHead(421).end('Unknown host');return;}
    headers.delete('x-wr-principal');
    headers.set('cf-connecting-ip',process.env.TRUST_LOCAL_PROXY==='true'?(headers.get('x-real-ip')||req.socket.remoteAddress||'unknown'):(req.socket.remoteAddress||'unknown'));
    const request=new Request(new URL(path,(siteHost||publicHost||custom)?'https://'+host:origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method||'GET')?{body:Readable.toWeb(req),duplex:'half'}:{})} as RequestInit);
    let response:Response;
    const pathname=new URL(request.url).pathname;
    if(siteHost||custom) {
      response=await hostedSite(request,env,domain,custom?.project_id);
    } else if(publicHost) {
      const allowed=/^\/public\/sites\//.test(pathname)||/^\/public\/provider-assets\//.test(pathname)||/^\/api\/public\/sites\/[^/]+\/inquiries$/.test(pathname)||/^\/templates\//.test(pathname);
      headers.delete('cookie');headers.delete('authorization');
      response=allowed?await app.fetch(new Request(request,{headers}),env,context):new Response('Not found',{status:404});
    } else if(pathname==='/api/server/readiness') {
      db.sqlite.prepare('SELECT 1').get();
      response=Response.json({ok:true,runtime:'node',independentCopy:true,tasksEnabled:process.env.SERVER_TASKS_ENABLED==='true'});
    } else if(req.method!=='GET'&&req.method!=='HEAD'&&(
      (process.env.SERVER_TASKS_ENABLED!=='true' && /\/(generate|start|send|retry|resume|refresh|sync|clone|build)(?:\/|$)/.test(pathname))
    )) {
      response=Response.json({code:'server_copy_isolated',message:'服务器副本保留原 Cloudflare 域名绑定；当前操作暂不可用。'},{status:409});
    } else {
      response=await app.fetch(request,env,context);
      if(pathname==='/api/config'&&response.ok) {
        const config=await response.json() as any;
        config.services=config.services.map((service:any)=>service.name==='pages'?{...service,configured:true,mode:'live',detail:'支持 Cloudflare 与服务器发布，使用独立部署项目'}:service);
        response=Response.json({...config,independentCopy:true},{headers:response.headers});
      }
    }
    const responseHeaders:Record<string,string|string[]>={};
    response.headers.forEach((value,key)=>{if(key!=='set-cookie')responseHeaders[key]=value;});
    const cookies=response.headers.getSetCookie();if(cookies.length)responseHeaders['set-cookie']=cookies;
    res.writeHead(response.status,responseHeaders);
    if(req.method==='HEAD'||!response.body)res.end();
    else { const stream=Readable.fromWeb(response.body as any);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res); }
  } catch(error) { console.error('Request failed',error instanceof Error?error.name:'unknown');if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end('{"message":"服务器处理失败"}'); }
});
server.requestTimeout=120000;
server.headersTimeout=30000;
server.listen(Number(process.env.PORT||3000),process.env.LISTEN_HOST||'127.0.0.1',()=>console.log('Web Radar server ready'));
async function shutdown() {stopped=true;clearInterval(timer);server.close();await Promise.allSettled([...pending]);db.close();process.exit(0);}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
