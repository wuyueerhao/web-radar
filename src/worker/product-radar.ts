import { z } from 'zod';
import type { Principal, ProductSnapshot } from '../shared/model';
import type { AppEnv } from './env';
import { testMode } from './env';
import { ApiError } from './http';
export const principalSchema = z.object({
  userId: z.string().min(1).max(200),
  authSubject: z.string().min(1).max(200),
  email: z.email(),
  displayName: z.string().max(200),
  systemRole: z.enum(['super_admin', 'user']),
  workspaceId: z.string().min(1).max(200),
  workspaceRole: z.enum(['admin', 'member']),
  workspaceName: z.string().max(300),
});
export { productSnapshotSchema as snapshotSchema } from '../shared/product-snapshot';
import { importProductSnapshotSchema } from '../shared/product-snapshot';
export function isLoopback(host: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(host);
}
export function validateOrigin(value: string): string {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new ApiError(503, 'invalid_origin', '服务地址配置无效。');
  }
  if (
    u.origin !== value ||
    u.username ||
    u.password ||
    !(u.protocol === 'https:' || (u.protocol === 'http:' && isLoopback(u.hostname)))
  )
    throw new ApiError(503, 'invalid_origin', '服务必须配置为 HTTPS 来源地址。');
  return u.origin;
}
export function parentOrigins(env: AppEnv): string[] {
  if (!env.PRODUCT_RADAR_PARENT_ORIGINS) return [];
  return env.PRODUCT_RADAR_PARENT_ORIGINS.split(/[\s,]+/)
    .filter(Boolean)
    .map(validateOrigin);
}
export function integrationConfig(env: AppEnv): { origin: string; secret: string } {
  if (
    !env.PRODUCT_RADAR_BASE_URL ||
    !env.PRODUCT_RADAR_INTEGRATION_SECRET ||
    env.PRODUCT_RADAR_INTEGRATION_SECRET.length < 32
  )
    throw new ApiError(503, 'integration_unconfigured', 'Product Radar 账号衔接尚未配置。');
  return {
    origin: validateOrigin(env.PRODUCT_RADAR_BASE_URL),
    secret: env.PRODUCT_RADAR_INTEGRATION_SECRET,
  };
}
async function readUpstream(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(502, 'upstream_invalid', '账号服务没有返回内容。');
  const decoder = new TextDecoder();
  let text = '',
    bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 2 * 1024 * 1024) {
      await reader.cancel();
      throw new ApiError(502, 'upstream_invalid', '账号服务返回内容超出限制。');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(502, 'upstream_invalid', '账号服务返回格式有误。');
  }
}
export async function prRequest(
  env: AppEnv,
  path: string,
  body?: unknown,
  bearer?: string,
): Promise<Response> {
  const { origin, secret } = integrationConfig(env);
  // Context is a read-only lookup even though its transport uses POST. Retry
  // only this endpoint; credentials, writes and other POSTs are never replayed.
  const attempts = path === '/api/web-radar/service/context' ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const r = await fetch(origin + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : { 'X-Web-Radar-Secret': secret }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) {
        await r.body?.cancel();
        if (r.status >= 500 && attempt + 1 < attempts) continue;
        const status = [400, 401, 403, 404, 409, 429, 503].includes(r.status) ? r.status : 502;
        throw new ApiError(
          status,
          'product_radar_unavailable',
          status === 403
            ? '当前账号或工作区权限已失效。'
            : status === 401
              ? '登录已失效，请重新登录。'
              : 'Product Radar 服务暂不可用。',
        );
      }
      return r;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (attempt + 1 < attempts) continue;
      throw new ApiError(502, 'product_radar_unavailable', '暂时无法连接 Product Radar，请稍后重试。');
    }
  }
  throw new ApiError(502, 'product_radar_unavailable', '暂时无法连接 Product Radar。');
}
export async function prService<T = unknown>(
  env: AppEnv,
  principal: Principal,
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  if (testMode(env) && principal.userId.startsWith('test-')) {
    if (path === 'context')
      return {
        protocolVersion: 1,
        principal: testPrincipal(principal.userId.replace('test-', '')),
      } as T;
    if (path === 'products') {
      const fixture = testProduct();
      const ids = body.productIds as string[] | undefined;
      if (ids?.some((id) => id !== fixture.id))
        throw new ApiError(404, 'source_not_found', '测试来源产品不存在。');
      return { products: [fixture], total: 1 } as T;
    }
  }
  if (!['context', 'products'].includes(path))
    throw new ApiError(400, 'invalid_service', '不支持的服务。');
  const response = await prRequest(env, '/api/web-radar/service/' + path, {
    ...body,
    userId: principal.userId,
    workspaceId: principal.workspaceId,
  });
  const data = await readUpstream(response);
  if (path === 'context') {
    const parsed = z
      .object({ protocolVersion: z.literal(1), principal: principalSchema })
      .safeParse(data);
    if (
      !parsed.success ||
      parsed.data.principal.userId !== principal.userId ||
      parsed.data.principal.workspaceId !== principal.workspaceId
    )
      throw new ApiError(403, 'principal_mismatch', '当前账号或工作区权限已失效。');
    return parsed.data as T;
  }
  const parsed = z
    .object({ products: z.array(importProductSnapshotSchema), total: z.number().int().nonnegative() })
    .safeParse(data);
  if (!parsed.success) throw new ApiError(502, 'invalid_products', '来源产品格式有误。');
  return parsed.data as T;
}
const principalReads = new WeakMap<AppEnv, Map<string, Promise<Principal>>>();
export async function currentPrincipal(env: AppEnv, principal: Principal): Promise<Principal> {
  let reads = principalReads.get(env);
  if (!reads) { reads = new Map(); principalReads.set(env, reads); }
  const key = JSON.stringify([principal.userId, principal.workspaceId]);
  const pending = reads.get(key);
  if (pending) return pending;
  // Share only an in-flight lookup. Never cache a completed permission result:
  // the next request must see revoked roles or workspace membership immediately.
  const lookup = prService<{ principal: Principal }>(env, principal, 'context')
    .then(result => result.principal)
    .finally(() => reads!.delete(key));
  reads.set(key, lookup);
  return lookup;
}
export async function prImage(
  env: AppEnv,
  principal: Principal,
  productId: string,
  expectedVersion: string,
  imageId = 'original',
): Promise<Response> {
  if (testMode(env) && principal.userId.startsWith('test-')) {
    if (expectedVersion !== 'test-v1')
      throw new ApiError(409, 'source_changed', '来源内容已更新，请重新检查。');
    if (productId !== 'test-product')
      throw new ApiError(404, 'source_not_found', '测试来源不存在。');
    return new Response(
      Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        ),
        (x) => x.charCodeAt(0),
      ),
      { headers: { 'Content-Type': 'image/png' } },
    );
  }
  return prRequest(env, '/api/web-radar/service/image', {
    userId: principal.userId,
    workspaceId: principal.workspaceId,
    productId,
    expectedVersion,
    imageId,
  });
}
export async function signInAtPr(env: AppEnv, email: string, password: string): Promise<Principal> {
  const { origin } = integrationConfig(env);
  let response: Response;
  try {
    response = await fetch(origin + '/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(502, 'sign_in_unavailable', '暂时无法连接登录服务。');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ApiError(
      [400, 401, 429, 503].includes(response.status) ? response.status : 502,
      'sign_in_failed',
      response.status === 401 ? '邮箱或密码不正确。' : '登录服务暂时不可用，请稍后重试。',
    );
  }
  const auth = z
    .object({ access_token: z.string().min(1) })
    .safeParse(await readUpstream(response));
  if (!auth.success) throw new ApiError(502, 'invalid_auth_response', '登录服务返回格式有误。');
  const context = await prRequest(env, '/api/web-radar/context', undefined, auth.data.access_token);
  const parsed = z
    .object({ protocolVersion: z.literal(1), principal: principalSchema })
    .safeParse(await readUpstream(context));
  if (!parsed.success) throw new ApiError(502, 'invalid_context', '账号信息返回格式有误。');
  return parsed.data.principal;
}
export function testPrincipal(identity: string): Principal {
  if (!['owner', 'admin', 'member', 'outsider', 'platform'].includes(identity))
    throw new ApiError(401, 'invalid_test_identity', '无效测试账号。');
  return {
    userId: `test-${identity}`,
    authSubject: `test-${identity}`,
    email: `${identity}@example.test`,
    displayName: {
      owner: '项目创建者',
      admin: '工作区管理员',
      member: '普通成员',
      outsider: '其他公司成员',
      platform: '平台管理员',
    }[identity]!,
    systemRole: identity === 'platform' ? 'super_admin' : 'user',
    workspaceId: identity === 'outsider' ? 'test-other-workspace' : 'test-workspace',
    workspaceRole: identity === 'admin' ? 'admin' : 'member',
    workspaceName: identity === 'outsider' ? '其他测试公司' : 'Web Radar 测试公司',
  };
}
export function testProduct(): ProductSnapshot {
  return {
    source: 'product-radar',
    id: 'test-product',
    sourceProjectId: 'test-source-project',
    workflow: 'build',
    version: 'test-v1',
    name: '测试木制平衡积木',
    description: '仅用于本地流程验收的虚构产品，不代表真实销售商品。',
    material: 'Wood',
    dimensions: 'Confirm dimensions before publishing',
    seriesName: 'Local fixtures',
    designDirection: 'Natural studio demonstration',
    conditions: { keep: ['product silhouette'], change: ['background only'], testFixture: true },
    image: { sourceProductId: 'test-product', contentType: 'image/png' },
    factsOrigin: 'product-set',
    websiteCopy: {name:'Test product',tagline:'Test product set',description:'Local test product',sellingPoints:['First feature','Second feature','Third feature'],applications:['Local tests']},
    images:[{id:'original',kind:'original',caption:'Original',contentType:'image/png'}],
  };
}
