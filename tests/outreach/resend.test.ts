import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {Hono} from 'hono';
import {d1} from './sqlite';
import {seal,decodeProvider} from '../../src/outreach/server/lib/credentials';
import {applyResendEvent,verifyResendSignature,listResendDomains} from '../../src/outreach/server/lib/resend';
import {providersRoutes} from '../../src/outreach/server/routes/providers.routes';
import {resendWebhookRoutes} from '../../src/outreach/server/routes/resend.routes';
import {handleEmailQueue} from '../../src/outreach/server/queues/email-send.queue';
vi.mock('../../src/outreach/server/lib/network',()=>({publicFetch:(...args:any[])=>globalThis.fetch(args[0],args[1])}));
let sqlite:DatabaseSync,env:any;
const secret='whsec_'+Buffer.from('test-webhook-signing-key').toString('base64');
const event=(type:string)=>({type:'email.'+type,created_at:new Date().toISOString(),data:{email_id:'email1',tags:{wr_recipient_id:'r'}}});
const row=()=>sqlite.prepare("SELECT * FROM edm_campaign_recipients WHERE id='r'").get()!;
const stats=()=>sqlite.prepare("SELECT * FROM edm_campaigns WHERE id='c'").get()!;
function signed(body:string){const time=String(Math.floor(Date.now()/1000)),id='msg_test';return {'svix-id':id,'svix-timestamp':time,'svix-signature':'v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${time}.${body}`).digest('base64')};}
const app=(role='admin',user='u')=>{const h=new Hono<any>();h.use('*',async(c,next)=>{c.set('user',{id:user,role});await next()});h.route('/providers',providersRoutes);return h;};
beforeEach(async()=>{
 sqlite=new DatabaseSync(':memory:');for(const file of ['0007_outreach.sql','0008_resend_tracking.sql','0009_email_scheduling.sql'])sqlite.exec(readFileSync('migrations/'+file,'utf8'));
 env={DB:d1(sqlite),CREDENTIAL_KEY:'test-key',BETTER_AUTH_SECRET:'test-auth',BETTER_AUTH_URL:'https://app.example.com'};
 sqlite.exec("ALTER TABLE edm_campaigns ADD COLUMN created_by TEXT; ALTER TABLE edm_site_message_jobs ADD COLUMN created_by TEXT;");
 sqlite.exec(`INSERT INTO edm_users(id,name,email,created_at,updated_at) VALUES ('u','Test','u@example.com',0,0),('other','Other','other@example.com',0,0);
 INSERT INTO edm_providers(id,user_id,provider,name,api_key,config,is_default,created_at,updated_at) VALUES ('p','u','resend','Test','unused','{}',1,0,0);
 INSERT INTO edm_contacts(id,user_id,email,created_at,updated_at) VALUES ('contact','u','customer@example.com',0,0);
 INSERT INTO edm_campaigns(id,user_id,name,sender_email,sender_name,status,created_at,updated_at) VALUES ('c','u','Campaign','sales@example.com','Test','sending',0,0);
 INSERT INTO edm_campaign_recipients(id,campaign_id,contact_id,status,created_at) VALUES ('r','c','contact','sending',0);
 INSERT INTO edm_resend_deliveries(recipient_id,provider_id,created_at) VALUES ('r','p',0);`);
 sqlite.prepare('UPDATE edm_providers SET api_key=?,config=?').run(await seal('re_test','p',env),await seal(JSON.stringify({resendWebhookSecret:secret}),'p:config',env));
 vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Unexpected network request')}));
});
afterEach(()=>{vi.unstubAllGlobals();sqlite.close()});
test('Svix reference signature, tampering and replay expiry',async()=>{
 const body='{"event_type":"ping","data":{"success":true}}';const headers=new Headers({'svix-id':'msg_loFOjxBNrRLzqYUf','svix-timestamp':'1731705121','svix-signature':'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0='});
 expect(await verifyResendSignature(body,headers,'whsec_plJ3nmyCDGBKInavdOK15jsl',1731705121000)).toBe(true);
 expect(await verifyResendSignature(body+' ',headers,'whsec_plJ3nmyCDGBKInavdOK15jsl',1731705121000)).toBe(false);
 expect(await verifyResendSignature(body,headers,'whsec_plJ3nmyCDGBKInavdOK15jsl',1731706000000)).toBe(false);
});
test('duplicate/out-of-order callbacks count unique engagement and preserve terminal outcomes',async()=>{
 for(const type of ['clicked','sent','opened','delivered','clicked','bounced','bounced','complained','complained','sent'])await applyResendEvent(env.DB,'p',event(type));
 expect(stats()).toMatchObject({total_sent:1,total_delivered:1,total_opened:1,total_clicked:1,total_bounced:1,total_complained:1});
 expect(row().status).toBe('bounced');expect(sqlite.prepare('SELECT subscription_status FROM edm_contacts').get()!.subscription_status).toBe('unsubscribed');
});
test('account and workspace isolation; mismatched email ids cannot claim a mapped recipient',async()=>{
 expect(await applyResendEvent(env.DB,'foreign',event('opened'))).toBe(false);
 await applyResendEvent(env.DB,'p',event('sent'));
 expect(await applyResendEvent(env.DB,'p',{...event('clicked'),data:{email_id:'other',tags:{wr_recipient_id:'r'}}})).toBe(false);
 sqlite.exec("UPDATE edm_providers SET user_id='other'");
 expect(await applyResendEvent(env.DB,'p',event('clicked'))).toBe(false);expect(stats().total_clicked).toBe(0);
});
test('authenticated callback resolves uncertain send but does not downgrade confirmed failure',async()=>{
 sqlite.exec("UPDATE edm_campaign_recipients SET status='failed',error_message='待核实：timeout'");
 await applyResendEvent(env.DB,'p',event('delivered'));expect(row()).toMatchObject({status:'delivered',error_message:null});
 await applyResendEvent(env.DB,'p',event('failed'));await applyResendEvent(env.DB,'p',event('sent'));
 expect(row()).toMatchObject({status:'failed',error_message:'Resend: email.failed'});
});
test('counter and recipient updates roll back together',async()=>{
 sqlite.exec("CREATE TRIGGER fail_recipient BEFORE UPDATE ON edm_campaign_recipients BEGIN SELECT RAISE(ABORT,'test'); END;");
 await expect(applyResendEvent(env.DB,'p',event('opened'))).rejects.toThrow('test');expect(stats().total_opened).toBe(0);
 expect(sqlite.prepare('SELECT email_id FROM edm_resend_deliveries').get()!.email_id).toBeNull();
});
test('webhook requires valid signature and acknowledges duplicates',async()=>{
 const body=JSON.stringify(event('opened')),url='https://app.example.com/api/outreach/webhooks/resend/p';
 expect((await resendWebhookRoutes.request(url,{method:'POST',body},env)).status).toBe(401);
 for(let i=0;i<2;i++)expect((await resendWebhookRoutes.request(url,{method:'POST',body,headers:signed(body)},env)).status).toBe(200);
 expect(stats().total_opened).toBe(1);
 const unknown=JSON.stringify({...event('sent'),data:{email_id:'unmapped'}});
 expect((await resendWebhookRoutes.request(url,{method:'POST',body:unknown,headers:signed(unknown)},env)).status).toBe(503);
});
test('domain pagination and actionable restricted-key error',async()=>{
 const mock=vi.fn().mockResolvedValueOnce(Response.json({data:[{id:'d1'}],has_more:true})).mockResolvedValueOnce(Response.json({data:[{id:'d2'}],has_more:false}));vi.stubGlobal('fetch',mock);
 expect(await listResendDomains('test')).toHaveLength(2);expect(String(mock.mock.calls[1][0])).toContain('after=d1');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({}, {status:403})));await expect(listResendDomains('test')).rejects.toThrow('Full access');
});
test('domain and tracking routes restrict writes and isolate workspaces',async()=>{
 const mock=vi.fn(async(url:any,init:any)=>Response.json(String(url).endsWith('/d1')?{id:'d1',name:'example.com',open_tracking:init?.method==='PATCH',records:[]}:{data:[]}));vi.stubGlobal('fetch',mock);
 expect((await app('admin','other').request('/providers/p/resend/domains',{},env)).status).toBe(404);
 expect((await app('member').request('/providers/p/resend/domains/d1/tracking',{method:'POST'},env)).status).toBe(403);
 expect(mock).not.toHaveBeenCalled();
 expect((await app().request('/providers/p/resend/domains/d1',{},env)).status).toBe(200);
 expect((await app().request('/providers/p/resend/domains/d1/tracking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({openTracking:true,clickTracking:true})},env)).status).toBe(200);
 expect(mock.mock.calls.some(([,init])=>init?.method==='PATCH'&&JSON.parse(init.body).open_tracking)).toBe(true);
});
test('webhook registration reuses endpoint and stores signing secret encrypted and redacted',async()=>{
 const mock=vi.fn(async(url:any,init:any)=>Response.json(String(url).includes('?')?{data:[{id:'hook',endpoint:'https://app.example.com/api/outreach/webhooks/resend/p'}]}:{id:'hook',signing_secret:secret}));vi.stubGlobal('fetch',mock);
 expect((await app().request('/providers/p/resend/webhook',{method:'POST'},env)).status).toBe(200);
 expect(mock.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
 const stored=sqlite.prepare('SELECT * FROM edm_providers').get()!;expect(stored.config).not.toContain(secret);
 expect((await decodeProvider({id:'p',apiKey:stored.api_key,config:stored.config} as any,env)).config).toContain(secret);
 expect(await (await app().request('/providers',{},env)).text()).not.toContain(secret);
});
test('Resend can replace existing email default without changing AI default',async()=>{
 sqlite.exec("INSERT INTO edm_providers(id,user_id,provider,name,api_key,is_default,created_at,updated_at) VALUES ('old','u','mailchimp','Old','fake',1,0,0),('ai','u','openai','AI','fake',1,0,0)");
 expect((await app().request('/providers/p',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({isDefault:true})},env)).status).toBe(200);
 expect(sqlite.prepare("SELECT is_default FROM edm_providers WHERE id='old'").get()!.is_default).toBe(0);expect(sqlite.prepare("SELECT is_default FROM edm_providers WHERE id='ai'").get()!.is_default).toBe(1);
});
for(const callback of ['clicked','failed'])test(`queue sends once and preserves an early ${callback} callback`,async()=>{
 const mock=vi.fn(async(url:any,init:any)=>{expect(url).toBe('https://api.resend.com/emails');expect(init.headers['Idempotency-Key']).toBe('wr-r');const payload=JSON.parse(init.body);expect(payload).toMatchObject({to:['customer@example.com'],subject:'Hello Sam',reply_to:'reply@example.com'});expect(payload.html).toContain('unsubscribe');expect(payload.tags).toEqual([{name:'wr_recipient_id',value:'r'}]);await applyResendEvent(env.DB,'p',event(callback));return Response.json({id:'email1'})});vi.stubGlobal('fetch',mock);
 const msg={body:{recipientId:'r',campaignId:'c',providerId:'p',toEmail:'customer@example.com',toName:'Sam',fromEmail:'sales@example.com',fromName:'Test',replyTo:'reply@example.com',subject:'Hello {{name}}',bodyHtml:'<p>Hello {{name}}</p>',bodyText:'Hello {{name}}',variables:{name:'Sam'}},ack:vi.fn(),retry:vi.fn()};
 await handleEmailQueue({messages:[msg]} as any,env);expect(msg.retry).not.toHaveBeenCalled();expect(row().status).toBe(callback);
 await handleEmailQueue({messages:[msg]} as any,env);expect(mock).toHaveBeenCalledTimes(1);expect(row().status).toBe(callback);
});
for(const code of [401,403,429])test(`Resend ${code} rejection is safely retryable without uncertain-send quarantine`,async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({message:'rejected'},{status:code})));
 const msg={body:{recipientId:'r',campaignId:'c',providerId:'p',toEmail:'customer@example.com',toName:'Sam',fromEmail:'sales@example.com',fromName:'Test',replyTo:null,subject:'Hello',bodyHtml:'<p>Hello</p>',bodyText:'Hello',variables:{}},ack:vi.fn(),retry:vi.fn()};
 await handleEmailQueue({messages:[msg]} as any,env);expect(row().status).toBe('queued');expect(msg.retry).toHaveBeenCalledWith({delaySeconds:code===429?60:300});
 expect(stats().status).toBe(code===429?'sending':'paused');expect(sqlite.prepare('SELECT count(*) n FROM edm_email_send_attempts').get()!.n).toBe(0);
});

