import { writeBusiness } from '../shared/access';
import {availableMaterialsTemplateReleases} from '../templates/materials-releases';
import type { Asset, Draft, Principal, Project } from '../shared/model';
import { retainedProductDisplayGroups } from '../shared/product-display';
import type { MaterialsReceipt, MaterialsSubmission } from '../shared/materials';
import { materialsSubmissionSchema } from '../shared/materials';
import { validateMaterialsPositions } from '../templates/materials';
import type { AppEnv } from './env';
import { ApiError, canonical, sha256 } from './http';
import { currentMaterialsPrincipal } from './materials-auth';
import { checkedMaterialsMedia } from './materials-media';
import { prRequest } from './product-radar';
import { canManage, defaultDraft, expectedVersion, validateDraft } from './domain';
import { DomainStore } from './domain-store';
import { WebsiteQuota } from './website-quota';

interface Operation {
  receipt:MaterialsReceipt;principal:Principal;projectId:string;snapshotKey:string;
  assets:Record<string,Asset>;createdAt:string;expiresAt:number;cleaned?:boolean;
}
interface Hooks {lock<T>(fn:()=>Promise<T>):Promise<T>;schedule(time:number):Promise<void>}
const receiveConcurrency=4,receiveTickLimit=32,receiveTickMs=10_000,receiveBatchBytes=20*1024*1024;
const time=()=>new Date().toISOString();
const scopeFor=async(p:Principal)=>'materials:'+await sha256(canonical([p.userId,p.workspaceId]));
/** Display equivalence survives an import only while every relevant visual is unchanged.
 * Asset IDs change between receipts, so compare verified bytes and binding positions. */
