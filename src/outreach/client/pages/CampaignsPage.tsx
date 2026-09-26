/** @jsxImportSource react */
import { CampaignProgress } from "../components/CampaignProgress";
import React, { useState, useEffect, useRef } from "react";
import { campaignsApi, templatesApi, contactsApi } from "../lib/api";
import { useToast } from "../App";
import { TEMPLATE_NAME_LABELS } from "./TemplatesPage";

const statusLabels: Record<string, { label: string; badge: string }> = {
  draft: { label: "草稿", badge: "badge-default" },
  scheduled: { label: "已排期", badge: "badge-info" },
  sending: { label: "发送中", badge: "badge-warning" },
  paused: { label: "已暂停", badge: "badge-warning" },
  completed: { label: "已完成", badge: "badge-success" },
  failed: { label: "失败", badge: "badge-danger" },
  needs_review: { label: "待核实", badge: "badge-warning" },
};

function CampaignRate({ label, value, totalSent }: { label: string; value: unknown; totalSent: unknown }) {
  const count = Math.max(0, Number(value) || 0);
  const sent = Math.max(0, Number(totalSent) || 0);
  const rate = sent > 0 ? (count / sent) * 100 : 0;

  return (
    <span
      className="campaign-rate-value"
      tabIndex={0}
      aria-label={`${label}率 ${rate.toFixed(1)}%，数量 ${count}`}
    >
      <span className="campaign-rate-percent" aria-hidden="true">{rate.toFixed(1)}%</span>
      <span className="campaign-rate-count" aria-hidden="true">{count}</span>
    </span>
  );
}

