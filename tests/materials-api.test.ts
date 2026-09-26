import { testDb } from './helpers/db';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {Hono}from'hono';
import {createTemplateGuidesApp}from'../src/worker/template-guides/api';
import {createIntegrationApp}from'../src/worker/integration';
import {materialsFixture}from'./fixtures/materials';
import type{AppEnv,HonoEnv}from'../src/worker/env';
import {templateMediaRequirements}from'../src/shared/template-media';

describe('materials guide account boundary',()=>{
  let env:AppEnv;let principal:Awaited<ReturnType<typeof materialsFixture>>['principal'];
  const app=new Hono<HonoEnv>().route('/api/internal/template-guides',createTemplateGuidesApp());
  beforeEach(async()=>{principal={...(await materialsFixture()).principal,email:'member@example.com',workspaceRole:'member'};env={DB:testDb(),PRODUCT_RADAR_BASE_URL:'https://product.example.com',PRODUCT_RADAR_INTEGRATION_SECRET:'s'.repeat(40),APP_ORIGIN:'https://web-radar.net'}as AppEnv;
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({protocolVersion:1,principal})));});
  afterEach(()=>vi.unstubAllGlobals());
  const get=(p:string,headers={})=>app.request('https://web-radar.net/api/internal/template-guides/'+p,{headers:{'X-Web-Radar-Secret':'s'.repeat(40),'X-Product-Radar-User-Id':'materials-owner','X-Product-Radar-Workspace-Id':'materials-workspace',...headers}},env);
  it('allows an ordinary Product Radar account without a Web Radar login and returns a non-publishing demo',async()=>{
    const catalog=await get('materials/catalog');expect(catalog.status).toBe(200);
    const entries=(await catalog.json()as any).templates;
    expect(entries.filter((t:any)=>t.materialsReady).map((t:any)=>t.templateId).sort()).toEqual(Object.keys(templateMediaRequirements).sort());
    expect(entries.every((t:any)=>t.contractRevision===`2026-09-23.${t.templateId}-materials.6`&&t.guideRevision===(t.templateId.startsWith('single-')?'2026-09-26.1':'2026-09-20.1'))).toBe(true);
    const req=await get('materials/juno-toys');expect(req.status).toBe(200);
    const p=await get('materials/juno-toys/preview?page=contact');expect(p.status).toBe(200);const b:any=await p.json();expect(/^<!doctype html>/i.test(b.html)).toBe(true);expect(b.html).toContain(' disabled');expect(b.assetBaseUrl).toBe('https://web-radar.net');
  });
  it('denies forged identity, missing identity and bad secret',async()=>{
    principal.userId='someone';expect((await get('materials/catalog')).status).toBe(403);
    expect((await get('materials/catalog',{'X-Product-Radar-User-Id':''})).status).toBe(400);
    expect((await get('materials/catalog',{'X-Web-Radar-Secret':'wrong'})).status).toBe(401);
  });
  it('serves the corrected Corpox hero while keeping frozen two-hero previews available',async()=>{
    const current=await get('materials/corpox-ai-agency'),profile=await current.json()as any;
    expect(profile.contractRevision).toBe('2026-09-23.corpox-ai-agency-materials.6');
    expect(profile.imageSlots.filter((slot:any)=>slot.id.startsWith('hero-slide-'))).toHaveLength(1);
    const revision='2026-09-20.corpox-ai-agency-materials.2';
    const old=await(await get(`materials/corpox-ai-agency?contractRevision=${revision}`)).json()as any;
    expect(old.imageSlots.filter((slot:any)=>slot.id.startsWith('hero-slide-'))).toHaveLength(2);
    for(const [suffix,count]of [["",1],[`?contractRevision=${revision}`,2]]as const){
      const preview=await(await get('materials/corpox-ai-agency/preview'+suffix)).json()as any;
      expect(preview.demo).toBe(true);
      expect((preview.html.match(/data-wr-collection-slide="/g)||[])).toHaveLength(count);
    }
  });
  it('does not grant the integration secret access to legacy template guides',async()=>{
    expect((await get('juno-toys')).status).toBe(401);
  });
  it('reads and previews exact legacy contracts while the catalog advertises typed regions',async()=>{
    const legacy='2026-09-17.juno-materials.2';
    const response=await get(`materials/juno-toys?contractRevision=${legacy}`);
    expect((await response.json()as any).contractRevision).toBe(legacy);
    const preview=await get(`materials/juno-toys/preview?contractRevision=${legacy}`);
    const body=await preview.json()as any;expect(body.contractRevision).toBe(legacy);expect(body.html).not.toContain('data-wr-display-role');
    expect((await get('materials/juno-toys?contractRevision=unknown')).status).toBe(404);
    expect((await get('materials/juno-toys/preview?contractRevision=unknown')).status).toBe(404);
    for(const[id,revision]of [['juno-toys','2026-09-18.juno-materials.3'],['senseng-clean','2026-09-17.senseng-clean-materials.1'],['senseng-video','2026-09-17.senseng-video-materials.2']]){
      const old=await get(`materials/${id}/preview?contractRevision=${revision}`);expect(old.status).toBe(200);expect((await old.json()as any).contractRevision).toBe(revision);
    }
  });
  it.each(Object.keys(templateMediaRequirements))('serves all five labelled, non-publishing previews for %s',async id=>{
    const requirements=await get(`materials/${id}`);expect(requirements.status).toBe(200);
    expect((await requirements.json()as any).imagePolicy).toBe('typed-regions-v1');
    for(const page of ['home','catalog','detail','about','contact']){
      const response=await get(`materials/${id}/preview?page=${page}`);expect(response.status,`${id}:${page}`).toBe(200);
      const body=await response.json()as any;expect(body.demo).toBe(true);expect(body.html.includes(id.startsWith('single-')?({'single-device-showcase':'FORM / 01','single-artisan-craft':'ATELIER / ONE','single-wellness-nordic':'STILL / STUDIO'} as Record<string,string>)[id]:'Example Brand')).toBe(true);
      if(page==='contact')expect(body.html.includes(' disabled')).toBe(true);
    }
  });
  it('previews the B2B materials branch without retail prices or fabricated testimonials',async()=>{
    const response=await get('materials/juno-toys/preview?page=home');const {html}=await response.json()as any;
    expect(html.includes('wr-materials-site')).toBe(true);
    expect(html.includes('Request product details')).toBe(true);
    for(const old of ['Shop now','Shop Now','Buy now','320.00','Mandy Mathers','Best Prices'])expect(html.includes(old)).toBe(false);
  });
  it('accepts ordinary account submissions with canonical roles and rejects invalid authority before forwarding',async()=>{
    const integration=createIntegrationApp(),input=await materialsFixture();let forwarded=0;
    env.PRODUCT_RADAR_PARENT_ORIGINS=input.parentOrigin;
    env.COORDINATOR={getByName:()=>({fetch:async(request:Request)=>{forwarded++;expect(JSON.parse(decodeURIComponent(request.headers.get('X-WR-Principal')!))).toEqual({...principal,appRole:'member'});return Response.json({state:'receiving'},{status:202});}})}as unknown as AppEnv['COORDINATOR'];
    const post=(path:string,body:unknown,secret='s'.repeat(40))=>integration.request('https://web-radar.net'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Web-Radar-Secret':secret},body:JSON.stringify(body)},env);
    const status=`/materials-submissions/${input.submissionId}/status`;
    expect((await post('/materials-submissions',input,'wrong')).status).toBe(401);
    principal.userId='someone';
    expect((await post('/materials-submissions',input)).status).toBe(403);
    expect((await post(status,{principal:input.principal})).status).toBe(403);expect(forwarded).toBe(0);
    principal.userId=input.principal.userId;
    expect((await post('/materials-submissions',{...input,parentOrigin:'https://evil.example'})).status).toBe(403);
    expect((await post('/materials-submissions',input)).status).toBe(202);
    expect((await post(status,{principal:input.principal})).status).toBe(202);expect(forwarded).toBe(2);
  });
});

it('catalog requirements and preview URLs lock exactly the advertised immutable revision and hash', async () => {
  const input = await materialsFixture();
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ protocolVersion: 1, principal: input.principal })));
  try {
    const env = { DB:testDb(), PRODUCT_RADAR_BASE_URL: 'https://product.example.com', PRODUCT_RADAR_INTEGRATION_SECRET: 's'.repeat(40) } as AppEnv;
    const app = createTemplateGuidesApp();
    const headers = { 'X-Web-Radar-Secret': 's'.repeat(40), 'X-Product-Radar-User-Id': input.principal.userId, 'X-Product-Radar-Workspace-Id': input.principal.workspaceId };
    const list = await (await app.request('https://web-radar.net/materials/catalog', { headers }, env)).json() as any;
    for (const entry of list.templates) {
      expect(new URL(entry.requirementsPath, 'https://web-radar.net').searchParams.get('contractRevision')).toBe(entry.contractRevision);
      expect(new URL(entry.previewPath, 'https://web-radar.net').searchParams.get('contractRevision')).toBe(entry.contractRevision);
      expect(entry.requiredCapabilities).toContain('image.product-primary.v1');
      expect(entry.contractSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  } finally { vi.unstubAllGlobals(); }
});
