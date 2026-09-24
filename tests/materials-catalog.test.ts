import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTemplateGuidesApp } from '../src/worker/template-guides/api';
import { getMaterialsTemplate } from '../src/templates/materials';
import { materialsFixture } from './fixtures/materials';
import { sha256 } from '../src/worker/http';
import type { AppEnv } from '../src/worker/env';

describe('lightweight materials discovery', () => {
  const env = { PRODUCT_RADAR_BASE_URL: 'https://product.example.com', PRODUCT_RADAR_INTEGRATION_SECRET: 's'.repeat(40) } as AppEnv;
  let app: ReturnType<typeof createTemplateGuidesApp>;
  let principal: Awaited<ReturnType<typeof materialsFixture>>['principal'];
  let headers: Record<string, string>;
  beforeEach(async () => {
    principal = (await materialsFixture()).principal;
    headers = { 'X-Web-Radar-Secret': 's'.repeat(40), 'X-Product-Radar-User-Id': principal.userId, 'X-Product-Radar-Workspace-Id': principal.workspaceId };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ protocolVersion: 1, principal })));
    app = createTemplateGuidesApp();
  });
  afterEach(() => vi.unstubAllGlobals());
  const get = (path: string, conditional = '') => app.request('https://web-radar.net' + path, { headers: { ...headers, ...(conditional ? { 'If-None-Match': conditional } : {}) } }, env);

  it('advertises exact matching requirements without downloading full contracts', async () => {
    const response = await get('/materials/catalog');
    const catalog = await response.json() as any;
    expect(catalog.templates).toHaveLength(50);
    expect(catalog.catalogRevision).toBe(await sha256(JSON.stringify(catalog.templates)));
    expect(response.headers.get('ETag')).toBe(`"${catalog.catalogRevision}"`);
    for (const entry of catalog.templates) {
      const contract = getMaterialsTemplate(entry.templateId, entry.contractRevision)!;
      expect(entry.productApplicability).toEqual(contract.productApplicability);
      expect(entry.materialRequirements).toEqual({
        requiresDetail: contract.imageSlots.some(s => s.binding === 'supported' && s.role === 'detail' && (s.required || s.min > 0)),
        requiresPackaging: contract.imageSlots.some(s => s.binding === 'supported' && s.role === 'packaging' && s.required),
      });
      expect(entry.contractSha256).toBe(await sha256(JSON.stringify(contract)));
      for (const fullField of ['imageSlots', 'textSlots', 'optionalSections', 'visualParameters']) expect(entry).not.toHaveProperty(fullField);
    }
  });

  it('revalidates identity before returning an unchanged catalog', async () => {
    const first = await get('/materials/catalog');
    const etag = first.headers.get('ETag')!;
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    const unchanged = await get('/materials/catalog', `"old", W/${etag}`);
    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe('');
    expect(unchanged.headers.get('ETag')).toBe(etag);
    expect(unchanged.headers.get('Cache-Control')).toBe('no-store');
    expect(fetch).toHaveBeenCalledTimes(2);
    principal = { ...principal, userId: 'revoked-principal' };
    expect((await get('/materials/catalog', etag)).status).toBe(403);
  });

  it('conditionally reads only the requested immutable contract and keeps unknown versions absent', async () => {
    const path = '/materials/senseng-clean?contractRevision=2026-09-22.senseng-clean-materials.5';
    const first = await get(path);
    const contract = await first.json();
    const etag = `"${await sha256(JSON.stringify(contract))}"`;
    expect(first.headers.get('ETag')).toBe(etag);
    expect((await get(path, etag)).status).toBe(304);
    expect((await get(path, '"other"')).status).toBe(200);
    expect((await get('/materials/senseng-clean?contractRevision=absent', '*')).status).toBe(404);
    principal = { ...principal, userId: 'revoked-principal' };
    expect((await get(path, etag)).status).toBe(403);
  });
});
