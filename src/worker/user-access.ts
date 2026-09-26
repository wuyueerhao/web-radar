import type { Principal } from '../shared/model';
import type { AppEnv } from './env';
import type { AppRole } from '../shared/access';
import { ApiError } from './http';

export async function applyUserAccess(env: AppEnv, principal: Principal): Promise<Principal> {
  const now = new Date().toISOString();
  // Profile comes only from the verified identity service, never from a browser body.
  await env.DB.prepare(`INSERT INTO wr_members(workspace_id,user_id,email,display_name,workspace_name,upstream_role,is_super,created_at,last_seen_at)
    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET
    email=excluded.email,display_name=excluded.display_name,workspace_name=excluded.workspace_name,upstream_role=excluded.upstream_role,is_super=excluded.is_super,last_seen_at=excluded.last_seen_at
    WHERE wr_members.last_seen_at IS NULL OR wr_members.last_seen_at<? OR wr_members.email<>excluded.email OR wr_members.upstream_role<>excluded.upstream_role OR wr_members.is_super<>excluded.is_super`)
    .bind(principal.workspaceId,principal.userId,principal.email,principal.displayName,principal.workspaceName,principal.workspaceRole,principal.systemRole==='super_admin'?1:0,now,now,new Date(Date.now()-300000).toISOString()).run();
  const member = await env.DB.prepare('SELECT role,status FROM wr_members WHERE workspace_id=? AND user_id=?').bind(principal.workspaceId,principal.userId).first<{role:AppRole|null;status:string}>();
  if (member?.status === 'disabled' && principal.systemRole !== 'super_admin') throw new ApiError(403,'user_disabled','您的 Web Radar 访问权限已停用，请联系管理员。');
  const appRole = member?.role || (principal.workspaceRole === 'admin' ? 'admin' : 'member');
  return { ...principal, appRole, workspaceRole: appRole === 'admin' ? 'admin' : 'member' };
}
