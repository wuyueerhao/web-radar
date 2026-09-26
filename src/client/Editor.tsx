import { writeBusiness } from '../shared/access';
import { DeploymentSettings } from './DeploymentSettings';
import { matchesDeployment } from '../shared/deployment';
import { blocksModeChange, withBuildMode } from '../shared/build-mode';
import { CompanyFields } from './CompanyFields';
import { BannerEditor, editableBanners, type BannerUploadSlot } from './BannerEditor';
import type { SeoReport } from '../worker/site-metadata';
import { WebsiteConnections } from './ProviderAccounts';
import { ProjectHistory } from './ProjectHistory';
import { UploadProgress, type UploadState } from './UploadProgress';
import { hasCloneOutput } from '../shared/clone-output';
import { liveJob } from './task-polling';
import { samePublishedDraft } from '../shared/publication';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  Asset,
  Company,
  CloneConfig,
  Draft,
  DesignPage,
  Inquiry,
  Job,
  Language,
  Principal,
  Product,
  ProductSnapshot,
  Project,
  ProjectDetail,
  ServiceStatus,
} from '../shared/model';
import { api, upload as uploadAsset, ApiError, errorMessage, post, put, requestId, PendingOperations } from './api';
import {
  AssetView,
  Brand,
  Button,
  Empty,
  Field,
  Icon,
  Modal,
  Notice,
  SectionTitle,
  dateTime,
  statusNames,
} from './components';
import { mergeVersions } from './merge';
import { SitePreview } from './Preview';
import { PageDesign } from './PageDesign';
import { BriefStep, ConsultationStep } from './GuidedSteps';
import {
  designLabels,
  designsConfirmed,
  resetDesignForEdit,
  staticSiteReady,
} from '../shared/site-design';
import { briefConfirmed, plannedPages, resetConsultationForEdit } from '../shared/site-brief';
import { draftChecklist, getWorkflowSteps, resolveWorkflowTab, type WorkflowStep } from './workflow';
const TemplateSelector = lazy(() => import('./TemplateSelector'));
const CloneEditor = lazy(() => import('./CloneEditor'));
import { ErrorBoundary } from './ErrorBoundary';
import { MaterialsEditor } from './MaterialsEditor';

const languageNames: Record<Language, string> = {
  en: 'English · 英语',
  de: 'Deutsch · 德语',
  fr: 'Français · 法语',
  es: 'Español · 西班牙语',
  pt: 'Português · 葡萄牙语',
  it: 'Italiano · 意大利语',
};
type Tab = WorkflowStep | 'inquiries';
const allTabLabels: Record<Tab, string> = {
  basics: '资料与产品',
  template: '选择模版',
  'clone-generate': '像素级生成',
  consultation: '需求沟通',
  brief: '网站方案',
  design: '页面设计稿',
  publish: '预览与发布',
  inquiries: '客户询盘',
};
type SourceChange = { productId: string; before: ProductSnapshot; after: ProductSnapshot };
const jobKinds: Record<string, string> = {
  clone: '设计稿生成',
  consultation: '需求沟通',
  script: '脚本生成',
  copy: '文案与译文',
  image: '图片生成',
  'site-build': '静态网站生成',
  video: '完整视频',
  publish: '网站发布',
  email: '询盘邮件',
};

