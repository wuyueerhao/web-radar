export interface Principal {
  userId: string;
  authSubject: string;
  email: string;
  displayName: string;
  systemRole: 'super_admin' | 'user';
  workspaceId: string;
  workspaceRole: 'admin' | 'member';
  workspaceName: string;
}
export const productFactsOrigins = ['generated-concept', 'product-set'] as const;
export type ProductSnapshot = import('zod').infer<typeof import('./product-snapshot').productSnapshotSchema>;
export interface ProductGalleryImage { assetId: string; sourceImageId: string; kind: import('zod').infer<typeof import('./product-snapshot').productImageKind>; caption: string }
export type Language = 'en' | 'de' | 'fr' | 'es' | 'pt' | 'it';
export type TemplateId =
  | 'senseng-clean'
  | 'senseng-video'
  | 'senseng-candy'
  | 'senseng-wonder'
  | 'senseng-arcade'
  | 'senseng-nature'
  | 'senseng-minimal'
  | 'universal-trade-banner'
  | 'universal-showcase-video'
  | 'toys-figure-banner'
  | 'toys-interactive-video'
  | 'plush-cushion-banner'
  | 'plush-living-video'
  | 'apparel-fabric-banner'
  | 'apparel-runway-video'
  | 'footwear-craft-banner'
  | 'footwear-kinetic-video'
  | 'luggage-leather-banner'
  | 'luggage-voyage-video'
  | 'jewelry-luxury-banner'
  | 'jewelry-timeless-video'
  | 'homedecor-aesthetic-banner'
  | 'homedecor-living-video'
  | 'furniture-minimal-banner'
  | 'furniture-spatial-video'
  | 'kitchen-culinary-banner'
  | 'kitchen-gourmet-video'
  | 'drinkware-ceramic-banner'
  | 'drinkware-thermal-video'
  | 'beauty-skincare-banner'
  | 'beauty-glow-video'
  | 'electronics-gadget-banner'
  | 'electronics-smart-video'
  | 'tools-precision-banner'
  | 'tools-workshop-video'
  | 'sports-trail-banner'
  | 'sports-kinetic-video'
  | 'pet-supplies-banner'
  | 'pet-wellness-video'
  | 'stationery-craft-banner'
  | 'stationery-studio-video'
  | 'poster-graphic-banner'
  | 'poster-gallery-video'
  | 'food-artisan-banner'
  | 'food-harvest-video'
  | 'juno-toys'
  | 'saas-automation'
  | 'fintech-platform'
  | 'digital-marketing'
  | 'porto-accounting'
  | 'crafto-corporate'
  | 'corpox-ai-agency'
  | 'corpox-consulting'
  | 'natural'
  | 'technology'
  | 'explorer';
export interface Product {
  productIdentity?: import("./product-identity").ProductIdentity;
  identitySourceVersion?: string;
  id: string;
  name: string;
  description: string;
  material: string;
  dimensions: string;
  imageAssetId?: string;
  gallery?: ProductGalleryImage[];
  tagline?: string;
  sellingPoints?: string[];
  applications?: string[];
  source?: ProductSnapshot;
  translations?: Partial<Record<Language, { name: string; description: string }>>;
}
export interface Company {
  name: string;
  email: string;
  contactName: string;
  type: 'trader' | 'factory';
  description: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  slogan?: string;
  establishedYear?: string;
  certifications?: string;
  capabilities?: string;
  targetMarkets?: string;
  customerTypes?: string;
  cooperationProcess?: string;
  aboutImageAssetId?: string;
  aboutSecondaryImageAssetId?: string;
  aboutHeadline?: string;
  aboutStory?: string;
  aboutHighlights?: string;
  linkedin?: string;
  facebook: string;
  instagram: string;
  x: string;
  logoAssetId?: string;
  faviconAssetId?: string;
}
export interface SiteCopy {
  headline: string;
  subtitle: string;
  about: string;
  cta: string;
  eyebrow?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  tags?: string[];
  floatingPills?: string[];
}
export interface Scene {
  id: string;
  description: string;
  imageAssetId?: string;
  revision: number;
}
export type BaseDesignPage = 'home' | 'catalog' | 'detail' | 'about' | 'contact';
export type DesignPage = BaseDesignPage | `extra-${string}`;
export interface PlannedPage {
  id: DesignPage;
  label: string;
  purpose: string;
  content: Partial<
    Record<Language, { title: string; sections: { heading: string; body: string }[] }>
  >;
}
export interface SiteBrief {
  summary: string;
  audience: string;
  goal: string;
  visualDirection: string;
  layout: string;
  brandColor: string;
  keep: string[];
  avoid: string[];
  pages: PlannedPage[];
  copy: Partial<Record<Language, SiteCopy>>;
  productTranslations: Record<
    string,
    Partial<Record<Language, { name: string; description: string }>>
  >;
}
export interface ConsultationQuestion {
  id: string;
  prompt: string;
  reason: string;
  options: string[];
}
export type ConsultationResult =
  { question: Omit<ConsultationQuestion, 'id'> } | { brief: SiteBrief };
