import { actorScope, creatorFilter } from '../lib/actor-scope';
import { siteOverview } from "../lib/overview";
import { Hono } from "hono";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createDb } from "../../db";
import { siteMessageJobs, siteMessageTargets } from "../../db/schema";
import puppeteer from "@cloudflare/puppeteer";
import type { Bindings, Variables } from "../../shared/types";
import { requireAuth, requirePermission } from "../middleware/auth";
import { runSiteMessageJob, isAbnormalTarget, isNoContactTarget, isInaccessibleTarget } from "../queues/site-message.queue";

type Env = { Bindings: Bindings; Variables: Variables };
export const siteMessageRoutes = new Hono<Env>();

const MAX_TARGETS_PER_JOB = 500;
const MAX_TARGET_ID_BATCH_SIZE = 75;
const MAX_D1_BATCH_SIZE = 100;

const chunkItems = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

type TargetInsertRow = {
  id: string;
  jobId: string;
  position: number;
  websiteUrl: string;
  normalizedHost: string;
};

const insertSiteMessageTargets = async (database: D1Database, rows: TargetInsertRow[]) => {
  const timestamp = Math.floor(Date.now() / 1000);
  for (const batch of chunkItems(rows, MAX_D1_BATCH_SIZE)) {
    await database.batch(batch.map((row) => database.prepare(
      `INSERT INTO edm_site_message_targets
        (id, job_id, position, website_url, normalized_host, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(row.id, row.jobId, row.position, row.websiteUrl, row.normalizedHost, timestamp, timestamp)));
  }
};

const normalizeWebsite = (raw: string) => {
  const value = raw.trim();
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  if (!/^https?:$/.test(url.protocol)) throw new Error("仅支持 HTTP/HTTPS 网站");
  url.hash = "";
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blockedIpv6 = host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || blockedIpv6 || /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error("不允许访问本地或私有网络地址");
  }
  return { url: url.toString(), host: host.replace(/^www\./, "") };
};

const normalizeTargets = (input: unknown) => {
  const rawTargets = Array.isArray(input) ? input : String(input || "").split(/[\n,;]+/);
  const normalized = new Map<string, { url: string; host: string }>();
  const invalid: string[] = [];
  for (const raw of rawTargets) {
    if (!String(raw).trim()) continue;
    try {
      const target = normalizeWebsite(String(raw));
      if (!normalized.has(target.host)) normalized.set(target.host, target);
    } catch {
      invalid.push(String(raw).trim());
    }
  }
  return { normalized, invalid };
};

siteMessageRoutes.use("/*", requireAuth);

siteMessageRoutes.get("/", requirePermission("site-messages:read"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const rows = await db.select().from(siteMessageJobs).where(actorScope(siteMessageJobs, user)).orderBy(desc(siteMessageJobs.createdAt));

  const jobsWithStats = await Promise.all(rows.map(async (job) => {
    const targets = await db.select({
      status: siteMessageTargets.status,
      resultCode: siteMessageTargets.resultCode,
      resultMessage: siteMessageTargets.resultMessage,
    }).from(siteMessageTargets).where(eq(siteMessageTargets.jobId, job.id));

    let submitted = 0;
    let failed = 0;
    let noContact = 0;
    let inaccessible = 0;

    for (const t of targets) {
      if (t.status === "submitted") submitted++;
      else if (isNoContactTarget(t)) noContact++;
      else if (isInaccessibleTarget(t)) inaccessible++;
      else if (["failed", "skipped"].includes(t.status)) failed++;
    }

    return {
      ...job,
      totalSubmitted: submitted,
      totalSkipped: 0,
      totalFailed: failed,
      totalAbnormal: noContact + inaccessible,
      totalNoContact: noContact,
      totalInaccessible: inaccessible,
    };
  }));

  return c.json({ success: true, data: jobsWithStats });
});

siteMessageRoutes.get("/stats/overview", requirePermission("site-messages:read"), async (c) => {
  return c.json({success:true,data:await siteOverview(c.env.DB,c.get("user")!.id,creatorFilter(c.get("user")!))});
});

siteMessageRoutes.get("/:id/export", requirePermission("site-messages:read"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const jobId = c.req.param("id");
  const [job] = await db.select().from(siteMessageJobs).where(and(eq(siteMessageJobs.id, jobId), actorScope(siteMessageJobs, user)));
  if (!job) return c.json({ success: false, error: "任务不存在" }, 404);

  const targets = await db.select().from(siteMessageTargets).where(eq(siteMessageTargets.jobId, job.id)).orderBy(asc(siteMessageTargets.position));

  const statusLabelMap: Record<string, string> = {
    submitted: "已提交",
    skipped: "已跳过",
    failed: "失败",
    abnormal: "异常",
    queued: "排队中",
    discovering: "查找联系页",
    submitting: "正在提交",
    draft: "未执行",
  };

  const resultCodeMap: Record<string, string> = {
    confirmed: "网站已确认收到留言",
    submitted_unconfirmed: "表单已提交，但网站未返回明确确认信息",
    contact_page_not_found: "未找到包含可用联系表单的页面",
    contact_form_not_found: "未找到包含可用联系表单",
    submit_not_found: "未找到可用的提交按钮",
    captcha_detected: "检测到验证码或人机验证，已按规则跳过",
    max_attempts_exceeded: "连续失败达到次数限制(2次)，已按规则跳过",
    execution_error: "执行过程发生异常",
    invalid_domain: "无效的域名或无法访问",
    missing_profile_value: "缺少必要的联系人资料",
    unsupported_required_field: "存在暂不支持的必填字段",
    validation_failed: "网站返回表单校验错误",
    queue_unavailable: "任务队列暂时不可用",
  };

  const headers = [
    "序号",
    "目标网站",
    "规范域名",
    "联系页URL",
    "执行状态",
    "结果代码",
    "详细原因说明",
    "尝试次数",
    "日志记录摘要",
    "完成时间",
  ];

  const escapeCsvField = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = targets.map((target, idx) => {
    const statusText = target.status === "submitted"
      ? "已提交"
      : isNoContactTarget(target)
        ? "无联系页"
        : isInaccessibleTarget(target)
          ? "无法访问"
          : "失败";
    const codeText = target.resultCode || "-";
    const reasonText = target.resultMessage || resultCodeMap[target.resultCode || ""] || "-";

    let logSummary = "-";
    try {
      const logs = JSON.parse(target.progressLogs || "[]");
      if (Array.isArray(logs) && logs.length > 0) {
        logSummary = logs
          .map((l: any) => `[${l.percent || 0}%] ${l.message || ""}`)
          .join(" -> ");
      }
    } catch {}

    const completedAtText = target.completedAt ? new Date(target.completedAt).toLocaleString("zh-CN", { hour12: false }) : "-";

    return [
      idx + 1,
      target.websiteUrl,
      target.normalizedHost,
      target.contactPageUrl || "-",
      statusText,
      codeText,
      reasonText,
      target.attempts || 0,
      logSummary,
      completedAtText,
    ].map(escapeCsvField).join(",");
  });

  const csvContent = "\uFEFF" + [headers.map(escapeCsvField).join(","), ...rows].join("\r\n");
  const safeFilename = job.name.replace(/[/\\?%*:|"<>]/g, "_");

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeFilename)}_执行结果.csv"`,
    },
  });
});

