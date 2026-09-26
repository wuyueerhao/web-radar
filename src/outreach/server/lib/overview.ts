import type { EmailOverview, SiteOverview } from '../../../shared/outreach-stats';
import { percentage } from '../../../shared/outreach-stats';
import { isNoContactTarget, isInaccessibleTarget } from '../queues/site-message.queue';

export async function emailOverview(db: D1Database, workspaceId: string, creatorId?: string): Promise<EmailOverview> {
  // Reconcile counters per campaign; one campaign's row events must not hide another's provider totals.
  const [totals, contacts] = await Promise.all([
    db
      .prepare(
        `WITH owned AS (SELECT * FROM edm_campaigns WHERE user_id = ? ${creatorId?'AND created_by=?':''}), recipients AS (
      SELECT r.campaign_id,
        SUM(CASE WHEN r.sent_at IS NOT NULL OR r.ses_message_id IS NOT NULL OR r.status IN ('sent','delivered','opened','clicked','bounced') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN r.delivered_at IS NOT NULL OR r.opened_at IS NOT NULL OR r.clicked_at IS NOT NULL OR r.status IN ('delivered','opened','clicked') THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN r.opened_at IS NOT NULL OR r.clicked_at IS NOT NULL OR r.status IN ('opened','clicked') THEN 1 ELSE 0 END) AS opened,
        SUM(CASE WHEN r.clicked_at IS NOT NULL OR r.status = 'clicked' THEN 1 ELSE 0 END) AS clicked,
        SUM(CASE WHEN r.status = 'bounced' THEN 1 ELSE 0 END) AS bounced
      FROM edm_campaign_recipients r JOIN owned c ON c.id = r.campaign_id GROUP BY r.campaign_id
    ) SELECT COUNT(*) AS totalCampaigns,
      COALESCE(SUM(MAX(c.total_sent,COALESCE(r.sent,0))),0) AS totalSent,
      COALESCE(SUM(MAX(c.total_delivered,COALESCE(r.delivered,0))),0) AS totalDelivered,
      COALESCE(SUM(MAX(c.total_opened,COALESCE(r.opened,0))),0) AS totalOpened,
      COALESCE(SUM(MAX(c.total_clicked,COALESCE(r.clicked,0))),0) AS totalClicked,
      COALESCE(SUM(MAX(c.total_bounced,COALESCE(r.bounced,0))),0) AS totalBounced
      FROM owned c LEFT JOIN recipients r ON r.campaign_id=c.id`,
      )
      .bind(workspaceId,...(creatorId?[creatorId]:[]))
      .first<any>(),
    db
      .prepare(
        `SELECT COUNT(*) AS totalContacts, COALESCE(SUM(CASE WHEN subscription_status='subscribed' THEN 1 ELSE 0 END),0) AS subscribedContacts FROM edm_contacts WHERE user_id=?`,
      )
      .bind(workspaceId)
      .first<any>(),
  ]);
  const sync = await db.prepare(`SELECT p.name AS providerName,COALESCE(s.status,'idle') AS status,
    COALESCE(s.checked,0) AS checked,COALESCE(s.failed,0) AS failed,s.error,s.updated_at AS updatedAt
    FROM edm_providers p LEFT JOIN edm_resend_sync_runs s ON s.provider_id=p.id
    WHERE p.user_id=? AND p.provider='resend' AND p.status='active'`).bind(workspaceId).all();
  const data = { ...totals, ...contacts, resendSync:sync.results };
  return {
    ...data,
    deliveryRate: percentage(data.totalDelivered, data.totalSent),
    openRate: percentage(data.totalOpened, data.totalSent),
    clickRate: percentage(data.totalClicked, data.totalSent),
    bounceRate: percentage(data.totalBounced, data.totalSent),
  };
}
export async function siteOverview(db: D1Database, workspaceId: string, creatorId?: string): Promise<SiteOverview> {
  const [jobs, targets] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS n FROM edm_site_message_jobs WHERE user_id=? ${creatorId?'AND created_by=?':''}`)
      .bind(workspaceId,...(creatorId?[creatorId]:[]))
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT t.status,t.result_code AS resultCode,t.result_message AS resultMessage,COUNT(*) AS n
      FROM edm_site_message_targets t JOIN edm_site_message_jobs j ON j.id=t.job_id
      WHERE j.user_id=? ${creatorId?'AND j.created_by=?':''} GROUP BY t.status,t.result_code,t.result_message`,
      )
      .bind(workspaceId,...(creatorId?[creatorId]:[]))
      .all<any>(),
  ]);
  const data: SiteOverview = {
    totalJobs: jobs?.n || 0,
    totalTargets: 0,
    totalSubmitted: 0,
    totalSkipped: 0,
    totalFailed: 0,
    totalNoContact: 0,
    totalInaccessible: 0,
    totalPending: 0,
    totalUncertain: 0,
    totalAbnormal: 0,
  };
  for (const target of targets.results) {
    const n = Number(target.n);
    data.totalTargets += n;
    if (target.status === 'submitted') data.totalSubmitted += n;
    else if (target.resultCode === 'submission_uncertain') data.totalUncertain += n;
    else if (isNoContactTarget(target)) data.totalNoContact += n;
    else if (isInaccessibleTarget(target)) data.totalInaccessible += n;
    else if (target.status === 'skipped') data.totalSkipped += n;
    else if (target.status === 'failed') data.totalFailed += n;
    else data.totalPending += n;
  }
  data.totalAbnormal = data.totalNoContact + data.totalInaccessible;
  return data;
}