test('sender-domain whitelist includes verified sending-enabled Resend and Mailchimp domains only',async()=>{
 const {resolveSenderDomains}=await import('../../src/outreach/server/lib/sender-domains');
 const base={id:'p',name:'Resend',userId:'u',provider:'resend',status:'active',apiKey:'test',config:null,isDefault:true};
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({data:[{name:'ACFILTER.NET',status:'verified'},{name:'pending.example',status:'pending'},{name:'inbound.example',status:'verified',capabilities:{sending:'disabled'}}]})));
 const result=await resolveSenderDomains([base,{...base,id:'m',provider:'mailchimp',config:JSON.stringify({mailchimpDomains:[{domain:'oilsfilter.org',validSigning:true}]})},{...base,id:'disabled',status:'inactive'}]);
 expect(result.domains.map(d=>d.domain)).toEqual(['acfilter.net','oilsfilter.org']);expect(result.errors).toEqual([]);
 const {selectEmailProviderForSender}=await import('../../src/outreach/server/lib/email-provider-selection');
 expect(selectEmailProviderForSender(result.providers,'u','re@acfilter.net').provider?.id).toBe('p');
 expect(selectEmailProviderForSender(result.providers,'u','re@oilsfilter.org').provider?.id).toBe('m');
 expect(selectEmailProviderForSender([result.providers[0]],'u','re@unknown.example').provider).toBeUndefined();
});
test('sender-domain endpoint is workspace scoped, returns partial errors and never invents domains',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({data:[{name:'acfilter.net',status:'verified'}]})));
 let response=await app().request('/providers/sender-domains',{},env);expect(response.status).toBe(200);expect((await response.json() as any).data).toMatchObject([{domain:'acfilter.net',providerId:'p'}]);
 response=await app('admin','other').request('/providers/sender-domains',{},env);expect(await response.json()).toEqual({data:[],errors:[]});
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({message:'restricted'}, {status:403})));
 response=await app().request('/providers/sender-domains',{},env);const body:any=await response.json();expect(body.data).toEqual([]);expect(body.errors[0].message).toContain('Full access');expect(JSON.stringify(body)).not.toContain('re_test');
});
test('verified domain chooses its Resend account ahead of a different default account',async()=>{
 const {selectEmailProviderForSender}=await import('../../src/outreach/server/lib/email-provider-selection');
 const base={id:'default',userId:'u',provider:'resend',status:'active',apiKey:'fake',config:JSON.stringify({resendDomains:[{domain:'first.example',status:'verified'}]}),isDefault:true};
 const matching={...base,id:'matching',isDefault:false,config:JSON.stringify({resendDomains:[{domain:'second.example',status:'verified'}]})};
 expect(selectEmailProviderForSender([base,matching],'u','re@second.example').provider?.id).toBe('matching');
});
test('campaign submission selects the verified Resend account and blocks removed domains before queueing',async()=>{
 const {campaignRoutes}=await import('../../src/outreach/server/routes/campaign.routes');
 const h=new Hono<any>();h.use('*',async(c,next)=>{c.set('user',{id:'u',role:'admin',teamRead:true});await next()});h.route('/campaigns',campaignRoutes);
 sqlite.exec(`INSERT INTO edm_templates(id,user_id,name,subject,body_html,created_at,updated_at) VALUES ('t','u','Template','Hello','<p>Hello</p>',0,0);
 UPDATE edm_campaigns SET status='draft',template_id='t',sender_email='re@acfilter.net';
 INSERT INTO edm_providers(id,user_id,provider,name,api_key,config,is_default,created_at,updated_at) VALUES ('m','u','mailchimp','Mailchimp','unused','{}',1,0,0);`);
 sqlite.prepare("UPDATE edm_providers SET api_key=?,config=? WHERE id='m'").run(await seal('test-mailchimp','m',env),await seal(JSON.stringify({mailchimpDomains:[{domain:'oilsfilter.org',status:'verified'}]}),'m:config',env));
 vi.stubGlobal('fetch',vi.fn(async(url:any)=>String(url).includes('/webhooks')?Response.json(String(url).includes('?')?{data:[]}:{id:'hook',signing_secret:secret}):Response.json({data:[{id:'domain',name:'acfilter.net',status:'verified',open_tracking:true,click_tracking:true}]})));
 const sendBatch=vi.fn();env.EMAIL_QUEUE={sendBatch};
 let response=await h.request('/campaigns/c/send',{method:'POST'},env);expect(response.status).toBe(200);expect(sendBatch.mock.calls[0][0][0].body.providerId).toBe('p');
 sqlite.exec("UPDATE edm_campaigns SET status='draft'");sendBatch.mockClear();vi.stubGlobal('fetch',vi.fn(async()=>Response.json({data:[{name:'acfilter.net',status:'pending'}]})));
 response=await h.request('/campaigns/c/send',{method:'POST'},env);expect(response.status).toBe(400);expect(sendBatch).not.toHaveBeenCalled();expect(stats().status).toBe('draft');
});

