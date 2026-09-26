import type { Principal } from './model';
export const appRoles = ['admin', 'analyst', 'member', 'viewer'] as const;
export type AppRole = typeof appRoles[number];
export const roleLabels: Record<AppRole | 'super_admin', string> = {
  super_admin: '超级管理员', admin: '工作区管理员', analyst: '数据主管', member: '业务成员', viewer: '只读成员',
};
export const roleDescriptions: Record<AppRole, string> = {
  admin: '管理本工作区用户、业务数据及服务商配置；不能分配超级管理员。',
  analyst: '查看本工作区所有用户的业务数据和邮件记录；不能修改、发送或管理用户。',
  member: '创建及管理自己的网站、邮件活动和站内信任务；使用工作区共享联系人与模板。',
  viewer: '只读查看自己的业务数据；不能创建、修改、发布或发送。',
};
export function effectiveRole(p: Principal): AppRole | 'super_admin' {
  return p.systemRole === 'super_admin' ? 'super_admin' : p.appRole || (p.workspaceRole === 'admin' ? 'admin' : 'member');
}
export const manageUsers = (p: Principal) => ['super_admin', 'admin'].includes(effectiveRole(p));
export const viewTeamData = (p: Principal) => ['super_admin', 'admin', 'analyst'].includes(effectiveRole(p));
export const writeBusiness = (p: Principal) => ['super_admin', 'admin', 'member'].includes(effectiveRole(p));
export const manageSettings = manageUsers;