siteMessageRoutes.get("/:id", requirePermission("site-messages:read"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const [job] = await db.select().from(siteMessageJobs).where(and(eq(siteMessageJobs.id, c.req.param("id")), actorScope(siteMessageJobs, user)));
  if (!job) return c.json({ success: false, error: "任务不存在" }, 404);
  const targets = await db.select().from(siteMessageTargets).where(eq(siteMessageTargets.jobId, job.id)).orderBy(asc(siteMessageTargets.position));

  let submitted = 0;
  let failed = 0;
  let noContact = 0;
  let inaccessible = 0;

  const classifiedTargets = targets.map((t) => {
    const isNoContact = isNoContactTarget(t);
    const isInaccessible = isInaccessibleTarget(t);
    let classifiedStatus: string = t.status;

    if (t.status === "submitted") {
      submitted++;
      classifiedStatus = "submitted";
    } else if (isNoContact) {
      noContact++;
      classifiedStatus = "no_contact";
    } else if (isInaccessible) {
      inaccessible++;
      classifiedStatus = "inaccessible";
    } else if (["failed", "skipped"].includes(t.status)) {
      failed++;
      classifiedStatus = "failed";
    }

    return {
      ...t,
      classifiedStatus,
    };
  });

  return c.json({
    success: true,
    data: {
      ...job,
      totalSubmitted: submitted,
      totalSkipped: 0,
      totalFailed: failed,
      totalAbnormal: noContact + inaccessible,
      totalNoContact: noContact,
      totalInaccessible: inaccessible,
      targets: classifiedTargets,
    },
  });
});


