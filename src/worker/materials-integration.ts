import type {Hono,Context} from 'hono';
import {z} from 'zod';
import type {HonoEnv} from './env';
import {materialsPrincipalSchema,materialsSubmissionSchema} from '../shared/materials';
import {currentMaterialsPrincipal,verifyMaterialsSecret} from './materials-auth';
import {ApiError,jsonBody} from './http';
import {parentOrigins} from './product-radar';

export function registerMaterialsIntegration(app:Hono<HonoEnv>){
  const forward=async(c:Context<HonoEnv>,path:string,principal:Awaited<ReturnType<typeof currentMaterialsPrincipal>>,body:unknown)=>{
    const response=await c.env.COORDINATOR.getByName('global').fetch(new Request('https://coordinator.internal/internal/materials-submissions'+path,{method:'POST',headers:{'Content-Type':'application/json','X-WR-Principal':encodeURIComponent(JSON.stringify(principal))},body:JSON.stringify(body)}));
    return response;
  };
  app.post('/materials-submissions',async(c)=>{
    await verifyMaterialsSecret(c.req.raw,c.env);
    const parsed=materialsSubmissionSchema.safeParse(await jsonBody(c.req.raw,1024*1024));
    if(!parsed.success)return c.json({code:'invalid_materials',message:'已确认资料格式有误。',issues:parsed.error.issues.map(i=>({path:i.path.join('.'),code:i.code,message:i.message}))},400);
    if(!parentOrigins(c.env).includes(parsed.data.parentOrigin))throw new ApiError(403,'origin_forbidden','此来源不允许打开 Web Radar。');
    const principal=await currentMaterialsPrincipal(c.env,parsed.data.principal);
    const { appRole: _localRole, ...externalPrincipal } = principal;
    return forward(c,'',principal,{...parsed.data,principal:externalPrincipal});
  });
  app.post('/materials-submissions/:id/status',async(c)=>{
    await verifyMaterialsSecret(c.req.raw,c.env);
    const parsed=z.strictObject({principal:materialsPrincipalSchema}).safeParse(await jsonBody(c.req.raw));
    if(!parsed.success||!z.uuid().safeParse(c.req.param('id')).success)throw new ApiError(400,'invalid_materials_status','资料接收查询参数无效。');
    const principal=await currentMaterialsPrincipal(c.env,parsed.data.principal);
    return forward(c,'/'+encodeURIComponent(c.req.param('id'))+'/status',principal,{});
  });
}