test('rate rejection honors Retry-After using delayed publication; daily quota pauses',async()=>{
 const msg={body:{recipientId:'r',campaignId:'c',providerId:'p',toEmail:'customer@example.com',toName:'Sam',fromEmail:'sales@example.com',fromName:'Test',replyTo:null,subject:'Hello',bodyHtml:'<p>Hello</p>',bodyText:null,variables:{}},ack:vi.fn(),retry:vi.fn()};
 const send=vi.fn();env.EMAIL_QUEUE={send};
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({name:'rate_limit_exceeded'},{status:429,headers:{'retry-after':'37'}})));
 await handleEmailQueue({messages:[msg]} as any,env);
 expect(send).toHaveBeenLastCalledWith(msg.body,{delaySeconds:37});expect(msg.retry).not.toHaveBeenCalled();expect(row().status).toBe('queued');
 sqlite.exec('UPDATE edm_email_clocks SET next_at=0; DELETE FROM edm_email_schedule');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({name:'daily_quota_exceeded'},{status:429})));
 await handleEmailQueue({messages:[msg]} as any,env);expect(stats().status).toBe('paused');expect(row().error_message).toContain('QUOTA_REJECTED');
 expect(sqlite.prepare('SELECT count(*) n FROM edm_email_send_attempts').get()!.n).toBe(0);
});

