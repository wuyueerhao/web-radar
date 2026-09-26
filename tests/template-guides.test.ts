import { beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { templateGuides } from '../src/worker/template-guides/catalog';
import {
  guideSchema,
  generationOutputSchema,
  guideIds,
} from '../src/worker/template-guides/schema';
import { createTemplateGuidesApp } from '../src/worker/template-guides/api';
import { guideMarkdown } from '../src/worker/template-guides/markdown';
import { referenceLayouts } from '../src/templates/themes/referenceLayouts';
import { templateMediaRequirements } from '../src/shared/template-media';
import { TEMPLATES } from '../src/client/TemplateSelector';
import { getMaterialsTemplate } from '../src/templates/materials';
import { authenticate, mintSession } from '../src/worker/auth';
import { testPrincipal } from '../src/worker/product-radar';
import { testDb } from './helpers/db';
import type { AppEnv, HonoEnv } from '../src/worker/env';
const prefix = '/api/internal/template-guides';
const key = 'wrtg_' + 'k'.repeat(48);
let env: AppEnv;
const app = new Hono<HonoEnv>();
app.route(prefix, createTemplateGuidesApp());
const get = (path = '', credential: string | undefined = key, method = 'GET') =>
  app.request(
    'http://127.0.0.1' + prefix + path,
    { method, headers: credential ? { Authorization: 'Bearer ' + credential } : {} },
    env,
  );
beforeEach(() => {
  env = {
    DB: testDb(),
    ENVIRONMENT: 'test',
    TEST_PROVIDERS: 'true',
    TEMPLATE_GUIDES_API_KEY: key,
  } as AppEnv;
});

describe('versioned internal template documents', () => {
  it('contains exactly one independent document for each current template', () => {
    expect(templateGuides.map((g) => g.templateId)).toEqual([...guideIds]);
    expect([...guideIds].sort()).toEqual(TEMPLATES.map((template) => template.id).sort());
    expect([...guideIds].sort()).toEqual(Object.keys(templateMediaRequirements).sort());
    expect(new Set(templateGuides.map((g) => g.visualSystem.artDirection)).size).toBe(50);
    expect(new Set(templateGuides.map((g) => g.visualSystem.composition)).size).toBe(50);
  });
  it('requires a matching confirmed-materials contract for every registered template', () => {
    for (const template of TEMPLATES) {
      const guide = templateGuides.find(guide => guide.templateId === template.id)!;
      expect(getMaterialsTemplate(template.id), template.id).toMatchObject({
        templateId: template.id,
        guideRevision: guide.revision,
        materialsReady: true,
        imagePolicy: 'typed-regions-v1',
      });
    }
  });
  it.each([
    ['senseng-candy', '#FF6B8B', '糖果', 930],
    ['senseng-wonder', '#264653', '北欧', 1070],
    ['senseng-arcade', '#00F5D4', 'HUD', 1000],
    ['senseng-nature', '#2D4A22', '森林', 960],
    ['senseng-minimal', '#C59B27', '瑞士', 830],
  ] as const)('%s describes its actual visual identity and square product slots', (id, color, style, height) => {
    const guide = templateGuides.find(guide => guide.templateId === id);
    expect(guide).toBeDefined();
    expect(guide!.visualSystem.palette).toContain(color);
    expect(guide!.visualSystem.artDirection).toContain(style);
    expect(guide!.assets.find(asset => asset.id === 'hero-image')!.dimensions).toEqual({ width: 2560, height });
    expect(guide!.layoutImageSlots).toHaveLength(8);
    for (const slot of guide!.layoutImageSlots) expect(slot.dimensions).toEqual({ width: 1200, height: 1200 });
  });
  it.each(templateGuides)(
    '$templateId specifies every renderer slot and actionable material/copy rules',
    (guide) => {
      expect(guideSchema.safeParse(guide).success).toBe(true);
      const summary = templateMediaRequirements[guide.templateId]!;
      expect(guide.revision).toBe(guide.templateId.startsWith('single-') ? '2026-09-26.1' : '2026-09-20.1');
      const [, width, height] = summary.bannerSize.match(/^(\d+)\s*×\s*(\d+)/)!;
      expect(guide.assets.find(asset => asset.id === 'hero-image')!.dimensions).toEqual({ width: Number(width), height: Number(height) });
      expect(guide.inventory.bundledVideoCount).toBe(summary.videos);
      expect(guide.inventory.recommendedDistinctProductImages).toBe(summary.productCount);
      expect(guide.layoutImageSlots.length).toBe(summary.productCount);
      if (guide.templateId in referenceLayouts) {
        const layout = referenceLayouts[guide.templateId as keyof typeof referenceLayouts];
        expect(
          guide.layoutImageSlots.map((s) => ({ ...s.dimensions, src: s.defaultAsset })),
        ).toEqual(layout.slots.map((s) => ({ width: s.width, height: s.height, src: s.src })));
      }
      expect(new Set(guide.assets.map((a) => a.id)).size).toBe(guide.assets.length);
      for (const asset of guide.assets) {
        expect(asset.quantity.min).toBeLessThanOrEqual(asset.quantity.recommended);
        expect(asset.quantity.recommended).toBeLessThanOrEqual(asset.quantity.max);
        expect(asset.composition.length).toBeGreaterThan(10);
        expect(asset.promptTemplate.length).toBeGreaterThan(20);
        if (asset.kind === 'video') {
          expect(asset.durationSeconds!.min).toBeLessThanOrEqual(
            asset.durationSeconds!.recommended,
          );
          expect(asset.durationSeconds!.recommended).toBeLessThanOrEqual(
            asset.durationSeconds!.max,
          );
          expect(guide.assets.some((a) => a.id === asset.posterAsset)).toBe(true);
          expect(asset.framesPerSecond).toBeGreaterThan(0);
        }
      }
      expect(guide.textSlots.some((t) => t.id === 'hero-headline')).toBe(true);
      expect(guide.textSlots.some((t) => t.id === 'seo-description')).toBe(true);
      const md = guideMarkdown(guide);
      for (const asset of guide.assets) expect(md).toContain(asset.promptTemplate);
      for (const slot of guide.textSlots) expect(md).toContain(slot.promptTemplate);
      expect(md).toContain(guide.inputContract.untrustedInputPolicy);
      expect(md).toContain(`/api/internal/template-guides/materials/${guide.templateId}`);
      expect(md).toContain('typed-regions-v1');
      expect(md).toContain('缺图才生成');
      expect(md).toContain('证书和报告只能真实上传');
      expect(md).toContain('不补示例产品');
    },
  );
});
describe('read-only guide API', () => {
  it('lists all 29 selectable documents and returns matching JSON, Markdown and schema', async () => {
    const list = await get();
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toBe('no-store');
    expect(list.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const catalog = (await list.json()) as any;
    expect(catalog.total).toBe(50);
    for (const item of catalog.templates) {
      const res = await get('/' + item.templateId);
      expect(res.status).toBe(200);
      const doc = (await res.json()) as any;
      expect(doc.revision).toBe(item.revision);
      expect(res.headers.get('x-template-guide-sha256')).toMatch(/^[a-f0-9]{64}$/);
      expect(guideSchema.parse(doc).templateId).toBe(item.templateId);
      const markdown = await get('/' + item.templateId + '?format=markdown');
      expect(markdown.headers.get('content-type')).toContain('text/markdown');
      expect(await markdown.text()).toBe(guideMarkdown(doc));
    }
    const schema = (await (await get('/schema')).json()) as any;
    expect(schema.required).toContain('assets');
    expect(schema.properties.templateId.enum).toEqual([...guideIds]);
    const output = (await (await get('/output-schema')).json()) as any;
    expect(output.required).toContain('missingFacts');
    expect(output.additionalProperties).toBe(false);
    expect(output.properties.templateId.enum).toEqual([...guideIds]);
  });
  it('denies anonymous, wrong, malformed and unconfigured machine credentials', async () => {
    expect((await get('', '')).status).toBe(401);
    expect((await get('', 'wrtg_' + 'x'.repeat(48))).status).toBe(401);
    expect((await get('', 'wrtg_bad')).status).toBe(401);
    env.TEMPLATE_GUIDES_API_KEY = undefined;
    expect((await get()).status).toBe(401);
  });
  it('allows platform administrators but denies normal users and workspace administrators', async () => {
    for (const identity of ['owner', 'admin', 'member', 'outsider', 'platform']) {
      const session = await mintSession(env, testPrincipal(identity), identity);
      expect((await get('', session.token)).status).toBe(identity === 'platform' ? 200 : 403);
    }
  });
  it('does not turn the read-only key into a project/session credential', async () => {
    await expect(
      authenticate(
        new Request('http://127.0.0.1/api/projects', {
          headers: { Authorization: 'Bearer ' + key },
        }),
        env,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('rejects mutations and unknown IDs/formats', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect((await get('/senseng-clean', key, method)).status).toBe(405);
    expect((await get('/natural')).status).toBe(404);
    expect((await get('/__proto__')).status).toBe(404);
    expect((await get('/senseng-clean?format=html')).status).toBe(400);
  });
  it('defines a parseable output manifest without accepting unsafe URLs or publishing instructions', () => {
    const output = {
      schemaVersion: '1.0',
      templateId: 'senseng-clean',
      guideRevision: '2026-09-17.1',
      language: 'en',
      assets: [
        {
          assetSpecId: 'product-master',
          productId: 'p1',
          kind: 'image',
          delivery: { type: 'url', url: 'https://media.example.com/p1.webp' },
          width: 1536,
          height: 1024,
          mimeType: 'image/webp',
          bytes: 102400,
          alt: 'Provided product on a light backdrop',
        },
      ],
      copy: [
        {
          textSlotId: 'product-description',
          productId: 'p1',
          text: 'Description from the supplied facts.',
          factReferences: ['products[p1].facts'],
        },
      ],
      missingFacts: [],
      warnings: [],
    };
    expect(generationOutputSchema.safeParse(output).success).toBe(true);
    expect(generationOutputSchema.safeParse({ ...output, publish: true }).success).toBe(false);
    output.assets[0].delivery.url = 'javascript:alert(1)';
    expect(generationOutputSchema.safeParse(output).success).toBe(false);
  });
});
