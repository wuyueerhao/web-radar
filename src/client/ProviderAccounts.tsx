import { useEffect, useState } from 'react';
import type { ProviderAccount, CloudflareZone, SiteConnections } from '../shared/provider-settings';
import { api, post, put, errorMessage } from './api';
import { Button, Field, Notice, SectionTitle } from './components';

function AccountForm({
  cloudflareOnly = false,
  save,
}: {
  cloudflareOnly?: boolean;
  save: (value: Record<string, unknown>) => Promise<void>;
}) {
  const [kind, setKind] = useState('cloudflare'),
    [label, setLabel] = useState(''),
    [key, setKey] = useState(''),
    [mailFrom, setMailFrom] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="provider-account-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          await save({ kind, label, apiKey: key, mailFrom });
          setKey('');
          setLabel('');
          setMailFrom('');
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {!cloudflareOnly && (
        <Field label="服务">
          <select
            aria-label="服务"
            value={kind}
            disabled={busy}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="cloudflare">Cloudflare</option>
            <option value="resend">Resend</option>
          </select>
        </Field>
      )}
      <Field label="账号名称">
        <input
          required
          maxLength={100}
          value={label}
          disabled={busy}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="例如：品牌官网账号"
        />
      </Field>
      <Field label={kind === 'cloudflare' ? 'Cloudflare API Token' : 'Resend API Key'}>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={key}
          disabled={busy}
          onChange={(e) => setKey(e.target.value)}
          placeholder="保存后不会再次显示密钥"
        />
      </Field>
      {kind === 'resend' && (
        <Field label="已验证的发信地址">
          <input
            required
            value={mailFrom}
            disabled={busy}
            onChange={(e) => setMailFrom(e.target.value)}
            placeholder="Website <hello@example.com>"
          />
        </Field>
      )}
      <p className="muted">
        {kind === 'cloudflare'
          ? 'Token 需具有所选域名的 Zone Read、DNS Edit 权限。域名列表会按 Token 实际授权读取；Pages 绑定使用网站原发布账号。'
          : '支持仅发信权限的 Key。请使用 Resend 已验证的发信域名；保存不会发送测试邮件。'}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" kind="primary" disabled={busy}>
        {busy ? '正在保存…' : '保存账号'}
      </Button>
    </form>
  );
}

export function ProviderAccounts() {
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [envEmail, setEnvEmail] = useState(false);
  const root = '/api/admin/provider-accounts';
  async function load() {
    const d = await api<{ accounts: ProviderAccount[]; environmentEmail: boolean }>(root);
    setAccounts(d.accounts);
    setEnvEmail(d.environmentEmail);
  }
  useEffect(() => {
    void load().catch((e) => setError(errorMessage(e)));
  }, []);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      setNotice(message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <SectionTitle
        title="Cloudflare 与 Resend 账号"
        description="共享账号可在网站编辑时选择。API 密钥加密保存，网站资料和列表不会返回密钥。"
      />
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      <div className="provider-accounts-list">
        {accounts.map((a) => (
          <article className="provider-account-row" key={a.id}>
            <div>
              <strong>{a.label}</strong>
              <p className="muted">
                {a.kind === 'cloudflare' ? 'Cloudflare' : `Resend · ${a.mailFrom}`}
                {a.isDefault ? ' · 默认发信账号' : ''}
              </p>
            </div>
            <div className="button-row">
              {a.kind === 'resend' && !a.isDefault && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () => put(root + '/default', { id: a.id }),
                      '默认发信账号已更新；已排队邮件仍使用原账号。',
                    )
                  }
                >
                  设为默认
                </Button>
              )}
              <Button
                kind="danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`删除账号「${a.label}」？正在使用的账号无法删除。`))
                    void action(() => api(root + '/' + a.id, { method: 'DELETE' }), '账号已删除。');
                }}
              >
                删除
              </Button>
            </div>
          </article>
        ))}
      </div>
      <p className="muted">
        {envEmail
          ? '保留原环境 Resend 配置作为未设置默认账号时的发信来源。'
          : '未选择默认账号的网站需要单独指定 Resend 账号才能发送邮件。'}
      </p>
      {accounts.some((a) => a.isDefault) && (
        <Button
          disabled={busy}
          onClick={() =>
            void action(
              () => put(root + '/default', { id: null }),
              '已取消默认账号，改用原环境配置。',
            )
          }
        >
          取消默认账号
        </Button>
      )}
      <details>
        <summary>添加 Cloudflare / Resend 账号</summary>
        <AccountForm
          save={async (value) => {
            await post(root, value);
            await load();
            setNotice('账号已保存。');
          }}
        />
      </details>
    </section>
  );
}

