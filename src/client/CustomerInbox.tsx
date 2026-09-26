import { useEffect, useState } from 'react';
import {
  api as request,
  post as requestPost,
  put as requestPut,
  errorMessage,
  sessionHeaders,
} from './api';
import { Button, Empty, Field, Icon, Modal, Notice, dateTime } from './components';
import type { Principal } from '../shared/model';
import { manageUsers } from '../shared/access';
import './inbox.css';
function scoped(path: string) {
  const workspace = new URL(location.href).searchParams.get('inboxWorkspace');
  if (!workspace) return path;
  const u = new URL(path, location.origin);
  u.searchParams.set('workspaceId', workspace);
  return u.pathname + u.search;
}
const api = <T,>(path: string) => request<T>(scoped(path));
const post = <T,>(path: string, body: unknown) => requestPost<T>(scoped(path), body);
const put = <T,>(path: string, body: unknown) => requestPut<T>(scoped(path), body);
const kinds: Record<string, string> = {
  unknown: '待确认',
  human: '客户回复',
  automatic: '自动回执',
  bounce: '退信',
};
const states: Record<string, string> = { pending: '待处理', following: '跟进中', done: '已完成' };
const methods: Record<string, string> = {
  address: '独立收信地址',
  headers: '邮件会话标识',
  manual: '人工关联',
  unmatched: '待关联',
};
export default function CustomerInbox({ principal }: { principal: Principal }) {
  const url = new URL(location.href),
    [source, setSource] = useState(url.searchParams.get('inboxSource') || ''),
    [business, setBusiness] = useState(url.searchParams.get('inboxBusiness') || ''),
    [owner, setOwner] = useState(url.searchParams.get('inboxOwner') || '');
  const [state, setState] = useState(''),
    [kind, setKind] = useState(''),
    [unmatched, setUnmatched] = useState(false),
    [unread, setUnread] = useState(false),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [mailbox, setMailbox] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [selected, setSelected] = useState(''),
    [configs, setConfigs] = useState<any[]>([]),
    [members, setMembers] = useState<any[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false),
    [domain, setDomain] = useState(''),
    [forwardTo, setForwardTo] = useState(''),
    [newConfig, setNewConfig] = useState<any>(null),
    [audit, setAudit] = useState<any[] | null>(null),
    [link, setLink] = useState(false),
    [routeQuery, setRouteQuery] = useState(''),
    [routes, setRoutes] = useState<any[]>([]),
    [report, setReport] = useState<any[]>([]);
  const [forwardEdit, setForwardEdit] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  useEffect(() => {
    api<any>('/api/inbox/workspaces')
      .then((v) => setWorkspaces(v.workspaces))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const admin = manageUsers(principal);
  useEffect(() => {
    let live = true;
    Promise.all([api<any>('/api/inbox/configs'), api<any>('/api/inbox/members')])
      .then(([a, b]) => {
        if (live) {
          setConfigs(a.configs);
          setMembers(b.members);
        }
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [revision]);
  useEffect(() => {
    setPage(1);
  }, [source, business, owner, state, kind, unmatched, unread, query, mailbox, from, to]);
  useEffect(() => {
    let live = true;
    setBusy(true);
    const q = new URLSearchParams({
      source,
      businessId: business,
      owner,
      status: state,
      kind,
      unmatched: unmatched ? '1' : '0',
      unread: unread ? '1' : '0',
      search: query,
      mailbox,
      from,
      to,
      page: String(page),
    });
    api<any>('/api/inbox/threads?' + q)
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [
    source,
    business,
    owner,
    state,
    kind,
    unmatched,
    unread,
    query,
    mailbox,
    from,
    to,
    page,
    revision,
  ]);
  useEffect(() => {
    let live = true;
    api<any>('/api/inbox/report?' + new URLSearchParams({ source, businessId: business, owner }))
      .then((v) => live && setReport(v.reports))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [source, business, owner, revision]);
  useEffect(() => {
    let live = true;
    setDetail(null);
    if (selected)
      api<any>('/api/inbox/threads/' + encodeURIComponent(selected))
        .then((v) => {
          if (live) {
            setDetail(v);
            post('/api/inbox/threads/' + encodeURIComponent(selected) + '/read', {}).catch(
              () => {},
            );
            setData((d: any) =>
              d
                ? {
                    ...d,
                    threads: d.threads.map((t: any) =>
                      t.id === selected ? { ...t, unread: 0 } : t,
                    ),
                  }
                : d,
            );
          }
        })
        .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [selected, revision]);
  async function action(fn: () => Promise<any>) {
    setError('');
    setBusy(true);
    try {
      await fn();
      setRevision((n) => n + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveThread(status: string, assigneeId: string | null) {
    await action(() =>
      put('/api/inbox/threads/' + encodeURIComponent(selected), {
        status,
        assigneeId,
        version: detail.thread.version,
      }),
    );
  }
  async function download(id: string, index: number, name: string) {
    await action(async () => {
      const r = await fetch(
        scoped('/api/inbox/messages/' + encodeURIComponent(id) + '/attachments/' + index),
        { headers: sessionHeaders() },
      );
      if (!r.ok) throw new Error('附件下载失败或无权访问');
      const u = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = u;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    });
  }
  const filterContent = (
    <>
      <Field label="来源">
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setBusiness('');
            setSelected('');
          }}
        >
          <option value="">全部来源</option>
          <option value="edm">EDM 邮件</option>
          <option value="site">站内信</option>
        </select>
      </Field>
      <Field label="处理状态">
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(states).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="邮件类型">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">全部类型</option>
          {Object.entries(kinds).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="收信地址">
        <input
          value={mailbox}
          onChange={(e) => setMailbox(e.target.value)}
          placeholder="完整域名邮箱"
        />
      </Field>
      {admin && (
        <Field label="业务创建者">
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">全部用户</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name || m.email || m.user_id}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="开始日期（UTC）">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <Field label="结束日期（UTC）">
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <label>
        <input
          type="checkbox"
          checked={unmatched}
          onChange={(e) => setUnmatched(e.target.checked)}
        />
        仅待关联
      </label>
      <label>
        <input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />
        仅未读
      </label>
    </>
  );
  return (
    <div className="customer-inbox">
      <header className="inbox-heading">
        <div className="page-heading">
          <h1>客户收件箱</h1>
          <p>集中查看客户来信，追溯邮件活动和网站联系任务。</p>
        </div>
        <div>
          <Button onClick={() => setRevision((n) => n + 1)}>
            <Icon name="refresh" />
            刷新
          </Button>
          {admin && <Button onClick={() => setSettings(true)}>收信配置</Button>}
        </div>
      </header>
      {principal.systemRole === 'super_admin' && (
        <Field label="当前工作区">
          <select
            value={url.searchParams.get('inboxWorkspace') || principal.workspaceId}
            onChange={(e) => {
              location.href = '/?view=inbox&inboxWorkspace=' + encodeURIComponent(e.target.value);
            }}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name || w.id}
              </option>
            ))}
          </select>
        </Field>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {!configs.some((c) => c.enabled) && (
        <Notice>
          收信尚未启用。
          {admin
            ? '请在收信配置中添加域名和转发邮箱，完成接入验证后启用。'
            : '请联系管理员配置收信。'}
          历史活动未追踪，不代表没有收到回复。
        </Notice>
      )}
      <section className="inbox-metrics">
        {[
          ['会话数', data?.stats?.conversations],
          ['待处理', data?.stats?.pending],
          ['确认客户回复的会话', data?.stats?.human],
          ['待关联', data?.stats?.unmatched],
        ].map(([label, value]) => (
          <div className="panel" key={String(label)}>
            <span className="muted">{label}</span>
            <strong>{value ?? '—'}</strong>
          </div>
        ))}
      </section>
      <section className="inbox-metrics inbox-rates">
        {report.map((r) => (
          <div className="panel" key={r.source}>
            <strong>{r.source === 'edm' ? 'EDM 邮件' : '站内信'}回复</strong>
            <p>
              {r.replied} / {r.sent} ·{' '}
              {r.tracked === 0 ? '未追踪' : r.tracked < r.sent ? '部分追踪' : '已追踪'}
            </p>
            <small className="muted">
              {r.tracked === 0
                ? '回复率 —'
                : `回复率 ${r.sent ? ((100 * r.replied) / r.sent).toFixed(1) : '—'}${r.sent ? '%' : ''}`}{' '}
              · 覆盖 {r.tracked} 个已发送／提交目标；人工确认后计数。
            </small>
          </div>
        ))}
      </section>
      <form
        className="inbox-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
      >
        <input
          aria-label="搜索客户来信"
          placeholder="搜索回复邮箱、收信地址、主题或网站"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit">搜索</Button>
        {business && (
          <Button
            onClick={() => {
              setBusiness('');
              setSelected('');
            }}
          >
            清除活动／任务筛选
          </Button>
        )}
      </form>
      <div className="inbox-layout">
        <aside className="panel inbox-filters">{filterContent}</aside>
        <section className="panel inbox-list" aria-label="会话列表">
          {busy && <p role="status">正在加载…</p>}
          {data?.threads.map((t: any) => (
            <button
              className={'inbox-thread' + (selected === t.id ? ' selected' : '')}
              key={t.id}
              onClick={() => setSelected(t.id)}
            >
              <span className="inbox-thread-meta">
                {t.source === 'edm' ? 'EDM' : t.source === 'site' ? '站内信' : '待关联'} ·{' '}
                {states[t.status]}
                {t.unread ? ' · 未读' : ''}
              </span>
              <strong>{t.subject}</strong>
              <span>{t.sender}</span>
              <small>
                {t.business_name || t.website_url || t.original_email || '待确认业务来源'}
              </small>
              <small>
                {dateTime(t.last_received_at)} · {t.message_count} 封
              </small>
            </button>
          ))}
          {data && !data.threads.length && !busy && (
            <Empty title="暂无客户来信">
              配置收信后，新回复会出现在这里。可调整筛选查看其它会话。
            </Empty>
          )}
          <div className="inbox-pagination">
            <span>共 {data?.total || 0} 条</span>
            <Button disabled={busy || page === 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </Button>
            <Button
              disabled={busy || page * 30 >= (data?.total || 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </section>
        <section className="panel inbox-detail" aria-label="邮件详情">
          {!detail ? (
            <Empty title={selected ? '正在读取邮件…' : '选择会话查看详情'} />
          ) : (
            <>
              <header>
                <h2>{detail.thread.subject}</h2>
                <p className="muted">
                  {detail.thread.source === 'edm'
                    ? 'EDM 邮件'
                    : detail.thread.source === 'site'
                      ? '站内信'
                      : '未关联来信'}{' '}
                  · {states[detail.thread.status]}
                </p>
                <Button onClick={() => setSelected('')}>关闭详情</Button>
              </header>
              <dl className="inbox-facts">
                <dt>原收件人／填写邮箱</dt>
                <dd>{detail.thread.original_email || '—'}</dd>
                <dt>目标网站</dt>
                <dd>{detail.thread.website_url || '—'}</dd>
                <dt>追踪地址</dt>
                <dd>{detail.thread.address || '—'}</dd>
              </dl>
              <div className="inbox-controls">
                <Field label="处理状态">
                  <select
                    disabled={!detail.canWrite || busy}
                    value={detail.thread.status}
                    onChange={(e) => saveThread(e.target.value, detail.thread.assignee_id)}
                  >
                    {Object.entries(states).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                {admin && (
                  <Field label="负责人">
                    <select
                      disabled={busy}
                      value={detail.thread.assignee_id || ''}
                      onChange={(e) => saveThread(detail.thread.status, e.target.value || null)}
                    >
                      <option value="">未分配</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.display_name || m.email || m.user_id}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {admin && (
                  <Button
                    onClick={() => {
                      setLink(true);
                      setRoutes([]);
                      setRouteQuery('');
                    }}
                  >
                    关联／更正来源
                  </Button>
                )}
              </div>
              {!detail.canBody && (
                <Notice>当前权限可查看统计和邮件概要，正文与附件由管理员授权。</Notice>
              )}
              {detail.thread.snapshot && (
                <details>
                  <summary>原发送／提交内容</summary>
                  <h3>{detail.thread.original_subject}</h3>
                  <pre className="inbox-body">{detail.thread.snapshot}</pre>
                </details>
              )}
              {detail.messages.map((m: any) => (
                <article className="inbox-mail" key={m.id}>
                  <div className="inbox-mail-heading">
                    <strong>{m.sender}</strong>
                    <span>{dateTime(m.received_at)}</span>
                  </div>
                  <p>回复到：{m.recipient}</p>
                  <p className="muted">
                    转发至：{m.forward_to || '—'} ·{' '}
                    {m.forward_status === 'forwarded'
                      ? '已转发'
                      : m.forward_status === 'failed'
                        ? '转发失败'
                        : '未转发'}
                  </p>
                  <p className="muted">关联依据：{methods[m.match_method]}</p>
                  <Field label="邮件分类">
                    <select
                      disabled={!detail.canWrite || !detail.canBody || busy}
                      value={m.kind}
                      onChange={(e) =>
                        action(() =>
                          put('/api/inbox/messages/' + encodeURIComponent(m.id) + '/kind', {
                            kind: e.target.value,
                          }),
                        )
                      }
                    >
                      {Object.entries(kinds).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {m.kind === 'unknown' && detail.canWrite && (
                    <small className="muted">请核对正文，确认是客户回复后计入回复统计。</small>
                  )}
                  {detail.canBody && (
                    <>
                      <h3>{m.subject}</h3>
                      <pre className="inbox-body">
                        {m.text_body || '（邮件没有可显示的文本内容）'}
                      </pre>
                      {m.attachments.map((a: any) => (
                        <Button key={a.index} onClick={() => download(m.id, a.index, a.name)}>
                          下载 {a.name}（{Math.ceil(a.size / 1024)} KB）
                        </Button>
                      ))}
                    </>
                  )}
                </article>
              ))}
              {detail.messages.length === 500 && <Notice>当前显示前 500 封邮件。</Notice>}
            </>
          )}
        </section>
      </div>
      {settings && (
        <Modal
          title="收信配置"
          wide
          onClose={() => {
            setSettings(false);
            setNewConfig(null);
          }}
        >
          <p>
            每个工作区同时启用一个新回复域名；停用后仍接收旧追踪地址的邮件。两端同域名时由统一入口按实例标识分流。
          </p>
          {configs.map((c) => (
            <section className="panel" key={c.id}>
              <h3>{c.domain}</h3>
              <p>转发至 {c.forward_to}</p>
              <Button onClick={() => setForwardEdit({ id: c.id, email: c.forward_to })}>
                修改转发邮箱
              </Button>
              <p>
                {c.enabled
                  ? '已启用'
                  : c.verified_at
                    ? '已接收测试邮件，待启用'
                    : '未验证，请先配置接收入口'}{' '}
                · 最近收信：{c.last_received_at ? dateTime(c.last_received_at) : '尚无'}
              </p>
              <div className="inbox-config-options">
                {[
                  ['track_edm', 'EDM 自动追踪'],
                  ['track_sites', '站内信自动追踪'],
                  ['team_body', '允许数据主管查看正文与附件'],
                ].map(([k, label]) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={!!c[k]}
                      onChange={(e) =>
                        action(() =>
                          put('/api/inbox/configs/' + c.id, {
                            enabled: !!c.enabled,
                            trackEdm: k === 'track_edm' ? e.target.checked : !!c.track_edm,
                            trackSites: k === 'track_sites' ? e.target.checked : !!c.track_sites,
                            teamBody: k === 'team_body' ? e.target.checked : !!c.team_body,
                          }),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <Button
                disabled={busy || (!c.enabled && !c.verified_at)}
                onClick={() =>
                  action(() =>
                    put('/api/inbox/configs/' + c.id, {
                      enabled: !c.enabled,
                      trackEdm: !!c.track_edm,
                      trackSites: !!c.track_sites,
                      teamBody: !!c.team_body,
                    }),
                  )
                }
              >
                {c.enabled ? '停用新追踪' : '启用收信追踪'}
              </Button>
            </section>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                setNewConfig(
                  await post('/api/inbox/configs', {
                    domain,
                    forwardTo,
                    trackEdm: true,
                    trackSites: true,
                    teamBody: false,
                  }),
                );
                setDomain('');
                setForwardTo('');
              });
            }}
          >
            <h3>添加收信域名</h3>
            <Field label="收信域名">
              <input
                required
                placeholder="reply.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </Field>
            <Field label="转发目的邮箱">
              <input
                type="email"
                required
                placeholder="sales@gmail.com"
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              保存并生成接收配置
            </Button>
          </form>
          {newConfig && (
            <Notice>
              <strong>入口凭据仅显示一次，请交由部署管理员保存。</strong>
              <pre className="inbox-body">{JSON.stringify(newConfig, null, 2)}</pre>
              <p>
                通过统一 Email Worker 接收，独立地址前缀包含配置 ID 的前 12
                个十六进制字符。固定地址须明确指定归属实例。接收测试邮件后才能启用。
              </p>
            </Notice>
          )}
          <p className="muted">
            普通来信默认待确认；自动回执、退信不计入客户回复。此处只接收新来信，历史邮件需单独授权导入。
          </p>
          <Button
            onClick={() =>
              action(async () => setAudit((await api<any>('/api/inbox/audit')).events))
            }
          >
            查看操作记录
          </Button>
        </Modal>
      )}
      {forwardEdit && (
        <Modal title="修改转发邮箱" onClose={() => setForwardEdit(null)}>
          <p>保存后暂停新追踪。请同步修改接收 Worker 的转发目的地，并重新验证收信。</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                await put('/api/inbox/configs/' + forwardEdit.id + '/forward', {
                  forwardTo: forwardEdit.email,
                });
                setForwardEdit(null);
              });
            }}
          >
            <Field label="新的转发目的邮箱">
              <input
                required
                type="email"
                value={forwardEdit.email}
                onChange={(e) => setForwardEdit({ ...forwardEdit, email: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              保存
            </Button>
          </form>
        </Modal>
      )}
      {audit && (
        <Modal title="最近 100 条收件箱操作" wide onClose={() => setAudit(null)}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作人</th>
                  <th>操作</th>
                  <th>明细</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.created_at)}</td>
                    <td>{a.actor_id}</td>
                    <td>{a.action}</td>
                    <td>
                      <code>{a.detail}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {link && detail && (
        <Modal title="关联业务来源" onClose={() => setLink(false)}>
          <p>
            只允许关联同一工作区、同一收信配置的活动或目标。相同来源的会话会合并，操作保留审计。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(async () =>
                setRoutes(
                  (await api<any>('/api/inbox/routes?q=' + encodeURIComponent(routeQuery))).routes,
                ),
              );
            }}
          >
            <input
              aria-label="搜索关联目标"
              placeholder="邮箱、网址、主题或活动名称"
              value={routeQuery}
              onChange={(e) => setRouteQuery(e.target.value)}
            />
            <Button type="submit">搜索</Button>
          </form>
          {routes
            .filter((r) => r.config_id === detail.thread.config_id)
            .map((r) => (
              <Button
                key={r.id}
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const result: any = await put(
                      '/api/inbox/threads/' + encodeURIComponent(selected) + '/link',
                      { routeId: r.id },
                    );
                    setSelected(result.threadId || selected);
                    setLink(false);
                  })
                }
              >
                {r.business_name} · {r.website_url || r.original_email}
              </Button>
            ))}
          {detail.thread.route_id && (
            <Button
              onClick={() =>
                action(async () => {
                  const r: any = await put(
                    '/api/inbox/threads/' + encodeURIComponent(selected) + '/link',
                    { routeId: null },
                  );
                  setSelected(r.threadId);
                  setLink(false);
                })
              }
            >
              解除关联，移入待关联
            </Button>
          )}
        </Modal>
      )}
    </div>
  );
}
