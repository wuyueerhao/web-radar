import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { d1 } from './sqlite';
import { emailOverview, siteOverview } from '../../src/outreach/server/lib/overview';
let sqlite: DatabaseSync;
const insert = (table: string, row: Record<string, string | number>) => {
  const keys = Object.keys(row);
  sqlite
    .prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
    .run(...Object.values(row));
};
const campaign = (id: string, user = 'a', extra = {}) =>
  insert('edm_campaigns', {
    id,
    user_id: user,
    name: id,
    sender_email: 'test@example.com',
    sender_name: 'Test',
    created_at: 1,
    updated_at: 1,
    ...extra,
  });
const job = (id: string, user = 'a') =>
  insert('edm_site_message_jobs', {
    id,
    user_id: user,
    name: id,
    sender_email: 'test@example.com',
    sender_name: 'Test',
    message: 'Test',
    created_at: 1,
    updated_at: 1,
  });
const target = (id: string, jobId: string, status: string, code = '') =>
  insert('edm_site_message_targets', {
    id,
    job_id: jobId,
    status,
    result_code: code,
    website_url: `https://${id}.example.com`,
    normalized_host: `${id}.example.com`,
    created_at: 1,
    updated_at: 1,
  });
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0007_outreach.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0011_customer_inbox.sql','utf8'));
  for(const file of ['0008_resend_tracking.sql','0009_email_scheduling.sql']) sqlite.exec(readFileSync('migrations/'+file,'utf8'));
  for (const id of ['a', 'b'])
    insert('edm_users', { id, name: id, email: `${id}@example.com`, created_at: 1, updated_at: 1 });
});
afterEach(() => sqlite.close());
describe('workspace overview aggregation', () => {
  it('returns zero counts and unavailable percentages for an empty workspace', async () => {
    const email = await emailOverview(d1(sqlite) as any, 'a');
    expect(email).toMatchObject({
      totalCampaigns: 0,
      totalContacts: 0,
      totalSent: 0,
      deliveryRate: null,
      openRate: null,
      clickRate: null,
      bounceRate: null,
    });
    const sites = await siteOverview(d1(sqlite) as any, 'a');
    expect(Object.values(sites).every((v) => v === 0)).toBe(true);
  });
  it('reconciles events per campaign, counts subscribed contacts and excludes other workspaces', async () => {
    insert('edm_contacts', {
      id: 'c',
      user_id: 'a',
      email: 'c@example.com',
      created_at: 1,
      updated_at: 1,
    });
    insert('edm_contacts', {
      id: 'u',
      user_id: 'a',
      email: 'u@example.com',
      subscription_status: 'unsubscribed',
      created_at: 1,
      updated_at: 1,
    });
    insert('edm_contacts', {
      id: 'x',
      user_id: 'b',
      email: 'x@example.com',
      created_at: 1,
      updated_at: 1,
    });
    campaign('counter', 'a', {
      total_sent: 10,
      total_delivered: 8,
      total_opened: 4,
      total_clicked: 1,
      total_bounced: 2,
    });
    campaign('event');
    campaign('foreign', 'b', { total_sent: 999 });
    insert('edm_campaign_recipients', {
      id: 'r1',
      campaign_id: 'counter',
      contact_id: 'c',
      status: 'clicked',
      created_at: 1,
    });
    insert('edm_campaign_recipients', {
      id: 'r2',
      campaign_id: 'event',
      contact_id: 'c',
      status: 'clicked',
      created_at: 1,
    });
    insert('edm_campaign_recipients', {
      id: 'r3',
      campaign_id: 'event',
      contact_id: 'u',
      status: 'bounced',
      sent_at: 1,
      created_at: 1,
    });
    const result = await emailOverview(d1(sqlite) as any, 'a');
    expect(result).toEqual({
      totalCampaigns: 2,
      totalContacts: 2,
      subscribedContacts: 1,
      totalSent: 12,
      totalDelivered: 9,
      totalOpened: 5,
      totalClicked: 2,
      totalBounced: 3,
      deliveryRate: 75,
      openRate: 41.7,
      clickRate: 16.7,
      bounceRate: 25,
      resendSync: [],
    });
  });
  it('classifies actual target rows into mutually exclusive results without trusting stale job counters', async () => {
    job('j');
    job('foreign', 'b');
    for (const [id, status, code] of [
      ['ok', 'submitted', ''],
      ['captcha', 'skipped', 'captcha_detected'],
      ['failed', 'failed', 'unexpected_error'],
      ['missing', 'skipped', 'contact_page_not_found'],
      ['http', 'failed', 'http_error'],
      ['pending', 'queued', ''],
      ['uncertain', 'failed', 'submission_uncertain'],
    ])
      target(id, 'j', status, code);
    target('private', 'foreign', 'submitted');
    expect(await siteOverview(d1(sqlite) as any, 'a')).toEqual({
      totalJobs: 1,
      totalTargets: 7,
      totalSubmitted: 1,
      totalSkipped: 1,
      totalFailed: 1,
      totalNoContact: 1,
      totalInaccessible: 1,
      totalPending: 1,
      totalUncertain: 1,
      totalAbnormal: 2,
    });
  });
  it('handles more than 100 jobs without binding a variable for each job', async () => {
    for (let i = 0; i < 150; i++) {
      job(`j${i}`);
      target(`t${i}`, `j${i}`, 'submitted');
    }
    expect(await siteOverview(d1(sqlite) as any, 'a')).toMatchObject({
      totalJobs: 150,
      totalTargets: 150,
      totalSubmitted: 150,
    });
  });
});
