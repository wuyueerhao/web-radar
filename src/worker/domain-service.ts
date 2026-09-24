import { ProductIdentitySchema } from '../shared/product-identity';
import { blocksModeChange, buildMode } from '../shared/build-mode';
import { MaterialsService } from './materials-service';
import type { ProjectServiceStatus, ProjectServicePreview } from '../shared/project-service';
import { projectPreviewHtml, projectPreviewRuntimeForDraft } from './project-preview';
import { currentMaterialsPrincipal } from './materials-auth';
import { materialsImageAssetIds, validateMaterialsDraft } from './materials-draft';
import { siteContacts } from '../shared/site-contacts';
import { bannerAssets } from '../shared/banner-config';
import { auditSeo, withPublicationMetadata, SEO_POLICY_VERSION, type PublicationMetadata } from './site-metadata';
import { deploymentOptions, validateDeployment } from './deployment-settings';
import { deploymentSelection, matchesDeployment } from '../shared/deployment';
import { ProviderSettings, withStoredEmailStatus } from './provider-settings';
import { backupManifest } from './backup-manifest';
import { listProjectSummaries } from './project-queries';
import { hasCloneOutput, preserveCloneOutput } from '../shared/clone-output';
import { storeCloneOutput, loadCloneOutput } from './clone-artifacts';
import { samePublishedDraft } from '../shared/publication';
import { CloneTasks } from './clone-tasks';
import { ApiError } from './http';
import { normalizeCloneImages } from '../shared/clone';
import type {
  Asset,
  CloneConfig,
  Draft,
  DesignPage,
  Inquiry,
  Job,
  JobKind,
  Language,
  Principal,
  ProductSnapshot,
  Project,
  PublicMediaAsset,
  Release,
  Scene,
} from '../shared/model';
import { scrapeTargetUrl, generateCloneBundle, renderCloneFiles } from './clone-service';
import type { AppEnv } from './env';
import { testMode } from './env';
import {
  ProviderError,
  type MediaResult,
  type ProviderSet,
  type PublishResult,
} from './provider-contract';
import { createProviders } from './providers';
import { validatePageDesignInput } from './providers/image';
import { privateAssetPreview } from './asset-preview';
import { isTypedMaterials } from '../templates/materials-typed';
import { preparePublicVariant, preparedImageVariants, publicMediaPolicy, typedRendererVersion } from './public-media';
import { renderSite, renderSiteFiles } from '../templates';
import { prImage, prService } from './product-radar';
import { DomainStore } from './domain-store';
import { WebsiteQuota } from './website-quota';
import { publicationErrorDetails } from './publication-diagnostics';
import {
  designPageIds,
  designKey,
  homeConfirmed,
  designsConfirmed,
  resetDesignForEdit,
  staticSiteReady,
} from '../shared/site-design';
import {
  briefConfirmed,
  consultationSchema,
  parseSiteBrief,
  plannedPages,
  resetConsultationForEdit,
} from '../shared/site-brief';
import { materializeSiteFiles, siteFilePath, validateSiteFiles } from './static-site';
import { base64FromBytes, limitedBytes } from './providers/http';
import {
  DomainError,
  assetReferences,
  assertPublishable,
  assertSiteContentReady,
  assertSiteIntakeReady,
  assertReadyForVideo,
  assertScriptConfirmed,
  canManage,
  defaultDraft,
  editDraft,
  expectedVersion,
  fingerprint,
  publicAssetReferences,
  requestId,
  requireCondition,
  snapshotSchema,
  validEmail,
  validateDraft,
  videoInputKey,
} from './domain';

export interface DomainScheduler {
  schedule(time: number): Promise<void>;
}
/** The checkpoint is committed; a failed alarm write must not fail the publication. */
class PublicationRescheduleError extends Error {
  constructor(cause: unknown) {
    super('Publication alarm scheduling interrupted', { cause });
  }
}
const now = () => new Date().toISOString();
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const maxUpload = 80 * 1024 * 1024;
const supportedImages = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const supportedIcons = new Set(['image/x-icon', 'image/vnd.microsoft.icon']);
const supportedVideos = new Set(['video/mp4', 'video/webm']);
interface JobInput extends Record<string, unknown> {
  draft?: Draft;
  principal?: Principal;
  sceneId?: string;
  pageId?: DesignPage;
  instructions?: string;
  releaseId?: string;
  restoreReleaseId?: string;
  refreshReleaseId?: string;
  recipient?: string;
  inquiryId?: string;
  offlineEpoch?: string;
  pollFailures?: number;
  nextPollAt?: number;
  retryAt?: number;
  attemptId?: string;
  publishResult?: PublishResult;
  publicationStarted?: boolean;
}

