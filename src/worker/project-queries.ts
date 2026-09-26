import { viewTeamData } from '../shared/access';
import type { Principal, ProjectList, ProjectSummary } from '../shared/model';
import { requireCondition } from './domain';

export async function listProjectSummaries(
  db: D1Database,
  principal: Principal,
  url: URL,
): Promise<ProjectList> {
  const page = Number(url.searchParams.get('page') ?? 1),
    pageSize = Number(url.searchParams.get('pageSize') ?? 20);
  requireCondition(
    Number.isInteger(page) &&
      page > 0 &&
      Number.isInteger(pageSize) &&
      pageSize > 0 &&
      pageSize <= 100,
    400,
    'invalid_pagination',
    '分页参数无效。',
  );
  const status = url.searchParams.get('status') ?? 'all',
    search = (url.searchParams.get('search') ?? '').trim().slice(0, 200);
  requireCondition(
    ['all', 'draft', 'published', 'offline'].includes(status),
    400,
    'invalid_status',
    '项目状态无效。',
  );
  const access =
    principal.systemRole === 'super_admin'
      ? '1=1'
      : viewTeamData(principal)
        ? 'workspace_id=?'
        : '(owner_id=? AND workspace_id=?)';
  const args =
    principal.systemRole === 'super_admin'
      ? []
      : viewTeamData(principal)
        ? [principal.workspaceId]
        : [principal.userId, principal.workspaceId];
  const state =
    "CASE WHEN json_extract(data,'$.publishedReleaseId') IS NULL THEN 'draft' WHEN json_extract(data,'$.offline')=1 THEN 'offline' ELSE 'published' END";
  const where = `${access}${search ? " AND (instr(lower(json_extract(data,'$.name')),lower(?))>0 OR instr(lower(json_extract(data,'$.draft.company.name')),lower(?))>0)" : ''}`;
  const values = [...args, ...(search ? [search, search] : [])];
  const grouped = await db
    .prepare(
      `SELECT ${state} AS status, count(*) AS count FROM projects WHERE ${where} GROUP BY status`,
    )
    .bind(...values)
    .all<{ status: 'draft' | 'offline' | 'published'; count: number }>();
  const counts = { all: 0, draft: 0, published: 0, offline: 0 };
  for (const row of grouped.results) {
    counts[row.status] = row.count;
    counts.all += row.count;
  }
  const rows = await db
    .prepare(
      `SELECT json_object('id',id,'name',json_extract(data,'$.name'),'companyName',json_extract(data,'$.draft.company.name'),'productCount',json_array_length(data,'$.draft.products'),'template',json_extract(data,'$.draft.template'),'coverAssetId',coalesce((SELECT CASE WHEN json_extract(banner.value,'$.kind')='video' THEN json_extract(banner.value,'$.posterAssetId') ELSE json_extract(banner.value,'$.slides[0].assetId') END FROM json_each(projects.data,'$.draft.banners') AS banner WHERE EXISTS (SELECT 1 FROM json_each(banner.value,'$.targets') AS target WHERE target.value='home') LIMIT 1),CASE WHEN json_type(data,'$.draft.banners') IS NULL THEN json_extract(data,'$.draft.banner.assetId') END,json_extract(data,'$.draft.siteDesign.pages.home.imageAssetId'),json_extract(data,'$.draft.posterAssetId'),(SELECT json_extract(value,'$.imageAssetId') FROM json_each(projects.data,'$.draft.products') WHERE json_extract(value,'$.imageAssetId') IS NOT NULL LIMIT 1)),'updatedAt',json_extract(data,'$.updatedAt'),'createdAt',json_extract(data,'$.createdAt'),'offline',json_extract(data,'$.offline'),'publishedReleaseId',json_extract(data,'$.publishedReleaseId')) AS summary FROM projects WHERE ${where}${status !== 'all' ? ` AND (${state})=?` : ''} ORDER BY json_extract(data,'$.updatedAt') DESC, json_extract(data,'$.createdAt') DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...values, ...(status !== 'all' ? [status] : []), pageSize, (page - 1) * pageSize)
    .all<{ summary: string }>();
  return {
    projects: rows.results.map((row) => JSON.parse(row.summary) as ProjectSummary),
    page,
    pageSize,
    total: counts[status as keyof typeof counts],
    counts,
  };
}
