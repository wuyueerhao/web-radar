import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { compressAssets } from './compress-assets.mjs';

test('public asset sidecars round-trip, preserve timestamps and skip binaries/small files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wr-compression-'));
  try {
    await mkdir(join(root, 'nested'));
    const source = 'console.log("asset");\n'.repeat(500);
    const file = join(root, 'nested/app.js');
    await writeFile(file, source);
    await writeFile(join(root, 'small.css'), 'body{}');
    await writeFile(join(root, 'small.css.gz'), 'obsolete');
    await writeFile(join(root, 'video.mp4'), source);
    assert.equal(await compressAssets(root), 1);
    assert.equal(gunzipSync(await readFile(`${file}.gz`)).toString(), source);
    assert.equal(await readFile(file, 'utf8'), source);
    assert.ok(Math.abs((await stat(file)).mtimeMs - (await stat(`${file}.gz`)).mtimeMs) < 1);
    await assert.rejects(access(join(root, 'small.css.gz')));
    await assert.rejects(access(join(root, 'video.mp4.gz')));
    assert.equal(await compressAssets(root), 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
