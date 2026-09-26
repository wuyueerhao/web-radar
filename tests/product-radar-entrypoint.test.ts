import { testDb } from './helpers/db';
import { afterEach, expect, it, vi } from 'vitest';
import type { AppEnv } from '../src/worker/env';
import { materialsFixture } from './fixtures/materials';
vi.mock('../src/worker/coordinator', () => ({ Coordinator: class {} }));
import app from '../src/worker/index';

const projectId = '015c4cb4-1622-481f-8de4-03316dc09a2b';
const secret = 's'.repeat(40);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function fixture() {
  const principal = { ...(await materialsFixture()).principal, email: 'member@example.test', systemRole: 'user' as const, workspaceRole: 'member' as const };
  const upstream = vi.fn(async () => Response.json({ protocolVersion: 1, principal }));
  vi.stubGlobal('fetch', upstream);
  const forwarded = vi.fn(async () => Response.json({ reachedProjectService: true }));
  const env = { DB:testDb(), ENVIRONMENT: 'production', TEST_PROVIDERS: 'false', APP_ORIGIN: 'https://web-radar.net', PRODUCT_RADAR_BASE_URL: 'https://product.example.com', PRODUCT_RADAR_INTEGRATION_SECRET: secret, COORDINATOR: { getByName: () => ({ fetch: forwarded }) } } as unknown as AppEnv;
  const request = (action: string, key = secret, extra = {}) => app.request(`https://web-radar.net/api/integrations/product-radar/projects/${projectId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Web-Radar-Secret': key }, body: JSON.stringify({ principal: { userId: principal.userId, workspaceId: principal.workspaceId }, ...extra }) }, env);
  return { principal, upstream, forwarded, request };
}
it.each(['status', 'preview', 'publication-status', 'assets/image-1', 'publish', 'refresh-publication'])('routes the deployed %s integration without a separate customer session', async action => {
  const f = await fixture();
  const extra = action === 'publish' ? { requestId: 'request-1', expectedVersion: 1 } : action === 'refresh-publication' ? { requestId: 'request-1', expectedVersion: 1, expectedPublishedReleaseId: '3c4cb4bc-1622-481f-8de4-03316dc09a2b' } : {};
  const response = await f.request(action, secret, extra);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ reachedProjectService: true });
  expect(f.forwarded).toHaveBeenCalledOnce();
  const request = (f.forwarded.mock.calls[0] as unknown as [Request])[0];
  expect(new URL(request.url).pathname).toBe(`/internal/product-radar-projects/${projectId}/${action}`);
  expect(JSON.parse(decodeURIComponent(request.headers.get('X-WR-Principal')!))).toEqual({...f.principal,appRole:'member'});
  expect(request.method).toBe(['publish', 'refresh-publication'].includes(action) ? 'POST' : 'GET');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('rejects an invalid service key before reaching a customer project', async () => {
  const f = await fixture(); const response = await f.request('status', 'invalid');
  expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ code: 'integration_key_invalid' });
  expect(f.forwarded).not.toHaveBeenCalled(); expect(f.upstream).not.toHaveBeenCalled();
});
it('revalidates customer permissions before the project service', async () => {
  const f = await fixture(); f.upstream.mockResolvedValueOnce(Response.json({}, { status: 403 }));
  const response = await f.request('preview'); expect(response.status).toBe(403);
  expect(f.forwarded).not.toHaveBeenCalled();
});
