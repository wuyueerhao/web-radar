import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const out = resolve('artifacts/three-template-sync');
await mkdir(out, { recursive: true });
await build({
  stdin: {
    contents:
      "export {renderSite} from './src/templates';export {defaultDraft} from './src/worker/domain';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  keepNames: true,
  outfile: out + '/renderer.mjs',
});
const { renderSite, defaultDraft } = await import(out + '/renderer.mjs');
const ids = ['single-device-showcase', 'single-artisan-craft', 'single-wellness-nordic'];
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/templates/')) {
    try {
      const file = resolve('public', '.' + u.pathname);
      if (!file.startsWith(resolve('public/templates') + '/')) throw Error();
      res.setHeader(
        'Content-Type',
        {
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.woff2': 'font/woff2',
        }[extname(file)] || 'application/octet-stream',
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
    return;
  }
  const d = defaultDraft();
  d.template = u.pathname.slice(1);
  d.company.name = 'Template Review';
  d.company.email = 'review@example.com';
  res.setHeader('Content-Type', 'text/html');
  res.end(
    renderSite(d, {
      projectId: 'local-review',
      lang: 'en',
      page: u.searchParams.get('page') || 'home',
      preview: true,
      assetUrl: (id) => id,
      inquiryUrl: '',
    }),
  );
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  for (const id of ids)
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: 'reduce',
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
      );
      for (const p of ['home', 'catalog', 'detail', 'about', 'contact']) {
        await page.goto(`${origin}/${id}?page=${p}`, { waitUntil: 'networkidle' });
        const metrics = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          heading: !!document.querySelector('h1'),
          offenders: [...document.querySelectorAll('main *')]
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 8)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              style: e.getAttribute('style')?.slice(0, 130),
              right: e.getBoundingClientRect().right,
            })),
          broken: [...document.images]
            .filter((i) => i.getAttribute('src') && i.complete && !i.naturalWidth)
            .map((i) => i.getAttribute('src')),
        }));
        results.push({ id, width, page: p, ...metrics, errors: [...errors] });
        if (p === 'home')
          await page.screenshot({
            path: `${out}/${id}-${width}.jpg`,
            type: 'jpeg',
            fullPage: false,
          });
      }
      await page.close();
    }
  const motionPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  });
  await motionPage.goto(origin + '/single-device-showcase', { waitUntil: 'networkidle' });
  await motionPage.waitForFunction(
    () => {
      const v = document.querySelector('[data-sp-video]');
      return v && !v.paused && v.currentTime > 0;
    },
    { timeout: 20000 },
  );
  await motionPage.locator('[data-sp-video-toggle]').click();
  if (!(await motionPage.locator('video').evaluate((v) => v.paused)))
    throw Error('Video pause failed');
  await motionPage.locator('[data-sp-video-toggle]').click();
  await motionPage.waitForFunction(() => !document.querySelector('video').paused);
  await motionPage.emulateMedia({ reducedMotion: 'reduce' });
  await motionPage.waitForFunction(() => document.querySelector('video').paused);
  await motionPage.reload({ waitUntil: 'networkidle' });
  if (await motionPage.locator('video').getAttribute('src'))
    throw Error('Reduced motion loaded video automatically');
  await motionPage.close();
  console.log('Video playback, pause/resume, reduced-motion checks passed');
  await writeFile(out + '/report.json', JSON.stringify(results, null, 2));
  const bad = results.filter((r) => r.overflow || r.broken.length || r.errors.length || !r.heading);
  console.log(JSON.stringify({ checked: results.length, failures: bad }, null, 2));
  if (bad.length) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
