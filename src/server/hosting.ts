import { createProviders } from '../worker/providers';
import { hostingAccounts, pagesProjectName, publishPages } from '../worker/providers/pages';
import { ProviderSettings } from '../worker/provider-settings';
import { deploymentSelection, hostingProvider, matchesDeployment } from '../shared/deployment';
import type { Project } from '../shared/model';
import { ProviderError } from '../worker/provider-contract';
import { withPublicationMetadata } from '../worker/site-metadata';
import type { AppEnv } from '../worker/env';
import type { ProviderSet } from '../worker/provider-contract';
import type { DomainService } from '../worker/domain-service';

export function serverProviders(env:AppEnv):ProviderSet {
  const providers=createProviders(env);
  return {...providers,
    status:()=>providers.status().map(s=>s.name==='pages'?{...s,configured:true,mode:'live',detail:'独立服务器网站托管'}:s),
    resolveHostingTarget:async(id,current)=>{
      const row=await env.DB.prepare('SELECT data FROM projects WHERE id=?').bind(id).first<{data:string}>();
      if(!row)throw new ProviderError('project_not_found','网站不存在');
      const project=JSON.parse(row.data) as Project,selection=deploymentSelection(project,true);
      if(selection.provider==='server')return {provider:'server',accountId:'local-server',pagesProjectName:'wr-'+id};
      const fallback=!selection.accountId?hostingAccounts(env)[0]:undefined;
      const accountId=selection.accountId??fallback!.accountId;
      const credentialId=selection.credentialId??`environment-cloudflare:${accountId}`;
      await new ProviderSettings(env).hostingCredential(id,credentialId,accountId);
      if(current?.provider==='cloudflare'&&matchesDeployment(current,selection,true)&&current.pagesProjectName.startsWith('wrs-'))return {...current,credentialId};
      return {provider:'cloudflare',accountId,credentialId,pagesProjectName:(await pagesProjectName(`${env.SERVER_INSTANCE_ID||'server'}:${id}`)).replace(/^wr-/,'wrs-')};
    },
    publish:async(id,releaseId,files,old,target,previous,metadata)=>{
      if(target?.provider==='cloudflare') {
        if(!target.pagesProjectName.startsWith('wrs-'))throw new ProviderError('unsafe_hosting_target','不能覆盖原 Cloudflare 项目');
        const account=await new ProviderSettings(env).hostingCredential(id,target.credentialId!,target.accountId);
        return publishPages({...env,CLOUDFLARE_HOSTING_ACCOUNTS:JSON.stringify([account])},id,releaseId,files,old,target,previous,metadata);
      }
      const origin=`https://${id}.${env.SERVER_SITE_SUFFIX}`;
      const output=withPublicationMetadata(files,metadata?.origin??origin,{...metadata,origin:metadata?.origin??origin});
      await env.MEDIA.put(`server-sites/${id}/${releaseId}.json`,JSON.stringify(output),{httpMetadata:{contentType:'application/json'}});
      return {deploymentId:'server-'+releaseId,url:origin,testMode:false};
    }
  };
}
export async function hostedSite(request:Request,env:AppEnv,domain:DomainService,customProjectId?:string):Promise<Response> {
  const url=new URL(request.url),suffix='.'+env.SERVER_SITE_SUFFIX;
  if(!customProjectId&&(!env.SERVER_SITE_SUFFIX||!url.hostname.endsWith(suffix)))return new Response('Unknown host',{status:421});
  const id=customProjectId??url.hostname.slice(0,-suffix.length);
  if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Unknown website',{status:404});
  const row=await env.DB.prepare('SELECT data FROM projects WHERE id=?').bind(id).first<{data:string}>();
  const project=row?JSON.parse(row.data):null;
  if(!project||project.offline||!project.publishedReleaseId)return new Response('Website temporarily unavailable',{status:503});
  const releaseRow=await env.DB.prepare("SELECT data FROM releases WHERE id=? AND project_id=?").bind(project.publishedReleaseId,id).first<{data:string}>();
  const release=releaseRow?JSON.parse(releaseRow.data):null;
  if(release?.status!=='succeeded')return new Response('Website temporarily unavailable',{status:503});
  if(hostingProvider(release.hostingTarget,true)==='cloudflare'&&release.url) return Response.redirect(new URL(url.pathname+url.search,release.url),307);
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
    const files=await (domain as any).renderFiles(release.draft,{projectId:id,assetUrl:(assetId:string)=>`${(env.PUBLIC_SITE_ORIGIN||env.APP_ORIGIN)}/public/sites/${id}/assets/${assetId}`,inquiryUrl:`/api/public/sites/${id}/inquiries`,publicBaseUrl:`${(env.PUBLIC_SITE_ORIGIN||env.APP_ORIGIN)}/public/sites/${id}`});
    const binding=await env.DB.prepare("SELECT hostname FROM project_domains WHERE project_id=? AND status='active' ORDER BY created_at,hostname LIMIT 1").bind(id).first<{hostname:string}>();
    const publicOrigin=binding?'https://'+binding.hostname:`https://${id}.${env.SERVER_SITE_SUFFIX}`;
    await env.MEDIA.put(key,JSON.stringify(withPublicationMetadata(files,publicOrigin,{draft:release.draft,origin:publicOrigin,assetUrl:(assetId:string)=>`${(env.PUBLIC_SITE_ORIGIN||env.APP_ORIGIN)}/public/sites/${id}/assets/${assetId}`})));
    artifact=await env.MEDIA.get(key);
  }
  const files=await artifact!.json<Record<string,string>>();
  const path=url.pathname.slice(1)+(url.pathname.endsWith('/')?'index.html':'');
  if(!Object.hasOwn(files,path)||typeof files[path]!=='string')return new Response('Page not found',{status:404});
  const extension=path.split('.').pop()||'';
  const contentTypes:Record<string,string>={html:'text/html;charset=utf-8',css:'text/css;charset=utf-8',js:'text/javascript;charset=utf-8',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',xml:'application/xml',txt:'text/plain;charset=utf-8'};
  return new Response(request.method==='HEAD'?null:files[path],{headers:{'Content-Type':contentTypes[extension]||'application/octet-stream','Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff'}});
}
