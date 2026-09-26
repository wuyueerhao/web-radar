import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { HonoEnv } from '../env';
import type { Principal } from '../../shared/model';
import { authenticate } from '../auth';
import { ApiError, errorResponse, jsonBody } from '../http';
import { manageUsers, viewTeamData, writeBusiness } from '../../shared/access';
import { seal, unseal } from '../../outreach/server/lib/credentials';
import { digest, sign, equal, ingest, now, refreshReplyStats, type InboxConfig } from './core';
const failure = (status: number, message: string) => new ApiError(status, 'inbox_error', message);
const credentials = (env: HonoEnv['Bindings']) =>
  ({
    CREDENTIAL_KEY:
      env.ASSET_SIGNING_KEY || (env.TEST_PROVIDERS === 'true' ? 'local-outreach-test-key' : ''),
  }) as any;
const inbox = new Hono<HonoEnv>();
inbox.onError(errorResponse);
inbox.use(
  '*',
  bodyLimit({
    maxSize: 15 * 1024 * 1024,
    onError: (c) => c.json({ error: '邮件最大支持 15 MB' }, 413),
  }),
);
inbox.post('/receive/:id', async (c) => {
  const config = await c.env.DB.prepare('SELECT * FROM wr_inbox_configs WHERE id=?')
    .bind(c.req.param('id'))
    .first<InboxConfig>();
  if (!config) throw failure(401, '接收凭据无效');
  const timestamp = c.req.header('X-Inbox-Time') || '',
    recipient = (c.req.header('X-Inbox-To') || '').toLowerCase(),
    from = c.req.header('X-Inbox-From') || '',
    forward = c.req.header('X-Inbox-Forward') || 'unknown',
    forwardTo = c.req.header('X-Inbox-Forward-To') || '';
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 300000 ||
    recipient.split('@')[1] !== config.domain ||
    recipient.length > 254 ||
    from.length > 500 ||
    !z.email().max(254).safeParse(forwardTo).success ||
    !['forwarded', 'failed', 'disabled'].includes(forward)
  )
    throw failure(401, '接收签名无效或过期');
  const raw = await c.req.arrayBuffer(),
    hash = await digest(raw),
    secret = await unseal(config.secret, 'inbox:' + config.id, credentials(c.env));
  if (
    !equal(
      await sign(
        secret,
        [config.id, timestamp, recipient, from, forward, forwardTo, hash].join('\n'),
      ),
      c.req.header('X-Inbox-Signature') || '',
    )
  )
    throw failure(401, '接收签名无效');
  return c.json(
    await ingest(
      c.env,
      { ...config, forward_to: forwardTo },
      raw,
      recipient,
      from,
      forward,
      forwardTo === config.forward_to && forward === 'forwarded',
    ),
  );
});
inbox.use('*', async (c, next) => {
  const { principal } = await authenticate(c.req.raw, c.env);
  const workspaceId = c.req.query('workspaceId');
  if (
    workspaceId &&
    workspaceId !== principal.workspaceId &&
    principal.systemRole !== 'super_admin'
  )
    throw failure(403, '无权访问其他工作区');
  c.set('principal', workspaceId ? { ...principal, workspaceId } : principal);
  await next();
});
function scope(p: Principal) {
  return {
    sql: `t.workspace_id=?${viewTeamData(p) ? '' : ' AND (t.owner_id=? OR t.assignee_id=?)'}`,
    args: viewTeamData(p) ? [p.workspaceId] : [p.workspaceId, p.userId, p.userId],
  };
}
async function thread(c: any, id: string) {
  const p = c.get('principal') as Principal,
    s = scope(p);
  const row = await c.env.DB.prepare(
    `SELECT t.*,cfg.team_body,r.source,r.business_id,r.target_id,r.original_email,r.website_url,r.address,r.snapshot,r.subject original_subject FROM wr_inbox_threads t JOIN wr_inbox_configs cfg ON cfg.id=t.config_id LEFT JOIN wr_inbox_routes r ON r.id=t.route_id WHERE t.id=? AND ${s.sql}`,
  )
    .bind(id, ...s.args)
    .first();
  if (!row) throw failure(404, '会话不存在或无权访问');
  return row;
}
function canBody(p: Principal, t: any) {
  return manageUsers(p) || t.owner_id === p.userId || t.assignee_id === p.userId || !!t.team_body;
}
async function audit(c: any, id: string | null, action: string, detail: unknown) {
  const p = c.get('principal');
  await c.env.DB.prepare('INSERT INTO wr_inbox_audit VALUES(?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), p.workspaceId, id, p.userId, action, JSON.stringify(detail), now())
    .run();
}
inbox.get('/workspaces', async (c) => {
  const p = c.get('principal');
  if (p.systemRole !== 'super_admin')
    return c.json({ workspaces: [{ id: p.workspaceId, name: p.workspaceName }] });
  return c.json({
    workspaces: (
      await c.env.DB.prepare(
        'SELECT workspace_id id,MAX(workspace_name) name FROM wr_members GROUP BY workspace_id ORDER BY name LIMIT 1000',
      ).all()
    ).results,
  });
});
inbox.get('/configs', async (c) => {
  const p = c.get('principal');
  const rows = await c.env.DB.prepare(
    'SELECT id,domain,forward_to,enabled,track_edm,track_sites,team_body,verified_at,last_received_at,created_at FROM wr_inbox_configs WHERE workspace_id=? ORDER BY created_at DESC',
  )
    .bind(p.workspaceId)
    .all();
  return c.json({
    configs: manageUsers(p)
      ? rows.results
      : rows.results.map((r: any) => ({
          domain: r.domain,
          enabled: r.enabled,
          verified_at: r.verified_at,
        })),
    canManage: manageUsers(p),
    instance: new URL(c.req.url).origin,
  });
});
const configSchema = z.strictObject({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
  forwardTo: z.email().max(254),
  trackEdm: z.boolean(),
  trackSites: z.boolean(),
  teamBody: z.boolean(),
});
inbox.post('/configs', async (c) => {
  const p = c.get('principal');
  if (!manageUsers(p)) throw failure(403, '仅管理员可配置收信');
  const parsed = configSchema.safeParse(await jsonBody(c.req.raw));
  if (!parsed.success) throw failure(400, '请填写有效的收信域名与转发邮箱');
  const b = parsed.data;
  if (b.forwardTo.toLowerCase().endsWith('@' + b.domain))
    throw failure(400, '转发目的邮箱不能属于当前收信域名，避免循环转发');
  const exists = await c.env.DB.prepare('SELECT id FROM wr_inbox_configs WHERE domain=?')
    .bind(b.domain)
    .first();
  if (exists) throw failure(409, '此域名已配置，请修改已有配置');
  const id = crypto.randomUUID(),
    secret = crypto.randomUUID() + crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO wr_inbox_configs(id,workspace_id,domain,forward_to,secret,track_edm,track_sites,team_body,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
  )
    .bind(
      id,
      p.workspaceId,
      b.domain,
      b.forwardTo,
      await seal(secret, 'inbox:' + id, credentials(c.env)),
      Number(b.trackEdm),
      Number(b.trackSites),
      Number(b.teamBody),
      now(),
    )
    .run();
  await audit(c, null, 'config.create', { id, domain: b.domain });
  return c.json({
    id,
    secret,
    endpoint: new URL('/api/inbox/receive/' + id, c.req.url).toString(),
    domain: b.domain,
    forwardTo: b.forwardTo,
  });
});
inbox.put('/configs/:id', async (c) => {
  const p = c.get('principal');
  if (!manageUsers(p)) throw failure(403, '仅管理员可配置收信');
  const b = z
    .strictObject({
      enabled: z.boolean(),
      trackEdm: z.boolean(),
      trackSites: z.boolean(),
      teamBody: z.boolean(),
    })
    .safeParse(await jsonBody(c.req.raw));
  if (!b.success) throw failure(400, '配置格式错误');
  const row = await c.env.DB.prepare('SELECT * FROM wr_inbox_configs WHERE id=? AND workspace_id=?')
    .bind(c.req.param('id'), p.workspaceId)
    .first<InboxConfig>();
  if (!row) throw failure(404, '配置不存在');
  if (b.data.enabled && !row.verified_at)
    throw failure(409, '请先部署收信入口并接收一封测试邮件，再启用追踪');
  const steps = [];
  if (b.data.enabled)
    steps.push(
      c.env.DB.prepare('UPDATE wr_inbox_configs SET enabled=0 WHERE workspace_id=?').bind(
        p.workspaceId,
      ),
    );
  steps.push(
    c.env.DB.prepare(
      'UPDATE wr_inbox_configs SET enabled=?,track_edm=?,track_sites=?,team_body=? WHERE id=?',
    ).bind(
      Number(b.data.enabled),
      Number(b.data.trackEdm),
      Number(b.data.trackSites),
      Number(b.data.teamBody),
      row.id,
    ),
  );
  await c.env.DB.batch(steps);
  await audit(c, null, 'config.update', { id: row.id, ...b.data });
  return c.json({ ok: true });
});
inbox.put('/configs/:id/forward', async (c) => {
  const p = c.get('principal');
  if (!manageUsers(p)) throw failure(403, '仅管理员可配置收信');
  const b = z.strictObject({ forwardTo: z.email().max(254) }).safeParse(await jsonBody(c.req.raw));
  if (!b.success) throw failure(400, '转发邮箱无效');
  const cfg = await c.env.DB.prepare('SELECT * FROM wr_inbox_configs WHERE id=? AND workspace_id=?')
    .bind(c.req.param('id'), p.workspaceId)
    .first<InboxConfig>();
  if (!cfg) throw failure(404, '配置不存在');
  if (b.data.forwardTo.toLowerCase().endsWith('@' + cfg.domain))
    throw failure(400, '不能转发至相同收信域名');
  await c.env.DB.prepare(
    'UPDATE wr_inbox_configs SET forward_to=?,enabled=0,verified_at=NULL WHERE id=?',
  )
    .bind(b.data.forwardTo, cfg.id)
    .run();
  await audit(c, null, 'config.forward', { id: cfg.id, forwardTo: b.data.forwardTo });
  return c.json({ ok: true });
});
inbox.get('/members', async (c) => {
  const p = c.get('principal');
  if (!manageUsers(p)) return c.json({ members: [] });
  return c.json({
    members: (
      await c.env.DB.prepare(
        "SELECT user_id,display_name,email FROM wr_members WHERE workspace_id=? AND status='active' ORDER BY display_name LIMIT 500",
      )
        .bind(p.workspaceId)
        .all()
    ).results,
  });
});
inbox.get('/routes', async (c) => {
  const p = c.get('principal');
  if (!manageUsers(p)) throw failure(403, '仅管理员可人工关联');
  const q = (c.req.query('q') || '').slice(0, 200);
  const rows = await c.env.DB.prepare(
    `SELECT r.id,r.source,r.business_id,r.target_id,r.original_email,r.website_url,r.subject,r.address,r.config_id,COALESCE(c.name,j.name) business_name FROM wr_inbox_routes r LEFT JOIN edm_campaigns c ON r.source='edm' AND c.id=r.business_id LEFT JOIN edm_site_message_jobs j ON r.source='site' AND j.id=r.business_id WHERE r.workspace_id=? AND (?='' OR instr(lower(COALESCE(r.website_url,'')||COALESCE(r.original_email,'')||r.subject||COALESCE(c.name,j.name,'')),lower(?))>0) ORDER BY r.created_at DESC LIMIT 50`,
  )
    .bind(p.workspaceId, q, q)
    .all();
  return c.json({ routes: rows.results });
});
inbox.get('/threads', async (c) => {
  const p = c.get('principal'),
    s = scope(p);
  let where = s.sql;
  const args: unknown[] = [...s.args];
  const q = c.req.query();
  for (const [key, col] of [
    ['source', 'r.source'],
    ['businessId', 'r.business_id'],
    ['owner', 't.owner_id'],
    ['status', 't.status'],
    ['mailbox', 'm.recipient'],
  ] as const) {
    if (q[key]) {
      where += ` AND ${col}=?`;
      args.push(q[key].slice(0, 300));
    }
  }
  if (q.unmatched === '1') where += ' AND t.route_id IS NULL';
  if (q.unread === '1')
    where += ' AND (rd.last_read_at IS NULL OR rd.last_read_at<t.last_received_at)';
  if (q.kind) {
    where +=
      ' AND EXISTS(SELECT 1 FROM wr_inbox_messages km WHERE km.thread_id=t.id AND km.kind=?)';
    args.push(q.kind);
  }
  if (q.search) {
    where +=
      " AND (instr(lower(m.sender||m.recipient||t.subject||COALESCE(r.website_url,'')),lower(?))>0)";
    args.push(q.search.slice(0, 200));
  }
  for (const [k, op] of [
    ['from', '>='],
    ['to', '<='],
  ] as const) {
    if (q[k] && /^\d{4}-\d{2}-\d{2}$/.test(q[k])) {
      where += ` AND t.last_received_at${op}?`;
      args.push(q[k] + (k === 'from' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'));
    }
  }
  const page = Number(q.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw failure(400, '分页参数无效');
  const joins = `FROM wr_inbox_threads t JOIN wr_inbox_configs cfg ON cfg.id=t.config_id LEFT JOIN wr_inbox_routes r ON r.id=t.route_id JOIN wr_inbox_messages m ON m.id=(SELECT id FROM wr_inbox_messages WHERE thread_id=t.id ORDER BY received_at DESC,id DESC LIMIT 1) LEFT JOIN wr_inbox_reads rd ON rd.thread_id=t.id AND rd.user_id=? LEFT JOIN edm_campaigns ca ON r.source='edm' AND ca.id=r.business_id LEFT JOIN edm_site_message_jobs sj ON r.source='site' AND sj.id=r.business_id`;
  const rows = await c.env.DB.prepare(
    `SELECT t.*,r.source,r.business_id,r.original_email,r.website_url,COALESCE(ca.name,sj.name) business_name,m.sender,m.recipient,m.kind,CASE WHEN rd.last_read_at>=t.last_received_at THEN 0 ELSE 1 END unread,(SELECT COUNT(*) FROM wr_inbox_messages WHERE thread_id=t.id) message_count ${joins} WHERE ${where} ORDER BY t.last_received_at DESC,t.id LIMIT 30 OFFSET ?`,
  )
    .bind(p.userId, ...args, (page - 1) * 30)
    .all();
  const count = await c.env.DB.prepare(`SELECT COUNT(*) n ${joins} WHERE ${where}`)
    .bind(p.userId, ...args)
    .first<{ n: number }>();
  const stats = await c.env.DB.prepare(
    `SELECT COUNT(*) conversations,SUM(t.status='pending') pending,SUM(t.route_id IS NULL) unmatched,SUM(EXISTS(SELECT 1 FROM wr_inbox_messages hm WHERE hm.thread_id=t.id AND hm.kind='human')) human FROM wr_inbox_threads t WHERE ${s.sql}`,
  )
    .bind(...s.args)
    .first();
  return c.json({
    threads: rows.results,
    total: count?.n || 0,
    page,
    stats,
    canManage: manageUsers(p),
    canWrite: writeBusiness(p),
  });
});
inbox.get('/threads/:id', async (c) => {
  const p = c.get('principal'),
    t = await thread(c, c.req.param('id')),
    body = canBody(p, t);
  const rows = await c.env.DB.prepare(
    'SELECT id,sender,recipient,subject,text_body,attachments,kind,match_method,forward_to,forward_status,received_at FROM wr_inbox_messages WHERE thread_id=? ORDER BY received_at,id LIMIT 500',
  )
    .bind(t.id)
    .all<any>();
  const messages = rows.results.map((m) => ({
    ...m,
    text_body: body ? m.text_body : null,
    attachments: body
      ? JSON.parse(m.attachments).map((a: any, i: number) => ({
          name: a.name,
          size: a.size,
          index: i,
        }))
      : [],
  }));
  return c.json({
    thread: { ...t, snapshot: body ? t.snapshot : null },
    messages,
    canBody: body,
    canWrite: writeBusiness(p),
    canManage: manageUsers(p),
  });
});
inbox.post('/threads/:id/read', async (c) => {
  const p = c.get('principal'),
    t = await thread(c, c.req.param('id'));
  await jsonBody(c.req.raw);
  await c.env.DB.prepare(
    'INSERT INTO wr_inbox_reads VALUES(?,?,?) ON CONFLICT(thread_id,user_id) DO UPDATE SET last_read_at=excluded.last_read_at',
  )
    .bind(t.id, p.userId, t.last_received_at)
    .run();
  return c.json({ ok: true });
});
inbox.put('/threads/:id', async (c) => {
  const p = c.get('principal');
  if (!writeBusiness(p)) throw failure(403, '当前角色只读');
  const t = await thread(c, c.req.param('id'));
  const b = z
    .strictObject({
      status: z.enum(['pending', 'following', 'done']),
      assigneeId: z.string().max(200).nullable(),
      version: z.number().int().positive(),
    })
    .safeParse(await jsonBody(c.req.raw));
  if (!b.success) throw failure(400, '处理状态无效');
  if (b.data.assigneeId !== t.assignee_id && !manageUsers(p))
    throw failure(403, '仅管理员可分配负责人');
  if (
    b.data.assigneeId &&
    !(await c.env.DB.prepare(
      "SELECT 1 FROM wr_members WHERE workspace_id=? AND user_id=? AND status='active'",
    )
      .bind(p.workspaceId, b.data.assigneeId)
      .first())
  )
    throw failure(400, '负责人不是本工作区有效成员');
  const result = await c.env.DB.prepare(
    'UPDATE wr_inbox_threads SET status=?,assignee_id=?,version=version+1 WHERE id=? AND version=?',
  )
    .bind(b.data.status, b.data.assigneeId, t.id, b.data.version)
    .run();
  if (!result.meta.changes) throw failure(409, '会话已更新，请刷新后重试');
  await audit(c, t.id, 'thread.update', b.data);
  return c.json({ ok: true });
});
inbox.put('/messages/:id/kind', async (c) => {
  const p = c.get('principal');
  if (!writeBusiness(p)) throw failure(403, '当前角色只读');
  const m = await c.env.DB.prepare('SELECT thread_id FROM wr_inbox_messages WHERE id=?')
    .bind(c.req.param('id'))
    .first<{ thread_id: string }>();
  if (!m) throw failure(404, '邮件不存在');
  const t = await thread(c, m.thread_id);
  if (!canBody(p, t)) throw failure(403, '无正文权限');
  const b = z
    .strictObject({ kind: z.enum(['human', 'automatic', 'bounce', 'unknown']) })
    .safeParse(await jsonBody(c.req.raw));
  if (!b.success) throw failure(400, '邮件分类无效');
  await c.env.DB.prepare('UPDATE wr_inbox_messages SET kind=? WHERE id=?')
    .bind(b.data.kind, c.req.param('id'))
    .run();
  await refreshReplyStats(c.env.DB, p.workspaceId);
  await audit(c, t.id, 'message.classify', { messageId: c.req.param('id'), kind: b.data.kind });
  return c.json({ ok: true });
});
inbox.put('/threads/:id/link', async (c) => {
  const p = c.get('principal');
  if (!manageUsers(p)) throw failure(403, '仅管理员可更正关联');
  const t = await thread(c, c.req.param('id'));
  const b = z
    .strictObject({ routeId: z.string().max(200).nullable() })
    .safeParse(await jsonBody(c.req.raw));
  if (!b.success) throw failure(400, '关联无效');
  const r = b.data.routeId
    ? await c.env.DB.prepare(
        'SELECT * FROM wr_inbox_routes WHERE id=? AND workspace_id=? AND config_id=?',
      )
        .bind(b.data.routeId, p.workspaceId, t.config_id)
        .first<any>()
    : null;
  if (b.data.routeId && !r) throw failure(404, '关联目标不存在或属于其他收信配置');
  const destination = r ? 'route-' + r.id : 'manual-' + crypto.randomUUID();
  if (destination === t.id) return c.json({ ok: true });
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT OR IGNORE INTO wr_inbox_threads(id,workspace_id,config_id,route_id,owner_id,subject,last_received_at,created_at) VALUES(?,?,?,?,?,?,?,?)',
    ).bind(
      destination,
      p.workspaceId,
      t.config_id,
      r?.id || null,
      r?.owner_id || null,
      t.subject,
      t.last_received_at,
      now(),
    ),
    c.env.DB.prepare(
      'UPDATE wr_inbox_messages SET thread_id=?,match_method=? WHERE thread_id=?',
    ).bind(destination, r ? 'manual' : 'unmatched', t.id),
    c.env.DB.prepare(
      "UPDATE wr_inbox_threads SET last_received_at=MAX(last_received_at,?),status='pending',version=version+1 WHERE id=?",
    ).bind(t.last_received_at, destination),
    c.env.DB.prepare('DELETE FROM wr_inbox_reads WHERE thread_id=? OR thread_id=?').bind(
      t.id,
      destination,
    ),
    c.env.DB.prepare('DELETE FROM wr_inbox_threads WHERE id=?').bind(t.id),
  ]);
  await refreshReplyStats(c.env.DB, p.workspaceId);
  await audit(c, destination, 'thread.link', {
    from: t.id,
    oldRoute: t.route_id,
    routeId: r?.id || null,
  });
  return c.json({ ok: true, threadId: destination });
});
inbox.get('/messages/:id/attachments/:index', async (c) => {
  const p = c.get('principal');
  const m = await c.env.DB.prepare('SELECT thread_id,attachments FROM wr_inbox_messages WHERE id=?')
    .bind(c.req.param('id'))
    .first<any>();
  if (!m) throw failure(404, '附件不存在');
  const t = await thread(c, m.thread_id);
  if (!canBody(p, t)) throw failure(403, '无附件权限');
  const i = Number(c.req.param('index')),
    a = Number.isInteger(i) && i >= 0 ? JSON.parse(m.attachments)[i] : null;
  if (!a) throw failure(404, '附件不存在');
  const obj = await c.env.MEDIA.get(a.key);
  if (!obj) throw failure(404, '附件不存在');
  await audit(c, t.id, 'attachment.download', { messageId: c.req.param('id'), index: i });
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.name.replace(/[\r\n]/g, ''))}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
inbox.get('/audit', async (c) => {
  const p = c.get('principal');
  if (!manageUsers(p)) throw failure(403, '仅管理员可查看审计');
  return c.json({
    events: (
      await c.env.DB.prepare(
        'SELECT * FROM wr_inbox_audit WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100',
      )
        .bind(p.workspaceId)
        .all()
    ).results,
  });
});
inbox.get('/report', async (c) => {
  const p = c.get('principal'),
    q = c.req.query(),
    reports = [];
  for (const source of ['edm', 'site']) {
    if (q.source && q.source !== source) continue;
    const edm = source === 'edm',
      table = edm ? 'edm_campaigns' : 'edm_site_message_jobs';
    let where = 'b.user_id=?';
    const args: unknown[] = [p.workspaceId];
    if (!viewTeamData(p)) {
      where += ' AND b.created_by=?';
      args.push(p.userId);
    }
    if (q.owner) {
      where += ' AND b.created_by=?';
      args.push(q.owner.slice(0, 200));
    }
    if (q.businessId) {
      where += ' AND b.id=?';
      args.push(q.businessId.slice(0, 200));
    }
    const targets = edm ? 'edm_campaign_recipients' : 'edm_site_message_targets',
      businessColumn = edm ? 'campaign_id' : 'job_id',
      success = edm ? 'x.sent_at IS NOT NULL' : "x.status='submitted'";
    const row = await c.env.DB.prepare(
      `SELECT COALESCE(SUM((SELECT COUNT(*) FROM ${targets} x WHERE x.${businessColumn}=b.id AND ${success})),0) sent,
   COALESCE(SUM((SELECT COUNT(*) FROM ${targets} x JOIN wr_inbox_routes r ON r.target_id=x.id AND r.source=? WHERE x.${businessColumn}=b.id AND ${success})),0) tracked,
   COALESCE(SUM((SELECT COUNT(*) FROM ${targets} x JOIN wr_inbox_routes r ON r.target_id=x.id AND r.source=? WHERE x.${businessColumn}=b.id AND ${success} AND EXISTS(SELECT 1 FROM wr_inbox_threads t JOIN wr_inbox_messages m ON m.thread_id=t.id WHERE t.route_id=r.id AND m.kind='human'))),0) replied
   FROM ${table} b WHERE ${where}`,
    )
      .bind(source, source, ...args)
      .first();
    reports.push({ source, ...row });
  }
  return c.json({ reports });
});
export default inbox;