export class DomainService {
  readonly store: DomainStore;
  private readonly clones: CloneTasks;
  private readonly materials: MaterialsService;
  private readonly websiteQuota: WebsiteQuota;
  private serial: Promise<unknown> = Promise.resolve();
  private readonly activeLanes = new Map<string, Promise<void>>();
  constructor(
    readonly env: AppEnv,
    readonly scheduler: DomainScheduler,
    readonly providers: ProviderSet = createProviders(env),
  ) {
    this.store = new DomainStore(env.DB);
    this.websiteQuota = new WebsiteQuota(env, this.store, time => this.scheduler.schedule(time));
    this.materials=new MaterialsService(env,this.store,{lock:operation=>this.lock(operation),schedule:time=>this.scheduler.schedule(time)},this.websiteQuota);
    this.clones = new CloneTasks(env, this.store, {
      lock: operation => this.lock(operation), wake: () => this.wake(),
      validate: project => this.validateAssets(project.id, project.draft),
      image: async (projectId, assetId) => {
        const asset = await this.projectAsset(projectId, assetId);
        const object = await this.env.MEDIA.get(asset.key);
        return object ? `data:${asset.contentType};base64,${Buffer.from(await object.arrayBuffer()).toString('base64')}` : null;
      },
      publish: (project, principal, rid) => this.publish(project, principal, { requestId: rid, expectedVersion: project.version }, false),
    });
  }
  private lock<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.serial.then(operation, operation);
    this.serial = current.catch(() => {});
    return current;
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const pathname = new URL(request.url).pathname;
      const consistentExport = pathname === '/api/admin/export';
      const streamingUpload = request.method === 'POST' && /^\/api\/projects\/[^/]+\/(uploads|clone\/scrape)$/.test(pathname);
      return !consistentExport && (streamingUpload || request.method === 'GET' || request.method === 'HEAD')
        ? await this.route(request)
        : await this.lock(() => this.route(request));
    } catch (e) {
      if (e instanceof DomainError || e instanceof ApiError) return json({ message: e.message, code: e.code }, e.status);
      if (e instanceof ProviderError) return json({ message: e.message, code: e.code }, 503);
      if (e instanceof Error && 'status' in e && typeof e.status === 'number')
        return json({ message: e.message, code: 'upstream_unavailable' }, e.status);
      console.error('Domain-service unhandled error:', e);
      return json({ message: '操作暂时失败，请稍后重试。', code: 'internal_error' }, 500);
    }
  }
  private principal(request: Request): Principal {
    let p: Principal | undefined;
    try {
      p = JSON.parse(
        decodeURIComponent(request.headers.get('X-WR-Principal') ?? 'null'),
      ) as Principal;
    } catch {
      /* Invalid internal principal is rejected below. */
    }
    requireCondition(p?.userId && p.workspaceId, 401, 'unauthenticated', '请先登录。');
    return p;
  }
  private async project(id: string, principal: Principal): Promise<Project> {
    const p = await this.store.one<Project>('projects', id);
    const current = p?.materials ? await currentMaterialsPrincipal(this.env, principal) : principal;
    requireCondition(
      p && canManage(p, current),
      404,
      'project_not_found',
      '项目不存在或没有访问权限。',
    );
    return p;
  }
  private async body(request: Request): Promise<Record<string, unknown>> {
    // Generated multipage documents may be up to 8 MB; ordinary commands stay bounded at 1 MB.
    const limit = request.method === 'PUT' && /^\/api\/projects\/[^/]+$/.test(new URL(request.url).pathname) ? 9 * 1024 * 1024 : 1024 * 1024;
    requireCondition(
      Number(request.headers.get('content-length') ?? 0) <= limit,
      413,
      'body_too_large',
      '请求内容过大。',
    );
    let body: unknown;
    try {
      body = await new Response(this.limitStream(request.body, limit)).json();
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError(400, 'invalid_json', '请求 JSON 无效。');
    }
    requireCondition(
      body && typeof body === 'object' && !Array.isArray(body),
      400,
      'invalid_body',
      '请求内容无效。',
    );
    return body as Record<string, unknown>;
  }
  private changed(p: Project): Project {
    return { ...p, version: p.version + 1, updatedAt: now() };
  }
  private async route(request: Request): Promise<Response> {
    const url = new URL(request.url),
      path = url.pathname
        .split('/')
        .filter(Boolean)
        .map((s) => decodeURIComponent(s)),
      method = request.method;
    if (
      path[0] === 'public' &&
      path[1] === 'provider-assets' &&
      path[2] &&
      (method === 'GET' || method === 'HEAD')
    )
      return this.signedAsset(request, path[2]);
    if (
      path[0] === 'public' &&
      path[1] === 'sites' &&
      path[2] &&
      (method === 'GET' || method === 'HEAD')
    )
      return this.publicSite(request, path[2], path.slice(3));
    if (
      path[0] === 'api' &&
      path[1] === 'public' &&
      path[2] === 'sites' &&
      path[3] &&
      path[4] === 'inquiries' &&
      method === 'POST'
    )
      return this.submitInquiry(request, path[3]);
    const principal = this.principal(request);
    if (path[0] === 'internal' && path[1] === 'product-radar-projects')
      return this.productRadarProject(request, principal, path.slice(2));
    if(path[0]==='internal'&&path[1]==='materials-submissions'&&method==='POST'){
      const receipt=path[2]&&path[3]==='status'?await this.materials.status(principal,path[2]):await this.materials.submit(principal,await this.body(request));
      return json(receipt,receipt.state==='receiving'?202:200);
    }
    if (path[0] === 'internal' && path[1] === 'handoff-project' && method === 'POST') {
      const b = await this.body(request);
      return json({
        project: await this.create(principal, b.requestId, 'Imported website', b.products, true),
      });
    }
    if (path[0] === 'internal' && path[1] === 'check-project' && path[2])
      return json({ project: await this.project(path[2], principal) });
    if (path[0] !== 'api') throw new DomainError(404, 'not_found', '接口不存在。');
    if (path[1] === 'source-products' && method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0),
        limit = Number(url.searchParams.get('limit') ?? 20);
      requireCondition(
        Number.isInteger(offset) &&
          offset >= 0 &&
          Number.isInteger(limit) &&
          limit >= 1 &&
          limit <= 100,
        400,
        'invalid_pagination',
        '分页参数无效。',
      );
      return json(await prService(this.env, principal, 'products', { offset, limit }));
    }
    if (path[1] === 'admin' && path[2] === 'provider-accounts') {
      requireCondition(principal.systemRole === 'super_admin', 403, 'admin_required', '仅平台管理员可以管理共享账号。');
      const settings = new ProviderSettings(this.env);
      if (method === 'GET' && !path[3]) return json({ accounts: await settings.list(), environmentEmail: !!(this.env.RESEND_API_KEY && this.env.MAIL_FROM) });
      if (method === 'POST' && !path[3]) return json({ account: await settings.add(await this.body(request), 'global') });
      if (method === 'PUT' && path[3] === 'default') {
        const b = await this.body(request);
        requireCondition(b.id === null || typeof b.id === 'string', 400, 'invalid_account', '账号无效。');
        await settings.setDefault(b.id as string | null); return json({ok:true});
      }
      if (method === 'DELETE' && path[3]) { await settings.remove(path[3], 'global'); return json({ok:true}); }
      throw new DomainError(404, 'not_found', '接口不存在。');
    }
    if (path[1] === 'admin') return this.admin(request, principal, path.slice(2));
    if (path[1] !== 'projects') throw new DomainError(404, 'not_found', '接口不存在。');
    if (path.length === 2) {
      if (method === 'GET') {
        return json(await listProjectSummaries(this.env.DB, principal, url));
      }
      if (method === 'POST') {
        const b = await this.body(request);
        return json({
          project: await this.create(principal, b.requestId, b.name, b.products, false, b.buildBranch, b.targetUrl),
        });
      }
    }
    if (path[2] === 'batch-delete' && method === 'POST') {
      const b = await this.body(request);
      const rawIds = Array.isArray(b.ids) ? b.ids : Array.isArray(b.projectIds) ? b.projectIds : [];
      const ids = rawIds.filter((x: unknown): x is string => typeof x === 'string');
      const count = await this.batchDeleteProjects(ids, principal);
      return json({ ok: true, deletedCount: count });
    }
    const project = await this.project(path[2] ?? '', principal),
      command = path[3];
    if(command==='deployment') {
      if(method==='GET')return json(await deploymentOptions(this.env,project));
      if(method==='PUT'){
        const body=await this.body(request);expectedVersion(project,body.expectedVersion);
        project.deployment=await validateDeployment(this.env,project,body);
        const next=this.changed(project);await this.store.update('projects',next).run();
        return json({project:next});
      }
    }
    if (command === 'connections') {
      const settings = new ProviderSettings(this.env);
      if (method === 'GET' && !path[4]) return json(await settings.settings(project));
      if (method === 'POST' && path[4] === 'accounts') return json({ account: await settings.add(await this.body(request), project.id) });
      if (method === 'DELETE' && path[4] === 'accounts' && path[5]) { await settings.remove(path[5], project.id); return json({ok:true}); }
      if (method === 'GET' && path[4] === 'zones' && path[5]) return json({ zones: await settings.zones(path[5], project.id) });
      if (method === 'PUT' && path[4] === 'email') { await settings.selectEmail(project.id, (await this.body(request)).accountId); return json({ok:true}); }
      if (method === 'POST' && path[4] === 'domains' && !path[5]) return json(await settings.bind(project, await this.body(request)));
      if (method === 'POST' && path[4] === 'domains' && path[5] && path[6] === 'refresh') return json(await settings.refresh(project, path[5]));
      if (method === 'DELETE' && path[4] === 'domains' && path[5]) { await settings.unbind(project,path[5]); return json({ok:true}); }
      throw new DomainError(404, 'not_found', '接口不存在。');
    }
    if (!command && method === 'GET') return json(await this.detail(project, principal));
    if (command === 'seo' && method === 'GET') {
      requireCondition(staticSiteReady(project.draft), 409, 'site_not_built', '请先生成网站或选择模版，再检查 SEO。');
      const metadata = await this.publicationMetadata(project, project.draft);
      const files = await this.renderFiles(project.draft, {
        projectId: project.id, assetUrl: metadata.assetUrl!,
        inquiryUrl: `/api/public/sites/${project.id}/inquiries`,
        publicBaseUrl: `${this.env.PUBLIC_SITE_ORIGIN||this.origin()}/public/sites/${project.id}`,
      });
      const release = project.publishedReleaseId ? await this.store.one<Release>('releases', project.publishedReleaseId) : undefined;
      return json({ ...auditSeo(withPublicationMetadata(files, metadata.origin ?? 'https://preview.invalid', metadata)), version: project.version, origin: metadata.origin ?? null,
        needsPublish: !!release && (release.seo?.policyVersion !== SEO_POLICY_VERSION || release.seo?.origin !== metadata.origin) });
    }
    if (command === 'history' && method === 'GET') return json(await this.history(project, url));
    if (!command && method === 'DELETE') {
      await this.deleteProject(project.id, principal);
      return json({ ok: true, deletedId: project.id });
    }
    if (!command && method === 'PUT') {
      await this.clones.assertEditable(project);
      const b = await this.body(request);
      expectedVersion(project, b.expectedVersion);
      const taskId = project.draft.cloneConfig?.taskId;
      const incoming = b.draft as Draft;
      const generation=project.draft.cloneConfig?.generation;
      if(generation&&!generation.contacts)generation.contacts=siteContacts(project.draft.company);
      if (incoming?.cloneConfig) incoming.cloneConfig = preserveCloneOutput(project.draft.cloneConfig, incoming.cloneConfig);
      const updatedDraft = editDraft(project.draft, incoming);
      if (updatedDraft.buildBranch !== project.draft.buildBranch && buildMode(updatedDraft) !== buildMode(project.draft)) {
        const jobs = await this.store.list<Job>('jobs', "project_id=? AND status IN ('queued','running','paused','unknown')", [project.id]);
        requireCondition(!jobs.some(blocksModeChange), 409, 'mode_change_task_active', '生成或发布任务尚未结束，请先等待任务结束或停止生成任务再切换建站方式。');
      }
      project.draft = updatedDraft;
      if (hasCloneOutput(project.draft.cloneConfig)) project.draft.cloneConfig = await storeCloneOutput(this.env, project.id, project.draft.cloneConfig!);
      if (taskId && project.draft.cloneConfig) project.draft.cloneConfig.taskId = taskId;
      await this.validateAssets(project.id, project.draft);
      if (b.name !== undefined) {
        requireCondition(
          typeof b.name === 'string' && b.name.trim().length > 0 && b.name.length <= 200,
          400,
          'invalid_name',
          '项目名称必须为 1–200 个字符。',
        );
        project.name = b.name.trim();
      }
      const next = this.changed(project);
      await this.store.update('projects', next).run();
      return json({ project: next });
    }
    if (command === 'uploads' && method === 'POST')
      return json({ asset: await this.upload(request, project) });
    if (command === 'confirm-brief' && method === 'POST') {
      const body = await this.body(request);
      expectedVersion(project, body.expectedVersion);
      const consultation = project.draft.consultation;
      requireCondition(
        consultation?.brief && !consultation.jobId,
        409,
        'brief_incomplete',
        '请先完成需求整理并等待当前任务结束。',
      );
      const brief = parseSiteBrief(consultation.brief, project.draft);
      const before = structuredClone(project.draft);
      project.draft.copy = structuredClone(brief.copy);
      for (const product of project.draft.products)
        product.translations = structuredClone(brief.productTranslations[product.id]);
      project.draft.brandColor = brief.brandColor;
      project.draft.direction = `${brief.visualDirection}\n${brief.layout}`;
      consultation.brief = brief;
      consultation.confirmed = true;
      project.draft = validateDraft(project.draft);
      assertSiteContentReady(project.draft);
      resetDesignForEdit(before, project.draft);
      const next = this.changed(project);
      await this.store.update('projects', next).run();
      return json({ project: next });
    }
    if (command === 'confirm-design' && method === 'POST') {
      const body = await this.body(request);
      expectedVersion(project, body.expectedVersion);
      const design = project.draft.siteDesign;
      requireCondition(
        body.target === 'home' || body.target === 'all',
        400,
        'invalid_design_target',
        '请选择首页或整组设计稿。',
      );
      requireCondition(
        design?.pages.home?.imageAssetId,
        409,
        'home_incomplete',
        '请先生成首页设计稿。',
      );
      if (body.target === 'home') design.homeConfirmedAssetId = design.pages.home.imageAssetId;
      else {
        requireCondition(
          designPageIds(design).every((id) => design.pages[id]?.imageAssetId),
          409,
          'designs_incomplete',
          '请先生成页面清单中的全部设计稿。',
        );
        requireCondition(
          homeConfirmed(design),
          409,
          'home_unconfirmed',
          '请先确认当前首页设计稿。',
        );
        design.confirmedKey = designKey(design);
      }
      await this.validateAssets(project.id, project.draft);
      const next = this.changed(project);
      await this.store.update('projects', next).run();
      return json({ project: next });
    }
    if (command === 'clone' && path[4] === 'task' && method === 'GET')
      return json(await this.clones.status(project));
    if (command === 'clone' && path[4] === 'start' && method === 'POST')
      return json(await this.clones.start(project, principal, await this.body(request)), 202);
    if (command === 'clone' && ['pause', 'resume', 'stop'].includes(path[4]) && method === 'POST')
      return json(await this.clones.control(project, await this.body(request), path[4]));
    if (command === 'clone' && path[4] === 'quality-report' && method === 'GET') {
      const key = project.draft.cloneConfig?.generation?.quality?.reportKey;
      requireCondition(key?.startsWith(`projects/${project.id}/quality/`), 404, 'quality_report_missing', '还没有可用的质量报告。');
      const object = await this.env.MEDIA.get(key!);
      requireCondition(object, 404, 'quality_report_missing', '质量报告不存在。');
      return new Response(object.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (command === 'clone' && path[4] === 'scrape' && method === 'POST') {
      const b = await this.body(request);
      requireCondition(
        typeof b.url === 'string' && b.url.trim(),
        400,
        'invalid_url',
        '请输入网址。',
      );
      const scraped = await scrapeTargetUrl(b.url.trim());
      return json({ scraped });
    }
    if (command === 'clone' && path[4] === 'generate' && method === 'POST') {
      await this.clones.assertEditable(project);
      const b = await this.body(request);
      expectedVersion(project, b.expectedVersion);
      const cloneConfig = validateDraft({ ...project.draft, cloneConfig: { ...project.draft.cloneConfig, ...(b.cloneConfig as CloneConfig | undefined) } }).cloneConfig as CloneConfig;
      cloneConfig.uiImages = normalizeCloneImages(cloneConfig.uiImages);
      await this.validateAssets(project.id, { ...project.draft, cloneConfig });
      requireCondition(
        Boolean(
          cloneConfig?.targetUrl?.trim() ||
            (cloneConfig?.uiImages && cloneConfig.uiImages.length > 0),
        ),
        400,
        'missing_clone_source',
        '请提供目标网站 URL 或上传至少一张设计稿。',
      );
      project.draft.buildBranch = 'clone';
      project.draft.cloneConfig = {
        ...cloneConfig,
        status: 'generating',
      };
      const getImageBase64 = async (assetId: string) => {
        try {
          const asset = await this.projectAsset(project.id, assetId);
          const obj = await this.env.MEDIA.get(asset.key);
          if (!obj) return null;
          const ab = await obj.arrayBuffer();
          const b64 = Buffer.from(ab).toString('base64');
          return `data:${asset.contentType};base64,${b64}`;
        } catch {
          return null;
        }
      };

      try {
        const generated = await generateCloneBundle(
          this.env,
          project,
          cloneConfig,
          getImageBase64,
        );
        project.draft.cloneConfig = await storeCloneOutput(this.env, project.id, {
          ...cloneConfig,
          status: 'ready',
          ...generated,
          generatedAt: new Date().toISOString(),
          error: undefined,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        project.draft.cloneConfig = {
          ...cloneConfig,
          status: 'error',
          error: msg,
        };
        const next = this.changed(project);
        await this.store.update('projects', next).run();
        throw err;
      }
      const next = this.changed(project);
      await this.store.update('projects', next).run();
      return json({ project: next, generatedHtml: project.draft.cloneConfig.generatedHtml });
    }
    if (command === 'assets' && path[4] && (method === 'GET' || method === 'HEAD')) {
      const asset = await this.projectAsset(project.id, path[4]);
      if (new URL(request.url).searchParams.get('variant') === 'preview') {
        try {
          return await privateAssetPreview(request, this.env, asset);
        } catch {
          return this.assetResponse(request, asset);
        }
      }
      return this.assetResponse(request, asset);
    }
    if (command === 'import' && method === 'POST') {
      const b = await this.body(request);
      expectedVersion(project, b.expectedVersion);
      const ids = this.productIds(b.productIds);
      requireCondition(
        project.draft.products.length +
          ids.filter((id) => !project.draft.products.some((p) => p.source?.id === id)).length <=
          20,
        400,
        'product_limit',
        '每个网站最多包含 20 个产品。',
      );
      const { products } = await prService<{ products: ProductSnapshot[] }>(
        this.env,
        principal,
        'products',
        { productIds: ids },
      );
      this.assertSnapshots(products, ids);
      return json({ project: await this.importProducts(project, principal, products, false) });
    }
    if (command === 'source-check' && method === 'POST') {
      const changes = await this.sourceChanges(project, principal);
      await this.env.DB.prepare(
        'INSERT INTO source_reviews(project_id,user_id,reviewed_at,data) VALUES(?,?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET reviewed_at=excluded.reviewed_at,data=excluded.data',
      )
        .bind(
          project.id,
          principal.userId,
          Date.now(),
          JSON.stringify({ version: project.version, changes }),
        )
        .run();
      return json({ changes });
    }
    if (command === 'source-apply' && method === 'POST') {
      const b = await this.body(request);
      expectedVersion(project, b.expectedVersion);
      const ids = this.productIds(b.productIds);
      const reviewRow = await this.env.DB.prepare(
        'SELECT reviewed_at,data FROM source_reviews WHERE project_id=? AND user_id=?',
      )
        .bind(project.id, principal.userId)
        .first<{ reviewed_at: number; data: string }>();
      requireCondition(
        reviewRow && Date.now() - reviewRow.reviewed_at < 3600000,
        409,
        'source_review_required',
        '请先检查并审阅来源差异。',
      );
      const reviewed = JSON.parse(reviewRow.data) as {
        version: number;
        changes: { productId: string; before: ProductSnapshot; after: ProductSnapshot }[];
      };
      const changes = await this.sourceChanges(project, principal);
      requireCondition(
        reviewed.version === project.version &&
          ids.every((id) => {
            const prior = reviewed.changes.find((c) => c.productId === id),
              current = changes.find((c) => c.productId === id);
            return (
              prior &&
              current &&
              prior.before.version === current.before.version &&
              prior.after.version === current.after.version
            );
          }),
        409,
        'source_changed',
        '所选来源差异或当前草稿已变化，请重新检查。',
      );
      return json({
        project: await this.importProducts(
          project,
          principal,
          changes.filter((c) => ids.includes(c.productId)).map((c) => c.after),
          true,
        ),
      });
    }
    if (command === 'confirm-script' && method === 'POST') {
      const b = await this.body(request);
      expectedVersion(project, b.expectedVersion);
      requireCondition(
        project.draft.script.trim() &&
          project.draft.scenes.length >= (project.draft.duration === 8 ? 3 : 4),
        400,
        'script_incomplete',
        '请补齐脚本及对应分镜描述。',
      );
      project.draft.scriptConfirmedRevision = project.draft.scriptRevision;
      const next = this.changed(project);
      await this.store.update('projects', next).run();
      return json({ project: next });
    }
    if (command === 'confirm-storyboard' && method === 'POST') {
      const b = await this.body(request);
      expectedVersion(project, b.expectedVersion);
      assertScriptConfirmed(project.draft);
      const draft = {
        ...project.draft,
        storyboardConfirmedRevision: project.draft.storyboardRevision,
      };
      assertReadyForVideo(draft);
      await this.validateAssets(project.id, draft);
      project.draft = draft;
      const next = this.changed(project);
      await this.store.update('projects', next).run();
      return json({ project: next });
    }
    if (command === 'jobs' && path[4] && path[5] === 'retry' && method === 'POST')
      return json({ job: await this.retry(project, principal, path[4]) });
    if (command === 'jobs' && method === 'POST')
      return json(await this.enqueue(project, principal, await this.body(request)));
    if (command === 'accept-video' && method === 'POST') {
      const b = await this.body(request);
      expectedVersion(project, b.expectedVersion);
      requireCondition(typeof b.assetId === 'string', 400, 'invalid_asset', '请选择视频。');
      const asset = await this.projectAsset(project.id, b.assetId);
      requireCondition(
        supportedVideos.has(asset.contentType),
        400,
        'invalid_video',
        '选中的素材不是可用视频。',
      );
      await this.assertObject(asset);
      project.draft.heroAssetId = asset.id;
      project.draft.heroAccepted = true;
      const next = this.changed(project);
      await this.store.update('projects', next).run();
      return json({ project: next });
    }
    if (command === 'preview' && (method === 'GET' || method === 'POST')) {
      let draft=project.draft;
      if(method==='POST'){
        const input={ ...((await this.body(request)).draft as Draft), buildBranch:'template' as const,cloneConfig:undefined,siteDesign:undefined };
        requireCondition(!input.materials||project.materials,403,'materials_receipt_required','新版资料预览需要已接收的资料项目。');
        draft=project.materials?editDraft(project.draft,input):validateDraft(input);
      }
      if (method === 'POST') await this.validateAssets(project.id, draft);
      const lang = (url.searchParams.get('lang') ?? 'en') as Language;
      requireCondition(
        draft.languages.includes(lang),
        400,
        'invalid_language',
        '没有配置这种网站语言。',
      );
      const page = url.searchParams.get('page') ?? 'home';
      requireCondition(
        plannedPages(draft).includes(page as DesignPage),
        400,
        'invalid_page',
        '页面不存在。',
      );
      return json({
        html: await this.renderPage(draft, {
          projectId: project.id,
          lang,
          page,
          productId: url.searchParams.get('productId') || draft.primaryProductId || draft.products[0]?.id || undefined,
          assetUrl: (id: string) => `/api/projects/${project.id}/assets/${id}`,
          inquiryUrl: `/api/public/sites/${project.id}/inquiries`,
          preview: true,
        }),
      });
    }
    if ((command === 'publish' || command === 'restore') && method === 'POST')
      return json({
        job: await this.publish(
          project,
          principal,
          await this.body(request),
          command === 'restore',
        ),
      });
    if (command === 'offline' && method === 'POST') {
      project.offline = true;
      const next = this.changed(project);
      const pending = await this.store.list<Job>(
        'jobs',
        "project_id=? AND kind='publish' AND status IN ('queued','running','unknown')",
        [project.id],
      );
      const statements = [this.store.update('projects', next)];
      for (const job of pending) {
        job.input.cancelledByOffline = true;
        statements.push(this.store.update('jobs', job));
      }
      await this.store.batch(statements);
      return json({ project: next });
    }
    if (command === 'inquiries' && method === 'GET')
      return json({
        inquiries: await this.store.list<Inquiry>(
          'inquiries',
          'project_id=?',
          [project.id],
          'created_at DESC',
        ),
      });
    if (command === 'inquiries' && path[4] && path[5] === 'retry' && method === 'POST')
      return json({ inquiry: await this.retryInquiry(project, path[4]) });
    throw new DomainError(404, 'not_found', '接口不存在。');
  }
  private async productRadarProject(request: Request, identity: Principal, path: string[]): Promise<Response> {
    const principal = await currentMaterialsPrincipal(this.env, identity);
    // This handler has just refreshed the principal at the durable boundary.
    const project = await this.store.one<Project>('projects', path[0]);
    requireCondition(project && canManage(project, principal), 404, 'project_not_found', '项目不存在或没有访问权限。');
    const action = path[1], url = new URL(request.url);
    if (action === 'refresh-publication' && request.method === 'POST') {
      const job = await this.publish(project, principal, await this.body(request), false, true);
      return json(await this.projectServiceStatus(project, job.id));
    }
    requireCondition(project.materials && project.draft.materials, 409, 'materials_receipt_required', '此接口需要已接收的确认资料项目。');
    if (action === 'assets' && path[2] && request.method === 'GET')
      return this.assetResponse(request, await this.projectAsset(project.id, path[2]));
    if (action === 'preview' && request.method === 'GET') {
      if (url.searchParams.has('expectedVersion')) expectedVersion(project, Number(url.searchParams.get('expectedVersion')));
      const draft = project.draft, lang = (url.searchParams.get('lang') || draft.languages[0]) as Language;
      const page = (url.searchParams.get('page') || 'home') as DesignPage;
      const productId = url.searchParams.get('productId') || draft.primaryProductId;
      requireCondition(draft.languages.includes(lang), 400, 'invalid_language', '没有配置这种网站语言。');
      requireCondition(plannedPages(draft).includes(page), 400, 'invalid_page', '页面不存在。');
      requireCondition(draft.products.some(p => p.id === productId), 400, 'invalid_product', '没有配置这个产品。');
      const proxyBasePath = url.searchParams.get('proxyBasePath') || `/api/web-radar/projects/${project.id}`;
      const renderStarted = performance.now();
      const html = await this.renderPage(draft, { projectId: project.id, page, lang, productId,
        assetUrl: id => `${proxyBasePath}/assets/${encodeURIComponent(id)}`, inquiryUrl: '#', preview: true });
      const htmlStarted = performance.now();
      const response: ProjectServicePreview = { schemaVersion: 'wr-project-service-v1', projectId: project.id,
        projectVersion: project.version, page, lang, productId, proxyBasePath, assetBaseUrl: this.origin(), runtime: projectPreviewRuntimeForDraft(draft),
        html: projectPreviewHtml(html, proxyBasePath, this.origin(), { page, lang, productId, expectedVersion: project.version }) };
      const result = json(response);
      result.headers.set('Server-Timing', `wr-render;dur=${(htmlStarted - renderStarted).toFixed(1)}, wr-html;dur=${(performance.now() - htmlStarted).toFixed(1)}`);
      return result;
    }
    if (action === 'publish' && request.method === 'POST') {
      const job = await this.publish(project, principal, await this.body(request), false);
      return json(await this.projectServiceStatus(project, job.id));
    }
    if (['status', 'publication-status'].includes(action) && request.method === 'GET')
      return json(await this.projectServiceStatus(project, url.searchParams.get('jobId') || undefined));
    throw new DomainError(404, 'not_found', '接口不存在。');
  }
  private async projectServiceStatus(project: Project, jobId?: string): Promise<ProjectServiceStatus> {
    const job = jobId ? await this.store.one<Job>('jobs', jobId)
      : (await this.store.list<Job>('jobs', "project_id=? AND kind='publish'", [project.id], 'created_at DESC, rowid DESC'))[0];
    if (jobId) requireCondition(job?.projectId === project.id && job.kind === 'publish', 404, 'job_not_found', '发布任务不存在。');
    const release = job?.input.releaseId ? await this.store.one<Release>('releases', String(job.input.releaseId)) : undefined;
    const activeRelease = project.publishedReleaseId === release?.id ? release
      : project.publishedReleaseId ? await this.store.one<Release>('releases', project.publishedReleaseId) : undefined;
    const published = activeRelease?.status === 'succeeded' ? activeRelease : undefined;
    let completed = 0, total = 0;
    for (const asset of Object.values(release?.publicMedia?.assets ?? {})) {
      const widths = new Set(asset.widths), prepared = new Set(asset.variants.map(variant => variant.requestedWidth));
      total += widths.size;
      for (const width of widths) if (prepared.has(width)) completed++;
    }
    const base = `/api/integrations/product-radar/projects/${project.id}`;
    return { schemaVersion: 'wr-project-service-v1', projectId: project.id, projectVersion: project.version,
      hasUnpublishedChanges: !published || !samePublishedDraft(project.draft, published.draft),
      ...(published ? { publishedVersion: published.draftVersion } : {}),
      name: project.name, template: project.draft.template, languages: project.draft.languages,
      pages: plannedPages(project.draft), products: project.draft.products.map(({id, name}) => ({id, name})),
      primaryProductId: project.draft.primaryProductId,
      publication: job ? { status: job.status,
        phase: job.status === 'succeeded' ? 'complete' : ['failed', 'paused', 'cancelled'].includes(job.status) ? 'failed'
          : job.input.publishResult || job.status === 'unknown' ? 'recovering'
          : job.input.mediaPreparation && !job.input.publicationStarted ? 'preparing_media'
          : job.input.publicationStarted ? 'deploying' : 'queued',
        jobId: job.id, releaseId: release?.id, inputVersion: job.inputVersion,
        ...(total ? { mediaProgress: { completed, total } } : {}),
        ...(job.status === 'succeeded' && release?.status === 'succeeded' && !project.offline ? {url: release.url} : {}),
        ...(job.error ? {error: job.error} : {}), retryable: job.status === 'failed', updatedAt: job.updatedAt,
      } : { status: 'idle', phase: 'idle', retryable: false },
      ...(!project.offline && project.publishedReleaseId && project.siteUrl ? {publishedUrl: project.siteUrl} : {}),
      previewEndpoint: base + '/preview', publishEndpoint: base + '/publish', statusEndpoint: base + '/publication-status',
    };
  }
  private publicHistoryJob(job: Job): Job {
    if (job.kind === 'clone') return this.clones.publicJob(job);
    const { draft, products, principal, publishResult, ...input } = job.input;
    return { ...job, input };
  }
  private async detail(project: Project, principal: Principal) {
    const [assets, recentJobs, activeJobs, releases, activeRelease, quota, totals] = await Promise.all([
      this.store.list<Asset>('assets', 'project_id=?', [project.id]),
      this.store.list<Job>('jobs', 'project_id=?', [project.id], 'created_at DESC, id DESC', 20),
      this.store.list<Job>('jobs', "project_id=? AND status IN ('queued','running','paused','unknown')", [project.id], 'created_at DESC'),
      this.store.list<Release>('releases', 'project_id=?', [project.id], 'created_at DESC, id DESC', 20),
      project.publishedReleaseId ? this.store.one<Release>('releases', project.publishedReleaseId) : undefined,
      this.store.quota(principal.userId),
      this.env.DB.prepare('SELECT (SELECT count(*) FROM jobs WHERE project_id=?) AS jobsTotal, (SELECT count(*) FROM releases WHERE project_id=?) AS releasesTotal').bind(project.id, project.id).first<{jobsTotal:number;releasesTotal:number}>(),
    ]);
    const jobs = [...new Map([...recentJobs, ...activeJobs].map(job => [job.id, job])).values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    if (activeRelease && !releases.some(release => release.id === activeRelease.id)) releases.push(activeRelease);
    return { project, assets, jobs: jobs.map(job => this.publicHistoryJob(job)), releases: releases.map(release => ({ ...release, draft: release.id === project.publishedReleaseId ? release.draft : undefined, error: release.status === 'succeeded' ? undefined : release.error })), quota, history: { ...totals, limit: 20 } };
  }
  private async history(project: Project, url: URL) {
    const kind = url.searchParams.get('kind'), page = Number(url.searchParams.get('page') ?? 1);
    requireCondition((kind === 'jobs' || kind === 'releases') && Number.isInteger(page) && page > 0, 400, 'invalid_pagination', '历史记录分页参数无效。');
    const records = await this.store.list<Job | Release>(kind, 'project_id=?', [project.id], 'created_at DESC, id DESC', 21, (page-1)*20);
    return { page, hasMore: records.length > 20, records: records.slice(0,20).map(record => {
      if ('kind' in record) return this.publicHistoryJob(record);
      const { draft, ...release } = record;
      return { ...release, error: release.status === 'succeeded' ? undefined : release.error };
    }) };
  }
  private async deleteProject(id: string, principal: Principal): Promise<void> {
    const p = await this.project(id, principal);
    const domains = await this.env.DB.prepare('SELECT count(*) AS n FROM project_domains WHERE project_id=?').bind(id).first<{n:number}>();
    requireCondition(!domains?.n, 409, 'domains_bound', '请先解除该网站的自定义域名，再删除网站。');
    await this.store.batch([
      this.env.DB.prepare('DELETE FROM project_delivery_settings WHERE project_id=?').bind(id),
      ...this.store.deleteProjectStatements(id),
      this.env.DB.prepare('DELETE FROM provider_accounts WHERE scope=?').bind(id),
    ]);
    if (this.env.MEDIA) {
      try {
        const listed = await this.env.MEDIA.list({ prefix: `projects/${id}/` });
        const keys = listed.objects.map((o) => o.key);
        if (keys.length > 0) {
          await this.env.MEDIA.delete(keys);
        }
      } catch {
        // Storage cleanup is non-blocking
      }
    }
  }
  private async batchDeleteProjects(ids: string[], principal: Principal): Promise<number> {
    requireCondition(Array.isArray(ids) && ids.length > 0, 400, 'invalid_ids', '请提供要删除的项目 ID 列表。');
    requireCondition(ids.length <= 1000, 400, 'batch_limit_exceeded', '一次最多批量删除 1000 个项目。');
    let count = 0;
    for (const id of ids) {
      try {
        await this.deleteProject(id, principal);
        count++;
      } catch {
        // Skip projects not permitted or already removed
      }
    }
    return count;
  }
  private productIds(value: unknown): string[] {
    requireCondition(
      Array.isArray(value) &&
        value.length > 0 &&
        value.length <= 20 &&
        value.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 200) &&
        new Set(value).size === value.length,
      400,
      'invalid_products',
      '请选择 1–20 个不重复的产品。',
    );
    return value as string[];
  }
  private assertSnapshots(
    products: unknown,
    ids?: string[],
  ): asserts products is ProductSnapshot[] {
    requireCondition(
      Array.isArray(products) &&
        products.length <= 20 &&
        products.every((p) => snapshotSchema.safeParse(p).success) &&
        new Set(products.map((p) => p.id)).size === products.length,
      502,
      'invalid_source',
      '来源产品数据无效。',
    );
    if (ids)
      requireCondition(
        products.length === ids.length && products.every((p, i) => p.id === ids[i]),
        502,
        'incomplete_source',
        '来源没有返回所有已授权产品。',
      );
  }
  private async create(
    principal: Principal,
    rawRequestId: unknown,
    name: unknown,
    rawProducts: unknown,
    handoff: boolean,
    rawBuildBranch?: unknown,
    rawTargetUrl?: unknown,
  ): Promise<Project> {
    const rid = requestId(rawRequestId);
    requireCondition(
      typeof name === 'string' && name.trim() && name.length <= 200,
      400,
      'invalid_name',
      '请填写有效项目名称。',
    );
    const products = rawProducts ?? [];
    this.assertSnapshots(products);
    const scope = `create:${principal.userId}`,
      hash = await fingerprint({
        name: name.trim(),
        products,
        workspaceId: principal.workspaceId,
        handoff,rawBuildBranch,rawTargetUrl,
      }),
      existing = await this.store.idempotent<{ id: string }>(scope, rid, hash);
    if (existing) {
      const project = await this.project(existing.id, principal);
      const claim = await this.websiteQuota.find(scope, rid);
      if (claim) await this.websiteQuota.commit(claim);
      return project;
    }
    // Snapshot fields are supplied by PR only. Standalone creation re-fetches any selected IDs.
    let accepted = products;
    if (products.length && !handoff) {
      accepted = (
        await prService<{ products: ProductSnapshot[] }>(this.env, principal, 'products', {
          productIds: products.map((p) => p.id),
        })
      ).products;
      this.assertSnapshots(
        accepted,
        products.map((p) => p.id),
      );
    }
    const initialDraft = defaultDraft();
    if (rawBuildBranch === 'template' || rawBuildBranch === 'custom') {
      initialDraft.buildBranch = rawBuildBranch;
    } else if (handoff) {
      initialDraft.buildBranch = 'template';
    }
    if (rawBuildBranch === 'clone') {
      initialDraft.buildBranch = 'clone';
      initialDraft.cloneConfig = {
        targetUrl: typeof rawTargetUrl==='string'?rawTargetUrl.trim().slice(0,2000):'',
        enhancementMode:typeof rawTargetUrl==='string' && rawTargetUrl.trim()?'faithful':'smart',
        autoPublish:false,
        instructions: '',
        uiImages: [],
        status: 'idle',
      };
    }
    const claim = await this.websiteQuota.intent(principal, scope, rid, hash);
    await this.websiteQuota.reserve(claim);
    let p: Project = {
      id: claim.projectId,
      ownerId: principal.userId,
      workspaceId: principal.workspaceId,
      name: name.trim(),
      version: 1,
      draft: initialDraft,
      createdAt: now(),
      updatedAt: now(),
      offline: true,
    };
    const assets: Asset[] = [];
    try {
      for (const snapshot of accepted) {
        const gallery = await this.importGallery(p.id, principal, snapshot, assets);
        p.draft.products.push({
          id: crypto.randomUUID(),
          name: snapshot.name,
          description: snapshot.description,
          material: snapshot.material,
          dimensions: snapshot.dimensions,
          imageAssetId: gallery[0].assetId,
          gallery,
          tagline: snapshot.websiteCopy?.tagline,
          sellingPoints: snapshot.websiteCopy?.sellingPoints,
          applications: snapshot.websiteCopy?.applications,
          source: snapshot,
          productIdentity: snapshot.conditions.productIdentity ? ProductIdentitySchema.parse(snapshot.conditions.productIdentity) : undefined,
          identitySourceVersion: snapshot.version,
        });
      }
      p.draft.primaryProductId = p.draft.products[0]?.id ?? '';
      await this.store.batch([
        this.store.insert('projects', p),
        ...assets.map((a) => this.store.insert('assets', a)),
        this.store.remember(scope, rid, hash, { id: p.id }),
        this.websiteQuota.statement(claim, 'commit'),
      ]);
    } catch (e) {
      // A rejected D1 response does not prove the atomic transaction was rolled back.
      const durable = await this.store.idempotent<{ id: string }>(scope, rid, hash);
      if (durable) p = await this.project(durable.id, principal);
      else {
        await Promise.allSettled(assets.map((a) => this.env.MEDIA.delete(a.key)));
        await this.websiteQuota.release(claim).catch(() => {}); // Durable compensation retries in the alarm.
        throw e;
      }
    }
    await this.websiteQuota.commit(claim);
    return p;
  }
  private async importProducts(
    project: Project,
    principal: Principal,
    snapshots: ProductSnapshot[],
    apply: boolean,
  ): Promise<Project> {
    const draft = structuredClone(project.draft),
      assets: Asset[] = [];
    try {
      for (const snapshot of snapshots) {
        const existing = draft.products.find((p) => p.source?.id === snapshot.id);
        if (existing && !apply) continue;
        const gallery = await this.importGallery(project.id, principal, snapshot, assets);
        const product = {
          id: existing?.id ?? crypto.randomUUID(),
          name: snapshot.name,
          description: snapshot.description,
          material: snapshot.material,
          dimensions: snapshot.dimensions,
          imageAssetId: gallery[0].assetId,
          gallery,
          tagline: snapshot.websiteCopy?.tagline,
          sellingPoints: snapshot.websiteCopy?.sellingPoints,
          applications: snapshot.websiteCopy?.applications,
          source: snapshot,
          productIdentity: snapshot.conditions.productIdentity ? ProductIdentitySchema.parse(snapshot.conditions.productIdentity) : undefined,
          identitySourceVersion: snapshot.version,
        };
        if (existing)
          draft.products = draft.products.map((p) => (p.id === existing.id ? product : p));
        else draft.products.push(product);
      }
      draft.primaryProductId = draft.primaryProductId || draft.products[0]?.id || '';
      const adjusted = editDraft(project.draft, draft);
      adjusted.products = draft.products;
      project.draft = adjusted;
      const next = this.changed(project);
      await this.store.batch([
        ...assets.map((a) => this.store.insert('assets', a)),
        this.store.update('projects', next),
      ]);
      return next;
    } catch (e) {
      await Promise.allSettled(assets.map((a) => this.env.MEDIA.delete(a.key)));
      throw e;
    }
  }
  private async sourceChanges(project: Project, principal: Principal) {
    const old = project.draft.products
      .map((p) => p.source)
      .filter((s): s is ProductSnapshot => Boolean(s));
    if (!old.length) return [];
    const ids = old.map((s) => s.id);
    const { products } = await prService<{ products: ProductSnapshot[] }>(
      this.env,
      principal,
      'products',
      { productIds: ids },
    );
    this.assertSnapshots(products, ids);
    return old.flatMap((before) => {
      const after = products.find((p) => p.id === before.id)!;
      return before.version === after.version ? [] : [{ productId: before.id, before, after }];
    });
  }
  private async importGallery(projectId: string, principal: Principal, snapshot: ProductSnapshot, assets: Asset[]) {
    const gallery: NonNullable<import('../shared/model').Product['gallery']> = [];
    for (const image of snapshot.images!) {
      const asset = await this.importImage(projectId, principal, snapshot, image.id);
      assets.push(asset);
      gallery.push({assetId:asset.id,sourceImageId:image.id,kind:image.kind,caption:image.caption});
    }
    return gallery;
  }
  private async importImage(
    projectId: string,
    principal: Principal,
    snapshot: ProductSnapshot,
    imageId: string,
  ): Promise<Asset> {
    const productId = snapshot.id;
    const response = await prImage(this.env, principal, productId, snapshot.version, imageId);
    requireCondition(
      response.ok && response.body,
      502,
      'source_image_failed',
      '来源图片复制失败。',
    );
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
    requireCondition(
      supportedImages.has(contentType),
      502,
      'source_image_type',
      '来源图片格式不受支持。',
    );
    return this.saveAsset(
      projectId,
      {
        body: response.body,
        contentType,
        filename: `source-${productId}-${imageId}`,
        size: Number(response.headers.get('content-length')) || undefined,
        testMode: false,
      },
      'import',
    );
  }
  private async projectAsset(projectId: string, id: string, assets?: ReadonlyMap<string, Asset>): Promise<Asset> {
    const asset = assets ? assets.get(id) : await this.store.one<Asset>('assets', id);
    requireCondition(
      asset?.projectId === projectId,
      404,
      'asset_not_found',
      '素材不存在或没有权限。',
    );
    return asset;
  }
  private async assertObject(asset: Asset): Promise<void> {
    requireCondition(
      await this.env.MEDIA.head(asset.key),
      409,
      'asset_unavailable',
      '素材文件尚未完整保存，请重新上传。',
    );
  }
  private async validateAssets(projectId: string, draft: Draft, assets?: ReadonlyMap<string, Asset>): Promise<void> {
    const materialsProfile = validateMaterialsDraft(draft);
    const ownedAssets = new Map<string, Asset>();
    const bannerMedia = bannerAssets(draft);
    const imageRefs = new Set(assetReferences({...draft, heroAssetId:undefined,
      cloneConfig:draft.cloneConfig?{...draft.cloneConfig,referenceCapture:draft.cloneConfig.referenceCapture?{...draft.cloneConfig.referenceCapture,assets:draft.cloneConfig.referenceCapture.assets.filter(a=>!a.contentType.startsWith('video/'))}:undefined}:undefined,
      banners:draft.banners?.map(b=>({...b,videoAssetId:undefined})),
    }));
    for (const id of assetReferences(draft)) {
      const asset = await this.projectAsset(projectId, id, assets);
      if(draft.materials?.imageBindings.some(b=>b.assetId===id||b.mobileAssetId===id))requireCondition(['image/png','image/jpeg','image/webp'].includes(asset.contentType),400,'materials_asset_type','资料位置仅支持 PNG、JPEG 或 WebP 图片。');
      const video = id === draft.heroAssetId || bannerMedia.videos.includes(id) || !!draft.cloneConfig?.referenceCapture?.assets.some(a=>a.assetId===id&&a.contentType.startsWith('video/'));
      const image = supportedImages.has(asset.contentType) ||
        (id === draft.company.faviconAssetId && !bannerMedia.images.includes(id) && supportedIcons.has(asset.contentType));
      requireCondition(
        (!video || supportedVideos.has(asset.contentType)) && (!imageRefs.has(id) || image),
        400, 'asset_type_mismatch', '素材格式与用途不匹配。',
      );
      ownedAssets.set(id, asset);
    }
    if (materialsProfile?.imagePolicy === 'typed-regions-v1') {
      const verifiedHashes = new Map<string, string>();
      for (const id of materialsImageAssetIds(draft)) {
        const asset = ownedAssets.get(id)!;
        verifiedHashes.set(id, await this.materialsAssetHash(asset));
      }
      validateMaterialsDraft(draft, verifiedHashes);
    }
  }

  /** Only typed materials need byte identity; immutable project assets cache it after the first edit. */
  private async materialsAssetHash(asset: Asset): Promise<string> {
    const verifiedHash = (value: string | undefined): value is string => !!value && /^[a-f0-9]{64}$/.test(value);
    if (verifiedHash(asset.sha256)) return asset.sha256;
    const metadata = await this.env.MEDIA.head(asset.key);
    requireCondition(metadata, 409, 'asset_unavailable', '素材文件尚未完整保存，请重新上传。');
    let digest = metadata.customMetadata?.sha256;
    if (!verifiedHash(digest)) {
      const object = await this.env.MEDIA.get(asset.key);
      requireCondition(object, 409, 'asset_unavailable', '素材文件尚未完整保存，请重新上传。');
      digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await object.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
    }
    asset.sha256 = digest;
    await this.store.update('assets', asset).run();
    return digest;
  }

  private limitStream(
    body: ReadableStream<Uint8Array> | null,
    max: number,
  ): ReadableStream<Uint8Array> | null {
    if (!body) return null;
    let bytes = 0;
    return body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > max) throw new DomainError(413, 'asset_too_large', '文件超过允许大小。');
          controller.enqueue(chunk);
        },
      }),
    );
  }
  private async saveAsset(
    projectId: string,
    media: MediaResult,
    origin: Asset['origin'],
    assetId: string = crypto.randomUUID(),
  ): Promise<Asset> {
    requireCondition(
      supportedImages.has(media.contentType) || supportedIcons.has(media.contentType) || supportedVideos.has(media.contentType),
      502,
      'invalid_media_type',
      '服务返回的媒体格式不受支持。',
    );
    const maximum = supportedVideos.has(media.contentType) ? maxUpload : 20 * 1024 * 1024;
    requireCondition(
      !media.size || media.size <= maximum,
      413,
      'asset_too_large',
      '文件超过允许大小。',
    );
    const asset: Asset = {
      id: assetId,
      projectId,
      key: `projects/${projectId}/assets/${assetId}`,
      filename: media.filename.replace(/[^\w.\-\u4e00-\u9fff]/g, '_').slice(0, 200),
      contentType: media.contentType,
      size: 0,
      origin: media.testMode ? 'test' : origin,
      createdAt: now(),
    };
    const options = {
      httpMetadata: { contentType: asset.contentType },
      customMetadata: {
        filename: asset.filename,
        origin: asset.origin,
        projectId,
        createdAt: asset.createdAt,
      },
    };
    try {
      let result: R2Object | null;
      if (media.body instanceof Uint8Array) {
        requireCondition(
          media.body.byteLength <= maximum,
          413,
          'asset_too_large',
          '文件超过允许大小。',
        );
        result = await this.env.MEDIA.put(asset.key, media.body, options);
      } else result = await this.multipart(asset.key, media.body, maximum, options, media.size);
      requireCondition(result && result.size > 0, 502, 'empty_media', '没有收到可用的媒体文件。');
      asset.size = result.size;
      return asset;
    } catch (e) {
      await this.env.MEDIA.delete(asset.key).catch(() => {});
      throw e;
    }
  }
  private async multipart(
    key: string,
    body: ReadableStream<Uint8Array>,
    maximum: number,
    options: R2MultipartOptions,
    expectedSize?: number,
  ): Promise<R2Object> {
    // R2.put rejects unknown-length streams. Multipart bounds memory and supports provider chunking.
    const upload = await this.env.MEDIA.createMultipartUpload(key, options),
      reader = body.getReader();
    const partSize = 5 * 1024 * 1024,
      parts: R2UploadedPart[] = [];
    let buffer = new Uint8Array(partSize),
      used = 0,
      total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        requireCondition(total <= maximum, 413, 'asset_too_large', '文件超过允许大小。');
        let offset = 0;
        while (offset < value.length) {
          const take = Math.min(partSize - used, value.length - offset);
          buffer.set(value.subarray(offset, offset + take), used);
          used += take;
          offset += take;
          if (used === partSize) {
            parts.push(await upload.uploadPart(parts.length + 1, buffer));
            buffer = new Uint8Array(partSize);
            used = 0;
          }
        }
      }
      requireCondition(total > 0, 502, 'empty_media', '没有收到可用的媒体文件。');
      requireCondition(
        expectedSize === undefined || expectedSize === total,
        502,
        'media_length_mismatch',
        '媒体下载长度不完整，请恢复原任务重新下载。',
      );
      if (used) parts.push(await upload.uploadPart(parts.length + 1, buffer.subarray(0, used)));
      return await upload.complete(parts);
    } catch (error) {
      await Promise.allSettled([reader.cancel(), upload.abort()]);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
  private async upload(request: Request, project: Project): Promise<Asset> {
    requireCondition(
      Number(request.headers.get('content-length') ?? 0) <= maxUpload + 1024 * 1024,
      413,
      'asset_too_large',
      '上传视频不能超过 80MB。',
    );
    let data: FormData;
    try {
      data = await new Response(this.limitStream(request.body, maxUpload + 1024 * 1024), {
        headers: { 'content-type': request.headers.get('content-type') ?? '' },
      }).formData();
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError(400, 'invalid_upload', '请选择有效的图片或视频文件。');
    }
    const file = data.get('file');
    requireCondition(
      file && typeof file !== 'string' && file.size > 0,
      400,
      'invalid_upload',
      '请选择有效文件。',
    );
    const type = (!file.type || file.type === 'application/octet-stream') && /\.ico$/i.test(file.name)
      ? 'image/x-icon' : file.type.toLowerCase();
    requireCondition(
      supportedImages.has(type) || supportedIcons.has(type) || supportedVideos.has(type),
      400,
      'invalid_media_type',
      '支持 PNG、JPEG、WebP、GIF、ICO、MP4 和 WebM。',
    );
    const magic = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    requireCondition(
      this.matchesMagic(type, magic),
      400,
      'invalid_media_bytes',
      '文件内容与声明格式不一致。',
    );
    const asset = await this.saveAsset(
      project.id,
      {
        body: file.stream(),
        contentType: type,
        filename: file.name,
        size: file.size,
        testMode: false,
      },
      'upload',
    );
    try {
      await this.lock(async () => {
        requireCondition(await this.store.one<Project>('projects', project.id), 404, 'project_not_found', '项目已删除。');
        await this.store.insert('assets', asset).run();
      });
    } catch (e) {
      await this.env.MEDIA.delete(asset.key);
      throw e;
    }
    return asset;
  }
  private matchesMagic(type: string, b: Uint8Array): boolean {
    if (supportedIcons.has(type)) return b.length >= 22 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0 && (b[4] > 0 || b[5] > 0);
    const word = (start: number, end: number) => String.fromCharCode(...b.slice(start, end));
    return type === 'image/png'
      ? b[0] === 137 && word(1, 4) === 'PNG'
      : type === 'image/jpeg'
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : type === 'image/webp'
          ? word(0, 4) === 'RIFF' && word(8, 12) === 'WEBP'
          : type === 'image/gif'
            ? word(0, 3) === 'GIF'
            : type === 'video/mp4'
              ? word(4, 8) === 'ftyp'
              : type === 'video/webm'
                ? b[0] === 26 && b[1] === 69 && b[2] === 223 && b[3] === 163
                : false;
  }
  private async assetResponse(request: Request, asset: Asset): Promise<Response> {
    const headers = new Headers({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': asset.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${asset.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    });
    let range: { offset: number; length: number } | undefined;
    const requested = request.headers.get('Range');
    if (requested) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${asset.size}` },
        });
      const start = match[1] ? Number(match[1]) : Math.max(0, asset.size - Number(match[2]));
      const end =
        match[1] && match[2] ? Math.min(Number(match[2]), asset.size - 1) : asset.size - 1;
      if (start >= asset.size || end < start)
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${asset.size}` },
        });
      range = { offset: start, length: end - start + 1 };
      headers.set('Content-Range', `bytes ${start}-${end}/${asset.size}`);
    }
    const object = await this.env.MEDIA.get(asset.key, range ? { range } : undefined);
    requireCondition(object, 404, 'asset_unavailable', '素材文件不存在。');
    headers.set('Content-Length', String(range?.length ?? asset.size));
    return new Response(request.method === 'HEAD' ? null : object.body, {
      status: range ? 206 : 200,
      headers,
    });
  }
  private async enqueue(
    project: Project,
    principal: Principal,
    body: Record<string, unknown>,
  ): Promise<{ job: Job; jobs?: Job[] }> {
    const rid = requestId(body.requestId),
      scope = `jobs:${project.id}:${principal.userId}`,
      hash = await fingerprint(body),
      remembered = await this.store.idempotent<{ ids: string[] }>(scope, rid, hash);
    if (remembered) {
      const jobs = await Promise.all(remembered.ids.map((id) => this.store.one<Job>('jobs', id)));
      return { job: jobs[0]!, jobs: jobs as Job[] };
    }
    expectedVersion(project, body.expectedVersion);
    const kind = body.kind;
    requireCondition(
      kind === 'consultation' ||
        kind === 'script' ||
        kind === 'copy' ||
        kind === 'image' ||
        kind === 'video' ||
        kind === 'site-build',
      400,
      'invalid_job_kind',
      '不支持的生成任务。',
    );
    requireCondition(
      project.draft.products.length > 0 &&
        project.draft.products.some((p) => p.id === project.draft.primaryProductId),
      400,
      'primary_required',
      '请先添加产品并选择主产品。',
    );
    const instructions = body.instructions ?? '';
    requireCondition(
      typeof instructions === 'string' && instructions.length <= 4000,
      400,
      'invalid_instructions',
      '修改要求不能超过 4000 字。',
    );
    if (kind === 'consultation') {
      assertSiteIntakeReady(project.draft);
      await this.validateAssets(project.id, project.draft);
      const previous = project.draft.consultation;
      const active = previous?.jobId
        ? await this.store.one<Job>('jobs', previous.jobId)
        : undefined;
      requireCondition(
        !active || !['queued', 'running', 'unknown'].includes(active.status),
        409,
        'consultation_in_progress',
        '正在理解资料，请等待当前问题生成。',
      );
      requireCondition(
        body.restart === undefined || typeof body.restart === 'boolean',
        400,
        'invalid_restart',
        '重新整理参数无效。',
      );
      const next =
        body.restart === true || !previous
          ? ({ revision: (previous?.revision ?? -1) + 1, answers: [] } as NonNullable<
              Draft['consultation']
            >)
          : structuredClone(previous);
      if (body.answer !== undefined || body.questionId !== undefined) {
        requireCondition(
          next.question && body.questionId === next.question.id,
          409,
          'question_changed',
          '问题已更新，请刷新后回答当前问题。',
        );
        requireCondition(
          typeof body.answer === 'string' &&
            body.answer.trim().length > 0 &&
            body.answer.length <= 4000,
          400,
          'invalid_answer',
          '请填写不超过 4000 字的回答。',
        );
        requireCondition(
          next.answers.length < 10,
          409,
          'consultation_limit',
          '信息已收集完成，请整理当前需求。',
        );
        next.answers.push({
          questionId: next.question.id,
          question: next.question.prompt,
          answer: body.answer.trim(),
        });
        next.question = undefined;
      } else {
        requireCondition(!next.question, 409, 'answer_required', '请先回答当前问题。');
        requireCondition(
          !next.brief || !!instructions.trim(),
          409,
          'brief_ready',
          '需求已整理完成，请确认或填写修改要求。',
        );
      }
      const before = structuredClone(project.draft);
      if (next.brief && instructions.trim())
        next.revisionContext = {
          brief: structuredClone(next.brief),
          instructions: instructions.trim(),
        };
      next.revision++;
      next.confirmed = false;
      next.jobId = undefined;
      project.draft.consultation = next;
      resetDesignForEdit(before, project.draft);
    }
    let scenes: (Scene | undefined)[] = [undefined];
    let pages: DesignPage[] = [];
    if (kind === 'image' && body.pageId !== undefined) {
      requireCondition(
        briefConfirmed(project.draft),
        409,
        'brief_unconfirmed',
        '请先完成需求提问并确认需求与页面清单。',
      );
      assertSiteContentReady(project.draft);
      const originalImages = new Set(
        [
          ...project.draft.products.map((p) => p.imageAssetId),
          project.draft.company.logoAssetId,
        ].filter(Boolean),
      );
      requireCondition(
        originalImages.size <= 19,
        400,
        'design_references_limit',
        '产品与 Logo 原图合计最多 19 张，以便同时参考已确认首页。请减少原图后再生成。',
      );
      requireCondition(
        typeof body.pageId === 'string' &&
          (body.pageId === 'remaining' ||
            plannedPages(project.draft).includes(body.pageId as DesignPage)),
        400,
        'invalid_design_page',
        '页面类型无效。',
      );
      const design = project.draft.siteDesign ?? { revision: 0, pages: {} };
      design.pageIds = plannedPages(project.draft);
      if (body.pageId !== 'home')
        requireCondition(
          homeConfirmed(design),
          409,
          'home_unconfirmed',
          '请先生成并确认首页设计稿。',
        );
      pages =
        body.pageId === 'remaining'
          ? plannedPages(project.draft).filter(
              (id) => id !== 'home' && !design.pages[id]?.imageAssetId,
            )
          : [body.pageId as DesignPage];
      requireCondition(
        pages.length,
        409,
        'designs_complete',
        '全部设计稿均已生成，可以选择单页重做。',
      );
      for (const page of pages) {
        const referenceIds = new Set(originalImages);
        if (page === 'detail') for (const image of project.draft.products.find(product=>product.id === project.draft.primaryProductId)?.gallery ?? []) referenceIds.add(image.assetId);
        requireCondition(referenceIds.size <= 19, 400, 'design_references_limit', '产品、套图和 Logo 参考图合计最多 19 张，请减少选用图片后再生成。');
        try {
          validatePageDesignInput(
            project.draft,
            page,
            instructions,
            referenceIds.size + (page === 'home' ? 0 : 1),
          );
        } catch (error) {
          if (error instanceof ProviderError) throw new DomainError(400, error.code, error.message);
          throw error;
        }
        const id = design.pages[page]?.jobId;
        const active = id ? await this.store.one<Job>('jobs', id) : undefined;
        requireCondition(
          !active || !['queued', 'running', 'unknown'].includes(active.status),
          409,
          'design_in_progress',
          '该页面正在生成，请等待当前任务完成。',
        );
      }
      if (pages.includes('home')) {
        design.pages = {};
        design.homeConfirmedAssetId = undefined;
      }
      design.confirmedKey = undefined;
      design.build = undefined;
      project.draft.siteDesign = design;
      await this.validateAssets(project.id, project.draft);
      scenes = pages.map(() => undefined);
    } else if (kind === 'image') {
      assertScriptConfirmed(project.draft);
      if (body.sceneId !== undefined) {
        requireCondition(typeof body.sceneId === 'string', 400, 'invalid_scene', '分镜标识无效。');
        const scene = project.draft.scenes.find((s) => s.id === body.sceneId);
        requireCondition(scene, 404, 'scene_not_found', '分镜不存在。');
        scenes = [scene];
      } else scenes = project.draft.scenes.filter((s) => !s.imageAssetId);
      requireCondition(
        scenes.length > 0,
        409,
        'storyboard_complete',
        '当前分镜均已有图片，可选择单张重做。',
      );
    }
    if (kind === 'video') {
      assertReadyForVideo(project.draft);
      await this.validateAssets(project.id, project.draft);
    }
    if (kind === 'site-build') {
      assertSiteContentReady(project.draft);
      requireCondition(
        designsConfirmed(project.draft.siteDesign),
        409,
        'designs_unconfirmed',
        '请先确认当前全部设计稿。',
      );
      const oldId = project.draft.siteDesign?.build?.jobId;
      const old = oldId ? await this.store.one<Job>('jobs', oldId) : undefined;
      requireCondition(
        !old || !['queued', 'running', 'unknown'].includes(old.status),
        409,
        'build_in_progress',
        '网站正在生成，请等待当前任务完成。',
      );
      await this.validateAssets(project.id, project.draft);
    }
    const timestamp = now();
    const jobs: Job[] = scenes.map((scene, index) => ({
      id: crypto.randomUUID(),
      projectId: project.id,
      userId: principal.userId,
      kind,
      status: 'queued',
      requestId: rid,
      input: {
        draft: structuredClone(project.draft),
        principal: structuredClone(principal),
        sceneId: scene?.id,
        ...(pages[index] ? { pageId: pages[index] } : {}),
        instructions,
      },
      inputVersion: project.version,
      createdAt: timestamp,
      updatedAt: timestamp,
      attempts: 0,
      testMode: testMode(this.env),
    }));
    const statements = jobs.map((j) => this.store.insert('jobs', j));
    if (pages.length) {
      pages.forEach((page, index) => {
        project.draft.siteDesign!.pages[page] = { jobId: jobs[index].id };
      });
      statements.push(this.store.update('projects', this.changed(project)));
    }
    if (kind === 'consultation') {
      project.draft.consultation!.jobId = jobs[0].id;
      statements.push(this.store.update('projects', this.changed(project)));
    }
    if (kind === 'site-build') {
      project.draft.siteDesign!.build = { jobId: jobs[0].id };
      statements.push(this.store.update('projects', this.changed(project)));
    }
    if (kind === 'image' || kind === 'video') {
      const quota = await this.store.quota(principal.userId),
        remaining =
          kind === 'image'
            ? quota.imageLimit - quota.imageUsed - quota.imageReserved
            : quota.videoLimit - quota.videoUsed - quota.videoReserved;
      requireCondition(
        quota.unlimited || remaining >= jobs.length,
        409,
        'quota_exhausted',
        `${kind === 'image' ? '图片' : '视频'}可用额度不足，请联系平台管理员。`,
      );
      statements.push(
        this.env.DB.prepare(
          `UPDATE quotas SET ${kind}_reserved=${kind}_reserved+? WHERE user_id=?`,
        ).bind(jobs.length, principal.userId),
      );
      for (const j of jobs)
        statements.push(
          this.env.DB.prepare(
            'INSERT INTO quota_ledger(job_id,user_id,kind,state,updated_at) VALUES(?,?,?,?,?)',
          ).bind(j.id, j.userId, j.kind, 'reserved', timestamp),
        );
    }
    statements.push(this.store.remember(scope, rid, hash, { ids: jobs.map((j) => j.id) }));
    await this.wake();
    await this.store.batch(statements);
    return { job: jobs[0], ...(jobs.length > 1 ? { jobs } : {}) };
  }
  private async retry(project: Project, principal: Principal, id: string): Promise<Job> {
    const job = await this.store.one<Job>('jobs', id);
    requireCondition(job?.projectId === project.id, 404, 'job_not_found', '任务不存在。');
    requireCondition(job.kind !== 'clone', 409, 'clone_retry_via_task', '请在设计稿生成页面继续暂停的任务，或重新开始生成。');
    if (job.status === 'succeeded' || job.status === 'queued' || job.status === 'running') {
      await this.wake();
      return job;
    }
    if (job.kind === 'consultation') {
      requireCondition(
        project.draft.consultation?.jobId === job.id,
        409,
        'stale_consultation_job',
        '资料已更新，请按当前资料重新整理需求。',
      );
    }
    if (job.kind === 'site-build') {
      requireCondition(
        job.input.remoteFailed !== true && Date.now() - Date.parse(job.createdAt) < 90 * 60_000,
        409,
        'build_retry_new',
        '该网站构建已结束，请在预览与发布中重新生成网站。',
      );
      requireCondition(
        project.draft.siteDesign?.build?.jobId === job.id &&
          designsConfirmed(project.draft.siteDesign),
        409,
        'stale_design_job',
        '设计稿已经更新，请重新生成网站。',
      );
      job.status = 'queued';
      job.error = undefined;
      job.input.retryAt = 0;
      job.input.pollFailures = 0;
      job.updatedAt = now();
      await this.wake();
      await this.store.update('jobs', job).run();
      return job;
    }
    if (job.kind === 'image' && typeof job.input.pageId === 'string') {
      const page = job.input.pageId as DesignPage;
      requireCondition(
        project.draft.siteDesign?.pages[page]?.jobId === job.id,
        409,
        'stale_design_job',
        '设计资料已更新，请从设计稿页面重新生成。',
      );
    }
    if ((job.status === 'unknown' || job.status === 'failed') && job.kind === 'publish') {
      requireCondition(
        job.attempts < 120,
        409,
        'retry_limit',
        '发布任务已达到重试上限，请检查 Cloudflare 状态。',
      );
      const release = await this.store.one<Release>('releases', String(job.input.releaseId));
      requireCondition(release, 404, 'release_not_found', '发布记录不存在。');
      job.status = 'queued';
      job.error = undefined;
      job.updatedAt = now();
      job.input.retryAt = 0;
      job.input.mediaFailures = 0;
      release.status = 'pending';
      release.error = undefined;
      await this.wake();
      await this.store.batch([
        this.store.update('jobs', job),
        this.store.update('releases', release),
      ]);
      return job;
    }
    if (job.status === 'unknown') {
      requireCondition(
        job.kind === 'video' && job.upstreamId,
        409,
        'submission_unknown',
        '上游提交结果不确定，必须先核实原任务；不能盲目重发。',
      );
      job.status = 'running';
      job.error = undefined;
      job.input.pollFailures = 0;
      delete job.input.nextPollAt;
      await this.wake();
      await this.store.update('jobs', job).run();
      return job;
    }
    requireCondition(
      job.kind !== 'email' && job.kind !== 'publish',
      409,
      'retry_via_workflow',
      '请通过对应发布或询盘操作重试。',
    );
    requireCondition(
      job.attempts < 3,
      409,
      'retry_limit',
      '该任务已达到技术重试上限，请检查失败原因后重新发起。',
    );
    if (job.kind === 'image' || job.kind === 'video') {
      // Restoring the same job never changes its original initiator or immutable inputs.
      const q = await this.store.quota(job.userId),
        remaining =
          job.kind === 'image'
            ? q.imageLimit - q.imageUsed - q.imageReserved
            : q.videoLimit - q.videoUsed - q.videoReserved;
      requireCondition(
        q.unlimited || remaining >= 1,
        409,
        'quota_exhausted',
        '原任务发起账号的可用额度不足。',
      );
      if (job.kind === 'video') {
        if (job.upstreamId)
          job.input.priorUpstreamIds = [
            ...(Array.isArray(job.input.priorUpstreamIds) ? job.input.priorUpstreamIds : []),
            job.upstreamId,
          ];
        job.upstreamId = undefined;
        job.input.submissionStarted = false;
        job.input.pollFailures = 0;
      }
      job.status = 'queued';
      job.error = undefined;
      job.updatedAt = now();
      await this.wake();
      await this.store.batch([
        this.env.DB.prepare(
          `UPDATE quotas SET ${job.kind}_reserved=${job.kind}_reserved+1 WHERE user_id=?`,
        ).bind(job.userId),
        this.env.DB.prepare(
          'UPDATE quota_ledger SET state=?,updated_at=? WHERE job_id=? AND state=?',
        ).bind('reserved', now(), job.id, 'released'),
        this.store.update('jobs', job),
      ]);
    } else {
      job.status = 'queued';
      job.error = undefined;
      job.updatedAt = now();
      await this.wake();
      await this.store.update('jobs', job).run();
    }
    void principal;
    return job;
  }
  private async publish(
    project: Project,
    principal: Principal,
    body: Record<string, unknown>,
    restore: boolean,
    refresh = false,
  ): Promise<Job> {
    const rid = requestId(body.requestId),
      scope = `publish:${project.id}:${principal.userId}`,
      hash = await fingerprint({ body, restore, ...(refresh ? { refresh: true } : {}) }),
      prior = await this.store.idempotent<{ id: string }>(scope, rid, hash);
    if (prior) return (await this.store.one<Job>('jobs', prior.id))!;
    let draft: Draft, draftVersion: number, restored: Release | undefined, refreshed: Release | undefined;
    if (refresh) {
      expectedVersion(project, body.expectedVersion);
      requireCondition(!project.offline && project.publishedReleaseId && project.publishedReleaseId === body.expectedPublishedReleaseId, 409, 'published_release_changed', '已发布版本已变化，请重新核对后刷新。');
      refreshed = await this.store.one<Release>('releases', project.publishedReleaseId);
      requireCondition(refreshed?.status === 'succeeded' && refreshed.projectId === project.id, 409, 'published_release_unavailable', '没有可刷新的成功发布快照。');
      draft = structuredClone(refreshed.draft);
      draftVersion = refreshed.draftVersion;
      assertPublishable(draft);
    } else if (restore) {
      restored = project.previousReleaseId
        ? await this.store.one<Release>('releases', project.previousReleaseId)
        : undefined;
      requireCondition(
        restored?.status === 'succeeded',
        409,
        'no_previous_release',
        '还没有可恢复的上一成功版本。',
      );
      draft = structuredClone(restored.draft);
      draftVersion = restored.draftVersion;
    } else {
      expectedVersion(project, body.expectedVersion);
      assertPublishable(project.draft);
      draft = structuredClone(project.draft);
      draftVersion = project.version;
    }
    if (draft.buildBranch === 'clone') {
      requireCondition(testMode(this.env) || draft.cloneConfig?.generation?.mode !== 'fixture', 400, 'clone_fixture_only', '演示页面不能发布到生产环境，请使用真实设计生成。');
      const output = await loadCloneOutput(this.env, project.id, draft);
      if (output.cloneConfig?.generatedFiles) validateSiteFiles(output.cloneConfig.generatedFiles, output);
      if (!refresh) draft.cloneConfig = await storeCloneOutput(this.env, project.id, draft.cloneConfig!);
      if (!restore && !refresh) project.draft.cloneConfig = draft.cloneConfig;
    }
    const assets = new Map((await this.store.list<Asset>('assets', 'project_id=?', [project.id])).map(asset => [asset.id, asset]));
    await this.validateAssets(project.id, draft, assets);
    const publicAssets = publicAssetReferences(draft);
    // Keep complete ownership/type/object checks without serial storage round trips per image.
    for (let offset = 0; offset < publicAssets.length; offset += 4) {
      const checked = await Promise.allSettled(publicAssets.slice(offset, offset + 4).map(async id =>
        this.assertObject(await this.projectAsset(project.id, id, assets))));
      const failure = checked.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    }
    const pending = await this.store.list<Job>(
      'jobs',
      "project_id=? AND kind='publish' AND status IN ('queued','running','unknown')",
      [project.id],
    );
    const activeRelease = refreshed ?? (project.publishedReleaseId
      ? await this.store.one<Release>('releases', project.publishedReleaseId)
      : undefined);
    if (!refresh && activeRelease?.draft.cloneConfig && hasCloneOutput(activeRelease.draft.cloneConfig)) activeRelease.draft.cloneConfig = await storeCloneOutput(this.env, project.id, activeRelease.draft.cloneConfig);
    const currentMetadata = await this.publicationMetadata(project, draft);
    if (!restore && !refresh) {
      const samePending = pending.find(job => !job.input.cancelledByOffline && job.input.draft && samePublishedDraft(draft, job.input.draft as Draft));
      if (samePending) {
        await this.store.remember(scope, rid, hash, { id: samePending.id }).run();
        return samePending;
      }
      if (!project.offline && activeRelease?.status === 'succeeded' && (!isTypedMaterials(draft) || activeRelease.rendererVersion === typedRendererVersion) && activeRelease.seo?.policyVersion === SEO_POLICY_VERSION && activeRelease.seo?.origin === currentMetadata.origin && (!this.env.SERVER_SITE_SUFFIX||matchesDeployment(activeRelease.hostingTarget,deploymentSelection(project,true),true)) && samePublishedDraft(draft, activeRelease.draft)) {
        const jobs = await this.store.list<Job>('jobs', "project_id=? AND kind='publish' AND status='succeeded'", [project.id], 'created_at DESC');
        const existing = jobs.find(job => job.input.releaseId === activeRelease.id);
        if (existing) {
          await this.store.remember(scope, rid, hash, { id: existing.id }).run();
          return existing;
        }
      }
    }
    requireCondition(!pending.some(job => !job.input.cancelledByOffline), 409, 'publish_pending', '已有发布任务正在处理，请先查看其状态。');
    const currentTarget =
      project.hostingTarget ?? activeRelease?.hostingTarget ?? restored?.hostingTarget;
    const target = await this.providers.resolveHostingTarget(project.id, currentTarget);
    requireCondition(
      !currentTarget || (this.env.SERVER_SITE_SUFFIX && (!!project.deployment || target.provider==='server')) ||
        (target.accountId === currentTarget.accountId &&
          target.pagesProjectName === currentTarget.pagesProjectName),
      503,
      'hosting_target_changed',
      '此网站已绑定固定的 Cloudflare 账号与 Pages 项目，不能自动改绑。',
    );
    project.hostingTarget = structuredClone(target);
    const release: Release = {
      id: crypto.randomUUID(),
      projectId: project.id,
      draftVersion,
      draft,
      ...(isTypedMaterials(draft) || refresh ? { rendererVersion: typedRendererVersion } : {}),
      ...(refreshed?.publicMedia?.ready && refreshed.publicMedia.policy === publicMediaPolicy ? { publicMedia: structuredClone(refreshed.publicMedia) } : {}),
      hostingTarget: structuredClone(target),
      seo: { policyVersion: SEO_POLICY_VERSION, origin: currentMetadata.origin ?? `https://${target.pagesProjectName}.pages.dev` },
      createdAt: now(),
      status: 'pending',
      testMode: testMode(this.env),
    };
    const job: Job = {
      id: crypto.randomUUID(),
      projectId: project.id,
      userId: principal.userId,
      kind: 'publish',
      status: 'queued',
      requestId: rid,
      input: { draft, releaseId: release.id, restoreReleaseId: restored?.id, ...(refreshed ? { refreshReleaseId: refreshed.id } : {}), principal, ...(isTypedMaterials(draft) ? { mediaPreparation: true } : {}) },
      inputVersion: project.version,
      createdAt: now(),
      updatedAt: now(),
      attempts: 0,
      testMode: testMode(this.env),
    };
    await this.wake();
    await this.store.batch([
      this.store.update('projects', project),
      this.store.insert('releases', release),
      this.store.insert('jobs', job),
      this.store.remember(scope, rid, hash, { id: job.id }),
    ]);
    return job;
  }
  private async publicSite(request: Request, projectId: string, path: string[]): Promise<Response> {
    const project = await this.store.one<Project>('projects', projectId);
    if (!project || project.offline || !project.publishedReleaseId)
      return new Response('Website temporarily unavailable', {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
      });
    const release = await this.store.one<Release>('releases', project.publishedReleaseId);
    requireCondition(
      release?.status === 'succeeded',
      503,
      'release_unavailable',
      'Website temporarily unavailable',
    );
    // Generated customer documents must not execute on the management application's origin.
    if (!testMode(this.env) && path[0] !== 'assets') {
      const destination = release.url ? new URL(release.url) : undefined;
      requireCondition(destination?.protocol === 'https:' && destination.origin !== this.origin(), 503, 'public_origin_unavailable', 'Website temporarily unavailable');
      destination.pathname = '/' + path.map(encodeURIComponent).join('/');
      destination.search = '';
      return new Response(null, { status: 302, headers: { Location: destination.href, 'Cache-Control': 'no-store' } });
    }
    if (path[0] === 'assets' && path[1]) {
      requireCondition(
        publicAssetReferences(release.draft).includes(path[1]),
        404,
        'asset_not_found',
        'Asset not found',
      );
      return this.assetResponse(request, await this.projectAsset(projectId, path[1]));
    }
    if (!path.length || path.join('/') === 'index.html')
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/public/sites/${projectId}/en/index.html`,
          'Cache-Control': 'no-store',
        },
      });
    const lang = path[0] as Language;
    requireCondition(
      release.draft.languages.includes(lang),
      404,
      'page_not_found',
      'Page not found',
    );
    let page: DesignPage = 'home',
      productId: string | undefined;
    if (path.length === 1 || path[1] === 'index.html') page = 'home';
    else if (path[1] === 'catalog') page = 'catalog';
    else if (
      (release.draft.siteDesign || release.draft.cloneConfig?.generatedFiles || release.draft.cloneConfig?.artifact) &&
      path[1] === 'products' &&
      (!path[2] || path[2] === 'index.html')
    )
      page = 'catalog';
    else if (path[1] === 'products' && path[2]) {
      page = 'detail';
      productId = path[2];
      requireCondition(
        release.draft.products.some((p) => p.id === productId),
        404,
        'page_not_found',
        'Product not found',
      );
    } else if (path[1] === 'about') page = 'about';
    else if (path[1] === 'contact') page = 'contact';
    else if (
      path[1]?.startsWith('extra-') &&
      plannedPages(release.draft).includes(path[1] as DesignPage) &&
      (!path[2] || path[2] === 'index.html') &&
      path.length <= 3
    )
      page = path[1] as DesignPage;
    else throw new DomainError(404, 'page_not_found', 'Page not found');
    const html = await this.renderPage(
      release.draft,
      {
        projectId,
        lang,
        page,
        productId,
        assetUrl: (id: string) => `${this.env.PUBLIC_SITE_ORIGIN||this.origin()}/public/sites/${projectId}/assets/${id}`,
        inquiryUrl: `/api/public/sites/${projectId}/inquiries`,
        preview: false,
      },
      `/public/sites/${projectId}`,
    );
    return new Response(request.method === 'HEAD' ? null : html, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  private async submitInquiry(request: Request, projectId: string): Promise<Response> {
    const body = await this.body(request);
    if (typeof body.website === 'string' && body.website.trim())
      return json({ id: 'received', emailStatus: 'queued' });
    const project = await this.store.one<Project>('projects', projectId);
    requireCondition(
      project && !project.offline && project.publishedReleaseId,
      409,
      'site_offline',
      'This website is currently unavailable.',
    );
    const release = await this.store.one<Release>('releases', project.publishedReleaseId);
    requireCondition(
      release?.status === 'succeeded',
      409,
      'site_offline',
      'This website is currently unavailable.',
    );
    const rid = requestId(body.requestId),
      name = typeof body.name === 'string' ? body.name.trim() : '',
      email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '',
      company = typeof body.company === 'string' ? body.company.trim() : '',
      message = typeof body.message === 'string' ? body.message.trim() : '';
    requireCondition(
      name.length >= 1 &&
        name.length <= 200 &&
        validEmail(email) &&
        company.length <= 300 &&
        message.length >= 1 &&
        message.length <= 10000,
      400,
      'invalid_inquiry',
      'Please provide your name, a valid email address and a message.',
    );
    const productId =
      body.productId === undefined || body.productId === '' ? undefined : body.productId;
    requireCondition(
      productId === undefined ||
        (typeof productId === 'string' && release.draft.products.some((p) => p.id === productId)),
      400,
      'invalid_product',
      'The selected product is not available.',
    );
    const scope = `inquiry:${projectId}`,
      hash = await fingerprint({ name, email, company, message, productId }),
      existing = await this.store.idempotent<{ id: string }>(scope, rid, hash);
    if (existing) {
      const inquiry = await this.store.one<Inquiry>('inquiries', existing.id);
      return json({ id: existing.id, emailStatus: inquiry!.emailStatus });
    }
    const timestamp = Date.now(),
      hour = Math.floor(timestamp / 3600000);
    const ipHash = await fingerprint(request.headers.get('CF-Connecting-IP') ?? 'unknown');
    const limiterKey = `${projectId}:${ipHash}:${hour}`;
    const count = await this.env.DB.prepare('SELECT count FROM inquiry_limits WHERE key=?')
      .bind(limiterKey)
      .first<{ count: number }>();
    requireCondition(
      (count?.count ?? 0) < 20,
      429,
      'rate_limited',
      'Too many submissions. Please try again later.',
    );
    const inquiry: Inquiry = {
      id: crypto.randomUUID(),
      projectId,
      requestId: rid,
      name,
      email,
      company,
      message,
      productId: productId as string | undefined,
      siteUrl: project.siteUrl ?? `${this.env.PUBLIC_SITE_ORIGIN||this.origin()}/public/sites/${projectId}/en/index.html`,
      createdAt: now(),
      emailStatus: 'queued',
      emailAttempts: 0,
    };
    const job: Job = {
      id: crypto.randomUUID(),
      projectId,
      userId: project.ownerId,
      kind: 'email',
      status: 'queued',
      requestId: rid,
      input: { inquiryId: inquiry.id, recipient: release.draft.company.email, resendAccountId: await new ProviderSettings(this.env).emailAccount(projectId) },
      inputVersion: release.draftVersion,
      createdAt: now(),
      updatedAt: now(),
      attempts: 0,
      testMode: testMode(this.env),
    };
    await this.wake();
    await this.store.batch([
      this.store.insert('inquiries', inquiry),
      this.store.insert('jobs', job),
      this.store.remember(scope, rid, hash, { id: inquiry.id }),
      this.env.DB.prepare(
        'INSERT INTO inquiry_limits(key,count,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+1',
      ).bind(limiterKey, 1, (hour + 1) * 3600000),
      this.env.DB.prepare('DELETE FROM inquiry_limits WHERE expires_at<?').bind(timestamp),
    ]);
    return json({ id: inquiry.id, emailStatus: inquiry.emailStatus });
  }
  private async retryInquiry(project: Project, id: string): Promise<Inquiry> {
    const inquiry = await this.store.one<Inquiry>('inquiries', id);
    requireCondition(inquiry?.projectId === project.id, 404, 'inquiry_not_found', '询盘不存在。');
    if (inquiry.emailStatus === 'sent' || inquiry.emailStatus === 'queued') return inquiry;
    requireCondition(inquiry.emailAttempts < 3, 409, 'retry_limit', '邮件已达到 3 次尝试上限。');
    const jobs = await this.store.list<Job>('jobs', "project_id=? AND kind='email'", [project.id]);
    const job = jobs.find((j) => j.input.inquiryId === id);
    requireCondition(job, 404, 'job_not_found', '邮件任务不存在。');
    requireCondition(
      !this.emailRetryExpired(job, true),
      409,
      'delivery_unknown',
      '邮件结果待核实，服务幂等保护时效已过；请先在发信平台核对，避免重复发送。',
    );
    job.status = 'queued';
    job.error = undefined;
    job.updatedAt = now();
    inquiry.emailStatus = 'queued';
    inquiry.emailError = undefined;
    await this.wake();
    await this.store.batch([
      this.store.update('jobs', job),
      this.store.update('inquiries', inquiry),
    ]);
    return inquiry;
  }
  private async admin(request: Request, principal: Principal, path: string[]): Promise<Response> {
    requireCondition(
      principal.systemRole === 'super_admin',
      403,
      'platform_admin_required',
      '此操作仅限平台管理员。',
    );
    if (!path.length && request.method === 'GET')
      return json({
        quotas: await this.store.quotas(),
        services: await withStoredEmailStatus(this.env, this.providers.status()),
        jobs: (await this.store.list<Job>('jobs', '', [], 'created_at DESC', 100)).map(job => this.publicHistoryJob(job)),
      });
    if (path[0] === 'metrics' && request.method === 'GET') {
      const since = new Date(Date.now() - 30*24*3600000).toISOString();
      const [jobs, attempts] = await Promise.all([
        this.env.DB.prepare("SELECT kind,status,count(*) AS count,avg(CASE WHEN status IN ('succeeded','failed','cancelled') THEN max(0,coalesce(json_extract(data,'$.cloneProgress.elapsedMs'),(julianday(json_extract(data,'$.updatedAt'))-julianday(created_at))*86400000)) END) AS averageElapsedMs FROM jobs WHERE created_at>=? GROUP BY kind,status").bind(since).all(),
        this.env.DB.prepare('SELECT provider,outcome,count(*) AS count FROM provider_attempts WHERE created_at>=? GROUP BY provider,outcome').bind(since).all(),
      ]);
      return json({ since, jobs: jobs.results, attempts: attempts.results });
    }
    if (path[0] === 'jobs' && path[1] && path[2] === 'reconcile' && request.method === 'POST') {
      const body = await this.body(request);
      requireCondition(
        typeof body.upstreamId === 'string' &&
          body.upstreamId.length >= 1 &&
          body.upstreamId.length <= 200 &&
          !/\s/.test(body.upstreamId),
        400,
        'invalid_upstream_id',
        '请填写在视频服务中核实过的原始任务编号。',
      );
      const job = await this.store.one<Job>('jobs', path[1]);
      requireCondition(
        job?.kind === 'video' && job.status === 'unknown',
        409,
        'reconciliation_unavailable',
        '只有待核实的视频任务可以绑定原任务编号。',
      );
      requireCondition(
        !job.upstreamId || job.upstreamId === body.upstreamId,
        409,
        'upstream_id_conflict',
        '不能替换已保存的上游任务编号。',
      );
      job.upstreamId = body.upstreamId;
      job.status = 'running';
      job.updatedAt = now();
      job.error = undefined;
      job.input.pollFailures = 0;
      delete job.input.nextPollAt;
      job.input.reconciliation = {
        userId: principal.userId,
        at: now(),
        upstreamId: body.upstreamId,
      };
      await this.wake();
      await this.store.update('jobs', job).run();
      return json({ job });
    }
    if (path[0] === 'quotas' && path[1] && request.method === 'PUT') {
      const b = await this.body(request);
      requireCondition(
        typeof b.imageLimit === 'number' &&
          Number.isInteger(b.imageLimit) &&
          b.imageLimit >= 0 &&
          b.imageLimit <= 1000000 &&
          typeof b.videoLimit === 'number' &&
          Number.isInteger(b.videoLimit) &&
          b.videoLimit >= 0 &&
          b.videoLimit <= 1000000,
        400,
        'invalid_quota',
        '额度必须为 0–1000000 的整数。',
      );
      const q = await this.store.quota(path[1]);
      requireCondition(
        b.unlimited === undefined || typeof b.unlimited === 'boolean',
        400,
        'invalid_quota',
        '不限额设置必须为布尔值。',
      );
      const unlimited = b.unlimited === undefined ? !!q.unlimited : b.unlimited;
      requireCondition(
        unlimited ||
          (b.imageLimit >= q.imageUsed + q.imageReserved &&
            b.videoLimit >= q.videoUsed + q.videoReserved),
        409,
        'quota_below_committed',
        '新额度不能低于已使用与占用的总量。',
      );
      await this.env.DB.prepare(
        'INSERT INTO quotas(user_id,image_limit,video_limit,unlimited) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET image_limit=excluded.image_limit,video_limit=excluded.video_limit,unlimited=excluded.unlimited',
      )
        .bind(path[1], b.imageLimit, b.videoLimit, unlimited ? 1 : 0)
        .run();
      return json({ quota: await this.store.quota(path[1]) });
    }
    if (path[0] === 'export' && request.method === 'GET') {
      const [projects, assets, jobs, releases, inquiries, quotas, ledger, attempts, idempotency] =
        await Promise.all([
          this.store.list<Project>('projects'),
          this.store.list<Asset>('assets'),
          this.store.list<Job>('jobs'),
          this.store.list<Release>('releases'),
          this.store.list('inquiries'),
          this.store.quotas(),
          this.env.DB.prepare('SELECT * FROM quota_ledger').all(),
          this.env.DB.prepare('SELECT * FROM provider_attempts').all(),
          this.env.DB.prepare('SELECT * FROM idempotency').all(),
        ]);
      const objects = backupManifest(projects, assets, jobs, releases);
      return json({
        format: 'web-radar-business-v1',
        exportedAt: now(),
        projects,
        assets,
        jobs,
        releases,
        inquiries,
        quotas,
        quotaLedger: ledger.results,
        providerAttempts: attempts.results,
        idempotency: idempotency.results,
        media: {
          format: 'R2 immutable objects',
          count: objects.length, objects,
          note: 'Copy all required object keys from MEDIA, including generated site artifacts. Optional clone checkpoints may not exist yet. Keep this export private; it contains business data, not authentication secrets.',
        },
      });
    }
    throw new DomainError(404, 'not_found', '接口不存在。');
  }
  private origin(): string {
    let url: URL;
    try {
      url = new URL(this.env.APP_ORIGIN ?? '');
    } catch {
      throw new DomainError(503, 'origin_unconfigured', '尚未配置 Web Radar 公开地址。');
    }
    requireCondition(
      url.origin === this.env.APP_ORIGIN &&
        (url.protocol === 'https:' ||
          (testMode(this.env) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))),
      503,
      'origin_unconfigured',
      'Web Radar 公开地址配置无效。',
    );
    return url.origin;
  }
  private async signingKey(): Promise<CryptoKey> {
    const secret =
      this.env.ASSET_SIGNING_KEY ??
      (testMode(this.env) ? 'web-radar-explicit-local-test-asset-key' : '');
    requireCondition(
      secret.length >= 32,
      503,
      'asset_signing_unconfigured',
      '尚未配置素材签名密钥。',
    );
    return crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
  }
  private async referenceUrl(asset: Asset): Promise<string> {
    const expires = Date.now() + 6 * 3600000;
    const data = new TextEncoder().encode(`${asset.id}:${expires}`),
      signature = new Uint8Array(await crypto.subtle.sign('HMAC', await this.signingKey(), data)),
      token = Array.from(signature)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return `${this.env.PUBLIC_SITE_ORIGIN||this.origin()}/public/provider-assets/${encodeURIComponent(asset.id)}?expires=${expires}&token=${token}`;
  }
  private async signedAsset(request: Request, id: string): Promise<Response> {
    const url = new URL(request.url),
      expires = Number(url.searchParams.get('expires')),
      token = url.searchParams.get('token') ?? '';
    requireCondition(
      Number.isSafeInteger(expires) &&
        expires > Date.now() &&
        expires <= Date.now() + 24 * 3600000 &&
        /^[a-f0-9]{64}$/.test(token),
      403,
      'invalid_asset_grant',
      '素材授权无效或已过期。',
    );
    const bytes = new Uint8Array(token.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    requireCondition(
      await crypto.subtle.verify(
        'HMAC',
        await this.signingKey(),
        bytes,
        new TextEncoder().encode(`${id}:${expires}`),
      ),
      403,
      'invalid_asset_grant',
      '素材授权无效或已过期。',
    );
    const asset = await this.store.one<Asset>('assets', id);
    requireCondition(asset, 404, 'asset_not_found', '素材不存在。');
    return this.assetResponse(request, asset);
  }
  private async wake(): Promise<void> {
    await this.scheduler.schedule(Date.now() + (testMode(this.env) ? 25 : 1000));
  }
  async tick(): Promise<void> {
    // Independent upstream calls can overlap; claims and quota changes still share the short lock.
    const lanes = ['clone', 'publish', 'email', 'other', 'materials', 'website-quota'] as const;
    await Promise.all(lanes.map(lane => {
      const active = this.activeLanes.get(lane);
      if (active) return active;
      const task = (lane === 'website-quota' ? this.websiteQuota.reconcile(operation => this.lock(operation)) : lane === 'materials' ? this.materials.tick() : lane === 'clone' ? this.clones.tick() : this.runTick(lane))
        .finally(() => { this.activeLanes.delete(lane); });
      this.activeLanes.set(lane, task);
      return task;
    }));
  }
  private laneFilter(lane: 'publish' | 'email' | 'other'): string {
    return lane === 'other' ? "kind NOT IN ('clone','publish','email')" : `kind='${lane}'`;
  }
  private async runTick(lane: 'publish' | 'email' | 'other'): Promise<void> {
    const selected = await this.lock(() => this.claim(lane));
    if (!selected) {
      const next = await this.nextActionTime(lane);
      if (next !== undefined) await this.scheduler.schedule(next);
      return;
    }
    const { job, recovery } = selected;
    try {
      if (recovery && job.kind !== 'video') {
        if (job.kind === 'site-build') {
          await this.execute(job);
          return;
        }
        if (job.kind === 'publish' && (job.input.publishResult || (job.input.mediaPreparation && !job.input.publicationStarted))) {
          await this.execute(job);
          return;
        }
        if (job.kind === 'image') {
          const key = `projects/${job.projectId}/assets/result-${job.id}`,
            object = await this.env.MEDIA.head(key);
          if (object?.size && object.httpMetadata?.contentType) {
            const asset: Asset = {
              id: `result-${job.id}`,
              projectId: job.projectId,
              key,
              contentType: object.httpMetadata.contentType,
              size: object.size,
              filename: object.customMetadata?.filename ?? 'result',
              origin: (object.customMetadata?.origin as Asset['origin']) ?? 'generated',
              createdAt: object.customMetadata?.createdAt ?? now(),
            };
            await this.finishMedia(job, asset);
            return;
          }
        }
        if (job.kind === 'email') {
          if (job.attempts >= 3 || this.emailRetryExpired(job, true))
            throw new ProviderError(
              'email_recovery_limit',
              '邮件状态待核实，已停止自动重发。',
              true,
            );
          await this.lock(async () => {
            job.status = 'queued';
            job.updatedAt = now();
            await this.store.update('jobs', job).run();
          });
          return;
        }
        await this.fail(
          job,
          new ProviderError(
            'job_interrupted',
            '任务在结果保存前中断，请核对后重试。',
            job.kind === 'publish',
          ),
        );
        return;
      }
      await this.execute(job);
    } catch (error) {
      if (error instanceof PublicationRescheduleError) {
        console.warn('Publication scheduling interrupted', {
          stage: 'reschedule', jobId: job.id, releaseId: job.input.releaseId,
          ...publicationErrorDetails(error.cause, this.env),
        });
        // Let the alarm handler reject so Cloudflare retries in an active instance.
        throw error.cause;
      }
      if (job.kind === 'publish' && job.input.mediaPreparation && !job.input.publicationStarted) {
        const detail = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown } : {};
        const errorClass = error instanceof Error ? error.constructor.name : 'UnknownError';
        console.error('Publication preparation failed', {
          stage: 'prepublication', jobId: job.id, releaseId: job.input.releaseId,
          errorClass: /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(errorClass) ? errorClass : 'Error',
          ...(typeof detail.code === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(detail.code) ? { code: detail.code } : {}),
          ...(typeof detail.status === 'number' && Number.isInteger(detail.status) && detail.status >= 100 && detail.status <= 599 ? { status: detail.status } : {}),
          ...publicationErrorDetails(error, this.env),
        });
      }
      await this.fail(job, error);
    }
  }
  private async nextActionTime(lane: 'publish' | 'email' | 'other'): Promise<number | undefined> {
    const jobs = await this.store.list<Job>('jobs', `${this.laneFilter(lane)} AND status IN ('queued','running','unknown')`);
    const occupied = jobs.some(
      (j) => j.kind === 'video' && (j.status === 'running' || j.status === 'unknown'),
    );
    const times: number[] = [];
    for (const job of jobs) {
      if (job.status === 'running' && job.kind === 'video' && job.upstreamId)
        times.push(
          Math.max(
            Date.now() + 100,
            Date.parse(job.updatedAt) + (testMode(this.env) ? 100 : 30_000),
            Number(job.input.nextPollAt ?? 0),
          ),
        );
      if (job.status === 'queued' && (job.kind !== 'video' || !occupied))
        times.push(Math.max(Date.now() + 100, Number(job.input.retryAt ?? 0)));
    }
    return times.length ? Math.min(...times) : undefined;
  }
  private async claim(lane: 'publish' | 'email' | 'other'): Promise<{ job: Job; recovery: boolean } | undefined> {
    const running = await this.store.list<Job>('jobs', `${this.laneFilter(lane)} AND status='running'`, [], 'created_at ASC');
    // A running non-video job can only remain here after a prior invocation was interrupted.
    const interrupted = running.find((j) => j.kind !== 'video');
    if (interrupted) {
      await this.scheduler.schedule(Date.now() + (testMode(this.env) ? 100 : 5000));
      return { job: interrupted, recovery: true };
    }
    const video = running.find((j) => j.kind === 'video');
    if (video) {
      if (!video.upstreamId) {
        video.status = video.input.submissionStarted ? 'unknown' : 'failed';
        video.error = video.input.submissionStarted
          ? '视频提交结果待核实；没有可靠任务编号，已保留额度与全局位置。'
          : '视频提交前任务中断，已退回额度。';
        video.updatedAt = now();
        await this.store.batch([
          this.store.update('jobs', video),
          ...(video.status === 'failed' ? await this.store.settlement(video, false) : []),
        ]);
      } else if (
        Number(video.input.nextPollAt ?? 0) <= Date.now() &&
        (testMode(this.env) || Date.now() - Date.parse(video.updatedAt) >= 30_000)
      ) {
        await this.scheduler.schedule(Date.now() + (testMode(this.env) ? 100 : 30_000));
        return { job: video, recovery: false };
      }
    }
    const unknownVideos = await this.store.list<Job>('jobs', "kind='video' AND status='unknown'");
    const queued = await this.store.list<Job>('jobs', `${this.laneFilter(lane)} AND status='queued'`, [], 'created_at ASC');
    const job = queued.find(
      (j) =>
        (j.kind !== 'video' || (!video && !unknownVideos.length)) &&
        Number(j.input.retryAt ?? 0) <= Date.now(),
    );
    if (!job) return undefined;
    await this.scheduler.schedule(Date.now() + (testMode(this.env) ? 100 : 5000));
    job.status = 'running';
    if (!(job.kind === 'publish' && job.input.mediaPreparation && !job.input.publicationStarted)) job.attempts++;
    job.updatedAt = now();
    job.error = undefined;
    const attemptId = crypto.randomUUID();
    job.input.attemptId = attemptId;
    const statements = [
      this.store.update('jobs', job),
      this.env.DB.prepare(
        'INSERT INTO provider_attempts(id,job_id,provider,operation,outcome,created_at) VALUES(?,?,?,?,?,?)',
      ).bind(
        attemptId,
        job.id,
        job.kind === 'video'
          ? 'agnes'
          : job.kind === 'image'
            ? 'image-2.5'
            : job.kind === 'email'
              ? 'resend'
              : job.kind === 'publish'
                ? 'cloudflare-pages'
                : job.kind === 'site-build'
                  ? 'screenshot-to-code'
                  : 'text',
        job.kind,
        'started',
        now(),
      ),
    ];
    if (job.kind === 'email') {
      const inquiry = await this.store.one<Inquiry>('inquiries', String(job.input.inquiryId));
      requireCondition(inquiry, 404, 'inquiry_not_found', '询盘不存在。');
      inquiry.emailAttempts = job.attempts;
      statements.push(this.store.update('inquiries', inquiry));
    }
    await this.store.batch(statements);
    return { job, recovery: false };
  }
  private emailRetryExpired(job: Job, previousAttempt = false): boolean {
    const firstAttempt = job.input.emailFirstAttemptAt;
    if (!previousAttempt && job.attempts <= 1 && firstAttempt === undefined) return false;
    // Old jobs lack a first-dispatch marker, so retain the conservative creation-time bound.
    const startedAt = typeof firstAttempt === 'number' ? firstAttempt : Date.parse(job.createdAt);
    return !Number.isFinite(startedAt) || Date.now() - startedAt >= 23 * 3600000;
  }
  private async verifyJobAccess(job: Job): Promise<Project> {
    const input = job.input as JobInput;
    requireCondition(input.principal, 403, 'task_principal_missing', '任务的原始身份缺失。');
    const result = await prService<{ principal: Principal }>(
      this.env,
      input.principal,
      'context',
      {},
    );
    return this.project(job.projectId, result.principal);
  }
  private async execute(job: Job): Promise<void> {
    const input = job.input as JobInput;
    // Tracking an already accepted upstream task is recovery, not a new authorized submission.
    if (job.kind !== 'email' && !(job.kind === 'video' && job.upstreamId))
      await this.verifyJobAccess(job);
    if (job.kind === 'consultation') {
      const draft = input.draft!;
      const latest = await this.store.one<Project>('projects', job.projectId);
      requireCondition(
        latest?.draft.consultation?.jobId === job.id &&
          latest.draft.consultation.revision === draft.consultation?.revision,
        409,
        'stale_consultation_job',
        '资料已更新，旧需求任务已取消。',
      );
      const ids = [
        ...new Set(
          [...draft.products.map((p) => p.imageAssetId), draft.company.logoAssetId].filter(
            (id): id is string => !!id,
          ),
        ),
      ];
      const refs: string[] = [];
      for (const id of ids)
        refs.push(await this.referenceUrl(await this.projectAsset(job.projectId, id)));
      const result = await this.providers.consult(draft, refs, input.instructions ?? '');
      let candidate: NonNullable<Draft['consultation']>;
      try {
        candidate = consultationSchema.parse({
          ...draft.consultation,
          jobId: undefined,
          confirmed: false,
          question:
            'question' in result ? { ...result.question, id: crypto.randomUUID() } : undefined,
          brief: 'brief' in result ? parseSiteBrief(result.brief, draft) : undefined,
          revisionContext: 'brief' in result ? undefined : draft.consultation?.revisionContext,
        });
        if (candidate.answers.length >= 10 && candidate.question) throw new Error('question limit');
        if (!candidate.question && !candidate.brief) throw new Error('missing result');
      } catch {
        throw new ProviderError(
          'consultation_invalid_response',
          '需求服务返回的内容不完整，请重试当前任务。',
        );
      }
      await this.lock(async () => {
        const p = await this.store.one<Project>('projects', job.projectId);
        const statements: D1PreparedStatement[] = [];
        if (
          p?.draft.consultation?.jobId === job.id &&
          p.draft.consultation.revision === draft.consultation?.revision
        ) {
          const before = structuredClone(p.draft);
          p.draft.consultation = candidate;
          resetDesignForEdit(before, p.draft);
          statements.push(this.store.update('projects', this.changed(p)));
        }
        await this.succeed(job, statements);
      });
      return;
    }
    if (job.kind === 'script') {
      const result = await this.providers.script(input.draft!);
      requireCondition(
        result.script.trim() &&
          result.scenes.length >= (input.draft!.duration === 8 ? 3 : 4) &&
          result.scenes.length <= 8,
        502,
        'invalid_script_result',
        '文字服务没有返回完整脚本与分镜。',
      );
      await this.lock(async () => {
        const p = await this.store.one<Project>('projects', job.projectId);
        const statements: D1PreparedStatement[] = [];
        if (p?.version === job.inputVersion) {
          const candidate = {
            ...p.draft,
            script: result.script,
            scenes: result.scenes.map((s) => ({
              id: s.id || crypto.randomUUID(),
              description: s.description,
              revision: 0,
            })),
          };
          p.draft = editDraft(p.draft, candidate);
          statements.push(this.store.update('projects', this.changed(p)));
        }
        job.input.result = { script: result.script, scenes: result.scenes };
        await this.succeed(job, statements);
      });
      return;
    }
    if (job.kind === 'copy') {
      const result = await this.providers.copy(input.draft!);
      await this.lock(async () => {
        const p = await this.store.one<Project>('projects', job.projectId);
        const statements: D1PreparedStatement[] = [];
        if (p?.version === job.inputVersion) {
          const before = structuredClone(p.draft);
          const { productTranslations, ...copy } = result;
          p.draft.copy = copy;
          for (const product of p.draft.products) {
            const t = productTranslations?.[product.id];
            if (t && typeof t === 'object') product.translations = t as typeof product.translations;
          }
          p.draft = validateDraft(p.draft);
          resetConsultationForEdit(before, p.draft);
          resetDesignForEdit(before, p.draft);
          statements.push(this.store.update('projects', this.changed(p)));
        }
        job.input.result = result;
        await this.succeed(job, statements);
      });
      return;
    }
    if (job.kind === 'image') {
      if (input.pageId) {
        const draft = input.draft!;
        const latest = await this.store.one<Project>('projects', job.projectId);
        requireCondition(
          latest?.draft.siteDesign?.pages[input.pageId]?.jobId === job.id &&
            latest.draft.siteDesign.revision === draft.siteDesign?.revision,
          409,
          'stale_design_job',
          '资料或设计已更新，旧图片任务已取消，预留额度已退回。',
        );
        const ids = [
          ...new Set(
            [
              ...(input.pageId !== 'home' ? [draft.siteDesign?.pages.home?.imageAssetId] : []),
              draft.products.find((p) => p.id === draft.primaryProductId)?.imageAssetId,
              ...draft.products.map((p) => p.imageAssetId),
              ...(input.pageId === 'detail' ? (draft.products.find(p=>p.id === draft.primaryProductId)?.gallery ?? []).map(image=>image.assetId) : []),
              draft.company.logoAssetId,
            ].filter((id): id is string => !!id),
          ),
        ];
        // These assets already belong to this project. Read R2 directly so the alarm
        // does not re-enter its own Coordinator through signed HTTP reference URLs.
        const refs: Blob[] = [];
        for (const id of ids) {
          const asset = await this.projectAsset(job.projectId, id);
          const object = await this.env.MEDIA.get(asset.key);
          requireCondition(object, 404, 'asset_not_found', '参考图片不存在，请重新上传。');
          const bytes = await limitedBytes(new Response(object.body), 20 * 1024 * 1024);
          refs.push(new Blob([bytes as BlobPart], { type: asset.contentType }));
        }
        const media = await this.providers.designImage(
          draft,
          input.pageId,
          input.instructions ?? '',
          refs,
        );
        await this.finishMedia(
          job,
          await this.saveAsset(job.projectId, media, 'generated', `result-${job.id}`),
        );
        return;
      }
      const draft = input.draft!,
        scene = draft.scenes.find((s) => s.id === input.sceneId);
      requireCondition(scene, 400, 'scene_not_found', '任务分镜不存在。');
      const primary = draft.products.find((p) => p.id === draft.primaryProductId);
      const referenceUrls = primary?.imageAssetId
        ? [await this.referenceUrl(await this.projectAsset(job.projectId, primary.imageAssetId))]
        : [];
      const media = await this.providers.image(
        draft,
        scene,
        input.instructions ?? '',
        referenceUrls,
      );
      const asset = await this.saveAsset(job.projectId, media, 'generated', `result-${job.id}`);
      await this.finishMedia(job, asset);
      return;
    }
    if (job.kind === 'video') {
      if (!job.upstreamId) {
        const refs = [];
        for (const scene of input.draft!.scenes)
          refs.push(
            await this.referenceUrl(await this.projectAsset(job.projectId, scene.imageAssetId!)),
          );
        // running is persisted before this call. An ambiguous response keeps the single global slot.
        await this.lock(async () => {
          job.input.submissionStarted = true;
          await this.store.update('jobs', job).run();
        });
        const submitted = await this.providers.submitVideo(
          input.draft!,
          refs,
          `${job.id}:${job.attempts}`,
        );
        requireCondition(
          typeof submitted.videoId === 'string' && submitted.videoId.length > 0,
          502,
          'submission_unknown',
          '视频服务没有返回可恢复的任务编号。',
        );
        await this.lock(async () => {
          job.upstreamId = submitted.videoId;
          job.updatedAt = now();
          await this.store.update('jobs', job).run();
        });
        return;
      }
      let result;
      try {
        result = await this.providers.pollVideo(job.upstreamId);
      } catch (error) {
        await this.lock(async () => {
          const rateLimited = error instanceof ProviderError && error.code === 'agnes_http_429';
          const failures = Number(job.input.pollFailures ?? 0) + (rateLimited ? 0 : 1);
          job.input.pollFailures = failures;
          job.input.nextPollAt =
            Date.now() +
            Math.max(60_000, error instanceof ProviderError ? (error.retryAfterMs ?? 0) : 0);
          job.error = rateLimited
            ? '视频服务查询限流，稍后自动继续查询原任务。'
            : `${error instanceof ProviderError ? error.message : '视频状态查询暂时失败'}，已保留原任务编号。`;
          job.updatedAt = now();
          if (
            (!rateLimited && failures >= 12) ||
            Date.now() - Date.parse(job.createdAt) > 24 * 3600000
          )
            job.status = 'unknown';
          await this.store.update('jobs', job).run();
        });
        return;
      }
      if (result.state === 'pending') {
        await this.lock(async () => {
          job.updatedAt = now();
          job.input.pollFailures = 0;
          delete job.input.nextPollAt;
          job.error = undefined;
          if (Date.now() - Date.parse(job.createdAt) > 24 * 3600000) {
            job.status = 'unknown';
            job.error = '视频任务已超过 24 小时，需核对上游状态。';
          }
          await this.store.update('jobs', job).run();
        });
        return;
      }
      if (result.state === 'failed')
        throw new ProviderError('video_failed', result.message ?? '视频任务技术失败，额度已退回。');
      requireCondition(
        result.media,
        502,
        'video_media_missing',
        '视频任务完成，但没有收到可保存的结果。',
      );
      try {
        const asset = await this.saveAsset(
          job.projectId,
          result.media,
          'generated',
          `result-${job.id}`,
        );
        await this.finishMedia(job, asset);
      } catch (error) {
        // A known successful upstream video can be downloaded again without submitting a new job.
        await this.lock(async () => {
          job.error = '视频已生成，但结果保存暂时失败，将继续下载原任务结果。';
          job.updatedAt = now();
          const failures = Number(job.input.pollFailures ?? 0) + 1;
          job.input.pollFailures = failures;
          if (failures >= 6) job.status = 'unknown';
          await this.store.update('jobs', job).run();
        });
      }
      return;
    }
    if (job.kind === 'site-build') {
      await this.executeSiteBuild(job);
      return;
    }
    if (job.kind === 'publish') {
      const release = await this.store.one<Release>('releases', input.releaseId!);
      requireCondition(release, 404, 'release_not_found', '发布快照不存在。');
      const p = await this.store.one<Project>('projects', job.projectId);
      requireCondition(
        p && !job.input.cancelledByOffline,
        409,
        'publication_cancelled',
        '网站下线操作已取消本次发布。',
      );
      const previous = p.publishedReleaseId
        ? await this.store.one<Release>('releases', p.publishedReleaseId)
        : undefined;
      requireCondition(!input.refreshReleaseId || (!p.offline && p.publishedReleaseId === input.refreshReleaseId), 409, 'publication_cancelled', '已发布版本已变化，已停止此次刷新。');
      requireCondition(
        !p.publishedReleaseId || previous?.status === 'succeeded',
        409,
        'previous_release_unavailable',
        '上一次已发布快照状态不一致，不能生成发布回退内容。',
      );
      const renderOptions = {
        projectId: job.projectId,
        assetUrl: (id: string) => `${this.env.PUBLIC_SITE_ORIGIN||this.origin()}/public/sites/${job.projectId}/assets/${id}`,
        inquiryUrl: `/api/public/sites/${job.projectId}/inquiries`,
        publicBaseUrl: `${this.env.PUBLIC_SITE_ORIGIN||this.origin()}/public/sites/${job.projectId}`,
      };
      if (job.input.mediaPreparation && !release.publicMedia?.ready) {
        if (!(await this.preparePublicationMedia(job, release, renderOptions))) return;
      }
      const files = await this.renderFiles(release.draft, { ...renderOptions, imageVariants: preparedImageVariants(release.publicMedia, renderOptions.assetUrl) });
      const previousPublication = previous
        ? { releaseId: previous.id, files: await this.renderFiles(previous.draft, { ...renderOptions, imageVariants: preparedImageVariants(previous.publicMedia, renderOptions.assetUrl) }), metadata: { ...(await this.publicationMetadata(p, previous.draft)), origin: previous.seo?.origin ?? `https://${previous.hostingTarget?.pagesProjectName ?? p.hostingTarget!.pagesProjectName}.pages.dev` } }
        : undefined;
      let published = input.publishResult;
      if (!published) {
        requireCondition(
          release.hostingTarget &&
            p.hostingTarget &&
            release.hostingTarget.accountId === p.hostingTarget.accountId &&
            release.hostingTarget.pagesProjectName === p.hostingTarget.pagesProjectName,
          503,
          'hosting_binding_missing',
          '发布版本缺少一致的持久化托管绑定，请先核对项目归属。',
        );
        await this.verifyJobAccess(job);
        await this.lock(async () => {
          if (input.refreshReleaseId) {
            const current = await this.store.one<Project>('projects', job.projectId);
            requireCondition(current && !current.offline && current.publishedReleaseId === input.refreshReleaseId, 409, 'publication_cancelled', '已发布版本已变化，已停止此次刷新。');
          }
          const persisted = await this.store.one<Job>('jobs', job.id);
          requireCondition(
            !persisted?.input.cancelledByOffline,
            409,
            'publication_cancelled',
            '网站已下线，本次发布已取消。',
          );
          if (job.input.mediaPreparation && !persisted?.input.publicationStarted) job.attempts++;
          job.input = { ...job.input, ...persisted?.input, publicationStarted: true };
          await this.store.update('jobs', job).run();
        });
        published = await this.providers.publish(
          job.projectId,
          release.id,
          files,
          previous?.deploymentId,
          release.hostingTarget,
          previousPublication,
          { ...(await this.publicationMetadata(p, release.draft)), origin: release.seo?.origin },
        );
        job.input.publishResult = structuredClone(published);
        // Preserve the accepted provider result before permission checks or the activation batch.
        await this.lock(async () => {
          const persisted = await this.store.one<Job>('jobs', job.id);
          job.input = {
            ...job.input,
            ...persisted?.input,
            publishResult: structuredClone(published),
          };
          await this.store.update('jobs', job).run();
        });
      }
      const accepted = published;
      await this.verifyJobAccess(job);
      await this.lock(async () => {
        const current = (await this.store.one<Project>('projects', job.projectId))!,
          persisted = (await this.store.one<Job>('jobs', job.id))!;
        requireCondition(!input.refreshReleaseId || (!current.offline && current.publishedReleaseId === input.refreshReleaseId), 409, 'publication_cancelled', '已发布版本已变化，已停止此次刷新。');
        requireCondition(
          !persisted.input.cancelledByOffline,
          409,
          'publication_cancelled',
          '本次发布期间网站已下线，未激活新版本。',
        );
        release.status = 'succeeded';
        release.error = undefined;
        release.deploymentId = accepted.deploymentId;
        release.url = accepted.url;
        release.testMode = accepted.testMode;
        current.previousReleaseId = current.publishedReleaseId;
        current.publishedReleaseId = release.id;
        current.siteUrl = accepted.url;
        current.offline = false;
        await this.succeed(job, [
          this.store.update('releases', release),
          this.store.update('projects', this.changed(current)),
        ]);
      });
      return;
    }
    const inquiry = await this.store.one<Inquiry>('inquiries', input.inquiryId!);
    requireCondition(inquiry, 404, 'inquiry_not_found', '询盘记录不存在。');
    if (inquiry.emailStatus === 'sent') {
      await this.lock(() => this.succeed(job, []));
      return;
    }
    if (this.emailRetryExpired(job))
      throw new ProviderError(
        'email_idempotency_expired',
        '邮件重试已超过幂等保护时效，必须先核对原发送结果。',
        true,
      );
    if (job.input.emailFirstAttemptAt === undefined) {
      job.input.emailFirstAttemptAt = Date.now();
      await this.lock(async () => {
        await this.store.update('jobs', job).run();
      });
    }
    // Check at dispatch too: a retry may have waited in the durable queue across the deadline.
    if (this.emailRetryExpired(job))
      throw new ProviderError(
        'email_idempotency_expired',
        '邮件重试已超过幂等保护时效，必须先核对原发送结果。',
        true,
      );
    const mailAccount = typeof job.input.resendAccountId === 'string' ? job.input.resendAccountId : 'environment';
    if (mailAccount === 'environment') await this.providers.email(inquiry, input.recipient!, `wr-inquiry-${inquiry.id}`);
    else await new ProviderSettings(this.env).email(mailAccount, inquiry, input.recipient!, `wr-inquiry-${inquiry.id}`);
    await this.lock(async () => {
      inquiry.emailStatus = 'sent';
      inquiry.emailAttempts = job.attempts;
      inquiry.emailError = undefined;
      await this.succeed(job, [this.store.update('inquiries', inquiry)]);
    });
  }
  private async finishMedia(job: Job, asset: Asset): Promise<void> {
    await this.lock(async () => {
      const persisted = await this.store.one<Job>('jobs', job.id);
      if (persisted?.status === 'succeeded') return;
      const input = job.input as JobInput,
        p = await this.store.one<Project>('projects', job.projectId),
        statements: D1PreparedStatement[] = [];
      if (!(await this.store.one<Asset>('assets', asset.id)))
        statements.push(this.store.insert('assets', asset));
      if (p && input.draft) {
        if (job.kind === 'image' && input.pageId) {
          const design = p.draft.siteDesign;
          if (
            design?.pages[input.pageId]?.jobId === job.id &&
            design.revision === input.draft.siteDesign?.revision
          ) {
            design.pages[input.pageId]!.imageAssetId = asset.id;
            statements.push(this.store.update('projects', this.changed(p)));
          }
        } else if (job.kind === 'image') {
          const scene = p.draft.scenes.find((s) => s.id === input.sceneId),
            before = input.draft.scenes.find((s) => s.id === input.sceneId);
          if (
            scene &&
            before &&
            p.draft.scriptRevision === input.draft.scriptRevision &&
            scene.revision === before.revision &&
            scene.description === before.description
          ) {
            scene.imageAssetId = asset.id;
            scene.revision++;
            p.draft.storyboardRevision++;
            p.draft.storyboardConfirmedRevision = undefined;
            p.draft.heroAccepted = false;
            statements.push(this.store.update('projects', this.changed(p)));
          }
        } else if (
          p.draft.scriptRevision === input.draft.scriptRevision &&
          p.draft.storyboardRevision === input.draft.storyboardRevision &&
          videoInputKey(p.draft) === videoInputKey(input.draft)
        ) {
          p.draft.heroAssetId = asset.id;
          p.draft.heroAccepted = false;
          p.draft.posterAssetId = p.draft.posterAssetId ?? input.draft.scenes[0]?.imageAssetId;
          statements.push(this.store.update('projects', this.changed(p)));
        }
      }
      job.resultAssetId = asset.id;
      await this.succeed(job, statements);
    });
  }
  private async storedSiteFiles(draft: Draft): Promise<Record<string, string>> {
    requireCondition(
      staticSiteReady(draft),
      409,
      'site_not_built',
      '请先确认设计稿并生成当前版本的网站。',
    );
    const build = draft.siteDesign!.build!;
    const object = await this.env.MEDIA.get(build.artifactKey!);
    requireCondition(object, 503, 'site_artifact_missing', '网站文件暂时不可用，请重新生成网站。');
    const files: unknown = await new Response(object.body).json();
    validateSiteFiles(files, draft);
    return files;
  }
  private async publicationMetadata(project: Project, draft: Draft): Promise<PublicationMetadata> {
    // Only a verified active binding may replace the hosting origin. Use the oldest
    // active binding consistently rather than whichever domain was refreshed last.
    const domain = await this.env.DB.prepare("SELECT hostname FROM project_domains WHERE project_id=? AND status='active' ORDER BY created_at ASC, hostname ASC LIMIT 1")
      .bind(project.id).first<{hostname:string}>();
    const target=this.env.SERVER_SITE_SUFFIX ? await this.providers.resolveHostingTarget(project.id,project.hostingTarget) : project.hostingTarget;
    return {
      origin: domain ? `https://${domain.hostname}` : target?.provider==='server' ? `https://${project.id}.${this.env.SERVER_SITE_SUFFIX}` : target ? `https://${target.pagesProjectName}.pages.dev` : undefined,
      draft,
      assetUrl: id => `${this.env.PUBLIC_SITE_ORIGIN||this.origin()}/public/sites/${project.id}/assets/${encodeURIComponent(id)}`,
    };
  }
  /** Prepare immutable bytes before Pages can see any candidate HTML. At most four distinct assets overlap. */
  private async preparePublicationMedia(job: Job, release: Release, options: Parameters<typeof renderSiteFiles>[1]): Promise<boolean> {
    if (!release.publicMedia) {
      release.publicMedia = { policy: publicMediaPolicy, ready: false, assets: {} };
      for (const id of publicAssetReferences(release.draft)) {
        const asset = await this.projectAsset(job.projectId, id);
        let identity = asset.sha256 ? `sha256:${asset.sha256}` : '';
        if (!identity) {
          const object = await this.env.MEDIA.head(asset.key);
          requireCondition(object?.httpEtag, 404, 'public_media_missing', '发布原图不存在。');
          identity = `r2-etag:${object.httpEtag}`;
        }
        release.publicMedia.assets[id] = { sourceKey: asset.key, sourceIdentity: identity, widths: [], variants: [] };
      }
      const requested = new Map<string, Set<number>>();
      await this.renderFiles(release.draft, { ...options, imageVariants: (id, widths) => {
        const values = requested.get(id) ?? new Set<number>();
        widths.forEach(width => values.add(width)); requested.set(id, values);
        return undefined;
      } });
      for (const [id, entry] of Object.entries(release.publicMedia.assets)) entry.widths = [...(requested.get(id) ?? [])].sort((a,b)=>a-b);
      await this.checkpointPublicationMedia(job, release);
    }
    const started = Date.now(); let count = 0, inputBytes = 0;
    while (true) {
      const wave: { asset: Asset; entry: PublicMediaAsset; width: number }[] = [];
      let remaining = false, aliasesChanged = false;
      for (const [id, entry] of Object.entries(release.publicMedia.assets)) {
        for (const width of entry.widths) {
          if (entry.variants.some(v => v.requestedWidth === width)) continue;
          const native = entry.variants.find(v => v.width < v.requestedWidth && v.requestedWidth < width);
          if (native) {
            entry.variants.push({ ...native, requestedWidth: width });
            aliasesChanged = true;
            continue;
          }
          remaining = true;
          if (count + wave.length >= 4 || (count + wave.length > 0 && Date.now() - started >= 30_000)) break;
          const asset = await this.projectAsset(job.projectId, id);
          if (count + wave.length > 0 && inputBytes + asset.size > 40 * 1024 * 1024) break;
          wave.push({ asset, entry, width }); inputBytes += asset.size;
          // Only the next width of this asset may run; native-size reuse needs its result first.
          break;
        }
      }
      if (!wave.length) {
        if (remaining) {
          await this.checkpointPublicationMedia(job, release, true);
          return false;
        }
        release.publicMedia.ready = true;
        await this.checkpointPublicationMedia(job, release);
        return true;
      }
      const results = await Promise.allSettled(wave.map(async ({ asset, entry, width }) => {
        await this.assertPublicationPreparing(job);
        return preparePublicVariant(this.env, asset, entry.sourceIdentity, width);
      }));
      count += wave.length;
      let saved = false;
      for (const [index, result] of results.entries()) {
        if (result.status !== 'fulfilled') continue;
        const { original, ...variant } = result.value;
        wave[index].entry.original = original;
        wave[index].entry.variants.push(variant);
        saved = true;
      }
      // All transforms have settled: persist successes even if a sibling failed. R2 metadata
      // recovers successful writes if this single locked checkpoint is itself interrupted.
      if (saved || aliasesChanged) await this.checkpointPublicationMedia(job, release);
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    }
  }
  private async assertPublicationPreparing(job: Job): Promise<Job> {
    const persisted = await this.store.one<Job>('jobs', job.id);
    requireCondition(persisted && !persisted.input.cancelledByOffline && ['queued','running'].includes(persisted.status), 409, 'publication_cancelled', '网站下线操作已取消本次发布。');
    return persisted;
  }
  private async checkpointPublicationMedia(job: Job, release: Release, defer = false): Promise<void> {
    await this.lock(async () => {
      const persisted = await this.assertPublicationPreparing(job);
      job.input = { ...job.input, ...persisted.input, mediaFailures: 0 };
      job.updatedAt = now();
      if (defer) {
        job.status = 'queued';
        job.input.retryAt = Date.now() + (testMode(this.env) ? 0 : 1000);
      }
      const statements = [this.store.update('releases', release), this.store.update('jobs', job)];
      if (defer && job.input.attemptId) statements.push(this.env.DB.prepare('UPDATE provider_attempts SET outcome=?,completed_at=? WHERE id=?').bind('pending', now(), job.input.attemptId));
      await this.store.batch(statements);
    });
    if (defer) {
      try {
        await this.scheduler.schedule(Number(job.input.retryAt));
      } catch (error) {
        throw new PublicationRescheduleError(error);
      }
    }
  }
  private async renderFiles(
    draft: Draft,
    options: Parameters<typeof renderSiteFiles>[1],
  ): Promise<Record<string, string>> {
    if (draft.buildBranch === 'clone' && hasCloneOutput(draft.cloneConfig)) {
      return renderCloneFiles(await loadCloneOutput(this.env, options.projectId, draft), options);
    }
    if (draft.buildBranch === 'template' || !draft.siteDesign) return renderSiteFiles(draft, options);
    return materializeSiteFiles(await this.storedSiteFiles(draft), draft, {
      assetUrl: options.assetUrl,
      inquiryUrl: options.inquiryUrl,
    });
  }
  private async renderPage(
    draft: Draft,
    options: Parameters<typeof renderSite>[1],
    basePath?: string,
  ): Promise<string> {
    if (draft.buildBranch === 'clone' && hasCloneOutput(draft.cloneConfig)) {
      const files = renderCloneFiles(await loadCloneOutput(this.env, options.projectId, draft), { ...options, basePath });
      const key = siteFilePath(options.lang, options.page, options.productId || draft.primaryProductId || draft.products[0]?.id);
      requireCondition(files[key], 404, 'page_not_found', '页面不存在。');
      return files[key];
    }
    if (draft.buildBranch === 'template' || !draft.siteDesign) return renderSite(draft, options);
    const files = materializeSiteFiles(await this.storedSiteFiles(draft), draft, {
      assetUrl: options.assetUrl,
      inquiryUrl: new URL(options.inquiryUrl, this.env.PUBLIC_SITE_ORIGIN||this.origin()).href,
      basePath,
    });
    const path = siteFilePath(
      options.lang ?? 'en',
      options.page ?? 'home',
      options.productId || draft.primaryProductId || draft.products[0]?.id,
    );
    requireCondition(files[path], 404, 'page_not_found', '页面不存在。');
    return files[path];
  }
  private async executeSiteBuild(job: Job): Promise<void> {
    const draft = (job.input as JobInput).draft!;
    const current = await this.store.one<Project>('projects', job.projectId);
    requireCondition(
      current?.draft.siteDesign?.build?.jobId === job.id &&
        designsConfirmed(current.draft.siteDesign),
      409,
      'stale_design_job',
      '设计资料已更新，请按当前版本重新生成网站。',
    );
    requireCondition(
      Date.now() - Date.parse(job.createdAt) < 90 * 60_000,
      504,
      'site_build_timeout',
      '网站构建超过等待时限，请检查生成服务后重新构建。',
    );
    let buildInput: import('./provider-contract').SiteBuildInput | undefined;
    if (!job.input.buildSubmitted) {
      const designImages = {} as Record<DesignPage, string>;
      let bytes = 0;
      const readReference = async (assetId: string) => {
        const asset = await this.projectAsset(job.projectId, assetId);
        bytes += asset.size;
        requireCondition(
          bytes <= 45 * 1024 * 1024,
          413,
          'design_images_large',
          '设计稿与参考原图总大小超限，请使用较小的图片。',
        );
        const object = await this.env.MEDIA.get(asset.key);
        requireCondition(object, 404, 'design_image_missing', '设计稿图片不存在，请重新生成。');
        return `data:${asset.contentType};base64,${base64FromBytes(new Uint8Array(await new Response(object.body).arrayBuffer()))}`;
      };
      for (const page of designPageIds(draft.siteDesign))
        designImages[page] = await readReference(draft.siteDesign!.pages[page]!.imageAssetId!);
      const referenceAssets: Record<string, string> = {};
      for (const id of new Set(
        [
          ...draft.products.flatMap((product) => [product.imageAssetId,...(product.gallery ?? []).map(image=>image.assetId)]),
          draft.company.logoAssetId,
        ].filter(Boolean),
      ))
        referenceAssets[id!] = await readReference(id!);
      buildInput = { draft, designImages, referenceAssets };
    }
    let result: import('./provider-contract').SiteBuildResult;
    try {
      result = await this.providers.siteBuild(job.id, buildInput);
    } catch (error) {
      // Both submit and lookup use the same durable id; retry never creates another paid build.
      if (
        error instanceof ProviderError &&
        !['site_builder_unconfigured', 'site_builder_url', 'site_builder_response'].includes(
          error.code,
        )
      ) {
        const failures = Number(job.input.pollFailures ?? 0) + 1;
        job.input.pollFailures = failures;
        if (failures < 5) {
          await this.deferSiteBuild(job, '网站服务暂时无法连接，正在查询原构建任务。');
          return;
        }
      }
      throw error;
    }
    job.input.buildSubmitted = true;
    job.input.pollFailures = 0;
    if (result.state === 'failed') {
      job.input.remoteFailed = true;
      throw new ProviderError(
        'site_build_failed',
        result.message || '网站生成失败，请查看设计稿后重新构建。',
      );
    }
    if (result.state === 'pending') {
      await this.deferSiteBuild(job, result.progress || '正在根据设计稿生成静态网页。');
      return;
    }
    validateSiteFiles(result.files, draft);
    // Validate the expanded publication, including URLs/CSP, against the actual Pages limit.
    materializeSiteFiles(result.files, draft, {
      assetUrl: (id) => `${this.env.PUBLIC_SITE_ORIGIN||this.origin()}/public/sites/${job.projectId}/assets/${id}`,
      inquiryUrl: `/api/public/sites/${job.projectId}/inquiries`,
    });
    const artifactKey = `projects/${job.projectId}/sites/${job.id}.json`;
    await this.env.MEDIA.put(artifactKey, JSON.stringify(result.files), {
      httpMetadata: { contentType: 'application/json' },
    });
    await this.lock(async () => {
      const p = await this.store.one<Project>('projects', job.projectId);
      const statements: D1PreparedStatement[] = [];
      if (p?.draft.siteDesign?.build?.jobId === job.id && designsConfirmed(p.draft.siteDesign)) {
        p.draft.siteDesign.build.artifactKey = artifactKey;
        p.draft.siteDesign.build.contacts = siteContacts(draft.company);
        statements.push(this.store.update('projects', this.changed(p)));
      }
      job.input.progress = '静态网站已生成，可以预览各个页面。';
      await this.succeed(job, statements);
    });
  }
  private async deferSiteBuild(job: Job, progress: string): Promise<void> {
    await this.lock(async () => {
      job.status = 'queued';
      job.updatedAt = now();
      job.input.progress = progress;
      job.input.retryAt = Date.now() + (testMode(this.env) ? 0 : 15_000);
      const statements = [this.store.update('jobs', job)];
      if (job.input.attemptId)
        statements.push(
          this.env.DB.prepare(
            'UPDATE provider_attempts SET outcome=?,completed_at=? WHERE id=?',
          ).bind('pending', now(), job.input.attemptId),
        );
      await this.store.batch(statements);
    });
  }
  private async succeed(job: Job, statements: D1PreparedStatement[]): Promise<void> {
    job.status = 'succeeded';
    job.updatedAt = now();
    job.error = undefined;
    statements.push(...(await this.store.settlement(job, true)), this.store.update('jobs', job));
    if (job.input.attemptId)
      statements.push(
        this.env.DB.prepare(
          'UPDATE provider_attempts SET outcome=?,completed_at=? WHERE id=?',
        ).bind('succeeded', now(), job.input.attemptId),
      );
    await this.store.batch(statements);
  }
  private async fail(job: Job, error: unknown): Promise<void> {
    await this.lock(async () => {
      const current = await this.store.one<Job>('jobs', job.id);
      if (current?.status === 'succeeded') return;
      const cancelledPublication =
        job.kind === 'publish' &&
        (Boolean(current?.input.cancelledByOffline) ||
          (error instanceof DomainError && error.code === 'publication_cancelled'));
      if (current?.input.cancelledByOffline) job.input.cancelledByOffline = true;
      const acceptedPublication = job.kind === 'publish' && Boolean(job.input.publishResult);
      const uncertain = cancelledPublication
        ? false
        : acceptedPublication ||
          (error instanceof ProviderError
            ? error.uncertain
            : (job.kind === 'publish' && Boolean(job.input.publicationStarted)) ||
              (job.kind === 'video' &&
                !job.upstreamId &&
                Boolean(job.input.submissionStarted) &&
                !(error instanceof DomainError)));
      job.status =
        uncertain && (job.kind === 'video' || job.kind === 'email' || job.kind === 'publish')
          ? 'unknown'
          : 'failed';
      job.error =
        error instanceof ProviderError || error instanceof DomainError
          ? error.message
          : '任务暂时失败，技术失败额度已退回；请检查服务状态后重试。';
      job.updatedAt = now();
      if (
        job.kind === 'video' &&
        error instanceof DomainError &&
        error.code === 'submission_unknown'
      ) {
        job.status = 'unknown';
        job.error = error.message;
      }
      const pagesPending =
        job.kind === 'publish' &&
        error instanceof ProviderError &&
        error.code === 'pages_deployment_pending';
      if (pagesPending && job.attempts < 120) {
        job.status = 'queued';
        job.input.retryAt = Date.now() + (testMode(this.env) ? 0 : 15000);
      }
      const mediaRetry = job.kind === 'publish' && !job.input.publicationStarted && !cancelledPublication &&
        error instanceof DomainError && error.code === 'public_media_retry';
      if (mediaRetry) {
        job.input.mediaFailures = Number(current?.input.mediaFailures ?? 0) + 1;
        if (Number(job.input.mediaFailures) < 6 && Date.now() - Date.parse(job.createdAt) < 2 * 3600000) {
          job.status = 'queued';
          job.input.retryAt = Date.now() + (testMode(this.env) ? 0 : 15_000);
        }
      }
      const statements: D1PreparedStatement[] = [this.store.update('jobs', job)];
      if (job.status === 'failed') statements.push(...(await this.store.settlement(job, false)));
      if (job.kind === 'email') {
        const inquiry = await this.store.one<Inquiry>('inquiries', String(job.input.inquiryId));
        if (inquiry) {
          inquiry.emailStatus = job.status === 'unknown' ? 'unknown' : 'failed';
          inquiry.emailAttempts = job.attempts;
          inquiry.emailError = job.error;
          statements.push(this.store.update('inquiries', inquiry));
        }
      }
      if (job.kind === 'publish') {
        const release = await this.store.one<Release>('releases', String(job.input.releaseId));
        if (release) {
          release.status = pagesPending || job.status === 'unknown' || job.status === 'queued' ? 'pending' : 'failed';
          release.error = job.error;
          statements.push(this.store.update('releases', release));
        }
      }
      if (job.input.attemptId)
        statements.push(
          this.env.DB.prepare(
            'UPDATE provider_attempts SET outcome=?,completed_at=? WHERE id=?',
          ).bind(job.status, now(), job.input.attemptId),
        );
      await this.store.batch(statements);
    });
  }
}
