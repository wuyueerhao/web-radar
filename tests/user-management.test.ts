import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { d1 } from './outreach/sqlite';
import { applyUserAccess } from '../src/worker/user-access';
import { userManagement } from '../src/worker/user-management';
import { mintSession } from '../src/worker/auth';
import { actorScope } from '../src/outreach/server/lib/actor-scope';
import { campaignRoutes } from '../src/outreach/server/routes/campaign.routes';
import { outreachFetch } from '../src/worker/outreach';
import type { Principal } from '../src/shared/model';
import type { AppEnv } from '../src/worker/env';
import { effectiveRole, viewTeamData, writeBusiness } from '../src/shared/access';
const person=(id:string,workspaceId='w1',role:'admin'|'member'='member'):Principal=>({userId:id,workspaceId,workspaceRole:role,systemRole:'user',authSubject:id,email:id+'@example.test',displayName:id,workspaceName:workspaceId});
let sqlite:DatabaseSync,env:AppEnv,actor:Principal;
beforeEach(()=>{
 sqlite=new DatabaseSync(':memory:');for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('migrations/'+f,'utf8'));
 env={DB:d1(sqlite),PRODUCT_RADAR_BASE_URL:'https://account.example.test',PRODUCT_RADAR_INTEGRATION_SECRET:'test-integration-secret-at-least-32-characters'} as unknown as AppEnv;
 actor=person('admin','w1','admin');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({protocolVersion:1,principal:actor})));
});
async function request(path:string,method='GET',body?:any){
 const {token}=await mintSession(env,actor);
 return userManagement.request('https://wr.example.test'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})},env);
}
describe('user administration and visibility',()=>{
 it('restricts directory and edits to scoped administrators and prevents self and super changes',async()=>{
  await applyUserAccess(env,person('member'));await applyUserAccess(env,person('outside','w2'));
  let r=await request('/members');expect(r.status).toBe(200);expect((await r.json() as any).members.map((m:any)=>m.user_id).sort()).toEqual(['admin','member']);
  const body={workspaceId:'w1',userId:'member',role:'viewer',status:'active',version:1};
  expect((await request('/members','PUT',{...body,workspaceId:'w2',userId:'outside'})).status).toBe(403);
  expect((await request('/members','PUT',{...body,userId:'admin'})).status).toBe(409);
  expect((await request('/members','PUT',body)).status).toBe(200);
  expect((await request('/members','PUT',body)).status).toBe(409);
  expect(sqlite.prepare('SELECT COUNT(*) n FROM wr_access_audit').get()!.n).toBe(1);
  const member=await applyUserAccess(env,person('member'));expect(effectiveRole(member)).toBe('viewer');expect(writeBusiness(member)).toBe(false);
  actor=person('member');expect((await request('/members')).status).toBe(403);
 });
 it('revokes active sessions on disable and refuses subsequent authentication',async()=>{
  const session=await mintSession(env,person('member'));
  expect((await request('/members','PUT',{workspaceId:'w1',userId:'member',role:'member',status:'disabled',version:1})).status).toBe(200);
  expect(sqlite.prepare("SELECT count(*) n FROM sessions WHERE user_id='member'").get()!.n).toBe(0);
  await expect(applyUserAccess(env,person('member'))).rejects.toMatchObject({status:403});
 });
 it('lets analysts read workspace reports but not grant roles or write business data',async()=>{
  await applyUserAccess(env,person('analyst'));sqlite.prepare("UPDATE wr_members SET role='analyst' WHERE user_id='analyst'").run();
  actor=person('analyst');const p=await applyUserAccess(env,actor);expect(viewTeamData(p)).toBe(true);expect(writeBusiness(p)).toBe(false);
  expect((await request('/members')).status).toBe(200);
  expect((await request('/members','PUT',{})).status).toBe(403);
  const {token}=await mintSession(env,actor);
  await expect(outreachFetch(new Request('https://wr.example.test/api/outreach/campaigns',{method:'POST',headers:{Authorization:'Bearer '+token}}),env,{} as any)).rejects.toMatchObject({status:403});
 });
 it('records exact creator scope and keeps unattributed historical campaigns out of members view',async()=>{
  sqlite.exec("INSERT INTO edm_users(id,name,email,created_at,updated_at) VALUES('w1','W','w@example.test',0,0)");
  for(const [id,creator] of [['own','member'],['other','other'],['legacy',null]])sqlite.prepare("INSERT INTO edm_campaigns(id,user_id,created_by,name,sender_email,sender_name,created_at,updated_at) VALUES(?,?,?,?,?,?,0,0)").run(id,'w1',creator,id,'sender@example.test','Sender');
  actor=person('member');const {token}=await mintSession(env,actor);
  const response=await outreachFetch(new Request('https://wr.example.test/api/outreach/campaigns',{headers:{Authorization:'Bearer '+token}}),env,{} as any);
  expect(response.status).toBe(200);expect((await response.json() as any).data.map((r:any)=>r.id)).toEqual(['own']);
  const detail=await outreachFetch(new Request('https://wr.example.test/api/outreach/campaigns/other',{headers:{Authorization:'Bearer '+token}}),env,{} as any);expect(detail.status).toBe(404);
  actor=person('admin','w1','admin');const all=await request('/records?kind=campaigns');expect((await all.json() as any).total).toBe(3);
 });
 it('super admin reads all workspaces while existing super role cannot be overwritten',async()=>{
  await applyUserAccess(env,person('outside','w2'));actor={...person('root'),systemRole:'super_admin'};
  const r=await request('/members');expect((await r.json() as any).members.some((m:any)=>m.user_id==='outside')).toBe(true);
  actor=person('admin','w1','admin');expect((await request('/members','PUT',{workspaceId:'w1',userId:'root',role:'member',status:'disabled',version:1})).status).toBe(403);
 });
});
