import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { DomainService } from '../src/worker/domain-service';
import { testBrief } from './fixtures/site-brief';
import { defaultDraft } from '../src/worker/domain';
import { getWorkflowSteps } from '../src/client/workflow';
import { fixtureProviders } from '../src/worker/providers/fixtures';
import {
  ProviderError,
  type ProviderSet,
  type SiteBuildInput,
} from '../src/worker/provider-contract';
import type { AppEnv } from '../src/worker/env';
import type { Asset, Principal, Job, Project } from '../src/shared/model';

const sourceState = vi.hoisted(() => ({ version: 'v1', revoked: false, failureStatus: 403, factsOrigin: 'product-set', gallery: false, failImage: '', materialsEmail:'other@example.com', imageRequests: [] as string[] }));
vi.mock('../src/worker/product-radar', () => ({
  prService: async (_e: unknown, p: Principal, path: string, body: { productIds?: string[] }) =>
    path === 'context'
      ? sourceState.revoked
        ? Promise.reject(
            Object.assign(new Error('Permission revoked'), { status: sourceState.failureStatus }),
          )
        : { principal: p.authSubject==='untrusted'?{...p,email:sourceState.materialsEmail,systemRole:p.userId==='platform'?'super_admin':'user',workspaceRole:p.userId==='admin'?'admin':'member'}:p }
      : {
          products: (body.productIds ?? []).map((id) => ({
            source: 'product-radar',
            id,
            sourceProjectId: sourceState.gallery ? null : 'source',
            workflow: sourceState.gallery ? 'upload' : 'build',
            version: sourceState.version,
            name: `Product ${id}`,
            description: 'Snapshot',
            material: 'Wood',
            dimensions: '',
            seriesName: '',
            designDirection: '',
            conditions: { keep: ['shape'] },
            image: { sourceProductId: id, contentType: 'image/png' },
            factsOrigin: sourceState.factsOrigin,
            websiteCopy: {name:`Product ${id}`,tagline:'A useful product',description:'Snapshot',sellingPoints:['One','Two','Three'],applications:['Daily use']},
            images:[{id:'original',kind:'original',caption:'Original',contentType:null},...(sourceState.gallery ? [{id:'detail',kind:'detail',caption:'Detail',contentType:null},{id:'scene',kind:'scene',caption:'Scene',contentType:null}]:[])],
          })),
          total: body.productIds?.length ?? 0,
        },
  prImage: async (_e:unknown,_p:Principal,_id:string,_version:string,imageId='original') => {
    sourceState.imageRequests.push(imageId);
    if (imageId === sourceState.failImage) throw Object.assign(new Error('Source image changed'),{status:409});
    return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]), {
      headers: { 'content-type': 'image/png' },
    });
  },
}));
const owner: Principal = {
  userId: 'owner',
  authSubject: 'owner',
  email: 'owner@example.com',
  displayName: 'Owner',
  systemRole: 'user',
  workspaceId: 'workspace',
  workspaceRole: 'member',
  workspaceName: 'Test',
};
const admin: Principal = { ...owner, userId: 'admin', workspaceRole: 'admin' };
const platform: Principal = { ...owner, userId: 'platform', systemRole: 'super_admin' };
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('migrations/0010_user_management.sql','utf8').split('INSERT OR IGNORE')[0]);
  db.exec(readFileSync('migrations/0002_business.sql', 'utf8'));
  db.exec(readFileSync('migrations/0003_source_reviews.sql', 'utf8'));
  db.exec(readFileSync('migrations/0004_unlimited_quota.sql', 'utf8'));
  db.exec(readFileSync('migrations/0005_project_summary_indexes.sql', 'utf8'));
  db.exec(readFileSync('migrations/0006_provider_accounts.sql', 'utf8'));
  class Statement {
    values: unknown[] = [];
    constructor(readonly sql: string) {}
    bind(...values: unknown[]) {
      this.values = values;
      return this;
    }
    async first(column?: string) {
      const row = db.prepare(this.sql).get(...(this.values as never[])) ?? null;
      return column && row ? row[column] : row;
    }
    async all() {
      return {
        success: true,
        results: db.prepare(this.sql).all(...(this.values as never[])),
        meta: {},
      };
    }
    async run() {
      const result = db.prepare(this.sql).run(...(this.values as never[]));
      return {
        success: true,
        results: [],
        meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
      };
    }
    async raw() {
      return db
        .prepare(this.sql)
        .all(...(this.values as never[]))
        .map(Object.values);
    }
  }
  return {
    prepare: (sql: string) => new Statement(sql),
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    batch: async (statements: Statement[]) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        db.exec('COMMIT');
        return results;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
function mediaBucket() {
  type Options = {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  };
  const objects = new Map<
    string,
    { bytes: Uint8Array; contentType: string; customMetadata?: Record<string, string> }
  >();
  const store = (key: string, bytes: Uint8Array, options?: Options) => {
    objects.set(key, {
      bytes,
      contentType: options?.httpMetadata?.contentType ?? '',
      customMetadata: options?.customMetadata,
    });
    return { key, size: bytes.length };
  };
  return {
    objects,
    async put(key: string, body: BodyInit, options?: Options) {
      return store(key, new Uint8Array(await new Response(body).arrayBuffer()), options);
    },
    async createMultipartUpload(key: string, options?: Options) {
      const parts = new Map<number, Uint8Array>();
      return {
        async uploadPart(number: number, body: BodyInit) {
          parts.set(number, new Uint8Array(await new Response(body).arrayBuffer()));
          return { partNumber: number, etag: String(number) };
        },
        async complete() {
          const bytes = new Uint8Array([...parts.values()].reduce((n, p) => n + p.length, 0));
          let offset = 0;
          for (const p of parts.values()) {
            bytes.set(p, offset);
            offset += p.length;
          }
          return store(key, bytes, options);
        },
        async abort() {
          parts.clear();
        },
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
    async head(key: string) {
      const o = objects.get(key);
      return o
        ? {
            size: o.bytes.length,
            httpMetadata: { contentType: o.contentType },
            customMetadata: o.customMetadata,
          }
        : null;
    },
    async get(
      key: string,
      options?: { range?: { offset?: number; length?: number; suffix?: number } },
    ) {
      const o = objects.get(key);
      if (!o) return null;
      const r = options?.range;
      const offset = r?.suffix ? Math.max(0, o.bytes.length - r.suffix) : (r?.offset ?? 0);
      const bytes = o.bytes.slice(offset, r?.length ? offset + r.length : undefined);
      return {
        body: new Response(bytes).body,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        size: o.bytes.length,
        httpMetadata: { contentType: o.contentType },
        range: r ? { offset, length: bytes.length } : undefined,
        writeHttpMetadata(h: Headers) {
          h.set('content-type', o.contentType);
        },
      };
    },
  };
}
function providerSet(): ProviderSet {
  return {
    status: () => [],
    consult: async (draft) =>
      draft.consultation?.answers.length
        ? { brief: testBrief(draft) }
        : {
            question: {
              prompt: '主要面向哪类客户？',
              reason: '决定页面的重点',
              options: ['进口商', '批发商', '零售商', '消费者'],
            },
          },
    resolveHostingTarget: async (id, current) =>
      current ?? { accountId: 'LOCAL_TEST', pagesProjectName: `wr-${id}` },
    script: async () => ({
      script: 'Real direction based on inputs',
      scenes: [1, 2, 3].map((i) => ({ id: `s${i}`, description: `Scene ${i}`, revision: 1 })),
    }),
    copy: async () => ({
      en: { headline: 'Headline', subtitle: 'Subtitle', about: 'About', cta: 'Contact' },
    }),
    image: async () => ({
      body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      contentType: 'image/png',
      filename: 'scene.png',
      testMode: true,
    }),
    designImage: async () => ({
      body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      contentType: 'image/png',
      filename: 'page.png',
      testMode: true,
    }),
    siteBuild: async () => ({ state: 'pending' }),
    submitVideo: async () => ({ videoId: 'upstream' }),
    pollVideo: async () => ({
      state: 'succeeded',
      media: {
        body: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]),
        contentType: 'video/mp4',
        filename: 'hero.mp4',
        testMode: true,
      },
    }),
    publish: async (id, releaseId) => ({
      deploymentId: releaseId,
      url: `https://${id}.pages.dev`,
      testMode: true,
    }),
    email: async () => ({ id: 'mail', testMode: true }),
  };
}
let service: DomainService,
  providers: ProviderSet,
  env: AppEnv,
  bucket: ReturnType<typeof mediaBucket>;
async function request(path: string, body?: unknown, principal = owner, method?: string) {
  const r = await service.fetch(
    new Request(`http://localhost${path}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', 'X-WR-Principal': JSON.stringify(principal) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: r.status, data: (await r.json()) as Record<string, any> };
}
async function create(name = 'Site') {
  return (await request('/api/projects', { name, requestId: crypto.randomUUID() })).data
    .project as Project;
}
async function brandedClone() {
 const p=await create();p.draft.company.name='Preview Brand';p.draft.company.email='sales@example.com';
 return (await request(`/api/projects/${p.id}`, {expectedVersion:p.version,draft:p.draft},owner,'PUT')).data.project as Project;
}
async function quota(who = owner, images = 5, videos = 5) {
  return request(
    `/api/admin/quotas/${who.userId}`,
    { imageLimit: images, videoLimit: videos },
    platform,
    'PUT',
  );
}
async function get(p: Project) {
  return (await request(`/api/projects/${p.id}`)).data;
}

describe('project creation workflow', () => {
  it('shows receipt-backed projects to ordinary owners while preserving project scope and revoked access',async()=>{
    const p=await create('Confirmed materials');p.materials={submissionId:crypto.randomUUID(),source:{materialsId:'source',revision:1},contentSha256:'a'.repeat(64),snapshotKey:'confirmed.json',acceptedAt:new Date().toISOString()};
    await env.DB.prepare('UPDATE projects SET data=? WHERE id=?').bind(JSON.stringify(p),p.id).run();
    for(const principal of [owner,admin,platform])expect((await request(`/api/projects/${p.id}`,undefined,principal)).status).toBe(200);
    const list=await request('/api/projects');expect(list.data.projects.map((project:Project)=>project.id)).toContain(p.id);
    for(const principal of [{...owner,userId:'another-member'},{...admin,userId:'outside-admin',workspaceId:'other-workspace'}]){
      expect((await request('/api/projects',undefined,principal)).data.projects).toHaveLength(0);
      for(const suffix of ['', '/preview'])expect((await request(`/api/projects/${p.id}${suffix}`,undefined,principal)).status).toBe(404);
    }
    sourceState.revoked=true;
    for(const principal of [owner,admin,platform]){
      expect((await request(`/api/projects/${p.id}`,undefined,principal)).status).toBe(403);
      expect((await request(`/api/projects/${p.id}/preview`,{draft:p.draft},principal)).status).toBe(403);
      expect((await request(`/api/projects/${p.id}`,{draft:p.draft,expectedVersion:p.version},principal,'PUT')).status).toBe(403);
    }
    sourceState.revoked=false;
    const ordinary=await create('Standalone');expect((await request(`/api/projects/${ordinary.id}`)).status).toBe(200);
  });
  it.each([
    ['template', ['basics', 'template', 'publish']],
    ['custom', ['basics', 'consultation', 'brief', 'design', 'publish']],
    ['clone', ['basics', 'clone-generate', 'publish']],
  ] as const)('persists the selected %s workflow after reopening', async (buildBranch, steps) => {
    const result = await request('/api/projects', {
      name: 'Selected workflow', requestId: crypto.randomUUID(), buildBranch,
    });
    expect(result.status).toBe(200);
    const { project } = await get(result.data.project);
    expect(project.draft.buildBranch).toBe(buildBranch);
    expect(getWorkflowSteps(project.draft).map(([id]) => id)).toEqual(steps);
  });

  it('opens Product Radar handoffs in the three-step template workflow', async () => {
    sourceState.gallery = true;
    const sourceProject = await create();
    const imported = await request(`/api/projects/${sourceProject.id}/import`, {
      expectedVersion: sourceProject.version, productIds: ['source-1'],
    });
    const products = imported.data.project.draft.products.map((product: { source: unknown }) => product.source);
    const body = { requestId: crypto.randomUUID(), products };
    const result = await request('/internal/handoff-project', body);
    expect(result.status).toBe(200);
    const { project } = await get(result.data.project);
    expect(project.draft.buildBranch).toBe('template');
    expect(getWorkflowSteps(project.draft).map(([id]) => id)).toEqual([
      'basics', 'template', 'publish',
    ]);
    expect(project.draft.products).toHaveLength(1);
    expect(project.draft.products[0].source).toEqual(products[0]);
    expect(project.draft.products[0].gallery).toHaveLength(3);
    expect((await request('/internal/handoff-project', body)).data.project.id).toBe(project.id);
  });

  it('uses the current template default for new projects without an explicit mode', async () => {
    const { project } = await get(await create());
    expect(getWorkflowSteps(project.draft).map(([id]) => id)).toEqual([
      'basics', 'template', 'publish',
    ]);
  });
});
async function scriptReady() {
  let p = await create();
  p.draft.products = [
    { id: 'p1', name: 'Toy', description: 'Toy', material: 'Wood', dimensions: '' },
  ];
  p.draft.primaryProductId = 'p1';
  p = (
    await request(
      `/api/projects/${p.id}`,
      { expectedVersion: p.version, draft: p.draft },
      owner,
      'PUT',
    )
  ).data.project;
  await request(`/api/projects/${p.id}/jobs`, {
    expectedVersion: p.version,
    requestId: crypto.randomUUID(),
    kind: 'script',
  });
  await service.tick();
  p = (await get(p)).project;
  p = (await request(`/api/projects/${p.id}/confirm-script`, { expectedVersion: p.version })).data
    .project;
  return p;
}
async function videoReady() {
  let p = await scriptReady();
  await quota();
  await request(`/api/projects/${p.id}/jobs`, {
    expectedVersion: p.version,
    requestId: crypto.randomUUID(),
    kind: 'image',
  });
  for (let i = 0; i < 3; i++) await service.tick();
  p = (await get(p)).project;
  p = (await request(`/api/projects/${p.id}/confirm-storyboard`, { expectedVersion: p.version }))
    .data.project;
  return p;
}

beforeEach(() => {
  sourceState.version = 'v1';
  sourceState.factsOrigin = 'product-set';
  sourceState.revoked = false;
  sourceState.materialsEmail='other@example.com';
  sourceState.failureStatus = 403;
  sourceState.gallery = false;
  sourceState.failImage = '';
  sourceState.imageRequests = [];
  bucket = mediaBucket();
  env = {
    DB: database(),
    MEDIA: bucket,
    ENVIRONMENT: 'test',
    TEST_PROVIDERS: 'true',
    CLONE_TEST_FIXTURE: 'true',
    APP_ORIGIN: 'http://localhost',
  } as unknown as AppEnv;
  providers = providerSet();
  service = new DomainService(env, { schedule: async () => {} }, providers);
});

describe('durable domain commands', () => {
  async function designReady(guided = true, productIds = ['one']) {
    let p = await create();
    p = (
      await request(`/api/projects/${p.id}/import`, {
        expectedVersion: p.version,
        productIds,
      })
    ).data.project;
    p.draft.company = {
      ...p.draft.company,
      name: 'Studio',
      email: 'contact@example.com',
      contactName: 'Amy',
    };
    p.draft.country = 'US';
    p.draft.copy.en = {
      headline: 'Objects',
      subtitle: 'Made for everyday',
      about: 'Our studio',
      cta: 'Contact',
    };
    p = (
      await request(
        `/api/projects/${p.id}`,
        { expectedVersion: p.version, draft: p.draft },
        owner,
        'PUT',
      )
    ).data.project;
    await quota(owner, 10, 0);
    if (guided) {
      await consultJob(p);
      await service.tick();
      p = (await get(p)).project;
      await consultJob(p, { questionId: p.draft.consultation!.question!.id, answer: '进口商' });
      await service.tick();
      p = (await get(p)).project;
      const confirmed = await request(`/api/projects/${p.id}/confirm-brief`, {
        expectedVersion: p.version,
      });
      expect(confirmed.status).toBe(200);
      p = confirmed.data.project;
    }
    return p;
  }
  async function consultJob(p: Project, fields: Record<string, unknown> = {}) {
    return request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: crypto.randomUUID(),
      kind: 'consultation',
      ...fields,
    });
  }
  it('collects one question with actual image references and confirms a server-owned brief', async () => {
    let p = await designReady(false);
    expect((await designJob(p, 'home')).data.code).toBe('brief_unconfirmed');
    const original = providers.consult;
    const seen: string[][] = [];
    providers.consult = async (draft, refs, instructions) => {
      seen.push(refs);
      return original(draft, refs, instructions);
    };
    const first = await consultJob(p, { requestId: 'consult-first' });
    expect(first.status).toBe(200);
    const again = await consultJob(p, { requestId: 'consult-first' });
    expect(again.data.job.id).toBe(first.data.job.id);
    p = (await get(p)).project;
    expect((await consultJob(p)).data.code).toBe('consultation_in_progress');
    await service.tick();
    p = (await get(p)).project;
    expect(seen[0]).toHaveLength(1);
    expect(seen[0][0]).toMatch(/assets|reference|data:image/);
    expect(p.draft.consultation?.question?.options).toHaveLength(4);
    expect((await consultJob(p, { questionId: 'wrong', answer: '进口商' })).data.code).toBe(
      'question_changed',
    );
    await consultJob(p, { questionId: p.draft.consultation!.question!.id, answer: '进口商' });
    await service.tick();
    p = (await get(p)).project;
    expect(p.draft.consultation?.answers[0].answer).toBe('进口商');
    expect(p.draft.consultation?.brief?.pages).toHaveLength(5);
    expect(p.draft.consultation?.confirmed).not.toBe(true);
    expect((await designJob(p, 'home')).data.code).toBe('brief_unconfirmed');
    p = (await request(`/api/projects/${p.id}/confirm-brief`, { expectedVersion: p.version })).data
      .project;
    expect(p.draft.consultation?.confirmed).toBe(true);
    expect(p.draft.copy.en?.headline).toBe('Objects');
    expect((await designJob(p, 'home')).status).toBe(200);
  });
  it('does not attach a late consultation result after intake edits', async () => {
    let p = await designReady(false);
    let release: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    providers.consult = async (draft) => {
      started!();
      await wait;
      return { brief: testBrief(draft) };
    };
    await consultJob(p);
    const tick = service.tick();
    await entered;
    p = (await get(p)).project;
    p.draft.company.name = 'Changed company';
    const saved = await request(
      `/api/projects/${p.id}`,
      { expectedVersion: p.version, draft: p.draft },
      owner,
      'PUT',
    );
    expect(saved.status).toBe(200);
    release!();
    await tick;
    expect((await get(p)).project.draft.consultation).toBeUndefined();
  });
  it('invalidates approval and designs when a confirmed proposal is revised', async () => {
    let p = await designReady();
    await designJob(p, 'home');
    await service.tick();
    p = (await get(p)).project;
    expect(p.draft.siteDesign?.pages.home?.imageAssetId).toBeTruthy();
    expect((await consultJob(p, { instructions: '增加批发说明页' })).status).toBe(200);
    p = (await get(p)).project;
    expect(p.draft.consultation?.confirmed).not.toBe(true);
    expect(p.draft.siteDesign?.pages.home).toBeUndefined();
  });
  async function designJob(p: Project, pageId: string) {
    return request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: crypto.randomUUID(),
      kind: 'image',
      pageId,
    });
  }
  it('rejects oversized visible design copy before reserving quota or replacing an existing design', async () => {
    let p = await designReady();
    await designJob(p, 'home');
    await service.tick();
    p = (await get(p)).project;
    p.draft.consultation!.brief!.pages[0].content.en!.sections = Array.from({ length: 8 }, () => ({
      heading: 'Approved heading',
      body: 'Full approved text. '.repeat(200),
    }));
    await service.store.update('projects', p).run();
    const before = await get(p),
      quota = await service.store.quota(owner.userId);
    const call = vi.fn(providers.designImage);
    providers.designImage = call;
    const result = await designJob(p, 'home');
    expect(result.status).toBe(400);
    expect(result.data.code).toBe('image_design_copy_too_long');
    expect((await get(p)).project).toEqual(before.project);
    expect((await get(p)).jobs).toEqual(before.jobs);
    expect(await service.store.quota(owner.userId)).toEqual(quota);
    expect(call).not.toHaveBeenCalled();
  });
  it('retains a proposed brief and revision request across a follow-up question', async () => {
    let p = await designReady();
    const oldBrief = p.draft.consultation!.brief!;
    providers.consult = async () => ({
      question: {
        prompt: '蓝色深浅？',
        reason: '确定颜色',
        options: ['浅蓝', '中蓝', '深蓝', '蓝灰'],
      },
    });
    await consultJob(p, { instructions: '保留当前页面，改成蓝色' });
    await service.tick();
    p = (await get(p)).project;
    expect(p.draft.consultation?.brief).toBeUndefined();
    expect(p.draft.consultation?.revisionContext?.brief).toEqual(oldBrief);
    expect(
      (await request(`/api/projects/${p.id}/confirm-brief`, { expectedVersion: p.version })).data
        .code,
    ).toBe('brief_incomplete');
    providers.consult = async (draft) => {
      expect(draft.consultation?.revisionContext?.instructions).toBe('保留当前页面，改成蓝色');
      expect(draft.consultation?.revisionContext?.brief).toEqual(oldBrief);
      return { brief: { ...oldBrief, brandColor: '#2244aa' } };
    };
    await consultJob(p, { questionId: p.draft.consultation!.question!.id, answer: '深蓝' });
    await service.tick();
    p = (await get(p)).project;
    expect(p.draft.consultation?.brief?.brandColor).toBe('#2244aa');
    expect(p.draft.consultation?.revisionContext).toBeUndefined();
  });
  it('requires and builds every approved extra page, including its private preview route', async () => {
    let p = await designReady(false);
    providers.consult = async (draft) => ({ brief: testBrief(draft, true) });
    await consultJob(p);
    await service.tick();
    p = (await get(p)).project;
    p = (await request(`/api/projects/${p.id}/confirm-brief`, { expectedVersion: p.version })).data
      .project;
    expect((await designJob(p, 'extra-unapproved')).data.code).toBe('invalid_design_page');
    await designJob(p, 'home');
    await service.tick();
    p = (await get(p)).project;
    p = (
      await request(`/api/projects/${p.id}/confirm-design`, {
        expectedVersion: p.version,
        target: 'home',
      })
    ).data.project;
    const rest = await designJob(p, 'remaining');
    expect(rest.data.jobs).toHaveLength(5);
    for (let i = 0; i < 4; i++) await service.tick();
    p = (await get(p)).project;
    expect(
      (
        await request(`/api/projects/${p.id}/confirm-design`, {
          expectedVersion: p.version,
          target: 'all',
        })
      ).data.code,
    ).toBe('designs_incomplete');
    await service.tick();
    p = (await get(p)).project;
    p = (
      await request(`/api/projects/${p.id}/confirm-design`, {
        expectedVersion: p.version,
        target: 'all',
      })
    ).data.project;
    const fixture = fixtureProviders(env);
    providers.siteBuild = async (id, input) => {
      expect(Object.keys(input!.designImages)).toHaveLength(6);
      return fixture.siteBuild(id, input);
    };
    expect(
      (
        await request(`/api/projects/${p.id}/jobs`, {
          expectedVersion: p.version,
          requestId: 'extra-build',
          kind: 'site-build',
        })
      ).status,
    ).toBe(200);
    await service.tick();
    p = (await get(p)).project;
    const preview = await request(`/api/projects/${p.id}/preview?lang=en&page=extra-wholesale`);
    expect(preview.status).toBe(200);
    expect(preview.data.html).toContain('/en/extra-wholesale/');
    expect(
      (await request(`/api/projects/${p.id}/preview?lang=en&page=extra-unapproved`)).status,
    ).toBe(400);
  });
  it('rejects invalid option counts and can retry the same consultation without duplicate answers', async () => {
    let p = await designReady(false);
    providers.consult = async () => ({
      question: { prompt: '问题', reason: '原因', options: ['A', 'B', 'C'] },
    });
    const first = await consultJob(p);
    await service.tick();
    let detail = await get(p);
    expect(detail.jobs[0].status).toBe('failed');
    expect(detail.project.draft.consultation.question).toBeUndefined();
    providers.consult = providerSet().consult;
    expect(
      (await request(`/api/projects/${p.id}/jobs/${first.data.job.id}/retry`, {})).status,
    ).toBe(200);
    await service.tick();
    detail = await get(p);
    expect(detail.project.draft.consultation.question.options).toHaveLength(4);
    expect(detail.project.draft.consultation.answers).toHaveLength(0);
  });
  it('cancels queued consultation on edited facts before any provider call', async () => {
    let p = await designReady(false);
    const call = vi.fn(providers.consult);
    providers.consult = call;
    const first = await consultJob(p);
    p = (await get(p)).project;
    p.draft.country = 'Germany';
    await request(
      `/api/projects/${p.id}`,
      { expectedVersion: p.version, draft: p.draft },
      owner,
      'PUT',
    );
    await service.tick();
    expect(call).not.toHaveBeenCalled();
    expect(
      (await request(`/api/projects/${p.id}/jobs/${first.data.job.id}/retry`, {})).data.code,
    ).toBe('stale_consultation_job');
  });
  it('generates homepage first, confirms five designs, and builds without video quota', async () => {
    let p = await designReady(true, ['one', 'two']);
    expect((await designJob(p, 'remaining')).data.code).toBe('home_unconfirmed');
    const home = await designJob(p, 'home');
    expect(home.status).toBe(200);
    await service.tick();
    p = (await get(p)).project;
    expect(p.draft.siteDesign?.pages.home?.imageAssetId).toBeTruthy();
    expect(
      (
        await request(`/api/projects/${p.id}/confirm-design`, {
          expectedVersion: p.version,
          target: 'all',
        })
      ).data.code,
    ).toBe('designs_incomplete');
    p = (
      await request(`/api/projects/${p.id}/confirm-design`, {
        expectedVersion: p.version,
        target: 'home',
      })
    ).data.project;
    const rest = await designJob(p, 'remaining');
    expect(rest.data.jobs).toHaveLength(4);
    for (let i = 0; i < 4; i++) await service.tick();
    p = (await get(p)).project;
    p = (
      await request(`/api/projects/${p.id}/confirm-design`, {
        expectedVersion: p.version,
        target: 'all',
      })
    ).data.project;
    const build = await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'static-build-1',
      kind: 'site-build',
    });
    expect(build.status).toBe(200);
    let submittedBuild: SiteBuildInput | undefined;
    providers.siteBuild = async (id, submitted) => {
      expect(id).toBe(build.data.job.id);
      submittedBuild = submitted;
      return { state: 'pending' };
    };
    await service.tick();
    expect(Object.keys(submittedBuild?.referenceAssets ?? {})).toEqual(
      p.draft.products.map((product) => product.imageAssetId),
    );
    expect(submittedBuild?.referenceAssets?.[p.draft.products[0].imageAssetId!]).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(Object.keys(submittedBuild!.designImages)).toHaveLength(5);
    const detail = await get(p);
    expect(detail.quota.imageUsed).toBe(5);
    expect(detail.quota.videoUsed).toBe(0);
    expect(detail.jobs.find((j: Job) => j.kind === 'site-build').status).toBe('queued');
    expect(detail.project.draft.siteDesign.build.jobId).toBe(build.data.job.id);
    const input = (await service.store.one<Job>('jobs', build.data.job.id))!.input;
    providers.siteBuild = async () =>
      fixtureProviders(env).siteBuild(build.data.job.id, {
        draft: input.draft as Project['draft'],
        designImages: {} as never,
      });
    await service.tick();
    p = (await get(p)).project;
    expect(p.draft.siteDesign?.build?.artifactKey).toBeTruthy();
    const preview = await request(`/api/projects/${p.id}/preview?lang=en&page=catalog`);
    expect(preview.status).toBe(200);
    expect(preview.data.html).toContain(`/api/projects/${p.id}/assets/`);
    expect(preview.data.html).not.toContain('__WR_ASSET_');
    providers.publish = async (_id, releaseId, files) => {
      expect(Object.keys(files).every((path) => path.endsWith('.html'))).toBe(true);
      expect(files['en/products/index.html']).toContain(
        `${env.APP_ORIGIN}/public/sites/${p.id}/assets/`,
      );
      expect(files['en/products/index.html']).not.toContain('/api/projects/');
      expect(Object.values(files).join('')).not.toContain('page.png');
      return { deploymentId: releaseId, url: `https://${p.id}.pages.dev`, testMode: true };
    };
    expect(
      (
        await request(`/api/projects/${p.id}/publish`, {
          expectedVersion: p.version,
          requestId: 'static-publish-1',
        })
      ).status,
    ).toBe(200);
    await service.tick();
    p = (await get(p)).project;
    expect(p.publishedReleaseId).toBeTruthy();
    p.draft.company.name = 'Changed draft';
    p = (
      await request(
        `/api/projects/${p.id}`,
        { expectedVersion: p.version, draft: p.draft },
        owner,
        'PUT',
      )
    ).data.project;
    expect((await request(`/api/projects/${p.id}/preview`)).data.code).toBe('site_not_built');
    const publicResponse = await service.fetch(
      new Request(`http://localhost/public/sites/${p.id}/en/products/`),
    );
    expect(publicResponse.status).toBe(200);
    const publicHtml = await publicResponse.text();
    expect(publicHtml).toContain('Studio');
    expect(publicHtml).not.toContain('Changed draft');
    expect(publicHtml).toContain(`/public/sites/${p.id}/en/products/`);
  });
  it('does not attach a late design after product facts change and settles its quota once', async () => {
    let p = await designReady();
    await designJob(p, 'home');
    let finish!: (value: Awaited<ReturnType<ProviderSet['designImage']>>) => void;
    providers.designImage = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const ticking = service.tick();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    p = (await get(p)).project;
    p.draft.products[0].name = 'Updated';
    expect(
      (
        await request(
          `/api/projects/${p.id}`,
          { expectedVersion: p.version, draft: p.draft },
          owner,
          'PUT',
        )
      ).status,
    ).toBe(200);
    finish(await providerSet().designImage(p.draft, 'home', '', []));
    await ticking;
    const detail = await get(p);
    expect(detail.project.draft.siteDesign.pages.home).toBeUndefined();
    expect(detail.quota.imageUsed).toBe(1);
    expect(detail.quota.imageReserved).toBe(0);
  });
  it('passes all eight private product images directly to the design provider in reference order', async () => {
    const p = await designReady(
      true,
      Array.from({ length: 8 }, (_, i) => `product-${i}`),
    );
    const generate = vi.fn(providerSet().designImage);
    providers.designImage = generate;
    await designJob(p, 'home');
    await service.tick();
    expect(generate).toHaveBeenCalledOnce();
    const references = generate.mock.calls[0][3];
    expect(references).toHaveLength(8);
    for (let i = 0; i < references.length; i++) {
      expect(references[i]).toBeInstanceOf(Blob);
      const reference = references[i] as Blob;
      const asset = await service.store.one<Asset>('assets', p.draft.products[i].imageAssetId!);
      expect(reference.type).toBe('image/png');
      expect(new Uint8Array(await reference.arrayBuffer())).toEqual(
        bucket.objects.get(asset!.key)!.bytes,
      );
    }
    expect((await get(p)).jobs.find((j: Job) => j.input.pageId === 'home').status).toBe(
      'succeeded',
    );
  });
  it('cancels obsolete queued designs before spending provider quota', async () => {
    let p = await designReady();
    await designJob(p, 'home');
    p = (await get(p)).project;
    p.draft.company.description = 'New company facts';
    await request(
      `/api/projects/${p.id}`,
      { expectedVersion: p.version, draft: p.draft },
      owner,
      'PUT',
    );
    const generate = vi.fn(providerSet().designImage);
    providers.designImage = generate;
    await service.tick();
    expect(generate).not.toHaveBeenCalled();
    const detail = await get(p);
    expect(detail.quota.imageUsed).toBe(0);
    expect(detail.quota.imageReserved).toBe(0);
    expect(detail.jobs.find((job: Job) => job.input.pageId === 'home').status).toBe('failed');
  });
  it('idempotently creates same project and rejects changed payload', async () => {
    const body = { name: 'Site', requestId: 'request-create-1' };
    const a = await request('/api/projects', body),
      b = await request('/api/projects', body);
    expect(a.status).toBe(200);
    expect(b.data.project.id).toBe(a.data.project.id);
    expect((await request('/api/projects', { ...body, name: 'Other' })).status).toBe(409);
  });
  it('allows current admin but prevents member and cross-workspace asset reads', async () => {
    const p = await create();
    expect(
      (await request(`/api/projects/${p.id}`, undefined, { ...owner, userId: 'member' })).status,
    ).toBe(404);
    expect((await request(`/api/projects/${p.id}`, undefined, admin)).status).toBe(200);
    expect(
      (await request(`/api/projects/${p.id}`, undefined, { ...admin, workspaceId: 'elsewhere' }))
        .status,
    ).toBe(404);
  });
  it('caches private preview derivatives without changing originals, jobs or project permissions', async () => {
    const p = await create();
    const uploaded = await uploadAsset(p);
    const asset = (await service.store.one<Asset>('assets', uploaded.id))!;
    const original = bucket.objects.get(asset.key)!.bytes.slice();
    env.SITE_BUILDER_URL = 'http://localhost:7002';
    env.SITE_BUILDER_KEY = 'internal-test-key';
    const webp = new TextEncoder().encode('RIFF0000WEBPpreview');
    const fetcher = vi.fn(async () => new Response(webp, { headers: { 'Content-Type': 'image/webp' } }));
    vi.stubGlobal('fetch', fetcher);
    const path = `/api/projects/${p.id}/assets/${asset.id}?variant=preview`;
    const read = (principal = owner, method = 'GET') => service.fetch(new Request(`http://localhost${path}`, { method, headers: { 'X-WR-Principal': JSON.stringify(principal) } }));
    try {
      const first = await read();
      expect(first.status).toBe(200);
      expect(first.headers.get('cache-control')).toBe('no-store');
      expect(new Uint8Array(await first.arrayBuffer())).toEqual(webp);
      expect((await read()).status).toBe(200);
      expect(await (await read(owner, 'HEAD')).text()).toBe('');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect((await read({ ...owner, userId: 'other-member' })).status).toBe(404);
      expect((await read({ ...admin, workspaceId: 'other-workspace' })).status).toBe(404);
      expect(bucket.objects.get(asset.key)!.bytes).toEqual(original);
      const detail = await get(p);
      expect(detail.project.version).toBe(p.version);
      expect(detail.jobs).toHaveLength(0);
      expect(detail.assets).toHaveLength(1);
    } finally { vi.unstubAllGlobals(); }
  });
  it('serializes concurrent saves with one visible version conflict', async () => {
    const p = await create();
    const results = await Promise.all([
      request(
        `/api/projects/${p.id}`,
        { expectedVersion: 1, draft: { ...p.draft, direction: 'a' } },
        owner,
        'PUT',
      ),
      request(
        `/api/projects/${p.id}`,
        { expectedVersion: 1, draft: { ...p.draft, direction: 'b' } },
        owner,
        'PUT',
      ),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await get(p)).project.version).toBe(2);
  });
  it('copies source bytes before completing an imported draft and deduplicates internal handoff', async () => {
    const products = (await request('/api/source-products')).data.products;
    expect(products).toEqual([]);
    const p = await create();
    const result = await request(`/api/projects/${p.id}/import`, {
      expectedVersion: 1,
      productIds: ['source-1'],
    });
    expect(result.status).toBe(200);
    expect(result.data.project.draft.products[0].source.conditions.keep).toEqual(['shape']);
    expect(bucket.objects.size).toBe(1);
    const assets = (await get(p)).assets;
    expect(assets[0].origin).toBe('import');
    expect(
      (
        await service.fetch(
          new Request(`http://localhost/api/projects/${p.id}/assets/${assets[0].id}`, {
            headers: { 'X-WR-Principal': JSON.stringify(owner), Range: 'bytes=0-3' },
          }),
        )
      ).status,
    ).toBe(206);
  });
  it('reserves each image atomically for its initiating administrator and releases only failed image', async () => {
    const p = await scriptReady();
    await quota(admin, 3, 0);
    const result = await request(
      `/api/projects/${p.id}/jobs`,
      { expectedVersion: p.version, requestId: 'images-1', kind: 'image' },
      admin,
    );
    expect(result.status).toBe(200);
    let n = 0;
    providers.image = async () => {
      if (++n === 2) throw new ProviderError('technical_failure', 'Image provider failed');
      return {
        body: new Uint8Array([1, 2, 3]),
        contentType: 'image/png',
        filename: 'test.png',
        testMode: true,
      };
    };
    await service.tick();
    await service.tick();
    await service.tick();
    const q = (await request('/api/admin', undefined, platform)).data.quotas.find(
      (q: any) => q.userId === admin.userId,
    );
    expect(q).toMatchObject({ imageUsed: 2, imageReserved: 0 });
    const detail = await get(p);
    expect(
      detail.jobs.filter((j: Job) => j.kind === 'image' && j.status === 'succeeded'),
    ).toHaveLength(2);
    expect(detail.quota.imageUsed).toBe(0);
  });
  it('does not over-reserve under simultaneous submissions and never double-charges retry', async () => {
    const p = await scriptReady();
    await quota(owner, 1, 0);
    const body = {
      expectedVersion: p.version,
      requestId: 'one-image',
      kind: 'image',
      sceneId: 's1',
    };
    const [a, b, c] = await Promise.all([
      request(`/api/projects/${p.id}/jobs`, body),
      request(`/api/projects/${p.id}/jobs`, body),
      request(`/api/projects/${p.id}/jobs`, { ...body, requestId: 'second-image', sceneId: 's2' }),
    ]);
    expect([a.status, b.status, c.status]).toEqual([200, 200, 409]);
    expect(a.data.job.id).toBe(b.data.job.id);
    await service.tick();
    await request(`/api/projects/${p.id}/jobs/${a.data.job.id}/retry`, {});
    expect((await get(p)).quota).toMatchObject({ imageUsed: 1, imageReserved: 0 });
  });
  it('retains global video slot and reservation for unknown submit and refuses blind retry', async () => {
    const p = await videoReady();
    providers.submitVideo = async () => {
      throw new ProviderError('submission_unknown', 'Submission outcome unknown', true);
    };
    const job = (
      await request(`/api/projects/${p.id}/jobs`, {
        expectedVersion: p.version,
        requestId: 'video-1',
        kind: 'video',
      })
    ).data.job;
    await service.tick();
    expect((await get(p)).jobs.find((j: Job) => j.id === job.id).status).toBe('unknown');
    expect((await get(p)).quota).toMatchObject({ videoUsed: 0, videoReserved: 1 });
    expect((await request(`/api/projects/${p.id}/jobs/${job.id}/retry`, {})).status).toBe(409);
    let submissions = 0;
    providers.submitVideo = async () => {
      submissions++;
      return { videoId: 'another' };
    };
    await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'video-2',
      kind: 'video',
    });
    await service.tick();
    expect(submissions).toBe(0);
  });
  it('resumes a stored upstream task after service restart and commits only saved deliverable', async () => {
    const p = await videoReady();
    const job = (
      await request(`/api/projects/${p.id}/jobs`, {
        expectedVersion: p.version,
        requestId: 'video-recover',
        kind: 'video',
      })
    ).data.job;
    await service.tick();
    expect((await get(p)).jobs.find((j: Job) => j.id === job.id).upstreamId).toBe('upstream');
    service = new DomainService(env, { schedule: async () => {} }, providers);
    providers.submitVideo = async () => {
      throw new Error('must not submit twice');
    };
    await service.tick();
    const detail = await get(p);
    expect(detail.jobs.find((j: Job) => j.id === job.id)).toMatchObject({ status: 'succeeded' });
    expect(detail.quota).toMatchObject({ videoUsed: 1, videoReserved: 0 });
    expect(bucket.objects.size).toBe(4);
  });
  it('does not mark generation deliverable when R2 persistence fails', async () => {
    const p = await scriptReady();
    await quota();
    await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'broken-r2',
      kind: 'image',
      sceneId: 's1',
    });
    bucket.put = async () => {
      throw new Error('storage failed');
    };
    await service.tick();
    const detail = await get(p);
    expect(detail.jobs.find((j: Job) => j.requestId === 'broken-r2').status).toBe('failed');
    expect(detail.quota).toMatchObject({ imageUsed: 0, imageReserved: 0 });
  });
  it('retains generated result without overwriting a newer edited storyboard', async () => {
    let p = await scriptReady();
    await quota();
    const result = await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'stale',
      kind: 'image',
      sceneId: 's1',
    });
    p.draft.scenes[0].description = 'My new scene';
    await request(
      `/api/projects/${p.id}`,
      { expectedVersion: p.version, draft: p.draft },
      owner,
      'PUT',
    );
    await service.tick();
    const detail = await get(p);
    expect(detail.project.draft.scenes[0].description).toBe('My new scene');
    expect(detail.project.draft.scenes[0].imageAssetId).toBeUndefined();
    expect(detail.jobs.find((j: Job) => j.id === result.data.job.id).resultAssetId).toBeTruthy();
    expect(detail.quota.imageUsed).toBe(1);
  });
});

