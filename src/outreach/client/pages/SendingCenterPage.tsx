import { Icon } from "../../../client/components";
/** @jsxImportSource react */
import React, { useEffect, useMemo, useState } from "react";
import { campaignsApi, contactsApi, providersApi, templatesApi } from "../lib/api";
import { useToast } from "../App";
import { TemplatesPage } from "./TemplatesPage";
import { EmailPreview } from "../components/EmailPreview";
import { CampaignProgress } from "../components/CampaignProgress";
import { blockedEmailMessage, findBlockedEmailTerms } from "../../shared/email-content-policy";

const steps = ["选择收件人", "选择邮件", "确认发送"];

const defaultTaskName = () => {
  const now = new Date();
  return `邮件发送 ${now.toLocaleDateString("zh-CN")} ${now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
};
type AudienceMethod = "group" | "tag" | "contact";

export function SendingCenterPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { addToast } = useToast();
  const [step, setStep] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [defaultGroupCount, setDefaultGroupCount] = useState(0);
  const [tags, setTags] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [verifiedSenderDomains, setVerifiedSenderDomains] = useState<string[]>([]);
  const [senderDomainLoading,setSenderDomainLoading]=useState(true);
  const [senderDomainError,setSenderDomainError]=useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedContactRecords, setSelectedContactRecords] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [audienceMethod, setAudienceMethod] = useState<AudienceMethod>("group");
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [submissionStage, setSubmissionStage] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [sendProgress, setSendProgress] = useState<any>(null);
  const [progressError, setProgressError] = useState("");

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    let timer: number;
    const refresh = async () => {
      let keepPolling = true;
      try {
        if (!document.hidden) {
          const response = await campaignsApi.get(campaignId);
          if (!active) return;
          setSendProgress(response.data);
          setProgressError("");
          keepPolling = sending || response.data?.status === "sending";
        }
      } catch {
        if (active) setProgressError("进度暂时无法更新，任务可能仍在后台执行，请勿重复发送。");
      }
      if (active && keepPolling) timer = window.setTimeout(refresh, 15000);
    };
    refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, [campaignId, sending]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: defaultTaskName(),
    templateId: "",
    senderEmail: "",
    senderName: "wuyueer",
    replyTo: "",
    sendRate: 50,
    replyTracking: true,
  });

  const refreshSenderDomains = async (active:()=>boolean=()=>true) => {
    setSenderDomainLoading(true);setSenderDomainError('');
    try {
      const result=await providersApi.senderDomains();if(!active())return;
      const domains=Array.from(new Set(result.data.map(d=>d.domain)));
      setVerifiedSenderDomains(domains);
      setSenderDomainError(result.errors.map(e=>`${e.providerName}：${e.message}`).join('；'));
      setForm(current=>current.senderEmail||!domains.length?current:{...current,senderEmail:`sales@${domains[0]}`,replyTo:current.replyTo||`sales@${domains[0]}`});
    }catch(error:any){if(active()){setVerifiedSenderDomains([]);setSenderDomainError(error.message||'无法读取发信域名，请重试');}}
    finally{if(active())setSenderDomainLoading(false);}
  };
  const changeSenderDomain = (domain:string) => {
    if(!domain)return;
    setForm(current=>{
      const local=current.senderEmail.split('@')[0].trim()||'sales';const email=`${local}@${domain}`;
      return {...current,senderEmail:email,replyTo:!current.replyTo||current.replyTo===current.senderEmail?email:current.replyTo};
    });
  };

  useEffect(() => {
    let active = true;
    const reportError = (error: any) => { if (active) addToast("error", error.message); };
    contactsApi.listGroups().then((groupRes) => {
      if (!active) return;
      setGroups(groupRes.data || []);
      setDefaultGroupCount(Number(groupRes.meta?.defaultContactCount || 0));
    }).catch(reportError);
    contactsApi.listTags().then((tagRes) => {
      if (!active) return;
      setTags(tagRes.data || []);
    }).catch(reportError);
    templatesApi.listAll().then((allTemplates) => {
      if (!active) return;
      const isBuiltIn = (t: any) =>
        t.isBuiltIn ||
        t.bodyHtml?.includes("data-growthos-template='en-v2'") ||
        t.bodyHtml?.includes("data-growthos-template='en-v3'");
      const sorted = [...(allTemplates || [])].sort((a, b) => {
        const aMine = !isBuiltIn(a) || a.category === "My templates";
        const bMine = !isBuiltIn(b) || b.category === "My templates";
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;
        return 0;
      });
      setTemplates(sorted);
    }).catch(reportError);
    void refreshSenderDomains(()=>active);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (audienceMethod !== "contact" || contactSearch.trim().length < 2) {
      setContacts([]);
      setContactSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setContactSearchLoading(true);
      try {
        const response = await contactsApi.list({
          search: contactSearch.trim(),
          subscriptionStatus: "subscribed",
          pageSize: "20",
        });
        if (!controller.signal.aborted) setContacts(response.data || []);
      } catch (error: any) {
        if (!controller.signal.aborted) addToast("error", error.message);
      } finally {
        if (!controller.signal.aborted) setContactSearchLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [audienceMethod, contactSearch]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === form.templateId),
    [templates, form.templateId]
  );
  const audienceSelectionLabel = audienceMethod === "group"
    ? `${selectedGroups.length} 个分组`
    : audienceMethod === "tag"
      ? `${selectedTags.length} 个标签`
      : `${selectedContacts.length} 位联系人`;
  const estimatedRecipientCount = audienceMethod === "group"
    ? selectedGroups.reduce((total, id) => total + (id === "null" ? defaultGroupCount : Number(groups.find((group) => group.id === id)?.contactCount || 0)), 0)
    : audienceMethod === "tag"
      ? selectedTags.reduce((total, name) => total + Number(tags.find((tag) => tag.name === name)?.contactCount || 0), 0)
      : selectedContacts.length;

  const toggle = (list: string[], id: string, setter: (value: string[]) => void) => {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const toggleContact = (contact: any) => {
    if (selectedContacts.includes(contact.id)) {
      setSelectedContacts((current) => current.filter((id) => id !== contact.id));
      setSelectedContactRecords((current) => current.filter((item) => item.id !== contact.id));
      return;
    }
    setSelectedContacts((current) => [...current, contact.id]);
    setSelectedContactRecords((current) => [...current, contact]);
  };

  const changeAudienceMethod = (method: AudienceMethod) => {
    if (method === audienceMethod) return;
    setAudienceMethod(method);
    setSelectedGroups([]);
    setSelectedTags([]);
    setSelectedContacts([]);
    setSelectedContactRecords([]);
    setContactSearch("");
    setContacts([]);
  };

  const next = () => {
    const hasAudience = audienceMethod === "group"
      ? selectedGroups.length > 0
      : audienceMethod === "tag"
        ? selectedTags.length > 0
        : selectedContacts.length > 0;
    if (step === 0 && !hasAudience) {
      addToast("error", audienceMethod === "group" ? "请选择至少一个分组" : audienceMethod === "tag" ? "请选择至少一个标签" : "请添加至少一位联系人");
      return;
    }
    if (step === 1 && (!form.name.trim() || !form.templateId || !form.senderEmail || !form.senderName)) {
      addToast("error", "请填写活动名称、邮件模板和发件人信息");
      return;
    }
    if(step===1 && senderDomainLoading){addToast('error','正在读取已验证发信域名，请稍候');return;}
    if(step===1 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.senderEmail.trim())){addToast('error','请填写有效的发件人邮箱');return;}
    const senderDomain = form.senderEmail.trim().toLowerCase().split("@").pop() || "";
    if (step === 1 && !verifiedSenderDomains.includes(senderDomain)) {
      addToast("error", verifiedSenderDomains.length ? `发件人邮箱必须使用已验证域名：${verifiedSenderDomains.map((domain) => `@${domain}`).join("、")}` : "暂无可用的已验证发信域名，请检查帐号权限和域名验证状态后刷新");
      return;
    }
    if (step === 1 && selectedTemplate) {
      const blockedTerms = findBlockedEmailTerms(selectedTemplate.subject, selectedTemplate.bodyHtml, selectedTemplate.bodyText);
      if (blockedTerms.length) {
        addToast("error", blockedEmailMessage(blockedTerms));
        return;
      }
    }
    setStep((current) => Math.min(2, current + 1));
  };

  const send = async () => {
    if (sending || editingTemplate || campaignId) return;
    setSending(true);
    setSubmissionStage("正在校验邮件内容...");
    try {
      const latest = await templatesApi.get(form.templateId);
      const template = latest.data;
      if (!template) throw new Error("邮件模板不存在，请重新选择");
      setTemplates((current) => current.map((item) => item.id === template.id ? template : item));
      const blockedTerms = findBlockedEmailTerms(template.subject, template.bodyHtml, template.bodyText);
      if (blockedTerms.length) {
        setStep(1);
        throw new Error(blockedEmailMessage(blockedTerms));
      }
      setSubmissionStage("正在创建营销活动...");
      const campaign = await campaignsApi.create(form);
      setCampaignId(campaign.data.id);
      const selections = [
        ...selectedGroups.map((groupId) => ({ groupId })),
        ...selectedTags.map((tag) => ({ tag })),
        ...(selectedContacts.length ? [{ contactIds: selectedContacts }] : []),
      ];
      let prepared = 0;
      for (let index = 0; index < selections.length; index++) {
        setSubmissionStage(`正在准备收件人 ${index + 1}/${selections.length}，已添加 ${prepared} 人，尚未开始发送`);
        const result = await campaignsApi.addRecipients(campaign.data.id, selections[index]);
        prepared += Number(result.data?.added || 0);
      }
      setSubmissionStage(`已准备 ${prepared} 位收件人，正在提交发送队列...`);
      await campaignsApi.send(campaign.data.id);
      addToast("success", "邮件已加入发送队列");
      setSubmissionStage("任务已提交，正在后台发送");
    } catch (error: any) {
      const message = error.name === "TimeoutError"
        ? "准备收件人超过 60 秒，服务器可能仍在处理，请勿重复发送"
        : error.message;
      setSubmissionStage(`提交未完成：${message}。已创建的任务保留在营销活动中，请先检查状态。`);
      addToast("error", message);
    } finally {
      setSending(false);
    }
  };

  return <>
    <div className="page-header">
      <div className="page-header-actions">
        <div>
          <h2>发送中心</h2>
          <p>选择收件人和邮件内容，确认后即可发送</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => onNavigate?.("email-guide")}><Icon name="help" size={16}/>使用指南</button>
      </div>
    </div>
    <div className="page-body">
      <div className="card sending-center-card">
        <div className="sending-steps" aria-label="发送步骤">
          {steps.map((label, index) => <div key={label} className={`sending-step ${index <= step ? "is-active" : ""}`}>
            <span>{index + 1}</span>
            {label}
          </div>)}
        </div>

        {step === 0 && <div>
          <h3>发给谁？</h3>
          <p className="recipient-intro">选择下面任意一种收件人方式即可。</p>

          <div className="recipient-method-grid" role="radiogroup" aria-label="收件人选择方式">
            <button type="button" role="radio" aria-checked={audienceMethod === "group"} className={`recipient-method-card ${audienceMethod === "group" ? "is-selected" : ""}`} onClick={() => changeAudienceMethod("group")}><span className="recipient-method-icon"><Icon name="folder" size={18}/></span><span><strong>按分组选择</strong><small>适合按名单或业务范围批量发送</small></span><span className="recipient-method-radio"></span></button>
            <button type="button" role="radio" aria-checked={audienceMethod === "tag"} className={`recipient-method-card ${audienceMethod === "tag" ? "is-selected" : ""}`} onClick={() => changeAudienceMethod("tag")}><span className="recipient-method-icon"><Icon name="tag" size={18}/></span><span><strong>按标签选择</strong><small>跨分组选择相同特征的联系人</small></span><span className="recipient-method-radio"></span></button>
            <button type="button" role="radio" aria-checked={audienceMethod === "contact"} className={`recipient-method-card ${audienceMethod === "contact" ? "is-selected" : ""}`} onClick={() => changeAudienceMethod("contact")}><span className="recipient-method-icon"><Icon name="user" size={18}/></span><span><strong>单独选择联系人</strong><small>搜索并添加少量指定收件人</small></span><span className="recipient-method-radio"></span></button>
          </div>

          {audienceMethod === "group" && <section className="recipient-section recipient-method-panel">
            <div className="recipient-section-heading"><div><h4>选择一个或多个分组</h4><p>同一联系人出现在多个分组时会自动去重</p></div></div>
            <div className="recipient-group-grid">
              <button type="button" className={`recipient-group-card ${selectedGroups.includes("null") ? "is-selected" : ""}`} onClick={() => toggle(selectedGroups, "null", setSelectedGroups)}>
                <span className="recipient-group-icon"><Icon name="users" size={18}/></span><span className="recipient-group-copy"><strong>默认分组</strong><small>{defaultGroupCount} 位已订阅联系人</small></span><span className="recipient-group-check">✓</span>
              </button>
              {groups.map((group) => <button type="button" key={group.id} className={`recipient-group-card ${selectedGroups.includes(group.id) ? "is-selected" : ""}`} onClick={() => toggle(selectedGroups, group.id, setSelectedGroups)}>
                <span className="recipient-group-icon"><Icon name="folder" size={18}/></span><span className="recipient-group-copy"><strong>{group.name}</strong><small>{group.contactCount} 位联系人{group.description ? ` · ${group.description}` : ""}</small></span><span className="recipient-group-check">✓</span>
              </button>)}
            </div>
          </section>}

          {audienceMethod === "tag" && <section className="recipient-section recipient-method-panel">
            <div className="recipient-section-heading"><div><h4>选择一个或多个标签</h4><p>同一联系人具有多个所选标签时会自动去重</p></div></div>
            {tags.length ? <div className="recipient-options">
              {tags.map((tag) => <button type="button" key={tag.name} className={`recipient-option ${selectedTags.includes(tag.name) ? "is-selected" : ""}`} onClick={() => toggle(selectedTags, tag.name, setSelectedTags)}><span>#{tag.name}</span><small>{tag.contactCount} 位联系人</small></button>)}
            </div> : <p className="recipient-empty">暂无联系人标签，可在联系人页面编辑联系人时添加。</p>}
          </section>}

          {audienceMethod === "contact" && <section className="recipient-section recipient-individual-section recipient-method-panel">
            <div className="recipient-section-heading"><div><h4>搜索联系人</h4><p>输入邮箱地址，添加指定的已订阅联系人</p></div></div>
            <div className="recipient-search-panel">
              <input className="form-input" type="search" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="输入邮箱搜索，至少 2 个字符" />
              {selectedContactRecords.length > 0 && <div className="recipient-selected-contacts">{selectedContactRecords.map((contact) => <button type="button" key={contact.id} onClick={() => toggleContact(contact)}>{contact.email}<span>×</span></button>)}</div>}
              <div className="recipient-search-results">
                {contactSearchLoading ? <p>正在搜索...</p> : contactSearch.trim().length < 2 ? <p>搜索后最多显示 20 条匹配结果。</p> : contacts.length ? contacts.map((contact) => <button type="button" key={contact.id} className={selectedContacts.includes(contact.id) ? "is-selected" : ""} onClick={() => toggleContact(contact)}><span><strong>{contact.email}</strong>{contact.name && <small>{contact.name}{contact.company ? ` · ${contact.company}` : ""}</small>}</span><span>{selectedContacts.includes(contact.id) ? "已添加" : "添加"}</span></button>) : <p>没有找到匹配的已订阅联系人。</p>}
              </div>
            </div>
          </section>}

          {(selectedGroups.length > 0 || selectedTags.length > 0 || selectedContacts.length > 0) && <div className="recipient-summary"><strong>已选择</strong><span>{audienceSelectionLabel}</span><small>预计 {estimatedRecipientCount} 位联系人，重复联系人会自动去重</small></div>}
        </div>}

        {step === 1 && <div>
          <h3>选择邮件</h3>
          <div className="form-group"><label className="form-label">发送任务名称 *</label><input className="form-input" value={form.name} placeholder="例如：Q3 新客户开发" onChange={(e) => setForm({ ...form, name: e.target.value })} /><div className="form-help">已自动生成，仅用于在营销活动中识别本次发送。</div></div>
          <div className="form-group"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><label className="form-label">邮件模板 *</label><div className="flex gap-sm">{selectedTemplate && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingTemplate(selectedTemplate)}>编辑邮件</button>}<button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate?.("templates")}>新建模板</button></div></div><div className="sending-template-grid">
            <div style={{ position: "relative", minWidth: 0 }}><button type="button" className="form-select" style={{ width: "100%", textAlign: "left", background: "var(--color-bg-card)", cursor: "pointer" }} onClick={() => setTemplateOpen(!templateOpen)}>{selectedTemplate ? `${selectedTemplate.name} · ${selectedTemplate.subject}` : "请选择模板"}<span style={{ float: "right" }}>⌄</span></button>{templateOpen && <div style={{ position: "absolute", zIndex: 5, width: "100%", marginTop: 4, background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 6, boxShadow: "var(--shadow-lg)", maxHeight: 250, overflowY: "auto" }}>{templates.map((template) => <button type="button" key={template.id} onMouseEnter={() => setHoveredTemplateId(template.id)} onClick={() => { setForm({ ...form, templateId: template.id }); setTemplateOpen(false); setHoveredTemplateId(null); }} style={{ display: "block", width: "100%", padding: "10px 12px", textAlign: "left", border: 0, background: hoveredTemplateId === template.id ? "var(--color-accent-subtle)" : "transparent", color: "var(--color-text-primary)", cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong>{template.name}</strong><span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: template.isBuiltIn ? "var(--color-bg-subtle)" : "var(--color-accent-soft)", color: template.isBuiltIn ? "var(--color-text-muted)" : "var(--color-accent)" }}>{template.isBuiltIn ? "内置" : "我的"}</span></div><span style={{ display: "block", fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3 }}>{template.subject}</span></button>)}</div>}</div>
            <EmailPreview html={templates.find((template) => template.id === (templateOpen ? hoveredTemplateId || form.templateId : form.templateId))?.bodyHtml || "<p>请选择邮件模板</p>"} />
          </div></div>
          <section className="sender-section" aria-labelledby="sender-heading">
            <h4 id="sender-heading">发件人信息</h4>
            <div className="sender-fields">
              <div className="form-group">
                <label className="form-label" htmlFor="sender-domain">已验证发信域名 *</label>
                <div className="sender-domain-control">
                  <select id="sender-domain" className="form-select" disabled={senderDomainLoading||!verifiedSenderDomains.length} value={verifiedSenderDomains.includes(form.senderEmail.split('@').pop()?.toLowerCase()||'')?form.senderEmail.split('@').pop()?.toLowerCase():''} onChange={e=>changeSenderDomain(e.target.value)}>
                    <option value="">{senderDomainLoading?'正在读取域名…':verifiedSenderDomains.length?'请选择发信域名':'暂无已验证域名'}</option>
                    {verifiedSenderDomains.map(domain=><option key={domain} value={domain}>@{domain}</option>)}
                  </select>
                  <button className="btn btn-secondary" type="button" aria-label="刷新发信域名" disabled={senderDomainLoading} onClick={()=>void refreshSenderDomains()}>{senderDomainLoading?'读取中…':'刷新域名'}</button>
                </div>
                {senderDomainError&&<div className="form-help sender-domain-error" role="alert">{senderDomainError}</div>}
                {!senderDomainLoading&&!verifiedSenderDomains.length&&<div className="form-help">请在「发信域名」完成验证；Resend 读取域名需要 Full access API Key。</div>}
                {!!verifiedSenderDomains.length&&<div className="form-help form-help-success">已认证：{verifiedSenderDomains.map(domain=>`@${domain}`).join('、')}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sender-email">发件人邮箱 *</label>
                <input id="sender-email" className="form-input" type="email" value={form.senderEmail} onChange={e=>setForm({...form,senderEmail:e.target.value})} placeholder="name@yourdomain.com" />
                <div className="form-help">可修改 @ 前的邮箱名称，切换域名时会保留。</div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sender-name">发件人名称 *</label>
                <input id="sender-name" className="form-input" value={form.senderName} placeholder="Your Company" onChange={e=>setForm({...form,senderName:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="sender-reply">回复地址</label>
                <label><input type="checkbox" checked={form.replyTracking} onChange={e=>setForm({...form,replyTracking:e.target.checked})}/>自动追踪客户回复</label><p className="form-help">收信配置启用后使用独立回复地址；未启用时使用下面的固定回复地址。</p><input id="sender-reply" className="form-input" type="email" value={form.replyTo} placeholder="reply@yourdomain.com" onChange={e=>setForm({...form,replyTo:e.target.value})} />
              </div>
            </div>
          </section>
          <section className="sender-section sender-settings" aria-labelledby="sender-settings-heading">
            <h4 id="sender-settings-heading">发送设置</h4>
            <div className="sender-rate-row">
              <div className="form-group">
                <label className="form-label" htmlFor="sender-rate">发送速率（封/分钟）</label>
                <input aria-describedby="sender-rate-help" id="sender-rate" className="form-input" type="number" min="1" max="200" value={form.sendRate} onChange={e=>setForm({...form,sendRate:Number(e.target.value)||50})} />
                <p id="sender-rate-help" className="form-hint">Resend 等逐封发送通道按此上限排队；限流时自动延后。Mailchimp Marketing 由服务商调度。</p>
              </div>
              <p className="form-help">可设置 1–200 封/分钟，实际发送受服务商额度与限流影响。</p>
            </div>
          </section>
        </div>}

        {step === 2 && <div>
          <h3>确认发送</h3>
          <div className="sending-review">
            <dl><div><dt>发送任务</dt><dd>{form.name}</dd></div><div><dt>邮件主题</dt><dd>{selectedTemplate?.subject || "-"}</dd></div><div><dt>发件人</dt><dd>{form.senderName} &lt;{form.senderEmail}&gt;</dd></div><div><dt>收件人</dt><dd>{audienceSelectionLabel}，预计 {estimatedRecipientCount} 位</dd></div><div><dt>统计</dt><dd>统计取决于所选发信帐号的回调及域名追踪设置</dd></div></dl>
          </div>
          <p className="sending-review-note">确认后邮件会进入发送队列，发送结果和统计数据可在“营销活动”中查看。</p>
        </div>}

        <div className="sending-wizard-footer">
          {step > 0 && !campaignId && <button className="btn btn-secondary" type="button" disabled={sending} onClick={() => setStep((current) => current - 1)}>上一步</button>}
          {campaignId ? <button className="btn btn-secondary" type="button" onClick={() => onNavigate?.("campaigns")}>查看营销活动</button> : step < 2 ? <button className="btn btn-primary" type="button" disabled={sending} onClick={next}>下一步</button> : <button className="btn btn-primary" type="button" disabled={sending} onClick={send}>{sending ? "正在提交..." : "确认发送"}</button>}
        </div>
        {submissionStage && <section aria-live="polite" style={{ paddingTop: 16 }}>
          <strong>{!sending && sendProgress?.status === "completed" ? "发送处理已完成" : !sending && sendProgress?.status === "paused" ? "任务已暂停" : !sending && sendProgress?.status === "failed" ? "任务发送失败" : submissionStage}</strong>
          {sendProgress?.totalRecipients > 0 && <CampaignProgress campaign={sendProgress} />}
          {sending && !sendProgress?.totalRecipients && <p role="status">正在准备预计 {estimatedRecipientCount} 位收件人，完成后开始发送。</p>}
          {progressError && <p role="alert">{progressError}</p>}
        </section>}
      </div>
    </div>
    {editingTemplate && <TemplatesPage editTemplate={editingTemplate}
      onClose={() => setEditingTemplate(null)}
      onSaved={(saved) => setTemplates((current) => current.map((template) => template.id === saved.id ? saved : template))} />}
  </>;
}
