import { trackedAddress, plain } from '../../../worker/inbox/core';
import { emailSendDelay, deferEmail, resendCooldown } from '../lib/email-pacing';
import { resendRequest, ResendApiError } from '../lib/resend';
import { createHash } from 'node:crypto';
import { publicFetch as fetch } from "../lib/network";
import { loadProviders } from "../lib/credentials";
import { eq, and, sql, inArray } from "drizzle-orm";
import { createDb } from "../../db";
import { campaignRecipients, campaigns, contacts, providers, templates } from "../../db/schema";
import { blockedEmailMessage, findBlockedEmailTerms } from "../../shared/email-content-policy";
import { selectEmailProviderForSender } from "../lib/email-provider-selection";
import { readAttempt, claimAttempt, saveAttempt } from "../lib/email-attempt";

/**
 * 邮件发送队列消费者
 * 处理从 Campaign 发送流程推入的邮件发送任务
 */
export interface QueueMessage<T> {
  body: T;
  ack(): void;
  retry(options?: QueueRetryOptions): void;
}

export interface MessageBatch<T> {
  readonly messages: readonly QueueMessage<T>[];
  recovery?: boolean;
}

export interface EmailSendMessage {
  unsubscribeToken?: string;
  recipientId: string;
  campaignId: string;
  providerId?: string;
  toEmail: string;
  toName: string | null;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: Record<string, string>;
}

const EMAIL_PROVIDER_TYPES = ["resend", "amazon_ses", "mailchimp", "mailgun", "brevo", "sendgrid", "smtp"] as const;
const MAILCHIMP_MARKETING_KEY_SUFFIX = /-[a-z]{2}\d+$/i;

function getMailchimpApiType(apiKey: string, configStr: string | null): "marketing" | "transactional" {
  if (configStr) {
    try {
      const configuredType = JSON.parse(configStr).apiType;
      if (configuredType === "marketing" || configuredType === "transactional") return configuredType;
    } catch {}
  }
  return MAILCHIMP_MARKETING_KEY_SUFFIX.test(apiKey.trim()) ? "marketing" : "transactional";
}

function clipMessage(message: string): string {
  return message.length > 500 ? message.slice(0, 500) : message;
}

type ProgressReporter = (message: string) => Promise<void>;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Mailchimp request timed out after ${timeoutMs / 1000}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = 10000
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

async function readJsonWithTimeout<T = any>(
  response: Response,
  label: string
): Promise<T> {
  const text = await withTimeout(response.text(), label);
  return text ? JSON.parse(text) : ({} as T);
}

async function readTextWithTimeout(
  response: Response,
  label: string
): Promise<string> {
  return await withTimeout(response.text(), label);
}

/**
 * 替换模板变量
 */
function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

function assertEmailContentAllowed(subject: string, bodyHtml: string, bodyText?: string): void {
  const matches = findBlockedEmailTerms(subject, bodyHtml, bodyText);
  if (matches.length) throw new Error(blockedEmailMessage(matches));
}

/**
 * 生成退订链接
 */
function generateUnsubscribeLink(
  baseUrl: string,
  contactId: string,
  campaignId: string
): string {
  const token = encodeURIComponent(contactId);
  return `${baseUrl}/api/outreach/unsubscribe?token=${token}`;
}

function generatePreferencesLink(
  baseUrl: string,
  contactId: string,
  campaignId: string
): string {
  const token = encodeURIComponent(contactId);
  return `${baseUrl}/api/outreach/preferences?token=${token}`;
}

function appendComplianceFooter(
  bodyHtml: string,
  baseUrl: string,
  contactId: string,
  campaignId: string,
  senderName: string,
  unsubscribeLink = generateUnsubscribeLink(baseUrl, contactId, campaignId),
  preferencesLink = generatePreferencesLink(baseUrl, contactId, campaignId)
): string {
  if (bodyHtml.includes("data-growthos-compliance-footer")) return bodyHtml;
  return `${bodyHtml}<div data-growthos-compliance-footer style="margin:32px auto 0;max-width:600px;border-top:1px solid #e5e7eb;padding:28px 24px;text-align:center;color:#667085;font-family:Arial,sans-serif;font-size:12px;line-height:1.7"><p style="margin:0 0 12px">Copyright © ${new Date().getFullYear()} ${senderName || "Your Company"}. All rights reserved.</p><p style="margin:0 0 12px">You are receiving this email because you opted in via our website.</p><p style="margin:0 0 18px">Our mailing address is:<br>${senderName || "Your Company"}</p><p style="margin:0">Want to change how you receive these emails?</p><p style="margin:8px 0 0"><a href="${preferencesLink}" style="display:inline-block;margin-right:10px;color:#4f46e5;text-decoration:underline">Update preferences</a><a href="${unsubscribeLink}" style="display:inline-block;color:#4f46e5;text-decoration:underline">Unsubscribe</a></p></div>`;
}

// Use first-party tracking so engagement does not depend on a provider
// injecting an open pixel into the final MIME body.
function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signTrackingPayload(payload: Record<string, string>, secret: string): Promise<string> {
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${toBase64Url(signature)}`;
}

async function addMailchimpTracking(bodyHtml: string, baseUrl: string, recipientId: string, secret: string): Promise<string> {
  const trackingBase = `${baseUrl.replace(/\/$/, "")}/api/outreach/tracking`;
  const openToken = await signTrackingPayload({ rid: recipientId }, secret);
  const rewrittenHtml = await (async () => {
    let result = bodyHtml;
    const matches = [...bodyHtml.matchAll(/href=(['"])(https?:\/\/[^'"<>]+)\1/gi)];
    for (const match of matches) {
      const token = await signTrackingPayload({ rid: recipientId, url: match[2] }, secret);
      result = result.replace(match[0], `href=${match[1]}${trackingBase}/click?token=${encodeURIComponent(token)}${match[1]}`);
    }
    return result;
  })();
  const pixel = `<img src="${trackingBase}/open?token=${encodeURIComponent(openToken)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;
  return `${rewrittenHtml}${pixel}`;
}

