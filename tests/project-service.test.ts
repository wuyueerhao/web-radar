import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createIntegrationApp } from '../src/worker/integration';
import { DomainService } from '../src/worker/domain-service';
import { DomainStore } from '../src/worker/domain-store';
import { fixtureProviders } from '../src/worker/providers/fixtures';
import { ProviderError } from '../src/worker/provider-contract';
import { materialsFixture, materialsPng } from './fixtures/materials';
import { testDb } from './helpers/db';
import { listProjectSummaries } from '../src/worker/project-queries';
import { typedMaterialsFixture } from './fixtures/materials-typed';
import { draftFromMaterials } from '../src/worker/materials-service';
import { templateMediaRequirements } from '../src/shared/template-media';
import { frozenMaterialsPreviewRuntime } from '../src/templates/releases/baseline-preview-20260922';
import type { AppEnv } from '../src/worker/env';
import type { Asset, Job, Principal, Project, PublicMediaManifest, Release } from '../src/shared/model';

// Exercise the actual service boundary, durable receiver, renderer and publication queue.
describe('Product Radar private project service', () => {
  let env: AppEnv, domain: DomainService, store: DomainStore;
  let fixture: Awaited<ReturnType<typeof materialsFixture>>, current: Principal, revoked: boolean;
  let providers: ReturnType<typeof fixtureProviders>;
  const app = createIntegrationApp();
  const secret = 's'.repeat(40);
  const objects = new Map<string, { bytes: Uint8Array; options: any }>();
  beforeEach(async () => {
    fixture = await materialsFixture(2); fixture.principal.email='member@example.com'; current = structuredClone(fixture.principal); revoked = false; objects.clear();
    const db = testDb();
    for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql') && !f.startsWith('0001')).sort()) await db.exec(readFileSync('migrations/' + file, 'utf8'));
    const bucket = {
      async put(key: string, value: any, options: any) { objects.set(key, { bytes: new Uint8Array(await new Response(value).arrayBuffer()), options }); },
      async get(key: string) { const o = objects.get(key); return o ? { size: o.bytes.length, body: new Response(o.bytes.slice()).body, httpMetadata: o.options?.httpMetadata, customMetadata: o.options?.customMetadata, arrayBuffer: async () => o.bytes.slice().buffer, text: async () => new TextDecoder().decode(o.bytes) } : null; },
      async head(key: string) { return this.get(key); },
      async delete(keys: string | string[]) { for (const key of typeof keys === 'string' ? [keys] : keys) objects.delete(key); },
    };
    env = { DB: db, MEDIA: bucket, ENVIRONMENT: 'test', TEST_PROVIDERS: 'true', APP_ORIGIN: 'http://127.0.0.1:8788', PRODUCT_RADAR_BASE_URL: 'https://product.example.com', PRODUCT_RADAR_PARENT_ORIGINS: fixture.parentOrigin, PRODUCT_RADAR_INTEGRATION_SECRET: secret } as unknown as AppEnv;
    providers = fixtureProviders(env);
    vi.spyOn(providers, 'publish'); vi.spyOn(providers, 'resolveHostingTarget');
    domain = new DomainService(env, { schedule: async () => {} }, providers); store = new DomainStore(db);
    env.COORDINATOR = { getByName: () => ({ fetch: (request: Request) => domain.fetch(request) }) } as unknown as AppEnv['COORDINATOR'];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/context') ? revoked ? Response.json({}, { status: 403 }) : Response.json({ protocolVersion: 1, principal: current }) : new Response(materialsPng, { headers: { 'content-type': 'image/png' } })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const post = (path: string, body: object = {}, key = secret) => app.request('http://127.0.0.1:8788' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Web-Radar-Secret': key }, body: JSON.stringify({ principal: { userId: current.userId, workspaceId: current.workspaceId }, ...body }) }, env);
  const call = (id: string, action: string, body = {}) => post(`/projects/${id}/${action}`, body);
  const accepted = async () => {
    expect((await post('/materials-submissions', fixture)).status).toBe(202);
    await domain.tick();
    const receipt: any = await (await post(`/materials-submissions/${fixture.submissionId}/status`, { principal: fixture.principal })).json();
    expect(receipt).toMatchObject({ state: 'accepted', autoPublish: false, nextAction: 'open-web-radar' });
    return (await store.one<Project>('projects', receipt.projectId))!;
  };
  const largeProject = async () => {
    const p = await accepted(), input = await typedMaterialsFixture('senseng-candy', 18);
    const materials = input.materials;
    for (let i = 0; materials.media.length < 110; i++) {
      const product = materials.products[i % materials.products.length], id = `extra-gallery-${i}`;
      const bytes = Buffer.concat([materialsPng, Buffer.from(id)]);
      materials.media.push({ ...materials.media[0], id, bytes: bytes.length, sha256: Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex') });
      materials.imageBindings.push({ ...materials.imageBindings.find(b => b.slotId === 'product-gallery' && b.productId === product.id)!, mediaId: id, itemIndex: product.galleryMediaIds.length });
      product.galleryMediaIds.push(id);
    }
    const assets: Record<string, Asset> = {};
    for (const media of materials.media) {
      const asset: Asset = { id: 'large-' + media.id, projectId: p.id, key: 'large/' + media.id, sha256: media.sha256,
        contentType: media.mimeType, size: media.bytes, filename: media.id, origin: 'import', createdAt: new Date().toISOString() };
      assets[media.id] = asset;
      await store.insert('assets', asset).run();
      objects.set(asset.key, { bytes: Uint8Array.from(Buffer.concat([materialsPng, Buffer.from(media.id)])), options: { httpMetadata: { contentType: media.mimeType } } });
    }
    p.draft = draftFromMaterials(input, assets);
    await store.update('projects', p).run();
    return { p, assets: Object.values(assets) };
  };
  it('queues 110 materials within the caller budget despite storage latency and deduplicates replay', async () => {
    const { p, assets } = await largeProject(); expect(assets).toHaveLength(110);
    vi.useFakeTimers();
    const pause = () => new Promise(resolve => setTimeout(resolve, 250));
    const prepare = env.DB.prepare.bind(env.DB); let assetReads = 0;
    const delayed = (statement: D1PreparedStatement): D1PreparedStatement => new Proxy(statement, {
      get(target, key) {
        if (key === 'bind') return (...args: unknown[]) => delayed(target.bind(...args));
        if (key === 'first' || key === 'all') return async (...args: unknown[]) => {
          assetReads++; await pause(); return Reflect.apply(target[key], target, args);
        };
        return Reflect.get(target, key);
      },
    });
    vi.spyOn(env.DB, 'prepare').mockImplementation(sql => /SELECT data FROM assets\b/.test(sql) ? delayed(prepare(sql)) : prepare(sql));
    const head = env.MEDIA.head.bind(env.MEDIA); let active = 0, peak = 0;
    const heads = vi.spyOn(env.MEDIA, 'head').mockImplementation(async key => {
      active++; peak = Math.max(peak, active);
      try { await pause(); return await head(key); } finally { active--; }
    });
    const body = { requestId: crypto.randomUUID(), expectedVersion: p.version }, started = Date.now();
    const pending = call(p.id, 'publish', body);
    // Authentication uses native Web Crypto before the first simulated storage request.
    await vi.waitUntil(() => vi.getTimerCount() > 0);
    await vi.runAllTimersAsync(); const response = await pending;
    expect(response.status).toBe(200);
    const first: any = await response.json(); expect(first.publication.status).toBe('queued');
    const elapsedMs = Date.now() - started;
    expect(elapsedMs, `enqueue took ${elapsedMs} ms with ${assetReads} asset reads`).toBeLessThan(10_000);
    expect(assetReads).toBe(1); expect(heads).toHaveBeenCalledTimes(110);
    expect(peak).toBeGreaterThan(1); expect(peak).toBeLessThanOrEqual(4);
    const replay: any = await (await call(p.id, 'publish', body)).json();
    expect(replay.publication.jobId).toBe(first.publication.jobId);
    expect(await store.list('jobs')).toHaveLength(1); expect(await store.list('releases')).toHaveLength(1);
    expect(assetReads).toBe(1); expect(heads).toHaveBeenCalledTimes(110); expect(providers.publish).not.toHaveBeenCalled();
  });
  it.each(['missing-record', 'foreign-project', 'wrong-type', 'missing-object'] as const)('rejects %s among 110 materials before creating a publication', async failure => {
    const { p, assets } = await largeProject(), asset = assets.at(-1)!;
    if (failure === 'missing-record') await store.delete('assets', asset.id).run();
    if (failure === 'foreign-project') {
      const foreign = { ...p, id: crypto.randomUUID() }; await store.insert('projects', foreign).run();
      await store.delete('assets', asset.id).run(); await store.insert('assets', { ...asset, projectId: foreign.id }).run();
    }
    if (failure === 'wrong-type') await store.update('assets', { ...asset, contentType: 'video/mp4' }).run();
    if (failure === 'missing-object') objects.delete(asset.key);
    const response = await call(p.id, 'publish', { requestId: crypto.randomUUID(), expectedVersion: p.version });
    expect(response.status).toBe(failure === 'wrong-type' ? 400 : failure === 'missing-object' ? 409 : 404);
    expect(await response.json()).toMatchObject({ code: failure === 'wrong-type' ? 'materials_asset_type' : failure === 'missing-object' ? 'asset_unavailable' : 'asset_not_found' });
    expect(await store.list('jobs')).toHaveLength(0); expect(await store.list('releases')).toHaveLength(0);
    expect(providers.publish).not.toHaveBeenCalled(); expect(providers.resolveHostingTarget).not.toHaveBeenCalled();
  });
  it('renders confirmed pages with authenticated media and navigation without generation or publication', async () => {
    fixture.principal.workspaceRole='member';current.workspaceRole='member';
    const project = await accepted();
    const state = await call(project.id, 'status'); expect(state.status).toBe(200);
    expect(await state.json()).toMatchObject({ schemaVersion: 'wr-project-service-v1', projectVersion: 1, languages: ['en'], products: [{ id: 'p0' }, { id: 'p1' }], publication: { status: 'idle' } });
    const base = `/api/web-radar/projects/${project.id}`;
    for (const page of ['home', 'catalog', 'detail', 'about', 'contact']) {
      const response = await call(project.id, 'preview', { page, productId: 'p1', expectedVersion: 1, proxyBasePath: base }); expect(response.status).toBe(200);
      const data: any = await response.json();
      expect(data.html).toContain('True Brand'); expect(data.html).toContain('noindex');
      expect(data.html).not.toContain(`/api/projects/${project.id}/assets/`);
      expect(data.html).toContain(base + '/preview?');
      if (page === 'detail') expect(data.html).toContain('Actual toy 1');
      if (page === 'contact') expect(data.html).toContain(' disabled');
    }
    const id = project.draft.products[0].imageAssetId!;
    const asset = await call(project.id, 'assets/' + id); expect(asset.status).toBe(200); expect(asset.headers.get('Cache-Control')).toBe('no-store'); expect(new Uint8Array(await asset.arrayBuffer())).toEqual(materialsPng);
    expect(await store.list('jobs')).toHaveLength(0); expect(await store.list('releases')).toHaveLength(0); expect(providers.publish).not.toHaveBeenCalled(); expect(providers.resolveHostingTarget).not.toHaveBeenCalled();
  });
  it('avoids a redundant context round trip while measuring private preview phases', async () => {
    const p = await accepted(); vi.mocked(fetch).mockClear();
    const response = await call(p.id, 'preview'); expect(response.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/context'))).toHaveLength(2);
    expect(response.headers.get('Server-Timing')).toMatch(/wr-auth;dur=[\d.]+/);
    expect(response.headers.get('Server-Timing')).toMatch(/wr-coordinator;dur=[\d.]+/);
    expect(response.headers.get('Server-Timing')).toMatch(/wr-render;dur=[\d.]+/);
    expect(response.headers.get('Server-Timing')).toMatch(/wr-html;dur=[\d.]+/);
  });
  it('returns a fixed trusted runtime independent of customer content or page scripts', async () => {
    const p = await accepted();
    const first: any = await (await call(p.id, 'preview')).json();
    p.draft.company.name = 'CUSTOMER_CODE_MUST_NOT_ENTER_RUNTIME';
    await store.update('projects', p).run();
    const second: any = await (await call(p.id, 'preview', { page: 'detail' })).json();
    expect(first.runtime).toBe(frozenMaterialsPreviewRuntime);
    expect(first.runtime).toBe(second.runtime); expect(second.runtime).not.toContain(p.draft.company.name);
    expect(first.runtime).toContain('const __name='); expect(first.runtime).toContain('data-wr-banner');
    expect(first.runtime).not.toContain('<script'); expect(first.runtime).not.toContain(secret);
    expect(() => new Function(first.runtime)).not.toThrow();
  });
  it('rejects stale versions, unknown page/product/language and unsafe proxy prefixes', async () => {
    const p = await accepted();
    for (const body of [{ page: 'missing' }, { lang: 'de' }, { productId: 'foreign' }, { proxyBasePath: '//evil.test' }, { proxyBasePath: '/api/../admin' }]) expect((await call(p.id, 'preview', body)).status).toBe(400);
    expect((await call(p.id, 'preview', { expectedVersion: 2 })).status).toBe(409);
    expect((await call(p.id, 'publish', { requestId: crypto.randomUUID(), expectedVersion: 2 })).status).toBe(409);
  });
  it('refreshes roles for every surface and enforces ownership and current workspace', async () => {
    const p = await accepted(), asset = p.draft.products[0].imageAssetId!;
    const actions: [string, object][] = [['status', {}], ['preview', {}], ['assets/' + asset, {}], ['publication-status', {}], ['publish', { requestId: crypto.randomUUID(), expectedVersion: p.version }]];
    const check = async (status: number) => { for (const [action, body] of actions) expect((await call(p.id, action, body)).status, action).toBe(status); };
    await check(200); // queues publication; all later denial paths must remain side-effect free
    current.workspaceId = 'other-workspace'; await check(404);
    current.systemRole = 'super_admin'; expect((await call(p.id, 'status')).status).toBe(200);
    current.systemRole = 'user'; current.workspaceId = p.workspaceId; current.userId = 'company-admin'; current.workspaceRole = 'admin'; expect((await call(p.id, 'status')).status).toBe(200);
    current.workspaceRole = 'member'; await check(404);
    current.userId = p.ownerId; current.email = 'changed@example.com'; await check(200);
    current.email = fixture.principal.email; revoked = true; await check(403);
    expect(providers.publish).not.toHaveBeenCalled();
    expect((await post(`/projects/${p.id}/status`, {}, 'wrong')).status).toBe(401);
  });
  it('scopes project lists to the current company even when the same user owns both', async () => {
    const p = await accepted();
    const foreign = { ...p, id: crypto.randomUUID(), workspaceId: 'another-company' }; await store.insert('projects', foreign).run();
    const list = (principal: Principal) => listProjectSummaries(env.DB, principal, new URL('https://wr.invalid/api/projects'));
    expect((await list(current)).projects.map(p => p.id)).toEqual([p.id]);
    expect((await list({ ...current, workspaceRole: 'member' })).projects.map(p => p.id)).toEqual([p.id]);
    expect((await list({ ...current, userId: 'colleague', workspaceRole: 'member' })).total).toBe(0);
    expect((await list({ ...current, userId: 'company-admin' })).total).toBe(1);
    expect((await list({ ...current, systemRole: 'super_admin' })).total).toBe(2);
  });
  it('rechecks refreshed role at the legacy project, asset and deletion boundaries', async () => {
    const p = await accepted();
    const stale = { ...current, userId: 'company-admin', workspaceRole: 'admin' as const };
    current = { ...stale, workspaceRole: 'member' };
    const request = (suffix = '', method = 'GET') => domain.fetch(new Request(`https://coordinator.internal/api/projects/${p.id}${suffix}`, { method, headers: { 'X-WR-Principal': encodeURIComponent(JSON.stringify(stale)) } }));
    expect((await request()).status).toBe(404);
    expect((await request('/assets/' + p.draft.products[0].imageAssetId)).status).toBe(404);
    expect((await request('', 'DELETE')).status).toBe(404);
    expect(await store.one('projects', p.id)).toBeTruthy();
  });
  it.each(Object.keys(templateMediaRequirements))('preserves media and navigation hooks for current %s materials', async template => {
    const p = await accepted(), input = await typedMaterialsFixture(template, 2);
    p.draft = draftFromMaterials(input, Object.fromEntries(input.materials.media.map(m => [m.id, { id: 'stored-' + m.id } as any])));
    if (template.startsWith('single-')) p.draft.primaryProductId='p1';
    await store.update('projects', p).run();
    for (const page of ['home', 'catalog', 'detail', 'about', 'contact']) {
      const response = await call(p.id, 'preview', { page, productId: 'p1' }); expect(response.status).toBe(200);
      const { html } = await response.json() as any;
      expect(html).toContain('data-wr-page='); expect(html).toContain(`/api/web-radar/projects/${p.id}/preview?`);
      expect(html).not.toContain('/api/projects/');
      expect(html).not.toMatch(/(?:src|poster|srcset)=["']\/templates\//);
      if (page === 'detail') expect(html).toContain(`/api/web-radar/projects/${p.id}/assets/stored-m1`);
    }
    expect(await store.list('jobs')).toHaveLength(0);
  });
  it('does not accept claimed roles and rejects foreign assets and jobs', async () => {
    const p = await accepted(); current.userId = 'other-member'; current.workspaceRole = 'member';
    expect((await call(p.id, 'status', { principal: { ...current, systemRole: 'super_admin', workspaceRole: 'admin' } })).status).toBe(404);
    current = structuredClone(fixture.principal);
    expect((await call(p.id, 'assets/foreign')).status).toBe(404);
    expect((await call(p.id, 'publication-status', { jobId: crypto.randomUUID() })).status).toBe(404);
  });
  it('publishes explicitly, deduplicates replay and returns a sanitized terminal URL', async () => {
    const p = await accepted(), body = { requestId: crypto.randomUUID(), expectedVersion: p.version };
    const first: any = await (await call(p.id, 'publish', body)).json();
    expect(first.publication.status).toBe('queued');
    const replay: any = await (await call(p.id, 'publish', body)).json(); expect(replay.publication.jobId).toBe(first.publication.jobId);
    await domain.tick();
    const done: any = await (await call(p.id, 'publication-status', { jobId: first.publication.jobId })).json(); expect(done.publication).toMatchObject({ status: 'succeeded', phase: 'complete' }); expect(done.publication.url).toBeTruthy(); expect(done.projectVersion).toBeGreaterThan(p.version); expect(done.publishedUrl).toBe(done.publication.url);
    expect(JSON.stringify(done)).not.toMatch(/"draft"|"principal"|"hostingTarget"/); expect(providers.publish).toHaveBeenCalledTimes(1);
    expect((await call(p.id, 'publish', body)).status).toBe(200); expect(await store.list('jobs')).toHaveLength(1);
    expect((await call(p.id, 'publish', { ...body, expectedVersion: 999 })).status).toBe(409);
  });
  it('distinguishes content changes from publication record versions using the active release', async () => {
    const p = await accepted(), body = { requestId: crypto.randomUUID(), expectedVersion: p.version };
    const draft: any = await (await call(p.id, 'status')).json();
    expect(draft.hasUnpublishedChanges).toBe(true); expect(draft.publishedVersion).toBeUndefined();
    await call(p.id, 'publish', body); await domain.tick();
    for (const [action, request] of [['status', {}], ['publication-status', {}], ['publish', body]] as const) {
      const state: any = await (await call(p.id, action, request)).json();
      expect(state).toMatchObject({ projectVersion: 2, publishedVersion: 1, hasUnpublishedChanges: false });
    }
    const current = (await store.one<Project>('projects', p.id))!;
    const active = (await store.one<Release>('releases', current.publishedReleaseId!))!;
    const previousJob = (await store.list<Job>('jobs'))[0];
    const failed = { ...active, id: crypto.randomUUID(), status: 'failed' as const, draft: structuredClone(active.draft) };
    failed.draft.company.description = 'A newer failed publication';
    await store.insert('releases', failed).run();
    await store.insert('jobs', { ...previousJob, id: crypto.randomUUID(), status: 'failed', input: { ...previousJob.input, releaseId: failed.id }, createdAt: '2099-01-01T00:00:00Z' }).run();
    expect(await (await call(p.id, 'status')).json()).toMatchObject({ publishedVersion: 1, hasUnpublishedChanges: false, publication: { status: 'failed' } });
    current.draft.company.description = 'A real draft edit'; current.version++;
    await store.update('projects', current).run();
    expect(await (await call(p.id, 'status')).json()).toMatchObject({ projectVersion: 3, publishedVersion: 1, hasUnpublishedChanges: true });
  });
  const publishedProject = async () => {
    const p = await accepted();
    await call(p.id, 'publish', { requestId: crypto.randomUUID(), expectedVersion: p.version }); await domain.tick();
    const current = (await store.one<Project>('projects', p.id))!;
    return { current, active: (await store.one<Release>('releases', current.publishedReleaseId!))! };
  };
  it('refreshes only the confirmed publication, preserving unconfirmed edits and prepared media', async () => {
    const { current, active } = await publishedProject();
    active.publicMedia = { policy: 'webp82-v1', ready: true, assets: {} }; await store.update('releases', active).run();
    current.draft.company.description = 'UNCONFIRMED EDIT MUST STAY PRIVATE'; current.version++;
    await store.update('projects', current).run(); const savedDraft = structuredClone(current.draft);
    const body = { requestId: crypto.randomUUID(), expectedVersion: current.version, expectedPublishedReleaseId: active.id };
    const response = await call(current.id, 'refresh-publication', body); expect(response.status).toBe(200);
    const queued: any = await response.json();
    const release = (await store.one<Release>('releases', queued.publication.releaseId))!;
    expect(release.draft).toEqual(active.draft); expect(release.draftVersion).toBe(active.draftVersion); expect(release.publicMedia).toEqual(active.publicMedia);
    expect((await store.one<Project>('projects', current.id))!.draft).toEqual(savedDraft);
    await domain.tick();
    const final = (await store.one<Project>('projects', current.id))!;
    expect(final.draft).toEqual(savedDraft); expect(final.publishedReleaseId).toBe(release.id);
    expect(await (await call(current.id, 'status')).json()).toMatchObject({ publishedVersion: 1, hasUnpublishedChanges: true, publication: { status: 'succeeded' } });
    const replay: any = await (await call(current.id, 'refresh-publication', body)).json();
    expect(replay.publication.jobId).toBe(queued.publication.jobId); expect(await store.list('jobs')).toHaveLength(2);
  });
  it.each(['before-dispatch', 'before-activation'] as const)('stops a publication refresh conflict %s', async when => {
    const { current, active } = await publishedProject(), savedDraft = structuredClone(current.draft);
    const queued: any = await (await call(current.id, 'refresh-publication', { requestId: crypto.randomUUID(), expectedVersion: current.version, expectedPublishedReleaseId: active.id })).json();
    expect(queued.publication?.jobId).toBeTruthy();
    const newer = { ...active, id: crypto.randomUUID() }; await store.insert('releases', newer).run();
    const replace = async () => { const p = (await store.one<Project>('projects', current.id))!; p.publishedReleaseId = newer.id; await store.update('projects', p).run(); };
    vi.mocked(providers.publish).mockClear();
    if (when === 'before-dispatch') await replace();
    else vi.mocked(providers.publish).mockImplementationOnce(async () => { await replace(); return { deploymentId: 'accepted-refresh', url: active.url!, testMode: true }; });
    await domain.tick();
    expect((await store.one<Job>('jobs', queued.publication.jobId))!.status).toBe('failed');
    expect((await store.one<Project>('projects', current.id))!).toMatchObject({ publishedReleaseId: newer.id, draft: savedDraft });
    expect(providers.publish).toHaveBeenCalledTimes(when === 'before-dispatch' ? 0 : 1);
  });
  it('preserves an inline legacy clone snapshot and its unconfirmed current draft exactly', async () => {
    const { current: p, active } = await publishedProject();
    active.draft.buildBranch = 'clone';
    active.draft.materials = undefined;
    active.draft.cloneConfig = { generatedHtml: '<!doctype html><html><head><title>Confirmed clone</title></head><body><main>Confirmed clone</main></body></html>' };
    p.draft = structuredClone(active.draft); p.draft.company.description = 'Private clone edit'; p.materials = undefined;
    await store.update('releases', active).run(); await store.update('projects', p).run();
    const result = await call(p.id, 'refresh-publication', { requestId: crypto.randomUUID(), expectedVersion: p.version, expectedPublishedReleaseId: active.id });
    expect(result.status, await result.clone().text()).toBe(200);
    const queued: any = await result.json();
    expect((await store.one<Release>('releases', queued.publication.releaseId))!.draft).toEqual(active.draft);
    await domain.tick();
    expect((await store.one<Job>('jobs', queued.publication.jobId))!.status).toBe('succeeded');
    expect((await store.one<Project>('projects', p.id))!.draft).toEqual(p.draft);
  });
  it('keeps publication refresh version, release, owner and workspace boundaries', async () => {
    const { current: p, active } = await publishedProject();
    const body = { requestId: crypto.randomUUID(), expectedVersion: p.version, expectedPublishedReleaseId: active.id };
    expect((await call(p.id, 'refresh-publication', { ...body, expectedVersion: p.version + 1 })).status).toBe(409);
    expect((await call(p.id, 'refresh-publication', { ...body, expectedPublishedReleaseId: crypto.randomUUID() })).status).toBe(409);
    current.workspaceId = 'foreign'; expect((await call(p.id, 'refresh-publication', body)).status).toBe(404);
    current = structuredClone(fixture.principal); revoked=true; expect((await call(p.id, 'refresh-publication', body)).status).toBe(403);revoked=false;
    current = { ...fixture.principal, userId: 'unrelated-member', workspaceRole: 'member' }; expect((await call(p.id, 'refresh-publication', body)).status).toBe(404);
    expect(await store.list('jobs')).toHaveLength(1);
    current = structuredClone(fixture.principal);
    p.materials = undefined; await store.update('projects', p).run(); // Existing non-materials sites use the maintenance entry only.
    expect((await call(p.id, 'refresh-publication', body)).status).toBe(200);
  });
  it.each([
    { name: 'not yet prepared', completed: [[], []], expected: 0 },
    { name: 'partially prepared', completed: [[320], []], expected: 1 },
    { name: 'all prepared', completed: [[320, 640], [320]], expected: 3 },
    { name: 'duplicate and unrelated variants', completed: [[320, 320, 1280], [320, 999]], expected: 2 },
  ])('reports real media progress for $name on every publication response', async ({ completed, expected }) => {
    const p = await accepted(), body = { requestId: crypto.randomUUID(), expectedVersion: p.version };
    const initial: any = await (await call(p.id, 'publish', body)).json();
    const release = (await store.one<Release>('releases', initial.publication.releaseId))!;
    release.publicMedia = { policy: 'test-progress', ready: false, assets: Object.fromEntries([[320, 640, 320], [320]].map((widths, i) => [
      'asset-' + i, { sourceKey: 'PRIVATE_SOURCE_KEY', sourceIdentity: 'PRIVATE_IDENTITY', widths,
        variants: completed[i].map(requestedWidth => ({ requestedWidth, width: 100, height: 100, bytes: 123, sha256: 'PRIVATE_HASH', key: 'PRIVATE_VARIANT_KEY' })) },
    ])) };
    await store.update('releases', release).run();
    const head = vi.spyOn(env.MEDIA, 'head'), get = vi.spyOn(env.MEDIA, 'get');
    for (const [action, request] of [['status', {}], ['publication-status', { jobId: initial.publication.jobId }], ['publish', body]] as const) {
      const response = await call(p.id, action, request); expect(response.status).toBe(200);
      const state: any = await response.json();
      expect(state.publication.mediaProgress).toEqual({ completed: expected, total: 3 });
      expect(state.publication.status).toBe('queued');
      expect(JSON.stringify(state)).not.toMatch(/PRIVATE_|sourceKey|sourceIdentity|variants|sha256/);
    }
    expect(head).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled(); expect(providers.publish).not.toHaveBeenCalled();
    expect(await store.list('jobs')).toHaveLength(1); expect(await store.list('releases')).toHaveLength(1);
    const other = { ...p, id: crypto.randomUUID() }; await store.insert('projects', other).run();
    expect((await call(other.id, 'publication-status', { jobId: initial.publication.jobId })).status).toBe(404);
    current.workspaceId = 'another-workspace';
    expect((await call(p.id, 'status')).status).toBe(404);
  });
  it('omits media progress for drafts, legacy releases and manifests without requested widths', async () => {
    const p = await accepted(), body = { requestId: crypto.randomUUID(), expectedVersion: p.version };
    expect((await (await call(p.id, 'status')).json() as any).publication).not.toHaveProperty('mediaProgress');
    const initial: any = await (await call(p.id, 'publish', body)).json();
    const release = (await store.one<Release>('releases', initial.publication.releaseId))!;
    for (const publicMedia of [undefined, { policy: 'test-progress', ready: false, assets: {} }, {
      policy: 'test-progress', ready: true, assets: { unused: { sourceKey: 'private', sourceIdentity: 'private', widths: [], variants: [] } },
    }] as (PublicMediaManifest | undefined)[]) {
      release.publicMedia = publicMedia; await store.update('releases', release).run();
      const state: any = await (await call(p.id, 'publication-status', { jobId: initial.publication.jobId })).json();
      expect(state.publication).not.toHaveProperty('mediaProgress');
    }
  });
  it('does not dispatch when a company administrator is demoted after queueing', async () => {
    const p = await accepted(); current = { ...current, userId: 'company-admin' };
    expect((await call(p.id, 'publish', { requestId: crypto.randomUUID(), expectedVersion: p.version })).status).toBe(200);
    current.workspaceRole = 'member'; await domain.tick();
    expect(providers.publish).not.toHaveBeenCalled(); expect((await store.list<Job>('jobs'))[0].status).toBe('failed');
  });
  it('exposes an uncertain saved result without replacing the publication on replay', async () => {
    const p = await accepted();
    await env.DB.exec("CREATE TRIGGER reject_activation BEFORE UPDATE ON projects WHEN json_extract(NEW.data, '$.publishedReleaseId') IS NOT NULL BEGIN SELECT RAISE(ABORT, 'activation failed'); END");
    const body = { requestId: crypto.randomUUID(), expectedVersion: p.version };
    await call(p.id, 'publish', body); await domain.tick();
    const status: any = await (await call(p.id, 'publication-status')).json();
    expect(status.publication).toMatchObject({ status: 'unknown', phase: 'recovering', retryable: false });
    expect(status.publication.url).toBeUndefined(); expect(status.publishedUrl).toBeUndefined();
    const replay: any = await (await call(p.id, 'publish', body)).json();
    expect(replay.publication.jobId).toBe(status.publication.jobId); expect(providers.publish).toHaveBeenCalledTimes(1);
    expect(await store.list('releases')).toHaveLength(1);
  });
  it('blocks a queued publish after role revocation and allows a fresh request after a known failure', async () => {
    const p = await accepted();
    await call(p.id, 'publish', { requestId: crypto.randomUUID(), expectedVersion: p.version });
    revoked = true; await domain.tick();
    expect(providers.publish).not.toHaveBeenCalled(); expect((await store.list<Job>('jobs'))[0].status).toBe('failed');
    revoked = false; current = structuredClone(fixture.principal);
    vi.mocked(providers.publish).mockRejectedValueOnce(new ProviderError('unavailable', 'Temporary provider failure', false));
    await call(p.id, 'publish', { requestId: crypto.randomUUID(), expectedVersion: p.version }); await domain.tick();
    const failed: any = await (await call(p.id, 'publication-status')).json(); expect(failed.publication).toMatchObject({ status: 'failed', retryable: true });
    await call(p.id, 'publish', { requestId: crypto.randomUUID(), expectedVersion: p.version }); await domain.tick();
    expect((await (await call(p.id, 'publication-status')).json() as any).publication.status).toBe('succeeded');
  });
});