test('Resend history sync is read-only, idempotent, workspace bound, and never re-sends unknown mail',async()=>{
 const {startResendSync,handleResendSync}=await import('../../src/outreach/server/lib/resend-tracking');
 const {emailOverview}=await import('../../src/outreach/server/lib/overview');
 sqlite.exec("UPDATE edm_resend_deliveries SET email_id='email1'; UPDATE edm_campaign_recipients SET status='sent',sent_at=1,ses_message_id='email1'; UPDATE edm_campaigns SET total_sent=1");
 const send=vi.fn();env.EMAIL_QUEUE={send};
 await startResendSync(env,'p');const message=send.mock.calls[0][0];
 const request=vi.fn(async(url:any,options:any)=>{expect(url).toBe('https://api.resend.com/emails/email1');expect(options.method || 'GET').toBe('GET');return Response.json({id:'email1',last_event:'clicked'})});vi.stubGlobal('fetch',request);
 await handleResendSync(message,env);await handleResendSync(message,env);await handleResendSync(message,env);
 expect(request).toHaveBeenCalledOnce();expect(stats()).toMatchObject({total_sent:1,total_delivered:1,total_opened:1,total_clicked:1});
 expect((await emailOverview(env.DB,'u')).resendSync).toMatchObject([{status:'completed',checked:1,failed:0}]);
 expect((await emailOverview(env.DB,'other')).resendSync).toEqual([]);
 expect(sqlite.prepare('SELECT count(*) n FROM edm_email_send_attempts').get()!.n).toBe(0);
});

