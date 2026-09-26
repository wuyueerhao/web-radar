/** @jsxImportSource react */
import React, { useEffect, useMemo, useState } from "react";
import { SiteOverviewPanel } from "../../../client/ChannelOverview";
import { Icon } from "../../../client/components";
import { siteMessagesApi } from "../lib/api";
import { useToast } from "../App";

const EMPTY_FORM = {
  name: "",
  senderName: "",
  senderEmail: "",
  senderPhone: "",
  company: "",
  address: "",
  country: "",
  city: "",
  subject: "",
  message: "",
  targets: "",
  authorized: false,
  replyTracking: true,
};

const MAX_TARGETS_PER_JOB = 500;

const statusMeta: Record<string, { label: string; badge: string }> = {
  draft: { label: "待开始", badge: "badge-default" },
  queued: { label: "排队中", badge: "badge-warning" },
  running: { label: "执行中", badge: "badge-warning" },
  paused: { label: "已暂停", badge: "badge-default" },
  completed: { label: "已完成", badge: "badge-success" },
  failed: { label: "失败", badge: "badge-danger" },
  abnormal: { label: "异常", badge: "badge-warning" },
  no_contact: { label: "无联系页", badge: "badge-warning" },
  inaccessible: { label: "无法访问", badge: "badge-danger" },
  discovering: { label: "查找联系页", badge: "badge-warning" },
  submitting: { label: "正在提交", badge: "badge-warning" },
  submitted: { label: "已提交", badge: "badge-success" },
  skipped: { label: "已跳过", badge: "badge-default" },
};

const formatDate = (value?: string | number) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
const parseProgressLogs = (value?: string) => {
  try { return Array.isArray(value) ? value : JSON.parse(value || "[]"); } catch { return []; }
};
const formatSuccessRate = (submitted: number, total: number, abnormal: number) => {
  const effective = Math.max(0, Number(total || 0) - Number(abnormal || 0));
  if (effective <= 0) return "-";
  const rate = (Number(submitted || 0) / effective) * 100;
  return `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`;
};