async function uploadAsset(project: Project, type = 'image/png') {
  const bytes =
    type === 'image/png'
      ? new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])
      : new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0]);
  const form = new FormData();
  form.append(
    'file',
    new File([bytes], type === 'image/png' ? 'product.png' : 'hero.mp4', { type }),
  );
  const response = await service.fetch(
    new Request(`http://localhost/api/projects/${project.id}/uploads`, {
      method: 'POST',
      headers: { 'X-WR-Principal': JSON.stringify(owner) },
      body: form,
    }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { asset: { id: string } }).asset;
}
it('uploads ICO tab icons, persists their selection, and rejects mismatched content', async () => {
  const project = await create();
  const upload = async (bytes: Uint8Array) => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(bytes)], 'favicon.ico', { type: 'image/x-icon' }));
    return service.fetch(new Request(`http://localhost/api/projects/${project.id}/uploads`, {
      method: 'POST', headers: { 'X-WR-Principal': JSON.stringify(owner) }, body: form,
    }));
  };
  expect((await upload(new Uint8Array([1, 2, 3]))).status).toBe(400);
  const bytes = new Uint8Array(32);
  bytes[2] = 1; bytes[4] = 1;
  const result = await upload(bytes);
  expect(result.status).toBe(200);
  const { asset } = await result.json() as { asset: { id: string } };
  project.draft.company.faviconAssetId = asset.id;
  const saved = await request(`/api/projects/${project.id}`, { expectedVersion: project.version, draft: project.draft }, owner, 'PUT');
  expect(saved.status).toBe(200);
  expect((await get(project)).project.draft.company.faviconAssetId).toBe(asset.id);
});
async function publishable() {
  let p = await create();
  const image = await uploadAsset(p),
    video = await uploadAsset(p, 'video/mp4');
  const d = p.draft;
  d.company = {
    ...d.company,
    name: 'Confirmed Company',
    contactName: 'Jane',
    email: 'sales@example.com',
  };
  d.country = 'Germany';
  d.products = [
    {
      id: 'p1',
      name: 'Wooden toy',
      description: 'Provided description',
      material: 'Wood',
      dimensions: '',
      imageAssetId: image.id,
    },
  ];
  d.primaryProductId = 'p1';
  d.copy = {
    en: {
      headline: 'Original headline',
      subtitle: 'Supplied facts',
      about: 'Actual company',
      cta: 'Contact us',
    },
  };
  p = (
    await request(`/api/projects/${p.id}`, { expectedVersion: p.version, draft: d }, owner, 'PUT')
  ).data.project;
  p = (
    await request(`/api/projects/${p.id}/accept-video`, {
      expectedVersion: p.version,
      assetId: video.id,
    })
  ).data.project;
  return p;
}
async function publishNow(p: Project) {
  const response = await request(`/api/projects/${p.id}/publish`, {
    expectedVersion: p.version,
    requestId: crypto.randomUUID(),
  });
  expect(response.status).toBe(200);
  await service.tick();
  return (await get(p)).project as Project;
}

