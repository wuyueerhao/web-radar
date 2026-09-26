import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { unstable_startWorker } from 'wrangler';
import { chromium } from '@playwright/test';
const origin='http://127.0.0.1:8795',out='artifacts/user-management';
await mkdir(out,{recursive:true});const state=out+'/state-'+Date.now();
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','web-radar','--local','--env','test','--persist-to',state],{stdio:'pipe'});
let worker,browser;
try{
 worker=await unstable_startWorker({config:'wrangler.jsonc',env:'test',dev:{server:{hostname:'127.0.0.1',port:8795},persist:state,inspector:false,watch:false,logLevel:'error'}});await worker.ready;
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 const contexts={};for(const identity of ['admin','owner','member','outsider']){const c=await browser.newContext({viewport:{width:1440,height:1000}});assert.equal((await c.request.post(origin+'/api/auth/test-login',{data:{identity}})).status(),200);contexts[identity]=c;}
 const created=await contexts.owner.request.post(origin+'/api/projects',{data:{name:'Owner website',requestId:crypto.randomUUID(),buildBranch:'template'}});assert.equal(created.status(),200);
 const job=await contexts.owner.request.post(origin+'/api/outreach/site-messages',{data:{name:'Owner contact task',senderName:'Test',senderEmail:'owner@example.test',message:'Business inquiry for authorized test',targets:['https://example.com'],authorized:true}});assert.equal(job.status(),201);
 const campaign=await contexts.owner.request.post(origin+'/api/outreach/campaigns',{data:{name:'Owner campaign',senderName:'Test',senderEmail:'owner@example.test'}});assert.equal(campaign.status(),201);
 assert.equal((await contexts.member.request.get(origin+'/api/management/members')).status(),403);
 const page=await contexts.admin.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/?view=users');await page.getByRole('heading',{name:'用户与业务数据',exact:true}).waitFor();await page.getByText('普通成员',{exact:true}).waitFor();assert.equal(await page.getByText('其他公司成员',{exact:true}).count(),0);
 const row=page.locator('tr').filter({has:page.getByText('普通成员',{exact:true})});await row.getByRole('button',{name:'权限设置'}).click();await page.locator('.modal select').first().selectOption('analyst');await page.getByRole('button',{name:'保存权限',exact:true}).click();await page.locator('.modal').waitFor({state:'detached'});
 const auth=await (await contexts.member.request.get(origin+'/api/auth/me')).json();assert.equal(auth.principal.appRole,'analyst');
 assert.equal((await contexts.member.request.get(origin+'/api/management/members')).status(),200);
 assert.equal((await contexts.member.request.post(origin+'/api/projects',{data:{name:'Denied',requestId:crypto.randomUUID()}})).status(),403);
 await page.getByRole('navigation',{name:'用户管理功能'}).getByRole('button',{name:'网站项目',exact:true}).click();await page.getByText('Owner website',{exact:true}).waitFor();
 await page.getByRole('navigation',{name:'用户管理功能'}).getByRole('button',{name:'EDM 邮件',exact:true}).click();await page.getByText('Owner campaign',{exact:true}).waitFor();
 await page.getByRole('navigation',{name:'用户管理功能'}).getByRole('button',{name:'站内信',exact:true}).click();await page.getByText('Owner contact task',{exact:true}).waitFor();
 await page.getByRole('button',{name:'查看明细',exact:true}).click();await page.getByText('https://example.com/',{exact:true}).waitFor();await page.getByLabel('关闭',{exact:true}).click();
 await page.getByRole('navigation',{name:'用户管理功能'}).getByRole('button',{name:'用户管理',exact:true}).click();await page.getByText('普通成员',{exact:true}).waitFor();await page.screenshot({path:out+'/users-desktop.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/users-mobile.png',fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);console.log('PASS: user directory, workspace isolation, role update, effective read-only permission, three business reports, task detail, desktop/mobile rendering. No real sends.');
}finally{await browser?.close();await worker?.dispose();}
