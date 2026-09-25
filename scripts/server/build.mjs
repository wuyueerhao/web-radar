import { build } from 'esbuild';
import { compressAssets } from './compress-assets.mjs';
await build({entryPoints:['src/server/main.ts'],outfile:'dist-server/main.mjs',bundle:true,platform:'node',target:'node24',format:'esm',sourcemap:true,alias:{'@cloudflare/puppeteer':'./src/server/browser.ts'},banner:{js:"import { createRequire } from 'node:module'; const require=createRequire(import.meta.url);"}});
console.log(`Precompressed ${await compressAssets('dist/assets')} public frontend assets.`);
