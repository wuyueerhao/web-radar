import { useEffect, useState } from 'react';
import type { Project } from '../shared/model';
import type { DeploymentOptions } from '../shared/provider-settings';
import { api, put, errorMessage } from './api';
import { Button, Field, Notice, SectionTitle } from './components';
export function DeploymentSettings({
  project,
  disabled,
  onSaved,
}: {
  project: Project;
  disabled: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const [data, setData] = useState<DeploymentOptions | null>(null),
    [provider, setProvider] = useState('cloudflare'),
    [account, setAccount] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const endpoint = `/api/projects/${encodeURIComponent(project.id)}/deployment`;
  useEffect(() => {
    let active = true;
    api<DeploymentOptions>(endpoint)
      .then((d) => {
        if (!active) return;
        setData(d);
        setProvider(d.selection.provider);
        const a =
          d.accounts.find(
            (a) =>
              a.credentialId === d.selection.credentialId && a.accountId === d.selection.accountId,
          ) ?? d.accounts[0];
        setAccount(a ? `${a.credentialId}|${a.accountId}` : '');
        setConfirmed(false);
      })
      .catch((e) => {
        if (active) setMessage(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [endpoint, project.version]);
  if (data && !data.enabled) return null;
  const selected = data?.accounts.find((a) => `${a.credentialId}|${a.accountId}` === account);
  const migration =
    !!project.publishedReleaseId &&
    (provider !== data?.selection.provider ||
      (provider === 'cloudflare' && selected?.accountId !== data?.selection.accountId));
  return (
    <section className="panel">
      <SectionTitle
        title="网站发布位置"
        description="新网站默认发布到 Cloudflare。现有网站保持当前部署，保存设置后需点击发布才能生效。"
      />
      {message && <Notice>{message}</Notice>}
      {!data ? (
        <p className="muted">正在读取发布配置…</p>
      ) : (
        <>
          <p>
            当前线上位置：
            {data.currentProvider === 'cloudflare'
              ? 'Cloudflare'
              : data.currentProvider === 'server'
                ? '本服务器'
                : '尚未发布'}{' '}
            {data.currentUrl && (
              <a href={data.currentUrl} target="_blank" rel="noreferrer">
                打开网站 ↗
              </a>
            )}
          </p>
          <div className="form-grid">
            <Field label="下次发布到">
              <select
                value={provider}
                disabled={disabled || busy}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="cloudflare">Cloudflare Pages（推荐）</option>
                <option value="server">本服务器</option>
              </select>
            </Field>
            {provider === 'cloudflare' && (
              <Field label="Cloudflare 发布账号">
                <select
                  value={account}
                  disabled={disabled || busy}
                  onChange={(e) => {
                    setAccount(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="">请选择账号</option>
                  {data.accounts.map((a) => (
                    <option
                      key={`${a.credentialId}|${a.accountId}`}
                      value={`${a.credentialId}|${a.accountId}`}
                    >
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <p className="muted">
            {provider === 'cloudflare'
              ? '使用独立 Pages 项目发布。账号需有 Pages 编辑权限；新增账号可在上线管理或平台管理中配置。'
              : '页面和素材由本服务器托管，支持自动创建域名解析与 HTTPS 证书。'}
          </p>
          {data.warnings.map((w) => (
            <p className="muted" key={w}>
              {w}
            </p>
          ))}
          {data.pendingChange && (
            <Notice tone="warning">发布位置已修改，待下次发布生效；当前线上版本仍可访问。</Notice>
          )}
          {migration && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={disabled || busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              我确认更换发布位置，成功后使用新地址。已绑定域名需先解绑。
            </label>
          )}
          {disabled && <p className="muted">请等待草稿保存和当前任务完成后修改发布设置。</p>}
          <Button
            disabled={
              disabled ||
              busy ||
              (provider === 'cloudflare' && !selected) ||
              (migration && !confirmed)
            }
            onClick={async () => {
              setBusy(true);
              setMessage('');
              try {
                await put(endpoint, {
                  provider,
                  ...(provider === 'cloudflare'
                    ? { credentialId: selected!.credentialId, accountId: selected!.accountId }
                    : {}),
                  expectedVersion: project.version,
                  confirmMigration: confirmed,
                });
                await onSaved();
                setMessage('发布设置已保存。点击“发布网站”或“发布草稿更新”使其生效。');
              } catch (e) {
                setMessage(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? '正在保存…' : '保存发布设置'}
          </Button>
        </>
      )}
    </section>
  );
}
