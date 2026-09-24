import { afterEach, expect, it, vi } from 'vitest';
import { currentPrincipal, prRequest } from '../src/worker/product-radar';
import type { AppEnv } from '../src/worker/env';
import type { Principal } from '../src/shared/model';
const env = () => ({PRODUCT_RADAR_BASE_URL:'https://account.example.test',PRODUCT_RADAR_INTEGRATION_SECRET:'test-only-secret-longer-than-32-characters'}) as AppEnv;
const principal:Principal={userId:'u',workspaceId:'w',authSubject:'s',email:'u@example.test',displayName:'U',systemRole:'user',workspaceRole:'member',workspaceName:'W'};
const success=()=>Response.json({protocolVersion:1,principal});
afterEach(()=>vi.unstubAllGlobals());
it('retries a timed-out read-only context once and recovers',async()=>{
 const fetcher=vi.fn().mockRejectedValueOnce(new DOMException('timeout','TimeoutError')).mockResolvedValueOnce(success());vi.stubGlobal('fetch',fetcher);
 expect(await currentPrincipal(env(),principal)).toEqual(principal);expect(fetcher).toHaveBeenCalledTimes(2);
});
const interruptedBody=()=>new Response(new ReadableStream({start(controller){
 controller.enqueue(new TextEncoder().encode('{"protocolVersion":1,'));
 controller.error(new DOMException('body interrupted','AbortError'));
}}));
it('recovers when the context connection fails after response headers',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(interruptedBody()).mockResolvedValueOnce(success());vi.stubGlobal('fetch',fetcher);
 expect(await currentPrincipal(env(),principal)).toEqual(principal);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('shares one retry budget between header and body failures',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(interruptedBody());vi.stubGlobal('fetch',fetcher);
 await expect(currentPrincipal(env(),principal)).rejects.toMatchObject({status:502,code:'product_radar_unavailable'});expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([
 ()=>new Response('not json'),
 ()=>new Response('x'.repeat(2*1024*1024+1)),
 ()=>Response.json({protocolVersion:1,principal:{...principal,workspaceId:'wrong'}}),
])('does not retry malformed, oversized or mismatched identity responses',async response=>{
 const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(response()));vi.stubGlobal('fetch',fetcher);
 await expect(currentPrincipal(env(),principal)).rejects.toMatchObject({status:expect.any(Number)});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('retries transient upstream errors but keeps retries bounded',async()=>{
 const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(null,{status:503})));vi.stubGlobal('fetch',fetcher);
 await expect(currentPrincipal(env(),principal)).rejects.toMatchObject({status:503});expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([401,403,429])('never retries an upstream %i',async status=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(null,{status}));vi.stubGlobal('fetch',fetcher);
 await expect(currentPrincipal(env(),principal)).rejects.toMatchObject({status});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not replay other POSTs',async()=>{
 const fetcher=vi.fn().mockRejectedValue(new TypeError('network'));vi.stubGlobal('fetch',fetcher);
 await expect(prRequest(env(),'/api/web-radar/service/products',{})).rejects.toMatchObject({status:502});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('shares concurrent identity checks but checks revocation on the next request',async()=>{
 let resolve!:(value:Response)=>void;const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(r=>resolve=r));vi.stubGlobal('fetch',fetcher);
 const e=env();const first=currentPrincipal(e,principal),second=currentPrincipal(e,principal);
 expect(fetcher).toHaveBeenCalledTimes(1);resolve(success());await Promise.all([first,second]);
 fetcher.mockResolvedValueOnce(new Response(null,{status:403}));await expect(currentPrincipal(e,principal)).rejects.toMatchObject({status:403});expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not share checks between workspaces or retain failed checks',async()=>{
 const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(null,{status:403})));vi.stubGlobal('fetch',fetcher);const e=env();
 await Promise.allSettled([currentPrincipal(e,principal),currentPrincipal(e,{...principal,workspaceId:'other'})]);expect(fetcher).toHaveBeenCalledTimes(2);
 await expect(currentPrincipal(e,principal)).rejects.toMatchObject({status:403});expect(fetcher).toHaveBeenCalledTimes(3);
});
