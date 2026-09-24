import { createProviders } from '../worker/providers';
import { withPublicationMetadata } from '../worker/site-metadata';
import type { AppEnv } from '../worker/env';
import type { ProviderSet } from '../worker/provider-contract';
import type { DomainService } from '../worker/domain-service';

export function serverProviders(env:AppEnv):ProviderSet {
  const providers=createProviders(env);
  return {...providers,
    status:()=>providers.status().map(s=>s.name==='pages'?{...s,configured:true,mode:'live',detail:'独立服务器网站托管'}:s),
    resolveHostingTarget:async(id,current)=>current||{accountId:'local-server',pagesProjectName:'wr-'+id},
    publish:async(id,releaseId,files,_old,_target,_previous,metadata)=>{
      const origin=`https://${id}.${env.SERVER_SITE_SUFFIX}`;
      const output=withPublicationMetadata(files,origin,{...metadata,origin});
      await env.MEDIA.put(`server-sites/${id}/${releaseId}.json`,JSON.stringify(output),{httpMetadata:{contentType:'application/json'}});
      return {deploymentId:'server-'+releaseId,url:origin,testMode:false};
    }
  };
}
export async function hostedSite(request:Request,env:AppEnv,domain:DomainService):Promise<Response> {
  const url=new URL(request.url),suffix='.'+env.SERVER_SITE_SUFFIX;
  if(!env.SERVER_SITE_SUFFIX||!url.hostname.endsWith(suffix))return new Response('Unknown host',{status:421});
  const id=url.hostname.slice(0,-suffix.length);
  if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Unknown website',{status:404});
  const row=await env.DB.prepare('SELECT data FROM projects WHERE id=?').bind(id).first<{data:string}>();
  const project=row?JSON.parse(row.data):null;
  if(!project||project.offline||!project.publishedReleaseId)return new Response('Website temporarily unavailable',{status:503});
  const releaseRow=await env.DB.prepare("SELECT data FROM releases WHERE id=? AND project_id=?").bind(project.publishedReleaseId,id).first<{data:string}>();
  const release=releaseRow?JSON.parse(releaseRow.data):null;
  if(release?.status!=='succeeded')return new Response('Website temporarily unavailable',{status:503});
  if(request.method==='POST'&&url.pathname===`/api/public/sites/${id}/inquiries`) {
    const headers=new Headers(request.headers);headers.delete('cookie');headers.delete('authorization');headers.delete('x-wr-principal');
    return domain.fetch(new Request(new URL(url.pathname,env.APP_ORIGIN),{method:'POST',headers,body:request.body,duplex:'half'} as RequestInit));
  }
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
  if(url.pathname==='/'||url.pathname==='/index.html')return new Response(null,{status:302,headers:{Location:'/en/index.html','Cache-Control':'no-store'}});
  const key=`server-sites/${id}/${release.id}.json`;
  let artifact=await env.MEDIA.get(key);
  if(!artifact) {
    // Existing releases are rendered from the copied immutable snapshot, without
    // touching the original Pages deployment or initiating model generation.
    const files=await (domain as any).renderFiles(release.draft,{projectId:id,assetUrl:(assetId:string)=>`${env.APP_ORIGIN}/public/sites/${id}/assets/${assetId}`,inquiryUrl:`/api/public/sites/${id}/inquiries`,publicBaseUrl:`${env.APP_ORIGIN}/public/sites/${id}`});
    await env.MEDIA.put(key,JSON.stringify(withPublicationMetadata(files,url.origin,{draft:release.draft,origin:url.origin,assetUrl:(assetId:string)=>`${env.APP_ORIGIN}/public/sites/${id}/assets/${assetId}`})));
    artifact=await env.MEDIA.get(key);
  }
  const files=await artifact!.json<Record<string,string>>();
  const path=url.pathname.slice(1)+(url.pathname.endsWith('/')?'index.html':'');
  if(!Object.hasOwn(files,path)||typeof files[path]!=='string')return new Response('Page not found',{status:404});
  return new Response(request.method==='HEAD'?null:files[path],{headers:{'Content-Type':path.endsWith('.html')?'text/html;charset=utf-8':path.endsWith('.xml')?'application/xml':'text/plain','Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff'}});
}
