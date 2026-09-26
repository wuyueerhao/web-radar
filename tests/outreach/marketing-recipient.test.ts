import { test, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { d1 } from './sqlite';
import { seal } from '../../src/outreach/server/lib/credentials';

vi.mock('../../src/outreach/server/lib/network', () => ({
  publicFetch: (...args: any[]) => globalThis.fetch(args[0], args[1]),
}));
import { handleEmailQueue, type EmailSendMessage } from '../../src/outreach/server/queues/email-send.queue';

test.each(['complete', 'split', 'existing remote', 'paused', 'concurrent duplicate'])('Marketing delivery preserves recipient safety: %s', async (mode) => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0007_outreach.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0011_customer_inbox.sql','utf8'));
  sqlite.exec(`
    INSERT INTO edm_users(id,name,email,created_at,updated_at) VALUES ('workspace','Test','test@example.com',0,0);
    INSERT INTO edm_providers(id,user_id,provider,name,api_key,is_default,created_at,updated_at) VALUES ('provider','workspace','mailchimp','test','placeholder',1,0,0);
    INSERT INTO edm_templates(id,user_id,name,subject,body_html,created_at,updated_at) VALUES ('template','workspace','Test','Hello','<p>Hello</p>',0,0);
    INSERT INTO edm_campaigns(id,user_id,template_id,name,sender_email,sender_name,status,created_at,updated_at) VALUES ('campaign','workspace','template','Test','from@example.com','Test','sending',0,0);
    INSERT INTO edm_contacts(id,user_id,email,subscription_status,created_at,updated_at) VALUES ('contact-subscribed','workspace','subscribed@example.com','subscribed',0,0),('contact-unsubscribed','workspace','unsubscribed@example.com','unsubscribed',0,0);
    INSERT INTO edm_campaign_recipients(id,campaign_id,contact_id,status,created_at) VALUES ('recipient-subscribed','campaign','contact-subscribed','sending',0),('recipient-unsubscribed','campaign','contact-unsubscribed','sending',0);
  `);
  const env: any = { DB: d1(sqlite), CREDENTIAL_KEY: 'unit-test-only', BETTER_AUTH_SECRET: 'unit-test-only', BETTER_AUTH_URL: 'https://example.test' };
  const calls: { path: string; body: any }[] = [];
  const network = vi.fn(async (url: any, init: any) => {
    const path = new URL(String(url)).pathname;
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ path, body });
    if (path === '/3.0/lists/audience') return Response.json({ id: 'audience' });
    if (/\/members\//.test(path)) return Response.json({ id: 'member' });
    if (path === '/3.0/lists/audience/segments') return Response.json({ id: 7 });
    if (path === '/3.0/campaigns') return Response.json({ id: 'remote-campaign' });
    if (path === '/3.0/campaigns/remote-campaign/content' || path === '/3.0/campaigns/remote-campaign/actions/send') return Response.json({});
    throw new Error(`Unexpected mocked request: ${path}`);
  });
  vi.stubGlobal('fetch', network);
  try {
    sqlite.prepare('UPDATE edm_providers SET api_key=?,config=?').run(
      await seal('fake-key-us1', 'provider', env),
      await seal(JSON.stringify({ apiType: 'marketing', listId: 'audience' }), 'provider:config', env),
    );
    const messages = ['subscribed', 'unsubscribed'].map((name) => ({
      body: { recipientId: `recipient-${name}`, campaignId: 'campaign', providerId: 'provider', toEmail: `${name}@example.com`, toName: 'Test', fromEmail: 'from@example.com', fromName: 'Test', replyTo: null, subject: 'Hello', bodyHtml: '<p>Hello</p>', bodyText: 'Hello', variables: {} } satisfies EmailSendMessage,
      ack: vi.fn(), retry: vi.fn(),
    }));
    if (mode === 'split') {
      sqlite.exec("UPDATE edm_contacts SET subscription_status='subscribed'");
      await handleEmailQueue({ messages: [messages[0]] }, env);
      await handleEmailQueue({ messages: [messages[1]] }, env);
      expect(network).not.toHaveBeenCalled();
      const outcomes = sqlite.prepare('SELECT status,error_message FROM edm_campaign_recipients').all();
      expect(outcomes.every((recipient) => recipient.status === 'failed')).toBe(true);
      expect(outcomes[0].error_message).toContain('多个队列批次');
      expect(sqlite.prepare('SELECT status,total_sent FROM edm_campaigns').get()).toMatchObject({ status: 'failed', total_sent: 0 });
      return;
    }
    if (mode === 'existing remote') {
      sqlite.exec("UPDATE edm_campaigns SET mailchimp_campaign_id='old-remote-campaign'");
      await handleEmailQueue({ messages }, env);
      expect(network).not.toHaveBeenCalled();
      expect(sqlite.prepare('SELECT status,total_sent FROM edm_campaigns').get()).toMatchObject({ status: 'needs_review', total_sent: 0 });
      expect(sqlite.prepare('SELECT COUNT(*) n FROM edm_campaign_recipients WHERE sent_at IS NOT NULL').get()?.n).toBe(0);
      return;
    }
    if (mode === 'paused') {
      sqlite.exec("UPDATE edm_campaigns SET status='paused'");
      await handleEmailQueue({ messages }, env);
      expect(network).not.toHaveBeenCalled();
      expect(messages.every((message) => message.retry.mock.calls.length === 1 && !message.ack.mock.calls.length)).toBe(true);
      return;
    }
    if (mode === 'concurrent duplicate') {
      await Promise.all([handleEmailQueue({ messages }, env), handleEmailQueue({ messages }, env)]);
    } else {
      await handleEmailQueue({ messages }, env);
    }
    expect(sqlite.prepare("SELECT status FROM edm_campaign_recipients WHERE id='recipient-subscribed'").get()?.status).toBe('sent');
    expect(sqlite.prepare("SELECT status,error_message FROM edm_campaign_recipients WHERE id='recipient-unsubscribed'").get()).toMatchObject({ status: 'failed', error_message: 'Contact unsubscribed' });
    expect(calls.find((call) => call.path.endsWith('/segments'))?.body.static_segment).toEqual(['subscribed@example.com']);
    expect(calls.filter((call) => call.path.endsWith('/actions/send'))).toHaveLength(1);
    expect(calls.find((call) => call.path.includes('/members/'))?.path).toBe('/3.0/lists/audience/members/a94f73601a146ec566e131c7fb06d251');
    const callsAfterSending = network.mock.calls.length;
    await handleEmailQueue({ messages }, env);
    expect(network).toHaveBeenCalledTimes(callsAfterSending);
    expect(sqlite.prepare('SELECT total_sent FROM edm_campaigns').get()?.total_sent).toBe(1);
    expect(messages.every((message) => message.ack.mock.calls.length > 0 && !message.retry.mock.calls.length)).toBe(true);
  } finally {
    vi.unstubAllGlobals();
    sqlite.close();
  }
});