export interface SiteConsultation {
  revision: number;
  answers: { questionId: string; question: string; answer: string }[];
  question?: ConsultationQuestion;
  brief?: SiteBrief;
  revisionContext?: { brief: SiteBrief; instructions: string };
  confirmed?: boolean;
  jobId?: string;
}
export interface SiteDesign {
  revision: number;
  pageIds?: DesignPage[];
  pages: Partial<Record<DesignPage, { imageAssetId?: string; jobId?: string }>>;
  homeConfirmedAssetId?: string;
  confirmedKey?: string;
  build?: { jobId: string; artifactKey?: string; contacts?: Pick<Company, 'email' | 'phone' | 'whatsapp'> };
}
export type CloneUiImageRole = 'home' | 'catalog' | 'detail' | 'about' | 'contact' | 'asset';
export interface CloneUiImage {
  id: string;
  assetId: string;
  name: string;
  role: CloneUiImageRole;
  roleSource?: 'auto' | 'manual';
}
export interface CloneScrapedData {
  title?: string;
  description?: string;
  headings?: string[];
  navLinks?: Array<{ href: string; text: string }>;
  sampleText?: string;
}
export interface CloneTaskProgress {
  autoPublish?: boolean;
  phase: 'queued' | 'capturing' | 'reading' | 'model' | 'validating' | 'publishing' | 'done';
  imagesRead: number;
  imageCount: number;
  outputCharacters: number;
  estimatedSeconds: number;
  elapsedMs: number;
  activeSince?: string;
  pauseRequested?: boolean;
  publishJobId?: string;
  url?: string;
}
export interface CloneConfig {
  referenceCapture?: {url:string;contextKey:string;assets:{assetId:string;url:string;contentType:string}[];pageCount:number;screenshotCount:number;warnings:string[];capturedAt:string};
  artifact?: { key: string; sha256: string; bytes: number; pageCount: number };
  enhancementMode?: 'faithful' | 'smart';
  autoPublish?: boolean;
  taskId?: string;
  targetUrl?: string;
  scrapedData?: CloneScrapedData;
  uiImages?: CloneUiImage[];
  instructions?: string;
  model?: string;
  status?: 'idle' | 'scraping' | 'generating' | 'ready' | 'error';
  generatedHtml?: string;
  generatedFiles?: Record<string, string>;
  generation?: {
    contacts?: Pick<Company, 'email' | 'phone' | 'whatsapp'>;
    mode: 'vision' | 'reference-rebuild' | 'fixture';
    model?: string;
    imageCount: number;
    pageCount: number;
    visuallyVerified: boolean;
    quality?: { status: 'passed' | 'issues' | 'unavailable'; message: string; reportKey?: string; sampledPages?: number; widths?: number[]; sparsePages?: string[]; issues?: string[]; warnings?: string[] };
    improvements?: string[];
  };
  generatedAt?: string;
  error?: string;
}

export type BannerTarget = DesignPage | `product:${string}`;
export interface BannerSlide {
  assetId: string;
  alt: string;
  eyebrow?: string;
  headline?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
}

