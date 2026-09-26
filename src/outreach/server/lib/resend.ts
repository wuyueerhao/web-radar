import { publicFetch } from './network';
export const RESEND_EVENTS = [
  'email.sent',
  'email.delivered',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.complained',
  'email.failed',
];
export class ResendApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter = 60,
    public code = '',
  ) {
    super(message);
    this.name = 'ResendApiError';
  }
  get quotaExceeded() { return ['daily_quota_exceeded', 'monthly_quota_exceeded'].includes(this.code); }
}
export async function resendRequest(key: string, path: string, init: RequestInit = {}) {
  const response = await publicFetch('https://api.resend.com' + path, {
    ...init,
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401)
      throw new ResendApiError('Resend API Key 无效或已撤销', response.status);
    if (response.status === 403)
      throw new ResendApiError(
        path === '/emails'
          ? 'Resend 拒绝发信：请检查密钥权限及发信域名验证状态'
          : 'Resend 权限不足：帐号、域名及回调管理需要 Full access API Key',
        response.status,
      );
    if (response.status === 429)
      throw new ResendApiError('Resend 请求频率或额度受限，请稍后重试', response.status, Math.max(1, Number(response.headers.get('retry-after')) || 60), String(data?.name || ''));
    throw new Error(
      `Resend 请求失败（${response.status}）：${String(data?.message || '请检查参数及帐号状态').slice(0, 300)}`,
    );
  }
  if (!data) throw new Error('Resend 返回无效数据');
  return data;
}
export async function listResendResources(key: string, resource: 'domains' | 'webhooks') {
  const domains: any[] = [];
  let after = '';
  for (let i = 0; i < 100; i++) {
    const result = await resendRequest(
      key,
      `/${resource}?limit=100` + (after ? '&after=' + encodeURIComponent(after) : ''),
    );
    if (!Array.isArray(result.data)) throw new Error('Resend 列表格式无效');
    domains.push(...result.data);
    if (!result.has_more) return domains;
    const next = result.data.at(-1)?.id;
    if (!next || next === after) throw new Error('Resend 分页异常');
    after = next;
  }
  throw new Error('记录数量过多，未能完整读取，请联系管理员');
}
export const listResendDomains = (key: string) => listResendResources(key, 'domains');
export async function verifyResendSignature(
  body: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
) {
  const id = headers.get('svix-id'),
    time = headers.get('svix-timestamp'),
    signatures = headers.get('svix-signature');
  if (
    !id ||
    !time ||
    !signatures ||
    !/^\d+$/.test(time) ||
    Math.abs(now / 1000 - Number(time)) > 300 ||
    !secret.startsWith('whsec_')
  )
    return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const bytes = new TextEncoder().encode(`${id}.${time}.${body}`);
    for (const signature of signatures.split(' ')) {
      const [version, value] = signature.split(',');
      if (
        version === 'v1' &&
        value &&
        (await crypto.subtle.verify(
          'HMAC',
          key,
          Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
          bytes,
        ))
      )
        return true;
    }
  } catch {}
  return false;
}
// The D1 batch reads the old timestamps before updating them, atomically. This
// handles duplicate and out-of-order callbacks without counting an open twice.
export async function applyResendEvent(db: D1Database, providerId: string, event: any) {
  if (!RESEND_EVENTS.includes(event?.type) || typeof event?.data?.email_id !== 'string')
    return false;
  const emailId = event.data.email_id;
  const tag = Array.isArray(event.data.tags)
    ? event.data.tags.find((t: any) => t.name === 'wr_recipient_id')?.value
    : event.data.tags?.wr_recipient_id;
  const row = await db
    .prepare(
      `SELECT d.recipient_id, r.campaign_id, r.contact_id FROM edm_resend_deliveries d JOIN edm_campaign_recipients r ON r.id=d.recipient_id JOIN edm_campaigns c ON c.id=r.campaign_id JOIN edm_providers p ON p.id=d.provider_id AND p.user_id=c.user_id WHERE d.provider_id=? AND (d.email_id=? OR (d.email_id IS NULL AND d.recipient_id=?))`,
    )
    .bind(providerId, emailId, typeof tag === 'string' ? tag : '')
    .first<any>();
  if (!row) return false;
  if (typeof event.data.message_id === 'string') await db.prepare("UPDATE wr_inbox_routes SET rfc_message_id=? WHERE source='edm' AND target_id=?").bind(event.data.message_id.slice(0,1000),row.recipient_id).run();
  const kind = event.type.slice(6),
    now = Math.floor(Date.now() / 1000);
  const delivered = ['delivered', 'opened', 'clicked'].includes(kind),
    opened = ['opened', 'clicked'].includes(kind),
    clicked = kind === 'clicked';
  const increments = [
    ['totalSent', 'sent_at', true],
    ['totalDelivered', 'delivered_at', delivered],
    ['totalOpened', 'opened_at', opened],
    ['totalClicked', 'clicked_at', clicked],
  ] as const;
  const column: Record<string, string> = {
    totalSent: 'total_sent',
    totalDelivered: 'total_delivered',
    totalOpened: 'total_opened',
    totalClicked: 'total_clicked',
  };
  const updates = increments
    .filter((x) => x[2])
    .map(
      ([metric, field]) =>
        `${column[metric]}=${column[metric]}+(SELECT CASE WHEN ${field} IS NULL THEN 1 ELSE 0 END FROM edm_campaign_recipients WHERE id=?)`,
    );
  const values: any[] = increments.filter((x) => x[2]).map(() => row.recipient_id);
  if (kind === 'bounced' || kind === 'complained') {
    updates.push(
      `total_${kind}=total_${kind}+(SELECT CASE WHEN ${kind}_at IS NULL THEN 1 ELSE 0 END FROM edm_resend_deliveries WHERE recipient_id=?)`,
    );
    values.push(row.recipient_id);
  }
  const status = kind === 'sent' ? 'sent' : kind;
  const preserve = "('bounced','complained','unsubscribed','failed')";
  const recipientFields = increments
    .filter((x) => x[2])
    .map(([, field]) => `${field}=COALESCE(${field},${now})`)
    .join(',');
  const batch = [
    db
      .prepare(`UPDATE edm_campaigns SET ${updates.join(',')},updated_at=? WHERE id=?`)
      .bind(...values, now, row.campaign_id),
    db
      .prepare(
        `UPDATE edm_resend_deliveries SET email_id=COALESCE(email_id,?)${['bounced', 'complained', 'failed'].includes(kind) ? `,${kind}_at=COALESCE(${kind}_at,${now})` : ''} WHERE recipient_id=?`,
      )
      .bind(emailId, row.recipient_id),
    db
      .prepare(
        `UPDATE edm_campaign_recipients SET ${recipientFields},ses_message_id=COALESCE(ses_message_id,?),status=CASE WHEN status IN ${preserve} AND (status!='failed' OR EXISTS(SELECT 1 FROM edm_resend_deliveries WHERE recipient_id=? AND failed_at IS NOT NULL)) THEN status WHEN ? IN ('bounced','complained','failed') THEN ? WHEN clicked_at IS NOT NULL OR ?='clicked' THEN 'clicked' WHEN opened_at IS NOT NULL OR ?='opened' THEN 'opened' WHEN delivered_at IS NOT NULL OR ?='delivered' THEN 'delivered' ELSE 'sent' END,error_message=CASE WHEN status='failed' AND EXISTS(SELECT 1 FROM edm_resend_deliveries WHERE recipient_id=? AND failed_at IS NOT NULL) THEN 'Resend: email.failed' WHEN ?='failed' THEN 'Resend: email.failed' ELSE NULL END WHERE id=?`,
      )
      .bind(
        emailId,
        row.recipient_id,
        status,
        status,
        status,
        status,
        status,
        row.recipient_id,
        kind,
        row.recipient_id,
      ),
  ];
  if (['bounced', 'complained'].includes(kind))
    batch.push(
      db
        .prepare(
          "UPDATE edm_contacts SET subscription_status='unsubscribed',unsubscribed_at=COALESCE(unsubscribed_at,?),updated_at=? WHERE id=?",
        )
        .bind(now, now, row.contact_id),
    );
  await db.batch(batch);
  return true;
}