describe('publications, delivery and scheduler boundaries', () => {
  it('does not schedule repeated alarms for an empty queue or an unknown-only queue', async () => {
    const schedule = vi.fn(async () => {});
    service = new DomainService(env, { schedule }, providers);
    await service.tick();
    expect(schedule).not.toHaveBeenCalled();
    const p = await videoReady();
    providers.submitVideo = async () => {
      throw new ProviderError('submission_unknown', 'Unknown', true);
    };
    await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'unknown-idle',
      kind: 'video',
    });
    await service.tick();
    schedule.mockClear();
    await service.tick();
    expect(schedule).not.toHaveBeenCalled();
  });
  it('allows only platform reconciliation to bind an original video ID and never resubmits', async () => {
    const p = await videoReady();
    providers.submitVideo = async () => {
      throw new ProviderError('submission_unknown', 'Unknown', true);
    };
    const { data } = await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'reconcile-one',
      kind: 'video',
    });
    await service.tick();
    expect(
      (
        await request(
          `/api/admin/jobs/${data.job.id}/reconcile`,
          { upstreamId: 'original-task' },
          admin,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `/api/admin/jobs/${data.job.id}/reconcile`,
          { confirmedFailed: true },
          platform,
        )
      ).status,
    ).toBe(400);
    const reconciled = await request(
      `/api/admin/jobs/${data.job.id}/reconcile`,
      { upstreamId: 'original-task' },
      platform,
    );
    expect(reconciled.status).toBe(200);
    expect(reconciled.data.job.input.reconciliation.userId).toBe(platform.userId);
    providers.submitVideo = async () => {
      throw new Error('cannot resubmit');
    };
    await service.tick();
    expect((await get(p)).quota.videoUsed).toBe(1);
  });
  it('publishes immutable content, preserves prior success on failure and keeps drafts on restore', async () => {
    let p = await publishable();
    p = await publishNow(p);
    const first = p.publishedReleaseId;
    expect(first).toBeTruthy();
    p.draft.copy.en!.headline = 'New draft headline';
    p = (
      await request(
        `/api/projects/${p.id}`,
        { expectedVersion: p.version, draft: p.draft },
        owner,
        'PUT',
      )
    ).data.project;
    const publicRequest = () =>
      service.fetch(new Request(`http://localhost/public/sites/${p.id}/en/index.html`));
    expect(await (await publicRequest()).text()).toContain('Original headline');
    providers.publish = async () => {
      throw new ProviderError('provider_failed', 'Publish failed');
    };
    const failed = await request(`/api/projects/${p.id}/publish`, {
      expectedVersion: p.version,
      requestId: 'publish-failure',
    });
    await service.tick();
    expect((await get(p)).project.publishedReleaseId).toBe(first);
    expect((await get(p)).jobs.find((j: Job) => j.id === failed.data.job.id).status).toBe('failed');
    providers.publish = providerSet().publish;
    p = await publishNow((await get(p)).project);
    expect(await (await publicRequest()).text()).toContain('New draft headline');
    const draftBefore = JSON.stringify(p.draft);
    await request(`/api/projects/${p.id}/restore`, { requestId: 'restore-release' });
    await service.tick();
    p = (await get(p)).project;
    expect(JSON.stringify(p.draft)).toBe(draftBefore);
    expect(await (await publicRequest()).text()).toContain('Original headline');
  });
  it('recovers pending Pages deployment with the same release marker before activation', async () => {
    const p = await publishable();
    let calls = 0;
    const releases: string[] = [];
    providers.publish = async (id, release) => {
      releases.push(release);
      if (++calls === 1) throw new ProviderError('pages_deployment_pending', 'Pending', true);
      return { deploymentId: release, url: `https://${id}.pages.dev`, testMode: true };
    };
    const result = await request(`/api/projects/${p.id}/publish`, {
      expectedVersion: p.version,
      requestId: 'pending-pages',
    });
    await service.tick();
    expect((await get(p)).releases[0].status).toBe('pending');
    await service.tick();
    expect(releases).toHaveLength(2);
    expect(new Set(releases).size).toBe(1);
    expect((await get(p)).jobs.find((j: Job) => j.id === result.data.job.id).status).toBe(
      'succeeded',
    );
  });
  it('offline blocks every public page, approved asset and inquiry while retaining private project', async () => {
    let p = await publishable();
    p = await publishNow(p);
    await request(`/api/projects/${p.id}/offline`, {});
    expect(
      (
        await service.fetch(
          new Request(`http://localhost/public/sites/${p.id}/en/about/index.html`),
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await service.fetch(
          new Request(`http://localhost/public/sites/${p.id}/assets/${p.draft.heroAssetId}`),
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await request(`/api/public/sites/${p.id}/inquiries`, {
          requestId: 'offline-inquiry',
          name: 'Buyer',
          email: 'buyer@example.com',
          company: '',
          message: 'Hello',
        })
      ).status,
    ).toBe(409);
    expect((await get(p)).project.publishedReleaseId).toBeTruthy();
  });
  it('stores and deduplicates inquiries before email, uses trusted recipient and bounds retries', async () => {
    let p = await publishable();
    p = await publishNow(p);
    const body = {
      requestId: 'buyer-message',
      name: 'Buyer',
      email: 'buyer@example.com',
      company: 'Buyer Co',
      message: 'Please quote.',
      productId: 'p1',
      recipient: 'attacker@example.com',
    };
    const a = await request(`/api/public/sites/${p.id}/inquiries`, body),
      b = await request(`/api/public/sites/${p.id}/inquiries`, body);
    expect(a.data.id).toBe(b.data.id);
    let attempts = 0;
    providers.email = async (_inquiry, recipient) => {
      expect(recipient).toBe('sales@example.com');
      attempts++;
      throw new ProviderError('mail_failed', 'Delivery failed');
    };
    await service.tick();
    let list = await request(`/api/projects/${p.id}/inquiries`);
    expect(list.data.inquiries).toHaveLength(1);
    expect(list.data.inquiries[0]).toMatchObject({ emailStatus: 'failed', emailAttempts: 1 });
    await request(`/api/projects/${p.id}/inquiries/${a.data.id}/retry`, {});
    await service.tick();
    await request(`/api/projects/${p.id}/inquiries/${a.data.id}/retry`, {});
    await service.tick();
    expect(attempts).toBe(3);
    expect((await request(`/api/projects/${p.id}/inquiries/${a.data.id}/retry`, {})).status).toBe(
      409,
    );
    expect(
      (await request(`/api/public/sites/${p.id}/inquiries`, { ...body, message: 'changed' }))
        .status,
    ).toBe(409);
  });
  it('never exposes draft-only assets through the published endpoint', async () => {
    let p = await publishable();
    p = await publishNow(p);
    const privateAsset = await uploadAsset(p);
    expect(
      (
        await service.fetch(
          new Request(`http://localhost/public/sites/${p.id}/assets/${privateAsset.id}`),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await service.fetch(
          new Request(`http://localhost/api/projects/${p.id}/assets/${privateAsset.id}`),
        )
      ).status,
    ).toBe(401);
  });
});

describe('review and recovery races', () => {
  it('requires re-review when upstream snapshot changes between source-check and source-apply', async () => {
    let p = await create();
    p = (
      await request(`/api/projects/${p.id}/import`, {
        expectedVersion: p.version,
        productIds: ['source-1'],
      })
    ).data.project;
    sourceState.version = 'v2';
    const changes = await request(`/api/projects/${p.id}/source-check`, {});
    expect(changes.data.changes[0].after.version).toBe('v2');
    sourceState.version = 'v3';
    expect(
      (
        await request(`/api/projects/${p.id}/source-apply`, {
          expectedVersion: p.version,
          productIds: ['source-1'],
        })
      ).status,
    ).toBe(409);
    await request(`/api/projects/${p.id}/source-check`, {});
    const applied = await request(`/api/projects/${p.id}/source-apply`, {
      expectedVersion: p.version,
      productIds: ['source-1'],
    });
    expect(applied.data.project.draft.products[0].source.version).toBe('v3');
  });
  it('releases reserved video quota when authorization fails before upstream submission', async () => {
    const p = await videoReady();
    let submitted = 0;
    providers.submitVideo = async () => {
      submitted++;
      return { videoId: 'never' };
    };
    await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'revoked-video',
      kind: 'video',
    });
    sourceState.revoked = true;
    await service.tick();
    expect(submitted).toBe(0);
    expect((await get(p)).quota.videoReserved).toBe(0);
    expect((await get(p)).jobs.find((j: Job) => j.requestId === 'revoked-video').status).toBe(
      'failed',
    );
  });
  it('uses a fresh upstream attempt only after a confirmed terminal video failure', async () => {
    const p = await videoReady();
    let submissions = 0;
    const keys: string[] = [];
    providers.submitVideo = async (_d, _refs, key) => {
      keys.push(key);
      return { videoId: `attempt-${++submissions}` };
    };
    providers.pollVideo = async (id) =>
      id === 'attempt-1'
        ? { state: 'failed', message: 'Technical failure' }
        : providerSet().pollVideo(id);
    const job = (
      await request(`/api/projects/${p.id}/jobs`, {
        expectedVersion: p.version,
        requestId: 'terminal-retry',
        kind: 'video',
      })
    ).data.job;
    await service.tick();
    await service.tick();
    expect((await get(p)).quota.videoReserved).toBe(0);
    await request(`/api/projects/${p.id}/jobs/${job.id}/retry`, {}, admin);
    await service.tick();
    await service.tick();
    expect(submissions).toBe(2);
    expect(new Set(keys).size).toBe(2);
    expect((await get(p)).quota).toMatchObject({ videoUsed: 1, videoReserved: 0 });
  });
  it('backs off rate-limited video queries without exhausting failures or submitting again', async () => {
    const p = await videoReady();
    const submit = vi.spyOn(providers, 'submitVideo');
    const job = (
      await request(`/api/projects/${p.id}/jobs`, {
        expectedVersion: p.version,
        requestId: 'rate-limited-video',
        kind: 'video',
      })
    ).data.job;
    await service.tick();
    const persisted = (await service.store.one<Job>('jobs', job.id))!;
    persisted.input.pollFailures = 11;
    await service.store.update('jobs', persisted).run();
    const poll = vi.fn(async () => {
      throw Object.assign(new ProviderError('agnes_http_429', 'Rate limited'), {
        retryAfterMs: 120_000,
      });
    });
    providers.pollVideo = poll;
    const before = Date.now();
    await service.tick();
    const waiting = (await service.store.one<Job>('jobs', job.id))!;
    expect(waiting.status).toBe('running');
    expect(waiting.input.pollFailures).toBe(11);
    expect(Number(waiting.input.nextPollAt)).toBeGreaterThanOrEqual(before + 120_000);
    // Simulate a restart or another alarm: the persisted cooldown still applies.
    const schedule = vi.fn(async (_time: number) => {});
    service = new DomainService(env, { schedule }, providers);
    await service.tick();
    expect(poll).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith(waiting.input.nextPollAt);
    waiting.input.nextPollAt = Date.now() - 1;
    await service.store.update('jobs', waiting).run();
    providers.pollVideo = providerSet().pollVideo;
    await service.tick();
    expect((await service.store.one<Job>('jobs', job.id))!.status).toBe('succeeded');
    expect(submit).toHaveBeenCalledTimes(1);
    expect((await get(p)).quota).toMatchObject({ videoUsed: 1, videoReserved: 0 });
  });
  it('clears a stale query error after the same upstream task is pending again', async () => {
    const p = await videoReady();
    const job = (
      await request(`/api/projects/${p.id}/jobs`, {
        expectedVersion: p.version,
        requestId: 'recovered-poll',
        kind: 'video',
      })
    ).data.job;
    await service.tick();
    const persisted = (await service.store.one<Job>('jobs', job.id))!;
    persisted.error = 'Previous query failed';
    persisted.input.pollFailures = 2;
    await service.store.update('jobs', persisted).run();
    providers.pollVideo = async () => ({ state: 'pending' });
    await service.tick();
    const recovered = (await service.store.one<Job>('jobs', job.id))!;
    expect(recovered.error).toBeUndefined();
    expect(recovered.input.pollFailures).toBe(0);
    expect(recovered.upstreamId).toBe(persisted.upstreamId);
  });
  it('schedules a future alarm for a known upstream task before its next poll is due', async () => {
    const p = await videoReady();
    await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'future-poll',
      kind: 'video',
    });
    await service.tick();
    env.ENVIRONMENT = 'production';
    const schedule = vi.fn(async (_time: number) => {});
    let polls = 0;
    providers.pollVideo = async () => {
      polls++;
      return { state: 'pending' };
    };
    service = new DomainService(env, { schedule }, providers);
    await service.tick();
    expect(polls).toBe(0);
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule.mock.calls[0][0]).toBeGreaterThan(Date.now());
  });
});