export interface PageBanner {
  id: string;
  targets: BannerTarget[];
  kind: 'images' | 'video';
  slides: BannerSlide[];
  videoAssetId?: string;
  posterAssetId?: string;
  mode: 'background' | 'image';
  fit: 'cover' | 'contain';
  position: 'top' | 'center' | 'bottom';
  contrast: 'light' | 'dark' | 'none';
  height: 'auto' | 'screen';
  autoplay: boolean;
  interval: number;
  eyebrow?: string;
  headline?: string;
  subtitle?: string;
  primaryButtonText?: string;
  primaryButtonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  tags?: string[];
  floatingPills?: string[];
}
export interface Draft {
  materials?: import('./materials').AppliedMaterials;
  buildBranch?: 'template' | 'custom' | 'clone';
  templateConfirmed?: boolean;
  company: Company;
  products: Product[];
  /** Explicitly confirmed display equivalents; the first ID is canonical. Records stay intact. */
  productDisplayGroups?: string[][];
  primaryProductId: string;
  category: string;
  country: string;
  languages: Language[];
  template: TemplateId;
  brandColor: string;
  copy: Partial<Record<Language, SiteCopy>>;
  duration: 8 | 12;
  direction: string;
  script: string;
  scriptRevision: number;
  scriptConfirmedRevision?: number;
  scenes: Scene[];
  storyboardRevision: number;
  storyboardConfirmedRevision?: number;
  banners?: PageBanner[];
  banner?: { contrast?: 'light' | 'dark' | 'none'; assetId: string; alt: string; mode: 'background' | 'image'; fit: 'cover' | 'contain'; position: 'top' | 'center' | 'bottom' };
  heroAssetId?: string;
  posterAssetId?: string;
  heroAccepted: boolean;
  siteDesign?: SiteDesign;
  consultation?: SiteConsultation;
  cloneConfig?: CloneConfig;
}
export interface DeploymentSelection {
  provider: 'cloudflare' | 'server';
  credentialId?: string;
  accountId?: string;
}
export interface HostingTarget {
  provider?: 'cloudflare' | 'server';
  credentialId?: string;
  accountId: string;
  pagesProjectName: string;
}
export interface Project {
  materials?: import('./materials').MaterialsProvenance;
  id: string;
  ownerId: string;
  workspaceId: string;
  name: string;
  version: number;
  draft: Draft;
  createdAt: string;
  updatedAt: string;
  publishedReleaseId?: string;
  previousReleaseId?: string;
  offline: boolean;
  siteUrl?: string;
  hostingTarget?: HostingTarget;
  deployment?: DeploymentSelection;
}
export interface Asset {
  id: string;
  projectId: string;
  key: string;
  contentType: string;
  size: number;
  sha256?: string;
  filename: string;
  origin: 'upload' | 'import' | 'generated' | 'test';
  createdAt: string;
}
export type JobKind =
  'consultation' | 'script' | 'copy' | 'image' | 'video' | 'site-build' | 'publish' | 'email' | 'clone';
export type JobStatus = 'queued' | 'running' | 'unknown' | 'succeeded' | 'failed' | 'paused' | 'cancelled';
export interface Job {
  cloneProgress?: CloneTaskProgress;
  id: string;
  projectId: string;
  userId: string;
  kind: JobKind;
  status: JobStatus;
  requestId: string;
  input: Record<string, unknown>;
  inputVersion: number;
  createdAt: string;
  updatedAt: string;
  upstreamId?: string;
  resultAssetId?: string;
  error?: string;
  attempts: number;
  testMode: boolean;
}
export interface Quota {
  unlimited?: boolean;
  userId: string;
  imageLimit: number;
  videoLimit: number;
  imageUsed: number;
  videoUsed: number;
  imageReserved: number;
  videoReserved: number;
}
export interface PublicMediaVariant {
  requestedWidth: number;
  width: number;
  height: number;
  key: string;
  sha256: string;
  bytes: number;
}
export interface PublicMediaAsset {
  original?: { width: number; height: number };
  sourceKey: string;
  sourceIdentity: string;
  widths: number[];
  variants: PublicMediaVariant[];
}
export interface PublicMediaManifest {
  policy: string;
  ready: boolean;
  assets: Record<string, PublicMediaAsset>;
}
export interface Release {
  rendererVersion?: string;
  publicMedia?: PublicMediaManifest;
  seo?: { policyVersion: number; origin: string };
  hostingTarget?: HostingTarget;
  id: string;
  projectId: string;
  draftVersion: number;
  draft: Draft;
  createdAt: string;
  status: 'pending' | 'succeeded' | 'failed';
  deploymentId?: string;
  url?: string;
  error?: string;
  testMode: boolean;
}
export interface Inquiry {
  id: string;
  projectId: string;
  requestId: string;
  name: string;
  email: string;
  company: string;
  message: string;
  productId?: string;
  siteUrl: string;
  createdAt: string;
  emailStatus: 'queued' | 'sent' | 'failed' | 'unknown';
  emailAttempts: number;
  emailError?: string;
}
export interface ProjectDetail {
  project: Project;
  assets: Asset[];
  jobs: Job[];
  releases: (Omit<Release, 'draft'> & { draft?: Draft })[];
  quota: Quota;
  history?: { jobsTotal: number; releasesTotal: number; limit: number };
}
export interface ProjectSummary {
  id: string; name: string; companyName: string; productCount: number;
  template: TemplateId; coverAssetId?: string; updatedAt: string; createdAt: string;
  offline: boolean; publishedReleaseId?: string;
}
export interface ProjectList {
  projects: ProjectSummary[]; total: number; page: number; pageSize: number;
  counts: { all: number; draft: number; published: number; offline: number };
}
export interface ServiceStatus {
  name: string;
  configured: boolean;
  mode: 'live' | 'test' | 'unconfigured';
  detail: string;
}