export function WebsiteConnections({
  projectId,
  published,
}: {
  projectId: string;
  published: boolean;
}) {
  const root = `/api/projects/${encodeURIComponent(projectId)}/connections`;
  const [data, setData] = useState<SiteConnections | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [account, setAccount] = useState(''),
    [zones, setZones] = useState<CloudflareZone[]>([]),
    [zoneId, setZoneId] = useState(''),
    [prefix, setPrefix] = useState('www'),
    [loadingZones, setLoadingZones] = useState(false);
  async function load() {
    setData(await api<SiteConnections>(root));
  }
  useEffect(() => {
    let alive = true;
    api<SiteConnections>(root)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [root, published]);
  useEffect(() => {
    if (data && (!account || !data.accounts.some((a) => a.id === account)))
      setAccount(data.defaultCloudflareAccountId ?? '');
  }, [data, account]);
  useEffect(() => {
    setZones([]);
    setZoneId('');
    setLoadingZones(false);
    if (!account) return;
    const controller = new AbortController();
    setLoadingZones(true);
    api<{ zones: CloudflareZone[] }>(root + '/zones/' + encodeURIComponent(account), {
      signal: controller.signal,
    })
      .then((d) => {
        setZones(d.zones);
        if (d.zones[0]) setZoneId(d.zones[0].id);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingZones(false);
      });
    return () => controller.abort();
  }, [root, account]);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      setNotice(message);
    } catch (e) {
      setError(errorMessage(e));
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const zone = zones.find((z) => z.id === zoneId),
    hostname = zone
      ? !prefix || prefix === '@'
        ? zone.name
        : `${prefix.trim()}.${zone.name}`
      : '';
  return (
    <section className="panel">
      <SectionTitle
        title="域名绑定与询盘邮件"
        description="设置即时保存，不影响编辑中的页面草稿。"
      />
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {!data ? (
        <Button onClick={() => void action(load, '设置已刷新。')}>重新加载设置</Button>
      ) : (
        <>
          <Field label="询盘发信账号">
            <select
              aria-label="询盘发信账号"
              value={data.resendAccountId ?? ''}
              disabled={busy}
              onChange={(e) =>
                void action(
                  () => put(root + '/email', { accountId: e.target.value || null }),
                  '网站发信账号已保存，仅影响新询盘。',
                )
              }
            >
              <option value="">
                跟随默认账号
                {data.accounts.find((a) => a.isDefault)
                  ? `（${data.accounts.find((a) => a.isDefault)!.label}）`
                  : data.environmentEmail
                    ? '（原环境配置）'
                    : '（未配置）'}
              </option>
              {data.accounts
                .filter((a) => a.kind === 'resend')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} · {a.mailFrom}
                  </option>
                ))}
            </select>
          </Field>
          <h3>自定义域名</h3>
          {!published && (
            <p className="muted">请先发布网站，再提交域名绑定。现在可以添加账号并查看域名。</p>
          )}
          {data.domains.map((d) => (
            <article key={d.hostname} className="provider-account-row">
              <div>
                <strong>{d.hostname}</strong>
                <p className="muted">
                  {d.status === 'active'
                    ? '已生效'
                    : d.status === 'pending'
                      ? '等待 DNS / HTTPS 证书生效'
                      : d.status === 'pending_tls' ? '正在配置 HTTPS（通常需要几分钟）' : d.status === 'tls_failed' ? 'HTTPS 配置失败，请检查 DNS 后刷新重试' : d.status}
                </p>
                {d.status === 'active' && (
                  <a href={`https://${d.hostname}`} target="_blank" rel="noreferrer">
                    打开网站 ↗
                  </a>
                )}
              </div>
              <div className="button-row">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () =>
                        post(root + '/domains/' + encodeURIComponent(d.hostname) + '/refresh', {}),
                      '域名状态已更新。',
                    )
                  }
                >
                  刷新状态
                </Button>
                {d.status !== 'active' && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setAccount(d.credentialId);
                      setPrefix(
                        d.hostname === d.zoneName
                          ? '@'
                          : d.hostname.slice(0, -d.zoneName.length - 1),
                      );
                      setNotice('请选择对应域名，再点击绑定以继续未完成的操作。');
                    }}
                  >
                    继续配置
                  </Button>
                )}
                <Button
                  kind="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`解除 ${d.hostname} 的绑定？此域名将不再访问该网站。`))
                      void action(
                        () =>
                          api(root + '/domains/' + encodeURIComponent(d.hostname), {
                            method: 'DELETE',
                          }),
                        '域名已解绑；仅清理本应用创建且未被修改的 DNS 记录。',
                      );
                  }}
                >
                  解绑
                </Button>
              </div>
            </article>
          ))}
          <div className="connections-grid">
            <Field label="Cloudflare 账号">
              <select
                aria-label="Cloudflare 账号"
                value={account}
                disabled={busy}
                onChange={(e) => {
                  setError('');
                  setAccount(e.target.value);
                }}
              >
                <option value="">选择已保存账号</option>
                {data.accounts
                  .filter((a) => a.kind === 'cloudflare')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                      {a.scope === 'global'
                        ? '（后台共享）'
                        : a.scope === 'environment'
                          ? ''
                          : '（本网站）'}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="域名">
              <select
                aria-label="域名"
                value={zoneId}
                disabled={busy || loadingZones || !zones.length}
                onChange={(e) => setZoneId(e.target.value)}
              >
                <option value="">{loadingZones ? '正在获取域名…' : '请选择域名'}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} · {z.accountName}
                    {z.status === 'active' ? '' : '（未激活）'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="主机名">
              <input
                value={prefix}
                disabled={busy}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="www，根域名填写 @"
              />
            </Field>
          </div>
          {account && !loadingZones && !zones.length && (
            <p className="muted">未读取到域名，请检查 Token 的 Zone Read 权限及授权范围。</p>
          )}
          <p className="muted">
            {hostname && (
              <>
                将绑定：<strong>{hostname}</strong>。{' '}
              </>
            )}
            {data.hostingProvider==='server' ? `域名将解析到服务器 ${data.serverAddress||''}，自动申请 HTTPS。请保持 DNS 仅解析模式并等待证书生效。` : '跨 Cloudflare 账号使用 www 等子域名；根域名需要与网站发布账号一致。'}已有解析冲突时不会覆盖原记录。
          </p>
          <Button
            kind="primary"
            disabled={busy || loadingZones || !zone || !published}
            onClick={() =>
              void action(
                () => post(root + '/domains', { credentialId: account, zoneId, hostname }),
                '绑定已提交，请刷新状态查看 DNS 与 HTTPS 证书是否生效。',
              )
            }
          >
            {busy ? '正在处理…' : '绑定域名'}
          </Button>
          <details>
            <summary>使用新的 Cloudflare API Token</summary>
            <AccountForm
              cloudflareOnly
              save={async (value) => {
                const result = await post<{ account: ProviderAccount }>(root + '/accounts', value);
                await load();
                setAccount(result.account.id);
                setNotice('账号已保存到本网站，可以选择域名绑定。');
              }}
            />
          </details>
          {data.accounts
            .filter((a) => a.kind === 'cloudflare' && a.scope === projectId)
            .map((a) => (
              <p key={a.id} className="muted">
                本网站账号：{a.label}{' '}
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`删除本网站账号「${a.label}」？`))
                      void action(async () => {
                        await api(root + '/accounts/' + a.id, { method: 'DELETE' });
                        if (account === a.id) setAccount('');
                      }, '账号已删除。');
                  }}
                >
                  删除
                </Button>
              </p>
            ))}
        </>
      )}
    </section>
  );
}
