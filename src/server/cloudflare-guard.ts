import type { AppEnv } from '../worker/env';
/** Server copies can only mutate their own namespace and tracked DNS records. */
export async function allowCloudflareMutation(
  env: AppEnv,
  url: URL,
  method: string,
  body?: unknown,
): Promise<boolean> {
  if (url.hostname !== 'api.cloudflare.com' || ['GET', 'HEAD'].includes(method)) return true;
  const path = url.pathname.replace(/^\/client\/v4/, '');
  if (/^\/accounts\/[^/]+\/pages\/projects\/wrs-[a-f0-9]{32}(?:\/|$)/.test(path)) return true;
  if (method === 'POST' && path === '/pages/assets/upload') return true;
  let data: any;
  try {
    data = typeof body === 'string' ? JSON.parse(body) : null;
  } catch {
    return false;
  }
  if (method === 'POST' && /^\/accounts\/[^/]+\/pages\/projects$/.test(path))
    return /^wrs-[a-f0-9]{32}$/.test(data?.name || '');
  if (method === 'POST' && /^\/zones\/[^/]+\/dns_records$/.test(path)) {
    const prefix = `web-radar-server:${env.SERVER_INSTANCE_ID}:`;
    if (!env.SERVER_INSTANCE_ID || !data?.comment?.startsWith(prefix)) return false;
    const id = data.comment.slice(prefix.length);
    const binding = await env.DB.prepare(
      'SELECT hostname FROM project_domains WHERE project_id=? AND hostname=?',
    )
      .bind(id, data.name)
      .first();
    return (
      !!binding &&
      ((data.type === 'A' && data.content === env.SERVER_PUBLIC_IP && data.proxied === false) ||
        (data.type === 'CNAME' && /^wrs-[a-f0-9]{32}\.pages\.dev$/.test(data.content)))
    );
  }
  const record = path.match(/^\/zones\/([^/]+)\/dns_records\/([^/]+)$/);
  if (method === 'DELETE' && record)
    return !!(await env.DB.prepare(
      'SELECT hostname FROM project_domains WHERE zone_id=? AND dns_record_id=? AND owns_dns=1',
    )
      .bind(record[1], record[2])
      .first());
  return false;
}
