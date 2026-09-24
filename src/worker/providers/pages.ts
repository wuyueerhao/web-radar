import { withPublicationMetadata, type PublicationMetadata } from '../site-metadata';
import type { Secrets } from '../env';
import type { HostingTarget } from '../../shared/model';
import { ProviderError, type PublishResult, type PreviousPublication } from '../provider-contract';
import { base64FromBytes, endpoint, jsonRequest, nonempty, requestJson } from './http';
export function createPagesGateway(
  origin: string,
  projectId: string,
  releaseId: string,
  previousReleaseId?: string,
  publicFiles?: { current: string[]; previous: string[] },
): string {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/')
    throw new ProviderError('pages_unconfigured', '发布网关必须是无凭据的 HTTPS origin');
  const gateUrl = `${base.origin}/public/sites/${encodeURIComponent(projectId)}/gate/${encodeURIComponent(releaseId)}`;
  const previousGateUrl = previousReleaseId
    ? `${base.origin}/public/sites/${encodeURIComponent(projectId)}/gate/${encodeURIComponent(previousReleaseId)}`
    : '';
  const inquiryPath = `/api/public/sites/${encodeURIComponent(projectId)}/inquiries`;
  return `export default {
    async fetch(request, env) {
      const respond = (body, status) => new Response(body, {
        status,
        headers: {'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store'}
      });
      const incoming = new URL(request.url);
      const isInquiry = request.method === 'POST' && incoming.pathname === ${JSON.stringify(inquiryPath)};
      if (!isInquiry && request.method !== 'GET' && request.method !== 'HEAD')
        return respond('Method not allowed', 405);
      try {
        let gate = await fetch(${JSON.stringify(gateUrl)}, {
          method: 'GET', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000)
        });
        let usePrevious = false;
        if (gate.status === 404 && ${JSON.stringify(previousGateUrl)}) {
          gate = await fetch(${JSON.stringify(previousGateUrl)}, {
            method: 'GET', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000)
          });
          usePrevious = gate.status === 204;
        }
        if (gate.status !== 204)
          return respond('Website temporarily unavailable', gate.status === 404 ? 404 : 503);
        if (!isInquiry && (incoming.pathname === '/' || incoming.pathname === '/index.html'))
          return new Response(null, {status: 302, headers: {Location: '/en/index.html', 'Cache-Control': 'no-store'}});
        const publicFiles = ${JSON.stringify(publicFiles ?? null)};
        const publicPath = incoming.pathname.slice(1);
        const artifactPath = publicPath.endsWith('/') ? publicPath + 'index.html' : publicPath;
        if (!isInquiry && publicFiles && !(usePrevious ? publicFiles.previous : publicFiles.current).includes(artifactPath))
          return respond('Page not found', 404);
        const previousPath = incoming.pathname.endsWith('/index.html')
          ? incoming.pathname.slice(0, -'index.html'.length)
          : incoming.pathname;
        const assetRequest = usePrevious
          ? new Request(new URL('/__wr_previous' + previousPath, incoming.origin), request)
          : request;
        const headers = new Headers();
        let body;
        let target;
        if (isInquiry) {
          const maxBytes = 1024 * 1024;
          if (Number(request.headers.get('content-length') || 0) > maxBytes)
            return respond('Request body too large', 413);
          const reader = request.body?.getReader();
          if (reader) {
            let timeout;
            const deadline = new Promise((_, reject) => {
              timeout = setTimeout(() => reject(respond('Request body timed out', 408)), 15000);
            });
            const chunks = [];
            let size = 0;
            try {
              while (true) {
                const {done, value} = await Promise.race([reader.read(), deadline]);
                if (done) break;
                size += value.byteLength;
                if (size > maxBytes) throw respond('Request body too large', 413);
                chunks.push(value);
              }
            } catch (error) {
              reader.cancel().catch(() => {});
              throw error;
            } finally {
              clearTimeout(timeout);
            }
            body = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {body.set(chunk, offset); offset += chunk.byteLength;}
          }
          const contentType = request.headers.get('content-type');
          if (contentType) headers.set('content-type', contentType);
          target = new URL(${JSON.stringify(inquiryPath)}, ${JSON.stringify(base.origin)});
        }
        const response = isInquiry
          ? await fetch(target.href, {
            method: request.method, headers, body, redirect: 'manual', cache: 'no-store',
            signal: AbortSignal.timeout(15000)
          })
          : await env.ASSETS.fetch(assetRequest);
        if (isInquiry && response.status >= 300 && response.status < 400) {
          await response.body?.cancel();
          return respond('Website temporarily unavailable', 503);
        }
        const out = new Response(response.body, response);
        out.headers.set('Cache-Control', !isInquiry && (response.ok || response.status === 304) ? 'private, no-cache' : 'no-store');
        out.headers.delete('Set-Cookie');
        return out;
      } catch (error) {
        return error instanceof Response ? error : respond('Website temporarily unavailable', 503);
      }
    }
  };`;
}
const digest = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, '0'),
  )
    .join('')
    .slice(0, 32);
