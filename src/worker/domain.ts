import { viewTeamData } from '../shared/access';
import { ProductIdentitySchema } from "../shared/product-identity";
import type { BannerTarget } from '../shared/model';
import { bannerAssets, pageBanners } from '../shared/banner-config';
import { normalizeCloneImages } from '../shared/clone';
import { z } from 'zod';
import { retainedProductDisplayGroups, validProductDisplayGroups } from '../shared/product-display';
import { appliedMaterialsSchema } from '../shared/materials';
import { preserveMaterialsEdit } from './materials-draft';
import type { Draft, Principal, Project } from '../shared/model';
import {
  consultationSchema,
  designPageSchema,
  resetConsultationForEdit,
} from '../shared/site-brief';
import { resetDesignForEdit, staticSiteReady } from '../shared/site-design';

export class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requireCondition(
  condition: unknown,
  status: number,
  code: string,
  message: string,
): asserts condition {
  if (!condition) throw new DomainError(status, code, message);
}
const short = z.string().max(300),
  text = z.string().max(20000),
  id = z.string().min(1).max(200);
const language = z.enum(['en', 'de', 'fr', 'es', 'pt', 'it']);
const translation = z.object({ name: short, description: text });
const copy = z.object({
  headline: short,
  subtitle: text,
  about: text,
  cta: short,
  eyebrow: short.optional(),
  secondaryButtonText: short.optional(),
  secondaryButtonUrl: short.optional(),
  tags: z.array(short).max(10).optional(),
  floatingPills: z.array(short).max(10).optional(),
});
export { importProductSnapshotSchema as snapshotSchema } from '../shared/product-snapshot';
import { productSnapshotSchema as source, productImageKind } from '../shared/product-snapshot';
const draftSchema = z.object({
  productDisplayGroups: z.array(z.array(id).min(2).max(20)).max(10).optional(),
  materials: appliedMaterialsSchema.optional(),
  buildBranch: z.enum(['template', 'custom', 'clone']).optional(),
  templateConfirmed: z.boolean().optional(),
  company: z.object({
    name: short,
    email: short,
    contactName: short,
    type: z.enum(['trader', 'factory']),
    description: text,
    phone: short.optional().default(''),
    whatsapp: short.optional().default(''),
    address: text.optional().default(''),
    slogan: short.optional().default(''),
    establishedYear: short.optional().default(''),
    certifications: text.optional().default(''),
    capabilities: text.optional().default(''),
    targetMarkets: text.optional(),
    customerTypes: text.optional(),
    cooperationProcess: text.optional(),
    aboutImageAssetId: id.optional(),
    aboutSecondaryImageAssetId: id.optional(),
    aboutHeadline: short.optional().default(''),
    aboutStory: text.optional().default(''),
    aboutHighlights: text.optional().default(''),
    linkedin: short.optional().default(''),
    facebook: short,
    instagram: short,
    x: short,
    logoAssetId: id.optional(),
    faviconAssetId: id.optional(),
  }),
  products: z
    .array(
      z.object({
        id,
        name: short,
        description: text,
        productIdentity: ProductIdentitySchema.optional(),
        identitySourceVersion: id.optional(),
        material: text,
        dimensions: short,
        imageAssetId: id.optional(),
        gallery: z.array(z.object({assetId:id,sourceImageId:id,kind:productImageKind,caption:z.string().max(1000)})).min(1).max(11).optional(),
        tagline: z.string().max(160).optional(),
        sellingPoints: z.array(z.string().max(180)).max(5).optional(),
        applications: z.array(z.string().max(180)).max(5).optional(),
        source: source.optional(),
        translations: z.partialRecord(language, translation).optional(),
      }),
    )
    .max(20),
  primaryProductId: z.string().max(200),
  category: short,
  country: short,
  languages: z.array(language).min(1).max(2),
  template: z.enum([
    'natural',
    'technology',
    'explorer',
    'senseng-clean',
    'senseng-video',
    'saas-automation',
    'fintech-platform',
    'digital-marketing',
    'porto-accounting',
    'crafto-corporate',
    'juno-toys',
    'corpox-ai-agency',
    'corpox-consulting',
    'senseng-candy',
    'senseng-wonder',
    'senseng-arcade',
    'senseng-nature',
    'senseng-minimal',
    'universal-trade-banner',
    'universal-showcase-video',
    'toys-figure-banner',
    'toys-interactive-video',
    'plush-cushion-banner',
    'plush-living-video',
    'apparel-fabric-banner',
    'apparel-runway-video',
    'footwear-craft-banner',
    'footwear-kinetic-video',
    'luggage-leather-banner',
    'luggage-voyage-video',
    'jewelry-luxury-banner',
    'jewelry-timeless-video',
    'homedecor-aesthetic-banner',
    'homedecor-living-video',
    'furniture-minimal-banner',
    'furniture-spatial-video',
    'kitchen-culinary-banner',
    'kitchen-gourmet-video',
    'drinkware-ceramic-banner',
    'drinkware-thermal-video',
    'beauty-skincare-banner',
    'beauty-glow-video',
    'electronics-gadget-banner',
    'electronics-smart-video',
    'tools-precision-banner',
    'tools-workshop-video',
    'sports-trail-banner',
    'sports-kinetic-video',
    'pet-supplies-banner',
    'pet-wellness-video',
    'stationery-craft-banner',
    'stationery-studio-video',
    'poster-graphic-banner',
    'poster-gallery-video',
    'food-artisan-banner',
    'food-harvest-video',
    'single-device-showcase',
    'single-artisan-craft',
    'single-wellness-nordic',
  ]),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  copy: z.partialRecord(language, copy),
  duration: z.union([z.literal(8), z.literal(12)]),
  direction: text,
  script: text,
  scriptRevision: z.number().int().nonnegative(),
  scriptConfirmedRevision: z.number().int().nonnegative().optional(),
  scenes: z
    .array(
      z.object({
        id,
        description: text,
        imageAssetId: id.optional(),
        revision: z.number().int().nonnegative(),
      }),
    )
    .max(8),
  storyboardRevision: z.number().int().nonnegative(),
  storyboardConfirmedRevision: z.number().int().nonnegative().optional(),
  banners: z.array(z.object({
    id, targets: z.array((z.union([designPageSchema,z.string().startsWith('product:').min(9).max(210)]) as z.ZodType<BannerTarget>)).max(30),
    kind:z.enum(['images','video']),
    slides:z.array(z.object({
      assetId:id,alt:z.string().max(300),
      eyebrow:short.optional(),
      headline:short.optional(),
      subtitle:short.optional(),
      buttonText:short.optional(),
      buttonUrl:short.optional(),
      secondaryButtonText:short.optional(),
      secondaryButtonUrl:short.optional(),
    })).max(12),
    videoAssetId:id.optional(), posterAssetId:id.optional(), mode:z.enum(['background','image']),
    fit:z.enum(['cover','contain']), position:z.enum(['top','center','bottom']), contrast:z.enum(['light','dark','none']),
    height:z.enum(['auto','screen']), autoplay:z.boolean(), interval:z.number().int().min(3).max(30),
    eyebrow:short.optional(),
    headline:short.optional(),
    subtitle:text.optional(),
    primaryButtonText:short.optional(),
    primaryButtonUrl:short.optional(),
    secondaryButtonText:short.optional(),
    secondaryButtonUrl:short.optional(),
    tags:z.array(short).max(10).optional(),
    floatingPills:z.array(short).max(10).optional(),
  })).max(20).superRefine((banners,ctx)=>{
    const targets=new Set<string>(), ids=new Set<string>();
    for(const banner of banners) {
      if(ids.has(banner.id))ctx.addIssue({code:'custom',message:'Banner ID 重复'}); ids.add(banner.id);
      for(const target of banner.targets) { if(targets.has(target))ctx.addIssue({code:'custom',message:'同一页面不能重复指定 Banner'}); targets.add(target); }
    }
  }).optional(),
  banner: z.object({ contrast: z.enum(['light','dark','none']).optional(), assetId: id, alt: z.string().max(300), mode: z.enum(['background', 'image']), fit: z.enum(['cover', 'contain']), position: z.enum(['top', 'center', 'bottom']) }).optional(),
  heroAssetId: id.optional(),
  posterAssetId: id.optional(),
  heroAccepted: z.boolean(),
  consultation: consultationSchema.optional(),
  siteDesign: z
    .object({
      revision: z.number().int().nonnegative(),
      pageIds: z.array(designPageSchema).min(5).max(8).optional(),
      pages: z.record(
        designPageSchema,
        z.object({ imageAssetId: id.optional(), jobId: id.optional() }),
      ),
      homeConfirmedAssetId: id.optional(),
      confirmedKey: z.string().max(3000).optional(),
      build: z.object({ jobId: id, artifactKey: z.string().max(500).optional(), contacts:z.object({email:short,phone:short,whatsapp:short}).optional() }).optional(),
    })
    .optional(),
  cloneConfig: z
    .object({
      artifact: z.object({ key: z.string().max(500), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive().max(9 * 1024 * 1024), pageCount: z.number().int().nonnegative() }).optional(),
      referenceCapture: z.object({url:z.string().max(2000),contextKey:z.string().max(500),assets:z.array(z.object({assetId:id,url:z.string().max(3000),contentType:z.string().max(100)})).max(24),pageCount:z.number().int().max(5),screenshotCount:z.number().int().max(10),warnings:z.array(z.string().max(300)).max(20),capturedAt:z.string()}).optional(),
      taskId: z.string().optional(),
      enhancementMode: z.enum(['faithful', 'smart']).optional(),
      autoPublish: z.boolean().optional(),
      targetUrl: z.string().max(2000).optional(),
      scrapedData: z
        .object({
          title: z.string().max(500).optional(),
          description: z.string().max(2000).optional(),
          headings: z.array(z.string().max(200)).optional(),
          navLinks: z.array(z.object({ href: z.string(), text: z.string() })).optional(),
          sampleText: z.string().max(5000).optional(),
        })
        .optional(),
      uiImages: z
        .array(
          z.object({
            id: z.string(),
            assetId: id,
            name: z.string().max(200),
            role: z.enum(['home', 'catalog', 'detail', 'about', 'contact', 'asset']),
            roleSource: z.enum(['auto', 'manual']).optional(),
          }),
        )
        .optional(),
      instructions: z.string().max(5000).optional(),
      status: z.enum(['idle', 'scraping', 'generating', 'ready', 'error']).optional(),
      model: z.string().max(100).optional(),
      generatedHtml: z.string().optional(),
      generatedFiles: z.record(z.string(), z.string()).optional(),
      generation: z.object({
        contacts:z.object({email:short,phone:short,whatsapp:short}).optional(),
        mode: z.enum(['vision', 'reference-rebuild', 'fixture']),
        model: z.string().max(100).optional(),
        imageCount: z.number().int().nonnegative(),
        pageCount: z.number().int().nonnegative(),
        visuallyVerified: z.boolean(),
        quality: z.object({ status: z.enum(['passed','issues','unavailable']), message: z.string().max(500), reportKey: z.string().max(500).optional(), sampledPages: z.number().int().nonnegative().optional(), widths: z.array(z.number().int()).max(3).optional(), sparsePages: z.array(z.string().max(500)).max(10).optional(), issues: z.array(z.string().max(1000)).max(12).optional(), warnings: z.array(z.string().max(1000)).max(8).optional() }).optional(),
        improvements: z.array(z.string().max(300)).max(8).optional(),
      }).optional(),
      generatedAt: z.string().optional(),
      error: z.string().max(2000).optional(),
    })
    .optional(),
});
export function defaultDraft(): Draft {
  return {
    company: {
      name: '',
      email: '',
      contactName: '',
      type: 'trader',
      description: '',
      phone: '',
      whatsapp: '',
      address: '',
      slogan: '',
      establishedYear: '',
      certifications: '',
      capabilities: '',
      aboutHeadline: '',
      aboutStory: '',
      aboutHighlights: '',
      linkedin: '',
      facebook: '',
      instagram: '',
      x: '',
    },
    products: [],
    primaryProductId: '',
    category: 'general',
    country: '',
    languages: ['en'],
    template: 'natural',
    brandColor: '#416851',
    copy: {},
    duration: 8,
    direction: '',
    script: '',
    scriptRevision: 0,
    scenes: [],
    storyboardRevision: 0,
    heroAccepted: false,
  };
}
export function validateDraft(input: unknown): Draft {
  const result = draftSchema.safeParse(input);
  if (!result.success) {
    const labels: Record<string, string> = {
      name: '名称', email: '联系邮箱', contactName: '联系人', description: '介绍',
      instructions: '品牌定制与微调指令', targetUrl: '参考网址', factsOrigin: '产品来源类型',
      phone: '联系电话', whatsapp: 'WhatsApp', address: '地址', slogan: '品牌介绍',
      material: '材质', dimensions: '尺寸', title: '标题', alt: '图片说明',
      products: '产品列表', languages: '网站语言', banners: 'Banner 配置',
    };
    const details = result.error.issues.slice(0, 3).map(issue => {
      const field = labels[String(issue.path.at(-1))] || '资料字段';
      const prefix = issue.path[0] === 'products' && typeof issue.path[1] === 'number'
        ? `第 ${issue.path[1] + 1} 个产品的` : '';
      const reason = issue.code === 'too_big'
        ? `最多允许 ${issue.maximum} ${issue.origin === 'string' ? '个字符' : issue.origin === 'array' ? '项' : ''}`
        : '格式不正确或缺少必要信息';
      return `${prefix}${field}${reason}`;
    });
    throw new DomainError(400, 'invalid_draft', `无法保存：${details.join('；')}。`);
  }
  const d = result.data;
  requireCondition(validProductDisplayGroups(d.productDisplayGroups || [], d.products), 400, 'invalid_display_groups', '展示分组必须使用当前产品且不可重复或交叉。');
  if (d.banners !== undefined) d.banners = pageBanners(d);
  requireCondition(
    d.languages[0] === 'en' && new Set(d.languages).size === d.languages.length,
    400,
    'invalid_languages',
    '必须以英语为基础，最多选择一种第二语言。',
  );
  requireCondition(
    new Set(d.products.map((p) => p.id)).size === d.products.length,
    400,
    'duplicate_products',
    '产品不能重复。',
  );
  requireCondition(
    !d.primaryProductId || d.products.some((p) => p.id === d.primaryProductId),
    400,
    'invalid_primary',
    '主产品必须在当前产品列表中。',
  );
  requireCondition(
    new Set(d.scenes.map((s) => s.id)).size === d.scenes.length,
    400,
    'duplicate_scenes',
    '分镜标识不能重复。',
  );
  for (const link of [d.company.facebook, d.company.instagram, d.company.x])
    if (link) {
      try {
        requireCondition(
          new URL(link).protocol === 'https:',
          400,
          'invalid_social_url',
          '社交账号链接必须为 HTTPS 网址。',
        );
      } catch {
        throw new DomainError(400, 'invalid_social_url', '社交账号链接必须为 HTTPS 网址。');
      }
    }
  return d;
}
export function canManage(project: Project, principal: Principal): boolean {
  return (
    principal.systemRole === 'super_admin' ||
    (principal.workspaceId === project.workspaceId &&
      (project.ownerId === principal.userId || viewTeamData(principal)))
  );
}
export function videoInputKey(d: Draft): string {
  return JSON.stringify({
    products: d.products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      material: p.material,
      dimensions: p.dimensions,
      imageAssetId: p.imageAssetId,
      gallery: p.gallery, tagline: p.tagline, sellingPoints: p.sellingPoints, applications: p.applications,
    })),
    primaryProductId: d.primaryProductId,
    category: d.category,
    country: d.country,
    template: d.template,
    company: { name: d.company.name, type: d.company.type, description: d.company.description },
    duration: d.duration,
    direction: d.direction,
  });
}
export function editDraft(previous: Draft, input: unknown): Draft {
  const next = validateDraft(input);
  if (next.productDisplayGroups === undefined) next.productDisplayGroups = retainedProductDisplayGroups(previous, next.products);
  preserveMaterialsEdit(previous,next);
  // Provenance is written only through the authenticated source importer.
  next.products = next.products.map((p) => {
    const old = previous.products.find(product=>product.id === p.id);
    return {...p,source:old?.source,productIdentity:old?.productIdentity,identitySourceVersion:old?.identitySourceVersion,...(old?.source?.factsOrigin === 'product-set' ? {
      gallery:old.gallery,tagline:old.tagline,sellingPoints:old.sellingPoints,applications:old.applications,
    } : {})};
  });
  const scriptChanged =
    previous.script !== next.script || videoInputKey(previous) !== videoInputKey(next);
  next.scriptRevision = previous.scriptRevision + (scriptChanged ? 1 : 0);
  next.scriptConfirmedRevision = scriptChanged ? undefined : previous.scriptConfirmedRevision;
  const sceneChange =
    JSON.stringify(
      previous.scenes.map((s) => ({
        id: s.id,
        description: s.description,
        imageAssetId: s.imageAssetId,
      })),
    ) !==
    JSON.stringify(
      next.scenes.map((s) => ({
        id: s.id,
        description: s.description,
        imageAssetId: s.imageAssetId,
      })),
    );
  next.scenes = next.scenes.map((s) => {
    const before = previous.scenes.find((p) => p.id === s.id);
    return {
      ...s,
      revision: before
        ? before.revision +
          (scriptChanged ||
          before.description !== s.description ||
          before.imageAssetId !== s.imageAssetId
            ? 1
            : 0)
        : 1,
      imageAssetId: scriptChanged ? undefined : s.imageAssetId,
    };
  });
  next.storyboardRevision = previous.storyboardRevision + (scriptChanged || sceneChange ? 1 : 0);
  next.storyboardConfirmedRevision =
    scriptChanged || sceneChange ? undefined : previous.storyboardConfirmedRevision;
  next.heroAccepted =
    previous.heroAccepted &&
    next.heroAssetId === previous.heroAssetId &&
    !scriptChanged &&
    !sceneChange;
  resetConsultationForEdit(previous, next);
  resetDesignForEdit(previous, next);
  return next;
}
export function assertScriptConfirmed(d: Draft): void {
  requireCondition(
    d.script.trim() && d.scriptConfirmedRevision === d.scriptRevision,
    409,
    'script_unconfirmed',
    '请先确认当前版本的脚本。',
  );
}
export function assertReadyForVideo(d: Draft): void {
  assertScriptConfirmed(d);
  requireCondition(
    d.scenes.length >= (d.duration === 8 ? 3 : 4) &&
      d.scenes.every((s) => s.description.trim() && s.imageAssetId),
    409,
    'storyboard_incomplete',
    `${d.duration} 秒视频至少需要 ${d.duration === 8 ? 3 : 4} 张完整分镜图。`,
  );
  requireCondition(
    d.storyboardConfirmedRevision === d.storyboardRevision,
    409,
    'storyboard_unconfirmed',
    '请确认当前整组分镜后再生成视频。',
  );
}
export function assetReferences(d: Draft): string[] {
  return [
    ...new Set(
      [
        ...(d.cloneConfig?.referenceCapture?.assets.map(a=>a.assetId) ?? []),
        ...(d.materials?.imageBindings.flatMap(b=>[b.assetId,b.mobileAssetId])??[]),
        d.company.logoAssetId,
        d.company.faviconAssetId,
        d.company.aboutImageAssetId,
        d.company.aboutSecondaryImageAssetId,
        ...bannerAssets(d).images,
        ...bannerAssets(d).videos,
        d.heroAssetId,
        d.posterAssetId,
        ...d.products.flatMap((p) => [p.imageAssetId,...(p.gallery ?? []).map(image=>image.assetId)]),
        ...d.scenes.map((s) => s.imageAssetId),
        ...Object.values(d.siteDesign?.pages ?? {}).map((p) => p?.imageAssetId),
        ...(d.cloneConfig?.uiImages?.map((img) => img.assetId) ?? []),
      ].filter((v): v is string => Boolean(v)),
    ),
  ];
}
export function publicAssetReferences(d: Draft): string[] {
  const usesHero = !d.siteDesign || (d.buildBranch === 'template' && ['natural', 'technology', 'explorer', 'senseng-video'].includes(d.template));
  return [
    ...new Set(
      [
        ...(d.buildBranch === 'clone' ? d.cloneConfig?.referenceCapture?.assets.map(a=>a.assetId) ?? [] : []),
        ...(d.materials?.imageBindings.flatMap(b=>[b.assetId,b.mobileAssetId])??[]),
        d.company.logoAssetId,
        d.company.faviconAssetId,
        d.company.aboutImageAssetId,
        d.company.aboutSecondaryImageAssetId,
        ...bannerAssets(d,true).images,
        ...bannerAssets(d,true).videos,
        usesHero ? d.heroAssetId : undefined,
        usesHero ? d.posterAssetId : undefined,
        ...d.products.flatMap((p) => [p.imageAssetId,...(p.gallery ?? []).map(image=>image.assetId)]),
        ...(d.buildBranch === 'clone' ? normalizeCloneImages(d.cloneConfig?.uiImages).filter(img => img.role === 'asset').map(img => img.assetId) : []),
      ].filter((v): v is string => Boolean(v)),
    ),
  ];
}
export function assertSiteIntakeReady(d: Draft): void {
  requireCondition(
    d.company.name.trim() && validEmail(d.company.email),
    400,
    'company_incomplete',
    '请填写公司 / 品牌名称和有效联系邮箱。',
  );
  requireCondition(d.country.trim(), 400, 'market_incomplete', '请选择销售国家。');
  requireCondition(
    d.products.length > 0 &&
      d.products.some((p) => p.id === d.primaryProductId) &&
      d.products.every((p) => p.name.trim() && p.imageAssetId),
    400,
    'products_incomplete',
    '请提供产品名称、图片并选择主产品。',
  );
}
export function assertSiteContentReady(d: Draft): void {
  assertSiteIntakeReady(d);
  for (const lang of d.languages) {
    const c = d.copy[lang];
    requireCondition(
      c && c.headline.trim() && c.subtitle.trim() && c.cta.trim(),
      400,
      'copy_incomplete',
      `请补充 ${lang} 网站文案。`,
    );
    if (lang !== 'en')
      requireCondition(
        d.products.every(
          (p) =>
            p.translations?.[lang]?.name.trim() &&
            (!p.description.trim() || p.translations?.[lang]?.description.trim()),
        ),
        400,
        'translations_incomplete',
        `请补充 ${lang} 产品译文。`,
      );
  }
}
export function assertPublishable(d: Draft): void {
  if (d.buildBranch === 'clone') {
    requireCondition(d.company.name.trim() && validEmail(d.company.email),400,'company_incomplete','发布前请填写公司 / 品牌名称和有效联系邮箱。');
    requireCondition(
      Boolean(d.cloneConfig?.artifact || d.cloneConfig?.generatedHtml?.trim()),
      400,
      'clone_not_ready',
      '请先生成可用的页面代码后再发布。',
    );
    return;
  }
  if (d.buildBranch === 'template') {
    assertSiteIntakeReady(d);
    requireCondition(
      draftSchema.shape.template.options.includes(d.template),
      400,
      'template_unselected',
      '请先选择网站模版。',
    );
    return;
  }
  assertSiteContentReady(d);
  if (d.siteDesign)
    requireCondition(
      staticSiteReady(d),
      400,
      'site_unconfirmed',
      '请确认全部设计稿并生成当前版本的网站。',
    );
  else
    requireCondition(
      d.heroAssetId && d.heroAccepted,
      400,
      'hero_unconfirmed',
      '请上传或生成视频，预览后确认选用。',
    );
}
export function validEmail(value: string): boolean {
  return (
    value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && !/[\r\n]/.test(value)
  );
}
export function requestId(input: unknown): string {
  requireCondition(
    typeof input === 'string' && input.length >= 4 && input.length <= 120 && /^[\w-]+$/.test(input),
    400,
    'invalid_request_id',
    '缺少有效的重复请求标识。',
  );
  return input;
}
export function expectedVersion(project: Project, input: unknown): void {
  requireCondition(
    Number.isInteger(input) && input === project.version,
    409,
    'version_conflict',
    '草稿已被另一个入口或任务更新，请对比最新版本后重新保存。',
  );
}
export async function fingerprint(value: unknown): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value))),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
function canonical(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  return `{${Object.keys(v)
    .sort()
    .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}