test('sync limit cooldown does not discard a record; expired lease can be recovered',async()=>{
 const {startResendSync,handleResendSync}=await import('../../src/outreach/server/lib/resend-tracking');
 sqlite.exec("UPDATE edm_resend_deliveries SET email_id='email1'");
 const send=vi.fn();env.EMAIL_QUEUE={send};await startResendSync(env,'p');const message=send.mock.calls[0][0];
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({name:'rate_limit_exceeded'},{status:429,headers:{'retry-after':'12'}})));
 await handleResendSync(message,env);
 expect(send).toHaveBeenLastCalledWith(message,{delaySeconds:12});expect(sqlite.prepare('SELECT checked_at FROM edm_resend_deliveries').get()!.checked_at).toBeNull();
 sqlite.prepare('UPDATE edm_resend_sync_runs SET lease_until=?').run(Date.now()+60000);
 expect(await handleResendSync(message,env)).toBeGreaterThan(0);
 sqlite.exec('UPDATE edm_resend_sync_runs SET lease_until=0; UPDATE edm_email_clocks SET next_at=0');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'email1',last_event:'delivered'})));
 await handleResendSync(message,env);expect(stats().total_delivered).toBe(1);
});

test('send preflight refuses dispatch when tracking configuration cannot be connected',async()=>{
 const {campaignRoutes}=await import('../../src/outreach/server/routes/campaign.routes');
 const h=new Hono<any>();h.use('*',async(c,next)=>{c.set('user',{id:'u',role:'admin',teamRead:true});await next()});h.route('/campaigns',campaignRoutes);
 sqlite.exec("INSERT INTO edm_templates(id,user_id,name,subject,body_html,created_at,updated_at) VALUES ('t','u','Template','Hello','<p>Hello</p>',0,0); UPDATE edm_campaigns SET status='draft',template_id='t'");
 vi.stubGlobal('fetch',vi.fn(async(url:any)=>String(url).includes('/domains')?Response.json({data:[{name:'example.com',status:'verified'}]}):Response.json({message:'forbidden'},{status:403})));
 env.EMAIL_QUEUE={sendBatch:vi.fn()};
 const response=await h.request('/campaigns/c/send',{method:'POST'},env);
 expect(response.status).toBe(400);expect((await response.json() as any).error).toContain('数据追踪未准备好');expect(env.EMAIL_QUEUE.sendBatch).not.toHaveBeenCalled();expect(stats().status).toBe('draft');
 for(const method of ['POST','PUT']){
 const invalid=await h.request(method==='POST'?'/campaigns':'/campaigns/c',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({sendRate:0})},env);
 expect(invalid.status).toBe(400);
 }
});