/**
 * 通过 Amazon SES API 发送邮件
 */
async function sendViaSES(
  message: EmailSendMessage,
  apiKey: string,
  configStr: string | null,
  contactId: string,
  betterAuthUrl: string
): Promise<{ messageId: string }> {
  // Try to extract secret key and region from config, otherwise fallback to env config logic
  let secretKey = "";
  let region = "us-east-1";
  
  if (configStr) {
    try {
      const config = JSON.parse(configStr);
      secretKey = config.secretKey || "";
      region = config.region || region;
    } catch (e) {}
  }
  
  if (!secretKey) {
    throw new Error("SES requires secretKey in config");
  }

  const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;

  // 替换模板变量
  const subject = replaceVariables(message.subject, message.variables);
  let bodyHtml = replaceVariables(message.bodyHtml, message.variables);
  const bodyText = message.bodyText
    ? replaceVariables(message.bodyText, message.variables)
    : undefined;

  // 添加退订链接 (合规要求)
  bodyHtml = appendComplianceFooter(bodyHtml, betterAuthUrl, message.unsubscribeToken!, message.campaignId, message.fromName);

  // AWS SES v2 API 请求
  const requestBody = {
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: bodyHtml, Charset: "UTF-8" },
          ...(bodyText && { Text: { Data: bodyText, Charset: "UTF-8" } }),
        },
      },
    },
    Destination: {
      ToAddresses: [
        message.toName ? `${message.toName} <${message.toEmail}>` : message.toEmail,
      ],
    },
    FromEmailAddress: `${message.fromName} <${message.fromEmail}>`,
    ...(message.replyTo && { ReplyToAddresses: [message.replyTo] }),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
      Authorization: `AWS4-HMAC-SHA256 Credential=${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SES API Error (${response.status}): ${errorText}`);
  }

  const result: any = await response.json();
  return { messageId: result.MessageId || crypto.randomUUID() };
}

/**
 * Mailchimp subscriber hash; this Worker already enables nodejs_compat.
 */
function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

/**
 * 通过 Mailchimp Transactional / Mandrill API 发送邮件
 */
async function sendViaMailchimp(
  message: EmailSendMessage,
  apiKey: string,
  configStr: string | null,
  contactId: string,
  betterAuthUrl: string,
  trackingSecret: string,
  reportProgress?: ProgressReporter
): Promise<{ messageId: string }> {
  const subject = replaceVariables(message.subject, message.variables);
  let bodyHtml = replaceVariables(message.bodyHtml, message.variables);
  const bodyText = message.bodyText
    ? replaceVariables(message.bodyText, message.variables)
    : undefined;

  bodyHtml = appendComplianceFooter(bodyHtml, betterAuthUrl, message.unsubscribeToken!, message.campaignId, message.fromName);
  bodyHtml = await addMailchimpTracking(bodyHtml, betterAuthUrl, message.recipientId, trackingSecret);

  const mailchimpApiType = getMailchimpApiType(apiKey, configStr);
  if (mailchimpApiType === "marketing" || MAILCHIMP_MARKETING_KEY_SUFFIX.test(apiKey.trim())) {
    throw new Error(
      mailchimpApiType === "marketing"
        ? "当前配置是 Mailchimp Marketing API，不能按单封邮件发送。请选择 Transactional/Mandrill API 类型。"
        : "当前 Key 是 Mailchimp Marketing API Key，不能用于 Transactional/Mandrill。请选择 Marketing API 类型。"
    );
  }

  const endpoint = "https://mandrillapp.com/api/1.0/messages/send";
  const requestBody = {
    key: apiKey,
    message: {
      html: bodyHtml,
      text: bodyText || undefined,
      subject: subject,
      from_email: message.fromEmail,
      from_name: message.fromName,
      to: [
        {
          email: message.toEmail,
          name: message.toName || undefined,
          type: "to"
        }
      ],
      headers: message.replyTo ? { "Reply-To": message.replyTo } : undefined,
      track_opens: true,
      track_clicks: true,
      tags: [`campaign-${message.campaignId.slice(0, 8)}`]
    }
  };

  await reportProgress?.(`Mailchimp Transactional request started at ${new Date().toISOString()}`);
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  // Logging must never prevent reading the provider's successful response.
  await reportProgress?.(`Mailchimp Transactional response status=${response.status} at ${new Date().toISOString()}`);

  if (!response.ok) {
    const errorText = await readTextWithTimeout(response, "Mailchimp Transactional error body");
    throw new Error(`Mailchimp Transactional API Error (${response.status}): ${errorText}`);
  }

  const result: any = await readJsonWithTimeout(response, "Mailchimp Transactional response body");
  if (Array.isArray(result) && result.length > 0 && ['rejected', 'invalid'].includes(result[0].status)) {
    throw new Error(`Mailchimp Rejected: ${result[0].reject_reason || result[0].status}`);
  }

  if (!Array.isArray(result) || !result[0]?._id) throw new Error("Mailchimp response has no message ID; delivery requires reconciliation");
  return { messageId: result[0]._id };
}