export default function Editor({
  projectId,
  principal,
  services,
  testMode,
  embedded = false,
  onBack,
  onHome,
}: {
  projectId: string;
  principal: Principal;
  services: ServiceStatus[];
  testMode: boolean;
  embedded?: boolean;
  onBack: () => void;
  onHome: () => void;
}) {
  const [seoReport, setSeoReport] = useState<(SeoReport & {version:number; origin:string|null; needsPublish:boolean}) | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloneActivity, setCloneActivity] = useState(false);
  const saveInFlight=useRef<Promise<Project>|null>(null);
  const autoSaveFailed=useRef<Project|null>(null);
  const [publishSection,setPublishSection]=useState<'content'|'check'|'manage'>('content');

  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  const [detail, setDetail] = useState<ProjectDetail | null>(null),
    [project, setProject] = useState<Project | null>(null),
    [tab, setTab] = useState<Tab>(() => {
      try {
        const q = new URL(window.location.href).searchParams.get('tab') as Tab | null;
        if (
          q &&
          [
            'basics',
            'template',
            'clone-generate',
            'consultation',
            'brief',
            'design',
            'publish',
            'inquiries',
          ].includes(q)
        ) {
          return q;
        }
      } catch {}
      return 'basics';
    });

  useEffect(() => {
    if(!project)return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {}
  }, [tab,project?.id]);
  const [dirty, setDirty] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState('');
  const [conflict, setConflict] = useState<Project | null>(null),
    [choices, setChoices] = useState<Record<string, 'mine' | 'theirs'>>({}),
    [leaveOpen, setLeaveOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false),
    [sourceProducts, setSourceProducts] = useState<ProductSnapshot[]>([]),
    [sourceIds, setSourceIds] = useState<string[]>([]),
    [sourceTotal, setSourceTotal] = useState(0),
    [sourceOffset, setSourceOffset] = useState(0);
  const [sourceChanges, setSourceChanges] = useState<SourceChange[] | null>(null),
    [applyIds, setApplyIds] = useState<string[]>([]),
    [previewOpen, setPreviewOpen] = useState(false);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const previewRef = useRef(false);
  const previewSnapshot = useRef<Project | null>(null);
  const leaveTarget = useRef<'projects' | 'home'>('projects');
  const navigation = useRef({ onBack, onHome });
  navigation.current = { onBack, onHome };
  function finishLeave() {
    if (leaveTarget.current === 'home') navigation.current.onHome();
    else navigation.current.onBack();
  }
  function requestLeave(target: 'projects' | 'home' = 'projects') {
    leaveTarget.current = target;
    if (hasUnsavedChanges()) setLeaveOpen(true);
    else finishLeave();
  }
  function showPreview(snapshot: Project | null = null) {
    if (previewRef.current) return;
    previewSnapshot.current = snapshot;
    window.history.pushState({ ...window.history.state, wrPreview: projectId }, '', window.location.href);
    previewRef.current = true;
    setPreviewProject(snapshot);
    setPreviewOpen(true);
  }
  function closePreview() {
    if (window.history.state?.wrPreview === projectId) {
      window.history.back();
    } else {
      previewRef.current = false;
      setPreviewOpen(false);
      setPreviewProject(null);
    }
  }

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [releaseAction, setReleaseAction] = useState<'publish' | 'restore' | 'offline' | null>(
    null,
  );
  const projectRef = useRef<Project | null>(null),
    baseRef = useRef<Project | null>(null),
    dirtyRef = useRef(false),
    busyRef = useRef('');
  const savingRef = useRef(false);
  savingRef.current = saving;
  const uploadStateRef = useRef<UploadState | null>(null);
  uploadStateRef.current = uploadState;
  const cloneActivityRef = useRef(false);
  cloneActivityRef.current = cloneActivity;
  const [hasBackup, setHasBackup] = useState(false);

  const hasUnsavedChanges = useCallback(() => {
    return dirtyRef.current || savingRef.current || !!uploadStateRef.current || cloneActivityRef.current;
  }, []);
  const actionRequests = useRef(new PendingOperations());
  projectRef.current = project;
  dirtyRef.current = dirty;
  busyRef.current = busy;
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}`;

  const install = useCallback((next: Project) => {
    next = { ...next, draft: withBuildMode(next.draft) };
    setProject(next);
    projectRef.current = next;
    baseRef.current = next;
    dirtyRef.current = false;
    setDirty(false);
    try {
      sessionStorage.removeItem(`wr_draft_${next.id}`);
    } catch {}
    setHasBackup(false);
  }, []);
  const refresh = useCallback(
    async (force = false) => {
      const next = await api<ProjectDetail>(endpoint);
      if (projectRef.current && next.project.version < projectRef.current.version) return next;
      setDetail(next);
      if (force || !dirtyRef.current) {
        install(next.project);
      }
      return next;
    },
    [endpoint, install],
  );
  useEffect(() => {
    let active = true;
    api<ProjectDetail>(endpoint)
      .then((next) => {
        if (active) {
          setDetail(next);
          install(next.project);
          try {
            const raw = sessionStorage.getItem(`wr_draft_${next.project.id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.draft && JSON.stringify(parsed.draft) !== JSON.stringify(next.project.draft)) {
                setHasBackup(true);
              } else {
                sessionStorage.removeItem(`wr_draft_${next.project.id}`);
              }
            }
          } catch {}
          const q = new URL(window.location.href).searchParams.get('tab') as Tab | null;
          setTab(resolveWorkflowTab(next.project.draft, q));
        }
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [endpoint, install]);
  useEffect(() => {
    if (project) setTab(current => resolveWorkflowTab(project.draft, current));
  }, [project?.id, project?.draft.buildBranch]);
  const hasLiveJobs = !!detail?.jobs.some(liveJob);
  useEffect(() => {
    if (!hasLiveJobs) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!busyRef.current && !document.hidden)
        await refresh().catch((error) => {
          if (error instanceof ApiError && error.status !== 401) setError(errorMessage(error));
        });
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [refresh, hasLiveJobs]);
  useEffect(() => {
    const sync = () => { if (!document.hidden && !busyRef.current) void refresh().catch(() => {}); };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); };
  }, [refresh]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [tab]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current || uploadStateRef.current || cloneActivityRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);

    try {
      if (window.history.state?.wrEditor !== projectId)
        window.history.pushState({ ...window.history.state, wrEditor: projectId }, '', window.location.href);
    } catch {}

    const onPopState = (event: PopStateEvent) => {
      // The preview owns one history entry. Back closes it without leaving the editor;
      // Forward restores it. Ignore iframe history events while that entry is active.
      if (event.state?.wrPreview === projectId) {
        previewRef.current = true;
        setPreviewProject(previewSnapshot.current);
        setPreviewOpen(true);
        return;
      }
      if (previewRef.current) {
        previewRef.current = false;
        setPreviewOpen(false);
        setPreviewProject(null);
        return;
      }
      leaveTarget.current = 'projects';
      if (dirtyRef.current || savingRef.current || uploadStateRef.current || cloneActivityRef.current) {
        try {
          window.history.pushState({ wrEditor: projectId }, '', window.location.href);
        } catch {}
        setLeaveOpen(true);
      } else {
        navigation.current.onBack();
      }
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', prevent);
      window.removeEventListener('popstate', onPopState);
    };
  }, [projectId]);
  useEffect(()=>{
    if(!dirty||!project||busy||conflict||autoSaveFailed.current===project||detail?.jobs.some(j=>j.kind==='clone'&&['queued','running','paused'].includes(j.status)))return;
    const timer=setTimeout(()=>{
      if(busyRef.current)return;
      void save().catch(error=>{autoSaveFailed.current=projectRef.current;setError('自动保存失败，修改仍保留在当前页面：'+errorMessage(error));});
    },1500);
    return ()=>clearTimeout(timer);
  },[project,dirty,busy,conflict,detail?.jobs]);
  async function goTo(next:Tab){await action('navigate',async()=>{await save();if(dirtyRef.current)throw new Error('仍有未保存修改，请稍后继续。');setTab(next);});}
  async function switchBuildMode(mode: 'template' | 'clone') {
    await action('switch-mode', async () => {
      await save();
      if (dirtyRef.current) throw new Error('仍有未保存修改，请稍后重试。');
      const latest = await refresh();
      if (latest.jobs.some(blocksModeChange)) throw new Error('请先等待生成或发布任务结束；暂停中的生成任务需先停止，再切换建站方式。');
      const snapshot = projectRef.current!;
      if (snapshot.draft.buildBranch !== mode || latest.project.draft.buildBranch !== mode) {
        const result = await put<{ project: Project }>(endpoint, {
          expectedVersion: snapshot.version, name: snapshot.name,
          draft: { ...snapshot.draft, buildBranch: mode },
        });
        if (projectRef.current === snapshot) install(result.project);
        else {
          // Keep edits typed during this request, while accepting the server's version and mode.
          baseRef.current = result.project;
          const next = { ...projectRef.current!, version: result.project.version, draft: { ...projectRef.current!.draft, buildBranch: mode } };
          projectRef.current = next;
          setProject(next);
          dirtyRef.current = true;
          setDirty(true);
        }
      }
      setSeoReport(null);
      setTab(mode === 'template' ? 'template' : 'clone-generate');
    }, '建站方式已保存，资料与素材已保留。');
  }
  const restoreBackup = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(`wr_draft_${projectId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.draft) {
          update(() => parsed.draft);
          if (parsed.name && projectRef.current) {
            const next = { ...projectRef.current, name: parsed.name };
            projectRef.current = next;
            setProject(next);
          }
          setNotice('已恢复未保存的本地草稿修改。');
        }
      }
    } catch {}
    setHasBackup(false);
  }, [projectId]);

  const discardBackup = useCallback(() => {
    try {
      sessionStorage.removeItem(`wr_draft_${projectId}`);
    } catch {}
    setHasBackup(false);
  }, [projectId]);

  function update(updater: (draft: Draft) => Draft) {
    const current = projectRef.current;
    if (!current) return;
    const next = { ...current, draft: updater(current.draft) };
    resetConsultationForEdit(baseRef.current?.draft ?? current.draft, next.draft);
    resetDesignForEdit(baseRef.current?.draft ?? current.draft, next.draft);
    projectRef.current = next;
    const changed = JSON.stringify({ name: next.name, draft: next.draft }) !==
      JSON.stringify({ name: baseRef.current?.name, draft: baseRef.current?.draft });
    dirtyRef.current = changed;
    setDirty(changed);
    setProject(next);
    try {
      if (changed) {
        sessionStorage.setItem(
          `wr_draft_${projectId}`,
          JSON.stringify({ name: next.name, draft: next.draft, updatedAt: Date.now() }),
        );
      } else {
        sessionStorage.removeItem(`wr_draft_${projectId}`);
      }
    } catch {}
  }
  function patch(fields: Partial<Draft>) {
    update((draft) => ({ ...draft, ...fields }));
  }
  function company(fields: Partial<Company>) {
    update((draft) => ({ ...draft, company: { ...draft.company, ...fields } }));
  }
  function productChange(id: string, fields: Partial<Product>) {
    update((draft) => ({
      ...draft,
      products: draft.products.map((product) =>
        product.id === id ? { ...product, ...fields } : product,
      ),
    }));
  }
  async function save(): Promise<Project> {
    if(saveInFlight.current){await saveInFlight.current;if(dirtyRef.current)return save();return projectRef.current!;}
    setSaving(true);
    const request=saveSnapshot();saveInFlight.current=request;
    try{return await request;}finally{saveInFlight.current=null;setSaving(false);}
  }
  async function saveSnapshot(retry = true): Promise<Project> {
    const snapshot = projectRef.current;
    if (!snapshot) throw new Error('项目尚未载入。');
    if (!dirtyRef.current) return snapshot;
    try {
      const result = await put<{ project: Project }>(endpoint, {
        expectedVersion: snapshot.version,
        name: snapshot.name,
        draft: snapshot.draft,
      });
      if (projectRef.current === snapshot) install(result.project);
      else {
        baseRef.current = result.project;
        const local = projectRef.current;
        const next = local ? { ...local, version: result.project.version } : result.project;
        projectRef.current = next;
        setProject(next);
      }
      return result.project;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'version_conflict') {
        const next = await api<ProjectDetail>(endpoint);
        const merged = mergeVersions(baseRef.current || snapshot, projectRef.current || snapshot, next.project);
        if (retry && !merged.conflicts.length) {
          baseRef.current = next.project;
          projectRef.current = merged.value;
          setProject(merged.value);
          return saveSnapshot(false);
        }
        setConflict(next.project);
        setChoices({});
      }
      throw error;
    }
  }
  async function action(key: string, fn: () => Promise<unknown>, success?: string) {
    if (busyRef.current) return;
    setBusy(key);
    busyRef.current = key;
    setError('');
    setNotice('');
    try {
      await fn();
      if (success) setNotice(success);
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500)
        actionRequests.current.complete(key);
      setError(errorMessage(error));
    } finally {
      setBusy('');
      busyRef.current = '';
    }
  }
  async function saveClick() {
    await action('save', () => save(), '草稿已保存。线上网站保持当前发布版本。');
  }
  async function command(path: string, body: Record<string, unknown> = {}) {
    const saved = await save();
    if (dirtyRef.current) throw new Error('保存期间又有新的修改，请先保存当前内容再继续。');
    const sent = projectRef.current!;
    const result = await post<{ project: Project }>(`${endpoint}/${path}`, {
      expectedVersion: saved.version,
      ...body,
    });
    const local = projectRef.current!;
    if (local === sent) install(result.project);
    else {
      const merged = mergeVersions(sent, local, result.project);
      if (merged.conflicts.length) {
        setConflict(result.project);
        setChoices({});
      } else {
        baseRef.current = result.project;
        projectRef.current = merged.value;
        setProject(merged.value);
      }
      // Input typed while the request was in flight remains an explicit unsaved edit.
      dirtyRef.current = true;
      setDirty(true);
    }
    await refresh();
    return result.project;
  }
  async function generate(
    kind: 'image' | 'site-build',
    pageId?: DesignPage | 'remaining',
    instructions?: string,
  ) {
    const key = `job:${kind}:${pageId || 'all'}`;
    await action(
      key,
      async () => {
        const saved = await save();
        if (dirtyRef.current) throw new Error('请保存最新修改后再次开始。');
        await post(
          `${endpoint}/jobs`,
          actionRequests.current.body(key, {
            expectedVersion: saved.version,
            kind,
            ...(pageId ? { pageId } : {}),
            ...(instructions ? { instructions } : {}),
          }),
        );
        actionRequests.current.complete(key);
        await refresh();
      },
      '任务已提交。你可以离开页面，稍后回来查看进度。',
    );
  }
  async function consult(
    input: {
      questionId?: string;
      answer?: string;
      instructions?: string;
      restart?: boolean;
    } = {},
  ) {
    const key = 'job:consultation';
    await action(
      key,
      async () => {
        const saved = await save();
        if (dirtyRef.current) throw new Error('保存期间又有新的修改，请先保存当前内容再继续。');
        await post(
          `${endpoint}/jobs`,
          actionRequests.current.body(key, {
            expectedVersion: saved.version,
            kind: 'consultation',
            ...input,
          }),
        );
        actionRequests.current.complete(key);
        await refresh();
      },
      '已提交需求沟通任务，进度会保存在项目中。',
    );
  }
  async function upload(file: File, apply: (asset: Asset) => void) {
    await action(
      'upload',
      async () => {
        const form = new FormData();
        form.append('file', file);
        const controller = new AbortController();
        uploadController.current = controller;
        const startedAt = Date.now();
        setUploadState({ name: file.name, fraction: 0, startedAt });
        let result: { asset: Asset };
        try {
          result = await uploadAsset<{ asset: Asset }>(`${endpoint}/uploads`, form,
            fraction => setUploadState({ name: file.name, fraction, startedAt }), controller.signal);
        } finally { setUploadState(null); uploadController.current = null; }
        setDetail((current) =>
          current ? { ...current, assets: [...current.assets, result.asset] } : current,
        );
        apply(result.asset);
      },
      '素材已上传，请保存草稿或确认选用。',
    );
  }
  async function uploadBanner(id: string, slot: BannerUploadSlot, files: File[]) {
    await action('upload-banner', async () => {
      const existing=editableBanners(projectRef.current!.draft).find(b=>b.id===id);
      if(!existing) throw new Error('Banner 配置已变化，请重试。');
      if(slot==='slides' && existing.slides.length+files.length>12) throw new Error('每组最多 12 张图片，请减少选择的文件。');
      const controller=new AbortController();uploadController.current=controller;
      try {
        for(const [index,file] of files.entries()) {
          if(controller.signal.aborted) throw new DOMException('已取消上传','AbortError');
          const form=new FormData();form.append('file',file);
          const name=`${index+1}/${files.length} · ${file.name}`,startedAt=Date.now();
          setUploadState({name,fraction:0,startedAt});
          const {asset}=await uploadAsset<{asset:Asset}>(`${endpoint}/uploads`,form,fraction=>setUploadState({name,fraction,startedAt}),controller.signal);
          setDetail(current=>current?{...current,assets:[...current.assets,asset]}:current);
          update(draft=>({...draft,banner:undefined,banners:editableBanners(draft).map(b=>b.id!==id?b:slot==='slides'?{...b,slides:[...b.slides,{assetId:asset.id,alt:''}]}:slot==='video'?{...b,videoAssetId:asset.id}:{...b,posterAssetId:asset.id})}));
        }
      } finally {setUploadState(null);uploadController.current=null;}
    }, '媒体已上传并加入 Banner，请保存草稿；已成功上传的文件会保留。');
  }
  async function getSources(offset = 0) {
    await action('sources', async () => {
      const result = await api<{ products: ProductSnapshot[]; total: number }>(
        `/api/source-products?offset=${offset}&limit=20`,
      );
      setSourceProducts(result.products);
      setSourceTotal(result.total);
      setSourceOffset(offset);
      setSourceOpen(true);
    });
  }
  async function importSources() {
    await action(
      'import',
      async () => {
        await command('import', { productIds: sourceIds });
        setSourceOpen(false);
        setSourceIds([]);
      },
      '所选产品和图片已复制为网站独立快照。',
    );
  }
  async function checkSources() {
    await action('source-check', async () => {
      await save();
      const result = await post<{ changes: SourceChange[] }>(`${endpoint}/source-check`);
      setSourceChanges(result.changes);
      setApplyIds([]);
    });
  }
  async function loadInquiries() {
    try {
      const result = await api<{ inquiries: Inquiry[] }>(`${endpoint}/inquiries`);
      setInquiries(result.inquiries);
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  useEffect(() => {
    if (tab === 'inquiries') {
      void loadInquiries();
      const timer = setInterval(() => void loadInquiries(), 10000);
      return () => clearInterval(timer);
    }
  }, [tab, endpoint]);
  async function generateClone(config: CloneConfig): Promise<Project> {
    if (busyRef.current) throw new Error('当前操作尚未完成，请稍后重试。');
    setBusy('clone-generate');
    busyRef.current = 'clone-generate';
    try {
      patch({ buildBranch: 'clone', cloneConfig: { ...projectRef.current?.draft.cloneConfig, ...config } });
      return await command('clone/start', { cloneConfig: config, requestId: requestId(), autoPublish: config.autoPublish === true });
    } finally {
      setBusy('');
      busyRef.current = '';
    }
  }
  async function publishClone(generated: Project): Promise<Job> {
    // Publish exactly the version returned by generation; never a stale prop or a later edit.
    return post<{ job: Job }>(`${endpoint}/publish`, {
      expectedVersion: generated.version,
      requestId: requestId(),
    }).then(result => result.job);
  }
  async function checkSeo() {
    await action('seo', async () => {
      await save();
      if (dirtyRef.current) throw new Error('请先保存当前修改后再检查 SEO。');
      setSeoReport(await api(`${endpoint}/seo`));
    });
  }
  async function openPreview() {
    await action('preview', async () => {
      await save();
      showPreview();
    });
  }
  async function publishAction() {
    if (!releaseAction) return;
    const name = releaseAction;
    await action(
      name,
      async () => {
        if (name === 'offline') {
          await command('offline');
        } else if (name === 'publish') {
          const saved = await save();
          if (dirtyRef.current) throw new Error('请先保存当前修改，再发布。');
          await post(
            `${endpoint}/publish`,
            actionRequests.current.body('publish', { expectedVersion: saved.version }),
          );
          actionRequests.current.complete('publish');
          await refresh();
        } else {
          await post(`${endpoint}/restore`, actionRequests.current.body('restore', {}));
          actionRequests.current.complete('restore');
          await refresh();
        }
        setReleaseAction(null);
      },
      name === 'offline'
        ? '网站已下线。项目和询盘记录已保留。'
        : '发布任务已提交，请等待发布记录确认结果。',
    );
  }
  function downloadLocal() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(projectRef.current, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `web-radar-unsaved-${projectId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const merger =
    conflict && project && baseRef.current
      ? mergeVersions(
          { name: baseRef.current.name, draft: baseRef.current.draft },
          { name: project.name, draft: project.draft },
          { name: conflict.name, draft: conflict.draft },
          choices,
        )
      : null;
  async function saveMerge() {
    if (!conflict || !merger || merger.conflicts.length) return;
    await action(
      'merge',
      async () => {
        const result = await put<{ project: Project }>(endpoint, {
          expectedVersion: conflict.version,
          ...merger.value,
        });
        install(result.project);
        setConflict(null);
        await refresh();
      },
      '合并后的草稿已保存。',
    );
  }

  if (!project || !detail)
    return (
      <div className="editor-loading">
        <Brand />
        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <p>
            <span className="spinner" />
            正在打开网站工作室…
          </p>
        )}
        <Button onClick={() => requestLeave()}>
          <Icon name="back" />
          返回网站列表
        </Button>
      </div>
    );
  if (!writeBusiness(principal)) return (
    <div className="editor-shell">
      <header className="editor-topbar"><div className="editor-brand">
        <Button onClick={() => requestLeave()}><Icon name="back"/>返回网站列表</Button>
        <a className="editor-home-link" href="?view=dashboard" aria-label="Web Radar · 返回控制台首页" onClick={event=>{event.preventDefault();requestLeave('home')}}><Brand/></a>
      </div></header>
      <main className="panel" style={{margin:'32px'}}><h1>{project.name}</h1><Notice>当前角色仅可查看项目，不能修改、生成或发布。</Notice>
        <p>创建者：{project.ownerId} · 创建时间：{dateTime(project.createdAt)}</p>
        <p>产品数量：{project.draft.products.length} · 草稿版本：V{project.version}</p>
        <Button onClick={()=>showPreview()}><Icon name="eye"/>打开私有整站预览</Button>
      </main>
      {previewOpen&&<SitePreview project={project} onClose={closePreview}/>}
    </div>
  );
  const draft = project.draft;
  const onlineRelease = detail.releases.find(release => release.id === project.publishedReleaseId && release.status === 'succeeded');
  const alreadyPublished = !project.offline && !!onlineRelease?.draft && samePublishedDraft(draft, onlineRelease.draft) && (!project.deployment || matchesDeployment(onlineRelease.hostingTarget,project.deployment,true));
  const activeJobs = detail.jobs.filter((job) =>
    ['queued', 'running', 'unknown'].includes(job.status),
  );
  const availableImages = detail.quota.unlimited
    ? Infinity
    : Math.max(0, detail.quota.imageLimit - detail.quota.imageUsed - detail.quota.imageReserved);
  const siteReady = staticSiteReady(draft);
  const designsReady = designsConfirmed(draft.siteDesign);
  const buildPending = activeJobs.some((job) => job.kind === 'site-build');
  const builderConfigured = services.some(
    (service) => service.name === 'site-builder' && service.configured,
  );
  const checklist = draftChecklist(draft);
  const basicsReady = checklist
    .filter((item) => item.step === 'basics')
    .every((item) => item.ready);
  const consultationActive = activeJobs.some((job) => job.kind === 'consultation');
  const briefReady = briefConfirmed(draft);
  const pagePlan = plannedPages(draft);
  const publicationMissing = checklist.filter((item) => !item.ready).map((item) => item.label);
  const currentWorkflowSteps = getWorkflowSteps(draft);
  const stepDone: Record<Tab, boolean> = {
    basics: basicsReady,
    template: Boolean(draft.templateConfirmed),
    'clone-generate': Boolean(
      hasCloneOutput(draft.cloneConfig),
    ),
    consultation: !!draft.consultation?.brief,
    brief: briefReady,
    design: designsReady,
    publish: !!project.publishedReleaseId && !project.offline,
    inquiries: false,
  };
  return (
    <div className={`editor-shell ${embedded ? 'is-embedded' : ''}`}>
      {historyOpen && <Modal title="项目历史记录" onClose={() => setHistoryOpen(false)}><ProjectHistory projectId={projectId} /></Modal>}
      <header className="editor-topbar">
        <div className="editor-brand">
          <Button
            kind="quiet"
            onClick={() => requestLeave()}
            aria-label="返回网站列表"
          >
            <Icon name="back" />
          </Button>
          <a className="editor-home-link" href="?view=dashboard" aria-label="Web Radar · 返回控制台首页" onClick={event => { event.preventDefault(); requestLeave('home'); }}>
            <Brand />
          </a>
          <span className="editor-slash">/</span>
          <div className="editor-project-name">
            <strong>{project.name}</strong>
            <span className="pill muted">
              {!project.publishedReleaseId
                ? '未发布草稿'
                : project.offline
                  ? '已下线'
                  : '已发布 · 编辑草稿'}
            </span>
          </div>
        </div>
        <div className="editor-top-actions">
          <span className={`save-state ${dirty ? 'unsaved' : ''}`}>
            <i />
            {saving ? '保存中…' : dirty ? '待自动保存' : `已保存 · V${project.version}`}
          </span>
          <Button
            kind="primary"
            onClick={saveClick}
            busy={busy === 'save'}
            disabled={!dirty || !!busy}
          >
            保存草稿
          </Button>
          <Button onClick={openPreview} busy={busy === 'preview'} disabled={!!busy || !siteReady}>
            <Icon name="eye" />
            整站预览
          </Button>
        </div>
      </header>
      <div className="editor-body">
        <aside className="editor-sidebar">
          <div className="editor-sidebar-caption">
            {draft.buildBranch === 'clone' ? '网址 / 设计稿建站' : draft.buildBranch === 'custom' ? 'AI 定制建站 (5步)' : '模板建站 (3步)'}
          </div>
          <nav aria-label="网站编辑步骤">
            {currentWorkflowSteps.map(([id, label, icon], index) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                aria-current={tab === id ? 'step' : undefined}
                onClick={() => {
                  void goTo(id);
                }}
              >
                <span className="step-number">
                  {stepDone[id] ? (
                    <Icon name="check" size={14} />
                  ) : (
                    String(index + 1).padStart(2, '0')
                  )}
                </span>
                <span>{label}</span>
                <Icon name={icon} size={16} />
              </button>
            ))}
          </nav>
          <nav className="editor-management" aria-label="网站管理">
            <button
              className={tab === 'inquiries' ? 'active' : ''}
              aria-current={tab === 'inquiries' ? 'page' : undefined}
              onClick={() => {
                setTab('inquiries');
                setError('');
                setNotice('');
              }}
            >
              <Icon name="mail" size={16} />
              <span>客户询盘</span>
            </button>
          </nav>
          <div className="editor-sidebar-bottom">
            <div className="quota-card">
              <div>
                <Icon name="spark" />
                <strong>可用生成额度</strong>
              </div>
              <dl>
                <dt>页面设计图</dt>
                <dd>
                  {detail.quota.unlimited ? '不限额' : availableImages}
                  {!detail.quota.unlimited && <span>张</span>}
                </dd>
              </dl>
              <p>
                生成按发起账号计数
                <br />
                技术失败自动退回
              </p>
              {detail.quota.imageReserved > 0 && (
                <small>处理中预留：图片 {detail.quota.imageReserved}</small>
              )}
            </div>
            <div className="editor-owner">
              <span className="avatar">{principal.displayName.slice(0, 1)}</span>
              <div>
                <strong>{principal.displayName}</strong>
                <small>{principal.workspaceName}</small>
              </div>
            </div>
          </div>
        </aside>
        <main className="editor-main">
          <div className="editor-breadcrumb">
            {project.name}
            <span>/</span>
            {project.materials&&tab==='template'?'页面资料':allTabLabels[tab]}
            <span className="private-tag">
              <Icon name="lock" size={12} />
              私有草稿
            </span>
          </div>
          {!project.materials&&<section className="build-mode-switcher" aria-label="建站方式切换">
            <div><strong>建站方式</strong><p>{draft.buildBranch === 'custom' ? '当前为已有定制项目（5步）。' : '模板与网址 / 设计稿可随时切换。'} 切换会保存资料与素材，线上版本在重新发布后更新。</p></div>
            <div className="build-mode-options">
              <Button aria-pressed={draft.buildBranch === 'template'} kind={draft.buildBranch === 'template' ? 'primary' : undefined} disabled={!!busy || saving || cloneActivity || !!uploadState || detail.jobs.some(blocksModeChange)} onClick={() => void switchBuildMode('template')}>模板建站</Button>
              <Button aria-pressed={draft.buildBranch === 'clone'} kind={draft.buildBranch === 'clone' ? 'primary' : undefined} disabled={!!busy || saving || cloneActivity || !!uploadState || detail.jobs.some(blocksModeChange)} onClick={() => void switchBuildMode('clone')}>网址 / 设计稿建站</Button>
            </div>
            {detail.jobs.some(blocksModeChange) && <small>生成或发布任务结束后可切换；暂停中的生成任务请先停止。</small>}
          </section>}
          {project.materials&&<Notice tone="success">Product Radar 已确认的网站资料已接收。可直接预览，或继续调整品牌、产品与页面内容。</Notice>}
          {services.some((service) => service.mode === 'unconfigured') && (
            <details className="editor-services">
              <summary>部分服务尚未接通 · 点击查看</summary>
              {services
                .filter((service) => service.mode === 'unconfigured')
                .map((service) => (
                  <p key={service.name}>
                    <strong>{service.name}</strong> {service.detail}
                  </p>
                ))}
            </details>
          )}
          {uploadState && <UploadProgress state={uploadState} onCancel={() => uploadController.current?.abort()} />}
          {error && <Notice tone="error">{error}</Notice>}
          {notice && <Notice tone="success">{notice}</Notice>}
          {hasBackup && (
            <Notice tone="warning">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span>检测到上次会话中有未同步的本地草稿修改。</span>
                <div style={{ display: 'inline-flex', gap: 8 }}>
                  <Button kind="secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={restoreBackup}>
                    恢复草稿
                  </Button>
                  <Button kind="quiet" style={{ padding: '2px 8px', fontSize: 12 }} onClick={discardBackup}>
                    忽略
                  </Button>
                </div>
              </div>
            </Notice>
          )}
          {detail.project.version !== project.version && dirty && (
            <Notice tone="warning">
              服务器上已有更新。你的本地修改已保留，保存时会显示版本差异。
            </Notice>
          )}
          {tab === 'basics' && (
            <>
              <SectionTitle
                eyebrow={draft.buildBranch === 'custom' ? '第 1 步 / 共 5 步' : '第 1 步 / 共 3 步'}
                title="资料与产品"
                description={draft.buildBranch==='clone'?'这些信息可在生成预览后补充；发布前填写公司 / 品牌名称和联系邮箱。':'先填写公司名称、联系邮箱与产品，再选择目标市场。品牌图片和补充资料可稍后完善。'}
              />
              <section className="panel">
                <div className="panel-title">
                  <span className="section-index">A</span>
                  <h3>公司与联系资料</h3>
                  <span>先填写基本信息，再补充品牌与业务资料</span>
                </div>
                {draft.buildBranch==='custom' && draft.siteDesign?.build?.artifactKey && <Notice>邮箱、电话、WhatsApp、Banner 和网站图标可直接修改后预览。公司介绍、产品或设计方向变更会重置设计确认，需要重新生成；已发布版本仍保留。</Notice>}
                <CompanyFields value={draft.company} disabled={!!busy} onChange={company} />
                <details className="optional-setup"><summary>Logo 与网站图标（选填）</summary><div className="brand-upload-grid">
                <div className="logo-upload-row">
                  <AssetView
                    projectId={project.id}
                    assetId={draft.company.logoAssetId}
                    alt="公司 Logo"
                  />
                  <div>
                    <strong>
                      公司 Logo <span className="optional">选填</span>
                    </strong>
                    <p>没有 Logo 时，网站会使用公司名称。</p>
                    <UploadButton
                      label="上传 Logo"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={!!busy}
                      onFile={(file) => upload(file, (asset) => company({ logoAssetId: asset.id }))}
                    />
                    {draft.company.logoAssetId && (
                      <Button kind="quiet" onClick={() => company({ logoAssetId: undefined })}>
                        移除
                      </Button>
                    )}
                  </div>
                </div>
                <div className="logo-upload-row">
                  <AssetView projectId={project.id} assetId={draft.company.faviconAssetId} alt="网站图标 Favicon" />
                  <div>
                    <strong>网站图标 Favicon <span className="optional">选填</span></strong>
                    <p>显示在浏览器标签页。建议上传 32×32 或 48×48 的正方形 PNG / ICO，也支持 WebP、JPEG。</p>
                    <UploadButton
                      label="上传网站图标"
                      accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico"
                      disabled={!!busy}
                      onFile={(file) => upload(file, (asset) => company({ faviconAssetId: asset.id }))}
                    />
                    {draft.company.faviconAssetId && (
                      <Button kind="quiet" onClick={() => company({ faviconAssetId: undefined })}>移除图标</Button>
                    )}
                  </div>
                </div>
                </div></details>
                <details className="optional-setup">
                  <summary>
                    关于我们（About Us）页面图文与实力定制（选填）
                    {draft.company.aboutImageAssetId || draft.company.aboutSecondaryImageAssetId || draft.company.aboutHeadline || draft.company.aboutStory || draft.company.aboutHighlights ? ' · 已配置' : ''}
                  </summary>
                  <p className="muted" style={{ margin: '8px 0 16px' }}>
                    可为全站所有模版的关于我们（About Us）页面定制图文共存展示、专属大标、企业深度使命与动态数据亮点。留空时模版将使用公司简介并自动匹配高品质视觉。
                  </p>
                  <div className="brand-upload-grid" style={{ marginBottom: 20 }}>
                    <div className="logo-upload-row">
                      <AssetView
                        projectId={project.id}
                        assetId={draft.company.aboutImageAssetId}
                        alt="关于页主视觉图"
                      />
                      <div>
                        <strong>关于页主视觉图 <span className="optional">选填</span></strong>
                        <p>展示于关于页核心图文区。推荐上传企业全景、现代化厂房、研发团队或主展厅实景照（16:9 或 4:3 比例佳）。</p>
                        <UploadButton
                          label="上传关于页主图"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={!!busy}
                          onFile={(file) => upload(file, (asset) => company({ aboutImageAssetId: asset.id }))}
                        />
                        {draft.company.aboutImageAssetId && (
                          <Button kind="quiet" onClick={() => company({ aboutImageAssetId: undefined })}>
                            移除主图
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="logo-upload-row">
                      <AssetView
                        projectId={project.id}
                        assetId={draft.company.aboutSecondaryImageAssetId}
                        alt="车间/实验室/环境副图"
                      />
                      <div>
                        <strong>车间/实验室/环境副图 <span className="optional">选填</span></strong>
                        <p>展示于实力保障或生产制造专区。推荐上传生产线细节、精密检验设备或资质展位照。</p>
                        <UploadButton
                          label="上传环境副图"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={!!busy}
                          onFile={(file) => upload(file, (asset) => company({ aboutSecondaryImageAssetId: asset.id }))}
                        />
                        {draft.company.aboutSecondaryImageAssetId && (
                          <Button kind="quiet" onClick={() => company({ aboutSecondaryImageAssetId: undefined })}>
                            移除副图
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="form-grid">
                    <Field
                      className="full-width"
                      label="关于页专属主标语（选填）"
                      hint="展示在关于页面的首屏大标题，留空时使用模版默认推荐标语或品牌一句话介绍。"
                    >
                      <input
                        aria-label="关于页专属主标语（选填）"
                        value={draft.company.aboutHeadline || ''}
                        onChange={(e) => company({ aboutHeadline: e.target.value })}
                        placeholder="例如：15年专注高精密智能制造与全球出海交付"
                        maxLength={300}
                      />
                    </Field>
                    <Field
                      className="full-width"
                      label="企业深度故事与使命（选填）"
                      hint="详细阐述企业创立初衷、核心价值观、工艺理念与客户承诺；支持多段落。留空时使用公司简介。"
                    >
                      <textarea
                        aria-label="企业深度故事与使命（选填）"
                        rows={4}
                        value={draft.company.aboutStory || ''}
                        onChange={(e) => company({ aboutStory: e.target.value })}
                        placeholder="描述企业的创立历程、制造哲学、全球服务足迹与对客户的坚定承诺..."
                        maxLength={20000}
                      />
                    </Field>
                    <Field
                      className="full-width"
                      label="核心优势与数据亮点（选填）"
                      hint="每行一条，可填写数字与说明（支持 '数值 | 说明' 格式，如 '10,000+ m² | 生产制造基地'，页面将自动驱动动态计数动画）。"
                    >
                      <textarea
                        aria-label="核心优势与数据亮点（选填）"
                        rows={3}
                        value={draft.company.aboutHighlights || ''}
                        onChange={(e) => company({ aboutHighlights: e.target.value })}
                        placeholder={'例如：\n10,000+ m² | 现代化智能厂区\n60+ | 全球出海合作国家与地区\n99.8% | 交付准时率与满意度\n100% | 环保原材料与国际安全认证'}
                        maxLength={2000}
                      />
                    </Field>
                  </div>
                </details>
              </section>
              <details className="optional-setup"><summary>页面 Banner / 视频（选填，也可在预览后设置）</summary>
              <BannerEditor projectId={project.id} draft={draft} disabled={!!busy}
                onChange={banners => patch({banners,banner:undefined})} onUpload={uploadBanner} /></details>
              <section className="panel">
                <div className="panel-title">
                  <span className="section-index">B</span>
                  <h3>产品与主角</h3>
                  <span>{draft.products.length} / 20 个产品</span>
                  <div className="panel-title-actions">
                    {draft.products.some((p) => p.source) && (
                      <Button
                        kind="quiet"
                        onClick={checkSources}
                        busy={busy === 'source-check'}
                        disabled={!!busy}
                      >
                        <Icon name="refresh" />
                        检查来源更新
                      </Button>
                    )}
                    <Button
                      onClick={() => getSources()}
                      busy={busy === 'sources'}
                      disabled={!!busy || draft.products.length >= 20}
                    >
                      从 Product Radar 导入
                      <Icon name="arrow" size={15} />
                    </Button>
                  </div>
                </div>
                {draft.products.length === 0 ? (
                  <Empty
                    icon="image"
                    title="添加产品，选出你的主角"
                    action={
                      <Button onClick={() => addProduct()}>
                        <Icon name="plus" />
                        手动添加产品
                      </Button>
                    }
                  >
                    上传产品照片，或导入 Product Radar 中有权限的产品。每站最多 20 个。
                  </Empty>
                ) : (
                  <div className="product-edit-list">
                    {draft.products.map((product, index) => (
                      <article className="product-edit-card" key={product.id}>
                        <div className="product-image-column">
                          <AssetView
                            projectId={project.id}
                            assetId={product.imageAssetId}
                            alt={product.name}
                          />
                          <UploadButton
                            label="更换图片"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={!!busy}
                            onFile={(file) =>
                              upload(file, (asset) =>
                                productChange(product.id, { imageAssetId: asset.id }),
                              )
                            }
                          />
                        </div>
                        <div className="product-edit-fields">
                          <div className="product-row-top">
                            <span className="product-index">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <button
                              className={`primary-product ${draft.primaryProductId === product.id ? 'selected' : ''}`}
                              onClick={() => patch({ primaryProductId: product.id })}
                            >
                              <span />
                              {draft.primaryProductId === product.id
                                ? '主产品 · 首页展示'
                                : '设为主产品'}
                            </button>
                            {product.source && (
                              <span className="source-tag">Product Radar 快照</span>
                            )}
                            <div className="product-tools">
                              <Button
                                kind="quiet"
                                aria-label={`上移产品 ${index + 1}`}
                                disabled={index === 0}
                                onClick={() => moveProduct(index, -1)}
                              >
                                <Icon name="up" size={14} />
                              </Button>
                              <Button
                                kind="quiet"
                                aria-label={`下移产品 ${index + 1}`}
                                disabled={index === draft.products.length - 1}
                                onClick={() => moveProduct(index, 1)}
                              >
                                <Icon name="down" size={14} />
                              </Button>
                              <Button
                                kind="quiet"
                                aria-label={`移除产品 ${index + 1}`}
                                onClick={() => removeProduct(product.id)}
                              >
                                <Icon name="close" size={15} />
                              </Button>
                            </div>
                          </div>
                          <Field label="产品英文名称">
                            <input
                              value={product.name}
                              onChange={(e) => productChange(product.id, { name: e.target.value })}
                              placeholder="Product name"
                              maxLength={160}
                            />
                          </Field>
                          <Field label="产品介绍">
                            <textarea
                              rows={2}
                              value={product.description}
                              onChange={(e) =>
                                productChange(product.id, { description: e.target.value })
                              }
                              placeholder="描述产品用途、外观和经过确认的特点"
                            />
                          </Field>
                          <div className="form-grid">
                            <Field label="材质">
                              <input
                                value={product.material}
                                onChange={(e) =>
                                  productChange(product.id, { material: e.target.value })
                                }
                                placeholder="Known material"
                              />
                            </Field>
                            <Field label="尺寸">
                              <input
                                value={product.dimensions}
                                onChange={(e) =>
                                  productChange(product.id, { dimensions: e.target.value })
                                }
                                placeholder="Known dimensions"
                              />
                            </Field>
                          </div>
                          {product.source && (
                            <details className="source-details">
                              <summary>查看来源与设计条件</summary>
                              <p>
                                来源版本：{product.source.version.slice(0, 16)} ·
                                生成概念，需自行核实规格
                              </p>
                              <p>{product.source.designDirection}</p>
                              <pre>{JSON.stringify(product.source.conditions, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {draft.products.length > 0 && (
                  <Button
                    className="add-product"
                    onClick={addProduct}
                    disabled={draft.products.length >= 20}
                  >
                    <Icon name="plus" />
                    手动添加产品
                  </Button>
                )}
              </section>
              <section className="panel">
                <div className="panel-title">
                  <span className="section-index">C</span>
                  <h3>市场与网站语言</h3>
                  <span>英文为基础，可添加一种第二语言</span>
                </div>
                <div className="form-grid three">
                  <Field label="产品类目">
                    <select
                      value={draft.category}
                      onChange={(e) => patch({ category: e.target.value })}
                    >
                      {[
                        ['toys', '玩具'],
                        ['electronics', '电子产品'],
                        ['outdoor', '户外用品'],
                        ['kitchen', '厨房用品'],
                        ['general', '通用 / 其他'],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="销售国家 / 市场">
                    <input
                      value={draft.country}
                      onChange={(e) => patch({ country: e.target.value })}
                      placeholder="例如：United States, Germany"
                    />
                  </Field>
                  <Field label="第二语言">
                    <select
                      value={draft.languages.find((l) => l !== 'en') || ''}
                      onChange={(e) =>
                        patch({
                          languages: e.target.value ? ['en', e.target.value as Language] : ['en'],
                        })
                      }
                    >
                      <option value="">仅英语</option>
                      {Object.entries(languageNames)
                        .filter(([id]) => id !== 'en')
                        .map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
              </section>
              <details className="panel optional-setup"><summary>项目名称与社交链接（选填）</summary>
                <div className="panel-title">
                  <span className="section-index">D</span>
                  <h3>工作台与社交链接</h3>
                  <span>社交链接会显示在网站联系信息中</span>
                </div>
                <div className="form-grid">
                  <Field label="项目名称" hint="只显示在工作台，不作为网站标题">
                    <input
                      value={project.name}
                      onChange={(e) => {
                        const next={ ...projectRef.current!, name: e.target.value };
                        projectRef.current=next;setProject(next);
                        setDirty(true);
                        dirtyRef.current = true;
                      }}
                      maxLength={120}
                    />
                  </Field>
                  <Field label="LinkedIn">
                    <input
                      type="url"
                      value={draft.company.linkedin || ''}
                      onChange={(e) => company({ linkedin: e.target.value })}
                      placeholder="https://linkedin.com/company/yourbrand"
                    />
                  </Field>
                  <Field label="Facebook">
                    <input
                      type="url"
                      value={draft.company.facebook}
                      onChange={(e) => company({ facebook: e.target.value })}
                      placeholder="https://facebook.com/yourbrand"
                    />
                  </Field>
                  <Field label="Instagram">
                    <input
                      type="url"
                      value={draft.company.instagram}
                      onChange={(e) => company({ instagram: e.target.value })}
                      placeholder="https://instagram.com/yourbrand"
                    />
                  </Field>
                  <Field label="X">
                    <input
                      type="url"
                      value={draft.company.x}
                      onChange={(e) => company({ x: e.target.value })}
                      placeholder="https://x.com/yourbrand"
                    />
                  </Field>
                </div>
              </details>

              <StepFooter
                hint={
                  draft.buildBranch === 'clone'
                    ? '进入设计稿配置与视觉生成流程。'
                    : draft.buildBranch === 'custom'
                      ? 'AI 会结合产品图片和这些资料，一次只确认一个设计问题。'
                      : '选择精选模版后，系统将秒级自动拼装并呈现可交付的电脑与手机端预览。'
                }
                next={
                  draft.buildBranch === 'clone'
                    ? '下一步：像素级生成'
                    : draft.buildBranch === 'custom'
                      ? '下一步：需求沟通'
                      : '下一步：选择网站模版'
                }
                onNext={() =>
                  void goTo(
                    draft.buildBranch === 'clone'
                      ? 'clone-generate'
                      : draft.buildBranch === 'custom'
                        ? 'consultation'
                        : 'template',
                  )
                }
              />
            </>
          )}
          {tab === 'template' && (
            project.materials&&draft.materials?<MaterialsEditor projectId={project.id} draft={draft} disabled={!!busy||saving} onChange={patch} onUpload={upload} onPreview={openPreview}/>:(
              <ErrorBoundary
                scope="section"
                title="模板选择器加载异常"
                description="模板组件渲染出错，您可以点击重试。"
              >
                <Suspense fallback={<div className="chunk-loading"><span className="chunk-spinner" />正在加载…</div>}>
                  <TemplateSelector
                    onPreview={(template) => {
                      const current = projectRef.current!;
                      showPreview({ ...current, draft: { ...current.draft, buildBranch: 'template', template: template.id, brandColor: template.accentColor, cloneConfig: undefined, siteDesign: undefined } });
                    }}
                    draft={draft}
                    onUpdateDraft={(patchObj) => patch(patchObj)}
                    onProceedToPublish={() => void goTo('publish')}
                    onBackToBasics={() => void goTo('basics')}
                    onSwitchToClone={() => void switchBuildMode('clone')}
                  />
                </Suspense>
              </ErrorBoundary>
            )
          )}
          {tab === 'clone-generate' && (
            <ErrorBoundary
              scope="section"
              title="站点克隆器加载异常"
              description="克隆组件渲染出错，您可以点击重试。"
            >
              <Suspense fallback={<div className="chunk-loading"><span className="chunk-spinner" />正在加载…</div>}>
                <CloneEditor
                  onActivityChange={setCloneActivity}
                  testMode={testMode}
                  projectId={project.id}
                  draft={draft}
                  onUpdateDraft={(patchObj) => patch(patchObj)}
                  onProceedToPublish={() => void goTo('publish')}
                  onBackToBasics={() => void goTo('basics')}
                  onRefresh={refresh}
                  onGenerate={generateClone}
                  onPublish={publishClone}
                />
              </Suspense>
            </ErrorBoundary>
          )}
          {tab === 'consultation' && (
            <>
              <ConsultationStep
                draft={draft}
                disabled={!!busy}
                basicsReady={basicsReady}
                active={consultationActive}
                onStart={() => consult()}
                onAnswer={(questionId, answer) => consult({ questionId, answer })}
                onRestart={() => consult({ restart: true })}
                onNext={() => setTab('brief')}
              />
              <JobList
                jobs={detail.jobs.filter((job) => job.kind === 'consultation')}
                busy={busy}
                onRetry={(job) =>
                  action(`retry:${job.id}`, async () => {
                    await post(`${endpoint}/jobs/${job.id}/retry`);
                    await refresh();
                  })
                }
              />
            </>
          )}
          {tab === 'design' && (
            <>
              <PageDesign
                projectId={project.id}
                draft={draft}
                jobs={detail.jobs}
                disabled={!!busy}
                contentReady={briefReady}
                availableImages={availableImages}
                imageConfigured={services.some(
                  (service) => service.name === 'image' && service.configured,
                )}
                onBackToBrief={() => setTab('brief')}
                onGenerate={(page, instructions) => generate('image', page, instructions)}
                onConfirm={(target) =>
                  action(
                    `confirm-design:${target}`,
                    () => command('confirm-design', { target }),
                    target === 'home'
                      ? '首页风格已确认，可以生成其余页面。'
                      : `${pagePlan.length} 张设计稿已确认，可以生成网站。`,
                  )
                }
                onNext={() => setTab('publish')}
              />
              <JobList
                jobs={detail.jobs.filter((job) => job.kind === 'image' && !!job.input.pageId)}
                busy={busy}
                onRetry={(job) =>
                  action(`retry:${job.id}`, async () => {
                    await post(`${endpoint}/jobs/${job.id}/retry`);
                    await refresh();
                  })
                }
              />
            </>
          )}
          {tab === 'brief' && (
            <>
              <BriefStep
                draft={draft}
                disabled={!!busy}
                active={consultationActive}
                onRevise={(instructions) => consult({ instructions })}
                onConfirm={() =>
                  action(
                    'confirm-brief',
                    () => command('confirm-brief'),
                    '网站方案已确认，可以开始页面设计。',
                  )
                }
                onBack={() => setTab('consultation')}
                onNext={() => setTab('design')}
              />
              <JobList
                jobs={detail.jobs.filter((job) => job.kind === 'consultation')}
                busy={busy}
                onRetry={(job) =>
                  action(`retry:${job.id}`, async () => {
                    await post(`${endpoint}/jobs/${job.id}/retry`);
                    await refresh();
                  })
                }
              />
            </>
          )}
          {tab === 'publish' && (
            <>
              <SectionTitle
                eyebrow={draft.buildBranch === 'custom' ? '第 5 步 / 共 5 步' : '第 3 步 / 共 3 步'}
                title="预览与发布"
                description="草稿与线上版本各自保存。只有发布成功，公开网站才会更新。"
              />
              <section className="publication-hero">
                <div>
                  <span className="eyebrow">网站概况</span>
                  <h3>{draft.company.name || project.name}</h3>
                  <p>
                    {project.siteUrl ? (
                      <a href={project.siteUrl} target="_blank" rel="noreferrer">
                        {project.siteUrl}
                        <Icon name="external" size={15} />
                      </a>
                    ) : (
                      '首次发布成功后，会在这里显示网站地址。'
                    )}
                  </p>
                  <div className="publication-pills">
                    <span className="pill light">
                      {draft.buildBranch === 'clone'
                        ? '设计稿还原'
                        : draft.buildBranch !== 'custom'
                          ? `精选模版 · ${draft.template.toUpperCase()}`
                          : draft.consultation?.brief?.visualDirection || '已确认设计方向'}
                    </span>
                    <span className="pill light">{pagePlan.length} 类页面</span>
                    <span className="pill light">{draft.products.length} 个产品</span>
                    <span className="pill light">
                      {draft.languages.map((l) => l.toUpperCase()).join(' + ')}
                    </span>
                    {testMode && <span className="pill light">测试发布</span>}
                  </div>
                </div>
                <Button
                  onClick={openPreview}
                  disabled={!!busy || !siteReady}
                  busy={busy === 'preview'}
                >
                  <Icon name="eye" />
                  打开私有整站预览
                </Button>
              </section>

              <div className="segmented publication-tabs" role="group" aria-label="发布工作区">
                {([['content','内容与预览'],['check','发布检查'],['manage','上线管理']] as const).map(([id,label])=><button key={id} aria-pressed={publishSection===id} className={publishSection===id?'selected':''} onClick={()=>setPublishSection(id)}>{label}</button>)}
              </div>
              {publishSection==='content' && <>
              {draft.buildBranch === 'clone' ? (
                <section className="panel">
                  <div className="panel-title">
                    <span className="section-index">✓</span>
                    <h3>{hasCloneOutput(draft.cloneConfig) ? '设计稿页面代码已保存' : '请先按设计稿生成页面'}</h3>
                    <span>
                      {draft.cloneConfig?.targetUrl ? `参考网址：${draft.cloneConfig.targetUrl}` : '设计稿高保真还原'}
                      {draft.cloneConfig?.generatedAt && ` · 生成于 ${new Date(draft.cloneConfig.generatedAt).toLocaleTimeString()}`}
                    </span>
                  </div>
                  <p className="muted" style={{ margin: '12px 0 16px' }}>
                    生成状态只表示代码已保存，不代表视觉还原已通过验收。请打开私有整站预览，对照设计图检查桌面、手机、产品图片与联系方式后再发布。
                  </p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Button kind="primary" onClick={openPreview} busy={busy === 'preview'} disabled={!!busy}>
                      <Icon name="eye" />
                      立即预览全真网站
                    </Button>
                    <Button kind="quiet" onClick={() => setTab('clone-generate')}>
                      <Icon name="spark" />
                      调整素材与重新生成
                    </Button>
                  </div>
                </section>
              ) : draft.buildBranch !== 'custom' ? (
                <section className="panel">
                  <div className="panel-title">
                    <span className="section-index">✓</span>
                    <h3>模版极速渲染已就绪</h3>
                    <span>模版：{draft.template.toUpperCase()} · 品牌色：{draft.brandColor}</span>
                  </div>
                  <p className="muted" style={{ margin: '12px 0 16px' }}>
                    公司资料、产品矩阵与询盘表单已实时拼装完毕。点击上方【打开私有整站预览】即可自由切换桌面与手机视口交互查阅全部页面，确认无误后即可在下方一键发布上线。
                  </p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Button kind="primary" onClick={openPreview} busy={busy === 'preview'} disabled={!!busy}>
                      <Icon name="eye" />
                      立即预览电脑与手机效果
                    </Button>
                    <Button kind="quiet" onClick={() => setTab('template')}>
                      <Icon name="palette" />
                      {project.materials?'调整页面资料与配色':'更换模版与配色'}
                    </Button>
                  </div>
                </section>
              ) : (
                <section className="panel">
                  <SectionTitle
                    title="生成静态网站"
                    description={`将确认过的 ${pagePlan.length} 张设计稿转成真实页面，填入产品和公司资料，然后检查电脑与手机预览。`}
                  />
                  {!builderConfigured && (
                    <Notice tone="warning">
                      网站生成服务尚未连接。管理员配置后即可从设计稿生成网站。
                    </Notice>
                  )}
                  {!designsReady && <Notice>请先到“页面设计稿”确认全部 {pagePlan.length} 张设计稿。</Notice>}
                  <Button
                    kind="primary"
                    disabled={!!busy || !designsReady || buildPending || !builderConfigured}
                    busy={busy === 'job:site-build:all'}
                    onClick={() => generate('site-build')}
                  >
                    <Icon name="spark" />
                    {buildPending ? '网站生成中…' : siteReady ? '重新生成网站' : '从设计稿生成网站'}
                  </Button>
                  {siteReady && (
                    <p className="muted">当前版本的网站已生成，请预览所有页面后再发布。</p>
                  )}
                </section>
              )}
              <JobList
                jobs={detail.jobs.filter((job) => job.kind === 'site-build')}
                busy={busy}
                onRetry={(job) =>
                  action(`retry:${job.id}`, async () => {
                    await post(`${endpoint}/jobs/${job.id}/retry`);
                    await refresh();
                  })
                }
              />
              <BannerEditor projectId={project.id} draft={draft} disabled={!!busy}
                onChange={banners=>patch({banners,banner:undefined})} onUpload={uploadBanner}/>
              <Button kind="primary" onClick={()=>setPublishSection('check')}>检查并发布网站 <Icon name="arrow"/></Button>
              </>}
              {publishSection==='check' && <>
              <DeploymentSettings project={project} disabled={dirty||!!busy||activeJobs.some(j=>j.kind==='publish')} onSaved={()=>refresh()}/>
              <section className="panel">
                <SectionTitle
                  title="发布前检查"
                  description={`预览方案中的全部 ${pagePlan.length} 类页面，检查所有网站语言。`}
                />
                <div className="publish-checklist">
                  {checklist.map((item) => (
                    <button key={item.id} onClick={() => setTab(item.step)}>
                      <span className={`check-circle ${item.ready ? 'complete' : ''}`}>
                        <Icon name={item.ready ? 'check' : 'clock'} size={15} />
                      </span>
                      <span className="checklist-copy">
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <span className={item.ready ? 'ready' : 'pending'}>
                        {item.ready ? '已准备' : '去完善'}
                      </span>
                      <Icon name="arrow" size={14} />
                    </button>
                  ))}
                </div>
                {publicationMissing.length > 0 && (
                  <Notice tone="warning">
                    仍需完善：{publicationMissing.join('、')}。点击上方对应项继续编辑。
                  </Notice>
                )}
                {alreadyPublished && <Notice tone="success">当前页面内容已发布，无需重复发布。修改页面后可发布更新。</Notice>}
                <div className="publish-actions">
                  <Button
                    kind="primary"
                    onClick={() => setReleaseAction('publish')}
                    disabled={
                      !!busy ||
                      publicationMissing.length > 0 ||
                      alreadyPublished ||
                      activeJobs.some((j) => j.kind === 'publish')
                    }
                  >
                    <Icon name="globe" />
                    {alreadyPublished ? '当前内容已上线' : project.publishedReleaseId ? '发布草稿更新' : '发布网站'}
                  </Button>
                  <Button
                    onClick={() => setReleaseAction('restore')}
                    disabled={
                      !!busy ||
                      !project.previousReleaseId ||
                      activeJobs.some((j) => j.kind === 'publish')
                    }
                  >
                    <Icon name="refresh" />
                    恢复上一次成功版本
                  </Button>
                  <Button
                    kind="danger"
                    onClick={() => setReleaseAction('offline')}
                    disabled={!!busy || !project.publishedReleaseId || project.offline}
                  >
                    下线网站
                  </Button>
                </div>
                <small className="muted">
                  恢复历史版本会保留当前草稿、账号额度和询盘。下线后网址暂不可用，并停止接收新询盘。
                </small>
              </section>
              <section className="panel seo-panel">
                <div className="panel-title"><h3>SEO 发布检查</h3><span>覆盖全部语言与页面</span></div>
                <p className="muted">发布时生成 canonical、hreflang、站点地图、分享信息及真实资料的结构化数据。已激活的自定义域名优先作为搜索入口，多个域名时使用最早添加且已激活的绑定。</p>
                <Button onClick={checkSeo} disabled={!!busy || !staticSiteReady(draft)} busy={busy === 'seo'}>保存并检查 SEO</Button>
                {seoReport && <>
                  {(dirty || seoReport.version !== project.version) && <p className="muted">草稿已变化，以下为上次检查结果，请重新检查。</p>}
                  <p>已检查 {seoReport.pages} 个页面 · {seoReport.issues.length ? `${seoReport.issues.length} 项建议` : '基础标记检查通过'}</p>
                  <p className="muted">搜索入口：{seoReport.origin || '首次发布后确定'}。绑定或解绑域名后，请重新检查并发布 SEO 更新。</p>
                  <ul>{seoReport.issues.map((issue,index) => <li key={index}><code>{issue.path}</code>：{issue.message}</li>)}</ul>
                  <details><summary>发布后仍需验证</summary><ul>{seoReport.externalChecks.map(item => <li key={item}>{item}</li>)}</ul></details>
                  {seoReport.needsPublish && <Button disabled={!!busy} onClick={() => setReleaseAction('publish')}>发布 SEO 更新</Button>}
                </>}
              </section>
              </>}
              {publishSection==='manage' && <>
              <WebsiteConnections projectId={projectId} published={!!project.publishedReleaseId} />
              <section className="panel">
                <SectionTitle title="发布记录" actions={<Button onClick={() => setHistoryOpen(true)}>查看全部历史</Button>} />
                {detail.releases.length === 0 ? (
                  <Empty icon="globe" title="还没有发布记录">
                    完成预览后，发布你的第一个版本。
                  </Empty>
                ) : (
                  <div className="release-list">
                    {detail.releases.map((release) => (
                      <div key={release.id}>
                        <span className="release-icon">
                          <Icon name="globe" />
                        </span>
                        <div>
                          <strong>
                            草稿 V{release.draftVersion}
                            {release.testMode && <span className="inline-test">测试</span>}
                          </strong>
                          <small>
                            {dateTime(release.createdAt)} · {release.id}
                          </small>
                          {release.status !== 'succeeded' && release.error && <p className="error-text">{release.error}</p>}
                        </div>
                        <span
                          className={`pill ${release.status === 'succeeded' ? 'green' : release.status === 'failed' ? 'red' : 'muted'}`}
                        >
                          {release.id === project.publishedReleaseId
                            ? '当前发布版本'
                            : statusNames[release.status] || release.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <JobList
                jobs={detail.jobs.filter((j) => j.kind === 'publish')}
                busy={busy}
                onRetry={(job) =>
                  action(`retry:${job.id}`, async () => {
                    await post(`${endpoint}/jobs/${job.id}/retry`);
                    await refresh();
                  })
                }
              />
              </>}
            </>
          )}
          {tab === 'inquiries' && (
            <>
              <SectionTitle
                eyebrow="网站管理"
                title="客户询盘"
                description={`询盘完整内容发送到 ${draft.company.email || '你填写的公司联系邮箱'}，后台独立保存记录。`}
                actions={
                  <Button onClick={loadInquiries}>
                    <Icon name="refresh" />
                    刷新
                  </Button>
                }
              />
              {inquiries.length === 0 ? (
                <div className="panel">
                  <Empty icon="mail" title="等待你的第一位访客">
                    网站发布后，访客可以通过联系表单留言。发信失败也不会丢失询盘记录。
                  </Empty>
                </div>
              ) : (
                <div className="inquiry-list">
                  {inquiries.map((inquiry) => (
                    <article className="panel inquiry-card" key={inquiry.id}>
                      <div className="inquiry-head">
                        <span className="avatar">{inquiry.name.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <h3>
                            {inquiry.name}
                            <span>{inquiry.company}</span>
                          </h3>
                          <a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>
                        </div>
                        <time>{dateTime(inquiry.createdAt)}</time>
                        <span
                          className={`pill ${inquiry.emailStatus === 'sent' ? 'green' : inquiry.emailStatus === 'failed' ? 'red' : 'muted'}`}
                        >
                          邮件{statusNames[inquiry.emailStatus]}
                        </span>
                      </div>
                      <p className="inquiry-message">{inquiry.message}</p>
                      <div className="inquiry-meta">
                        <span>
                          来源：
                          <a href={inquiry.siteUrl} target="_blank" rel="noreferrer">
                            {inquiry.siteUrl}
                          </a>
                        </span>
                        {inquiry.productId && (
                          <span>
                            相关产品：
                            {draft.products.find((p) => p.id === inquiry.productId)?.name ||
                              inquiry.productId}
                          </span>
                        )}
                        <span>发送尝试：{inquiry.emailAttempts}</span>
                        {inquiry.emailStatus === 'failed' && (
                          <Button
                            disabled={!!busy}
                            onClick={() =>
                              action(
                                `mail:${inquiry.id}`,
                                async () => {
                                  await post(`${endpoint}/inquiries/${inquiry.id}/retry`);
                                  await loadInquiries();
                                },
                                '已请求重试邮件投递，询盘记录保持不变。',
                              )
                            }
                          >
                            重试邮件
                          </Button>
                        )}
                      </div>
                      {inquiry.emailError && <Notice tone="warning">{inquiry.emailError}</Notice>}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {activeJobs.length > 0 && tab !== 'design' && (
            <div className="background-job">
              <span className="spinner" />
              {activeJobs.length} 个任务在后台处理{' '}
              <button
                onClick={() =>
                  setTab(
                    activeJobs.some((j) => j.kind === 'publish' || j.kind === 'site-build')
                      ? 'publish'
                      : activeJobs.some((j) => j.kind === 'consultation')
                        ? 'consultation'
                        : 'design',
                  )
                }
              >
                查看进度
                <Icon name="arrow" size={14} />
              </button>
            </div>
          )}
        </main>
      </div>
      {sourceOpen && (
        <Modal title="从 Product Radar 导入产品" onClose={() => setSourceOpen(false)} wide>
          <p className="muted">
            只显示当前账号有权限的产品。图片与设计条件将复制为独立快照，不影响原产品库。
          </p>
          <div className="source-select-list">
            {sourceProducts.length === 0 ? (
              <Empty title="暂无可导入的产品" />
            ) : (
              sourceProducts.map((p) => (
                <label className="source-select-item" key={p.id}>
                  <input
                    type="checkbox"
                    checked={sourceIds.includes(p.id)}
                    disabled={
                      draft.products.some((existing) => existing.source?.id === p.id) ||
                      (!sourceIds.includes(p.id) && sourceIds.length + draft.products.length >= 20)
                    }
                    onChange={(e) =>
                      setSourceIds((current) =>
                        e.target.checked ? [...current, p.id] : current.filter((id) => id !== p.id),
                      )
                    }
                  />
                  <div>
                    <strong>{p.name}</strong>
                    <p>{p.description}</p>
                    <small>
                      {p.material} {p.dimensions} ·{' '}
                      {p.factsOrigin === 'product-set' ? '产品套图，请核实产品事实' : '生成概念，请核实产品事实'}
                    </small>
                  </div>
                  <span className="pill muted">
                    {draft.products.some((existing) => existing.source?.id === p.id)
                      ? '已导入'
                      : p.workflow === 'build'
                        ? 'Build'
                        : 'Create'}
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="source-pagination">
            <Button
              disabled={sourceOffset === 0 || !!busy}
              onClick={() => getSources(Math.max(0, sourceOffset - 20))}
            >
              上一页
            </Button>
            <span>
              {sourceOffset + 1}–{Math.min(sourceOffset + 20, sourceTotal)} / {sourceTotal}
            </span>
            <Button
              disabled={sourceOffset + 20 >= sourceTotal || !!busy}
              onClick={() => getSources(sourceOffset + 20)}
            >
              下一页
            </Button>
          </div>
          <div className="modal-actions">
            <span>
              已选择 {sourceIds.length} 个 · 可再添加 {20 - draft.products.length} 个
            </span>
            <Button
              kind="primary"
              onClick={importSources}
              busy={busy === 'import'}
              disabled={!sourceIds.length || !!busy}
            >
              导入所选产品
            </Button>
          </div>
        </Modal>
      )}
      {sourceChanges && (
        <Modal title="检查来源更新" onClose={() => setSourceChanges(null)} wide>
          {sourceChanges.length === 0 ? (
            <Empty icon="check" title="已导入来源没有更新">
              网站中的手动编辑保持不变。
            </Empty>
          ) : (
            <>
              <p className="muted">
                逐项选择后才会应用到草稿。应用会替换所选产品快照与图片，请留意网站中的自行修改。
              </p>
              {sourceChanges.map((change) => (
                <label className="source-diff" key={change.productId}>
                  <input
                    type="checkbox"
                    checked={applyIds.includes(change.productId)}
                    onChange={(e) =>
                      setApplyIds((ids) =>
                        e.target.checked
                          ? [...ids, change.productId]
                          : ids.filter((id) => id !== change.productId),
                      )
                    }
                  />
                  <div>
                    <strong>{change.after.name}</strong>
                    <div className="diff-columns">
                      <div>
                        <small>上次导入</small>
                        <p>{change.before.name}</p>
                        <p>{change.before.description}</p>
                        <p>
                          {change.before.material} · {change.before.dimensions}
                        </p>
                        <p>{change.before.designDirection}</p>
                        <small>来源版本 {change.before.version.slice(0, 16)}</small>
                        <pre>{JSON.stringify(change.before.conditions, null, 2)}</pre>
                      </div>
                      <div>
                        <small>当前来源</small>
                        <p>{change.after.name}</p>
                        <p>{change.after.description}</p>
                        <p>
                          {change.after.material} · {change.after.dimensions}
                        </p>
                        <p>{change.after.designDirection}</p>
                        <small>
                          来源版本 {change.after.version.slice(0, 16)} · 应用时同步复制当前来源图片
                        </small>
                        <pre>{JSON.stringify(change.after.conditions, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
              <div className="modal-actions">
                <Button onClick={() => setSourceChanges(null)}>保持现状</Button>
                <Button
                  kind="primary"
                  disabled={!applyIds.length || !!busy}
                  busy={busy === 'source-apply'}
                  onClick={() =>
                    action(
                      'source-apply',
                      async () => {
                        await command('source-apply', { productIds: applyIds });
                        setSourceChanges(null);
                      },
                      '所选来源更新已应用到草稿，线上版本未变。',
                    )
                  }
                >
                  应用所选更新
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
      {conflict && merger && (
        <Modal title="草稿有新版本，请合并修改" onClose={() => setConflict(null)} wide>
          <Notice tone="warning">
            另一个入口或后台任务已保存 V{conflict.version}
            。你的未保存内容完整保留。互不冲突的字段将合并；相同字段的不同改动由你选择。
          </Notice>
          {merger.conflicts.map((item) => (
            <div className="merge-conflict" key={item.path}>
              <strong>{item.path}</strong>
              <div>
                <label>
                  <input
                    type="radio"
                    name={item.path}
                    onChange={() => setChoices({ ...choices, [item.path]: 'mine' })}
                  />
                  <span>
                    保留我的修改
                    <pre>
                      {typeof item.mine === 'string'
                        ? item.mine
                        : JSON.stringify(item.mine, null, 2)}
                    </pre>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name={item.path}
                    onChange={() => setChoices({ ...choices, [item.path]: 'theirs' })}
                  />
                  <span>
                    采用服务器版本
                    <pre>
                      {typeof item.theirs === 'string'
                        ? item.theirs
                        : JSON.stringify(item.theirs, null, 2)}
                    </pre>
                  </span>
                </label>
              </div>
            </div>
          ))}
          {merger.conflicts.length === 0 && (
            <Notice tone="success">所有字段已准备合并，可以保存。</Notice>
          )}
          <div className="modal-actions wrap">
            <Button onClick={downloadLocal}>下载本地编辑备份</Button>
            <Button
              onClick={() => {
                install(conflict);
                setConflict(null);
              }}
            >
              放弃本地修改，载入服务器版本
            </Button>
            <Button
              kind="primary"
              onClick={saveMerge}
              busy={busy === 'merge'}
              disabled={!!busy || merger.conflicts.length > 0}
            >
              保存合并结果
            </Button>
          </div>
        </Modal>
      )}
      {leaveOpen && (
        <Modal
          title={
            uploadState
              ? '素材正在上传中'
              : saving
                ? '正在保存草稿'
                : '还有未保存的修改'
          }
          onClose={() => setLeaveOpen(false)}
        >
          {uploadState ? (
            <p>
              当前仍有素材文件正在上传（已完成 {Math.floor(uploadState.fraction * 100)}%）。如果现在返回，上传操作将被中止。
            </p>
          ) : saving ? (
            <p>正在向服务器保存当前草稿，请稍候…</p>
          ) : (
            <p>您有尚未保存的修改。保存后离开，可以稍后从相同草稿继续。</p>
          )}
          <div className="modal-actions">
            <Button
              kind="danger"
              onClick={() => {
                dirtyRef.current = false;
                setDirty(false);
                if (uploadState) {
                  uploadController.current?.abort();
                  setUploadState(null);
                }
                try {
                  sessionStorage.removeItem(`wr_draft_${projectId}`);
                } catch {}
                setHasBackup(false);
                setLeaveOpen(false);
                finishLeave();
              }}
            >
              放弃修改并返回
            </Button>
            {!uploadState && (
              <Button
                kind="primary"
                busy={busy === 'save-leave' || saving}
                onClick={() =>
                  action('save-leave', async () => {
                    await save();
                    try {
                      sessionStorage.removeItem(`wr_draft_${projectId}`);
                    } catch {}
                    setHasBackup(false);
                    setLeaveOpen(false);
                    finishLeave();
                  })
                }
              >
                保存并返回
              </Button>
            )}
            <Button onClick={() => setLeaveOpen(false)}>继续编辑</Button>
          </div>
        </Modal>
      )}
      {previewOpen && <SitePreview project={previewProject || project} draftPreview={!!previewProject} onClose={closePreview} />}
      {releaseAction && (
        <Modal
          title={
            releaseAction === 'publish'
              ? '发布当前网站草稿'
              : releaseAction === 'restore'
                ? '恢复上一次成功发布'
                : '下线公开网站'
          }
          onClose={() => setReleaseAction(null)}
        >
          <p>
            {releaseAction === 'publish'
              ? `将发布已保存的草稿 V${project.version}${testMode ? '（本地测试发布）' : ''}。请确认你已检查整站预览、联系方式与所有语言。`
              : releaseAction === 'restore'
                ? '公开网站将使用上一次成功版本的内容与素材；当前草稿、询盘和额度继续保留。'
                : '公开网址将显示暂不可用，停止接收新询盘。项目资料和历史询盘保留，之后可以重新发布。'}
          </p>
          <div className="modal-actions">
            <Button onClick={() => setReleaseAction(null)}>取消</Button>
            <Button
              kind={releaseAction === 'offline' ? 'danger' : 'primary'}
              busy={busy === releaseAction}
              disabled={!!busy}
              onClick={publishAction}
            >
              {releaseAction === 'publish'
                ? '确认发布'
                : releaseAction === 'restore'
                  ? '确认恢复'
                  : '确认下线'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );

  function addProduct() {
    if (draft.products.length >= 20) return;
    const id = requestId();
    patch({
      products: [
        ...draft.products,
        { id, name: '', description: '', material: '', dimensions: '' },
      ],
      primaryProductId: draft.primaryProductId || id,
    });
  }
  function removeProduct(id: string) {
    const products = draft.products.filter((p) => p.id !== id);
    patch({
      products,
      primaryProductId:
        draft.primaryProductId === id ? products[0]?.id || '' : draft.primaryProductId,
    });
  }
  function moveProduct(index: number, direction: number) {
    const products = [...draft.products];
    [products[index], products[index + direction]] = [products[index + direction], products[index]];
    patch({ products });
  }
}


function UploadButton({
  label,
  accept,
  onFile,
  disabled,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  return (
    <label className={`button secondary upload-button ${disabled ? 'disabled' : ''}`}>
      <Icon name="upload" size={15} />
      {label}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}
function StepFooter({ hint, next, onNext }: { hint: string; next: string; onNext: () => void }) {
  return (
    <div className="step-footer">
      <p>{hint}</p>
      <Button kind="primary" onClick={onNext}>
        {next}
        <Icon name="arrow" />
      </Button>
    </div>
  );
}
function JobList({
  jobs,
  busy,
  onRetry,
}: {
  jobs: Job[];
  busy: string;
  onRetry: (job: Job) => void;
}) {
  if (!jobs.length) return null;
  return (
    <section className="panel jobs-panel">
      <SectionTitle title="任务与恢复" description="任务保存于服务端；刷新和查询不会重复扣额度。" />
      <div className="job-list">
        {[...jobs]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((job) => (
            <div className="job-row" key={job.id}>
              <span className={`job-status-icon ${job.status}`}>
                {['running', 'queued'].includes(job.status) ? (
                  <span className="spinner" />
                ) : (
                  <Icon
                    name={
                      job.status === 'succeeded'
                        ? 'check'
                        : job.status === 'failed'
                          ? 'close'
                          : 'clock'
                    }
                  />
                )}
              </span>
              <div>
                <strong>
                  {job.input.pageId
                    ? `${(designLabels as Record<string, string>)[job.input.pageId as string] || job.input.pageId}设计稿`
                    : jobKinds[job.kind]}
                  {job.testMode && <span className="inline-test">测试</span>}
                </strong>
                <small>
                  {dateTime(job.createdAt)} ·{' '}
                  {job.upstreamId ? `上游任务 ${job.upstreamId}` : `任务 ${job.id.slice(0, 12)}`}
                </small>
                {job.error && <p className="error-text">{job.error}</p>}
                {job.kind === 'site-build' && typeof job.input.progress === 'string' && (
                  <p>{job.input.progress}</p>
                )}
                {job.status === 'unknown' && (
                  <p>上游结果待核对。恢复将查询原任务，不重新提交视频。</p>
                )}
              </div>
              <span
                className={`pill ${job.status === 'succeeded' ? 'green' : job.status === 'failed' ? 'red' : 'muted'}`}
              >
                {statusNames[job.status]}
              </span>
              {job.kind !== 'clone' && ['failed', 'unknown'].includes(job.status) && (
                <Button disabled={!!busy} onClick={() => onRetry(job)}>
                  恢复 / 重试
                </Button>
              )}
            </div>
          ))}
      </div>
    </section>
  );
}
