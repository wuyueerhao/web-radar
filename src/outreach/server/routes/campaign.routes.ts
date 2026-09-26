import { actorScope, creatorFilter } from '../lib/actor-scope';
import { validSendRate } from '../lib/email-pacing';
import { prepareResendTracking, startResendSync } from '../lib/resend-tracking';
import {resolveSenderDomains} from '../lib/sender-domains';
import { emailOverview } from "../lib/overview";
import { publicFetch as fetch } from "../lib/network";
import { loadProviders } from "../lib/credentials";
import { Hono } from "hono";
import { eq, and, desc, count, sql, inArray, isNull } from "drizzle-orm";
import { createDb } from "../../db";
import {
  campaigns,
  campaignRecipients,
  templates,
  contacts,
  providers,
} from "../../db/schema";
import type { Bindings, Variables } from "../../shared/types";
import { requireAuth, requirePermission } from "../middleware/auth";
import { handleEmailQueue } from "../queues/email-send.queue";
import { blockedEmailMessage, findBlockedEmailTerms } from "../../shared/email-content-policy";
import { selectEmailProviderForSender } from "../lib/email-provider-selection";
import { addCampaignRecipients } from "../lib/campaign-recipient-batch";
import { buildCampaignReport } from "../lib/campaign-report";

type Env = { Bindings: Bindings; Variables: Variables };

export const campaignRoutes = new Hono<Env>();

campaignRoutes.use("/*", requireAuth);

const MAILCHIMP_MARKETING_KEY_SUFFIX = /-[a-z]{2}\d+$/i;
const EMAIL_PROVIDER_TYPES = ["resend", "amazon_ses", "mailchimp", "mailgun", "brevo", "sendgrid", "smtp"] as const;

function getMailchimpApiType(provider: any): "marketing" | "transactional" {
  let config: any = {};
  try { config = provider.config ? JSON.parse(provider.config) : {}; } catch {}
  return config.apiType || (MAILCHIMP_MARKETING_KEY_SUFFIX.test(provider.apiKey.trim()) ? "marketing" : "transactional");
}

async function syncMailchimpMarketingReports(db: any, userId: string, env: Bindings) {
  const configuredProviders = (await loadProviders(db,env,userId)).filter(p=>p.status==="active" && p.provider==="mailchimp");
  const marketingProviders = configuredProviders.filter((provider: any) => getMailchimpApiType(provider) === "marketing");
  if (!marketingProviders.length) return;

  const reportCampaigns = await db
    .select({ id: campaigns.id, remoteId: campaigns.mailchimpCampaignId, senderEmail: campaigns.senderEmail })
    .from(campaigns)
    .where(and(eq(campaigns.userId, userId), sql`${campaigns.mailchimpCampaignId} IS NOT NULL`));

  await Promise.all(reportCampaigns.map(async (campaign: any) => {
    try {
      const provider = selectEmailProviderForSender(marketingProviders, userId, campaign.senderEmail).provider;
      if (!provider) return;
      let config: any = {};
      try { config = provider.config ? JSON.parse(provider.config) : {}; } catch {}
      const dataCenter = String(config.dataCenter || config.server || provider.apiKey.trim().match(/-([a-z]{2}\d+)$/i)?.[1] || "").trim();
      if (!dataCenter) return;
      const response = await fetch(`https://${dataCenter}.api.mailchimp.com/3.0/reports/${campaign.remoteId}`, {
        headers: { Authorization: `Basic ${btoa(`anystring:${provider.apiKey}`)}` },
      });
      if (!response.ok) return;
      const report: any = await response.json();
      await db.update(campaigns).set({
        totalSent: Number(report.emails_sent || 0),
        totalDelivered: Math.max(0, Number(report.emails_sent || 0) - Number(report.bounces || 0)),
        totalOpened: Number(report.unique_opens || 0),
        totalClicked: Number(report.unique_clicks || 0),
        totalBounced: Number(report.bounces || 0),
        totalUnsubscribed: Number(report.unsubscribed || 0),
        updatedAt: new Date(),
      }).where(eq(campaigns.id, campaign.id));
    } catch (error) {
      console.error(`Failed to sync Mailchimp report ${campaign.remoteId}:`, error);
    }
  }));
}

