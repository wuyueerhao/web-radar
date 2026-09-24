import { Agent } from 'undici';

/** Keep identity-service connections warm without changing other providers. */
export function accountTransport(configuredOrigin?: string) {
  let origin: string | undefined;
  try { origin = configuredOrigin ? new URL(configuredOrigin).origin : undefined; } catch { /* validation stays in the account client */ }
  const agent = new Agent({
    connections: 4,
    pipelining: 1,
    keepAliveTimeout: 60_000,
    keepAliveMaxTimeout: 60_000,
    connect: { timeout: 10_000, autoSelectFamily: true },
  });
  return {
    options(url: URL): { dispatcher?: Agent } {
      return origin && url.origin === origin ? { dispatcher: agent } : {};
    },
    close: () => agent.close(),
  };
}
