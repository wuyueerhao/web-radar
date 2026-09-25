import { readdir, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

const compress = promisify(gzip);
const extensions = new Set(['.js', '.css', '.svg', '.json']);

// Nginx negotiates these sidecars; browsers still request the original asset URL.
export async function compressAssets(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      count += await compressAssets(path);
    } else if (entry.isFile() && extensions.has(extname(path))) {
      const original = await readFile(path);
      const compressed = original.length >= 1024 ? await compress(original, { level: 9 }) : null;
      if (!compressed || compressed.length >= original.length) {
        await rm(`${path}.gz`, { force: true });
        continue;
      }
      const metadata = await stat(path);
      await writeFile(`${path}.gz`, compressed);
      await utimes(`${path}.gz`, metadata.atime, metadata.mtime);
      count++;
    }
  }
  return count;
}