async function syncMailchimpTransactionalMessages(db: any, userId: string, env: Bindings) {
  const configuredProviders = (await loadProviders(db,env,userId)).filter(p=>p.status==="active" && p.provider==="mailchimp");
  const transactionalProviders = configuredProviders.filter((provider: any) => getMailchimpApiType(provider) === "transactional");
  if (!transactionalProviders.length) return;

  const pendingMessages = await db
    .select({ recipientId: campaignRecipients.id, campaignId: campaignRecipients.campaignId, messageId: campaignRecipients.sesMessageId, openedAt: campaignRecipients.openedAt, clickedAt: campaignRecipients.clickedAt, status: campaignRecipients.status, senderEmail: campaigns.senderEmail })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(and(eq(campaigns.userId, userId), sql`${campaignRecipients.sesMessageId} IS NOT NULL`, sql`NOT EXISTS (SELECT 1 FROM edm_resend_deliveries d WHERE d.recipient_id=${campaignRecipients.id})`));

  const campaignStats = new Map<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number }>();

  await Promise.all(pendingMessages.map(async (item: any) => {
    try {
      const provider = selectEmailProviderForSender(transactionalProviders, userId, item.senderEmail).provider;
      if (!provider) return;
      const response = await fetch("https://mandrillapp.com/api/1.0/messages/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: provider.apiKey, id: item.messageId }),
      });
      if (!response.ok) return;
      const info: any = await response.json();
      const hasOpen = Number(info.opens || 0) > 0;
      const hasClick = Number(info.clicks || 0) > 0;
      const isBounce = ["bounced", "rejected", "soft-bounced"].includes(String(info.state || "").toLowerCase());
      const isDelivered = ["sent", "delivered"].includes(String(info.state || "").toLowerCase()) && !isBounce;
      const previous = campaignStats.get(item.campaignId) || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      previous.sent += 1;
      previous.delivered += isDelivered ? 1 : 0;
      // Keep first-party tracking events even when Mandrill's report is
      // delayed or unavailable for this message.
      previous.opened += hasOpen || Boolean(item.openedAt) ? 1 : 0;
      previous.clicked += hasClick || Boolean(item.clickedAt) ? 1 : 0;
      previous.bounced += isBounce ? 1 : 0;
      campaignStats.set(item.campaignId, previous);

      // A click is also an engagement/open. Keep both timestamps so changing
      // the recipient status from opened to clicked cannot lose open data.
      const recipientUpdate: Record<string, any> = {};
      if (hasOpen && !item.openedAt) recipientUpdate.openedAt = new Date();
      if (hasClick && !item.clickedAt) recipientUpdate.clickedAt = new Date();
      if (isBounce) {
        recipientUpdate.status = "bounced";
        recipientUpdate.errorMessage = `Mailchimp message state: ${info.state}`;
      } else if (hasClick) {
        recipientUpdate.status = "clicked";
      } else if (hasOpen) {
        recipientUpdate.status = "opened";
      } else if (isDelivered && ["sent", "sending"].includes(item.status)) {
        recipientUpdate.status = "delivered";
      }
      if (Object.keys(recipientUpdate).length) {
        await db.update(campaignRecipients).set(recipientUpdate).where(eq(campaignRecipients.id, item.recipientId));
      }
    } catch (error) {
      console.error(`Failed to sync Mandrill message ${item.messageId}:`, error);
    }
  }));

  // Rebuild totals from the provider's current message info. This is
  // idempotent and corrects totals after delayed events or repeated refreshes.
  await Promise.all(Array.from(campaignStats.entries()).map(([campaignId, stats]) =>
    db.update(campaigns).set({
      totalSent: stats.sent,
      totalDelivered: stats.delivered,
      totalOpened: stats.opened,
      totalClicked: stats.clicked,
      totalBounced: stats.bounced,
      updatedAt: new Date(),
    }).where(eq(campaigns.id, campaignId))
  ));
}