it('streams unknown-length imports through bounded multipart uploads instead of R2.put', async () => {
  const p = await create();
  bucket.put = async (_key, body) => {
    if (body instanceof ReadableStream) throw new TypeError('R2 requires known length');
    return { key: _key, size: 1 };
  };
  const imported = await request(`/api/projects/${p.id}/import`, {
    expectedVersion: p.version,
    productIds: ['source-1'],
  });
  expect(imported.status).toBe(200);
  expect(bucket.objects.size).toBe(1);
});
it('renders product detail pages and accepts the frontend detail preview query', async () => {
  let p = await publishable();
  const preview = await request(`/api/projects/${p.id}/preview?page=detail&productId=p1`);
  expect(preview.status).toBe(200);
  expect(preview.data.html).toContain('class="detail wrap"');
  p = await publishNow(p);
  const page = await service.fetch(
    new Request(`http://localhost/public/sites/${p.id}/en/products/p1/index.html`),
  );
  expect(await page.text()).toContain('class="detail wrap"');
});
it('keeps expired ambiguous mail delivery unknown and blocks every retry path', async () => {
  let p = await publishable();
  p = await publishNow(p);
  const submitted = await request(`/api/public/sites/${p.id}/inquiries`, {
    requestId: 'expired-mail',
    name: 'Buyer',
    email: 'buyer@example.com',
    company: '',
    message: 'Hello',
  });
  const job = (await get(p)).jobs.find((j: Job) => j.kind === 'email');
  job.status = 'running';
  job.attempts = 1;
  job.createdAt = new Date(Date.now() - 25 * 3600000).toISOString();
  await service.store.update('jobs', job).run();
  const inquiry = await service.store.one<any>('inquiries', submitted.data.id);
  inquiry.createdAt = job.createdAt;
  inquiry.emailStatus = 'queued';
  await service.store.update('inquiries', inquiry).run();
  service = new DomainService(env, { schedule: async () => {} }, providers);
  await service.tick();
  expect((await request(`/api/projects/${p.id}/inquiries`)).data.inquiries[0].emailStatus).toBe(
    'unknown',
  );
  expect((await request(`/api/projects/${p.id}/inquiries/${inquiry.id}/retry`, {})).status).toBe(
    409,
  );
});

