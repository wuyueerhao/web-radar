import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { contacts } from "./contacts";

// 邮件模板
export const templates = sqliteTable("edm_templates", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"), // 纯文本备用版
  // 模板变量定义 JSON: [{"key": "company", "label": "公司名", "default": ""}]
  variables: text("variables"),
  category: text("category"), // 模板分类
  isAiGenerated: integer("is_ai_generated", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 营销活动
export const campaigns = sqliteTable(
  "edm_campaigns",
  {
    id: text("id").primaryKey(),
    createdBy: text("created_by"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => templates.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    // 发件人设置
    senderEmail: text("sender_email").notNull(),
    senderName: text("sender_name").notNull(),
    replyTo: text("reply_to"),
    replyTracking: integer("reply_tracking", { mode: "boolean" }).notNull().default(false),
    // 活动状态
    status: text("status", {
      enum: ["draft", "scheduled", "sending", "paused", "completed", "failed", "needs_review"],
    })
      .notNull()
      .default("draft"),
    // 发送配置
    sendRate: integer("send_rate").default(50), // 每分钟发送速率
    // Mailchimp Marketing API 创建的远端 Campaign，用于重试幂等
    mailchimpCampaignId: text("mailchimp_campaign_id"),
    // 统计数据
    totalRecipients: integer("total_recipients").notNull().default(0),
    totalSent: integer("total_sent").notNull().default(0),
    totalDelivered: integer("total_delivered").notNull().default(0),
    totalOpened: integer("total_opened").notNull().default(0),
    totalClicked: integer("total_clicked").notNull().default(0),
    totalReplied: integer("total_replied").notNull().default(0),
    totalBounced: integer("total_bounced").notNull().default(0),
    totalComplained: integer("total_complained").notNull().default(0),
    totalUnsubscribed: integer("total_unsubscribed").notNull().default(0),
    // 时间线
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_campaigns_user").on(table.userId),
    index("idx_campaigns_status").on(table.status),
  ]
);

// 活动收件人关联
export const campaignRecipients = sqliteTable(
  "edm_campaign_recipients",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    // 个性化变量 JSON: {"company": "Acme", "name": "John"}
    variables: text("variables"),
    // 发送状态
    status: text("status", {
      enum: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "replied",
        "bounced",
        "complained",
        "unsubscribed",
        "failed",
      ],
    })
      .notNull()
      .default("queued"),
    // 追踪信息
    sesMessageId: text("ses_message_id"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    openedAt: integer("opened_at", { mode: "timestamp" }),
    clickedAt: integer("clicked_at", { mode: "timestamp" }),
    repliedAt: integer("replied_at", { mode: "timestamp" }),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_recipients_campaign").on(table.campaignId),
    index("idx_recipients_contact").on(table.contactId),
    index("idx_recipients_status").on(table.status),
  ]
);

// CRM 联系人状态追踪
export const crmContacts = sqliteTable(
  "edm_crm_contacts",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    // CRM 状态
    status: text("status", {
      enum: [
        "new",
        "contacted",
        "replied",
        "interested",
        "not_interested",
        "converted",
        "do_not_contact",
      ],
    })
      .notNull()
      .default("new"),
    // 回复追踪
    replyContent: text("reply_content"),
    replySentiment: text("reply_sentiment", {
      enum: ["positive", "neutral", "negative"],
    }),
    // 标签和备注
    tags: text("tags"), // JSON 数组
    notes: text("notes"),
    // 时间追踪
    lastContactedAt: integer("last_contacted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_crm_contact").on(table.contactId),
    index("idx_crm_status").on(table.status),
  ]
);