async function syncProviderStats(db: any, userId: string, env: Bindings) {
  await syncMailchimpMarketingReports(db, userId, env);
  await syncMailchimpTransactionalMessages(db, userId, env);
  const resend = (await loadProviders(db,env,userId)).filter(p=>p.provider==='resend' && p.status==='active');
  for (const p of resend) await startResendSync(env,p.id);
}

// 获取活动列表
campaignRoutes.get("/", requirePermission("campaigns:read"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;

  const page = parseInt(c.req.query("page") || "1");
  const pageSize = Math.min(parseInt(c.req.query("pageSize") || "20"), 100);
  const status = c.req.query("status");

  const conditions = [actorScope(campaigns, user)];
  if (status) {
    conditions.push(eq(campaigns.status, status as any));
  }

  const whereClause = and(...conditions);

  const [totalResult] = await db
    .select({ count: count() })
    .from(campaigns)
    .where(whereClause);

  const total = totalResult?.count || 0;

  const campaignsList = await db
    .select()
    .from(campaigns)
    .where(whereClause)
    .orderBy(desc(campaigns.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const campaignIds = campaignsList.map((c) => c.id);
  const statsMap: Record<string, { total: number; sent: number; opened: number; clicked: number; bounced: number; queued: number; sending: number; failed: number }> = {};

  if (campaignIds.length > 0) {
    const recipientStats = await db
      .select({
        campaignId: campaignRecipients.campaignId,
        total: count(),
        queued: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} = 'queued' THEN 1 ELSE 0 END)`,
        sending: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} = 'sending' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} = 'failed' THEN 1 ELSE 0 END)`,
        sent: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} IN ('sent', 'delivered', 'opened', 'clicked') THEN 1 ELSE 0 END)`,
        opened: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} IN ('opened', 'clicked') THEN 1 ELSE 0 END)`,
        clicked: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} = 'clicked' THEN 1 ELSE 0 END)`,
        bounced: sql<number>`SUM(CASE WHEN ${campaignRecipients.status} IN ('failed', 'bounced') THEN 1 ELSE 0 END)`,
      })
      .from(campaignRecipients)
      .where(inArray(campaignRecipients.campaignId, campaignIds))
      .groupBy(campaignRecipients.campaignId);

    for (const stat of recipientStats) {
      statsMap[stat.campaignId] = {
        total: Number(stat.total || 0),
        queued: Number(stat.queued || 0),
        sending: Number(stat.sending || 0),
        failed: Number(stat.failed || 0),
        sent: Number(stat.sent || 0),
        opened: Number(stat.opened || 0),
        clicked: Number(stat.clicked || 0),
        bounced: Number(stat.bounced || 0),
      };
    }
  }

  const data = campaignsList.map((c) => ({
    ...c,
    progress: { queued: statsMap[c.id]?.queued || 0, sending: statsMap[c.id]?.sending || 0, failed: statsMap[c.id]?.failed || 0,
      processed: (statsMap[c.id]?.total || 0) - (statsMap[c.id]?.queued || 0) - (statsMap[c.id]?.sending || 0) },
    totalRecipients: Math.max(Number(c.totalRecipients || 0), Number(statsMap[c.id]?.total || 0)),
    totalSent: Math.max(Number(c.totalSent || 0), Number(statsMap[c.id]?.sent || 0)),
    totalOpened: Math.max(Number(c.totalOpened || 0), Number(statsMap[c.id]?.opened || 0)),
    totalClicked: Math.max(Number(c.totalClicked || 0), Number(statsMap[c.id]?.clicked || 0)),
    totalBounced: Math.max(Number(c.totalBounced || 0), Number(statsMap[c.id]?.bounced || 0)),
  }));

  return c.json({
    success: true,
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// Export local records only; never synchronize or resend during a download.
campaignRoutes.get("/:id/export", requirePermission("campaigns:read"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const id = c.req.param("id");
  const [campaign] = await db.select().from(campaigns)
    .where(and(eq(campaigns.id, id), actorScope(campaigns, user)));
  if (!campaign) return c.json({ success: false, error: "活动不存在" }, 404);
  const rows = await db.select({
    email: contacts.email, name: contacts.name, status: campaignRecipients.status,
    errorMessage: campaignRecipients.errorMessage, sesMessageId: campaignRecipients.sesMessageId,
    sentAt: campaignRecipients.sentAt, deliveredAt: campaignRecipients.deliveredAt,
    openedAt: campaignRecipients.openedAt, clickedAt: campaignRecipients.clickedAt,
  }).from(campaignRecipients)
    .leftJoin(contacts, eq(contacts.id, campaignRecipients.contactId))
    .where(eq(campaignRecipients.campaignId, id))
    .orderBy(campaignRecipients.createdAt, campaignRecipients.id);
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="campaign-report.csv"');
  c.header("Cache-Control", "no-store");
  return c.body(buildCampaignReport(campaign.name, rows));
});

// 获取单个活动详情
campaignRoutes.get("/:id", requirePermission("campaigns:read"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const campaignId = c.req.param("id");

  if (c.req.query("sync") === "1") await syncProviderStats(db, user.id, c.env);

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), actorScope(campaigns, user)));

  if (!campaign) {
    return c.json({ success: false, error: "活动不存在" }, 404);
  }

  const recipients = await db
    .select({
      status: campaignRecipients.status,
      total: count(),
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .groupBy(campaignRecipients.status);

  const counts = Object.fromEntries(recipients.map((r) => [r.status, Number(r.total)]));
  let totalRecipients = recipients.reduce((sum, r) => sum + Number(r.total), 0);
  let totalSent = campaign.totalSent;
  let totalOpened = campaign.totalOpened;
  let totalClicked = campaign.totalClicked;
  let totalBounced = campaign.totalBounced;

  totalSent = Math.max(totalSent, ["sent", "delivered", "opened", "clicked", "replied", "unsubscribed", "complained"].reduce((sum, status) => sum + (counts[status] || 0), 0));

  return c.json({
    success: true,
    data: {
      ...campaign,
      progress: { queued: counts.queued || 0, sending: counts.sending || 0, failed: counts.failed || 0,
        processed: totalRecipients - (counts.queued || 0) - (counts.sending || 0) },
      totalRecipients,
      totalSent,
      totalOpened,
      totalClicked,
      totalBounced,
    },
  });
});

// 创建活动
campaignRoutes.post("/", requirePermission("campaigns:write"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const body = await c.req.json<{
    name: string;
    templateId?: string;
    senderEmail: string;
    senderName: string;
    replyTo?: string;
    sendRate?: number;
    scheduledAt?: string;
  }>();

  if (body.sendRate !== undefined && !validSendRate(body.sendRate)) return c.json({error:'发送速率须为 1–200 封/分钟的整数'},400);
  if (!body.name?.trim() || !body.senderEmail?.trim() || !body.senderName?.trim()) {
    return c.json(
      { success: false, error: "活动名称、发件人邮箱和发件人名称不能为空" },
      400
    );
  }

  if (body.templateId) {
    const [template] = await db.select().from(templates).where(and(eq(templates.id, body.templateId),eq(templates.userId,user.id)));
    if (!template) return c.json({ success: false, error: "邮件模板不存在" }, 404);
    const blockedTerms = findBlockedEmailTerms(template.subject, template.bodyHtml, template.bodyText);
    if (blockedTerms.length) {
      return c.json({ success: false, error: blockedEmailMessage(blockedTerms), blockedTerms }, 400);
    }
  }

  const id = crypto.randomUUID();
  await db.insert(campaigns).values({
    id,
    userId: user.id,
    createdBy: user.actorId || user.id,
    templateId: body.templateId || null,
    name: body.name.trim(),
    senderEmail: body.senderEmail.trim(),
    senderName: body.senderName.trim(),
    replyTo: body.replyTo?.trim() || null,
    sendRate: body.sendRate || 50,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
  });

  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return c.json({ success: true, data: campaign }, 201);
});

// 更新活动
campaignRoutes.put("/:id", requirePermission("campaigns:write"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const campaignId = c.req.param("id");
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), actorScope(campaigns, user)));

  if (!existing) {
    return c.json({ success: false, error: "活动不存在" }, 404);
  }

  if (existing.status === "sending") {
    return c.json(
      { success: false, error: "发送中的活动无法编辑" },
      400
    );
  }

  if (body.sendRate !== undefined && !validSendRate(body.sendRate)) return c.json({error:'发送速率须为 1–200 封/分钟的整数'},400);
  const updateData: Record<string, any> = { updatedAt: new Date() };
  const allowedFields = [
    "name", "templateId", "senderEmail", "senderName",
    "replyTo", "sendRate",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }
  if (body.scheduledAt !== undefined) {
    updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  }

  await db.update(campaigns).set(updateData).where(eq(campaigns.id, campaignId));

  const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  return c.json({ success: true, data: updated });
});

// 删除活动
campaignRoutes.delete("/:id", requirePermission("campaigns:delete"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const campaignId = c.req.param("id");

  const [existing] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), actorScope(campaigns, user)));

  if (!existing) {
    return c.json({ success: false, error: "活动不存在" }, 404);
  }

  if (existing.status === "sending") {
    return c.json({ success: false, error: "发送中的活动无法删除" }, 400);
  }

  // 级联删除收件人
  await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId));
  await db.delete(campaigns).where(eq(campaigns.id, campaignId));

  return c.json({ success: true, data: { deleted: true } });
});

// ====== 活动收件人管理 ======

// 获取活动收件人列表
campaignRoutes.get("/:id/recipients", requirePermission("campaigns:read"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const campaignId = c.req.param("id");

  // 验证活动所有权
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), actorScope(campaigns, user)));

  if (!campaign) {
    return c.json({ success: false, error: "活动不存在" }, 404);
  }

  const page = parseInt(c.req.query("page") || "1");
  const pageSize = Math.min(parseInt(c.req.query("pageSize") || "50"), 200);

  const [totalResult] = await db
    .select({ count: count() })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));

  const total = totalResult?.count || 0;

  // 联表查询获取联系人信息
  const data = await db
    .select({
      id: campaignRecipients.id,
      contactId: campaignRecipients.contactId,
      status: campaignRecipients.status,
      sentAt: campaignRecipients.sentAt,
      openedAt: campaignRecipients.openedAt,
      clickedAt: campaignRecipients.clickedAt,
      errorMessage: campaignRecipients.errorMessage,
      contactEmail: contacts.email,
      contactName: contacts.name,
      contactCompany: contacts.company,
    })
    .from(campaignRecipients)
    .innerJoin(contacts, eq(campaignRecipients.contactId, contacts.id))
    .where(eq(campaignRecipients.campaignId, campaignId))
    .orderBy(desc(campaignRecipients.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return c.json({
    success: true,
    data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// 添加收件人到活动 (从联系人选择)
campaignRoutes.post("/:id/recipients", requirePermission("campaigns:write"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const campaignId = c.req.param("id");
  const body = await c.req.json<{
    contactIds?: string[];
    groupId?: string; // 按分组添加
    tag?: string; // 按标签添加
  }>();

  // 验证活动
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), actorScope(campaigns, user)));

  if (!campaign) {
    return c.json({ success: false, error: "活动不存在" }, 404);
  }

  if (campaign.status === "sending") {
    return c.json({ success: false, error: "发送中的活动无法添加收件人" }, 400);
  }

  let contactList: { id: string; email: string; name: string | null; company: string | null; industry: string | null }[] = [];

  if (body.groupId) {
    // 按分组获取联系人
    const groupCondition = body.groupId === "null" ? isNull(contacts.groupId) : eq(contacts.groupId, body.groupId);

    contactList = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        name: contacts.name,
        company: contacts.company,
        industry: contacts.industry,
      })
      .from(contacts)
      .where(
        and(
          groupCondition,
          eq(contacts.userId, user.id),
          eq(contacts.subscriptionStatus, "subscribed")
        )
      );
  } else if (body.tag) {
    contactList = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        name: contacts.name,
        company: contacts.company,
        industry: contacts.industry,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, user.id),
          eq(contacts.subscriptionStatus, "subscribed"),
          sql`EXISTS (
            SELECT 1
            FROM json_each(CASE WHEN json_valid(${contacts.tags}) THEN ${contacts.tags} ELSE '[]' END)
            WHERE CAST(value AS TEXT) = ${body.tag}
          )`
        )
      );
  } else if (body.contactIds?.length) {
    contactList = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        name: contacts.name,
        company: contacts.company,
        industry: contacts.industry,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, user.id),
          eq(contacts.subscriptionStatus, "subscribed"),
          sql`${contacts.id} IN (SELECT value FROM json_each(${JSON.stringify(body.contactIds)}))`
        )
      );
  } else {
    return c.json({ success: false, error: "请选择联系人、分组或标签" }, 400);
  }

  const result = await addCampaignRecipients(c.env.DB, campaignId, user.id, contactList);

  return c.json({
    success: true,
    data: result,
  });
});

// 删除活动收件人 (按联系人)
campaignRoutes.delete("/:id/recipients/:contactId", requirePermission("campaigns:write"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const campaignId = c.req.param("id");
  const contactId = c.req.param("contactId");

  // 验证活动
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), actorScope(campaigns, user)));

  if (!campaign) {
    return c.json({ success: false, error: "活动不存在" }, 404);
  }

  if (campaign.status === "sending") {
    return c.json({ success: false, error: "发送中的活动无法删除收件人" }, 400);
  }

  // Check if recipient exists and is queued/failed
  const [recipient] = await db
    .select()
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.contactId, contactId)
      )
    );

  if (!recipient) {
    return c.json({ success: false, error: "未找到该收件人" }, 404);
  }

  if (recipient.status === "sending" || recipient.status === "sent") {
    return c.json({ success: false, error: "该收件人已经发送或正在发送中，无法删除" }, 400);
  }

  await db
    .delete(campaignRecipients)
    .where(eq(campaignRecipients.id, recipient.id));

  // Update campaign total recipients
  await db
    .update(campaigns)
    .set({
      totalRecipients: sql`${campaigns.totalRecipients} - 1`,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  return c.json({ success: true, data: { deleted: true } });
});

// ====== 发送活动 ======

// 启动发送
campaignRoutes.post("/:id/send", requirePermission("campaigns:send"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const campaignId = c.req.param("id");

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), actorScope(campaigns, user)));

  if (!campaign) {
    return c.json({ success: false, error: "活动不存在" }, 404);
  }

  if (!campaign.templateId) {
    return c.json({ success: false, error: "请先选择邮件模板" }, 400);
  }

  const pendingStatuses = ["queued", "sending"];

  // 检查是否有待发送/发送中的收件人
  const [recipientCount] = await db
    .select({ count: count() })
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        inArray(campaignRecipients.status, pendingStatuses as any)
      )
    );

  if (!recipientCount?.count) {
    return c.json({ success: false, error: "没有待发送的收件人" }, 400);
  }

  // 获取模板
  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, campaign.templateId),eq(templates.userId,user.id)));

  if (!template) {
    return c.json({ success: false, error: "邮件模板不存在" }, 404);
  }

  const blockedTerms = findBlockedEmailTerms(template.subject, template.bodyHtml, template.bodyText);
  if (blockedTerms.length) {
    return c.json({ success: false, error: blockedEmailMessage(blockedTerms), blockedTerms }, 400);
  }

  const emailProviders = (await loadProviders(db,c.env,user.id)).filter(p=>p.status==="active" && (EMAIL_PROVIDER_TYPES as readonly string[]).includes(p.provider));
  const senderAccounts = await resolveSenderDomains(emailProviders);
  const senderSelection = selectEmailProviderForSender(senderAccounts.providers, user.id, campaign.senderEmail);
  // An unavailable Resend account must not silently fall back to another provider.
  const requiresDomainMatch = emailProviders.some(provider=>provider.provider==='resend');
  const selectedProvider = requiresDomainMatch && !senderSelection.matchedDomain ? undefined : senderSelection.provider;
  if (!selectedProvider) {
    return c.json({ success: false, error: senderAccounts.errors.length ? "无法验证发信帐号域名，请在发信域名页面检查帐号权限后重试" : "没有与发件人域名匹配的可用发信帐号，请检查域名验证状态" }, 400);
  }

  if (selectedProvider.provider === 'resend') {
    try { await prepareResendTracking(c.env, selectedProvider, campaign.senderEmail); }
    catch (error) { return c.json({error:'Resend 数据追踪未准备好：'+(error as Error).message},400); }
  }

  // 更新活动状态为发送中
  const claimed = await db
    .update(campaigns)
    .set({
      status: "sending",
      startedAt: campaign.startedAt || new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.id, campaignId), sql`${campaigns.status} != 'sending'`))
    .returning({ id: campaigns.id });

  if (!claimed.length) return c.json({ success: false, error: "活动已经在发送中，请查看发送进度，不要重复启动" }, 409);

  // 获取待发送的收件人，推入发送队列
  const recipients = await db
    .select({
      id: campaignRecipients.id,
      contactId: campaignRecipients.contactId,
      variables: campaignRecipients.variables,
      contactEmail: contacts.email,
      contactName: contacts.name,
    })
    .from(campaignRecipients)
    .innerJoin(contacts, eq(campaignRecipients.contactId, contacts.id))
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        inArray(campaignRecipients.status, pendingStatuses as any)
      )
    );

  // 1. 构造发送批次消息
  const batch = recipients.map((r) => ({
    body: {
      recipientId: r.id,
      campaignId,
      providerId: selectedProvider.id,
      toEmail: r.contactEmail,
      toName: r.contactName,
      fromEmail: campaign.senderEmail,
      fromName: campaign.senderName,
      replyTo: campaign.replyTo,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      variables: r.variables ? JSON.parse(r.variables) : {},
    },
  }));

  // 2. 先更新收件人状态为 sending
  await db.update(campaignRecipients).set({ status: "sending" })
    .where(and(eq(campaignRecipients.campaignId, campaignId),
      inArray(campaignRecipients.status, pendingStatuses as any)));

  // 3. 触发发送处理：若存在 EMAIL_QUEUE 绑定则入队由 Cloudflare Queue 消费，否则在 waitUntil 中后台并行处理
  const queueMessages = batch.map((b) => ({ body: b.body }));

  if (c.env.EMAIL_QUEUE) {
    for (let i = 0; i < queueMessages.length; i += 100) {
      await c.env.EMAIL_QUEUE.sendBatch(queueMessages.slice(i, i + 100));
    }
  } else {
    const fakeBatch = {
      messages: queueMessages.map((b) => ({
        body: b.body,
        ack: () => {},
        retry: () => {},
      })),
    };

    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(handleEmailQueue(fakeBatch as any, c.env));
    } else {
      await handleEmailQueue(fakeBatch as any, c.env);
    }
  }

  return c.json({
    success: true,
    data: {
      campaignId,
      status: "sending",
      recipientsQueued: recipients.length,
    },
  });
});

// 暂停活动
campaignRoutes.post("/:id/pause", requirePermission("campaigns:send"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const campaignId = c.req.param("id");

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), actorScope(campaigns, user)));

  if (!campaign || campaign.status !== "sending") {
    return c.json({ success: false, error: "只能暂停发送中的活动" }, 400);
  }

  await db
    .update(campaigns)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  return c.json({ success: true, data: { status: "paused" } });
});

// ====== 仪表盘统计 ======

campaignRoutes.get("/stats/overview", requirePermission("campaigns:read"), async (c) => {
  return c.json({success:true,data:await emailOverview(c.env.DB,c.get("user")!.id,creatorFilter(c.get("user")!))});
});

// Reconcile only known accepted emails, scoped to the caller's workspace.
campaignRoutes.post('/stats/resend-sync', requirePermission('campaigns:read'), async (c) => {
  const configured = (await loadProviders(createDb(c.env.DB),c.env,c.get('user')!.id))
    .filter(p=>p.provider==='resend' && p.status==='active');
  try {
    for (const p of configured) await startResendSync(c.env,p.id);
    return c.json({success:true,data:{accounts:configured.length}});
  } catch (error) { return c.json({error:(error as Error).message},503); }
});