function mailchimpMarketingBase(apiKey: string, configStr: string | null): string {
  let dataCenter = apiKey.trim().match(/-([a-z]{2}\d+)$/i)?.[1] || "";
  if (configStr) {
    try {
      const config = JSON.parse(configStr);
      dataCenter = String(config.dataCenter || config.server || dataCenter).trim();
    } catch {}
  }
  if (!dataCenter) {
    throw new Error("Mailchimp Marketing API Key 缺少数据中心后缀，请使用类似 xxxx-us19 的 Key");
  }
  return `https://${dataCenter}.api.mailchimp.com/3.0`;
}

async function mailchimpMarketingRequest<T = any>(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`anystring:${apiKey}`)}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await readTextWithTimeout(response, "Mailchimp Marketing response body");
  if (!response.ok) {
    throw new Error(`Mailchimp Marketing API Error (${response.status}): ${body}`);
  }
  return body ? JSON.parse(body) : ({} as T);
}

/**
 * Marketing API 是 Campaign 级发送：同步收件人到 Audience，创建静态 Segment，
 * 再创建并发送一个 Mailchimp Campaign。整个批次只能执行一次。
 */
async function sendViaMailchimpMarketingBatch(
  messages: EmailSendMessage[],
  apiKey: string,
  configStr: string | null,
  db: any,
  betterAuthUrl: string,
  database: D1Database
): Promise<void> {
  if (!messages.length) return;
  const baseUrl = mailchimpMarketingBase(apiKey, configStr);
  let config: any = {};
  try { config = configStr ? JSON.parse(configStr) : {}; } catch {}

  const [campaign] = await db
    .select({ id: campaigns.id, name: campaigns.name, status: campaigns.status, templateId: campaigns.templateId, senderEmail: campaigns.senderEmail, senderName: campaigns.senderName, replyTo: campaigns.replyTo, mailchimpCampaignId: campaigns.mailchimpCampaignId })
    .from(campaigns)
    .where(eq(campaigns.id, messages[0].campaignId));
  if (!campaign) throw new Error("Campaign not found");

  const pending = await db.select({ id: campaignRecipients.id }).from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, campaign.id), inArray(campaignRecipients.status, ["queued", "sending"])));
  if (!pending.length) return;
  if (campaign.status !== "sending") throw new Error("Marketing 活动未处于发送中，已阻止继续发送");
  const pendingIds = new Set<string>(pending.map((recipient: { id: string }) => recipient.id));
  const messageIds = new Set(messages.map((message) => message.recipientId));
  // Queue delivery batches are not a complete Mailchimp campaign. Never send
  // just the first batch and report later recipients as members of that send.
  if (pending.some((recipient: { id: string }) => !messageIds.has(recipient.id)))
    throw new Error("Marketing 活动被拆分为多个队列批次，已停止发送；请使用 Transactional 发信服务商");
  if (campaign.mailchimpCampaignId)
    throw new Error("待核实：Marketing 已有远端活动，无法确认本批收件人是否已发送，禁止自动重发");

  const eligible: EmailSendMessage[] = [];
  for (const message of messages) {
    if (!pendingIds.has(message.recipientId)) continue;
    const [contact] = await db
      .select({ subscriptionStatus: contacts.subscriptionStatus })
      .from(campaignRecipients)
      .innerJoin(contacts, eq(contacts.id, campaignRecipients.contactId))
      .where(and(eq(campaignRecipients.id, message.recipientId), eq(campaignRecipients.campaignId, campaign.id)));
    if (contact?.subscriptionStatus === "subscribed") {
      eligible.push(message);
    } else {
      await db.update(campaignRecipients).set({ status: "failed", errorMessage: "Contact unsubscribed" }).where(eq(campaignRecipients.id, message.recipientId));
    }
  }
  if (!eligible.length) throw new Error("没有可发送的已订阅收件人");
  const attemptId = eligible.map((message) => message.recipientId).sort()[0];
  if (!await claimAttempt(database, attemptId))
    throw new Error("待核实：Marketing 发送已开始，禁止重复提交活动");

  let remoteCampaignId: string;
  {
    const listId = String(config.listId || "").trim();
    let audience: any;
    if (listId) {
      audience = await mailchimpMarketingRequest(baseUrl, apiKey, `/lists/${encodeURIComponent(listId)}`);
    } else {
      const lists: any = await mailchimpMarketingRequest(baseUrl, apiKey, "/lists?count=1");
      audience = lists?.lists?.[0];
    }
    if (!audience?.id) {
      throw new Error("Mailchimp 账户没有 Audience。请先在 Mailchimp 创建一个 Audience，并在 provider 配置中填写 listId。");
    }

    const memberEmails: string[] = [];
    for (const message of eligible) {
      const email = message.toEmail.trim().toLowerCase();
      memberEmails.push(email);
      const hash = md5(email);
      await mailchimpMarketingRequest(baseUrl, apiKey, `/lists/${audience.id}/members/${hash}`, {
        method: "PUT",
        body: JSON.stringify({
          email_address: email,
          status_if_new: "subscribed",
          merge_fields: message.toName ? { FNAME: message.toName } : undefined,
        }),
      });
    }

    const segment: any = await mailchimpMarketingRequest(baseUrl, apiKey, `/lists/${audience.id}/segments`, {
      method: "POST",
      body: JSON.stringify({ name: `EDM ${campaign.id}`, static_segment: memberEmails }),
    });
    if (!segment?.id) throw new Error("Mailchimp 未返回静态 Segment ID");

    const templateRows = await db.select({ subject: templates.subject, bodyHtml: templates.bodyHtml, bodyText: templates.bodyText }).from(templates).where(eq(templates.id, campaign.templateId));
    const template = templateRows[0];
    if (!template) throw new Error("邮件模板不存在");
    const subject = replaceVariables(template.subject, eligible[0].variables);
    let html = replaceVariables(template.bodyHtml, eligible[0].variables);
    const text = template.bodyText ? replaceVariables(template.bodyText, eligible[0].variables) : undefined;
    assertEmailContentAllowed(subject, html, text);
    html = appendComplianceFooter(html, betterAuthUrl, eligible[0].recipientId, campaign.id, campaign.senderName, "*|UNSUB|*", "*|UPDATE_PROFILE|*");
    const remote: any = await mailchimpMarketingRequest(baseUrl, apiKey, "/campaigns", {
      method: "POST",
      body: JSON.stringify({
        type: "regular",
        recipients: { list_id: audience.id, segment_opts: { saved_segment_id: segment.id } },
        settings: { subject_line: subject, title: campaign.name, from_name: campaign.senderName, reply_to: campaign.replyTo || campaign.senderEmail },
      }),
    });
    remoteCampaignId = remote.id;
    await db.update(campaigns).set({ mailchimpCampaignId: remoteCampaignId, updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
    await mailchimpMarketingRequest(baseUrl, apiKey, `/campaigns/${remoteCampaignId}/content`, {
      method: "PUT",
      body: JSON.stringify({ html, plain_text: text }),
    });
  }

  await mailchimpMarketingRequest(baseUrl, apiKey, `/campaigns/${remoteCampaignId}/actions/send`, { method: "POST", body: "{}" });
  await saveAttempt(database, attemptId, remoteCampaignId);
  await db.update(campaignRecipients).set({ status: "sent", sesMessageId: remoteCampaignId, sentAt: new Date(), errorMessage: null }).where(inArray(campaignRecipients.id, eligible.map((m) => m.recipientId)));
  await db.update(campaigns).set({ totalSent: sql`${campaigns.totalSent} + ${eligible.length}`, status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
}

/**
 * 通过 SendGrid v3 API 发送邮件
 */
async function sendViaSendGrid(
  message: EmailSendMessage,
  apiKey: string,
  contactId: string,
  betterAuthUrl: string
): Promise<{ messageId: string }> {
  const endpoint = "https://api.sendgrid.com/v3/mail/send";
  const subject = replaceVariables(message.subject, message.variables);
  let bodyHtml = replaceVariables(message.bodyHtml, message.variables);
  const bodyText = message.bodyText
    ? replaceVariables(message.bodyText, message.variables)
    : undefined;

  bodyHtml = appendComplianceFooter(bodyHtml, betterAuthUrl, message.unsubscribeToken!, message.campaignId, message.fromName);

  const contentList: any[] = [{ type: "text/html", value: bodyHtml }];
  if (bodyText) {
    contentList.unshift({ type: "text/plain", value: bodyText });
  }

  const requestBody = {
    personalizations: [
      {
        to: [{ email: message.toEmail, name: message.toName || undefined }],
        subject: subject,
      },
    ],
    from: { email: message.fromEmail, name: message.fromName },
    ...(message.replyTo && { reply_to: { email: message.replyTo } }),
    content: contentList,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text();
    throw new Error(`SendGrid API Error (${response.status}): ${errorText}`);
  }

  const sgMsgId = response.headers.get("X-Message-Id") || crypto.randomUUID();
  return { messageId: sgMsgId };
}

/** 通过 Mailgun Messages API 发送邮件 */
async function sendViaMailgun(
  message: EmailSendMessage,
  apiKey: string,
  configStr: string | null,
  contactId: string,
  betterAuthUrl: string
): Promise<{ messageId: string }> {
  let domain = "";
  let baseUrl = "https://api.mailgun.net";
  if (configStr) {
    try {
      const config = JSON.parse(configStr);
      domain = String(config.domain || "").trim();
      baseUrl = String(config.baseUrl || baseUrl).replace(/\/$/, "");
    } catch {}
  }
  if (!domain) throw new Error("Mailgun 需要配置发送域名 domain");

  const subject = replaceVariables(message.subject, message.variables);
  let bodyHtml = replaceVariables(message.bodyHtml, message.variables);
  const bodyText = message.bodyText ? replaceVariables(message.bodyText, message.variables) : undefined;
  bodyHtml = appendComplianceFooter(bodyHtml, betterAuthUrl, message.unsubscribeToken!, message.campaignId, message.fromName);

  const form = new FormData();
  form.append("from", `${message.fromName} <${message.fromEmail}>`);
  form.append("to", message.toName ? `${message.toName} <${message.toEmail}>` : message.toEmail);
  form.append("subject", subject);
  form.append("html", bodyHtml);
  if (bodyText) form.append("text", bodyText);
  if (message.replyTo) form.append("h:Reply-To", message.replyTo);

  const response = await fetchWithTimeout(`${baseUrl}/v3/${encodeURIComponent(domain)}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`api:${apiKey}`)}` },
    body: form,
  });
  if (!response.ok) {
    const errorText = await readTextWithTimeout(response, "Mailgun error body");
    throw new Error(`Mailgun API Error (${response.status}): ${errorText}`);
  }
  const result: any = await readJsonWithTimeout(response, "Mailgun response body");
  return { messageId: result.id || crypto.randomUUID() };
}

/** 通过 Brevo Transactional Email API 发送邮件 */
async function sendViaBrevo(
  message: EmailSendMessage,
  apiKey: string,
  contactId: string,
  betterAuthUrl: string
): Promise<{ messageId: string }> {
  const subject = replaceVariables(message.subject, message.variables);
  let bodyHtml = replaceVariables(message.bodyHtml, message.variables);
  const bodyText = message.bodyText ? replaceVariables(message.bodyText, message.variables) : undefined;
  bodyHtml = appendComplianceFooter(bodyHtml, betterAuthUrl, message.unsubscribeToken!, message.campaignId, message.fromName);

  const response = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { email: message.fromEmail, name: message.fromName },
      to: [{ email: message.toEmail, name: message.toName || undefined }],
      subject,
      htmlContent: bodyHtml,
      ...(bodyText && { textContent: bodyText }),
      ...(message.replyTo && { replyTo: message.replyTo }),
    }),
  });
  if (!response.ok) {
    const errorText = await readTextWithTimeout(response, "Brevo error body");
    throw new Error(`Brevo API Error (${response.status}): ${errorText}`);
  }
  const result: any = await readJsonWithTimeout(response, "Brevo response body");
  return { messageId: result.messageId || crypto.randomUUID() };
}

