import PostalMime from 'postal-mime';
import { parse } from 'parse5';
export type InboxStore = { DB: D1Database; MEDIA: R2Bucket };
export type InboxConfig = {
  id: string;
  workspace_id: string;
  domain: string;
  forward_to: string;
  secret: string;
  enabled: number;
  track_edm: number;
  track_sites: number;
  team_body: number;
  verified_at: string | null;
};
const enc = new TextEncoder();
export const now = () => new Date().toISOString();
export async function digest(value: string | ArrayBuffer) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', typeof value === 'string' ? enc.encode(value) : value),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function sign(secret: string, value: string) {
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(value))), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
export function plain(html: string) {
  const stack: any[] = [parse(html)],
    parts: string[] = [];
  let size = 0;
  while (stack.length && size < 500000) {
    const n = stack.pop();
    if (['script', 'style', 'head'].includes(n.tagName)) continue;
    if (n.nodeName === '#text') {
      parts.push(n.value);
      size += n.value.length;
    } else {
      if (['p', 'div', 'br', 'tr', 'li'].includes(n.tagName)) parts.push('\n');
      stack.push(...[...(n.childNodes || [])].reverse());
    }
  }
  return parts.join('').slice(0, 500000);
}

export function classify(
  headers: Map<string, string>,
  sender: string,
): 'automatic' | 'bounce' | 'unknown' {
  if (
    /multipart\/report.*delivery-status|message\/delivery-status/i.test(
      headers.get('content-type') || '',
    ) ||
    /^(mailer-daemon|postmaster)@/i.test(sender)
  )
    return 'bounce';
  if (
    (headers.has('auto-submitted') &&
      headers.get('auto-submitted')?.trim().toLowerCase() !== 'no') ||
    headers.has('x-autoreply') ||
    headers.has('x-autorespond')
  )
    return 'automatic';
  return 'unknown'; // Human intent is confirmed by an operator, never inferred from a subject alone.
}
export async function trackedAddress(
  db: D1Database,
  source: 'edm' | 'site',
  targetId: string,
  snapshot: string,
  subject: string,
) {
  const existing = await db
    .prepare('SELECT address FROM wr_inbox_routes WHERE source=? AND target_id=?')
    .bind(source, targetId)
    .first<{ address: string }>();
  if (existing) return existing.address;
  if (
    !(await db
      .prepare('SELECT 1 FROM wr_inbox_configs WHERE enabled=1 AND verified_at IS NOT NULL LIMIT 1')
      .first())
  )
    return null;
  const target =
    source === 'edm'
      ? await db
          .prepare(
            `SELECT c.reply_tracking,c.id business_id,c.user_id workspace_id,c.created_by owner_id,t.email original_email,NULL website_url FROM edm_campaign_recipients r JOIN edm_campaigns c ON c.id=r.campaign_id JOIN edm_contacts t ON t.id=r.contact_id AND t.user_id=c.user_id WHERE r.id=?`,
          )
          .bind(targetId)
          .first<any>()
      : await db
          .prepare(
            `SELECT j.reply_tracking,j.id business_id,j.user_id workspace_id,j.created_by owner_id,j.sender_email original_email,t.website_url FROM edm_site_message_targets t JOIN edm_site_message_jobs j ON j.id=t.job_id WHERE t.id=?`,
          )
          .bind(targetId)
          .first<any>();
  if (!target || !target.reply_tracking) return null;
  const config = await db
    .prepare(
      `SELECT * FROM wr_inbox_configs WHERE workspace_id=? AND enabled=1 AND verified_at IS NOT NULL AND ${source === 'edm' ? 'track_edm' : 'track_sites'}=1`,
    )
    .bind(target.workspace_id)
    .first<InboxConfig>();
  if (!config) return null;
  const id = crypto.randomUUID(),
    address = `${source === 'edm' ? 'e' : 's'}-${config.id.replaceAll('-', '').slice(0, 12)}-${crypto.randomUUID().replaceAll('-', '')}@${config.domain}`;
  await db
    .prepare(
      `INSERT OR IGNORE INTO wr_inbox_routes(id,config_id,workspace_id,owner_id,source,business_id,target_id,address,original_email,website_url,subject,snapshot,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      config.id,
      target.workspace_id,
      target.owner_id,
      source,
      target.business_id,
      targetId,
      address,
      target.original_email,
      target.website_url,
      subject.slice(0, 1000),
      snapshot.slice(0, 500000),
      now(),
    )
    .run();
  return (await db
    .prepare('SELECT address FROM wr_inbox_routes WHERE source=? AND target_id=?')
    .bind(source, targetId)
    .first<{ address: string }>())!.address;
}
export async function refreshReplyStats(db: D1Database, workspace: string) {
  // Aggregate independent reply facts without overwriting delivery/open/click status.
  await db.batch([
    db
      .prepare(
        `UPDATE edm_campaign_recipients SET replied_at=(SELECT MIN(CAST(strftime('%s',m.received_at) AS INTEGER)) FROM wr_inbox_routes r JOIN wr_inbox_threads t ON t.route_id=r.id JOIN wr_inbox_messages m ON m.thread_id=t.id WHERE r.source='edm' AND r.target_id=edm_campaign_recipients.id AND m.kind='human') WHERE EXISTS(SELECT 1 FROM wr_inbox_routes ir WHERE ir.target_id=edm_campaign_recipients.id AND ir.source='edm') AND campaign_id IN (SELECT id FROM edm_campaigns WHERE user_id=?)`,
      )
      .bind(workspace),
    db
      .prepare(
        `UPDATE edm_campaigns SET total_replied=(SELECT COUNT(*) FROM edm_campaign_recipients r WHERE r.campaign_id=edm_campaigns.id AND r.replied_at IS NOT NULL) WHERE user_id=?`,
      )
      .bind(workspace),
  ]);
}
export async function ingest(
  env: InboxStore,
  config: InboxConfig,
  raw: ArrayBuffer,
  recipient: string,
  envelopeFrom: string,
  forwardStatus: string,
  verifiedForward = true,
) {
  if (raw.byteLength > 15 * 1024 * 1024) throw new Error('Mail exceeds 15 MB');
  const mail = await PostalMime.parse(raw, { maxNestingDepth: 30, maxHeadersSize: 256 * 1024 });
  const header = new Map(mail.headers.map((h) => [h.key.toLowerCase(), h.value]));
  const hash = await digest(raw),
    messageId = (mail.messageId || '').slice(0, 1000);
  // Include the envelope recipient: shared Message-IDs can legitimately reach different business aliases.
  const dedupe = await digest(recipient + '\n' + (messageId || hash));
  const duplicate = await env.DB.prepare(
    'SELECT id FROM wr_inbox_messages WHERE config_id=? AND dedupe_key=?',
  )
    .bind(config.id, dedupe)
    .first();
  if (duplicate) return { duplicate: true };
  let route = await env.DB.prepare('SELECT * FROM wr_inbox_routes WHERE config_id=? AND address=?')
    .bind(config.id, recipient)
    .first<any>();
  let method = route ? 'address' : 'unmatched';
  const references = [mail.inReplyTo, ...(mail.references || '').split(/\s+/)]
    .filter(Boolean)
    .slice(0, 100);
  if (!route && references.length) {
    // Only accept a unique match inside this receiving configuration.
    const marks = references.map(() => '?').join(',');
    const matches = await env.DB.prepare(
      `SELECT DISTINCT r.* FROM wr_inbox_routes r WHERE r.config_id=? AND (r.rfc_message_id IN (${marks}) OR r.id IN (SELECT t.route_id FROM wr_inbox_messages m JOIN wr_inbox_threads t ON t.id=m.thread_id WHERE m.config_id=? AND m.message_id IN (${marks}))) LIMIT 2`,
    )
      .bind(config.id, ...references, config.id, ...references)
      .all<any>();
    if (matches.results.length === 1) {
      route = matches.results[0];
      method = 'headers';
    }
  }
  const received = now(),
    threadId = route ? 'route-' + route.id : 'mail-' + config.id + '-' + dedupe,
    id = config.id + '-' + dedupe;
  const prefix = `inbox/${config.workspace_id}/${config.id}/${dedupe}`;
  await env.MEDIA.put(prefix + '/message.eml', raw, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });
  const attachments = [];
  for (const [i, a] of mail.attachments.entries()) {
    if (i >= 30) break;
    const bytes = typeof a.content === 'string' ? enc.encode(a.content) : a.content;
    const key = prefix + '/attachment-' + i;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: 'application/octet-stream' } });
    attachments.push({
      name: (a.filename || 'attachment').slice(0, 200),
      size: bytes.byteLength,
      key,
    });
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO wr_inbox_threads(id,workspace_id,config_id,route_id,owner_id,subject,last_received_at,created_at) VALUES(?,?,?,?,?,?,?,?)`,
    ).bind(
      threadId,
      config.workspace_id,
      config.id,
      route?.id || null,
      route?.owner_id || null,
      (mail.subject || '(无主题)').slice(0, 1000),
      received,
      received,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO wr_inbox_messages(id,workspace_id,config_id,thread_id,dedupe_key,message_id,in_reply_to,references_header,sender,envelope_from,recipient,to_header,subject,text_body,raw_key,attachments,kind,match_method,forward_to,forward_status,received_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      id,
      config.workspace_id,
      config.id,
      threadId,
      dedupe,
      messageId,
      mail.inReplyTo || '',
      (mail.references || '').slice(0, 20000),
      mail.from?.address || envelopeFrom,
      envelopeFrom,
      recipient,
      JSON.stringify(mail.to || []).slice(0, 10000),
      (mail.subject || '(无主题)').slice(0, 1000),
      (mail.text || plain(mail.html || '')).slice(0, 500000),
      prefix + '/message.eml',
      JSON.stringify(attachments),
      classify(header, mail.from?.address || envelopeFrom),
      method,
      config.forward_to,
      forwardStatus,
      received,
    ),
    env.DB.prepare(
      `UPDATE wr_inbox_threads SET last_received_at=MAX(last_received_at,?),status=CASE WHEN status='done' THEN 'pending' ELSE status END,version=version+1 WHERE id=?`,
    ).bind(received, threadId),
    env.DB.prepare(
      'UPDATE wr_inbox_configs SET verified_at=CASE WHEN ? THEN COALESCE(verified_at,?) ELSE verified_at END,last_received_at=? WHERE id=?',
    ).bind(Number(verifiedForward), received, received, config.id),
  ]);
  return { duplicate: false, id };
}