function productVisualFingerprint(draft:Draft,productId:string,hashes:Map<string,string|undefined>):string|undefined{
  const product=draft.products.find(p=>p.id===productId);if(!product?.imageAssetId)return;
  const refs:Array<[string,string|undefined]>=[['main',product.imageAssetId],...(product.gallery||[]).map((image,index)=>[`gallery:${index}`,image.assetId] as [string,string])];
  for(const b of draft.materials?.imageBindings.filter(b=>b.productId===productId)||[]){
    const key=`${b.slotId}:${b.itemIndex||0}`;refs.push([key,b.assetId]);if(b.mobileAssetId)refs.push([key+':mobile',b.mobileAssetId]);
  }
  const values=refs.map(([position,id])=>[position,id?hashes.get(id):undefined]);
  if(values.some(([,hash])=>!hash||!/^[a-f0-9]{64}$/i.test(hash)))return;
  return JSON.stringify(values.sort(([a],[b])=>a!.localeCompare(b!)));
}
export function draftFromMaterials(submission:MaterialsSubmission,assets:Record<string,Asset>,previous?:Draft,previousAssets:Asset[]=[]):Draft{
  const m=submission.materials,b=m.brand,c=m.contact,d=defaultDraft();
  const release=availableMaterialsTemplateReleases().find(item=>item.contract.templateId===m.template.id&&item.contract.contractRevision===m.template.contractRevision);
  const renderedSlot=(kind:'image'|'text',slotId:string)=>(kind==='image'?release?.imageSlotMap[slotId]:release?.textSlotMap[slotId])??slotId;
  const asset=(id:string|undefined)=>id?assets[id]?.id:undefined;
  d.buildBranch='template';d.templateConfirmed=true;d.template=m.template.id as Draft['template'];d.languages=[...m.locales];d.country=m.country;d.primaryProductId=m.primaryProductId;d.brandColor=m.visual.palette.primary;
  d.company={name:b.name,description:b.description,type:b.businessType||'trader',email:c.email,contactName:c.name,phone:c.phone||'',whatsapp:c.whatsapp||'',address:b.address||'',slogan:b.slogan||'',establishedYear:b.establishedYear||'',certifications:b.certifications||'',capabilities:b.capabilities||'',linkedin:b.linkedin||'',facebook:b.facebook||'',instagram:b.instagram||'',x:b.x||'',logoAssetId:asset(b.logoMediaId),faviconAssetId:asset(b.faviconMediaId)};
  for(const field of ['targetMarkets','customerTypes','cooperationProcess']as const)if(b[field]!==undefined)d.company[field]=b[field];
  for(const [slot,field]of [['about-headline','aboutHeadline'],['about-story','aboutStory'],['about-highlights','aboutHighlights']]as const)d.company[field]=m.textBindings.find(b=>renderedSlot('text',b.slotId)===slot&&b.locale==='en')?.text||'';
  for(const [slot,field]of [['about-primary-image','aboutImageAssetId'],['about-secondary-image','aboutSecondaryImageAssetId']]as const)d.company[field]=asset(m.imageBindings.find(b=>renderedSlot('image',b.slotId)===slot)?.mediaId);
  d.products=m.products.map(p=>({id:p.id,productIdentity:p.productIdentity,identitySourceVersion:p.sourceVersion,name:p.name,description:p.description,material:p.material,dimensions:p.dimensions,imageAssetId:asset(p.primaryMediaId),gallery:p.galleryMediaIds.map((id,i)=>({assetId:asset(id)!,sourceImageId:id,kind:i===0?'original':'detail',caption:m.imageBindings.find(b=>b.productId===p.id&&b.mediaId===id)?.alt.en||p.name})),tagline:p.tagline,sellingPoints:p.sellingPoints,applications:p.applications,translations:p.translations}));
  for(const lang of m.locales){const copy=(id:string)=>m.textBindings.find(b=>renderedSlot('text',b.slotId)===id&&b.locale===lang)?.text||'';d.copy[lang]={headline:copy('hero-headline'),subtitle:copy('hero-subtitle'),cta:copy('primary-cta'),about:copy('company-about')};}
  d.materials={templateId:m.template.id,contractRevision:m.template.contractRevision,visual:structuredClone(m.visual),...(m.displaySelection?{displaySelection:structuredClone(m.displaySelection)}:{}),imageBindings:m.imageBindings.map(({mediaId,mobileMediaId,evidenceMediaIds,...binding})=>({...binding,assetId:asset(mediaId)!,mobileAssetId:asset(mobileMediaId),...(evidenceMediaIds?{evidenceAssetIds:evidenceMediaIds.map(id=>asset(id)!)}:{})})),textBindings:structuredClone(m.textBindings),omittedSectionIds:[...m.omittedSectionIds]};
  const groups=retainedProductDisplayGroups(previous,d.products);
  if(groups&&previous){
    const oldHashes=new Map(previousAssets.map(a=>[a.id,a.sha256])),newHashes=new Map(Object.values(assets).map(a=>[a.id,a.sha256]));
    const unchanged=groups.filter(group=>group.every(id=>{const old=productVisualFingerprint(previous,id,oldHashes);return old!==undefined&&old===productVisualFingerprint(d,id,newHashes);}));
    if(unchanged.length)d.productDisplayGroups=unchanged;
  }
  return validateDraft(d);
}
/** Called only behind the Coordinator. Network copying runs outside its short mutation lock. */
export class MaterialsService {
  private active?:Promise<void>;
  constructor(readonly env:AppEnv,readonly store:DomainStore,readonly hooks:Hooks,readonly websiteQuota=new WebsiteQuota(env,store,time=>hooks.schedule(time))){}
  private async read(scope:string,id:string):Promise<{fingerprint:string;operation:Operation}|undefined>{
    const row=await this.env.DB.prepare('SELECT fingerprint,result FROM idempotency WHERE scope=? AND request_id=?').bind(scope,id).first<{fingerprint:string;result:string}>();
    return row?{fingerprint:row.fingerprint,operation:JSON.parse(row.result)}:undefined;
  }
  private update(scope:string,operation:Operation){return this.env.DB.prepare('UPDATE idempotency SET result=? WHERE scope=? AND request_id=?').bind(JSON.stringify(operation),scope,operation.receipt.submissionId);}
  private async target(principal:Principal,input:MaterialsSubmission):Promise<Project|undefined>{
    if(input.target.mode==='create')return;
    const project=await this.store.one<Project>('projects',input.target.projectId);
    if(!project||!canManage(project,principal))throw new ApiError(404,'project_not_found','项目不存在或没有访问权限。');
    if(!project.materials)throw new ApiError(409,'materials_project_required','仅可更新通过新版资料交接创建的项目。');
    expectedVersion(project,input.target.expectedVersion);
    if(project.materials.source.materialsId!==input.source.materialsId||project.materials.source.revision>=input.source.revision)throw new ApiError(409,'source_revision_conflict','更新必须是同一资料的新修订版本。');
    return project;
  }
  async submit(principal:Principal,raw:unknown):Promise<MaterialsReceipt>{
    const parsed=materialsSubmissionSchema.safeParse(raw);
    if(!parsed.success)throw new ApiError(400,'invalid_materials','已确认资料格式有误。');
    const input=parsed.data;
    if(input.principal.userId!==principal.userId||input.principal.workspaceId!==principal.workspaceId)throw new ApiError(403,'principal_mismatch','账号或工作区不匹配。');
    const digest=await sha256(canonical({source:input.source,materials:input.materials}));
    if(digest!==input.confirmation.contentSha256)throw new ApiError(409,'content_hash_conflict','资料内容与确认指纹不一致。');
    const scope=await scopeFor(principal),fingerprint=await sha256(canonical({contentSha256:digest,target:input.target,parentOrigin:input.parentOrigin}));
    const existing=await this.read(scope,input.submissionId);
    if(existing){
      if(existing.fingerprint!==fingerprint)throw new ApiError(409,'submission_payload_conflict','相同提交标识不能用于不同内容。');
      const operation=existing.operation;
      if(operation.receipt.state==='accepted'){
        const p=await this.store.one<Project>('projects',operation.projectId);
        if(!p||!canManage(p,principal))throw new ApiError(404,'project_not_found','已接收的项目已删除或无权访问。');
        const claim=await this.websiteQuota.find(scope,input.submissionId);if(claim)await this.websiteQuota.commit(claim);
      }
      if(operation.receipt.state==='failed'&&operation.receipt.retryable&&!operation.cleaned){
        const claim=await this.websiteQuota.find(scope,input.submissionId);if(claim)await this.websiteQuota.reserve(claim);
        await this.target(principal,input);operation.receipt.state='receiving';delete operation.receipt.error;delete operation.receipt.retryable;operation.principal=principal;
        await this.update(scope,operation).run();await this.hooks.schedule(Date.now()+1000);
      }
      return operation.receipt;
    }
    const issues=validateMaterialsPositions(input.materials);
    if(issues.length)throw new ApiError(issues.some(i=>i.code==='contract_revision_conflict')?409:422,issues[0].code,issues[0].message);
    const target=await this.target(principal,input);
    const claim=target?undefined:await this.websiteQuota.intent(principal,scope,input.submissionId,fingerprint);
    if(claim)await this.websiteQuota.reserve(claim);
    const projectId=target?.id||claim!.projectId;
    const snapshotKey=`materials/${scope.slice(10)}/${input.submissionId}/confirmed.json`;
    const operation:Operation={principal,projectId,snapshotKey,createdAt:time(),expiresAt:Date.now()+7*24*3600*1000,assets:{},receipt:{schemaVersion:'wr-materials-receipt-v1',submissionId:input.submissionId,state:'receiving',contentSha256:digest,receivedMedia:0,totalMedia:input.materials.media.length,autoPublish:false}};
    await this.env.MEDIA.put(snapshotKey,JSON.stringify(input),{httpMetadata:{contentType:'application/json'}});
    try{await this.store.remember(scope,input.submissionId,fingerprint,operation).run();}catch(error){
      const durable=await this.read(scope,input.submissionId);
      if(!durable){await this.env.MEDIA.delete(snapshotKey);if(claim)await this.websiteQuota.release(claim).catch(()=>{});throw error;}
    }
    await this.hooks.schedule(Date.now()+1000);return operation.receipt;
  }
  async status(principal:Principal,id:string):Promise<MaterialsReceipt>{
    const row=await this.read(await scopeFor(principal),id);
    if(!row)throw new ApiError(404,'materials_submission_not_found','没有该资料提交记录。');
    if(row.operation.receipt.state==='accepted'){
      const p=await this.store.one<Project>('projects',row.operation.projectId);
      if(!p||!canManage(p,principal))throw new ApiError(404,'project_not_found','已接收的项目已删除或无权访问。');
      const claim=await this.websiteQuota.find(await scopeFor(principal),id);if(claim)await this.websiteQuota.commit(claim);
    }
    return row.operation.receipt;
  }
  tick():Promise<void>{
    if(!this.active)this.active=this.runTick().finally(()=>{this.active=undefined;});return this.active;
  }
  private async runTick(){
    const rows=await this.env.DB.prepare("SELECT scope,result FROM idempotency WHERE scope LIKE 'materials:%' AND json_extract(result,'$.receipt.state') != 'accepted' AND json_extract(result,'$.cleaned') IS NULL ORDER BY CASE WHEN json_extract(result,'$.receipt.state') = 'receiving' THEN 0 ELSE 1 END, json_extract(result,'$.expiresAt') LIMIT 50").all<{scope:string;result:string}>();
    const operations=rows.results.map(r=>({scope:r.scope,operation:JSON.parse(r.result)as Operation}));
    for(const {scope,operation}of operations){
      if(operation.expiresAt<Date.now()){
        await this.cleanup(operation);operation.cleaned=true;operation.receipt={...operation.receipt,state:'failed',retryable:false,error:{code:'submission_expired',message:'未完成的资料接收已过期，请重新确认并提交。'}};
        await this.update(scope,operation).run();
        await this.hooks.lock(async()=>{const claim=await this.websiteQuota.find(scope,operation.receipt.submissionId);if(claim)await this.websiteQuota.release(claim);}).catch(()=>{});
      }
    }
    const selected=operations.find(r=>!r.operation.cleaned&&r.operation.receipt.state==='receiving');
    if(!selected){const expiry=operations.filter(r=>!r.operation.cleaned).map(r=>r.operation.expiresAt);if(expiry.length)await this.hooks.schedule(Math.min(...expiry));return;}
    const {scope,operation}=selected;
    const deadline=Date.now()+receiveTickMs;
    try{
      const principal=await currentMaterialsPrincipal(this.env,operation.principal);
      if(!writeBusiness(principal))throw new ApiError(403,'read_only_role','当前角色不能接收或修改项目资料。');
      const source=await this.env.MEDIA.get(operation.snapshotKey);
      if(!source)throw new ApiError(409,'materials_snapshot_missing','已确认资料快照不存在。');
      const input=materialsSubmissionSchema.parse(JSON.parse(await source.text()));
      const pending=input.materials.media.map((media,index)=>({media,index})).filter(({media})=>!operation.assets[media.id]);
      let offset=0;
      while(offset<pending.length&&offset<receiveTickLimit&&(offset===0||Date.now()<deadline)){
        const batch:typeof pending=[];let bytes=0;
        // Limit both buffered image bytes and work per tick; large images receive alone.
        while(offset<pending.length&&offset<receiveTickLimit&&batch.length<receiveConcurrency){
          const next=pending[offset];if(batch.length&&bytes+next.media.bytes>receiveBatchBytes)break;
          batch.push(next);bytes+=next.media.bytes;offset++;
        }
        const results=await Promise.allSettled(batch.map(async({media,index})=>{
          const assetId=`materials-${input.submissionId}-${index}`,key=`projects/${operation.projectId}/assets/${assetId}`;
          const saved=await this.env.MEDIA.head(key);
          if(!saved||saved.customMetadata?.sha256!==media.sha256||saved.size!==media.bytes){
            const response=await prRequest(this.env,'/api/web-radar/service/material-assets',{userId:principal.userId,workspaceId:principal.workspaceId,materialsId:input.source.materialsId,revision:input.source.revision,assetId:media.sourceAssetId,expectedVersion:media.sourceVersion,expectedSha256:media.sha256});
            const bytes=await checkedMaterialsMedia(response,media);
            await this.env.MEDIA.put(key,bytes,{httpMetadata:{contentType:media.mimeType},customMetadata:{sha256:media.sha256}});
          }
          await this.hooks.lock(async()=>{
            operation.assets[media.id]={id:assetId,projectId:operation.projectId,key,contentType:media.mimeType,size:media.bytes,sha256:media.sha256,filename:`${media.id}.${media.mimeType.split('/')[1]}`,origin:'import',createdAt:operation.createdAt};
            operation.receipt.receivedMedia=Object.keys(operation.assets).length;
            await this.update(scope,operation).run();
          });
        }));
        // Finish every copy/checkpoint before failure or cleanup. A permanent error
        // must not become retryable just because another request failed first.
        const errors=results.filter((result):result is PromiseRejectedResult=>result.status==='rejected').map(result=>result.reason);
        if(errors.length)throw errors.find(error=>error instanceof Error&&'status'in error&&'code'in error&&Number(error.status)<500&&Number(error.status)!==429)??errors[0];
      }
      if(operation.receipt.receivedMedia===operation.receipt.totalMedia){
        const current=await currentMaterialsPrincipal(this.env,principal);
      if(!writeBusiness(current))throw new ApiError(403,'read_only_role','当前角色不能接收或修改项目资料。');
        await this.hooks.lock(async()=>{
          const target=await this.target(current,input);
          const previousAssets=target?.draft.productDisplayGroups?.length?await this.store.list<Asset>('assets','project_id=?',[target.id]):[];
          const draft=draftFromMaterials(input,operation.assets,target?.draft,previousAssets);
          const project:Project={...(target||{id:operation.projectId,ownerId:current.userId,workspaceId:current.workspaceId,name:input.target.mode==='create'?input.target.name:'',version:0,createdAt:operation.createdAt,offline:false}),draft,version:(target?.version||0)+1,updatedAt:time(),materials:{submissionId:input.submissionId,source:input.source,contentSha256:operation.receipt.contentSha256,snapshotKey:operation.snapshotKey,acceptedAt:time()}};
          operation.receipt={...operation.receipt,state:'accepted',projectId:project.id,projectVersion:project.version,nextAction:'open-web-radar',entry:'prepared-materials'};
          const claim=target?undefined:await this.websiteQuota.find(scope,input.submissionId);
          await this.store.batch([target?this.store.update('projects',project):this.store.insert('projects',project),...Object.values(operation.assets).map(a=>this.store.insert('assets',a)),this.update(scope,operation),...(claim?[this.websiteQuota.statement(claim,'commit')]:[])]);
          if(claim)await this.websiteQuota.commit(claim);
        });
      }
    }catch(error){
      // A lost D1 response can follow a successful atomic commit. Never turn its
      // accepted receipt into failure or delete the project's referenced media.
      const durable=await this.read(scope,operation.receipt.submissionId);
      if(durable?.operation.receipt.state==='accepted'){await this.hooks.schedule(Date.now()+1000);return;}
      const known=error instanceof Error&&'status'in error&&'code'in error;
      const status=known?Number(error.status):503,code=known?String(error.code):'materials_receive_failed';
      operation.receipt={...operation.receipt,state:'failed',retryable:status>=500||status===429,error:{code,message:known?error.message:'资料接收暂时失败，可以重试。'}};
      if(!operation.receipt.retryable){await this.cleanup(operation);operation.cleaned=true;await this.hooks.lock(async()=>{const claim=await this.websiteQuota.find(scope,operation.receipt.submissionId);if(claim)await this.websiteQuota.release(claim);}).catch(()=>{});}
      await this.hooks.lock(()=>this.update(scope,operation).run());
    }
    await this.hooks.schedule(Date.now()+1000);
  }
  private async cleanup(operation:Operation){
    const snapshot=await this.env.MEDIA.get(operation.snapshotKey);
    const input=snapshot?materialsSubmissionSchema.parse(JSON.parse(await snapshot.text())):undefined;
    // Include a successfully copied object whose progress write was interrupted.
    const keys=input?.materials.media.map((_,index)=>`projects/${operation.projectId}/assets/materials-${operation.receipt.submissionId}-${index}`)||Object.values(operation.assets).map(a=>a.key);
    await this.env.MEDIA.delete([...keys,operation.snapshotKey]);
  }
}