/**
 * 通过 SMTP API / Relay 发送邮件
 */
async function sendViaSMTP(
  message: EmailSendMessage,
  apiKey: string,
  configStr: string | null,
  contactId: string,
  betterAuthUrl: string
): Promise<{ messageId: string }> {
  let host = "";
  let port = 587;
  let username = "";
  if (configStr) {
    try {
      const cfg = JSON.parse(configStr);
      host = cfg.host || "";
      port = cfg.port || 587;
      username = cfg.username || "";
    } catch (e) {}
  }

  const subject = replaceVariables(message.subject, message.variables);
  let bodyHtml = replaceVariables(message.bodyHtml, message.variables);
  bodyHtml = appendComplianceFooter(bodyHtml, betterAuthUrl, message.unsubscribeToken!, message.campaignId, message.fromName);

  if (!host) {
    throw new Error("SMTP 服务器配置为空，请检查主机地址");
  }

  const response = await fetch(`https://${host}:${port}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${username}:${apiKey}`)}`,
    },
    body: JSON.stringify({
      from: `${message.fromName} <${message.fromEmail}>`,
      to: message.toEmail,
      subject,
      html: bodyHtml,
    }),
  }).catch(() => null);

  if (response && response.ok) {
    const resData: any = await response.json().catch(() => ({}));
    return { messageId: resData.id || crypto.randomUUID() };
  }

  return { messageId: crypto.randomUUID() };
}

/**
 * 处理邮件发送队列消息批次
 */
export async function handleEmailQueue(
  batch: MessageBatch<EmailSendMessage>,
  env: any
): Promise<void> {
  const db = createDb(env.DB);

  // Marketing API 的发送对象是整个 Campaign，必须在批次级别执行，不能逐收件人调用。
  const firstMessage = batch.messages[0]?.body;
  if (firstMessage) {
    const [campaignOwner] = await db
      .select({ userId: campaigns.userId, status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.id, firstMessage.campaignId));
    if (campaignOwner) {
      const configuredProviders = (await loadProviders(db,env,campaignOwner.userId)).filter(p=>p.status==='active' && (EMAIL_PROVIDER_TYPES as readonly string[]).includes(p.provider));
      const selected = selectEmailProviderForSender(configuredProviders, campaignOwner.userId, firstMessage.fromEmail);
      const batchProvider = configuredProviders.find((provider) => provider.id === firstMessage.providerId) || selected.provider;
      if (batchProvider?.provider === "mailchimp" && getMailchimpApiType(batchProvider.apiKey, batchProvider.config) === "marketing") {
        if (campaignOwner.status === "paused") {
          for (const message of batch.messages) message.retry({ delaySeconds: 300 });
          return;
        }
        if (batch.recovery) {
          await db.update(campaignRecipients).set({ status: "failed", errorMessage: "待核实：Marketing 活动需核对远端活动状态，禁止自动重发" })
            .where(and(inArray(campaignRecipients.id, batch.messages.map((m) => m.body.recipientId)), inArray(campaignRecipients.status, ["queued", "sending"])));
          for (const message of batch.messages) message.ack();
          return;
        }
        try {
          await sendViaMailchimpMarketingBatch(batch.messages.map((m) => m.body), batchProvider.apiKey, batchProvider.config, db, env.BETTER_AUTH_URL || "https://edm.codeisworld.workers.dev", env.DB);
        } catch (error: any) {
          const errorMessage = clipMessage(error.message || "Mailchimp Marketing API send failed");
          const affected = await db.update(campaignRecipients).set({ status: "failed", errorMessage })
            .where(and(inArray(campaignRecipients.id, batch.messages.map((m) => m.body.recipientId)), inArray(campaignRecipients.status, ["queued", "sending"])))
            .returning({ id: campaignRecipients.id });
          if (affected.length) await db.update(campaigns).set({ status: errorMessage.startsWith("待核实") ? "needs_review" : "failed", updatedAt: new Date() }).where(eq(campaigns.id, firstMessage.campaignId));
        } finally {
          for (const message of batch.messages) message.ack();
        }
        return;
      }
    }
  }

  const reconciliation = new Map<string, Promise<any[]>>();
  const CONCURRENCY = batch.recovery ? 1 : 2;
  for (let i = 0; i < batch.messages.length; i += CONCURRENCY) {
    const chunk = batch.messages.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (msg) => {
        const message = msg.body;
        let dispatchStarted = false;
        let providerResult: { messageId: string } | undefined;
        try {
          // 获取联系人 ID
          const [recipient] = await db
            .select()
            .from(campaignRecipients)
            .where(eq(campaignRecipients.id, message.recipientId));

          if (!recipient) {
            msg.ack();
            return;
          }

          if (recipient.sentAt || recipient.sesMessageId || ["sent", "delivered", "opened", "clicked", "replied", "bounced", "complained", "unsubscribed"].includes(recipient.status)) {
            if ((recipient.status === "failed" && recipient.errorMessage !== "Resend: email.failed") || recipient.status === "sending") {
              await db.update(campaignRecipients).set({ status: "sent", errorMessage: null }).where(and(eq(campaignRecipients.id, recipient.id), inArray(campaignRecipients.status, ['failed','sending']), sql`COALESCE(${campaignRecipients.errorMessage}, '') != 'Resend: email.failed'`));
            }
            msg.ack();
            return;
          }
          const [campaignState] = await db.select({ status: campaigns.status, sendRate: campaigns.sendRate }).from(campaigns).where(eq(campaigns.id, message.campaignId));
          if (!campaignState || (campaignState.status === "completed" && !recipient.errorMessage)) { msg.ack(); return; }
          if (campaignState.status === "paused") { await deferEmail(env, msg, 300000); return; }
          const attempt = await readAttempt(env.DB, message.recipientId);
          if (attempt?.result) {
            const saved = JSON.parse(attempt.result);
            await db.update(campaignRecipients).set({
              status: sql`CASE WHEN ${campaignRecipients.status} IN ('delivered','opened','clicked','bounced','complained','unsubscribed') OR ${campaignRecipients.errorMessage} = 'Resend: email.failed' THEN ${campaignRecipients.status} ELSE 'sent' END`,
              sesMessageId: saved.messageId, sentAt: sql`COALESCE(${campaignRecipients.sentAt}, ${Math.floor(new Date(saved.sentAt).getTime()/1000)})`,
              errorMessage: sql`CASE WHEN ${campaignRecipients.errorMessage} = 'Resend: email.failed' THEN ${campaignRecipients.errorMessage} ELSE NULL END`,
            }).where(eq(campaignRecipients.id, recipient.id));
            msg.ack(); return;
          }
          if (attempt && Date.now() - attempt.started_at < 120000) { msg.retry({ delaySeconds: 120 }); return; }

          // 检查联系人订阅状态
          const [contact] = await db
            .select({ subscriptionStatus: contacts.subscriptionStatus })
            .from(contacts)
            .where(eq(contacts.id, recipient.contactId));

          if (contact?.subscriptionStatus !== "subscribed") {
            // 已退订，跳过
            await db
              .update(campaignRecipients)
              .set({ status: "failed", errorMessage: "Contact unsubscribed" })
              .where(eq(campaignRecipients.id, message.recipientId));
            msg.ack();
            return;
          }

          assertEmailContentAllowed(
            replaceVariables(message.subject, message.variables),
            replaceVariables(message.bodyHtml, message.variables),
            message.bodyText ? replaceVariables(message.bodyText, message.variables) : undefined
          );

          // Fetch campaign to get userId
          const [campaign] = await db
            .select({ userId: campaigns.userId })
            .from(campaigns)
            .where(eq(campaigns.id, message.campaignId));

          if (!campaign) {
            throw new Error("Campaign not found");
          }

          // Provider configs are administered as app-level settings, so prefer the
          // campaign owner's provider but fall back to the system default provider.
          const emailProviders = (await loadProviders(db,env,campaign.userId)).filter(p=>p.status==='active' && (EMAIL_PROVIDER_TYPES as readonly string[]).includes(p.provider));
          const provider = emailProviders.find((candidate) => candidate.id === message.providerId)
            || selectEmailProviderForSender(emailProviders, campaign.userId, message.fromEmail).provider;

          if (!provider) {
            throw new Error("No active email provider configured");
          }

          // Legacy dead letters may already have reached the provider. Search
          // the original campaign tag before deciding whether another send is safe.
          if (attempt || (batch.recovery && recipient.errorMessage && !recipient.errorMessage.startsWith("AUTH_REJECTED:"))) {
            if (provider.provider === "mailchimp" && getMailchimpApiType(provider.apiKey, provider.config) === "transactional") {
              const lookupKey = `${provider.id}:${message.campaignId}:${message.fromEmail}`;
              if (!reconciliation.has(lookupKey)) reconciliation.set(lookupKey, (async () => {
              // Share one provider search per campaign/batch and leave room for its 20/minute limit.
              await new Promise((resolve) => setTimeout(resolve, 3500));
              const emails = batch.messages.filter((item) => item.body.campaignId === message.campaignId && item.body.fromEmail === message.fromEmail).map((item) => `email:${JSON.stringify(item.body.toEmail)}`);
              const response = await fetchWithTimeout("https://mandrillapp.com/api/1.0/messages/search", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: provider.apiKey, query: emails.join(" OR "), tags: [`campaign-${message.campaignId.slice(0, 8)}`], senders: [message.fromEmail], limit: 1000 }),
              });
              if (!response.ok) throw new Error(`Reconciliation unavailable: ${response.status}`);
              const matches: any = await readJsonWithTimeout(response, "Mailchimp reconciliation");
              if (!Array.isArray(matches)) throw new Error("Invalid reconciliation response");
              return matches;
              })());
              const matches = await reconciliation.get(lookupKey)!;
              const found = matches.find((item: any) => item.email?.toLowerCase() === message.toEmail.toLowerCase() && item._id && ["sent", "queued", "scheduled", "bounced", "soft-bounced", "rejected"].includes(item.state));
              if (found) {
                await db.update(campaignRecipients).set({
                  status: ["bounced", "soft-bounced", "rejected"].includes(found.state) ? "bounced" : "sent",
                  sesMessageId: found._id, sentAt: new Date(found.ts * 1000),
                  errorMessage: ["bounced", "soft-bounced", "rejected"].includes(found.state) ? `Mailchimp: ${found.state}` : null,
                }).where(eq(campaignRecipients.id, recipient.id));
                msg.ack(); return;
              }
            }
            await db.update(campaignRecipients).set({ status: "failed", errorMessage: clipMessage(`待核实：历史发送结果不确定，已阻止自动重发。${recipient.errorMessage || "发送请求已开始"}`) }).where(eq(campaignRecipients.id, recipient.id));
            msg.ack(); return;
          }

          const delay = await emailSendDelay(env.DB, message.recipientId, message.campaignId, campaignState.sendRate, provider.provider === 'resend');
          if (delay > 0) { await deferEmail(env, msg, delay); return; }
          const inboxReply = await trackedAddress(env.DB, 'edm', message.recipientId, plain(replaceVariables(message.bodyHtml, message.variables)), replaceVariables(message.subject, message.variables));
          if (inboxReply) message.replyTo = inboxReply;
          if (!await claimAttempt(env.DB, message.recipientId)) { msg.retry({ delaySeconds: 120 }); return; }
          dispatchStarted = true;

          await db
            .update(campaignRecipients)
            .set({
              errorMessage: clipMessage(
                `Dispatching via ${provider.provider} provider ${provider.name} (${provider.id}) at ${new Date().toISOString()}`
              ),
            })
            .where(eq(campaignRecipients.id, message.recipientId)).catch(() => {});

          // 发送邮件
          let result;
          const betterAuthUrl = env.BETTER_AUTH_URL || "https://edm.codeisworld.workers.dev";
          const reportProgress: ProgressReporter = async (progress) => {
            await db
              .update(campaignRecipients)
              .set({ errorMessage: clipMessage(progress) })
              .where(eq(campaignRecipients.id, message.recipientId)).catch(() => {});
          };
          
          message.unsubscribeToken = await signTrackingPayload({cid:recipient.contactId},env.BETTER_AUTH_SECRET);
          if (provider.provider === "mailchimp") {
            await reportProgress(`Calling Mailchimp Transactional API for ${message.toEmail} at ${new Date().toISOString()}`);
            result = await sendViaMailchimp(
              message,
              provider.apiKey,
              provider.config,
              recipient.contactId,
              betterAuthUrl,
              env.BETTER_AUTH_SECRET,
              reportProgress
            );
          } else if (provider.provider === "resend") {
            await env.DB.prepare('INSERT OR IGNORE INTO edm_resend_deliveries (recipient_id,provider_id,created_at) VALUES (?,?,?)').bind(message.recipientId,provider.id,Math.floor(Date.now()/1000)).run();
            const html = appendComplianceFooter(replaceVariables(message.bodyHtml,message.variables),betterAuthUrl,message.unsubscribeToken!,message.campaignId,message.fromName);
            const response = await resendRequest(provider.apiKey,'/emails',{method:'POST',headers:{'Idempotency-Key':`wr-${message.recipientId}`},body:JSON.stringify({
              from:`${message.fromName.replace(/[\r\n"<>]/g,'')} <${message.fromEmail}>`,to:[message.toEmail],subject:replaceVariables(message.subject,message.variables),html,
              ...(message.bodyText?{text:replaceVariables(message.bodyText,message.variables)}:{}),...(message.replyTo?{reply_to:message.replyTo}:{}),
              headers:{'List-Unsubscribe':`<${betterAuthUrl}/api/outreach/unsubscribe?token=${encodeURIComponent(message.unsubscribeToken!)}>`},
              tags:[{name:'wr_recipient_id',value:message.recipientId}]
            })});
            if(typeof response.id!=='string'||!response.id)throw new Error('Resend 未返回邮件 ID');
            result={messageId:response.id};providerResult=result;
            await saveAttempt(env.DB,message.recipientId,response.id);
            await env.DB.prepare('UPDATE edm_resend_deliveries SET email_id=? WHERE recipient_id=? AND provider_id=?').bind(response.id,message.recipientId,provider.id).run();
          } else if (provider.provider === "amazon_ses") {
            result = await sendViaSES(message, provider.apiKey, provider.config, recipient.contactId, betterAuthUrl);
          } else if (provider.provider === "sendgrid") {
            result = await sendViaSendGrid(message, provider.apiKey, recipient.contactId, betterAuthUrl);
          } else if (provider.provider === "mailgun") {
            result = await sendViaMailgun(message, provider.apiKey, provider.config, recipient.contactId, betterAuthUrl);
          } else if (provider.provider === "brevo") {
            result = await sendViaBrevo(message, provider.apiKey, recipient.contactId, betterAuthUrl);
          } else if (provider.provider === "smtp") {
            result = await sendViaSMTP(message, provider.apiKey, provider.config, recipient.contactId, betterAuthUrl);
          } else {
            throw new Error(`Unsupported provider: ${provider.provider}`);
          }

          providerResult = result;
          await saveAttempt(env.DB, message.recipientId, result.messageId);
          await env.DB.prepare("UPDATE wr_inbox_routes SET provider_message_id=? WHERE source='edm' AND target_id=?").bind(result.messageId,message.recipientId).run();
          // 更新发送状态
          await db
            .update(campaignRecipients)
            .set({
              status: sql`CASE WHEN ${campaignRecipients.status} IN ('delivered','opened','clicked','bounced','complained','unsubscribed') OR ${campaignRecipients.errorMessage} = 'Resend: email.failed' THEN ${campaignRecipients.status} ELSE 'sent' END`,
              sesMessageId: result.messageId,
              sentAt: sql`COALESCE(${campaignRecipients.sentAt}, ${Math.floor(Date.now()/1000)})`,
              errorMessage: sql`CASE WHEN ${campaignRecipients.errorMessage} = 'Resend: email.failed' THEN ${campaignRecipients.errorMessage} ELSE NULL END`,
            })
            .where(eq(campaignRecipients.id, message.recipientId));

          msg.ack();
        } catch (error: any) {
          console.error(
            `Failed to send email to ${message.toEmail}:`,
            error.message
          );

          if (dispatchStarted && error instanceof ResendApiError && [401,403,429].includes(error.status)) {
            // These responses explicitly reject acceptance, so a retry is safe.
            const throttled = error.status === 429 && !error.quotaExceeded;
            const delaySeconds = Math.max(1, error.retryAfter || 60);
            if (error.status === 429) await resendCooldown(env.DB, delaySeconds);
            if (!throttled) await db.update(campaigns).set({status:'paused',updatedAt:new Date()}).where(eq(campaigns.id,message.campaignId));
            await db.update(campaignRecipients).set({status:'queued',errorMessage:throttled?'Resend 限流，等待重试':error.quotaExceeded?'QUOTA_REJECTED: Resend 发送额度不足；额度恢复后继续':'AUTH_REJECTED: Resend 密钥或权限无效；更新后恢复'})
              .where(and(eq(campaignRecipients.id,message.recipientId),sql`${campaignRecipients.sentAt} IS NULL`));
            await env.DB.prepare('DELETE FROM edm_email_send_attempts WHERE recipient_id=? AND result IS NULL').bind(message.recipientId).run();
            await deferEmail(env, msg, (throttled?delaySeconds:300)*1000);return;
          }

          if (dispatchStarted && /Mailchimp Transactional API Error \(401\):/.test(error.message || "") && /Invalid_Key/.test(error.message || "")) {
            // A verified authentication rejection did not accept the email.
            // Pause the campaign before allowing further deliveries to run.
            await db.update(campaigns).set({ status: "paused", updatedAt: new Date() }).where(eq(campaigns.id, message.campaignId));
            await db.update(campaignRecipients).set({ status: "queued", errorMessage: "AUTH_REJECTED: Mailchimp API Key 无效，服务商未受理；更换密钥后恢复" }).where(eq(campaignRecipients.id, message.recipientId));
            await env.DB.prepare("DELETE FROM edm_email_send_attempts WHERE recipient_id = ? AND result IS NULL").bind(message.recipientId).run();
            msg.retry({ delaySeconds: 300 });
            return;
          }

          if (!dispatchStarted || providerResult) {
            // Pre-dispatch infrastructure errors are safe to retry. A saved
            // provider result is replayed to D1, never sent again.
            msg.retry({ delaySeconds: 60 });
            return;
          }
          // A request may have reached the provider: do not resend blindly.
          await db
            .update(campaignRecipients)
            .set({
              status: "failed",
              errorMessage: clipMessage(`待核实：发送请求结果未确认，禁止自动重发。${error.message || "Unknown error"}`),
            })
            .where(and(eq(campaignRecipients.id, message.recipientId), sql`${campaignRecipients.sentAt} IS NULL`));

          // Retry reconciliation, not the send: the durable attempt prevents a second request.
          msg.retry({ delaySeconds: 180 });
        }
      })
    );
  }

  // 检查是否所有邮件已处理完成，更新活动状态
  // 从第一条消息获取 campaignId
  for (const campaignId of new Set(batch.messages.map((message) => message.body.campaignId))) {
    // Recompute instead of per-message increments: retrying this write is idempotent.
    await db.update(campaigns).set({
      totalSent: sql`(SELECT COUNT(*) FROM edm_campaign_recipients WHERE campaign_id = ${campaignId} AND (sent_at IS NOT NULL OR status IN ('sent','delivered','opened','clicked','replied')))`,
      updatedAt: new Date(),
    }).where(eq(campaigns.id, campaignId));

    // 简化：检查是否还有 sending 状态的收件人
    const [sendingCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(campaignRecipients)
      .where(
        sql`${campaignRecipients.campaignId} = ${campaignId} AND ${campaignRecipients.status} IN ('queued', 'sending')`
      );

    if (Number(sendingCount?.count || 0) === 0) {
      const [reviewCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(campaignRecipients)
        .where(sql`${campaignRecipients.campaignId} = ${campaignId} AND ${campaignRecipients.errorMessage} LIKE '待核实%'`);
      const [failedCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(campaignRecipients)
        .where(
          sql`${campaignRecipients.campaignId} = ${campaignId} AND ${campaignRecipients.status} = 'failed'`
        );

      const [sentCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(campaignRecipients)
        .where(
          sql`${campaignRecipients.campaignId} = ${campaignId} AND ${campaignRecipients.status} IN ('sent', 'delivered', 'opened', 'clicked', 'replied')`
        );

      const hasFailures = Number(failedCount?.count || 0) > 0;
      const hasSent = Number(sentCount?.count || 0) > 0;

      await db
        .update(campaigns)
        .set({
          status: Number(reviewCount?.count || 0) > 0 ? "needs_review" : hasFailures && !hasSent ? "failed" : "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
    }
  }
}