export function SiteMessagesPage() {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null);

  const loadJobs = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await siteMessagesApi.list();
      setJobs(response.data || []);
    } catch (error: any) {
      if (!quiet) addToast("error", error.message || "站内信任务加载失败");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => {
    if (!jobs.some((job) => ["queued", "running"].includes(job.status))) return;
    const timer = window.setInterval(() => loadJobs(true), 5000);
    return () => window.clearInterval(timer);
  }, [jobs]);
  useEffect(() => {
    if (!detail?.id || !["queued", "running"].includes(detail.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await siteMessagesApi.get(detail.id);
        setDetail(response.data);
      } catch {
        // Keep the current details visible if one polling request fails.
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [detail?.id, detail?.status]);

  const overviewRevision = JSON.stringify(jobs.map(job => [job.id, job.updatedAt, job.status, job.totalTargets, job.totalSubmitted, job.totalFailed, job.totalSkipped, job.totalNoContact, job.totalInaccessible]));

  const targetCount = useMemo(() => new Set(form.targets.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)).size, [form.targets]);

  const closeForm = () => {
    setShowCreate(false);
    setEditingJob(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setEditingJob(null);
    setForm(EMPTY_FORM);
    setShowCreate(true);
  };

  const openEdit = async (id: string) => {
    setSaving(true);
    try {
      const response = await siteMessagesApi.get(id);
      const job = response.data;
      setEditingJob(job);
      setForm({
        name: job.name || "",
        senderName: job.senderName || "",
        senderEmail: job.senderEmail || "",
        replyTracking: !!job.replyTracking,
        senderPhone: job.senderPhone || "",
        company: job.company || "",
        address: job.address || "",
        country: job.country || "",
        city: job.city || "",
        subject: job.subject || "",
        message: job.message || "",
        targets: (job.targets || []).map((target: any) => target.websiteUrl).join("\n"),
        authorized: true,
      });
      setShowCreate(true);
    } catch (error: any) {
      addToast("error", error.message || "任务资料加载失败");
    } finally {
      setSaving(false);
    }
  };

  const saveJob = async (event: React.FormEvent) => {
    event.preventDefault();
    if (targetCount > MAX_TARGETS_PER_JOB) {
      addToast("error", `单个任务最多支持 ${MAX_TARGETS_PER_JOB} 个不同域名`);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, targets: form.targets.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean) };
      const response = editingJob ? await siteMessagesApi.update(editingJob.id, payload) : await siteMessagesApi.create(payload);
      const invalidCount = response.meta?.invalid?.length || 0;
      addToast("success", editingJob ? "任务已保存" : `任务已创建，接收 ${response.meta?.accepted || targetCount} 个网站${invalidCount ? `，忽略 ${invalidCount} 个无效地址` : ""}`);
      closeForm();
      await loadJobs();
    } catch (error: any) {
      addToast("error", error.message || "任务创建失败");
    } finally {
      setSaving(false);
    }
  };

  const startJob = async (id: string) => {
    try {
      const response = await siteMessagesApi.start(id);
      setJobs((current) => current.map((job) => job.id === id ? { ...job, status: "queued" } : job));
      setDetail((current: any) => current?.id === id ? { ...current, status: "queued" } : current);
      addToast(response.data.failed ? "warning" : "success", response.warning || `${response.data.queued} 个网站已进入执行队列`);
      loadJobs(true);
    } catch (error: any) {
      addToast("error", error.message || "任务启动失败");
    }
  };

  const pauseJob = async (id: string) => {
    try {
      await siteMessagesApi.pause(id);
      setJobs((current) => current.map((job) => job.id === id ? { ...job, status: "paused" } : job));
      setDetail((current: any) => current?.id === id ? { ...current, status: "paused" } : current);
      addToast("success", "任务已暂停；正在处理的网站会在安全节点停止");
      loadJobs(true);
    } catch (error: any) {
      addToast("error", error.message || "任务暂停失败");
    }
  };

  const resetJob = async (id: string) => {
    if (!window.confirm("确定将此任务的所有目标网站重置为初始等待状态？")) return;
    try {
      await siteMessagesApi.reset(id);
      setJobs((current) => current.map((job) => job.id === id ? { ...job, status: "draft", totalSubmitted: 0, totalSkipped: 0, totalFailed: 0, totalNoContact: 0, totalInaccessible: 0, totalAbnormal: 0 } : job));
      if (detail?.id === id) {
        openDetail(id);
      }
      addToast("success", "任务已重置为初始状态");
      loadJobs(true);
    } catch (error: any) {
      addToast("error", error.message || "任务重置失败");
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail({ id, targets: [] });
    try {
      const response = await siteMessagesApi.get(id);
      setDetail(response.data);
    } catch (error: any) {
      addToast("error", error.message || "执行详情加载失败");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const deleteJob = async (id: string) => {
    if (!window.confirm("确定删除此站内信任务及全部执行记录？")) return;
    try {
      await siteMessagesApi.delete(id);
      setJobs((current) => current.filter((job) => job.id !== id));
      addToast("success", "任务已删除");
    } catch (error: any) {
      addToast("error", error.message || "删除失败");
    }
  };

  const exportJob = async (id: string, name: string) => {
    try {
      await siteMessagesApi.exportResults(id, name);
      addToast("success", `已成功导出「${name}」的运行结果`);
    } catch (error: any) {
      addToast("error", error.message || "运行结果导出失败");
    }
  };


  return (
    <>
      <div className="page-header site-message-heading">
        <div className="page-header-actions">
          <div><h1>站内信</h1><p>管理目标网站的联系表单留言，查看执行进度与结果。</p></div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-primary" onClick={openCreate}><Icon name="plus" size={16}/>新建任务</button>
          </div>
        </div>
      </div>
      <div className="page-content site-message-page">
        <div className="site-message-notice">
          <div className="site-message-notice-icon"><Icon name="lock" size={18}/></div>
          <div><strong>保守执行规则</strong><p>同一任务内每个域名仅执行一次；检测到验证码、人机验证、文件上传或无法识别的必填字段时自动跳过，不尝试绕过网站保护。</p></div>
        </div>
        <SiteOverviewPanel revision={overviewRevision}/>

        <div className="site-message-list">
          <div className="section-heading"><div><h3>执行任务</h3><p>查看每批网站的发现和提交结果</p></div></div>
          {loading ? <div className="site-message-empty"><div className="spinner"></div><p>正在加载任务...</p></div> : jobs.length === 0 ? (
            <div className="site-message-empty"><span><Icon name="message" size={32}/></span><h3>还没有站内信任务</h3><p>新建任务后，系统会逐个网站查找联系页面并记录结果。</p><button className="btn btn-primary" onClick={openCreate}>新建第一个任务</button></div>
          ) : (
            <div className="table-container"><table><thead><tr><th>任务</th><th>状态</th><th>目标</th><th>已提交</th><th>失败</th><th>无联系页面</th><th>无法访问</th><th>成功率</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
              {jobs.map((job) => {
                const meta = statusMeta[job.status] || statusMeta.draft;
                const failedCount = Number(job.totalFailed || 0) + Number(job.totalSkipped || 0);
                const noContactCount = Number(job.totalNoContact || 0);
                const inaccessibleCount = Number(job.totalInaccessible || 0);
                const abnormalTotal = noContactCount + inaccessibleCount;
                return <tr key={job.id}><td><strong>{job.name}</strong><small className="table-secondary">{job.subject || "一般业务咨询"}</small></td><td><span className={`badge ${meta.badge}`}>{meta.label}</span></td><td>{job.totalTargets}</td><td>{job.totalSubmitted}</td><td><span style={{ color: "#ef4444", fontWeight: 600 }}>{failedCount}</span></td><td><span style={{ color: "#d97706", fontWeight: 600 }}>{noContactCount}</span></td><td><span style={{ color: "#ef4444", fontWeight: 600 }}>{inaccessibleCount}</span></td><td><span style={{ color: "#10b981", fontWeight: 600 }}>{formatSuccessRate(job.totalSubmitted, job.totalTargets, abnormalTotal)}</span></td><td>{formatDate(job.createdAt)}</td><td><div className="table-actions"><a className="btn btn-ghost btn-sm" href={'/?view=inbox&inboxSource=site&inboxBusiness='+encodeURIComponent(job.id)}>客户回复</a><button className="btn btn-ghost btn-icon" title="查看详情" onClick={() => openDetail(job.id)}>👁️</button><button className="btn btn-ghost btn-icon" title="导出结果" onClick={() => exportJob(job.id, job.name)}>📥</button>{!["queued", "running"].includes(job.status) && <button className="btn btn-ghost btn-icon" title="编辑任务" onClick={() => openEdit(job.id)}>✏️</button>}{["queued", "running"].includes(job.status) && <button className="btn btn-ghost btn-icon" title="暂停任务" onClick={() => pauseJob(job.id)}>⏸️</button>}<button className="btn btn-ghost btn-icon" title="执行 / 重试未成功网站" onClick={() => startJob(job.id)}>▶️</button><button className="btn btn-ghost btn-icon" title="重置全部状态" onClick={() => resetJob(job.id)}>🔄</button><button className="btn btn-ghost btn-icon" title="删除" onClick={() => deleteJob(job.id)}>🗑️</button></div></td></tr>;
              })}
            </tbody></table></div>
          )}
        </div>
      </div>

      {showCreate && <div className="modal-overlay"><div className="modal site-message-create-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><h3 className="modal-title">{editingJob ? "编辑站内信任务" : "新建站内信任务"}</h3><p className="modal-subtitle">{editingJob ? "修改后将用于任务后续重试；历史执行记录不会被覆盖" : "填写一次资料，系统会根据目标网站的字段名称自动匹配"}</p></div><button className="btn btn-ghost btn-icon" onClick={closeForm} title="关闭">✕</button></div>
        <form onSubmit={saveJob}>
          <div className="modal-body site-message-form">
            <section className="site-message-task-section"><div className="form-section-title"><span>1</span><div><h4>任务与留言</h4><p>同一任务中的网站将使用相同留言内容</p></div></div><div className="form-grid"><div className="form-group"><label className="form-label">任务名称 *</label><input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：Q3 合作伙伴咨询" /></div><div className="form-group"><label className="form-label">主题</label><input className="form-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Business inquiry" /></div></div><div className="form-group"><label className="form-label">留言内容 *</label><textarea className="form-textarea" rows={4} required maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="请使用清晰、真实且与目标网站相关的咨询内容，避免重复营销话术。" /><div className="form-counter">{form.message.length}/5000</div></div></section>
            <section className="site-message-contact-section"><div className="form-section-title"><span>2</span><div><h4>联系人资料</h4><p>系统按字段语义填写姓名、邮箱、电话、公司和地址</p></div></div><div className="form-grid"><div className="form-group"><label className="form-label">姓名 *</label><input className="form-input" required value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} /></div><div className="form-group"><label className="form-label">邮箱 *</label><input className="form-input" type="email" required value={form.senderEmail} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })} /></div><div className="form-group"><label className="form-label">电话</label><input className="form-input" value={form.senderPhone} onChange={(e) => setForm({ ...form, senderPhone: e.target.value })} /></div><div className="form-group"><label className="form-label">公司</label><input className="form-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div><div className="form-group"><label className="form-label">国家 / 地区</label><input className="form-input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div><div className="form-group"><label className="form-label">城市</label><input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div><div className="form-group form-grid-full"><label className="form-label">详细地址</label><input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div></div></section>
            <label className="site-message-consent"><input type="checkbox" checked={form.replyTracking} onChange={e=>setForm({...form,replyTracking:e.target.checked})}/><span>自动追踪回复：收信配置启用后，为每个目标填写独立收信地址，并转发到配置的工作邮箱；未启用时仍使用上方邮箱。</span></label><section className="site-message-target-section"><div className="form-section-title"><span>3</span><div><h4>目标网站</h4><p>{editingJob && editingJob.status !== "draft" ? "任务已有执行记录，目标网站已锁定；可复制任务后使用新的目标列表。" : `每行一个网址；同一域名只保留一条，单个任务最多 ${MAX_TARGETS_PER_JOB} 个域名`}</p></div></div><div className="form-group"><textarea className="form-textarea site-message-targets" rows={4} required disabled={Boolean(editingJob && editingJob.status !== "draft")} value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} placeholder={"https://example-store.com\ncompany.example/contact\nhttps://another-business.com"} /><div className="form-help">当前识别 {targetCount} 个地址{targetCount > MAX_TARGETS_PER_JOB ? `，已超过上限 ${targetCount - MAX_TARGETS_PER_JOB} 个` : ""}</div></div><label className="site-message-consent"><input type="checkbox" checked={form.authorized} onChange={(e) => setForm({ ...form, authorized: e.target.checked })} required /><span>我确认这些网站允许提交业务咨询，并将遵守网站条款、隐私政策和适用法律。</span></label></section>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={closeForm}>取消</button><button type="submit" className="btn btn-primary" disabled={saving || !form.authorized || targetCount > MAX_TARGETS_PER_JOB}>{saving ? "正在保存..." : editingJob ? "保存修改" : "创建任务"}</button></div>
        </form>
      </div></div>}

      {detail && <div className="modal-overlay"><div className="modal site-message-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><h3 className="modal-title">{detail.name || "执行详情"}</h3><p className="modal-subtitle">逐站查看联系页发现、表单识别和提交结果</p></div><div className="modal-header-actions"><button className="btn btn-secondary" onClick={() => exportJob(detail.id, detail.name)}>📥 导出结果</button>{["queued", "running"].includes(detail.status) && <button className="btn btn-secondary" onClick={() => pauseJob(detail.id)}>⏸ 暂停</button>}<button className="btn btn-primary" onClick={() => startJob(detail.id)}>▶ 执行/重试未成功网站</button><button className="btn btn-secondary" onClick={() => resetJob(detail.id)} title="重置全量网站为初始状态">🔄 重置任务</button><button className="btn btn-ghost btn-icon" onClick={() => setDetail(null)} title="关闭">✕</button></div></div>
        <div className="modal-body">{detailLoading ? <div className="site-message-empty"><div className="spinner"></div></div> : <div className="table-container site-message-detail-table"><table><thead><tr><th>目标网站</th><th>执行进度</th><th>状态</th><th>结果说明</th><th>日志</th></tr></thead><tbody>{detail.targets.map((target: any) => {
          const statusKey = target.classifiedStatus || target.status;
          const meta = statusMeta[statusKey] || statusMeta.draft;
          const percent = Number(target.progressPercent ?? (["submitted", "skipped", "failed", "abnormal"].includes(statusKey) ? 100 : 0));
          const logs = parseProgressLogs(target.progressLogs);
          const expanded = expandedTargetId === target.id;
          return <React.Fragment key={target.id}>
            <tr>
              <td><a href={target.websiteUrl} target="_blank" rel="noreferrer">{target.normalizedHost}</a>{target.contactPageUrl && <a className="site-message-contact-link" href={target.contactPageUrl} target="_blank" rel="noreferrer">打开联系页</a>}</td>
              <td><div className="site-message-progress"><div className="site-message-progress-track"><span style={{ width: `${percent}%` }} /></div><div><strong>{percent}%</strong><span>{logs[logs.length - 1]?.message || "等待执行"}</span></div></div></td>
              <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
              <td><span className="site-message-result">{target.resultMessage || (percent > 0 ? "执行中" : "等待执行")}</span></td>
              <td><button className="btn btn-ghost site-message-log-toggle" onClick={() => setExpandedTargetId(expanded ? null : target.id)} disabled={!logs.length}>{expanded ? "收起" : `查看日志${logs.length ? ` (${logs.length})` : ""}`}</button></td>
            </tr>
            {expanded && <tr className="site-message-log-row"><td colSpan={5}><ol className="site-message-log-list">{logs.map((log: any, index: number) => <li key={`${log.at}-${index}`}><time>{formatDate(log.at)}</time><span className="site-message-log-dot" /><div><strong>{log.percent}% · {log.message}</strong>{log.url && <a href={log.url} target="_blank" rel="noreferrer">{log.url}</a>}</div></li>)}</ol></td></tr>}
          </React.Fragment>;
        })}</tbody></table></div>}</div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setDetail(null)}>关闭</button><button className="btn btn-primary" onClick={() => exportJob(detail.id, detail.name)}>📥 导出运行结果 (CSV)</button></div>
      </div></div>}
    </>
  );
}
