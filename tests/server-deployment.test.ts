import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { testDb } from './helpers/db';
import { defaultDraft } from '../src/worker/domain';
import { deploymentSelection, matchesDeployment } from '../src/shared/deployment';
import { validateDeployment, deploymentOptions } from '../src/worker/deployment-settings';
import { allowCloudflareMutation } from '../src/server/cloudflare-guard';
import { serverProviders, hostedSite } from '../src/server/hosting';
import { ProviderSettings } from '../src/worker/provider-settings';
import { DomainService } from '../src/worker/domain-service';
import type { AppEnv } from '../src/worker/env';
import type { Project } from '../src/shared/model';
let env: AppEnv, p: Project;
beforeEach(async () => {
  const DB = testDb();
  for (const m of [
    '0002_business',
    '0003_source_reviews',
    '0004_unlimited_quota',
    '0005_project_summary_indexes',
    '0006_provider_accounts',
  ])
    await DB.exec(readFileSync(`migrations/${m}.sql`, 'utf8'));
  env = {
    DB,
    SERVER_SITE_SUFFIX: 'sites.example.com',
    SERVER_PUBLIC_IP: '192.0.2.1',
    SERVER_INSTANCE_ID: 'unit-server',
    APP_ORIGIN: 'https://admin.example.com',
    PUBLIC_SITE_ORIGIN: 'https://public.example.com',
    CLOUDFLARE_ACCOUNT_ID: 'account1',
    CLOUDFLARE_API_TOKEN: 'secret',
    ASSET_SIGNING_KEY: 'test-key',
  } as AppEnv;
  p = {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: 'u',
    workspaceId: 'w',
    name: 'Example',
    version: 1,
    draft: defaultDraft(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    offline: false,
  };
  await DB.prepare('INSERT INTO projects VALUES(?,?,?,?,?)')
    .bind(p.id, p.ownerId, p.workspaceId, p.version, JSON.stringify(p))
    .run();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true, result: [] })),
  );
});
afterEach(() => vi.unstubAllGlobals());
async function store() {
  await env.DB.prepare('UPDATE projects SET data=? WHERE id=?').bind(JSON.stringify(p), p.id).run();
}
it('defaults new websites to Cloudflare and preserves copied legacy targets on server', () => {
  expect(deploymentSelection(p, true).provider).toBe('cloudflare');
  p.hostingTarget = { accountId: 'original', pagesProjectName: 'wr-original' };
  expect(deploymentSelection(p, true).provider).toBe('server');
  expect(deploymentSelection(p, false).provider).toBe('cloudflare');
});
it('allocates independent deterministic Pages projects without exposing secrets', async () => {
  const a = await serverProviders(env).resolveHostingTarget(p.id);
  const b = await serverProviders(env).resolveHostingTarget(p.id);
  expect(a).toEqual(b);
  expect(a.pagesProjectName).toMatch(/^wrs-[a-f0-9]{32}$/);
  expect(a.provider).toBe('cloudflare');
  expect(JSON.stringify(await deploymentOptions(env, p))).not.toContain('secret');
});
it('requires explicit migration confirmation and retains current published snapshot', async () => {
  p.publishedReleaseId = 'r1';
  p.hostingTarget = { accountId: 'old', pagesProjectName: 'wr-original' };
  const body = {
    provider: 'cloudflare',
    credentialId: 'environment-cloudflare:account1',
    accountId: 'account1',
  };
  await expect(validateDeployment(env, p, body)).rejects.toMatchObject({
    code: 'migration_confirmation_required',
  });
  expect(await validateDeployment(env, p, { ...body, confirmMigration: true })).toMatchObject({
    provider: 'cloudflare',
  });
  expect(p.hostingTarget.pagesProjectName).toBe('wr-original');
  expect(matchesDeployment(p.hostingTarget, { provider: 'cloudflare' }, true)).toBe(false);
});
it('blocks changes while publishing and prevents domains from being stranded', async () => {
  await env.DB.prepare(
    'INSERT INTO jobs(id,project_id,user_id,kind,status,created_at,data) VALUES(?,?,?,?,?,?,?)',
  )
    .bind('j', p.id, 'u', 'publish', 'running', 'now', '{}')
    .run();
  await expect(validateDeployment(env, p, { provider: 'server' })).rejects.toMatchObject({
    code: 'publish_pending',
  });
  await env.DB.prepare('DELETE FROM jobs').run();
  await env.DB.prepare(
    "INSERT INTO provider_accounts VALUES('c','cloudflare','global','CF','',NULL,0,'now')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO project_domains(hostname,project_id,credential_id,zone_id,zone_name,status,created_at) VALUES('www.example.com',?,'c','z','example.com','active','now')",
  )
    .bind(p.id)
    .run();
  p.publishedReleaseId = 'r';
  p.deployment = { provider: 'cloudflare' };
  await expect(
    validateDeployment(env, p, { provider: 'server', confirmMigration: true }),
  ).rejects.toMatchObject({ code: 'domains_bound' });
});
it('rejects a deployment mutation for another owner or stale version', async () => {
  const service = new DomainService(env, { schedule: async () => {} }, serverProviders(env));
  const request = (user: string, version: number) =>
    new Request(`https://admin.example.com/api/projects/${p.id}/deployment`, {
      method: 'PUT',
      headers: {
        'X-WR-Principal': encodeURIComponent(
          JSON.stringify({
            userId: user,
            workspaceId: 'w',
            workspaceRole: 'member',
            systemRole: 'user',
          }),
        ),
      },
      body: JSON.stringify({ provider: 'server', expectedVersion: version }),
    });
  expect((await service.fetch(request('other', 1))).status).toBe(404);
  expect((await service.fetch(request('u', 0))).status).toBe(409);
  expect((await service.fetch(request('u', 1))).status).toBe(200);
});
it('blocks writes to original Pages and unowned DNS records', async () => {
  const cf = (path: string, method: string, body?: any) =>
    allowCloudflareMutation(
      env,
      new URL('https://api.cloudflare.com/client/v4' + path),
      method,
      body && JSON.stringify(body),
    );
  expect(await cf('/accounts/a/pages/projects/wr-original/deployments', 'POST')).toBe(false);
  expect(await cf('/accounts/a/pages/projects', 'POST', { name: 'wr-original' })).toBe(false);
  expect(await cf('/accounts/a/pages/projects', 'POST', { name: 'wrs-' + 'a'.repeat(32) })).toBe(
    true,
  );
  expect(
    await cf('/accounts/a/pages/projects/wrs-' + 'a'.repeat(32) + '/deployments', 'POST'),
  ).toBe(true);
  expect(await cf('/zones/z/dns_records/foreign', 'DELETE')).toBe(false);
  expect(
    await cf('/zones/z/dns_records', 'POST', {
      type: 'A',
      content: env.SERVER_PUBLIC_IP,
      name: 'foreign.example.com',
      comment: 'web-radar-server:unit-server:' + p.id,
      proxied: false,
    }),
  ).toBe(false);
});
it('binds native domains with A records and queues TLS without touching Pages', async () => {
  p.hostingTarget = {
    provider: 'server',
    accountId: 'local-server',
    pagesProjectName: 'wr-' + p.id,
  };
  p.publishedReleaseId = 'r';
  await store();
  const writes: any[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/zones'))
        return Response.json({
          success: true,
          result: [
            {
              id: 'z',
              name: 'example.org',
              status: 'active',
              account: { id: 'account1', name: 'CF' },
            },
          ],
          result_info: { total_pages: 1 },
        });
      if (init.method === 'POST') {
        writes.push({ url, body: JSON.parse(init.body as string) });
        return Response.json({ success: true, result: { id: 'dns' } });
      }
      return Response.json({ success: true, result: [] });
    }),
  );
  const settings = new ProviderSettings(env);
  expect(
    await settings.bind(p, {
      credentialId: 'environment-cloudflare:account1',
      zoneId: 'z',
      hostname: 'site.example.org',
    }),
  ).toEqual({ status: 'pending_tls' });
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toMatchObject({
    type: 'A',
    content: '192.0.2.1',
    proxied: false,
    comment: 'web-radar-server:unit-server:' + p.id,
  });
  expect(
    await allowCloudflareMutation(
      env,
      new URL(writes[0].url),
      'POST',
      JSON.stringify(writes[0].body),
    ),
  ).toBe(true);
});
it('keeps the old server site live during a pending Cloudflare deployment', async () => {
  p.publishedReleaseId = 'r';
  p.hostingTarget = {
    provider: 'cloudflare',
    accountId: 'account1',
    pagesProjectName: 'wrs-' + 'a'.repeat(32),
  };
  await store();
  const release = {
    id: 'r',
    projectId: p.id,
    status: 'succeeded',
    hostingTarget: { accountId: 'legacy', pagesProjectName: 'old' },
  };
  await env.DB.prepare('INSERT INTO releases(id,project_id,created_at,data) VALUES(?,?,?,?)')
    .bind('r', p.id, 'now', JSON.stringify(release))
    .run();
  env.MEDIA = {
    get: async () => ({ json: async () => ({ 'en/index.html': '<h1>Old live site</h1>' }) }),
  } as any;
  const r = await hostedSite(
    new Request(`https://${p.id}.sites.example.com/en/index.html`),
    env,
    {} as DomainService,
  );
  expect(r.status).toBe(200);
  expect(await r.text()).toContain('Old live site');
});