export function CampaignsPage() {
  const { addToast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDetailId, setShowDetailId] = useState<string | null>(null);
  const showDetailIdRef = useRef<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const detailRequests = useRef(new Set<string>());
  const listLoading = useRef(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recipientList, setRecipientList] = useState<any[]>([]);
  const [addedContactIds, setAddedContactIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const exportLock = useRef(false);
  const downloadReport = async (campaign: any) => {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(campaign.id);
    try { await campaignsApi.exportReport(campaign.id, campaign.name); }
    catch (error: any) { addToast("error", error.message); }
    finally { exportLock.current = false; setExporting(null); }
  };

  useEffect(() => {
    showDetailIdRef.current = showDetailId;
  }, [showDetailId]);

  const closeDetailModal = () => {
    setShowDetailId(null);
    showDetailIdRef.current = null;
    setDetail(null);
  };

  const [form, setForm] = useState({
    name: "",
    templateId: "",
    senderEmail: "",
    senderName: "",
    replyTo: "",
    sendRate: 50,
    replyTracking: true,
  });
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  // State for Add Recipients in Detail view
  const [detailSelectedGroups, setDetailSelectedGroups] = useState<string[]>([]);
  const [detailSelectedContacts, setDetailSelectedContacts] = useState<string[]>([]);

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
    loadGroups();
    loadContacts();
  }, []);

  // Only active sends need polling; completed details refresh on demand.
  useEffect(() => {
    if (!campaigns.some((campaign) => campaign.status === "sending") && detail?.status !== "sending") return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (showDetailIdRef.current && detail?.status === "sending") {
        loadDetail(showDetailIdRef.current, true);
      }
      const hasSending = campaigns.some((c) => c.status === "sending");
      if (hasSending) {
        loadCampaigns(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [campaigns, detail?.status]);

  const loadCampaigns = async (silent = false) => {
    if (listLoading.current) return;
    listLoading.current = true;
    if (!silent) setLoading(true);
    try {
      const res = await campaignsApi.list();
      setCampaigns(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      listLoading.current = false;
      if (!silent) setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const allTemplates = await templatesApi.listAll();
      setTemplates(allTemplates || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadGroups = async () => {
    try {
      const res = await contactsApi.listGroups();
      setGroups(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadContacts = async () => {
    try {
      // Fetch a larger page size for selection
      const res = await contactsApi.list({ pageSize: "1000" });
      setContacts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDetail = async (id: string, silent = false, sync = false) => {
    if (detailRequests.current.has(id)) return;
    detailRequests.current.add(id);
    if (!silent) {
      showDetailIdRef.current = id;
      setShowDetailId(id);
      setDetail((current: any) => current?.id === id ? current : campaigns.find((item) => item.id === id));
      setRecipientList([]);
      setAddedContactIds([]);
      setDetailLoading(true);
    }
    try {
      const [res, recRes] = await Promise.all([
        campaignsApi.get(id, sync),
        campaignsApi.listRecipients(id, { pageSize: "1000" }),
      ]);

      if (showDetailIdRef.current !== id) {
        return;
      }

      setDetail(res.data);
      if (!silent) {
        setShowDetailId(id);
        showDetailIdRef.current = id;
      }
      setRecipientList(recRes.data || []);
      setAddedContactIds(recRes.data ? recRes.data.map((r: any) => r.contactId) : []);
    } catch (err: any) {
      if (!silent) {
        addToast("error", err.message);
      }
    } finally {
      detailRequests.current.delete(id);
      if (showDetailIdRef.current === id) setDetailLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await campaignsApi.update(editId, form);
        addToast("success", "活动已更新");
        setShowModal(false);
        setEditId(null);
        setForm({ name: "", templateId: "", senderEmail: "", senderName: "", replyTo: "", sendRate: 50, replyTracking: true });
        loadCampaigns();
        return;
      }

      const res = await campaignsApi.create(form);
      const newCampaignId = res.data.id;

      let added = 0;
      // Add groups if selected
      for (const groupId of selectedGroups) {
        const r = await campaignsApi.addRecipients(newCampaignId, { groupId });
        added += r.data.added;
      }
      // Add individual contacts if selected
      if (selectedContacts.length > 0) {
        const r = await campaignsApi.addRecipients(newCampaignId, { contactIds: selectedContacts });
        added += r.data.added;
      }

      addToast("success", `活动已创建，添加了 ${added} 个收件人`);
      setShowModal(false);
      setForm({ name: "", templateId: "", senderEmail: "", senderName: "", replyTo: "", sendRate: 50, replyTracking: true });
      setSelectedGroups([]);
      setSelectedContacts([]);
      loadCampaigns();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleEdit = (c: any) => {
    setForm({
      name: c.name,
      templateId: c.templateId || "",
      senderEmail: c.senderEmail,
      senderName: c.senderName,
      replyTo: c.replyTo || "",
      sendRate: c.sendRate || 50,
      replyTracking: !!c.replyTracking,
    });
    setEditId(c.id);
    setSelectedGroups([]);
    setSelectedContacts([]);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此活动？删除后无法恢复。")) return;
    try {
      await campaignsApi.delete(id);
      addToast("success", "已删除");
      loadCampaigns();
      if (showDetailId === id) {
        setShowDetailId(null);
        setDetail(null);
      }
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleInstantAddGroup = async (groupId: string) => {
    if (!detail) return;
    try {
      const res = await campaignsApi.addRecipients(detail.id, { groupId });
      addToast("success", `已添加 ${res.data.added} 个收件人，跳过 ${res.data.skipped} 个重复`);
      loadDetail(detail.id);
      loadCampaigns();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleInstantAddContact = async (contactId: string) => {
    if (!detail) return;
    try {
      if (addedContactIds.includes(contactId)) {
        await campaignsApi.removeRecipient(detail.id, contactId);
        addToast("success", "已移除收件人");
      } else {
        const res = await campaignsApi.addRecipients(detail.id, { contactIds: [contactId] });
        addToast("success", `已添加 ${res.data.added} 个收件人，跳过 ${res.data.skipped} 个重复`);
      }
      loadDetail(detail.id);
      loadCampaigns();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleSend = async (campaignId: string) => {
    if (!confirm("确定开始发送？邮件将通过默认邮件通道批量发送给所有收件人。")) return;
    setSending(true);
    try {
      const res = await campaignsApi.send(campaignId);
      addToast("success", `已开始发送，${res.data.recipientsQueued} 封邮件已加入队列`);
      loadDetail(campaignId);
      loadCampaigns();
    } catch (err: any) {
      addToast("error", err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePause = async (campaignId: string) => {
    try {
      await campaignsApi.pause(campaignId);
      addToast("success", "活动已暂停");
      loadDetail(campaignId);
      loadCampaigns();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const isBuiltIn = (t: any) =>
    t.isBuiltIn ||
    t.bodyHtml?.includes("data-growthos-template='en-v2'") ||
    t.bodyHtml?.includes("data-growthos-template='en-v3'");

  const userTemplates = templates.filter((t) => !isBuiltIn(t) || t.category === "My templates");
  const builtInTemplates = templates.filter((t) => isBuiltIn(t) && t.category !== "My templates");

  return (
    <>
      <div className="page-header">
        <div className="page-header-actions">
          <div>
            <h2>营销活动</h2>
            <p>创建和管理邮件营销活动</p>
          </div>
          <button className="btn btn-primary" onClick={() => {
            setEditId(null);
            setForm({ name: "", templateId: "", senderEmail: "", senderName: "", replyTo: "", sendRate: 50, replyTracking: true });
            setSelectedGroups([]);
            setSelectedContacts([]);
            setShowModal(true);
          }}>
            ➕ 新建活动
          </button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="stats-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-card">
                <div className="skeleton" style={{ height: 24, width: "60%", marginBottom: 12 }}></div>
                <div className="skeleton" style={{ height: 16, width: "80%" }}></div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🚀</div>
              <h3>暂无营销活动</h3>
              <p>创建你的第一个邮件营销活动</p>
              <button className="btn btn-primary" onClick={() => {
                setEditId(null);
                setForm({ name: "", templateId: "", senderEmail: "", senderName: "", replyTo: "", sendRate: 50, replyTracking: true });
                setSelectedGroups([]);
                setSelectedContacts([]);
                setShowModal(true);
              }}>
                新建活动
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#6366f1" }}>🚀</div>
                <div className="stat-value">{campaigns.length}</div>
                <div className="stat-label">营销活动数</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}>👥</div>
                <div className="stat-value">{campaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0)}</div>
                <div className="stat-label">覆盖收件人</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>📨</div>
                <div className="stat-value">{campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0)}</div>
                <div className="stat-label">已成功发送</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "rgba(14, 165, 233, 0.12)", color: "#0ea5e9" }}>📦</div>
                <div className="stat-value">
                  {(() => {
                    const totalR = campaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0);
                    const totalS = campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
                    return totalR > 0 ? `${Math.round((totalS / totalR) * 100)}%` : "100%";
                  })()}
                </div>
                <div className="stat-label">总体送达率</div>
              </div>
            </div>

            <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>活动名称</th>
                  <th>状态</th>
                  <th>收件人</th>
                  <th>已发送</th>
                  <th>打开</th>
                  <th>点击</th>
                  <th>退信</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const st = statusLabels[c.status] || statusLabels.draft;
                  return (
                    <tr key={c.id}>
                      <td
                        style={{ color: "var(--color-text-primary)", fontWeight: 600, cursor: "pointer" }}
                        onClick={() => loadDetail(c.id)}
                      >
                        {c.name}
                      </td>
                      <td>
                        <span className={`badge ${st.badge}`}>
                          {c.status === "sending" && (
                            <span className="status-dot active" style={{ width: 6, height: 6 }}></span>
                          )}
                          {st.label}
                        </span>
                        {c.status === "sending" && <CampaignProgress campaign={c} />}
                      </td>
                      <td>{c.totalRecipients}</td>
                      <td>{c.totalSent}</td>
                      <td><CampaignRate label="打开" value={c.totalOpened} totalSent={c.totalSent} /></td>
                      <td><CampaignRate label="点击" value={c.totalClicked} totalSent={c.totalSent} /></td>
                      <td><CampaignRate label="退信" value={c.totalBounced} totalSent={c.totalSent} /></td>
                      <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                        {new Date(c.createdAt).toLocaleDateString("zh-CN")}
                      </td>
                      <td>
                        <div className="flex gap-sm" style={{ flexWrap: "wrap" }}>
                          <a className="btn btn-ghost btn-sm" href={'/?view=inbox&inboxSource=edm&inboxBusiness='+encodeURIComponent(c.id)}>客户回复</a>
                          <button className="btn btn-ghost btn-sm" onClick={() => loadDetail(c.id)} title="查看详情">
                            查看
                          </button>
                          <button className="btn btn-ghost btn-sm" disabled={!!exporting} onClick={() => downloadReport(c)}>
                            {exporting === c.id ? "正在导出..." : "下载报表"}
                          </button>
                          {c.status !== "sending" && (
                            <>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(c)} title="编辑">
                                编辑
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)} title="删除">
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? "编辑营销活动" : "新建营销活动"}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">活动名称 *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: (e.target as HTMLInputElement).value }))}
                    required
                    placeholder="Q3 新客户开发"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">选择邮件模板</label>
                  <select
                    className="form-select"
                    value={form.templateId}
                    onChange={(e) => setForm((p) => ({ ...p, templateId: (e.target as HTMLSelectElement).value }))}
                  >
                    <option value="">稍后选择</option>
                    {userTemplates.length > 0 && (
                      <optgroup label="我的模板 (推荐)">
                        {userTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{TEMPLATE_NAME_LABELS[t.name] || t.name} - ({t.subject})</option>
                        ))}
                      </optgroup>
                    )}
                    {builtInTemplates.length > 0 && (
                      <optgroup label="内置模板">
                        {builtInTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{TEMPLATE_NAME_LABELS[t.name] || t.name} - ({t.subject})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">发件人邮箱 *</label>
                    <input
                      className="form-input"
                      type="email"
                      value={form.senderEmail}
                      onChange={(e) => setForm((p) => ({ ...p, senderEmail: (e.target as HTMLInputElement).value }))}
                      required
                      placeholder="hello@yourdomain.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">发件人名称 *</label>
                    <input
                      className="form-input"
                      value={form.senderName}
                      onChange={(e) => setForm((p) => ({ ...p, senderName: (e.target as HTMLInputElement).value }))}
                      required
                      placeholder="Your Company"
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label><input type="checkbox" checked={form.replyTracking} onChange={e=>setForm({...form,replyTracking:e.target.checked})}/>自动追踪回复（需启用收信配置）</label><label className="form-label">回复地址</label>
                    <input
                      className="form-input"
                      type="email"
                      value={form.replyTo}
                      onChange={(e) => setForm((p) => ({ ...p, replyTo: (e.target as HTMLInputElement).value }))}
                      placeholder="reply@yourdomain.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">发送速率 (封/分钟)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="200"
                      value={form.sendRate}
                      onChange={(e) => setForm((p) => ({ ...p, sendRate: parseInt((e.target as HTMLInputElement).value) || 50 }))}
                    />
                  </div>
                </div>

                {/* Recipient Selection (Only show on Create) */}
                {!editId && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>选择收件人</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: 13 }}>按分组添加（点击选择）</label>
                        <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--color-border)", padding: 12, borderRadius: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${selectedGroups.includes("null") ? "btn-primary" : "btn-secondary"}`}
                            style={{ borderRadius: 20 }}
                            onClick={() => {
                              if (selectedGroups.includes("null")) setSelectedGroups(selectedGroups.filter((id) => id !== "null"));
                              else setSelectedGroups([...selectedGroups, "null"]);
                            }}
                          >
                            默认分组
                          </button>
                          {groups.map(g => (
                            <button
                              key={g.id}
                              type="button"
                              className={`btn btn-sm ${selectedGroups.includes(g.id) ? "btn-primary" : "btn-secondary"}`}
                              style={{ borderRadius: 20 }}
                              onClick={() => {
                                if (selectedGroups.includes(g.id)) setSelectedGroups(selectedGroups.filter((id) => id !== g.id));
                                else setSelectedGroups([...selectedGroups, g.id]);
                              }}
                            >
                              {g.name} ({g.contactCount})
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 13 }}>按独立联系人添加（点击选择）</label>
                        <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--color-border)", padding: 12, borderRadius: 6, display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                          {contacts.length === 0 ? (
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", width: "100%" }}>暂无联系人</div>
                          ) : (
                            contacts.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                className={`btn btn-sm ${selectedContacts.includes(c.id) ? "btn-primary" : "btn-secondary"}`}
                                style={{ borderRadius: 20 }}
                                onClick={() => {
                                  if (selectedContacts.includes(c.id)) setSelectedContacts(selectedContacts.filter((id) => id !== c.id));
                                  else setSelectedContacts([...selectedContacts, c.id]);
                                }}
                              >
                                {c.email} {c.name ? `(${c.name})` : ""}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">
                  {editId ? "保存修改" : "创建活动"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Detail Modal */}
      {showDetailId && detail && (
        <div className="modal-overlay" onClick={closeDetailModal}>
          <div className="modal" style={{ maxWidth: 880, width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{detail.name}</h3>
              <button className="btn btn-ghost" onClick={closeDetailModal}>✕</button>
            </div>
            <div className="modal-body">
              {/* Status, Template & Actions */}
              {detailLoading && <p role="status">正在加载活动详情...</p>}
              <div style={{ marginBottom: 16, padding: 12, border: "1px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg-subtle)" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10, flexWrap: "wrap", gap: 12 }}>
                  <div className="flex items-center gap-sm">
                    <span className={`badge ${(statusLabels[detail.status] || statusLabels.draft).badge}`} style={{ fontSize: 14, padding: "5px 14px" }}>
                      {(statusLabels[detail.status] || statusLabels.draft).label}
                    </span>
                    {!detail.templateId && (
                      <span style={{ color: "var(--color-danger)", fontSize: 12, fontWeight: 500 }}>⚠️ 请关联邮件模板后启动发送</span>
                    )}
                  </div>
                  <div className="flex gap-sm" style={{ flexWrap: "wrap" }}>
                    <button className="btn btn-secondary btn-sm" disabled={detailLoading}
                      onClick={() => loadDetail(detail.id)}>刷新</button>
                    <button className="btn btn-secondary btn-sm" disabled={!!exporting} onClick={() => downloadReport(detail)}>
                      {exporting === detail.id ? "正在导出..." : "下载报表"}
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled={detailLoading}
                      onClick={() => loadDetail(detail.id, false, true)}>同步服务商数据</button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSend(detail.id)}
                      disabled={sending || detail.status === "sending" || detail.status === "completed" || Number(detail.totalRecipients || 0) === 0 || !detail.templateId}
                    >
                      {sending ? "正在提交..." : detail.status === "sending" ? "正在发送" : detail.status === "completed" ? "发送完成" : "开始发送"}
                    </button>
                    {detail.status === "sending" && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handlePause(detail.id)}>
                        ⏸️ 暂停
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                  <label style={{ fontWeight: 600, minWidth: 80, color: "var(--color-text-secondary)" }}>邮件模板 *</label>
                  <select
                    className="form-select"
                    style={{ flex: 1, padding: "4px 8px", fontSize: 13 }}
                    value={detail.templateId || ""}
                    disabled={detail.status === "sending"}
                    onChange={async (e) => {
                      const newTplId = e.target.value;
                      try {
                        await campaignsApi.update(detail.id, { templateId: newTplId });
                        addToast("success", "已关联邮件模板");
                        loadDetail(detail.id);
                        loadCampaigns(true);
                      } catch (err: any) {
                        addToast("error", err.message);
                      }
                    }}
                  >
                    <option value="">-- 请选择关联邮件模板 --</option>
                    {userTemplates.length > 0 && (
                      <optgroup label="我的模板 (推荐)">
                        {userTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{TEMPLATE_NAME_LABELS[t.name] || t.name} - ({t.subject})</option>
                        ))}
                      </optgroup>
                    )}
                    {builtInTemplates.length > 0 && (
                      <optgroup label="内置模板">
                        {builtInTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{TEMPLATE_NAME_LABELS[t.name] || t.name} - ({t.subject})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Stats */}
              <CampaignProgress campaign={detail} />
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", marginBottom: 20 }}>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-value" style={{ fontSize: 20 }}>{detail.totalRecipients}</div>
                  <div className="stat-label" style={{ fontSize: 12 }}>收件人</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-value" style={{ fontSize: 20 }}>{detail.totalSent}</div>
                  <div className="stat-label" style={{ fontSize: 12 }}>已发送</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-value" style={{ fontSize: 20 }}>{detail.totalOpened}</div>
                  <div className="stat-label" style={{ fontSize: 12 }}>已打开</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-value" style={{ fontSize: 20 }}>{detail.totalClicked ?? 0}</div>
                  <div className="stat-label" style={{ fontSize: 12 }}>已点击</div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div className="stat-value" style={{ fontSize: 20 }}>{detail.totalBounced}</div>
                  <div className="stat-label" style={{ fontSize: 12 }}>退信</div>
                </div>
              </div>

              {/* Add Recipients */}
              {(detail.status !== "sending" && detail.status !== "completed") && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header">
                    <h4 className="card-title">添加收件人</h4>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 13 }}>从分组选择（点击立即添加）</label>
                      <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--color-border)", padding: 12, borderRadius: 6, display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ borderRadius: 20 }}
                          onClick={() => handleInstantAddGroup("null")}
                        >
                          ➕ 默认分组
                        </button>
                        {groups.map(g => (
                          <button
                            key={g.id}
                            className="btn btn-secondary btn-sm"
                            style={{ borderRadius: 20 }}
                            onClick={() => handleInstantAddGroup(g.id)}
                          >
                            ➕ {g.name} ({g.contactCount})
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 13 }}>从独立联系人选择（点击切换添加/移除）</label>
                      <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--color-border)", padding: 12, borderRadius: 6, display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                        {contacts.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--color-text-muted)", width: "100%" }}>暂无联系人</div>
                        ) : (
                          contacts.map(c => {
                            const isAdded = addedContactIds.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                className={`btn btn-sm ${isAdded ? "btn-primary" : "btn-secondary"}`}
                                style={{ borderRadius: 20 }}
                                onClick={() => handleInstantAddContact(c.id)}
                              >
                                {isAdded ? "✓" : "➕"} {c.email} {c.name ? `(${c.name})` : ""}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recipient Details List */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 className="card-title" style={{ fontSize: 15 }}>📋 收件人发送明细</h4>
                  {detail.status === "sending" && (
                    <span style={{ fontSize: 12, color: "var(--color-accent)", display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="spinner" style={{ width: 12, height: 12 }}></span> 动态刷新中...
                    </span>
                  )}
                </div>
                <div style={{ maxHeight: 250, overflowY: "auto", overflowX: "auto", fontSize: 13, border: "1px solid var(--color-border)", borderRadius: 6 }}>
                  {recipientList.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)" }}>暂无收件人记录</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", background: "var(--color-bg-subtle)" }}>
                          <th style={{ padding: "8px 12px", whiteSpace: "nowrap", width: "35%" }}>收件人邮箱</th>
                          <th style={{ padding: "8px 12px", whiteSpace: "nowrap", width: "15%" }}>状态</th>
                          <th style={{ padding: "8px 12px", whiteSpace: "nowrap", width: "30%" }}>详情 / 错误提示</th>
                          <th style={{ padding: "8px 12px", whiteSpace: "nowrap", width: "20%" }}>发送时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipientList.map((r) => {
                          const rStatusMap: Record<string, { label: string; badge: string }> = {
                            queued: { label: "待发送", badge: "badge-default" },
                            sending: { label: "发送中...", badge: "badge-warning" },
                            sent: { label: "已发送", badge: "badge-success" },
                            delivered: { label: "已送达", badge: "badge-success" },
                            opened: { label: "已打开", badge: "badge-info" },
                            clicked: { label: "已点击", badge: "badge-info" },
                            failed: { label: "发送失败", badge: "badge-danger" },
                            bounced: { label: "已退信", badge: "badge-danger" },
                          };
                          const st = rStatusMap[r.status] || { label: r.status, badge: "badge-default" };
                          const sentSuccessfully = ["sent", "delivered", "opened", "clicked"].includes(r.status);
                          return (
                            <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>
                                {r.contactEmail}
                                {r.contactName ? <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>({r.contactName})</span> : null}
                              </td>
                              <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                                <span className={`badge ${st.badge}`} style={{ fontSize: 12 }}>{st.label}</span>
                              </td>
                              <td style={{ padding: "8px 12px", color: !sentSuccessfully && r.errorMessage ? "var(--color-danger)" : "var(--color-text-muted)", fontSize: 12, wordBreak: "break-word" }}>
                                {sentSuccessfully ? "✅ 发送成功" : r.errorMessage || "-"}
                              </td>
                              <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                                {r.sentAt ? new Date(r.sentAt).toLocaleTimeString("zh-CN") : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>


              {/* Info */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                fontSize: 13,
                color: "var(--color-text-secondary)",
              }}>
                <div>发件人: <strong>{detail.senderName} &lt;{detail.senderEmail}&gt;</strong></div>
                <div>发送速率: <strong>{detail.sendRate} 封/分钟</strong></div>
                <div>创建: <strong>{new Date(detail.createdAt).toLocaleString("zh-CN")}</strong></div>
                {detail.startedAt && (
                  <div>开始: <strong>{new Date(detail.startedAt).toLocaleString("zh-CN")}</strong></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
