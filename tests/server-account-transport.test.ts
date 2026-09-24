import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { accountTransport } from '../src/server/account-transport';

it('scopes connections to the exact account origin', async () => {
  const transport = accountTransport('https://account.example.test');
  try {
    expect(transport.options(new URL('https://account.example.test/api/auth/sign-in')).dispatcher).toBeDefined();
    for (const url of ['https://account.example.test.attacker.test', 'http://account.example.test', 'https://account.example.test:8443', 'https://api.resend.com'])
      expect(transport.options(new URL(url))).toEqual({});
  } finally { await transport.close(); }
});

it('reuses an idle connection beyond Node’s default keep-alive window', async () => {
  let connections = 0;
  const server = createServer((req, res) => {
    // Omit the server's Keep-Alive timeout hint, so the client's own idle
    // setting is exercised rather than an extension requested by the server.
    res.setHeader('Connection', 'keep-alive');
    res.end('ok');
  });
  server.keepAliveTimeout = 65_000;
  server.on('connection', () => connections++);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(`http://127.0.0.1:${(server.address() as {port:number}).port}`);
  const transport = accountTransport(url.origin);
  try {
    expect(await (await fetch(url, transport.options(url) as RequestInit)).text()).toBe('ok');
    await new Promise(resolve => setTimeout(resolve, 6_000));
    expect(await (await fetch(url, transport.options(url) as RequestInit)).text()).toBe('ok');
    expect(connections).toBe(1);
  } finally { await transport.close(); server.close(); }
});