it('scopes provider asset grants, rejects tampering and supports provider HEAD probes', async () => {
  let p = await publishable();
  await request(`/api/projects/${p.id}/jobs`, {
    expectedVersion: p.version,
    requestId: 'signed-script',
    kind: 'script',
  });
  await service.tick();
  p = (await get(p)).project;
  p = (await request(`/api/projects/${p.id}/confirm-script`, { expectedVersion: p.version })).data
    .project;
  await quota();
  let reference = '';
  providers.image = async (d, s, i, refs) => {
    reference = refs[0];
    return providerSet().image(d, s, i, refs);
  };
  await request(`/api/projects/${p.id}/jobs`, {
    expectedVersion: p.version,
    requestId: 'signed-image',
    kind: 'image',
    sceneId: 's1',
  });
  await service.tick();
  expect(reference).toContain('/public/provider-assets/');
  expect((await service.fetch(new Request(reference))).status).toBe(200);
  const head = await service.fetch(new Request(reference, { method: 'HEAD' }));
  expect(head.status).toBe(200);
  expect(await head.text()).toBe('');
  const forged = new URL(reference);
  forged.searchParams.set('token', '0'.repeat(64));
  expect((await service.fetch(new Request(forged))).status).toBe(403);
  forged.searchParams.set('expires', '0');
  expect((await service.fetch(new Request(forged))).status).toBe(403);
});
it('recovers already persisted generated image after a crash before D1 finalization', async () => {
  const p = await scriptReady();
  await quota();
  const job = (
    await request(`/api/projects/${p.id}/jobs`, {
      expectedVersion: p.version,
      requestId: 'saved-before-crash',
      kind: 'image',
      sceneId: 's1',
    })
  ).data.job;
  job.status = 'running';
  job.attempts = 1;
  await service.store.update('jobs', job).run();
  const key = `projects/${p.id}/assets/result-${job.id}`;
  await bucket.put(key, new Uint8Array([137, 80, 78, 71]), {
    httpMetadata: { contentType: 'image/png' },
    customMetadata: { filename: 'saved.png', origin: 'test', createdAt: job.createdAt },
  });
  service = new DomainService(env, { schedule: async () => {} }, providers);
  providers.image = async () => {
    throw Error('must not generate again');
  };
  await service.tick();
  const detail = await get(p);
  expect(detail.jobs.find((j: Job) => j.id === job.id)).toMatchObject({
    status: 'succeeded',
    resultAssetId: `result-${job.id}`,
  });
  expect(detail.quota).toMatchObject({ imageUsed: 1, imageReserved: 0 });
});

it('permits a fresh explicit publication after offline cancels an uncertain older activation', async () => {
  let p = await publishable();
  providers.publish = async () => {
    throw new ProviderError('pages_acceptance_unknown', 'Unknown Pages acceptance', true);
  };
  await request(`/api/projects/${p.id}/publish`, {
    expectedVersion: p.version,
    requestId: 'uncertain-release',
  });
  await service.tick();
  p = (await request(`/api/projects/${p.id}/offline`, {})).data.project;
  providers.publish = providerSet().publish;
  const next = await request(`/api/projects/${p.id}/publish`, {
    expectedVersion: p.version,
    requestId: 'explicit-next-release',
  });
  expect(next.status).toBe(200);
  await service.tick();
  expect((await get(p)).project.offline).toBe(false);
});

describe('durable hosting identity and activation recovery', () => {
  it('persists project and release hosting identity before any external deployment', async () => {
    const p = await publishable(),
      target = { accountId: 'ACCOUNT_A', pagesProjectName: 'wr-permanent-site' };
    let deployed = 0;
    providers.resolveHostingTarget = async (_id, current) => current ?? target;
    providers.publish = async (_id, release, _files, _previous, actual) => {
      deployed++;
      expect(actual).toEqual(target);
      return { deploymentId: release, url: 'https://wr-permanent-site.pages.dev', testMode: true };
    };
    const queued = await request(`/api/projects/${p.id}/publish`, {
      expectedVersion: p.version,
      requestId: 'bind-before-deploy',
    });
    expect(queued.status).toBe(200);
    let detail = await get(p);
    expect(detail.project.hostingTarget).toEqual(target);
    expect(detail.releases[0].hostingTarget).toEqual(target);
    expect(deployed).toBe(0);
    await service.tick();
    detail = await get(p);
    expect(detail.project.publishedReleaseId).toBe(detail.releases[0].id);
    expect(deployed).toBe(1);
  });
  it('keeps an existing binding when its account configuration disappears instead of switching accounts', async () => {
    let p = await publishable();
    const target = { accountId: 'ACCOUNT_A', pagesProjectName: 'wr-fixed' };
    providers.resolveHostingTarget = async (_id, current) => current ?? target;
    providers.publish = async () => {
      throw new ProviderError('pages_unconfigured', 'Account missing');
    };
    await request(`/api/projects/${p.id}/publish`, {
      expectedVersion: p.version,
      requestId: 'bind-first-failed',
    });
    await service.tick();
    p = (await get(p)).project;
    providers.resolveHostingTarget = async (_id, current) => {
      if (current?.accountId === 'ACCOUNT_A')
        throw new ProviderError('pages_account_missing', 'Bound account removed');
      return { accountId: 'ACCOUNT_B', pagesProjectName: 'wr-other' };
    };
    const result = await request(`/api/projects/${p.id}/publish`, {
      expectedVersion: p.version,
      requestId: 'cannot-move-account',
    });
    expect(result.status).toBe(503);
    const detail = await get(p);
    expect(detail.project.hostingTarget).toEqual(target);
    expect(detail.releases).toHaveLength(1);
  });
  it('rolls back a new project binding when the job/release batch cannot be stored', async () => {
    const p = await publishable();
    providers.resolveHostingTarget = async () => ({
      accountId: 'ACCOUNT_A',
      pagesProjectName: 'wr-fixed',
    });
    await env.DB.exec(
      "CREATE TRIGGER reject_release BEFORE INSERT ON releases BEGIN SELECT RAISE(ABORT, 'release failed'); END",
    );
    expect(
      (
        await request(`/api/projects/${p.id}/publish`, {
          expectedVersion: p.version,
          requestId: 'atomic-binding',
        })
      ).status,
    ).toBe(500);
    const detail = await get(p);
    expect(detail.project.hostingTarget).toBeUndefined();
    expect(detail.releases).toHaveLength(0);
    expect(detail.jobs).toHaveLength(0);
  });
  it('recovers the saved successful deployment after activation D1 write failure without a new release', async () => {
    const p = await publishable();
    await env.DB.exec(
      "CREATE TRIGGER reject_activation BEFORE UPDATE ON projects WHEN json_extract(NEW.data, '$.publishedReleaseId') IS NOT NULL BEGIN SELECT RAISE(ABORT, 'activation failed'); END",
    );
    const queued = await request(`/api/projects/${p.id}/publish`, {
      expectedVersion: p.version,
      requestId: 'activation-recovery',
    });
    await service.tick();
    let detail = await get(p);
    const releaseId = detail.releases[0].id;
    expect(await service.store.one<Job>('jobs', queued.data.job.id)).toMatchObject({
      status: 'unknown',
      input: { publishResult: { deploymentId: releaseId } },
    });
    expect(detail.releases[0].status).toBe('pending');
    expect(detail.project.publishedReleaseId).toBeUndefined();
    const duplicate = await request(`/api/projects/${p.id}/publish`, {
      expectedVersion: p.version, requestId: 'must-not-replace-release',
    });
    expect(duplicate.status).toBe(200);
    expect(duplicate.data.job.id).toBe(queued.data.job.id);
    await env.DB.exec('DROP TRIGGER reject_activation');
    service = new DomainService(env, { schedule: async () => {} }, providers);
    providers.publish = async () => {
      throw new Error('saved successful deployment must not be deployed again');
    };
    await request(`/api/projects/${p.id}/jobs/${queued.data.job.id}/retry`, {});
    await service.tick();
    detail = await get(p);
    expect(detail.project.publishedReleaseId).toBe(releaseId);
    expect(detail.releases).toHaveLength(1);
    expect(detail.releases[0].status).toBe('succeeded');
  });
  it('retains successful publish results when current permission is revoked before activation', async () => {
    const p = await publishable();
    let calls = 0;
    providers.publish = async (_id, release) => {
      calls++;
      sourceState.revoked = true;
      return { deploymentId: release, url: 'https://fixed.pages.dev', testMode: true };
    };
    const queued = await request(`/api/projects/${p.id}/publish`, {
      expectedVersion: p.version,
      requestId: 'permission-after-deploy',
    });
    await service.tick();
    let detail = await get(p);
    expect(detail.jobs.find((j: Job) => j.id === queued.data.job.id).status).toBe('unknown');
    expect(detail.releases[0].status).toBe('pending');
    expect(detail.project.offline).toBe(true);
    sourceState.revoked = false;
    await request(`/api/projects/${p.id}/jobs/${queued.data.job.id}/retry`, {});
    await service.tick();
    detail = await get(p);
    expect(detail.project.publishedReleaseId).toBe(detail.releases[0].id);
    expect(calls).toBe(1);
  });
});

