import {test,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {Hono} from 'hono';
import {d1} from './sqlite';
import {siteMessageRoutes} from '../../src/outreach/server/routes/site-message.routes';

test('site jobs pause, reject duplicate starts and preserve uncertain submissions',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('migrations/0007_outreach.sql','utf8'));
 sqlite.exec("ALTER TABLE edm_campaigns ADD COLUMN created_by TEXT; ALTER TABLE edm_site_message_jobs ADD COLUMN created_by TEXT;");
 sqlite.exec("INSERT INTO edm_users(id,name,email,created_at,updated_at) VALUES ('workspace','Test','test@example.com',0,0)");
 const queue:any[]=[];
 const app=new Hono<any>();app.use('*',async(c,next)=>{c.set('user',{id:'workspace',role:'admin',teamRead:true});await next()});app.route('/site-messages',siteMessageRoutes);
 const req=(url:string,body:any={})=>app.request('/site-messages'+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},{DB:d1(sqlite),SITE_MESSAGE_QUEUE:{send:async(m:any)=>{queue.push(m)}}});
 try {
  const created=await req('',{name:'Test',senderName:'Test',senderEmail:'test@example.com',message:'Hello from our team',targets:['https://example.com/contact'],authorized:true});expect(created.status).toBe(201);
  const {data:job}=await created.json() as any;
  expect((await req('/'+job.id+'/start')).status).toBe(200);expect(queue).toHaveLength(1);
  expect((await req('/'+job.id+'/start')).status).toBe(409);expect(queue).toHaveLength(1);
  expect((await req('/'+job.id+'/reset')).status).toBe(409);
  expect((await req('/'+job.id+'/pause')).status).toBe(200);
  sqlite.prepare("UPDATE edm_site_message_targets SET status='submitting' WHERE job_id=?").run(job.id);
  expect((await req('/'+job.id+'/reset')).status).toBe(409);
  sqlite.prepare("UPDATE edm_site_message_targets SET status='skipped',result_code='submission_uncertain' WHERE job_id=?").run(job.id);
  expect((await req('/'+job.id+'/start')).status).toBe(400);expect(queue).toHaveLength(1);
  expect((await req('/force-cleanup')).status).toBe(409);
 }finally{sqlite.close()}
});
