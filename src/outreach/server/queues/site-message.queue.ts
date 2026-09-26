import { trackedAddress } from '../../../worker/inbox/core';
import { assertPublicReference } from "../../../worker/reference-fetch";
import { publicFetch as fetch } from "../lib/network";
import puppeteer from "@cloudflare/puppeteer";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createDb } from "../../db";
import { siteMessageJobs, siteMessageTargets } from "../../db/schema";
import type { Bindings } from "../../shared/types";

export type SiteMessageQueueMessage =
  | { kind: "site-message-runner"; jobId: string }
  | { kind: "site-message"; jobId: string; targetId: string };
type SiteMessageTargetMessage = Extract<SiteMessageQueueMessage, { kind: "site-message" }>;

type FieldKind = "name" | "firstName" | "lastName" | "email" | "phone" | "company" | "address" | "country" | "city" | "salutation" | "subject" | "message" | "unknown";
type DetectedField = {
  index: number;
  kind: FieldKind;
  tag: string;
  type: string;
  required: boolean;
  label: string;
  options?: Array<{ value: string; label: string; disabled: boolean; placeholder: boolean }>;
};
type ProgressLog = { at: string; stage: string; percent: number; message: string; url?: string };

const CONTACT_LINK_PATTERN = /(contact([\s_-]?us)?|get[\s_-]?in[\s_-]?touch|support|feedback|guestbook|message|inquir|contacto|contactez|kontakt|contatti|contato|お問い合わせ|联系|聯絡|留言|문의|связаться)/i;
const COMPLEX_CAPTCHA_PATTERN = /(g-recaptcha|h-captcha|hcaptcha|recaptcha|turnstile|geetest|cf-turnstile)/i;
const CAPTCHA_PATTERN = /(captcha|valicode|authcode|checkcode|(?:verify|verification|validation|security|check)[\s_-]?(?:code|image)|(?:code|verify)[\s_-]?(?:img|image)|验证码|驗證碼)/i;
const MAX_BROWSER_RETRIES = 8;
const INTER_TARGET_DELAY_MS = 3000;
const MAX_RUNNER_DURATION_MS = 8 * 60 * 1000;

class BrowserRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserRateLimitError";
  }
}

const isBrowserRateLimitError = (error: any) => (
  error instanceof BrowserRateLimitError
  || Number(error?.status) === 429
  || Number(error?.code) === 429
  || /(?:code|status)[:=]?\s*429|rate limit|too many requests/i.test(String(error?.message || error || ""))
);

const isBrowserDisconnectedError = (error: any) => {
  const msg = String(error?.message || error || "");
  return (
    msg.includes("Target closed")
    || msg.includes("Session closed")
    || msg.includes("Protocol error")
    || msg.includes("frame was detached")
    || msg.includes("Navigating frame")
    || msg.includes("Execution context was destroyed")
    || msg.includes("browser has been disconnected")
    || msg.includes("Connection closed")
  );
};

const classifyField = (raw: string, type: string): FieldKind => {
  const value = raw.toLowerCase();
  if (type === "email" || /(e-?mail|邮箱|郵箱|电子邮件|correo)/i.test(value)) return "email";
  if (type === "tel" || /(phone|telephone|mobile|whats?\s*app|wa[\s_-]?(?:number|no)|teléfono|telefono|电话|手機|手机)/i.test(value)) return "phone";
  if (/(first[\s_-]?name|given[\s_-]?name|名(?!称))/i.test(value)) return "firstName";
  if (/(last[\s_-]?name|family[\s_-]?name|surname|姓)/i.test(value)) return "lastName";
  if (/(full[\s_-]?name|your[\s_-]?name|姓名|name|nombre)/i.test(value)) return "name";
  if (/(company|organization|organisation|business|公司|企业|organisation)/i.test(value)) return "company";
  if (/(salutation|honou?rific|(?:^|[\s_\[])title(?:$|[\s_\]])|称谓|称呼)/i.test(value)) return "salutation";
  if (/(subject|topic|标题|主题|件名)/i.test(value)) return "subject";
  if (/(message|comment|inquiry|enquiry|details|description|留言|内容|消息|문의)/i.test(value)) return "message";
  if (/(address|street|地址)/i.test(value)) return "address";
  if (/(country|国家|國家|país)/i.test(value)) return "country";
  if (/(city|城市|town)/i.test(value)) return "city";
  return "unknown";
};

const isPublicHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return false;
    return true;
  } catch {
    return false;
  }
};

async function safeClick(page: any, target: any): Promise<boolean> {
  try {
    if (!page || page.isClosed()) return false;
    const result = await page.evaluate((selectorOrElement: any) => {
      let el: HTMLElement | null = null;
      if (typeof selectorOrElement === "string") {
        el = document.querySelector(selectorOrElement);
      } else if (selectorOrElement && typeof selectorOrElement === "object") {
        el = selectorOrElement as HTMLElement;
      }
      if (!el) return false;
      try {
        el.scrollIntoView({ block: "center", inline: "center" });
      } catch {}
      try {
        el.click();
        return true;
      } catch {
        try {
          const ev = new MouseEvent("click", { bubbles: true, cancelable: true, view: window });
          el.dispatchEvent(ev);
          return true;
        } catch {
          return false;
        }
      }
    }, target);
    return Boolean(result);
  } catch (err: any) {
    console.warn("safeClick caught error:", err?.message || String(err));
    return false;
  }
}

async function safeEvaluate<T>(page: any, fn: Function | string, ...args: any[]): Promise<T | null> {
  try {
    if (!page || page.isClosed()) return null;
    return await page.evaluate(fn, ...args);
  } catch (err: any) {
    const msg = String(err?.message || err || "");
    if (
      msg.includes("Execution context was destroyed")
      || msg.includes("Target closed")
      || msg.includes("Session closed")
      || msg.includes("Protocol error")
      || msg.includes("frame was detached")
      || msg.includes("Navigating frame")
    ) {
      console.warn("Execution context/frame lost during evaluate:", msg);
      return null;
    }
    return null;
  }
}