export const pagesProjectName = async (projectId: string): Promise<string> =>
  `wr-${await digest(projectId)}`;

export function hostingAccounts(env: Secrets): { accountId: string; apiToken: string }[] {
  let value: unknown;
  if (env.CLOUDFLARE_HOSTING_ACCOUNTS?.trim()) {
    try {
      value = JSON.parse(env.CLOUDFLARE_HOSTING_ACCOUNTS);
    } catch {
      throw new ProviderError('pages_hosting_config_invalid', 'Cloudflare 多账户配置不是有效 JSON');
    }
  } else {
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN)
      throw new ProviderError('pages_unconfigured', 'Cloudflare 托管账户与专用 token 尚未配置');
    value = [{ accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_API_TOKEN }];
  }
  if (!Array.isArray(value) || value.length === 0)
    throw new ProviderError('pages_hosting_config_invalid', 'Cloudflare 多账户配置必须是非空数组');
  const ids = new Set<string>();
  const accounts: { accountId: string; apiToken: string }[] = [];
  for (const entry of value) {
    if (
      !entry ||
      typeof entry.accountId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(entry.accountId) ||
      !nonempty(entry.apiToken, 4096) ||
      /[\r\n]/.test(entry.apiToken) ||
      ids.has(entry.accountId)
    )
      throw new ProviderError(
        'pages_hosting_config_invalid',
        'Cloudflare 账户标识或 token 无效，账户不能重复',
      );
    ids.add(entry.accountId);
    accounts.push({ accountId: entry.accountId, apiToken: entry.apiToken });
  }
  return accounts.sort((a, b) =>
    a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0,
  );
}

export function pagesConfigured(env: Secrets): boolean {
  try {
    return hostingAccounts(env).length > 0 && Boolean(env.APP_ORIGIN);
  } catch {
    return false;
  }
}

export async function resolveHostingTarget(
  env: Secrets,
  projectId: string,
  current?: HostingTarget,
): Promise<HostingTarget> {
  const accounts = hostingAccounts(env);
  if (current) {
    if (!accounts.some((account) => account.accountId === current.accountId))
      throw new ProviderError(
        'pages_hosting_account_missing',
        '站点绑定的 Cloudflare 账户未配置；请恢复该账户配置，不能自动迁移到其他账户',
      );
    if (
      typeof current.pagesProjectName !== 'string' ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(current.pagesProjectName)
    )
      throw new ProviderError('pages_hosting_target_invalid', '已保存的 Pages 项目名称无效');
    return { accountId: current.accountId, pagesProjectName: current.pagesProjectName };
  }
  const hash = await digest(projectId);
  const index = Number(BigInt(`0x${hash}`) % BigInt(accounts.length));
  return { accountId: accounts[index].accountId, pagesProjectName: `wr-${hash}` };
}