siteMessageRoutes.post("/", requirePermission("site-messages:write"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const body = await c.req.json<any>();
  const name = String(body.name || "").trim();
  const senderName = String(body.senderName || "").trim();
  const senderEmail = String(body.senderEmail || "").trim();
  const message = String(body.message || "").trim();
  if (!name || !senderName || !senderEmail || !message) return c.json({ success: false, error: "任务名称、姓名、邮箱和留言内容为必填项" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) return c.json({ success: false, error: "邮箱格式不正确" }, 400);
  if (message.length < 10 || message.length > 5000) return c.json({ success: false, error: "留言内容应为 10-5000 个字符" }, 400);
  if (body.authorized !== true) return c.json({ success: false, error: "请确认这些网站允许你提交业务咨询，并遵守其使用条款" }, 400);

  const { normalized, invalid } = normalizeTargets(body.targets);
  if (!normalized.size) return c.json({ success: false, error: "请至少提供一个有效的公网网站地址" }, 400);
  if (normalized.size > MAX_TARGETS_PER_JOB) return c.json({ success: false, error: `单个任务最多支持 ${MAX_TARGETS_PER_JOB} 个不同域名` }, 400);

  const id = crypto.randomUUID();
  try {
    await db.insert(siteMessageJobs).values({
      id,
      userId: user.id,
    createdBy: user.actorId || user.id,
      name,
      senderName,
      senderEmail,
      senderPhone: String(body.senderPhone || "").trim() || null,
      company: String(body.company || "").trim() || null,
      address: String(body.address || "").trim() || null,
      country: String(body.country || "").trim() || null,
      city: String(body.city || "").trim() || null,
      subject: String(body.subject || "").trim() || null,
      message,
      totalTargets: normalized.size,
    });
    const targetRows = Array.from(normalized.values()).map((target, position) => ({
      id: crypto.randomUUID(),
      jobId: id,
      position,
      websiteUrl: target.url,
      normalizedHost: target.host,
    }));
    await insertSiteMessageTargets(c.env.DB, targetRows);
  } catch (error) {
    console.error("Failed to create site-message job", { jobId: id, targetCount: normalized.size, error });
    try {
      await c.env.DB.batch([
        c.env.DB.prepare("DELETE FROM edm_site_message_targets WHERE job_id = ?").bind(id),
        c.env.DB.prepare("DELETE FROM edm_site_message_jobs WHERE id = ?").bind(id),
      ]);
    } catch (cleanupError) {
      console.error("Failed to clean up incomplete site-message job", { jobId: id, cleanupError });
    }
    return c.json({ success: false, error: "目标网站保存失败，请稍后重试" }, 500);
  }
  const [job] = await db.select().from(siteMessageJobs).where(eq(siteMessageJobs.id, id));
  return c.json({ success: true, data: job, meta: { accepted: normalized.size, invalid } }, 201);
});

siteMessageRoutes.patch("/:id", requirePermission("site-messages:write"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const jobId = c.req.param("id");
  const [job] = await db.select().from(siteMessageJobs).where(and(eq(siteMessageJobs.id, jobId), actorScope(siteMessageJobs, user)));
  if (!job) return c.json({ success: false, error: "任务不存在" }, 404);
  if (["queued", "running"].includes(job.status)) return c.json({ success: false, error: "排队中或执行中的任务不能编辑" }, 409);

  const body = await c.req.json<any>();
  const name = String(body.name || "").trim();
  const senderName = String(body.senderName || "").trim();
  const senderEmail = String(body.senderEmail || "").trim();
  const message = String(body.message || "").trim();
  if (!name || !senderName || !senderEmail || !message) return c.json({ success: false, error: "任务名称、姓名、邮箱和留言内容为必填项" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) return c.json({ success: false, error: "邮箱格式不正确" }, 400);
  if (message.length < 10 || message.length > 5000) return c.json({ success: false, error: "留言内容应为 10-5000 个字符" }, 400);
  if (body.authorized !== true) return c.json({ success: false, error: "请确认这些网站允许你提交业务咨询，并遵守其使用条款" }, 400);

  let normalized: Map<string, { url: string; host: string }> | null = null;
  let invalid: string[] = [];
  if (job.status === "draft" && body.targets !== undefined) {
    const result = normalizeTargets(body.targets);
    normalized = result.normalized;
    invalid = result.invalid;
    if (!normalized.size) return c.json({ success: false, error: "请至少提供一个有效的公网网站地址" }, 400);
    if (normalized.size > MAX_TARGETS_PER_JOB) return c.json({ success: false, error: `单个任务最多支持 ${MAX_TARGETS_PER_JOB} 个不同域名` }, 400);
  }

  await db.update(siteMessageJobs).set({
    name,
    senderName,
    senderEmail,
    senderPhone: String(body.senderPhone || "").trim() || null,
    company: String(body.company || "").trim() || null,
    address: String(body.address || "").trim() || null,
    country: String(body.country || "").trim() || null,
    city: String(body.city || "").trim() || null,
    subject: String(body.subject || "").trim() || null,
    message,
    ...(normalized ? { totalTargets: normalized.size, totalSubmitted: 0, totalSkipped: 0, totalFailed: 0 } : {}),
    updatedAt: new Date(),
  }).where(eq(siteMessageJobs.id, jobId));

  if (normalized) {
    await db.delete(siteMessageTargets).where(eq(siteMessageTargets.jobId, jobId));
    const targetRows = Array.from(normalized.values()).map((target, position) => ({
      id: crypto.randomUUID(),
      jobId,
      position,
      websiteUrl: target.url,
      normalizedHost: target.host,
    }));
    await insertSiteMessageTargets(c.env.DB, targetRows);
  }
  const [updated] = await db.select().from(siteMessageJobs).where(eq(siteMessageJobs.id, jobId));
  return c.json({ success: true, data: updated, meta: { accepted: normalized?.size, invalid } });
});

siteMessageRoutes.post("/:id/start", requirePermission("site-messages:send"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const jobId = c.req.param("id");
  const [job] = await db.select().from(siteMessageJobs).where(and(eq(siteMessageJobs.id, jobId), actorScope(siteMessageJobs, user)));
  if (!job) return c.json({ success: false, error: "任务不存在" }, 404);

  if (["queued", "running"].includes(job.status)) return c.json({ error: "任务正在执行，请勿重复启动" }, 409);
  const jobTargets = await db
    .select({ id: siteMessageTargets.id, status: siteMessageTargets.status, resultCode: siteMessageTargets.resultCode, attempts: siteMessageTargets.attempts })
    .from(siteMessageTargets)
    .where(eq(siteMessageTargets.jobId, jobId));

  // Executable targets: All targets that are NOT yet successfully submitted (includes skipped, failed, queued, discovering, submitting, draft)
  const executableTargets = jobTargets.filter((target) => !["submitted", "submitting", "discovering"].includes(target.status) && target.resultCode !== "submission_uncertain");

  if (!executableTargets.length) {
    const updatedTargets = await db.select({ status: siteMessageTargets.status }).from(siteMessageTargets).where(eq(siteMessageTargets.jobId, jobId));
    const submitted = updatedTargets.filter((t) => t.status === "submitted").length;
    const skipped = updatedTargets.filter((t) => t.status === "skipped").length;
    const failed = updatedTargets.filter((t) => t.status === "failed").length;
    await db.update(siteMessageJobs).set({
      status: "completed",
      totalSubmitted: submitted,
      totalSkipped: skipped,
      totalFailed: failed,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(siteMessageJobs.id, jobId));
    return c.json({ success: false, error: "没有可重试的目标；已提交或提交结果待核实的网站不会自动重发。" }, 400);
  }

  for (const batch of chunkItems(executableTargets, MAX_TARGET_ID_BATCH_SIZE)) {
    await db.update(siteMessageTargets).set({
      status: "queued",
      resultCode: null,
      resultMessage: null,
      progressStage: "queued",
      progressPercent: 0,
      progressLogs: "[]",
      attempts: 0,
      completedAt: null,
      updatedAt: new Date(),
    }).where(inArray(siteMessageTargets.id, batch.map((target) => target.id)));
  }

  await db.update(siteMessageJobs).set({ status: "queued", startedAt: new Date(), completedAt: null, updatedAt: new Date() }).where(eq(siteMessageJobs.id, jobId));

  try {
    await c.env.SITE_MESSAGE_QUEUE.send({ kind: "site-message-runner", jobId });
  } catch (error: any) {
    const message = error?.message || "任务队列暂时不可用";
    for (const batch of chunkItems(executableTargets, MAX_TARGET_ID_BATCH_SIZE)) {
      await db.update(siteMessageTargets).set({ status: "failed", resultCode: "queue_unavailable", resultMessage: message, completedAt: new Date(), updatedAt: new Date() }).where(inArray(siteMessageTargets.id, batch.map((target) => target.id)));
    }
    await db.update(siteMessageJobs).set({
      status: "failed",
      totalFailed: executableTargets.length,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(siteMessageJobs.id, jobId));
    return c.json({ success: false, error: "站内信任务队列暂时不可用，请稍后重试" }, 503);
  }

  return c.json({ success: true, data: { queued: executableTargets.length } });
});

siteMessageRoutes.post("/:id/reset", requirePermission("site-messages:send"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const jobId = c.req.param("id");
  const [job] = await db.select().from(siteMessageJobs).where(and(eq(siteMessageJobs.id, jobId), actorScope(siteMessageJobs, user)));
  if (!job) return c.json({ success: false, error: "任务不存在" }, 404);

  if (["queued", "running"].includes(job.status)) return c.json({ error: "请先暂停任务再重置" }, 409);
  const active = await db.select({ id: siteMessageTargets.id }).from(siteMessageTargets).where(and(eq(siteMessageTargets.jobId, jobId), inArray(siteMessageTargets.status, ["discovering", "submitting"])));
  if (active.length) return c.json({ error: "当前网站仍在处理中，请等待处理结束再重置" }, 409);
  const jobTargets = await db
    .select({ id: siteMessageTargets.id })
    .from(siteMessageTargets)
    .where(eq(siteMessageTargets.jobId, jobId));

  for (const batch of chunkItems(jobTargets, MAX_TARGET_ID_BATCH_SIZE)) {
    await db.update(siteMessageTargets).set({
      status: "queued",
      resultCode: null,
      resultMessage: null,
      progressStage: "queued",
      progressPercent: 0,
      progressLogs: "[]",
      completedAt: null,
      updatedAt: new Date(),
    }).where(inArray(siteMessageTargets.id, batch.map((target) => target.id)));
  }

  await db.update(siteMessageJobs).set({
    status: "draft",
    totalSubmitted: 0,
    totalSkipped: 0,
    totalFailed: 0,
    startedAt: null,
    completedAt: null,
    updatedAt: new Date(),
  }).where(eq(siteMessageJobs.id, jobId));

  return c.json({ success: true, data: { reset: jobTargets.length } });
});

siteMessageRoutes.post("/:id/pause", requirePermission("site-messages:send"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const jobId = c.req.param("id");
  const [job] = await db.select().from(siteMessageJobs).where(and(eq(siteMessageJobs.id, jobId), actorScope(siteMessageJobs, user)));
  if (!job) return c.json({ success: false, error: "任务不存在" }, 404);
  if (!["queued", "running"].includes(job.status)) return c.json({ success: false, error: "当前任务不在执行中" }, 409);

  await db.update(siteMessageJobs).set({ status: "paused", completedAt: null, updatedAt: new Date() }).where(eq(siteMessageJobs.id, jobId));
  return c.json({ success: true, data: { status: "paused" } });
});

siteMessageRoutes.delete("/:id", requirePermission("site-messages:delete"), async (c) => {
  const db = createDb(c.env.DB);
  const user = c.get("user")!;
  const jobId = c.req.param("id");
  const [job] = await db.select({ id: siteMessageJobs.id }).from(siteMessageJobs).where(and(eq(siteMessageJobs.id, jobId), actorScope(siteMessageJobs, user)));
  if (!job) return c.json({ success: false, error: "任务不存在" }, 404);
  await db.delete(siteMessageJobs).where(eq(siteMessageJobs.id, jobId));
  return c.json({ success: true });
});

siteMessageRoutes.post("/force-cleanup", requirePermission("site-messages:send"), async (c) => {
  return c.json({ error: "请在单个任务中暂停后重置，以免重复向已完成的网站提交。" }, 409);
});
