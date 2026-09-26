// Separate durable ingress: routes contain only administrator-provisioned destinations.
interface Target {
  id: string;
  endpoint: string;
  secret: string;
  forwardTo: string;
  default?: boolean;
}
interface Env {
  RAW: R2Bucket;
  INGEST: Queue<{ key: string }>;
  TARGETS: string;
}
const enc = new TextEncoder();
async function hash(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
async function hmac(secret: string, text: string) {
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
function target(env: Env, recipient: string): Target {
  const [local, domain] = recipient.toLowerCase().split('@'),
    routes = JSON.parse(env.TARGETS || '{}')[domain];
  const options: Target[] = Array.isArray(routes) ? routes : routes ? [routes] : [];
  if (options.filter((r) => r.default).length > 1) throw new Error('Multiple default inboxes');
  const t =
    options.find(
      (r) =>
        local.startsWith('e-' + r.id.replaceAll('-', '').slice(0, 12) + '-') ||
        local.startsWith('s-' + r.id.replaceAll('-', '').slice(0, 12) + '-'),
    ) || (!/^[es]-/.test(local) ? options.find((r) => r.default) : undefined);
  if (!t || !t.id || !t.secret || !t.forwardTo || !String(t.endpoint).startsWith('https://'))
    throw new Error('Receiving domain not provisioned');
  return t;
}
export default {
  async email(message: ForwardableEmailMessage, env: Env) {
    const to = message.to.toLowerCase();
    let t: Target;
    try {
      t = target(env, to);
    } catch {
      message.setReject('Receiving address not configured');
      return;
    }
    if (message.rawSize > 15 * 1024 * 1024) {
      message.setReject('Maximum mail size 15 MB');
      return;
    }
    // Save before accepting. The queue retries HTTP delivery independently of mailbox forwarding.
    const raw = await new Response(message.raw).arrayBuffer(),
      key = 'pending/' + crypto.randomUUID();
    await env.RAW.put(key, raw, {
      customMetadata: { to, from: message.from, forward: 'failed', forwardTo: t.forwardTo },
    });
    let forwarded = false;
    try {
      await message.forward(t.forwardTo);
      forwarded = true;
    } catch {
      console.warn('Mailbox forwarding failed; retained for inbox delivery');
    }
    await env.RAW.put(key, raw, {
      customMetadata: {
        to,
        from: message.from,
        forward: forwarded ? 'forwarded' : 'failed',
        forwardTo: t.forwardTo,
      },
    });
    await env.INGEST.send({ key });
  },
  async queue(batch: MessageBatch<{ key: string }>, env: Env) {
    for (const m of batch.messages) {
      try {
        const obj = await env.RAW.get(m.body.key);
        if (!obj) {
          m.ack();
          continue;
        }
        const { to, from, forward, forwardTo } = obj.customMetadata!,
          t = target(env, to),
          time = String(Date.now()),
          raw = await obj.arrayBuffer();
        const signature = await hmac(
          t.secret,
          [t.id, time, to, from, forward, forwardTo, await hash(raw)].join('\n'),
        );
        const response = await fetch(t.endpoint, {
          method: 'POST',
          redirect: 'error',
          headers: {
            'Content-Type': 'message/rfc822',
            'X-Inbox-To': to,
            'X-Inbox-From': from,
            'X-Inbox-Forward': forward,
            'X-Inbox-Forward-To': forwardTo,
            'X-Inbox-Time': time,
            'X-Inbox-Signature': signature,
          },
          body: raw,
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok) throw new Error('Inbox delivery failed: ' + response.status);
        await env.RAW.delete(m.body.key);
        m.ack();
      } catch {
        m.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(m.attempts, 6)) });
      }
    }
  },
  async fetch() {
    return new Response('Customer inbox ingress', { headers: { 'Cache-Control': 'no-store' } });
  },
};
