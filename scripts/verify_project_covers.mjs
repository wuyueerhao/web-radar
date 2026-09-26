import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { unstable_startWorker } from 'wrangler';
import { chromium } from '@playwright/test';
const origin='http://127.0.0.1:8796',out='artifacts/project-covers';
await mkdir(out,{recursive:true});const state=out+'/state-'+Date.now();
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','web-radar','--local','--env','test','--persist-to',state],{stdio:'pipe'});
const covers=JSON.parse(await readFile('src/worker/template-guides/covers.json','utf8'));
let worker,browser;
try {
 worker=await unstable_startWorker({config:'wrangler.jsonc',env:'test',dev:{server:{hostname:'127.0.0.1',port:8796},persist:state,inspector:false,watch:false,logLevel:'error'}});await worker.ready;
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 assert.equal((await context.request.post(origin+'/api/auth/test-login',{data:{identity:'owner'}})).status(),200);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const projects=[['industry','tools-precision-banner',null],['home','senseng-clean','homepage'],['missing','single-device-showcase','deleted-home'],['legacy','natural',null]].map(([id,template,coverAssetId])=>({id,name:id,companyName:'Homepage preview',template,coverAssetId,productCount:3,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),offline:false}));
 await page.route('**/api/projects?*',route=>route.fulfill({json:{projects,total:4,page:1,pageSize:20,counts:{all:4,draft:4,published:0,offline:0}}}));
 await page.route('**/api/projects/home/assets/homepage?*',async route=>route.fulfill({contentType:'image/jpeg',body:await readFile('public'+covers['senseng-clean'].url)}));
 await page.route('**/api/projects/missing/assets/deleted-home?*',route=>route.fulfill({status:404,json:{message:'Missing homepage'}}));
 await page.goto(origin+'/?view=projects');await page.locator('.project-card').last().waitFor();
 for (const [i,expected] of [[0,covers['tools-precision-banner'].url],[1,'blob:'],[2,covers['single-device-showcase'].url],[3,covers['senseng-clean'].url]]) {
  const img=page.locator('.project-card').nth(i).locator('.project-cover img');await img.waitFor();
  await img.evaluate(image=>image.decode());const src=await img.getAttribute('src');assert.ok(src.includes(expected));
  assert.equal(await img.evaluate(image=>getComputedStyle(image).objectPosition),'50% 0%');
 }
 assert.deepEqual(errors,[]);await page.screenshot({path:out+'/projects.png',fullPage:true,animations:'disabled'});
 console.log('PASS: exact industry homepage, private homepage, missing-image template fallback, legacy template, top-aligned crops.');
} finally {await browser?.close();await worker?.dispose();}