async function detectComplexCaptcha(page: any): Promise<boolean> {
  try {
    if (!page || page.isClosed()) return false;
    const hasCaptcha = await safeEvaluate(page, (patternSource: string) => {
      const pattern = new RegExp(patternSource, "i");
      const pageText = document.body ? document.body.innerText : "";
      if (pattern.test(pageText)) return true;

      const iframes = Array.from(document.querySelectorAll("iframe"));
      const hasCaptchaFrame = iframes.some((iframe) => {
        const src = iframe.getAttribute("src") || "";
        const title = iframe.getAttribute("title") || "";
        return pattern.test(src) || pattern.test(title);
      });
      if (hasCaptchaFrame) return true;

      const captchaElements = Array.from(document.querySelectorAll('[class*="turnstile" i], [id*="turnstile" i], [class*="recaptcha" i], [id*="recaptcha" i], [class*="geetest" i]'));
      return captchaElements.length > 0;
    }, COMPLEX_CAPTCHA_PATTERN.source);

    return Boolean(hasCaptcha);
  } catch {
    return false;
  }
}

const checkPageForCaptcha = detectComplexCaptcha;

async function waitForDynamicContactForm(page: any, timeout = 5000): Promise<boolean> {
  try {
    if (page.isClosed()) return false;
    const found = await safeEvaluate(page, () => {
      const forms = Array.from(document.querySelectorAll("form"));
      return forms.some((form) => {
        const visible = Boolean((form as HTMLElement).offsetWidth || (form as HTMLElement).offsetHeight || form.getClientRects().length);
        if (!visible) return false;
        return Boolean(form.querySelector('textarea, input[type="email"], input[name*="message" i], input[name*="email" i]'));
      });
    });
    if (found) return true;
    await new Promise((resolve) => setTimeout(resolve, timeout));
    return Boolean(await safeEvaluate(page, () => document.querySelector("form textarea, form input[type='email']")));
  } catch {
    return false;
  }
}

const normalizeCandidateUrl = (value: string) => {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
};

async function findContactPage(page: any, websiteUrl: string, report: (stage: string, percent: number, message: string, url?: string) => Promise<void>): Promise<string | null> {
  if (!page || page.isClosed()) return null;
  const homepageHasForm = await safeEvaluate(page, () => Boolean(document.querySelector("form textarea, form input[type='email']")));
  if (homepageHasForm) {
    const homepageForm = await inspectContactForm(page);
    if (homepageForm) {
      await report("contact_page_found", 45, "首页已识别到联系表单", page.url());
      return page.url();
    }
  }
  const links = await safeEvaluate<Array<{ href: string; text: string; score: number }>>(page, (patternSource: string) => {
    const pattern = new RegExp(patternSource, "i");
    const elements = Array.from(document.querySelectorAll("a[href], button, div[role='button'], nav a, header a, footer a, li a"));
    return elements
      .map((el: any) => {
        const rawText = `${el.textContent || ""} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${el.getAttribute("alt") || ""}`.replace(/\s+/g, " ").trim();
        const rawHref = el.href || el.getAttribute("href") || el.getAttribute("data-href") || el.getAttribute("data-url") || "";
        let fullHref = "";
        try {
          fullHref = new URL(rawHref, window.location.href).toString();
        } catch {
          fullHref = rawHref;
        }
        const searchable = `${rawText} ${fullHref}`;
        let score = 0;
        if (/contact([\s_-]?us)?|联系我们|聯絡我們|contactez-nous|kontakt|contacto/i.test(rawText)) score += 20;
        else if (/get[\s_-]?in[\s_-]?touch|reach[\s_-]?us|send[\s_-]?message|inquir|consult|留言|在线咨询|商务合作|feedback|guestbook|message/i.test(rawText)) score += 15;
        else if (/about[\s_-]?us|关于我们|support|customer[\s_-]?service/i.test(rawText)) score += 5;

        if (/(contact|contactus|message|feedback|inquir|guestbook)/i.test(fullHref)) score += 12;
        return { href: fullHref, text: searchable, score };
      })
      .filter((item) => item.score > 0 && item.href && /^https?:/i.test(item.href));
  }, CONTACT_LINK_PATTERN.source) || [];

  const website = new URL(websiteUrl);
  const origin = website.origin;
  const normalizedHost = website.hostname.replace(/^www\./i, "").toLowerCase();
  const discovered = links
    .filter((link: { href: string; score: number }) => {
      try {
        const candidate = new URL(link.href);
        return candidate.hostname.replace(/^www\./i, "").toLowerCase() === normalizedHost && isPublicHttpUrl(link.href);
      } catch {
        return false;
      }
    })
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .map((link: { href: string; score: number }) => link.href);

  const conventionalPaths = [
    "/contact", "/contact-us", "/contact.html", "/Contact.html", "/ContactUs.html", "/Contact-Us.html", "/contactus.html", "/contactus.shtml",
    "/message.shtml", "/message.html", "/message.php", "/feedback.html", "/feedback.shtml", "/feedback.php",
    "/inquiry.html", "/inquiry.shtml", "/inquiry.php", "/guestbook.html", "/guestbook.php",
    "/pages/contact", "/pages/contact-us", "/en/contact", "/en/contact.html", "/kontakt", "/contacto", "/contato",
    "/contact/index.html", "/index.php/contact",
  ];
  const candidates = Array.from(new Set(
    [...discovered, ...conventionalPaths.map((path) => `${origin}${path}`)].map(normalizeCandidateUrl),
  )).slice(0, 15);
  await report("contact_candidates", 35, `发现 ${candidates.length} 个候选联系页面，开始逐页验证`);

  for (let index = 0; index < candidates.length; index += 1) {
    if (page.isClosed()) return null;
    const candidate = candidates[index];
    try {
      await report("checking_contact_page", Math.min(44, 36 + index), `检查候选联系页面 ${index + 1}/${candidates.length}`, candidate);
      const response = await page.goto(candidate, { waitUntil: "domcontentloaded", timeout: 15000 });
      if (response && response.status() < 400 && !page.isClosed()) {
        let form = await inspectContactForm(page);
        if (!form && !page.isClosed()) {
          await report("waiting_dynamic_form", Math.min(44, 36 + index), "页面已打开，正在等待动态联系表单渲染", page.url());
          const formMounted = await waitForDynamicContactForm(page);
          if (formMounted && !page.isClosed()) form = await inspectContactForm(page);
        }
        if (form && !page.isClosed()) {
          await report("contact_page_found", 45, `已找到联系表单，识别到 ${form.fields.length} 个字段`, page.url());
          return page.url();
        }
      }
    } catch {
      // Try the next conventional contact path.
    }
  }
  return null;
}

