import { applyUserAccess } from './user-access';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, HonoEnv } from './env';
import { testMode } from './env';
import type { Principal } from '../shared/model';
import { ApiError, errorResponse, jsonBody, randomToken, sha256 } from './http';
import { currentPrincipal, isLoopback, signInAtPr, testPrincipal } from './product-radar';
// A week without activity ends the session; active sessions require login after 30 days.
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;
function cookieName(request: Request) {
  return new URL(request.url).protocol === 'https:' ? '__Host-wr_session' : 'wr_session';
}
function sessionToken(request: Request) {
  const bearer = request.headers.get('Authorization');
  if (bearer) return bearer.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/)?.[1];
  return request.headers
    .get('Cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName(request) + '='))
    ?.split('=')[1];
}
function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    throw new ApiError(403, 'invalid_origin', '请从当前网站发起操作。');
}
function sessionCookie(request: Request, token: string, maxAge = SESSION_MAX_MS / 1000) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
export async function mintSession(env: AppEnv, principal: Principal, testIdentity?: string) {
  if (!principal.appRole) principal = await applyUserAccess(env, principal);
  const token = randomToken();
  const now = Date.now();
  const expiresAt = now + SESSION_IDLE_MS;
  await env.DB.prepare(
    'INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at,test_identity,created_at) VALUES(?,?,?,?,?,?)',
  )
    .bind(
      await sha256(token),
      principal.userId,
      principal.workspaceId,
      expiresAt,
      testIdentity ?? null,
      now,
    )
    .run();
  return { token, expiresAt: new Date(expiresAt).toISOString(), principal };
}
export async function authenticate(
  request: Request,
  env: AppEnv,
): Promise<{ principal: Principal; sessionHash: string; expiresAt: string }> {
  const token = sessionToken(request);
  if (!request.headers.has('Authorization') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method))
    sameOrigin(request);
  if (!token || !/^[A-Za-z0-9_-]{40,100}$/.test(token))
    throw new ApiError(401, 'session_required', '请登录 Web Radar。');
  const hash = await sha256(token);
  const row = await env.DB.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?')
    .bind(hash, Date.now())
    .first<{
      user_id: string;
      workspace_id: string;
      test_identity: string | null;
      expires_at: number;
      created_at: number;
    }>();
  if (!row || row.created_at + SESSION_MAX_MS <= Date.now())
    throw new ApiError(401, 'session_expired', '登录已过期，请重新连接。');
  let principal: Principal;
  if (row.test_identity) {
    if (!testMode(env) || !isLoopback(new URL(request.url).hostname))
      throw new ApiError(401, 'test_session_invalid', '测试登录仅供本地测试环境使用。');
    principal = await applyUserAccess(env, testPrincipal(row.test_identity));
  } else {
    principal = await currentPrincipal(env, {
      userId: row.user_id,
      workspaceId: row.workspace_id,
    } as Principal);
  }
  const expiresAt = Math.min(Date.now() + SESSION_IDLE_MS, row.created_at + SESSION_MAX_MS);
  // Avoid a write for every image request; never revive a deleted or expired session.
  if (expiresAt - row.expires_at > 60 * 60 * 1000)
    await env.DB.prepare(
      'UPDATE sessions SET expires_at=MAX(expires_at,?) WHERE token_hash=? AND expires_at>?',
    )
      .bind(expiresAt, hash, Date.now())
      .run();
  return { principal, sessionHash: hash, expiresAt: new Date(expiresAt).toISOString() };
}
async function loginRateLimit(request: Request, env: AppEnv) {
  const id = await sha256('sign-in:' + (request.headers.get('CF-Connecting-IP') ?? 'local'));
  const now = Date.now();
  const row = await env.DB.prepare(
    'INSERT INTO auth_attempts(id,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END RETURNING attempts',
  )
    .bind(id, now + 60000, now, now, now + 60000)
    .first<{ attempts: number }>();
  if ((row?.attempts ?? 11) > 10)
    throw new ApiError(429, 'login_rate_limit', '登录尝试过于频繁，请稍后重试。');
}
export function createAuthApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorResponse);
  app.post('/sign-in', async (c) => {
    sameOrigin(c.req.raw);
    await loginRateLimit(c.req.raw, c.env);
    const body = z
      .object({ email: z.email().max(320), password: z.string().min(1).max(1024) })
      .safeParse(await jsonBody(c.req.raw, 4096));
    if (!body.success) throw new ApiError(400, 'invalid_login', '请填写有效邮箱和密码。');
    const principal = await signInAtPr(c.env, body.data.email, body.data.password);
    const session = await mintSession(c.env, principal);
    c.header('Set-Cookie', sessionCookie(c.req.raw, session.token));
    return c.json(session);
  });
  app.post('/test-login', async (c) => {
    if (!testMode(c.env) || !isLoopback(new URL(c.req.url).hostname))
      throw new ApiError(404, 'not_found', '页面不存在。');
    const body = z
      .object({ identity: z.enum(['owner', 'admin', 'member', 'outsider', 'platform']) })
      .safeParse(await jsonBody(c.req.raw, 1024));
    if (!body.success) throw new ApiError(400, 'invalid_identity', '请选择测试身份。');
    sameOrigin(c.req.raw);
    const session = await mintSession(c.env, testPrincipal(body.data.identity), body.data.identity);
    c.header('Set-Cookie', sessionCookie(c.req.raw, session.token));
    return c.json(session);
  });
  app.get('/me', async (c) => {
    const { principal, expiresAt } = await authenticate(c.req.raw, c.env);
    return c.json({ principal, expiresAt });
  });
  app.post('/sign-out', async (c) => {
    sameOrigin(c.req.raw);
    const token = sessionToken(c.req.raw);
    if (token)
      await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?')
        .bind(await sha256(token))
        .run();
    c.header('Set-Cookie', sessionCookie(c.req.raw, '', 0));
    return c.json({ ok: true });
  });
  return app;
}
