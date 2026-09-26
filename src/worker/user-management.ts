import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from './env';
import { authenticate } from './auth';
import { ApiError, errorResponse, jsonBody } from './http';
import { appRoles, manageUsers, viewTeamData, roleLabels, roleDescriptions } from '../shared/access';

export const userManagement = new Hono<HonoEnv>();
userManagement.onError(errorResponse);
userManagement.use('*', async (c,next) => {
  const {principal}=await authenticate(c.req.raw,c.env);
  if(!viewTeamData(principal))throw new ApiError(403,'report_forbidden','此功能仅限管理员或数据主管。');
  c.set('principal',principal);await next();
});
function pagination(url: URL) {
  const page=Number(url.searchParams.get('page')||1),size=50;
  if(!Number.isSafeInteger(page)||page<1||page>100000)throw new ApiError(400,'invalid_page','分页参数无效。');
  return {page,size,offset:(page-1)*size};
}
userManagement.get('/members',async c=>{
  const p=c.get('principal'),url=new URL(c.req.url),{page,size,offset}=pagination(url);
  const search=(url.searchParams.get('search')||'').trim().slice(0,200);
  const scope=p.systemRole==='super_admin'?'1=1':'m.workspace_id=?';
  const args:unknown[]=p.systemRole==='super_admin'?[]:[p.workspaceId];
  const where=scope+(search?" AND (instr(lower(m.email),lower(?))>0 OR instr(lower(m.display_name),lower(?))>0 OR instr(m.user_id,?)>0)":'');
  if(search)args.push(search,search,search);
  const [total,rows]=await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM wr_members m WHERE ${where}`).bind(...args).first<{n:number}>(),
    c.env.DB.prepare(`SELECT m.*,
      (SELECT COUNT(*) FROM projects p WHERE p.workspace_id=m.workspace_id AND p.owner_id=m.user_id) AS projects,
      (SELECT COUNT(*) FROM projects p WHERE p.workspace_id=m.workspace_id AND p.owner_id=m.user_id AND json_extract(p.data,'$.publishedReleaseId') IS NULL) AS drafts,
      (SELECT COUNT(*) FROM projects p WHERE p.workspace_id=m.workspace_id AND p.owner_id=m.user_id AND json_extract(p.data,'$.publishedReleaseId') IS NOT NULL AND COALESCE(json_extract(p.data,'$.offline'),0)=0) AS published,
      (SELECT COUNT(*) FROM edm_campaigns e WHERE e.user_id=m.workspace_id AND e.created_by=m.user_id) AS campaigns,
      (SELECT COALESCE(SUM(e.total_sent),0) FROM edm_campaigns e WHERE e.user_id=m.workspace_id AND e.created_by=m.user_id) AS sent,
      (SELECT COALESCE(SUM(e.total_replied),0) FROM edm_campaigns e WHERE e.user_id=m.workspace_id AND e.created_by=m.user_id) AS replied,
      (SELECT COUNT(*) FROM edm_site_message_jobs j WHERE j.user_id=m.workspace_id AND j.created_by=m.user_id) AS messages
      FROM wr_members m WHERE ${where} ORDER BY m.created_at DESC,m.workspace_id,m.user_id LIMIT ? OFFSET ?`).bind(...args,size,offset).all(),
  ]);
  return c.json({members:rows.results,total:total?.n||0,page,pageSize:size,canManage:manageUsers(p),roles:appRoles.map(id=>({id,label:roleLabels[id],description:roleDescriptions[id]}))});
});
userManagement.put('/members',async c=>{
  const p=c.get('principal');if(!manageUsers(p))throw new ApiError(403,'manage_users_required','您没有用户管理权限。');
  const body=z.strictObject({workspaceId:z.string().min(1).max(200),userId:z.string().min(1).max(200),role:z.enum(appRoles),status:z.enum(['active','disabled']),version:z.number().int().positive()}).safeParse(await jsonBody(c.req.raw));
  if(!body.success)throw new ApiError(400,'invalid_member','用户资料格式无效。');
  const b=body.data;
  if(p.systemRole!=='super_admin'&&p.workspaceId!==b.workspaceId)throw new ApiError(403,'workspace_forbidden','不能管理其他工作区的用户。');
  if(p.userId===b.userId)throw new ApiError(409,'self_change_forbidden','不能修改自己的角色或停用自己，请由其他管理员操作。');
  const target=await c.env.DB.prepare('SELECT * FROM wr_members WHERE workspace_id=? AND user_id=?').bind(b.workspaceId,b.userId).first<any>();
  if(!target)throw new ApiError(404,'member_missing','用户尚未登录本系统或不存在。');
  if(target.is_super)throw new ApiError(403,'super_admin_protected','超级管理员由统一账号服务管理，不能在此修改。');
  if(target.version!==b.version)throw new ApiError(409,'member_conflict','用户权限已更新，请刷新后重试。');
  const results=await c.env.DB.batch([
    c.env.DB.prepare('UPDATE wr_members SET role=?,status=?,version=version+1 WHERE workspace_id=? AND user_id=? AND version=? AND is_super=0').bind(b.role,b.status,b.workspaceId,b.userId,b.version),
    c.env.DB.prepare('INSERT INTO wr_access_audit(id,workspace_id,actor_id,target_id,action,detail,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),b.workspaceId,p.userId,b.userId,'member.update',JSON.stringify({before:{role:target.role,status:target.status},after:{role:b.role,status:b.status}}),new Date().toISOString()),
  ]);
  if(!results[0].meta.changes)throw new ApiError(409,'member_conflict','用户权限已更新，请刷新后重试。');
  if(b.status==='disabled')await c.env.DB.prepare('DELETE FROM sessions WHERE workspace_id=? AND user_id=?').bind(b.workspaceId,b.userId).run();
  return c.json({ok:true});
});
userManagement.get('/records',async c=>{
  const p=c.get('principal'),url=new URL(c.req.url),{page,size,offset}=pagination(url);
  const kind=url.searchParams.get('kind')||'projects';
  if(!['projects','campaigns','messages'].includes(kind))throw new ApiError(400,'invalid_kind','数据类型无效。');
  const workspace=url.searchParams.get('workspaceId')||'',owner=url.searchParams.get('userId')||'';
  const table=kind==='projects'?'projects':kind==='campaigns'?'edm_campaigns':'edm_site_message_jobs';
  const workspaceColumn=kind==='projects'?'r.workspace_id':'r.user_id',ownerColumn=kind==='projects'?'r.owner_id':'r.created_by';
  let where='1=1';const args:unknown[]=[];
  if(p.systemRole!=='super_admin'){where+=` AND ${workspaceColumn}=?`;args.push(p.workspaceId);}
  if(workspace){where+=` AND ${workspaceColumn}=?`;args.push(workspace);}
  if(owner==='__legacy__')where+=` AND ${ownerColumn} IS NULL`;
  else if(owner){where+=` AND ${ownerColumn}=?`;args.push(owner);}
  const columns=kind==='projects'?`r.id,json_extract(r.data,'$.name') AS name,json_extract(r.data,'$.createdAt') AS createdAt,json_extract(r.data,'$.updatedAt') AS updatedAt,
    CASE WHEN json_extract(r.data,'$.publishedReleaseId') IS NULL THEN 'draft' WHEN json_extract(r.data,'$.offline')=1 THEN 'offline' ELSE 'published' END AS status`
    :kind==='campaigns'?`r.id,r.name,r.status,r.created_at*1000 AS createdAt,r.sender_email AS senderEmail,r.total_recipients AS totalRecipients,r.total_sent AS totalSent,r.total_delivered AS totalDelivered,r.total_opened AS totalOpened,r.total_clicked AS totalClicked,r.total_replied AS totalReplied`
    :`r.id,r.name,r.status,r.created_at*1000 AS createdAt,r.total_targets AS totalTargets,r.total_submitted AS totalSubmitted,r.total_failed AS totalFailed`;
  const order=kind==='projects'?"json_extract(r.data,'$.createdAt')":'r.created_at';
  const [total,rows]=await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} r WHERE ${where}`).bind(...args).first<{n:number}>(),
    c.env.DB.prepare(`SELECT ${columns},${workspaceColumn} AS workspaceId,${ownerColumn} AS creatorId,m.display_name AS creatorName,m.email AS creatorEmail FROM ${table} r LEFT JOIN wr_members m ON m.workspace_id=${workspaceColumn} AND m.user_id=${ownerColumn} WHERE ${where} ORDER BY ${order} DESC,r.id LIMIT ? OFFSET ?`).bind(...args,size,offset).all(),
  ]);
  return c.json({records:rows.results,total:total?.n||0,page,pageSize:size});
});
userManagement.get('/audit',async c=>{
  const p=c.get('principal');if(!manageUsers(p))throw new ApiError(403,'manage_users_required','您没有用户管理权限。');
  const args=p.systemRole==='super_admin'?[]:[p.workspaceId];
  const rows=await c.env.DB.prepare(`SELECT * FROM wr_access_audit ${args.length?'WHERE workspace_id=?':''} ORDER BY created_at DESC LIMIT 100`).bind(...args).all();
  return c.json({events:rows.results});
});
userManagement.get('/records/:kind/:id',async c=>{
  const p=c.get('principal'),kind=c.req.param('kind'),id=c.req.param('id');
  if(!['campaigns','messages'].includes(kind))throw new ApiError(400,'invalid_kind','数据类型无效。');
  const table=kind==='campaigns'?'edm_campaigns':'edm_site_message_jobs';
  const row=await c.env.DB.prepare(`SELECT user_id FROM ${table} WHERE id=?`).bind(id).first<{user_id:string}>();
  if(!row||(p.systemRole!=='super_admin'&&row.user_id!==p.workspaceId))throw new ApiError(404,'record_missing','记录不存在或无权查看。');
  if(kind==='campaigns'){
    const rows=await c.env.DB.prepare(`SELECT t.email,r.status,r.sent_at,r.delivered_at,r.opened_at,r.clicked_at,r.replied_at FROM edm_campaign_recipients r JOIN edm_contacts t ON t.id=r.contact_id AND t.user_id=? WHERE r.campaign_id=? ORDER BY r.created_at DESC,r.id LIMIT 100`).bind(row.user_id,id).all<any>();
    return c.json({columns:['收件人','状态','发送时间','送达时间','打开时间','点击时间','回复时间'],rows:rows.results.map(r=>[r.email,r.status,...[r.sent_at,r.delivered_at,r.opened_at,r.clicked_at,r.replied_at].map(t=>t?new Date(t*1000).toISOString():null)])});
  }
  const rows=await c.env.DB.prepare('SELECT website_url,status,result_message,completed_at FROM edm_site_message_targets WHERE job_id=? ORDER BY position LIMIT 100').bind(id).all<any>();
  return c.json({columns:['目标网站','状态','结果','完成时间'],rows:rows.results.map(r=>[r.website_url,r.status,r.result_message,r.completed_at?new Date(r.completed_at*1000).toISOString():null])});
});