async function inspectContactForm(page: any): Promise<{ fields: DetectedField[]; formIndex: number } | null> {
  const inspected = await safeEvaluate<any>(page, () => {
    let forms = Array.from(document.querySelectorAll("form")) as HTMLElement[];

    // Fallback: If no explicit <form> tags exist or no form has inputs, check for container elements with textareas or email inputs
    if (!forms.length) {
      const containers = Array.from(document.querySelectorAll("div, section, article, main, body"))
        .filter((el) => el.querySelector("textarea, input[type='email'], input[name*='email' i], input[name*='message' i]")) as HTMLElement[];
      if (containers.length) {
        forms = containers;
      }
    }

    const candidates = forms.map((form, formIndex) => {
      const controls = Array.from(form.querySelectorAll("input, textarea, select")) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
      const descriptors = controls
        .filter((control) => !["hidden", "submit", "button", "reset", "image"].includes((control.getAttribute("type") || "").toLowerCase()))
        .map((control, index) => {
          control.setAttribute("data-growthos-field", `${formIndex}-${index}`);
          const id = control.id;
          const explicitLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : "";
          const wrappingLabel = control.closest("label")?.textContent || "";
          const label = [explicitLabel, wrappingLabel, control.getAttribute("aria-label"), control.getAttribute("placeholder"), control.getAttribute("name"), id, control.getAttribute("autocomplete")]
            .filter(Boolean).join(" ").trim();
          const required = control.required
            || control.getAttribute("aria-required") === "true"
            || control.getAttribute("data-required") === "true"
            || control.hasAttribute("data-val-required")
            || /(?:^|\s)(?:required|必填)(?:\s|$)|(?:^|\s)[*＊](?=\s|$)/i.test(label);
          return {
            index,
            tag: control.tagName.toLowerCase(),
            type: (control.getAttribute("type") || "text").toLowerCase(),
            required,
            label,
            options: control instanceof HTMLSelectElement
              ? Array.from(control.options).map((option, optionIndex) => {
                const optionLabel = option.textContent?.trim() || option.value;
                return {
                  value: option.value,
                  label: optionLabel,
                  disabled: option.disabled || Boolean(option.closest("optgroup:disabled")),
                  placeholder: optionIndex === 0 && (
                    !option.value.trim()
                    || /^(select|choose|please select|please choose|--|请选择|选择|请选)/i.test(optionLabel)
                  ),
                };
              })
              : undefined,
          };
        });
      const text = `${form.textContent || ""} ${descriptors.map((field) => field.label).join(" ")}`.toLowerCase();
      const isVisible = Boolean((form as HTMLElement).offsetWidth || (form as HTMLElement).offsetHeight || form.getClientRects().length);
      const score = (descriptors.some((field) => field.tag === "textarea") ? 5 : 0)
        + (/(message|comment|inquiry|enquiry|留言|消息)/i.test(text) ? 5 : 0)
        + (/(email|e-mail|邮箱|郵箱)/i.test(text) ? 3 : 0)
        + (/(contact|feedback|guestbook|联系|聯絡)/i.test(text) ? 2 : 0)
        + (isVisible ? 4 : -4)
        - (/(newsletter|subscribe|search|login|sign in)/i.test(text) ? 6 : 0);
      return { formIndex, score, descriptors };
    }).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || best.score < 5) return null;
    const form = forms[best.formIndex];
    const submitCandidates = Array.from(form.querySelectorAll(
      'button, input[type="submit"], input[type="button"], input[type="image"], input[value], a, [role="button"], [onclick], [class*="submit" i], [id*="submit" i], [class*="btn" i], [class*="button" i]'
    )) as HTMLElement[];

    let submit = submitCandidates
      .map((element) => {
        const text = [element.textContent, element.getAttribute("value"), element.getAttribute("aria-label"), element.getAttribute("title"), element.className, element.id]
          .filter(Boolean).join(" ");
        const visible = Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
        const score = (/(submit|send|send message|send inquiry|submit now|leave message|get a quote|inquire|inquiry|提交|发送|送信|確認|咨询|在线留言|提交留言)/i.test(text) ? 12 : 0)
          + (element.matches('button[type="submit"], input[type="submit"]') ? 8 : 0)
          + (element.matches('input[type="button"], button[type="button"], input[type="image"]') ? 6 : 0)
          + (/formbtn|submit|btn|button/i.test(String(element.className) + " " + String(element.id)) ? 5 : 0)
          + (visible ? 4 : -10);
        return { element, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    // Fallback: If no explicit submit candidate scored > 3 inside form, check siblings / parent container
    if (!submit || submit.score <= 3) {
      const parent = form.parentElement || form;
      const extraCandidates = Array.from(parent.querySelectorAll(
        'button, input[type="submit"], input[type="button"], input[type="image"], a, [role="button"], [onclick], [class*="submit" i], [id*="submit" i], [class*="btn" i], [class*="button" i]'
      )) as HTMLElement[];
      const extraSubmit = extraCandidates
        .map((element) => {
          const text = [element.textContent, element.getAttribute("value"), element.getAttribute("aria-label"), element.getAttribute("title"), element.className, element.id]
            .filter(Boolean).join(" ");
          const visible = Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
          const score = (/(submit|send|send message|send inquiry|submit now|leave message|get a quote|inquire|inquiry|提交|发送|送信|確認|咨询|在线留言|提交留言)/i.test(text) ? 10 : 0)
            + (visible ? 4 : -10);
          return { element, score };
        })
        .sort((a, b) => b.score - a.score)[0];
      if (extraSubmit && extraSubmit.score > 3) {
        submit = extraSubmit;
      }
    }

    if (submit && submit.score > 3) submit.element.setAttribute("data-growthos-submit", `${best.formIndex}`);
    return best;
  });
  if (!inspected) return null;
  const fields = inspected.descriptors.map((field: any) => ({ ...field, kind: classifyField(field.label, field.type) }));
  return { fields, formIndex: inspected.formIndex };
}

async function fillAndSubmit(
  page: any,
  form: { fields: DetectedField[]; formIndex: number },
  job: any,
  report?: (stage: string, percent: number, message: string, url?: string) => Promise<void>,
) {
  const names = String(job.senderName || "").trim().split(/\s+/);
  const values: Record<FieldKind, string> = {
    name: job.senderName || "",
    firstName: names[0] || job.senderName || "",
    lastName: names.slice(1).join(" ") || names[0] || "",
    email: job.senderEmail || "",
    phone: job.senderPhone || "",
    company: job.company || "",
    address: job.address || "",
    country: job.country || "",
    city: job.city || "",
    salutation: "Mr.",
    subject: job.subject || "General inquiry",
    message: job.message || "",
    unknown: "",
  };

  const senderDomain = String(job.originalSenderEmail || job.senderEmail || "").split("@")[1] || "";
  const inferRequiredValue = (field: DetectedField) => {
    const label = field.label.toLowerCase();
    if (CAPTCHA_PATTERN.test(label) || /(password|passcode|one[\s_-]?time|\botp\b|security[\s_-]?code)/i.test(label)) return "";
    if (/(whats?\s*app|fax|contact[\s_-]?(?:number|no)|telegram)/i.test(label)) return values.phone;
    if (field.tag === "textarea") return values.message;
    if (field.type === "url" || /(website|web[\s_-]?site|homepage|网址|网站)/i.test(label)) return senderDomain ? `https://${senderDomain}` : "";
    if (field.type === "number" || /(quantity|amount|count|数量)/i.test(label)) return "1";
    if (field.type === "date") return new Date().toISOString().slice(0, 10);
    if (field.type === "time") return "09:00";
    if (/(job[\s_-]?title|position|role|profession|职位|职务)/i.test(label)) return "Business Development";
    if (/(department|division|部门)/i.test(label)) return "Sales";
    if (/(postal|zip|postcode|state|province|region|邮编|省份)/i.test(label)) return values.address || values.city || values.country;
    if (/(product|service|model|item|reason|request|需求|产品|服务)/i.test(label)) return values.subject;
    return values.subject || values.company || values.name;
  };

  for (const field of form.fields) {
    if (page.isClosed()) return { ok: false, code: "target_closed", message: "页面由于重定向或超时已关闭" };
    const selector = `[data-growthos-field="${form.formIndex}-${field.index}"]`;
    if (field.type === "file") {
      if (field.required) return { ok: false, code: "file_required", message: "联系表单要求上传文件，已跳过" };
      continue;
    }
    if (field.type === "checkbox" || field.type === "radio") {
      if (field.required && /(privacy|terms|agree|consent|政策|条款|同意)/i.test(field.label)) await safeClick(page, selector);
      else if (field.required) return { ok: false, code: "unsupported_required_field", message: `无法安全选择必填选项：${field.label}` };
      continue;
    }
    if (field.tag === "select") {
      if (!field.required) continue;
      const options = (field.options || []).filter((option) => (
        option.value.trim()
        && !option.disabled
        && !option.placeholder
      ));
      if (!options.length) {
        return { ok: false, code: "select_option_not_found", message: `必填下拉框没有可用选项：${field.label}` };
      }
      const option = options[Math.floor(Math.random() * options.length)];
      try {
        await page.select(selector, option.value);
      } catch {}
      if (report) {
        await report(
          "selecting_required_option",
          84,
          `必填下拉框“${field.label || "未命名字段"}”已自动选择“${option.label}”`,
          page.url(),
        );
      }
      continue;
    }

    // Skip captcha field here, as it will be filled in the captcha loop
    const isCaptchaField = /(captcha|code|verify|valicode|authcode|验证码|驗證碼)/i.test(field.label);
    if (isCaptchaField) continue;

    const value = field.kind === "unknown" ? inferRequiredValue(field) : values[field.kind];
    if (!value && field.required) return { ok: false, code: "missing_profile_value", message: `缺少必填资料：${field.label || field.kind}` };
    if (!value) continue;
    if (field.required && field.kind === "unknown" && report) {
      await report("inferring_required_field", 83, `必填字段“${field.label || field.type}”已根据字段语义自动填写`, page.url());
    }
    try {
      await safeEvaluate(page, (targetSelector: string, val: string) => {
        const element = document.querySelector(targetSelector) as HTMLInputElement | HTMLTextAreaElement | null;
        if (element) {
          element.value = val;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, selector, value);
    } catch {}
  }

  // ─── 验证码识别与重试逻辑 (最多重试 3 次) ───
  const submitSelector = `[data-growthos-submit="${form.formIndex}"]`;
  const hasSubmitBtn = await safeEvaluate(page, (sel: string) => Boolean(document.querySelector(sel)), submitSelector);
  if (!hasSubmitBtn) return { ok: false, code: "submit_not_found", message: "未找到可用的提交按钮" };

  // 检查是否包含第三方复杂验证码 (Cloudflare Turnstile, reCAPTCHA, hCaptcha)
  const isComplexCaptcha = await safeEvaluate(page, () => {
    const text = document.body ? document.body.innerText : "";
    if (/(g-recaptcha|h-captcha|hcaptcha|turnstile|geetest|cf-turnstile)/i.test(text)) return true;
    const iframes = Array.from(document.querySelectorAll("iframe"));
    return iframes.some((iframe) => /(recaptcha|hcaptcha|turnstile|geetest|cf-turnstile)/i.test(iframe.getAttribute("src") || ""));
  });
  if (isComplexCaptcha) {
    return { ok: false, code: "captcha_detected", message: "检测到 Cloudflare Turnstile 或 reCAPTCHA 人机验证，已按规则跳过" };
  }

  const hasCaptcha=await safeEvaluate<boolean>(page,()=>Boolean(document.querySelector('input[name*="captcha" i],input[name*="verify" i],input[name*="valicode" i],img[src*="captcha" i],.g-recaptcha,.h-captcha,.cf-turnstile')));
  if(hasCaptcha)return {ok:false,code:'captcha_detected',message:'页面需要验证码，请人工处理。'};
  {
    const beforeUrl = page.isClosed() ? "" : page.url();
    await safeClick(page, submitSelector);

    try {
      if (!page.isClosed()) {
        await Promise.race([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => null),
          new Promise((resolve) => setTimeout(resolve, 3500)),
        ]);
      }
    } catch {}

    const afterUrl = page.isClosed() ? "" : page.url();
    const resultText = (await safeEvaluate<string>(page, () => document.body?.innerText?.slice(0, 15000) || "")) || "";

    const isSuccessUrl = /(success|thank|thanks|sent|complete|done)/i.test(afterUrl) && !/contact-us\.html/i.test(afterUrl);
    const hasSuccessText = /(thank you|thanks for|successfully|message (has been )?sent|letter (has been )?sent|inquiry (has been )?sent|mail (has been )?sent|request (has been )?sent|your message.*sent|we.{0,30}(received|contact|reply)|感谢|谢谢|提交成功|发送成功|已收到|成功送信|已成功提交)/i.test(resultText);
    const hasSuccessModal = await safeEvaluate<boolean>(page, () => {
      const selectors = [
        '.swal2-success', '.alert-success', '.toast-success', '.msg-success', '.form-success',
        '#success', '.success-message', '.sent-success', '.w-form-done', '.wpcf7-mail-sent-ok',
        'img[src*="success" i]', 'svg.check', 'i.fa-check', '.icon-check'
      ];
      return Boolean(document.querySelector(selectors.join(', ')));
    });

    if (hasSuccessText || isSuccessUrl || hasSuccessModal) {
      return { ok: true, code: "confirmed", message: "表单已成功提交：网站已确认收到留言" };
    }

    const validationErrorMsg = await safeEvaluate<string>(page, () => {
      const errorEls = Array.from(document.querySelectorAll(
        '.error-message, .field-validation-error, .invalid-feedback, label.error, span.error, div.error, .alert-danger, .wpcf7-not-valid-tip'
      )) as HTMLElement[];
      for (const el of errorEls) {
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
          const text = el.textContent?.trim();
          if (text && text.length > 3 && text.length < 200) {
            return text;
          }
        }
      }
      return "";
    });

    if (validationErrorMsg && !page.isClosed() && page.url() === beforeUrl) {
      return { ok: false, code: "validation_failed", message: `未提交表单：网站返回表单校验错误 "${validationErrorMsg}"` };
    }

    return { ok: true, code: "submitted_unconfirmed", message: "表单已点击提交，但网站未返回明确的成功确认信息" };
  }

  return { ok: true, code: "submitted_unconfirmed", message: "表单已点击提交" };
}

export function isNoContactTarget(target: { status?: string; resultCode?: string | null; resultMessage?: string | null }) {
  if (!target || !target.status) return false;
  if (["submitted", "queued", "discovering", "submitting", "draft"].includes(target.status)) return false;

  const code = target.resultCode || "";
  const msg = target.resultMessage || "";

  if (["contact_page_not_found", "contact_form_not_found", "no_contact_form"].includes(code)) return true;
  if (/(无联系页面|未找到.*联系|未识别到.*表单|缺少输入框)/i.test(msg)) return true;

  return false;
}

export function isInaccessibleTarget(target: { status?: string; resultCode?: string | null; resultMessage?: string | null }) {
  if (!target || !target.status) return false;
  if (["submitted", "queued", "discovering", "submitting", "draft"].includes(target.status)) return false;

  const code = target.resultCode || "";
  const msg = target.resultMessage || "";

  const codes = [
    "navigation_failed",
    "http_fetch_error",
    "invalid_url",
    "http_server_error",
    "http_engine_parsed",
    "dns_error",
    "connection_refused",
    "ssl_error",
    "http_timeout",
    "http_502",
    "http_500",
    "http_404",
    "http_403",
  ];

  if (codes.includes(code) || code.startsWith("http_")) return true;
  if (/(无法访问|DNS|超时|拒绝连接|502|500|404|403|SSL|公网 HTTP|静态解析)/i.test(msg)) return true;

  return false;
}

export function isAbnormalTarget(target: { status?: string; resultCode?: string | null; resultMessage?: string | null }) {
  return isNoContactTarget(target) || isInaccessibleTarget(target);
}

async function updateJobProgress(db: ReturnType<typeof createDb>, jobId: string) {
  const [job] = await db.select({ status: siteMessageJobs.status }).from(siteMessageJobs).where(eq(siteMessageJobs.id, jobId));
  if (!job) return;
  const targets = await db.select({ status: siteMessageTargets.status, resultCode: siteMessageTargets.resultCode, resultMessage: siteMessageTargets.resultMessage }).from(siteMessageTargets).where(eq(siteMessageTargets.jobId, jobId));
  const active = targets.some((target) => ["queued", "discovering", "submitting"].includes(target.status));
  let submitted = 0;
  let skipped = 0;
  let failed = 0;
  let noContact = 0;
  let inaccessible = 0;

  for (const t of targets) {
    if (t.status === "submitted") {
      submitted++;
    } else if (isNoContactTarget(t)) {
      noContact++;
    } else if (isInaccessibleTarget(t)) {
      inaccessible++;
    } else if (t.status === "failed" || t.status === "skipped") {
      failed++;
    }
  }

  const abnormal = noContact + inaccessible;

  await db.update(siteMessageJobs).set({
    status: job.status === "paused" ? "paused" : active ? "running" : "completed",
    totalSubmitted: submitted,
    totalSkipped: 0,
    totalFailed: failed,
    totalAbnormal: abnormal,
    totalNoContact: noContact,
    totalInaccessible: inaccessible,
    completedAt: job.status === "paused" || active ? null : new Date(),
    updatedAt: new Date(),
  }).where(eq(siteMessageJobs.id, jobId));
}

async function isJobPaused(db: ReturnType<typeof createDb>, jobId: string) {
  const [job] = await db.select({ status: siteMessageJobs.status }).from(siteMessageJobs).where(eq(siteMessageJobs.id, jobId));
  return job?.status === "paused";
}

async function holdTargetForPause(db: ReturnType<typeof createDb>, jobId: string, targetId: string, report: ReturnType<typeof createProgressReporter>) {
  if (!(await isJobPaused(db, jobId))) return false;
  await report("paused", 0, "任务已暂停，当前网站保留到继续执行时处理");
  await db.update(siteMessageTargets).set({
    status: "queued",
    resultCode: "paused",
    resultMessage: "任务已暂停，等待继续执行",
    progressStage: "paused",
    progressPercent: 0,
    completedAt: null,
    updatedAt: new Date(),
  }).where(eq(siteMessageTargets.id, targetId));
  return true;
}

function createProgressReporter(db: ReturnType<typeof createDb>, targetId: string, initialLogs: ProgressLog[] = []) {
  const logs: ProgressLog[] = [...initialLogs];
  return async (stage: string, percent: number, message: string, url?: string) => {
    logs.push({ at: new Date().toISOString(), stage, percent, message, ...(url ? { url } : {}) });
    await db.update(siteMessageTargets).set({
      progressStage: stage,
      progressPercent: percent,
      progressLogs: JSON.stringify(logs),
      updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, targetId));
  };
}

// ─── Process a single target using an existing browser page (no browser launch/close) ───

async function processTargetInPage(
  page: any,
  target: any,
  job: any,
  db: ReturnType<typeof createDb>,
  jobId: string,
): Promise<"completed" | "paused"> {
  let previousLogs: ProgressLog[] = [];
  try {
    const parsed = JSON.parse(target.progressLogs || "[]");
    if (Array.isArray(parsed)) previousLogs = parsed;
  } catch {
    previousLogs = [];
  }
  const report = createProgressReporter(db, target.id, previousLogs);

  await db.update(siteMessageTargets).set({
    status: "discovering",
    startedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(siteMessageTargets.id, target.id));

  if (!isPublicHttpUrl(target.websiteUrl)) {
    await report("skipped", 100, "未提交表单：目标网址不是允许访问的公网 HTTP/HTTPS 地址");
    await db.update(siteMessageTargets).set({
      status: "skipped", resultCode: "invalid_url",
      resultMessage: "未提交表单：目标网址不是允许访问的公网 HTTP/HTTPS 地址",
      completedAt: new Date(), updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));
    return "completed";
  }

  await report("opening_homepage", 10, "正在访问目标网站", target.websiteUrl);
  let homepageResponse: any = null;
  try {
    homepageResponse = await page.goto(target.websiteUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  } catch (gotoErr: any) {
    if (isBrowserDisconnectedError(gotoErr)) throw gotoErr;
    const errMsg = gotoErr?.message || String(gotoErr);
    let detailedErr = "网站无法访问";
    if (/timeout/i.test(errMsg)) detailedErr = "网站无法访问，HTTP 访问超时 (20秒)";
    else if (/net::ERR_NAME_NOT_RESOLVED/i.test(errMsg)) detailedErr = "网站无法访问，域名 DNS 解析失败 (目标网站不存在或域名已过期)";
    else if (/net::ERR_CONNECTION_REFUSED/i.test(errMsg)) detailedErr = "网站无法访问，服务器拒绝连接";
    else if (/net::ERR_SSL/i.test(errMsg)) detailedErr = "网站无法访问，SSL 证书握手失败";
    else detailedErr = `网站无法访问，网络连接失败 (${errMsg})`;

    const failMsg = `未提交表单：${detailedErr}`;
    await report("failed", 100, failMsg, target.websiteUrl);
    await db.update(siteMessageTargets).set({
      status: "failed", resultCode: "navigation_failed",
      resultMessage: failMsg,
      completedAt: new Date(), updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));
    return "completed";
  }

  if (homepageResponse && homepageResponse.status() >= 400) {
    const status = homepageResponse.status();
    let detailedErr = `网站无法正常访问，服务器返回 HTTP ${status} 错误`;
    if (status === 502) detailedErr = "网站无法正常运作，服务器返回 HTTP 502 Bad Gateway 错误";
    else if (status === 500) detailedErr = "网站无法正常运作，服务器返回 HTTP 500 Internal Server Error";
    else if (status === 404) detailedErr = "网站无法访问，目标页面不存在 (HTTP 404)";
    else if (status === 403) detailedErr = "网站无法访问，服务器拒绝访问 (HTTP 403 Forbidden)";

    const failMsg = `未提交表单：${detailedErr}`;
    await report("failed", 100, failMsg, target.websiteUrl);
    await db.update(siteMessageTargets).set({
      status: "failed", resultCode: `http_${status}`,
      resultMessage: failMsg,
      completedAt: new Date(), updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));
    return "completed";
  }

  const bodyErrText = (await safeEvaluate<string>(page, () => document.body?.innerText?.slice(0, 1000) || "")) || "";
  if (/(HTTP ERROR 502|502 Bad Gateway|该网页无法正常运作|504 Gateway Time-out|503 Service Temporarily Unavailable)/i.test(bodyErrText)) {
    let detailedErr = "网站无法正常运作，服务器返回 502/503/504 异常响应";
    if (/502/i.test(bodyErrText)) detailedErr = "网站无法正常运作，服务器返回 HTTP 502 错误";
    const failMsg = `未提交表单：${detailedErr}`;
    await report("failed", 100, failMsg, target.websiteUrl);
    await db.update(siteMessageTargets).set({
      status: "failed", resultCode: "http_server_error",
      resultMessage: failMsg,
      completedAt: new Date(), updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));
    return "completed";
  }

  await report("discovering_contact_page", 30, "正在分析导航、页脚和常用联系页路径", page.url());
  const contactPageUrl = await findContactPage(page, target.websiteUrl, report);

  if (await holdTargetForPause(db, jobId, target.id, report)) return "paused";

  if (!contactPageUrl) {
    const notFoundReason = "未提交表单：未找到包含可用联系表单的页面 (已遍历首页 DOM 导航、页脚及常规联系路径如 /contact, /message.shtml, /inquiry 等)";
    await report("skipped", 100, notFoundReason);
    await db.update(siteMessageTargets).set({
      status: "skipped", resultCode: "contact_page_not_found",
      resultMessage: notFoundReason,
      completedAt: new Date(), updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));
    return "completed";
  }

  if (page.url() !== contactPageUrl) {
    try {
      await page.goto(contactPageUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    } catch (gotoErr: any) {
      if (isBrowserDisconnectedError(gotoErr)) throw gotoErr;
      console.warn("page.goto contact page warning:", gotoErr?.message || String(gotoErr));
    }
  }

  await report("safety_check", 55, "正在检查复杂人机验证和受保护字段", contactPageUrl);
  if (await detectComplexCaptcha(page)) {
    const captchaReason = "未提交表单：检测到 Cloudflare Turnstile 或 reCAPTCHA 人机验证，已按规则跳过";
    await report("skipped", 100, captchaReason, contactPageUrl);
    await db.update(siteMessageTargets).set({
      contactPageUrl, status: "skipped", resultCode: "captcha_detected",
      resultMessage: captchaReason,
      completedAt: new Date(), updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));
    return "completed";
  }

  await report("analyzing_form", 65, "正在识别联系表单字段和提交控件", contactPageUrl);
  const form = await inspectContactForm(page);
  if (!form) {
    const noFormReason = `未提交表单：联系页面已打开 (${contactPageUrl})，但未识别到可在线提交的联系表单 (缺少输入框/文本域/提交按钮)`;
    await report("skipped", 100, noFormReason, contactPageUrl);
    await db.update(siteMessageTargets).set({
      contactPageUrl, status: "skipped", resultCode: "contact_form_not_found",
      resultMessage: noFormReason,
      completedAt: new Date(), updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));
    return "completed";
  }

  await report("filling_form", 78, `已识别 ${form.fields.length} 个字段，正在填写联系资料`, contactPageUrl);
  if (await holdTargetForPause(db, jobId, target.id, report)) return "paused";

  await db.update(siteMessageTargets).set({
    contactPageUrl, status: "submitting",
    detectedFields: JSON.stringify(form.fields), updatedAt: new Date(),
  }).where(eq(siteMessageTargets.id, target.id));

  await report("submitting", 90, "字段校验完成，正在提交联系表单", contactPageUrl);
  const result = await fillAndSubmit(page, form, job, report);

  await report(result.ok ? "submitted" : "skipped", 100, result.message, contactPageUrl);
  await db.update(siteMessageTargets).set({
    status: result.ok ? "submitted" : "skipped",
    resultCode: result.code,
    resultMessage: result.message,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(siteMessageTargets.id, target.id));
  return "completed";
}

// ─── Job runner: processes 1 target per invocation, cleanly closing browser ───

async function acquireBrowserInstance(env: Bindings, report: ReturnType<typeof createProgressReporter>, forceFresh = false) {
  // 2. Launch a fresh browser instance with short keep_alive
  await report("launching_browser", 5, "正在准备并启动隔离浏览器实例");
  try {
    return await puppeteer.launch(env.BROWSER, { keep_alive: 10000 });
  } catch (error: any) {
    if (isBrowserRateLimitError(error)) {
      await report("rate_limited", 5, "浏览器服务繁忙 (Rate limit)，将在 20 秒后自动重试");
      throw new BrowserRateLimitError(error?.message || "浏览器服务繁忙");
    }
    throw error;
  }
}

async function processTargetViaFetch(
  target: typeof siteMessageTargets.$inferSelect,
  job: typeof siteMessageJobs.$inferSelect,
  db: ReturnType<typeof createDb>,
  jobId: string,
) {
  let previousLogs: ProgressLog[] = [];
  try {
    const parsed = JSON.parse(target.progressLogs || "[]");
    if (Array.isArray(parsed)) previousLogs = parsed;
  } catch {
    previousLogs = [];
  }
  const report = createProgressReporter(db, target.id, previousLogs);

  await report("http_fallback", 10, "已无缝切入 Cloudflare 高能 HTTP 快速分析引擎");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
    };

    await report("fetching_homepage", 25, "正在检索目标网站主页结构", target.websiteUrl);
    const res = await fetch(target.websiteUrl, { headers, signal: controller.signal, redirect: "follow" });
    const html = await res.text();
    const finalUrl = res.url || target.websiteUrl;

    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);

    const linkMatches = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi));
    let contactPageUrl: string | null = null;
    for (const match of linkMatches) {
      const href = match[1];
      const linkText = (match[2] || "").replace(/<[^>]+>/g, " ").trim();
      const searchable = `${linkText} ${href}`;
      if (CONTACT_LINK_PATTERN.test(searchable)) {
        try {
          contactPageUrl = new URL(href, finalUrl).toString();
          break;
        } catch {}
      }
    }

    if (!contactPageUrl) {
      const rawHrefMatches = Array.from(html.matchAll(/href=["']([^"']+)["']/gi));
      for (const match of rawHrefMatches) {
        const href = match[1];
        if (CONTACT_LINK_PATTERN.test(href)) {
          try {
            contactPageUrl = new URL(href, finalUrl).toString();
            break;
          } catch {}
        }
      }
    }

    if (contactPageUrl && contactPageUrl !== finalUrl) {
      await report("fetching_contact_page", 60, `已定位并同步解析联系页面: ${contactPageUrl}`, contactPageUrl);
      const contactRes = await fetch(contactPageUrl, { headers, signal: controller.signal, redirect: "follow" });
      const contactHtml = await contactRes.text();

      const contactEmailMatch = contactHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i) || emailMatch;

      const messageText = contactEmailMatch
        ? `未提交表单 (浏览器引擎受限切入 HTTP 引擎，已提取官方邮箱: ${contactEmailMatch[0]})`
        : `未提交表单 (HTTP 引擎已解析联系页面 ${contactPageUrl}，未能进行表单交互提交)`;

      await report("completed", 100, messageText, contactPageUrl);

      await db.update(siteMessageTargets).set({
        status: "skipped",
        resultCode: contactEmailMatch ? "email_extracted" : "http_engine_parsed",
        resultMessage: messageText,
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(siteMessageTargets.id, target.id));
      return;
    }

    const homepageMsg = emailMatch
      ? `未提交表单 (HTTP 引擎成功提取主页官方邮箱: ${emailMatch[0]})`
      : "未提交表单 (HTTP 引擎完成全页解析，未包含可提交的在线表单)";

    await report("completed", 100, homepageMsg, finalUrl);
    await db.update(siteMessageTargets).set({
      status: "skipped",
      resultCode: emailMatch ? "email_extracted" : "no_contact_form",
      resultMessage: homepageMsg,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));

  } catch (err: any) {
    let errorMsg = "未提交表单：网站无法访问";
    if (err?.name === "AbortError") {
      errorMsg = "未提交表单：网站无法访问，HTTP 访问超时 (12秒)";
    } else if (err?.message) {
      errorMsg = `未提交表单：网站无法访问 (${err.message})`;
    } else {
      errorMsg = "未提交表单：网站无法访问，HTTP 协议解析失败";
    }
    await report("failed", 100, errorMsg);
    await db.update(siteMessageTargets).set({
      status: "failed",
      resultCode: "http_fetch_error",
      resultMessage: errorMsg,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(siteMessageTargets.id, target.id));
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runSiteMessageJob(jobId: string, env: Bindings) {
  const db = createDb(env.DB);
  const [job] = await db.select().from(siteMessageJobs).where(eq(siteMessageJobs.id, jobId));
  if (!job || !["queued", "running"].includes(job.status)) return;

  // Reset orphaned targets that were left stuck in discovering/submitting from previous crashed invocations
  try {
    const thresholdDate = new Date(Date.now() - 5 * 60 * 1000);
    // A crash after clicking Submit has an unknown outcome: never auto-resubmit it.
    await db.update(siteMessageTargets).set({ status: "skipped", resultCode: "submission_uncertain", resultMessage: "上次提交结果无法确认，请人工核实后再决定是否重试", completedAt: new Date(), updatedAt: new Date() }).where(and(eq(siteMessageTargets.jobId, jobId), eq(siteMessageTargets.status, "submitting"), sql`updated_at < ${Math.floor(thresholdDate.getTime() / 1000)}`));
    await db
      .update(siteMessageTargets)
      .set({ status: "queued", progressStage: "queued", updatedAt: new Date() })
      .where(
        and(
          eq(siteMessageTargets.jobId, jobId),
          eq(siteMessageTargets.status, "discovering"),
          sql`updated_at < ${Math.floor(thresholdDate.getTime() / 1000)}`
        )
      );
  } catch (resetErr) {
    console.warn("Failed to reset orphaned targets:", resetErr);
  }

  const targets = await db
    .select()
    .from(siteMessageTargets)
    .where(and(eq(siteMessageTargets.jobId, jobId), eq(siteMessageTargets.status, "queued")))
    .orderBy(siteMessageTargets.position, siteMessageTargets.createdAt)
    .limit(4);

  if (!targets.length) {
    await updateJobProgress(db, jobId);
    return;
  }

  let browser: any;
  let useHttpFallback = false;

  try {
    for (let index = 0; index < targets.length; index++) {
      const target = targets[index];

      if (useHttpFallback) {
        await processTargetViaFetch(target, job, db, jobId);
        continue;
      }

      let previousLogs: ProgressLog[] = [];
      try {
        const parsed = JSON.parse(target.progressLogs || "[]");
        if (Array.isArray(parsed)) previousLogs = parsed;
      } catch {
        previousLogs = [];
      }
      const report = createProgressReporter(db, target.id, previousLogs);

      let page: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (!browser) {
            browser = await acquireBrowserInstance(env, report, attempt > 0);
          }

          page = await browser.newPage();
          await page.setUserAgent("Mozilla/5.0 (compatible; GrowthOSContactAssistant/1.0; +https://edm.codeisworld.workers.dev)");
          await page.setViewport({ width: 1365, height: 900 });
          await page.setRequestInterception(true);
          page.on('request',async(request:any)=>{
            try {await assertPublicReference(new URL(request.url()));await request.continue();}
            catch {await request.abort().catch(()=>{});}
          });

          const replyAddress = await trackedAddress(env.DB, 'site', target.id, job.message, job.subject || 'General inquiry');
          await processTargetInPage(page, target, replyAddress ? {...job, originalSenderEmail: job.senderEmail, senderEmail: replyAddress} : job, db, jobId);
          break;
        } catch (error: any) {
          const execErrorMsg = error?.message || "网页抓取与提交执行失败";
          console.warn(`Target ${target.websiteUrl} attempt ${attempt + 1} failed:`, execErrorMsg);

          if (page) {
            await page.close().catch(() => undefined);
            page = null;
          }

          if (isBrowserDisconnectedError(error)) {
            console.warn("Browser environment disconnected/closed, resetting browser instance");
            if (browser) {
              await browser.close().catch(() => undefined);
              browser = null;
            }
            if (attempt === 0) {
              await report("retrying_fresh_browser", 15, "检测到浏览器环境异常，正在使用独立新实例重试");
              continue;
            }
          }

          // If retry failed or non-disconnect error, run HTTP fallback engine for this target
          console.warn("Switching target to HTTP Fallback due to error:", execErrorMsg);
          try {
            await processTargetViaFetch(target, job, db, jobId);
          } catch (httpErr: any) {
            const currentAttempts = Number(target.attempts || 0);
            const newAttempts = currentAttempts + 1;
            const isTooManyFailures = newAttempts >= 2;
            const finalStatus = isTooManyFailures ? "skipped" : "failed";
            const finalCode = isTooManyFailures ? "max_attempts_exceeded" : "execution_error";
            const finalMsg = isTooManyFailures ? `未提交表单：失败已达 ${newAttempts} 次，按规则跳过 (${execErrorMsg})` : `未提交表单：执行异常 (${execErrorMsg})`;

            await report(finalStatus, 100, finalMsg);
            await db.update(siteMessageTargets).set({
              status: finalStatus,
              attempts: newAttempts,
              resultCode: finalCode,
              resultMessage: finalMsg,
              progressStage: finalStatus,
              progressPercent: 100,
              completedAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(siteMessageTargets.id, target.id));
          }
          break;
        } finally {
          if (page) {
            await page.close().catch(() => undefined);
            page = null;
          }
        }
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await updateJobProgress(db, jobId);
  }

  // If job is still active and more targets remain queued, chain next target batch with cool-down delay
  const [latestJob] = await db.select({ status: siteMessageJobs.status }).from(siteMessageJobs).where(eq(siteMessageJobs.id, jobId));
  if (!latestJob || latestJob.status === "paused") return;

  const [nextTarget] = await db
    .select({ id: siteMessageTargets.id })
    .from(siteMessageTargets)
    .where(and(eq(siteMessageTargets.jobId, jobId), eq(siteMessageTargets.status, "queued")))
    .limit(1);

  if (nextTarget) {
    try {
      await env.SITE_MESSAGE_QUEUE.send(
        { kind: "site-message-runner", jobId },
        { delaySeconds: 10 },
      );
    } catch (queueErr) {
      console.error("Queue send error for next target batch", queueErr);
    }
  }
}

async function processJobRunner(message: Extract<SiteMessageQueueMessage, { kind: "site-message-runner" }>, env: Bindings, queueAttempt: number) {
  await runSiteMessageJob(message.jobId, env);
}

export async function handleSiteMessageQueue(batch: MessageBatch<SiteMessageQueueMessage>, env: Bindings) {
  for (const message of batch.messages) {
    try {
      if (message.body.kind === "site-message-runner") {
        await processJobRunner(message.body, env, message.attempts || 1);
      } else {
        console.info("Discarding legacy site-message queue item", message.body.targetId);
      }
      message.ack();
    } catch (error: any) {
      console.error("Site message queue failed", error);
      const delaySeconds = isBrowserRateLimitError(error)
        ? Math.min(60, Math.ceil(5 * (1.5 ** Math.max(0, (message.attempts || 1) - 1))))
        : 30;
      message.retry({ delaySeconds });
    }
  }
}