export async function publishPages(
  env: Secrets,
  projectId: string,
  releaseId: string,
  files: Record<string, string>,
  _previousDeploymentId?: string,
  hostingTarget?: HostingTarget,
  previous?: PreviousPublication,
  metadata?: PublicationMetadata,
): Promise<PublishResult> {
  if (!hostingTarget)
    throw new ProviderError(
      'pages_hosting_target_required',
      '发布前必须先保存站点的托管账户与 Pages 项目绑定',
    );
  const target = await resolveHostingTarget(env, projectId, hostingTarget);
  const accountToken = hostingAccounts(env).find(
    (account) => account.accountId === target.accountId,
  )!.apiToken;
  if (!env.APP_ORIGIN) throw new ProviderError('pages_unconfigured', 'APP_ORIGIN 发布网关尚未配置');
  const origin = new URL(endpoint(env.PUBLIC_SITE_ORIGIN||env.APP_ORIGIN, '')).origin;
  const sourceEntries = [...Object.entries(files), ...Object.entries(previous?.files ?? {})];
  if (!Object.keys(files).length || sourceEntries.length > 100 || sourceEntries.some(([path,content]) => !path.endsWith('.html') || path.startsWith('/') || path.includes('..') || path.includes('\\') || path.includes('\0') || typeof content !== 'string')) throw new ProviderError('pages_artifacts_invalid', '网站产物路径或内容无效');
  const siteOrigin = `https://${target.pagesProjectName}.pages.dev`;
  files = withPublicationMetadata(files, metadata?.origin ?? siteOrigin, metadata);
  if (previous) previous = { ...previous, files: withPublicationMetadata(previous.files, previous.metadata?.origin ?? siteOrigin, previous.metadata) };
  const gateway = createPagesGateway(origin, projectId, releaseId, previous?.releaseId, {
    current: Object.keys(files),
    previous: Object.keys(previous?.files ?? {}),
  });
  const entries = [
    ...Object.entries(files),
    ...Object.entries(previous?.files ?? {}).map(
      ([path, content]) => [`__wr_previous/${path}`, content] as [string, string],
    ),
  ];
  if (
    !entries.length ||
    entries.length > 104 ||
    entries.some(
      ([path, content]) =>
        (!path.endsWith('.html') && !['sitemap.xml','robots.txt','__wr_previous/sitemap.xml','__wr_previous/robots.txt'].includes(path)) ||
        path.startsWith('/') ||
        path.includes('..') ||
        path.includes('\\') ||
        path.includes('\0') ||
        typeof content !== 'string' ||
        new TextEncoder().encode(content).length > 1_000_000,
    )
  )
    throw new ProviderError('pages_artifacts_invalid', '仅可发布受信模板生成的有限 HTML 产物');
  const account = encodeURIComponent(target.accountId);
  const name = target.pagesProjectName;
  const api = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects`;
  const root = `${api}/${name}`;
  const auth = { Authorization: `Bearer ${accountToken}` };
  const cf = async (url: string, init: RequestInit = {}, mutation = false) => {
    const result = await requestJson(
      url,
      { ...init, headers: { ...auth, ...init.headers } },
      { provider: 'pages', mutation },
    );
    if (result?.success !== true)
      throw new ProviderError('pages_api_failed', 'Cloudflare Pages 请求未成功', mutation);
    return result.result;
  };
  let project: any;
  try {
    project = await cf(root);
  } catch (error) {
    if (!(error instanceof ProviderError) || error.code !== 'pages_http_404') throw error;
    project = await cf(
      api,
      jsonRequest(accountToken, {
        name,
        production_branch: 'main',
        deployment_configs: {
          production: {
            fail_open: false,
            env_vars: { WR_PROJECT_ID: { type: 'plain_text', value: projectId } },
          },
          preview: {
            fail_open: false,
            env_vars: { WR_PROJECT_ID: { type: 'plain_text', value: projectId } },
          },
        },
      }),
      true,
    );
  }
  if (
    project?.name !== name ||
    project.deployment_configs?.production?.env_vars?.WR_PROJECT_ID?.value !== projectId ||
    project.deployment_configs?.preview?.env_vars?.WR_PROJECT_ID?.value !== projectId ||
    project.deployment_configs?.production?.fail_open !== false ||
    project.deployment_configs?.preview?.fail_open !== false
  )
    throw new ProviderError(
      'pages_gate_not_configured',
      'Pages 项目归属或生产/预览 fail-closed 配置不匹配，请先核验',
    );
  const stableUrl = `https://${name}.pages.dev`;
  const marker = `Web Radar release ${releaseId}`;
  let deployment: any;
  // Pages rejects per_page=100. Keep the existing 100-deployment lookup window in valid pages.
  for (let page = 1; page <= 4; page++) {
    const deployments = await cf(`${root}/deployments?per_page=25&page=${page}`);
    if (!Array.isArray(deployments))
      throw new ProviderError('pages_invalid_response', 'Cloudflare 部署列表格式无效');
    deployment = deployments.find(
      (d: any) => d.deployment_trigger?.metadata?.commit_message === marker,
    );
    if (deployment || deployments.length < 25) break;
  }
  if (
    deployment?.latest_stage?.status === 'failure' ||
    deployment?.latest_stage?.status === 'canceled'
  )
    throw new ProviderError('pages_deployment_failed', 'Cloudflare 发布失败，上一成功版本仍保留');
  if (!deployment) {
    const token = await cf(`${root}/upload-token`);
    if (!nonempty(token?.jwt, 10_000))
      throw new ProviderError('pages_invalid_response', 'Cloudflare 未返回素材上传凭据');
    const manifest: Record<string, string> = {};
    const values = [];
    for (const [path, content] of entries) {
      const contentType = path.endsWith('.xml') ? 'application/xml;charset=utf-8' : path.endsWith('.txt') ? 'text/plain;charset=utf-8' : 'text/html;charset=utf-8';
      const key = await digest(`${contentType}:${content}`);
      manifest[`/${path}`] = key;
      values.push({
        key,
        value: base64FromBytes(new TextEncoder().encode(content)),
        base64: true,
        metadata: { contentType },
      });
    }
    // Bounded batches avoid buffering all generated sites in a single upload request.
    for (let i = 0; i < values.length; i += 10)
      await cf(
        'https://api.cloudflare.com/client/v4/pages/assets/upload',
        jsonRequest(token.jwt, values.slice(i, i + 10)),
        true,
      );
    const form = new FormData();
    form.append('manifest', JSON.stringify(manifest));
    form.append('branch', 'main');
    form.append('commit_message', marker);
    form.append(
      '_worker.js',
      new Blob([gateway], { type: 'application/javascript' }),
      '_worker.js',
    );
    form.append(
      '_routes.json',
      new Blob([JSON.stringify({ version: 1, include: ['/*'], exclude: [] })], {
        type: 'application/json',
      }),
      '_routes.json',
    );
    form.append(
      '_headers',
      new Blob(['/*\n  Cache-Control: no-store\n'], { type: 'text/plain' }),
      '_headers',
    );
    deployment = await cf(`${root}/deployments`, { method: 'POST', body: form }, true);
  }
  if (!nonempty(deployment?.id, 200))
    throw new ProviderError(
      'pages_acceptance_unknown',
      'Cloudflare 未返回部署编号，请先核对当前发布',
      true,
    );
  if (deployment.latest_stage?.name !== 'deploy' || deployment.latest_stage?.status !== 'success')
    throw new ProviderError(
      'pages_deployment_pending',
      'Cloudflare 发布仍在处理中；同一发布重试会查询已受理部署',
      true,
    );
  if (deployment.uses_functions !== true)
    throw new ProviderError('pages_gate_not_active', 'Cloudflare 未确认启用网关，保持上一成功版本');
  return { deploymentId: deployment.id, url: stableUrl, testMode: false };
}