it('preserves an offline cancellation while saving a concurrently returned Pages success', async () => {
  const p = await publishable();
  let finish!: (value: { deploymentId: string; url: string; testMode: boolean }) => void;
  let signal!: () => void;
  const started = new Promise<void>((resolve) => {
    signal = resolve;
  });
  providers.publish = async () => {
    signal();
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const queued = await request(`/api/projects/${p.id}/publish`, {
    expectedVersion: p.version,
    requestId: 'offline-during-provider',
  });
  const running = service.tick();
  await started;
  await request(`/api/projects/${p.id}/offline`, {});
  finish({
    deploymentId: 'accepted-while-offline',
    url: 'https://fixed.pages.dev',
    testMode: true,
  });
  await running;
  const detail = await get(p);
  expect(detail.project.offline).toBe(true);
  expect(detail.project.publishedReleaseId).toBeUndefined();
  expect(detail.jobs.find((j: Job) => j.id === queued.data.job.id).status).toBe('failed');
  expect(detail.jobs.find((j: Job) => j.id === queued.data.job.id).input.cancelledByOffline).toBe(
    true,
  );
});

it('recovers the same release marker if the deployment result could not be written during a D1 outage', async () => {
  const p = await publishable(),
    markers: string[] = [];
  providers.publish = async (_id, release) => {
    markers.push(release);
    return {
      deploymentId: `deployment-${release}`,
      url: 'https://fixed.pages.dev',
      testMode: true,
    };
  };
  await env.DB.exec(
    "CREATE TRIGGER reject_publish_result BEFORE UPDATE ON jobs WHEN json_extract(NEW.data, '$.input.publishResult') IS NOT NULL BEGIN SELECT RAISE(ABORT, 'result storage unavailable'); END",
  );
  const queued = await request(`/api/projects/${p.id}/publish`, {
    expectedVersion: p.version,
    requestId: 'lost-result-write',
  });
  await expect(service.tick()).rejects.toThrow();
  let detail = await get(p);
  expect(detail.jobs.find((j: Job) => j.id === queued.data.job.id).status).toBe('running');
  expect(detail.jobs.find((j: Job) => j.id === queued.data.job.id).input.publicationStarted).toBe(
    true,
  );
  expect(detail.releases[0].status).toBe('pending');
  await env.DB.exec('DROP TRIGGER reject_publish_result');
  service = new DomainService(env, { schedule: async () => {} }, providers);
  await service.tick();
  detail = await get(p);
  expect(detail.jobs.find((j: Job) => j.id === queued.data.job.id).status).toBe('unknown');
  await request(`/api/projects/${p.id}/jobs/${queued.data.job.id}/retry`, {});
  await service.tick();
  detail = await get(p);
  expect(markers).toHaveLength(2);
  expect(new Set(markers).size).toBe(1);
  expect(detail.releases).toHaveLength(1);
  expect(detail.project.publishedReleaseId).toBe(markers[0]);
});

describe('accepted task tracking and dispatch-time email safety', () => {
  it.each([403, 502])(
    'keeps polling an accepted video without releasing the global slot when PR context would fail with %i',
    async (status) => {
      const p = await videoReady();
      const first = (
        await request(`/api/projects/${p.id}/jobs`, {
          expectedVersion: p.version,
          requestId: `accepted-video-${status}`,
          kind: 'video',
        })
      ).data.job;
      await service.tick();
      await request(`/api/projects/${p.id}/jobs`, {
        expectedVersion: p.version,
        requestId: `queued-video-${status}`,
        kind: 'video',
      });
      sourceState.revoked = true;
      sourceState.failureStatus = status;
      let polls = 0,
        submissions = 0;
      providers.pollVideo = async () => {
        polls++;
        return { state: 'pending' };
      };
      providers.submitVideo = async () => {
        submissions++;
        return { videoId: 'must-not-start' };
      };
      await service.tick();
      sourceState.revoked = false;
      await service.tick();
      const detail = await get(p);
      expect(polls).toBe(2);
      expect(submissions).toBe(0);
      expect(detail.jobs.find((j: Job) => j.id === first.id)).toMatchObject({
        status: 'running',
        upstreamId: 'upstream',
      });
      expect(detail.quota).toMatchObject({ videoReserved: 2, videoUsed: 0 });
      expect(
        (await request(`/api/projects/${p.id}`, undefined, { ...owner, userId: 'another-member' }))
          .status,
      ).toBe(404);
    },
  );
  it('rechecks an ambiguous email retry immediately before dispatch after its queue crosses the idempotency deadline', async () => {
    let p = await publishable();
    p = await publishNow(p);
    const submitted = await request(`/api/public/sites/${p.id}/inquiries`, {
      requestId: 'late-dispatch-retry',
      name: 'Buyer',
      email: 'buyer@example.com',
      company: '',
      message: 'Hello',
    });
    providers.email = async () => {
      throw new ProviderError('email_unknown', 'Acceptance unknown', true);
    };
    const start = Date.now();
    await service.tick();
    const clock = vi.spyOn(Date, 'now');
    try {
      clock.mockReturnValue(start + 22.5 * 3600000);
      expect(
        (await request(`/api/projects/${p.id}/inquiries/${submitted.data.id}/retry`, {})).status,
      ).toBe(200);
      clock.mockReturnValue(start + 25.5 * 3600000);
      let sends = 0;
      providers.email = async () => {
        sends++;
        return { id: 'duplicate', testMode: true };
      };
      await service.tick();
      expect(sends).toBe(0);
      const inquiry = (await request(`/api/projects/${p.id}/inquiries`)).data.inquiries[0];
      expect(inquiry.emailStatus).toBe('unknown');
      expect(
        (await request(`/api/projects/${p.id}/inquiries/${inquiry.id}/retry`, {})).status,
      ).toBe(409);
    } finally {
      clock.mockRestore();
    }
  });
  it('allows a genuine first email attempt after a long queue and starts the retry window at that first attempt', async () => {
    let p = await publishable();
    p = await publishNow(p);
    await request(`/api/public/sites/${p.id}/inquiries`, {
      requestId: 'delayed-first-send',
      name: 'Buyer',
      email: 'buyer@example.com',
      company: '',
      message: 'Hello',
    });
    const clock = vi.spyOn(Date, 'now'),
      dispatchTime = Date.now() + 30 * 3600000;
    try {
      clock.mockReturnValue(dispatchTime);
      let sends = 0;
      providers.email = async () => {
        sends++;
        return { id: 'first-send', testMode: true };
      };
      await service.tick();
      const job = (await get(p)).jobs.find((j: Job) => j.kind === 'email');
      expect(sends).toBe(1);
      expect(job.status).toBe('succeeded');
      expect(job.input.emailFirstAttemptAt).toBe(dispatchTime);
    } finally {
      clock.mockRestore();
    }
  });
});

it('passes only the currently active successful release as previous static content to Pages', async () => {
  let p = await publishable();
  p = await publishNow(p);
  const activeReleaseId = p.publishedReleaseId!;
  const unpublished = structuredClone(p.draft);
  unpublished.copy.en!.headline = 'UNPUBLISHED SECRET CONTENT';
  await service.store
    .insert('releases', {
      id: 'unpublished-later-release',
      projectId: p.id,
      draftVersion: p.version,
      draft: unpublished,
      status: 'pending',
      createdAt: new Date().toISOString(),
      testMode: true,
    })
    .run();
  p.draft.copy.en!.headline = 'Edited new draft';
  p = (
    await request(
      `/api/projects/${p.id}`,
      { expectedVersion: p.version, draft: p.draft },
      owner,
      'PUT',
    )
  ).data.project;
  let checked = false;
  providers.publish = async (_id, release, files, _deployment, _target, previous) => {
    expect(files['en/index.html']).toContain('Edited new draft');
    expect(previous?.releaseId).toBe(activeReleaseId);
    expect(previous?.files['en/index.html']).toContain('Original headline');
    expect(JSON.stringify(previous?.files)).not.toContain('UNPUBLISHED SECRET CONTENT');
    expect(JSON.stringify(previous?.files)).not.toContain('Edited new draft');
    checked = true;
    return { deploymentId: release, url: 'https://fixed.pages.dev', testMode: true };
  };
  await request(`/api/projects/${p.id}/publish`, {
    expectedVersion: p.version,
    requestId: 'trusted-previous-bundle',
  });
  await service.tick();
  expect(checked).toBe(true);
});

it('still blocks duplicate email dispatch past the deadline if accepted-mail D1 finalization had failed', async () => {
  let p = await publishable();
  p = await publishNow(p);
  const submitted = await request(`/api/public/sites/${p.id}/inquiries`, {
    requestId: 'accepted-mail-write-failure',
    name: 'Buyer',
    email: 'buyer@example.com',
    company: '',
    message: 'Hello',
  });
  await env.DB.exec(
    "CREATE TRIGGER reject_sent_mail BEFORE UPDATE ON jobs WHEN NEW.kind = 'email' AND NEW.status = 'succeeded' BEGIN SELECT RAISE(ABORT, 'mail finalization failed'); END",
  );
  let sends = 0;
  providers.email = async () => {
    sends++;
    return { id: 'already-accepted', testMode: true };
  };
  const start = Date.now();
  await service.tick();
  expect(sends).toBe(1);
  await env.DB.exec('DROP TRIGGER reject_sent_mail');
  const clock = vi.spyOn(Date, 'now');
  try {
    clock.mockReturnValue(start + 22.5 * 3600000);
    expect(
      (await request(`/api/projects/${p.id}/inquiries/${submitted.data.id}/retry`, {})).status,
    ).toBe(200);
    clock.mockReturnValue(start + 25.5 * 3600000);
    await service.tick();
    expect(sends).toBe(1);
    expect((await request(`/api/projects/${p.id}/inquiries`)).data.inquiries[0].emailStatus).toBe(
      'unknown',
    );
  } finally {
    clock.mockRestore();
  }
});

describe('account unlimited generation quota', () => {
  const setUnlimited = (unlimited: boolean, principal = platform, images = 0, videos = 0) =>
    request(
      `/api/admin/quotas/${owner.userId}`,
      { imageLimit: images, videoLimit: videos, unlimited },
      principal,
      'PUT',
    );

  it('lets only the platform administrator grant unlimited quota', async () => {
    expect((await setUnlimited(true, owner)).status).toBe(403);
    expect((await setUnlimited(true, admin)).status).toBe(403);
    const result = await setUnlimited(true);
    expect(result.status).toBe(200);
    expect(result.data.quota).toMatchObject({ unlimited: true, imageLimit: 0, videoLimit: 0 });
  });

  it('generates a full storyboard with zero finite limits and still records usage', async () => {
    const project = await scriptReady();
    await setUnlimited(true);
    const result = await request(`/api/projects/${project.id}/jobs`, {
      expectedVersion: project.version,
      requestId: 'unlimited-images',
      kind: 'image',
    });
    expect(result.status).toBe(200);
    expect((await get(project)).quota.imageReserved).toBe(3);
    for (let i = 0; i < 3; i++) await service.tick();
    expect((await get(project)).quota).toMatchObject({
      unlimited: true,
      imageUsed: 3,
      imageReserved: 0,
    });
    expect((await setUnlimited(false)).status).toBe(409);
    expect((await setUnlimited(false, platform, 3, 0)).status).toBe(200);
  });

  it('preserves unlimited mode when an older quota form omits the flag', async () => {
    await setUnlimited(true);
    await quota(owner, 1, 1);
    const project = await create();
    expect((await get(project)).quota.unlimited).toBe(true);
  });

  it('allows a failed unlimited image to retry without losing quota accounting', async () => {
    const project = await scriptReady();
    await setUnlimited(true);
    const result = await request(`/api/projects/${project.id}/jobs`, {
      expectedVersion: project.version,
      requestId: 'unlimited-retry',
      kind: 'image',
      sceneId: 's1',
    });
    expect(result.status).toBe(200);
    const image = providers.image;
    providers.image = async () => {
      throw new ProviderError('technical_failure', 'Test image failure');
    };
    await service.tick();
    expect((await get(project)).quota).toMatchObject({ imageUsed: 0, imageReserved: 0 });
    providers.image = image;
    expect(
      (await request(`/api/projects/${project.id}/jobs/${result.data.job.id}/retry`, {})).status,
    ).toBe(200);
    await service.tick();
    expect((await get(project)).quota).toMatchObject({ imageUsed: 1, imageReserved: 0 });
  });

  it('allows video generation with an unlimited account and zero finite video limit', async () => {
    const project = await videoReady();
    await setUnlimited(true);
    const result = await request(`/api/projects/${project.id}/jobs`, {
      expectedVersion: project.version,
      requestId: 'unlimited-video',
      kind: 'video',
    });
    expect(result.status).toBe(200);
    expect((await get(project)).quota).toMatchObject({ unlimited: true, videoReserved: 1 });
  });

  it('supports single project deletion and batch project deletion', async () => {
    const p1 = await create('P1');
    const p2 = await create('P2');
    const p3 = await create('P3');

    const delRes = await request(`/api/projects/${p1.id}`, undefined, owner, 'DELETE');
    expect(delRes.status).toBe(200);
    const getRes = await request(`/api/projects/${p1.id}`);
    expect(getRes.status).toBe(404);

    const batchRes = await request(
      '/api/projects/batch-delete',
      { ids: [p2.id, p3.id] },
      owner,
      'POST',
    );
    expect(batchRes.status).toBe(200);
    expect(batchRes.data.ok).toBe(true);
    expect(batchRes.data.deletedCount).toBe(2);

    expect((await request(`/api/projects/${p2.id}`)).status).toBe(404);
    expect((await request(`/api/projects/${p3.id}`)).status).toBe(404);
  });
});

describe('template tryout and clone version chain', () => {
  it('renders an unsaved template with product data without modifying the saved project', async () => {
    const p = await create();
    const draft = structuredClone(p.draft);
    draft.template = 'senseng-clean';
    draft.company.name = 'Unsaved preview company';
    draft.products = [{ id: 'preview-item', name: 'Preview item', description: 'Preview only', material: '', dimensions: '' }];
    const preview = await request(`/api/projects/${p.id}/preview`, { draft });
    expect(preview.status).toBe(200);
    expect(preview.data.html).toContain('Unsaved preview company');
    expect(preview.data.html).toContain('Preview item');
    const saved = (await get(p)).project;
    expect(saved).toEqual(p);
  });
  it('rejects foreign private assets in template previews', async () => {
    const p = await create();
    const draft = structuredClone(p.draft);
    draft.company.logoAssetId = 'foreign-asset';
    const preview = await request(`/api/projects/${p.id}/preview`, { draft });
    expect(preview.status).toBeGreaterThanOrEqual(400);
    expect((await get(p)).project.version).toBe(p.version);
  });
  it('generates then publishes the returned version, while rejecting a genuinely stale version', async () => {
    const p = await brandedClone();
    const generated = await request(`/api/projects/${p.id}/clone/generate`, {
      expectedVersion: p.version,
      cloneConfig: { targetUrl: 'https://example.com' },
    });
    expect(generated.status).toBe(200);
    expect(generated.data.project.version).toBe(p.version + 1);
    expect(generated.data.project.draft.cloneConfig.status).toBe('ready');
    const stale = await request(`/api/projects/${p.id}/publish`, { expectedVersion: p.version, requestId: crypto.randomUUID() });
    expect(stale.status).toBe(409);
    const body = { expectedVersion: generated.data.project.version, requestId: crypto.randomUUID() };
    const publish = await request(`/api/projects/${p.id}/publish`, body);
    expect(publish.status).toBe(200);
    expect(publish.data.job.inputVersion).toBe(generated.data.project.version);
    const retry = await request(`/api/projects/${p.id}/publish`, body);
    expect(retry.data.job.id).toBe(publish.data.job.id);
  });
});

it('serves clone catalog paths and keeps its independent documents through save and publish', async () => {
  const p = await brandedClone();
  const generated = await request(`/api/projects/${p.id}/clone/generate`, { expectedVersion: p.version, cloneConfig: { targetUrl: 'https://example.com', model: 'selected-model' } });
  const draft = generated.data.project.draft;
  expect(draft.cloneConfig.model).toBe('selected-model');
  expect(draft.cloneConfig.generation.mode).toBe('fixture');
  expect(draft.cloneConfig.artifact.pageCount).toBeGreaterThan(1);
  draft.cloneConfig.generatedFiles = { 'en/products/index.html': '<!DOCTYPE html><html><body><h1>Forged catalog</h1></body></html>' };
  const saved = await request(`/api/projects/${p.id}`, { expectedVersion: generated.data.project.version, draft }, owner, 'PUT');
  expect(saved.status).toBe(200);
  const published = await request(`/api/projects/${p.id}/publish`, { expectedVersion: saved.data.project.version, requestId: crypto.randomUUID() });
  expect(published.status).toBe(200);
  for (let i=0;i<3;i++) await service.tick();
  const page = await service.fetch(new Request(`http://localhost/public/sites/${p.id}/en/products/index.html`));
  expect(page.status).toBe(200);
  const html = await page.text();
  expect(html).not.toContain('Forged catalog');
  expect(html).toContain('<html');
});

it('keeps the last usable clone documents when regeneration fails', async () => {
  const p = await create();
  const generated = await request(`/api/projects/${p.id}/clone/generate`, { expectedVersion: p.version, cloneConfig: { targetUrl: 'https://example.com' } });
  const previous = generated.data.project;
  env.CLONE_TEST_FIXTURE = 'false';
  const failed = await request(`/api/projects/${p.id}/clone/generate`, { expectedVersion: previous.version, cloneConfig: { targetUrl: 'https://example.org', model: 'selected-model' } });
  expect(failed.status).toBe(503);
  expect(failed.data.code).toBe('clone_provider_missing');
  const saved = (await get(p)).project;
  expect(saved.draft.cloneConfig.status).toBe('error');
  expect(saved.draft.cloneConfig.generatedFiles).toEqual(previous.draft.cloneConfig.generatedFiles);
  expect(saved.draft.cloneConfig.generatedHtml).toBe(previous.draft.cloneConfig.generatedHtml);
  expect(saved.version).toBe(previous.version + 1);
});


describe('persistent clone tasks', () => {
  afterEach(() => vi.unstubAllGlobals());
  async function start(p: Project, autoPublish = false) {
    return request(`/api/projects/${p.id}/clone/start`, { expectedVersion: p.version, requestId: crypto.randomUUID(), autoPublish, cloneConfig: p.draft.cloneConfig || {} });
  }
  async function state(p: Project) { return (await request(`/api/projects/${p.id}/clone/task`)).data; }
  async function visionProject() {
    env.CLONE_TEST_FIXTURE = 'false'; env.OPENAI_API_KEY = 'test-only';
    const p = await brandedClone(); const asset: Asset = { id: 'reference', projectId: p.id, key: 'test-ref', filename: 'index.png', contentType: 'image/png', size: 9, origin: 'upload', createdAt: new Date().toISOString() };
    await service.store.insert('assets', asset).run(); await bucket.put(asset.key, new Uint8Array([137,80,78,71,13,10,26,10,0]));
    p.draft.cloneConfig = { uiImages: [{ id:'one',assetId:asset.id,name:'index.png',role:'home' }] };
    return p;
  }
  const response = () => Response.json({ choices: [{finish_reason:'stop',message:{content:JSON.stringify({css:'body{margin:0}',pages:{en:Object.fromEntries(['home','catalog','detail','about','contact'].map(k=>[k,'<main><h1>Reference page</h1><p>This is a sufficiently complete layout used for the asynchronous generation regression test.</p></main>']))}})}}] });
  it('persists queued state before returning, deduplicates submission and survives a new service instance', async () => {
    const p = await create(); const created = await start(p); expect(created.status).toBe(202);
    expect(created.data.job.status).toBe('queued');
    expect((await start(p)).data.job.id).toBe(created.data.job.id);
    service = new DomainService(env, {schedule:async()=>{}},providers);
    expect((await state(p)).job.id).toBe(created.data.job.id);
    await service.tick(); expect((await state(p)).job.status).toBe('succeeded');
    expect((await get(p)).project.draft.cloneConfig.artifact).toBeTruthy();
    expect((await get(p)).project.draft.cloneConfig.generatedHtml).toBeUndefined();
  });
  it('pauses before execution, stays paused across restart, and resumes without losing inputs', async () => {
    const p = await create(); const created = await start(p); const taskId = created.data.job.id;
    expect((await request(`/api/projects/${p.id}/clone/pause`,{taskId})).data.job.status).toBe('paused');
    service = new DomainService(env, {schedule:async()=>{}},providers); await service.tick();
    expect((await state(p)).job.status).toBe('paused');
    await request(`/api/projects/${p.id}/clone/resume`,{taskId}); await service.tick();
    expect((await state(p)).job.status).toBe('succeeded');
  });
  it('returns live progress during a pending model call and checkpoints a requested pause for no-cost resume', async () => {
    const p = await visionProject(); let release!: (r:Response)=>void;
    const fetcher = vi.fn(()=>new Promise<Response>(resolve=>{release=resolve}));vi.stubGlobal('fetch',fetcher);
    const created=await start(p);const taskId=created.data.job.id;const running=service.tick();
    await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
    const progress=await state(p);expect(progress.job.cloneProgress).toMatchObject({phase:'model',imagesRead:1,imageCount:1});
    const pause=await request(`/api/projects/${p.id}/clone/pause`,{taskId});expect(pause.data.job.cloneProgress.pauseRequested).toBe(true);
    release(response());await running;expect((await state(p)).job.status).toBe('paused');
    service=new DomainService(env,{schedule:async()=>{}},providers);
    await request(`/api/projects/${p.id}/clone/resume`,{taskId});await service.tick();
    expect((await state(p)).job.status).toBe('succeeded');expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('stops a running call, aborts its request and refuses late results or stale controls', async () => {
    const p=await visionProject();let release!:(r:Response)=>void;let signal!:AbortSignal;
    const fetcher=vi.fn((_url,options)=>{signal=options.signal;return new Promise<Response>(resolve=>{release=resolve})});vi.stubGlobal('fetch',fetcher);
    const created=await start(p);const taskId=created.data.job.id;const running=service.tick();
    await vi.waitFor(()=>expect(fetcher).toHaveBeenCalled());
    const stopped=await request(`/api/projects/${p.id}/clone/stop`,{taskId});expect(stopped.data.job.status).toBe('cancelled');expect(signal.aborted).toBe(true);
    release(response());await running;expect((await get(p)).project.draft.cloneConfig.generatedHtml).toBeUndefined();
    expect((await state(p)).job.status).toBe('cancelled');
    expect((await request(`/api/projects/${p.id}/jobs/${taskId}/retry`,{})).status).toBe(409);
    expect((await request(`/api/projects/${p.id}/clone/resume`,{taskId:'foreign'})).status).toBe(409);
    expect((await request(`/api/projects/${p.id}/clone/stop`,{taskId},{...owner,userId:'stranger'})).status).toBe(404);
  });
  it('does not permit draft saves to clobber active task state and auto-publishes with no client follow-up', async () => {
    const p=await brandedClone();const created=await start(p,true);
    expect((await request(`/api/projects/${p.id}`,{expectedVersion:created.data.project.version,draft:p.draft},owner,'PUT')).status).toBe(409);
    await service.tick();await service.tick();const result=await state(p);
    expect(result.job.status).toBe('succeeded');expect(result.publication.status).toBe('succeeded');
    expect(result.url).toBeTruthy();expect((await get(p)).jobs.filter((job:Job)=>job.kind==='publish')).toHaveLength(1);
  });
  it('publishes another project while a model response is pending without claiming the clone twice', async () => {
    const p=await visionProject(); const publicProject=await publishable();
    let release!:(r:Response)=>void;
    const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{release=resolve}));vi.stubGlobal('fetch',fetcher);
    await start(p);const generation=service.tick();
    await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
    const queued=await request(`/api/projects/${publicProject.id}/publish`,{expectedVersion:publicProject.version,requestId:crypto.randomUUID()});
    expect(queued.status).toBe(200);
    const secondTick=service.tick();
    await vi.waitFor(async()=>expect((await service.store.one<Job>('jobs',queued.data.job.id))?.status).toBe('succeeded'));
    expect((await state(p)).job.status).toBe('running');
    release(response());await Promise.all([generation,secondTick]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retains generated code and a private report but holds auto-publication when rendering detects issues', async () => {
    const p=await visionProject();env.SITE_BUILDER_URL='https://builder.example';env.SITE_BUILDER_KEY='test-key';
    vi.stubGlobal('fetch',async(url:string)=>url.includes('/v1/clone-quality') ? Response.json({status:'issues',sampledPages:4,widths:[390,1440,2560],records:['en/index.html','en/products/index.html','en/about/index.html','en/contact/index.html'].flatMap(path=>[390,1440,2560].map(width=>({path,width,issues:width===390?['页面横向溢出']:[],warnings:[]}))),screenshots:{}}) : response());
    await start(p,true);await service.tick();
    const result=await state(p);expect(result.job.status).toBe('succeeded');expect(result.publication).toBeUndefined();
    const detail=await get(p);expect(detail.project.draft.cloneConfig.artifact).toBeTruthy();
    expect(detail.project.draft.cloneConfig.generation.quality.status).toBe('issues');
    expect(detail.releases).toHaveLength(0);
    expect((await request(`/api/projects/${p.id}/clone/quality-report`)).data.status).toBe('issues');
    expect((await request(`/api/projects/${p.id}/clone/quality-report`,undefined,{...owner,userId:'stranger'})).status).toBe(404);
  });
  it('does not automatically repeat a possibly billed call after worker interruption', async () => {
    const p=await create();const created=await start(p);const job=await service.store.one<Job>('jobs',created.data.job.id);
    job!.status='running';await service.store.update('jobs',job!).run();
    service=new DomainService(env,{schedule:async()=>{}},providers);await service.tick();
    expect((await state(p)).job.status).toBe('failed');expect((await state(p)).job.error).toContain('未自动重复调用');
  });
});


describe('publication result consistency', () => {
  it('reuses the online content after a metadata-only save but publishes real content changes', async () => {
    let p = await publishable(); p.draft.buildBranch='template';
    p=(await request(`/api/projects/${p.id}`,{expectedVersion:p.version,draft:p.draft},owner,'PUT')).data.project;
    const publish = vi.fn(providers.publish); providers.publish = publish;
    const first = await request(`/api/projects/${p.id}/publish`, {expectedVersion:p.version,requestId:'first-content'});
    await service.tick();p=(await get(p)).project;
    // Activation advances project.version even though the page content is unchanged.
    const repeat=await request(`/api/projects/${p.id}/publish`,{expectedVersion:p.version,requestId:'second-click'});
    expect(repeat.data.job.id).toBe(first.data.job.id);expect((await get(p)).releases).toHaveLength(1);
    expect(publish).toHaveBeenCalledTimes(1);
    p.draft.company.name='Changed company';
    p=(await request(`/api/projects/${p.id}`,{expectedVersion:p.version,draft:p.draft},owner,'PUT')).data.project;
    const changed=await request(`/api/projects/${p.id}/publish`,{expectedVersion:p.version,requestId:'changed-content'});
    expect(changed.status,JSON.stringify(changed.data)).toBe(200);expect(changed.data.job.id).not.toBe(first.data.job.id);await service.tick();expect(publish).toHaveBeenCalledTimes(2);
  });
  it('clears a pending Cloudflare notice on successful activation and hides stale historical notices', async () => {
    const p=await publishable(); const original=providers.publish;
    providers.publish=vi.fn().mockRejectedValueOnce(new ProviderError('pages_deployment_pending','Cloudflare 发布仍在处理中',true)).mockImplementation(original);
    const first=await request(`/api/projects/${p.id}/publish`,{expectedVersion:p.version,requestId:'pending-success'});
    await service.tick();expect((await get(p)).releases[0].error).toContain('仍在处理中');
    await service.tick();const detail=await get(p);expect(detail.releases[0].status).toBe('succeeded');expect(detail.releases[0].error).toBeUndefined();
    const release=detail.releases[0];release.error='Old stale pending warning';await service.store.update('releases',release).run();
    expect((await get(p)).releases[0].error).toBeUndefined();
    expect(detail.jobs.find((j:Job)=>j.id===first.data.job.id).error).toBeUndefined();
  });
});


describe('bounded project queries', () => {
  it('uses only homepage designs for project covers and lets templates use their own homepage', async () => {
    const p=await create();
    p.draft.banner={assetId:'banner',alt:'',mode:'background',fit:'cover',position:'center'};
    p.draft.posterAssetId='video-poster';
    p.draft.products=[{id:'product',name:'Product',imageAssetId:'product-image'}] as any;
    p.draft.siteDesign={revision:1,pages:{home:{imageAssetId:'homepage'}}};
    const cover=async()=>{await service.store.update('projects',p).run();return (await request('/api/projects')).data.projects.find((x:any)=>x.id===p.id).coverAssetId;};
    p.draft.buildBranch='custom';expect(await cover()).toBe('homepage');
    p.draft.buildBranch='template';expect(await cover()).toBeNull();
    p.draft.buildBranch='clone';p.draft.cloneConfig={uiImages:[{id:'asset',assetId:'product-image',name:'product.png',role:'asset'},{id:'about',assetId:'about-page',name:'about.png',role:'about'},{id:'home',assetId:'clone-home',name:'index.png',role:'home'}]};
    expect(await cover()).toBe('clone-home');
    p.draft.cloneConfig.uiImages=p.draft.cloneConfig.uiImages!.filter(x=>x.role!=='home');expect(await cover()).toBeNull();
    delete p.draft.buildBranch;delete p.draft.cloneConfig;expect(await cover()).toBe('homepage');
    delete p.draft.siteDesign;expect(await cover()).toBeNull();
  });

  it('sorts summaries newest first, paginates, searches and excludes another owner', async () => {
    for (let i=0;i<5;i++) {
      const p=await create(); p.name=`Catalog ${i}`; p.updatedAt=`2026-09-${10+i}T00:00:00.000Z`;
      if(i===4) p.ownerId='another-owner';
      await service.store.update('projects',p).run();
      if(i===4) await env.DB.prepare('UPDATE projects SET owner_id=? WHERE id=?').bind(p.ownerId,p.id).run();
    }
    const first=(await request('/api/projects?pageSize=2')).data;
    expect(first.total).toBe(4);expect(first.projects.map((p:Project)=>p.name)).toEqual(['Catalog 3','Catalog 2']);
    expect(first.projects[0].draft).toBeUndefined();expect(first.projects[0].companyName).toBeDefined();
    const second=(await request('/api/projects?pageSize=2&page=2')).data;
    expect(second.projects.map((p:Project)=>p.name)).toEqual(['Catalog 1','Catalog 0']);
    expect((await request('/api/projects?search=Catalog%201')).data.total).toBe(1);
    expect((await request('/api/projects?pageSize=100000')).status).toBe(400);
  });
  it('bounds history snapshots while retaining old active jobs and the current release', async () => {
    const p=await create();
    for(let i=0;i<25;i++) await service.store.insert('jobs',{id:`history-${i}`,projectId:p.id,userId:owner.userId,kind:'copy',requestId:`request-${i}`,inputVersion:p.version,testMode:true,status:i===0?'unknown':'succeeded',createdAt:`2026-08-${String(i+1).padStart(2,'0')}T00:00:00Z`,updatedAt:p.updatedAt,input:{draft:p.draft,principal:owner,pageId:'home'},attempts:1} as Job).run();
    const detail=await get(p);
    expect(detail.history.jobsTotal).toBe(25);expect(detail.jobs).toHaveLength(21);
    expect(detail.jobs.some((j:Job)=>j.id==='history-0')).toBe(true);
    expect(detail.jobs[0].input.draft).toBeUndefined();expect(detail.jobs[0].input.principal).toBeUndefined();
    const page=(await request(`/api/projects/${p.id}/history?kind=jobs&page=2`)).data;
    expect(page.records).toHaveLength(5);expect(page.hasMore).toBe(false);
    expect((await request(`/api/projects/${p.id}/history?kind=jobs`,undefined,{...owner,userId:'other'})).status).toBe(404);
  });
});

it('exposes bounded operational aggregates only to platform administrators', async () => {
  expect((await request('/api/admin/metrics')).status).toBe(403);
  const metrics=await request('/api/admin/metrics',undefined,platform);
  expect(metrics.status).toBe(200);expect(metrics.data.jobs).toEqual([]);expect(metrics.data.attempts).toEqual([]);
});

it('freezes the selected Resend account when an inquiry is queued, across default changes and retries', async () => {
  env.ASSET_SIGNING_KEY = 'test-only-credential-encryption-key';
  const { ProviderSettings } = await import('../src/worker/provider-settings');
  const settings = new ProviderSettings(env);
  const first = await settings.add({kind:'resend',label:'First',apiKey:'re_first_mock_key',mailFrom:'first@example.com'},'global');
  const second = await settings.add({kind:'resend',label:'Second',apiKey:'re_second_mock_key',mailFrom:'second@example.com'},'global');
  await settings.setDefault(first.id);
  const p = await publishNow(await publishable());
  const result = await request(`/api/public/sites/${p.id}/inquiries`, {requestId:'pinned-mail-account',name:'Buyer',email:'buyer@example.net',company:'',message:'Hello'});
  expect(result.status).toBe(200);
  await settings.setDefault(second.id);
  await settings.selectEmail(p.id,second.id);
  const send = vi.spyOn(settings.constructor.prototype,'email').mockResolvedValue({id:'mock-sent',testMode:false});
  try {
    await service.tick();
    expect(send).toHaveBeenCalledWith(first.id,expect.objectContaining({id:result.data.id}),'sales@example.com',expect.any(String));
    const job=(await get(p)).jobs.find((j:Job)=>j.kind==='email');
    expect(job.input.resendAccountId).toBe(first.id);
  } finally {send.mockRestore();}
});

it('enforces the complete role boundary on banner edits, SEO, private assets and credentials', async () => {
  const project = await create();
  const image = await uploadAsset(project);
  const banner = {assetId:image.id,alt:'Product display',mode:'background',fit:'cover',position:'center'};
  const member = {...owner,userId:'another-member'};
  const outsider = {...admin,userId:'outside-admin',workspaceId:'other-workspace'};
  for (const principal of [member, outsider]) {
    for (const suffix of ['', '/seo', `/assets/${image.id}`, '/connections', '/history'])
      expect((await request(`/api/projects/${project.id}${suffix}`,undefined,principal)).status).toBe(404);
    expect((await request(`/api/projects/${project.id}`, {expectedVersion:project.version,draft:{...project.draft,banner}}, principal,'PUT')).status).toBe(404);
  }
  for (const principal of [owner,admin,member,outsider])
    expect((await request('/api/admin/provider-accounts',undefined,principal)).status).toBe(403);
  expect((await request('/api/admin/provider-accounts',undefined,platform)).status).toBe(200);
  let current = project;
  for (const principal of [owner,admin,platform]) {
    const response = await request(`/api/projects/${project.id}`,{expectedVersion:current.version,draft:{...current.draft,banner}},principal,'PUT');
    expect(response.status).toBe(200);current=response.data.project;
  }
  const other = await create();
  const foreign = await uploadAsset(other);
  expect((await request(`/api/projects/${project.id}`,{expectedVersion:current.version,draft:{...current.draft,banner:{...banner,assetId:foreign.id}}},owner,'PUT')).status).toBe(404);
  const video = await uploadAsset(project,'video/mp4');
  expect((await request(`/api/projects/${project.id}`,{expectedVersion:current.version,draft:{...current.draft,banner:{...banner,assetId:video.id}}},owner,'PUT')).status).toBe(400);
});

it('refreshes SEO after a domain change once and retains publication idempotency', async () => {
  let project = await publishable();
  project = (await request(`/api/projects/${project.id}`,{expectedVersion:project.version,draft:{...project.draft,buildBranch:'template'}},owner,'PUT')).data.project;
  const start = async () => request(`/api/projects/${project.id}/publish`, {requestId:crypto.randomUUID(),expectedVersion:(await get(project)).project.version});
  const first = await start();expect(first.status).toBe(200);
  await service.tick();
  const firstDetail=await get(project);
  expect(firstDetail.releases[0].seo.policyVersion).toBe(2);
  expect((await request(`/api/projects/${project.id}/seo`)).data.needsPublish).toBe(false);
  await env.DB.prepare("INSERT INTO provider_accounts(id,kind,scope,label,secret,created_at) VALUES('env','cloudflare','environment','Env','','now')").run();
  await env.DB.prepare("INSERT INTO project_domains(hostname,project_id,credential_id,zone_id,zone_name,status,created_at) VALUES('shop.example',?,'env','zone','example','active','now')").bind(project.id).run();
  const audit=await request(`/api/projects/${project.id}/seo`);
  expect(audit.status).toBe(200);expect(audit.data.needsPublish).toBe(true);expect(audit.data.origin).toBe('https://shop.example');
  const second=await start();expect(second.status).toBe(200);expect(second.data.job.id).not.toBe(first.data.job.id);
  await service.tick();
  expect((await request(`/api/projects/${project.id}/seo`)).data.needsPublish).toBe(false);
  const again=await start();expect(again.data.job.id).toBe(second.data.job.id);
});

it('accepts scoped background video but rejects foreign videos and conflicting image uses', async () => {
  const project=await create(),other=await create();
  const video=await uploadAsset(project,'video/mp4'),foreign=await uploadAsset(other,'video/mp4'),image=await uploadAsset(project);
  const base={id:'hero',targets:['home','contact'],kind:'video',slides:[],videoAssetId:video.id,posterAssetId:image.id,mode:'background',fit:'cover',position:'center',contrast:'dark',height:'screen',autoplay:true,interval:5};
  const save=(draft:unknown)=>request(`/api/projects/${project.id}`,{expectedVersion:project.version,draft},owner,'PUT');
  expect((await save({...project.draft,banners:[{...base,videoAssetId:foreign.id}]})).status).toBe(404);
  expect((await save({...project.draft,banners:[{...base,videoAssetId:image.id}]})).status).toBe(400);
  expect((await save({...project.draft,banners:[base],company:{...project.draft.company,logoAssetId:video.id}})).status).toBe(400);
  expect((await save({...project.draft,banners:[base]})).status).toBe(200);
});

it('saves imported product-set projects without dropping source facts or media',async()=>{
 sourceState.factsOrigin='product-set';
 const p=await create();
 const imported=await request(`/api/projects/${p.id}/import`,{expectedVersion:p.version,productIds:['set-1','set-2','set-3','set-4','set-5']});
 expect(imported.status).toBe(200);
 const original=imported.data.project;
 const draft=structuredClone(original.draft);draft.company.name='Updated brand';
 const saved=await request(`/api/projects/${p.id}`,{expectedVersion:original.version,draft},owner,'PUT');
 expect(saved.status).toBe(200);
 expect(saved.data.project.draft.products).toEqual(original.draft.products);
 expect(saved.data.project.draft.products.every((p:any)=>p.source.factsOrigin==='product-set'&&p.imageAssetId)).toBe(true);
 const tampered=structuredClone(saved.data.project.draft);tampered.products[0].source.factsOrigin='generated-concept';
 const edited=await request(`/api/projects/${p.id}`,{expectedVersion:saved.data.project.version,draft:tampered},owner,'PUT');
 expect(edited.status).toBe(200);expect(edited.data.project.draft.products[0].source.factsOrigin).toBe('product-set');
 expect((await get(p)).project.draft.company.name).toBe('Updated brand');
});


describe('persisted website creation modes', () => {
  it.each(['template','clone','custom'])('persists explicitly requested %s mode through create and reload', async mode => {
    const result = await request('/api/projects', { name: 'Mode regression', requestId: crypto.randomUUID(), buildBranch: mode });
    expect(result.status).toBe(200);
    expect(result.data.project.draft.buildBranch).toBe(mode);
    expect((await get(result.data.project)).project.draft.buildBranch).toBe(mode);
  });
  it('switches modes without deleting company details, products or clone input', async () => {
    const created = await request('/api/projects', { name: 'Switch regression', requestId: crypto.randomUUID(), buildBranch: 'clone', targetUrl: 'https://example.com' });
    let p = created.data.project as Project;
    p.draft.company.name = 'Retained brand';
    p.draft.cloneConfig!.instructions = 'Keep original first screen';
    p.draft.products = [{ id:'p1', name:'Retained product', description:'Real facts', material:'', dimensions:'' }];
    p.draft.primaryProductId = 'p1';
    for (const mode of ['template','clone'] as const) {
      const result = await request(`/api/projects/${p.id}`, { expectedVersion:p.version, draft:{...p.draft,buildBranch:mode} }, owner, 'PUT');
      expect(result.status).toBe(200);
      p = result.data.project;
      expect(p.draft.buildBranch).toBe(mode);
      expect(p.draft.company.name).toBe('Retained brand');
      expect(p.draft.products[0].name).toBe('Retained product');
      expect(p.draft.cloneConfig?.targetUrl).toBe('https://example.com');
      expect(p.draft.cloneConfig?.instructions).toBe('Keep original first screen');
    }
  });
  it('rejects mode changes while a server generation task is pending', async () => {
    let p = (await request('/api/projects', { name:'Busy mode', requestId:crypto.randomUUID(), buildBranch:'template' })).data.project as Project;
    p.draft.products = [{id:'p1',name:'Product',description:'Facts',material:'',dimensions:''}];
    p.draft.primaryProductId = 'p1';
    p = (await request(`/api/projects/${p.id}`,{expectedVersion:p.version,draft:p.draft},owner,'PUT')).data.project;
    const queued = await request(`/api/projects/${p.id}/jobs`,{expectedVersion:p.version,requestId:crypto.randomUUID(),kind:'script'});
    expect(queued.status).toBe(200);
    p = (await get(p)).project;
    const result = await request(`/api/projects/${p.id}`,{expectedVersion:p.version,draft:{...p.draft,buildBranch:'clone'}},owner,'PUT');
    expect(result.status).toBe(409);
    expect(result.data.code).toBe('mode_change_task_active');
    expect((await get(p)).project.draft.buildBranch).toBe('template');
  });
});

describe('product set gallery storage',()=>{
  it('imports original and selected images with copy into one project transaction',async()=>{
    sourceState.gallery=true;
    const p=await create();
    const response=await request(`/api/projects/${p.id}/import`,{expectedVersion:p.version,productIds:['saved-set']});
    expect(response.status).toBe(200);
    const product=response.data.project.draft.products[0];
    expect(product).toMatchObject({tagline:'A useful product',sellingPoints:['One','Two','Three'],applications:['Daily use'],source:{workflow:'upload',factsOrigin:'product-set'}});
    expect(product.gallery.map((image:any)=>image.sourceImageId)).toEqual(['original','detail','scene']);
    expect(product.imageAssetId).toBe(product.gallery[0].assetId);
    const oldClientDraft=structuredClone(response.data.project.draft);
    delete oldClientDraft.products[0].gallery;
    delete oldClientDraft.products[0].tagline;
    delete oldClientDraft.products[0].sellingPoints;
    delete oldClientDraft.products[0].applications;
    const saved=await request(`/api/projects/${p.id}`,{expectedVersion:response.data.project.version,draft:oldClientDraft},owner,'PUT');
    expect(saved.status).toBe(200);
    expect(saved.data.project.draft.products[0].gallery).toEqual(product.gallery);
    expect((await get(p)).assets).toHaveLength(3);
  });
  it('removes partial gallery objects and leaves draft unchanged if any image version fails',async()=>{
    sourceState.gallery=true;
    sourceState.failImage='detail';
    const p=await create();
    const response=await request(`/api/projects/${p.id}/import`,{expectedVersion:p.version,productIds:['saved-set']});
    expect(response.status).toBe(409);
    expect((await get(p)).project.draft.products).toEqual([]);
    expect((await get(p)).assets).toHaveLength(0);
    expect(bucket.objects.size).toBe(0);
    expect(sourceState.imageRequests).toEqual(['original','detail']);
  });
});
