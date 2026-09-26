import { effectiveRole, viewTeamData, writeBusiness } from '../shared/access';
import { handleResendSync, type ResendSyncMessage } from '../outreach/server/lib/resend-tracking';
import { resendWebhookRoutes } from '../outreach/server/routes/resend.routes';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from './env';
import { testMode } from './env';
import { authenticate } from './auth';
import { ApiError } from './http';
import type { Bindings, Variables } from '../outreach/shared/types';
import { contactRoutes } from '../outreach/server/routes/contact.routes';
import { templateRoutes } from '../outreach/server/routes/template.routes';
import { campaignRoutes } from '../outreach/server/routes/campaign.routes';
import { providersRoutes } from '../outreach/server/routes/providers.routes';
import { siteMessageRoutes } from '../outreach/server/routes/site-message.routes';
import { uploadRoutes } from '../outreach/server/routes/upload.routes';
import { imagesRoutes } from '../outreach/server/routes/images.routes';
import publicRoutes from '../outreach/server/public';
import { handleEmailQueue, type EmailSendMessage } from '../outreach/server/queues/email-send.queue';
import { handleSiteMessageQueue, type SiteMessageQueueMessage } from '../outreach/server/queues/site-message.queue';

export function outreachBindings(env: AppEnv): Bindings {
  return { DB:env.DB,STORAGE:env.MEDIA,EMAIL_QUEUE:env.EDM_EMAIL_QUEUE!,SITE_MESSAGE_QUEUE:env.EDM_SITE_QUEUE!,BROWSER:env.BROWSER!,
    CREDENTIAL_KEY:env.ASSET_SIGNING_KEY || (testMode(env)?'local-outreach-test-key':''),TEST_MODE:testMode(env),
    BETTER_AUTH_SECRET:env.ASSET_SIGNING_KEY || (testMode(env)?'local-outreach-test-key':''),BETTER_AUTH_URL:env.APP_ORIGIN || 'https://web-radar.net',
    SES_ACCESS_KEY_ID:'',SES_SECRET_ACCESS_KEY:'',SES_REGION:'us-east-1',DEEPSEEK_API_KEY:'',SERP_API_KEY:'' };
}
const privateApi=new Hono<{Bindings:Bindings;Variables:Variables}>();
privateApi.use('*',bodyLimit({maxSize:12*1024*1024,onError:c=>c.json({error:'请求内容超过 12 MB 限制'},413)}));
privateApi.route('/api/outreach/contacts',contactRoutes);
privateApi.route('/api/outreach/templates',templateRoutes);
privateApi.route('/api/outreach/campaigns',campaignRoutes);
privateApi.route('/api/outreach/providers',providersRoutes);
privateApi.route('/api/outreach/site-messages',siteMessageRoutes);
privateApi.route('/api/outreach/upload',uploadRoutes);
privateApi.notFound(c=>c.json({error:'接口不存在'},404));

export async function outreachFetch(request:Request, env:AppEnv, ctx:Parameters<typeof privateApi.fetch>[2]) {
  const path=new URL(request.url).pathname;
  const bindings=outreachBindings(env);
  if(request.method==='POST' && /^\/api\/outreach\/webhooks\/resend\/[a-f0-9-]+$/.test(path)) return resendWebhookRoutes.fetch(request,bindings,ctx);
  if(request.method==='GET' && /^\/api\/outreach\/(unsubscribe|preferences|tracking\/(open|click))$/.test(path)) return publicRoutes.fetch(request,bindings,ctx);
  if(request.method==='GET' && /^\/api\/outreach\/images\/[a-f0-9-]+\.(png|jpg|jpeg|webp|gif)$/.test(path)) {
    const app=new Hono<{Bindings:Bindings}>();app.route('/api/outreach/images',imagesRoutes);return app.fetch(request,bindings,ctx);
  }
  const {principal}=await authenticate(request,env);
  if (!['GET','HEAD'].includes(request.method) && !writeBusiness(principal)) throw new ApiError(403,'read_only_role','当前角色仅可查看数据，不能修改或发送。');
  if (/\/(send|start)$/.test(path) && request.method==='POST') {
    if(testMode(env)) throw new ApiError(503,'outreach_test_mode','测试环境仅支持保存草稿，不执行真实发送。');
    if(!bindings.EMAIL_QUEUE || (path.includes('/site-messages/')&&(!bindings.SITE_MESSAGE_QUEUE||(!bindings.BROWSER&&!testMode(env))))) throw new ApiError(503,'outreach_not_configured','发送队列或浏览器服务尚未配置。');
  }
  await env.DB.prepare('INSERT INTO edm_users (id,name,email,role,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(principal.workspaceId,principal.workspaceName,principal.workspaceId+'@workspace.invalid','member',Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)).run();
  const app=new Hono<{Bindings:Bindings;Variables:Variables}>();
  app.use('*',async(c,next)=>{c.set('user',{id:principal.workspaceId,name:principal.displayName,email:principal.email,actorId:principal.userId,teamRead:viewTeamData(principal),role:['super_admin','admin'].includes(effectiveRole(principal))?'admin':writeBusiness(principal)?'member':'viewer'});await next()});
  app.route('/',privateApi);
  app.onError((error,c)=>{console.error('Outreach request failed',testMode(env)?error:error.name);return c.json({error:'操作失败，请检查输入或服务配置后重试。'},500)});
  return app.fetch(request,bindings,ctx);
}
export async function outreachQueue(batch:MessageBatch<EmailSendMessage|SiteMessageQueueMessage|ResendSyncMessage>,env:AppEnv) {
  const bindings=outreachBindings(env);
  if(testMode(env)) { for(const m of batch.messages)m.ack();return; }
  if(batch.queue.startsWith('web-radar-edm-email')) {
    const groups=new Map<string,Message<EmailSendMessage>[]>();
    for (const message of batch.messages) {
      if ('kind' in message.body && message.body.kind === 'resend-sync') {
        const delay=await handleResendSync(message.body,bindings);
        if(delay) await bindings.EMAIL_QUEUE.send(message.body,{delaySeconds:Math.min(86400,delay)});
        message.ack();
      } else {
        const email = message as Message<EmailSendMessage>;
        groups.set(email.body.campaignId,[...(groups.get(email.body.campaignId)||[]),email]);
      }
    }
    for(const messages of groups.values())await handleEmailQueue({messages,recovery:batch.queue.endsWith('-dlq')},bindings);
    return;
  }
  if(batch.queue==='web-radar-edm-sites') return handleSiteMessageQueue(batch as MessageBatch<SiteMessageQueueMessage>,bindings);
  throw new Error('Unknown outreach queue');
}
