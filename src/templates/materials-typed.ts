import {parse,parseFragment,serialize,type DefaultTreeAdapterMap} from 'parse5';
import type {Draft,TemplateId} from '../shared/model';
import {materialsPages,type MaterialsTemplateContract,type AppliedMaterials} from '../shared/materials';
import {templateMediaRequirements} from '../shared/template-media';
import {renderSite,type RenderOptions} from './index';
import {referenceLayouts} from './themes/referenceLayouts';
import {getMaterialsTemplate} from './materials';
import {junoDisplayRevision} from './juno-display';
import {materialImage,materialBackgroundUrl,materialsThemeStyle} from './materials-render';
import {esc,safeUrl,productPath} from './themes/types';
import {materialsRuntime} from '../shared/materials-runtime';
import {labels} from './labels';
import {markPresentationRegions,polishTypedMaterials} from './materials-presentation';

type Node=DefaultTreeAdapterMap['node'];
type Element=DefaultTreeAdapterMap['element'];
type Page=typeof materialsPages[number];
type ImageSlot=MaterialsTemplateContract['imageSlots'][number];
type Binding=AppliedMaterials['imageBindings'][number];
const rawDrafts=new WeakSet<Draft>();
const modernAboutDrafts=new WeakSet<Draft>();
export const isModernAboutSource=(draft:Draft)=>modernAboutDrafts.has(draft);
/** Internal render context, never serialized into a project or exposed to standalone builds. */
export const isTypedMaterialsSource=(draft:Draft)=>rawDrafts.has(draft);
export const modernMaterialsRevision=(id:string)=>`2026-09-20.${id}-materials.2`;
const aiAgencyHeroRevision='2026-09-21.corpox-ai-agency-materials.3';
export const isTypedMaterials=(draft:Draft)=>draft.materials?.contractRevision===`2026-09-19.${draft.template}-materials.1`||draft.materials?.contractRevision===modernMaterialsRevision(draft.template)||(draft.template==='corpox-ai-agency'&&draft.materials?.contractRevision===aiAgencyHeroRevision)||!!(draft.materials&&getMaterialsTemplate(draft.template,draft.materials.contractRevision)?.requiredCapabilities?.length);
const attr=(node:Element,name:string)=>node.attrs.find(a=>a.name===name)?.value||'';
const set=(node:Element,name:string,value:string)=>{const a=node.attrs.find(a=>a.name===name);if(a)a.value=value;else node.attrs.push({name,value});};
const clean=(s:string)=>s.trim().replace(/\s+/g,' ');
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(36);};
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,46)||'content';
const key=(text:string,attribute='')=>`${attribute}:${clean(text)}`;
const remove=(n:Node)=>{if('parentNode'in n&&n.parentNode)n.parentNode.childNodes=n.parentNode.childNodes.filter(c=>c!==n);};
const elements=(node:Node):Element[]=>{const out:Element[]=[];const visit=(n:Node)=>{if('tagName'in n)out.push(n);if('childNodes'in n)n.childNodes.forEach(visit);};visit(node);return out;};
const base={min:1,max:1,required:true,binding:'supported' as const,repeat:'once' as const};
const factualPolicy='Use only saved customer, brand, contact and product facts. Never invent certifications, laboratory reports, factory area, MOQ, years, sales, testimonials or customer names. Replace unsupported sample claims with a neutral factual heading; omit unsupported content.';
const textSlot=(id:string,page:Page,purpose:string,maxCodePoints=300,exampleText?:string):MaterialsTemplateContract['textSlots'][number]=>({...base,id,page,purpose,maxCodePoints,maxLines:maxCodePoints>100?6:3,factualPolicy,...(exampleText?{exampleText}:{})});
const imageSlot=(id:string,page:Page,role:NonNullable<ImageSlot['role']>,width:number,height:number,purpose:string):ImageSlot=>({...base,id,page,role,width,height,purpose,fit:role==='collection'?'cover':'contain',sourcePolicy:role==='facility'||role==='logistics'?'illustration':'product-reference',allowedMimeTypes:['image/png','image/jpeg','image/webp'],composition:role==='collection'?'Include every selected product, preserving its real appearance. Each public banner must have a distinct composition; leave room for live text.':role==='facility'||role==='logistics'?'Illustration of the approved business process. It may be AI generated but must not claim an actual factory, certificate, report, capacity or location. No selected product is required.':`Only the bound product, shown as ${role}. Preserve the real shape, color and markings. Reuse a matching source image before generating anything. Never mix image roles in this region.`,mobileComposition:'Preserve the complete subject and image role on narrow screens; use a separate mobile crop when required.'});
interface MediaTarget{slotId:string;index:number;group?:boolean;kind:'image'|'background'|'video';}
interface Inventory{contract:MaterialsTemplateContract;text:Record<string,Record<string,string>>;media:Record<string,Record<string,MediaTarget>>;legacyText?:Record<string,string[]>;}
const inventories=new Map<string,Inventory>();
function demo(id:TemplateId):Draft{
  const products=Array.from({length:20},(_,i)=>({id:`sample-${i}`,name:`__WR_PRODUCT_NAME_${i}__`,description:`__WR_PRODUCT_DESCRIPTION_${i}__`,material:`__WR_MATERIAL_${i}__`,dimensions:`__WR_DIMENSIONS_${i}__`,imageAssetId:`sample-${i}`,gallery:[{assetId:`sample-${i}`,sourceImageId:`sample-${i}`,kind:'original' as const,caption:'__WR_MAIN__'},{assetId:`gallery-${i}`,sourceImageId:`gallery-${i}`,kind:'detail' as const,caption:'__WR_GALLERY__'}]}));
  return{template:id,company:{name:'__WR_COMPANY__',description:'__WR_DESCRIPTION__',type:'trader',email:'__WR_EMAIL__@example.invalid',contactName:'__WR_CONTACT__',phone:'__WR_PHONE__',whatsapp:'__WR_WHATSAPP__',address:'__WR_ADDRESS__',slogan:'__WR_SLOGAN__',capabilities:'__WR_CAPABILITIES__',certifications:'__WR_CERTIFICATIONS__',facebook:'',instagram:'',x:''},products,primaryProductId:'sample-0',country:'__WR_COUNTRY__',category:'',languages:['en'],brandColor:'#112233',copy:{en:{headline:'__WR_HEADLINE__',subtitle:'__WR_SUBTITLE__',about:'__WR_ABOUT__',cta:'__WR_CTA__'}},duration:8,direction:'',script:'',scriptRevision:0,scenes:[],storyboardRevision:0,heroAccepted:false};
}
function rawHtml(draft:Draft,options:RenderOptions,modernAbout=false):string{
  const raw={...draft,materials:undefined,heroAssetId:undefined,banner:undefined,banners:undefined};
  if(modernAbout){
    // Bind by stable position even when two slots reuse the same asset URL.
    raw.company={...raw.company,aboutImageAssetId:'__WR_ABOUT_PRIMARY__',aboutSecondaryImageAssetId:'__WR_ABOUT_SECONDARY__'};
    const aboutOptions={...options,assetUrl:(id:string)=>id==='__WR_ABOUT_PRIMARY__'?'/__WR_ABOUT__/about-primary-image':id==='__WR_ABOUT_SECONDARY__'?'/__WR_ABOUT__/about-secondary-image':options.assetUrl(id)};
    modernAboutDrafts.add(raw);try{return renderSite(raw,aboutOptions);}finally{modernAboutDrafts.delete(raw);}
  }
  rawDrafts.add(raw);
  try{return renderSite(raw,options);}finally{rawDrafts.delete(raw);}
}
function withoutOptionalFacts(draft:Draft):Draft{
  return{...draft,company:{...draft.company,description:'',address:'',phone:'',whatsapp:'',slogan:'',capabilities:'',certifications:'',establishedYear:''},products:draft.products.map(p=>({...p,description:'',material:'',dimensions:'',tagline:undefined,sellingPoints:undefined,applications:undefined})),copy:{...draft.copy,en:{...draft.copy.en!,about:''}}};
}
/** Remove unsupported endorsements and numeric writers before inventory AND filling. */
function prepare(root:Node){
  for(const node of elements(root)){
    const cls=attr(node,'class');
    if(/(?:testimonial|trusted-client|brand-area|brand-wrapper|brand-style|client-box|profile-share|rating|stars-wrapper|review-item|customer-review|partner-logo|clients-logo|certificate|certification-card|pricing-table|price-table)/i.test(cls)&&!node.childNodes.some(n=>'tagName'in n&&n.tagName==='main')){remove(node);continue;}
    if(node.tagName==='script'||node.tagName==='style')continue;
    node.attrs=node.attrs.filter(a=>!/^data-(?:counter|count|to|suffix|prefix|progress|percent|percentage|purecounter(?:-.+)?|countdown)$/.test(a.name));
    const className=cls.split(/\s+/).filter(c=>!['odometer','timer','counter'].includes(c)).join(' ');if(className!==cls)set(node,'class',className);
    if(node.tagName==='video'){node.childNodes=node.childNodes.filter(n=>!('tagName'in n&&n.tagName==='source'));node.attrs=node.attrs.filter(a=>!['src','autoplay',...(node.attrs.some(a=>a.name==='data-sp-video')?[]:['loop'])].includes(a.name));}
    if(node.tagName==='img'&&attr(node,'src').includes('/templates/')&&/avatar|logo|brand image|customer|testimonial|team-member|trusted partner/i.test(attr(node,'alt')+' '+cls)){remove(node);continue;}
    if(node.tagName==='a'&&/^https?:\/\//.test(attr(node,'href'))&&!/mailto:|tel:/.test(attr(node,'href'))&&(/theme|themeforest|wordpress|themerex|corpox|porto|crafto|juno/i.test(attr(node,'href')))){
      set(node,'href','contact/index.html');set(node,'data-wr-page','contact');
    }
  }
}
function coreText():MaterialsTemplateContract['textSlots']{
  return[textSlot('hero-headline','home','Approved B2B collection headline',100),textSlot('hero-subtitle','home','Approved B2B introduction',260),textSlot('primary-cta','home','Inquiry call to action',36),textSlot('company-about','about','Company introduction from saved facts',2500),...materialsPages.flatMap(p=>[textSlot(`${p}-seo-title`,p,'Search title',70),textSlot(`${p}-seo-description`,p,'Search description',170)])];
}
const newSenseng=/^senseng-(?:candy|wonder|arcade|nature|minimal)$/;
const hasFixedInnerColumns=(draft:Draft,options:RenderOptions)=>['saas-automation','fintech-platform','digital-marketing'].includes(draft.template)&&['about','contact'].includes(options.page);
/** Confirmed copy can be longer than a theme's demo labels. Keep complete labels
 * visible while retaining the original desktop header and standalone renderer. */
const typedMobileHeaderStyle=`<style id="wr-typed-mobile-header">
@media(max-width:767px){
 .wr-materials-site:is(.corpox-ai-agency,.corpox-consulting) .logo .wr-reference-brand{display:flex!important;align-items:center;line-height:1.2!important;height:100%;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere}
 .wr-materials-site [data-wr-typed-inner-grid]{grid-template-columns:minmax(0,1fr)!important;min-width:0;max-width:100%;overflow-wrap:anywhere}
 .wr-materials-site [data-wr-typed-inner-grid]>*{min-width:0;max-width:100%;grid-column:auto!important}
 .wr-materials-site [data-wr-typed-inner-grid] :is(input:not([type="checkbox"]):not([type="radio"]),select,textarea){min-width:0;max-width:100%;width:100%;box-sizing:border-box}
}
</style>`;
function region(node:Element,ancestors:Element[]):string{
  const chain=[...ancestors,node];
  const scope=[...chain].reverse().find(n=>n.tagName==='section'||attr(n,'data-id'))||[...chain].reverse().find(n=>/hero|banner|portfolio-area|service-wrapper|process-wrapper|feature-wrapper|about-wrapper/.test(attr(n,'class')));
  if(!scope)return'layout';
  if(attr(scope,'data-id')||attr(scope,'id'))return attr(scope,'data-id')||attr(scope,'id');
  const path=chain.slice(0,chain.indexOf(scope)+1).map(n=>`${n.tagName}:${n.parentNode?.childNodes.filter(c=>'tagName'in c&&c.tagName===n.tagName).indexOf(n)||0}`).join('/');
  return `${attr(scope,'class')||scope.tagName}-${hash(path)}`;
}
const legacyBannerSizes: Partial<Record<TemplateId,string>> = {
  'fintech-platform':'2560 × 1070',
  'digital-marketing':'2560 × 960',
  'porto-accounting':'2560 × 770',
  'crafto-corporate':'2560 × 960',
  'juno-toys':'2560 × 1040',
  'corpox-consulting':'2560 × 910',
};
function geometry(id:string):[number,number]{const bannerSize=templateMediaRequirements[id as TemplateId]?.bannerSize || legacyBannerSizes[id as TemplateId] || '2560 × 1000';const m=bannerSize.match(/(\d+)\s*×\s*(\d+)/)!;return[Number(m[1]),Number(m[2])];}
/** DOM keys describe persistent layout slots, never the selected product's transient source URL. */
function walkMedia(root:Node,id:string,page:Page,visit:(node:Element,target:string,spec:ImageSlot,ancestors:Element[],kind:MediaTarget['kind'])=>void,preferExplicitHero=false){
  const layout=referenceLayouts[id as keyof typeof referenceLayouts];
  const [bw,bh]=geometry(id);let heroIndex=0,wonderIndex=0,firstSection=false;
  const walk=(n:Node,parents:Element[])=>{
    if(!('tagName'in n)){if('childNodes'in n)for(const c of [...n.childNodes])walk(c,parents);return;}
    if(['script','style','svg'].includes(n.tagName))return;
    const cls=attr(n,'class'),src=attr(n,'src'),slotIndex=attr(n,'data-wr-product-slot'),style=attr(n,'style');
    const firstContentSection=page==='home'&&!firstSection&&n.tagName==='section'&&!parents.some(p=>p.tagName==='header'||p.tagName==='footer');
    if(firstContentSection)firstSection=true;
    const slide=n.attrs.some(a=>a.name==='data-wr-slide');
    const sensengHero=page==='home'&&(newSenseng.test(id)?cls.split(/\s+/).includes(`wr-${id.slice(8)}-hero`):id==='senseng-video'&&cls.split(/\s+/).includes('senseng-hero-video-full'));
    // A later product section is not another hero when the template already supplied one.
    // Keep the old heuristic only for contracts that froze its two-slot inventory.
    const genericHero=page==='home'&&((firstContentSection&&(!preferExplicitHero||heroIndex===0)&&!/senseng|crafto|juno|consulting/.test(id))||(id==='corpox-ai-agency'&&cls.split(/\s+/).includes('ai-agency-demo-banner')));
    if(slide||sensengHero||genericHero){
      const single=id.startsWith('single-');
      const slot=imageSlot(`hero-slide-${heroIndex++}`,'home',single?'scene':'collection',bw,bh,single?'Homepage hero showing only the selected primary product':'Homepage collection banner; every selected product in a distinct composition');
      if(single){
        const media=elements(n).find(child=>child.tagName==='video')||elements(n).find(child=>child.tagName==='img');
        if(media)visit(media,slot.id,slot,[...parents,n],media.tagName==='video'?'video':'image');
      }else visit(n,slot.id,slot,parents,'background');
    }
    if(n.tagName==='img'&&slotIndex!==''&&layout){
      const raw=layout.slots[Number(slotIndex)];
      if(raw){const r=region(n,parents);const role:ImageSlot['role']=/about|company|process|reminder|triggers/i.test(raw.alt)?'facility':'scene';
        const slot=imageSlot(`${page}-${slug(r)}-${role}-${raw.width}x${raw.height}-${hash(r)}`,page,role,raw.width,raw.height,`${page} original image region: ${raw.alt}; ${role==='facility'?'approved company-process illustration':'same-role product presentation'}`);
        if(role==='scene'){slot.repeat='per-product';slot.maxProducts=1;}
        else slot.id=`${page}-facility-${hash(raw.src)}`;
        visit(n,`reference-${slotIndex}`,slot,parents,'image');
      }
    }else if(n.tagName==='img'&&src.includes('/templates/senseng/')&&!/logo|hero-sky/.test(src)){
      const isHero=src.endsWith('/hero-bg.jpg');const slot=imageSlot(isHero?'hero-slide-0':`${page}-collection-banner`,page,'collection',isHero?bw:1536,isHero?bh:1024,`${page} collection composition, with every selected product`);visit(n,`senseng-${src.split('/').at(-1)}`,slot,parents,'image');
    }else if(id==='senseng-wonder'&&page==='home'&&n.tagName==='img'&&src&&parents.some(p=>attr(p,'id')==='wonder-bento'||p.tagName==='section'&&attr(p,'class').split(/\s+/).includes('wrap'))&&!parents.some(p=>/wr-wonder-card/.test(attr(p,'class')))){
      const slot=imageSlot('home-editorial-scenes','home','scene',1200,1200,'Single-product editorial scenes; one distinct selected product per display, no repeated filler');slot.repeat='per-product';slot.maxProducts=4;visit(n,`wonder-editorial-${wonderIndex++}`,slot,parents,'image');
    }
    // The original theme's wide CTA picture is a public collection banner too.
    if(!slide&&!sensengHero&&!genericHero&&/url\(/.test(style)&&!/hero-sky|gradient/.test(style)&&(/bg-cta|h-450px/.test(cls)||parents.some(p=>/bg-cta/.test(attr(p,'class'))))){const slot=imageSlot(`${page}-collection-${hash(region(n,parents))}`,page,'collection',bw,bh,'Public collection banner; include all selected products, distinct from every hero');visit(n,slot.id,slot,parents,'background');}
    for(const child of [...n.childNodes])walk(child,[...parents,n]);
  };walk(root,[]);
}
function walkCopy(root:Node,onText:(text:string,attribute:string,node:Node,parents:Element[])=>string,modern=false){
  const visit=(n:Node,parents:Element[])=>{
    if('tagName'in n){
      if(['script','style','title',...(modern?[]:['svg'])].includes(n.tagName))return;
      for(const a of n.attrs)if(['placeholder','aria-label','title'].includes(a.name)&&a.value&&!(modern?/^__WR_\w+__$|sample-\d|gallery-\d/:/__WR_|sample-\d|gallery-\d/).test(a.value))a.value=onText(a.value,a.name,n,parents);
      for(const c of [...n.childNodes])visit(c,[...parents,n]);
    }else if(n.nodeName==='#text'){
      if(clean(n.value)&&/[\p{L}\p{N}]/u.test(n.value)&&!(modern?/^__WR_\w+__$/:/__WR_/).test(clean(n.value)))n.value=onText(n.value,'',n,parents);
    }else if('childNodes'in n)for(const c of [...n.childNodes])visit(c,parents);
  };visit(root,[]);
}
function junoInventory():Inventory{
  const contract=structuredClone(getMaterialsTemplate('juno-toys',junoDisplayRevision)!);
  contract.guideRevision='2026-09-19.1';contract.contractRevision='2026-09-19.juno-toys-materials.1';contract.imagePolicy='typed-regions-v1';contract.selectionGroups={scene:4,featured:6};
  const legacyText:Record<string,string[]>={};
  for(const s of contract.textSlots){const old=s.id;if(old.startsWith('layout-text-'))s.id=`${s.page}-text-${slug(s.exampleText||s.purpose)}-${hash(s.purpose)}`;(legacyText[s.id]??=[]).push(old);}
  contract.textSlots=contract.textSlots.filter((s,i,all)=>all.findIndex(other=>other.id===s.id)===i);
  for(const s of contract.imageSlots){
    s.sourcePolicy='product-reference';
    if(s.id.startsWith('hero-slide-')){s.width=2560;s.height=1040;}
    if(s.id==='scene-card'){s.width=650;s.height=572;}
    if(s.id==='front-card'||s.id==='packaging-card'){s.width=630;s.height=630;}
    if(s.id==='home-image-8'){s.width=520;s.height=599;}
    if(s.id==='home-image-9'){s.width=630;s.height=482;}
    if(s.id==='product-main'){delete s.role;s.width=1200;s.height=1200;}
    if(s.id==='product-gallery'){delete s.role;s.width=1200;s.height=1200;}
  }
  const result:Inventory={contract,text:{},media:{},legacyText};
  const draft=demo('juno-toys'),ids=draft.products.map(p=>p.id);
  draft.materials={templateId:'juno-toys',contractRevision:junoDisplayRevision,visual:{palette:{primary:'#112233',secondary:'#445566',background:'#ffffff',surface:'#eeeeee',text:'#112233',mutedText:'#667788'},backgroundStyle:'plain',imageTreatment:'natural',compositionSummary:'__WR_COMPOSITION__'},displaySelection:{sceneProductIds:ids.slice(0,4),featuredProductIds:ids.slice(0,6)},omittedSectionIds:contract.optionalSections.map(s=>s.id),textBindings:contract.textSlots.flatMap(s=>legacyText[s.id].map(slotId=>({slotId,locale:'en' as const,text:'__WR_BOUND_'+s.id+'__',factReferences:[]}))),imageBindings:contract.imageSlots.flatMap(s=>{
    if(s.id==='product-gallery')return[];
    const targets=s.repeat==='per-product'?ids:s.repeat==='per-selection'?ids.slice(0,s.selectionGroup==='scene'?4:6):s.role==='scene'?[ids[0]]:[undefined];
    return targets.map(productId=>({slotId:s.id,assetId:s.id==='product-main'?productId!:s.id,...(productId?{productId}:{}),fit:s.fit,focalPoint:{x:.5,y:.5},alt:{en:'__WR_IMAGE__'}}));
  })};
  for(const page of materialsPages){
    const root=parse(renderSite(draft,{projectId:'inventory',lang:'en',page,productId:ids[0],assetUrl:id=>`/__WR_ASSET__/${id}`,inquiryUrl:'/inquiry',preview:true}));prepare(root);result.text[page]={};
    collectCopy(root,page,result,contract);
    const empty=parse(renderSite(withoutOptionalFacts(draft),{projectId:'inventory',lang:'en',page,productId:ids[0],assetUrl:id=>`/__WR_ASSET__/${id}`,inquiryUrl:'/inquiry',preview:true}));prepare(empty);collectCopy(empty,page,result,contract);
  }
  return result;
}
function collectCopy(root:Node,page:Page,result:Inventory,contract:MaterialsTemplateContract,modern=false){
  walkCopy(root,(value,attribute,_node,parents)=>{
    const k=key(value,attribute);if(result.text[page][k])return value;
    const normalized=clean(value),heading=parents.some(p=>/^h[1-6]$/.test(p.tagName));
    const id=`${page}-${attribute||'text'}-${slug(normalized)}-${hash(k)}`;
    result.text[page][k]=id;
    if(!contract.textSlots.some(s=>s.id===id))contract.textSlots.push(textSlot(id,page,`${heading?'Heading':attribute||'Visible copy'} in original ${contract.templateId} ${page} layout: ${normalized}`,attribute?140:Math.max(100,Math.min(600,normalized.length*2)),normalized));
    return value;
  },modern);
}
function inventory(id:string,preferExplicitHero=false):Inventory|undefined{
  if(!templateMediaRequirements[id as TemplateId]&&!legacyBannerSizes[id as TemplateId])return;
  const cacheKey=id+(preferExplicitHero?':explicit-hero':'');
  const cached=inventories.get(cacheKey);if(cached)return cached;
  if(id==='juno-toys'){const result=junoInventory();inventories.set(id,result);return result;}
  const contract:MaterialsTemplateContract={schemaVersion:'wr-template-materials-v1',templateId:id,guideRevision:'2026-09-19.1',contractRevision:`2026-09-19.${id}-materials.1`,materialsReady:true,imagePolicy:'typed-regions-v1',pages:[...materialsPages],imageSlots:[],textSlots:coreText(),optionalSections:[{id:'unverified-endorsements',reason:'Template certificates, reports, client logos, reviews and staff identities are not customer facts and are omitted.'}],visualParameters:['palette.primary','palette.secondary','palette.background','palette.surface','palette.text','palette.mutedText','backgroundStyle','imageTreatment','compositionSummary'],contentPolicy:'b2b-confirmed-facts-only'};
  const result:Inventory={contract,text:{},media:{}};
  const draft=demo(id as TemplateId);
  for(const page of materialsPages){
    const root=parse(rawHtml(draft,{projectId:'inventory',page,lang:'en',productId:'sample-0',assetUrl:id=>`/__WR_ASSET__/${id}`,inquiryUrl:'/inquiry',preview:true}));prepare(root);result.text[page]={};result.media[page]={};
    collectCopy(root,page,result,contract);
    const empty=parse(rawHtml(withoutOptionalFacts(draft),{projectId:'inventory',page,lang:'en',productId:'sample-0',assetUrl:id=>`/__WR_ASSET__/${id}`,inquiryUrl:'/inquiry',preview:true}));prepare(empty);collectCopy(empty,page,result,contract);
    const groups=new Map<string,number>();
    walkMedia(root,id,page,(_node,target,spec,_parents,kind)=>{
      let slot=contract.imageSlots.find(s=>s.id===spec.id);const index=groups.get(spec.id)||0;groups.set(spec.id,index+1);
      if(!slot){slot=spec;contract.imageSlots.push(slot);}else if(slot.repeat==='per-product')slot.maxProducts=Math.max(slot.maxProducts||1,index+1);
      result.media[page][target]={slotId:slot.id,index,group:slot.repeat==='per-product',kind};
    },preferExplicitHero);
  }
  const size=/senseng-(clean|video)/.test(id)?[1536,1024]:[1200,1200];
  contract.imageSlots.push({...imageSlot('product-main','catalog','main',size[0],size[1],'Original main image of every selected product; reused by all product cards and detail pages'),repeat:'per-product'}, {...imageSlot('product-gallery','detail','detail',size[0],size[1],'Every selected product original gallery, unchanged order and identity; itemIndex starts at 1'),repeat:'per-product-gallery',min:0,max:10,required:false});
  for(const s of contract.imageSlots)if(s.id==='product-main'||s.id==='product-gallery')delete s.role;
  inventories.set(cacheKey,result);return result;
}
const modernInventories=new Map<string,Inventory>();
function modernInventory(id:string,revision=modernMaterialsRevision(id)):Inventory|undefined{
  const cached=modernInventories.get(revision);if(cached)return cached;
  const previous=inventory(id,revision===aiAgencyHeroRevision);if(!previous)return;
  const result=structuredClone(previous),contract=result.contract;
  contract.guideRevision=id.startsWith('single-')?'2026-09-26.1':'2026-09-20.1';contract.contractRevision=revision;
  contract.imageSlots=contract.imageSlots.filter(s=>s.page!=='about');
  // Juno's legacy copy map also contains shared chrome used on other pages.
  contract.textSlots=contract.textSlots.filter(s=>s.page!=='about'||s.id==='company-about'||s.id.includes('-seo-')||!!result.legacyText?.[s.id]);
  contract.imageSlots.push({...imageSlot('about-primary-image','about','facility',1536,1024,'About lead editorial image representing the approved business, without implying an owned factory'),fit:'cover'});
  if(id==='senseng-clean'||id==='senseng-video')contract.imageSlots.push({...imageSlot('about-secondary-image','about','facility',1536,1024,'About supporting process illustration; a distinct composition from the lead image'),fit:'cover'});
  contract.textSlots.push(textSlot('about-headline','about','About page headline from saved brand and product facts',160),textSlot('about-story','about','About company story, one to six paragraphs using saved facts only',2500),{...textSlot('about-highlights','about','One to four lines, each: value | label | description. Use ✓ as value when no verified numeric metric exists. Never copy template sample statistics.',1000),maxLines:4});
  result.text.about={};result.media.about={};
  const draft=demo(id as TemplateId);
  draft.company={...draft.company,establishedYear:'__WR_YEAR__',aboutImageAssetId:'about-primary-image',aboutSecondaryImageAssetId:'about-secondary-image',aboutHeadline:'__WR_ABOUT_HEADLINE__',aboutStory:'__WR_ABOUT_STORY__',aboutHighlights:'✓ | __WR_ABOUT_LABEL__ | __WR_ABOUT_DETAIL__'};
  for(const sample of [draft,withoutOptionalFacts(draft)]){
    const root=parse(rawHtml(sample,{projectId:'inventory',page:'about',lang:'en',assetUrl:id=>`/__WR_ASSET__/${id}`,inquiryUrl:'/inquiry',preview:true},true));prepare(root);collectCopy(root,'about',result,contract,true);
  }
  modernInventories.set(revision,result);return result;
}
export function getModernMaterialsTemplate(id:string,contractRevision?:string):MaterialsTemplateContract|undefined{
  const revision=contractRevision??(id==='corpox-ai-agency'?aiAgencyHeroRevision:modernMaterialsRevision(id));
  if(revision!==modernMaterialsRevision(id)&&!(id==='corpox-ai-agency'&&revision===aiAgencyHeroRevision))return;
  const value=modernInventory(id,revision);return value?structuredClone(value.contract):undefined;
}
function aboutDraft(draft:Draft,lang:RenderOptions['lang']):Draft{
  const m=draft.materials!,text=(id:string)=>m.textBindings.find(b=>b.slotId===id&&b.locale===lang)?.text||'';
  return {...draft,company:{...draft.company,aboutHeadline:text('about-headline'),aboutStory:text('about-story'),aboutHighlights:text('about-highlights'),aboutImageAssetId:m.imageBindings.find(b=>b.slotId==='about-primary-image')?.assetId,aboutSecondaryImageAssetId:m.imageBindings.find(b=>b.slotId==='about-secondary-image')?.assetId}};
}
export function getTypedMaterialsTemplate(id:string):MaterialsTemplateContract|undefined{const value=inventory(id);return value?structuredClone(value.contract):undefined;}
function bindImage(node:Element,b:Binding,options:RenderOptions,kind:MediaTarget['kind']){
  set(node,'data-wr-material-image',b.slotId);if(b.productId)set(node,'data-wr-material-product',b.productId);
  if(kind==='image'){
    const replacement=parseFragment(materialImage(b,options)).childNodes[0] as Element;
    const image=replacement.tagName==='img'?replacement:elements(replacement).find(n=>n.tagName==='img')!;
    const oldStyle=attr(node,'style');for(const a of node.attrs)if(!['src','srcset','alt','style','loading'].includes(a.name)&&!(attr(image,'srcset')&&['width','height','sizes'].includes(a.name)))set(image,a.name,a.value);
    set(image,'style',oldStyle+';'+attr(image,'style'));
    const parent=node.parentNode!;replacement.parentNode=parent;parent.childNodes[parent.childNodes.indexOf(node)]=replacement;
  }else{
    const url=materialBackgroundUrl(b,options),mobile=materialBackgroundUrl(b,options,true);
    const cssUrl=(s:string)=>`url(${JSON.stringify(s).replace(/</g,'\\3c ')})`;
    set(node,'style',attr(node,'style').replace(/background(?:-image)?\s*:[^;]*url\([^)]*\)[^;]*(?:;|$)/g,'')+`;background-image:${cssUrl(url)};background-size:${b.fit};background-position:${b.focalPoint.x*100}% ${b.focalPoint.y*100}%;--wr-mobile-bg:${cssUrl(mobile)};--wr-mobile-position:${(b.mobileFocalPoint||b.focalPoint).x*100}% ${(b.mobileFocalPoint||b.focalPoint).y*100}%;`);
    set(node,'aria-label',b.alt[options.lang]||b.alt.en||'');
    if(node.tagName==='video')set(node,'poster',url);
  }
}
function cardContainer(node:Element,parents:Element[]):Element{
  return [...parents].reverse().find(p=>p.tagName==='article'||attr(p,'class').split(/\s+/).some(c=>/^(?:wr-[\w-]+-card|product-card|portfolio-item|service-item|process-card|feature-card|grid-item|card|tmp-portfolio(?:-style-[\w]+)?)$/.test(c)))||parents.at(-1)||node;
}
function bindIdentity(node:Element,parents:Element[],draft:Draft,b:Binding,options:RenderOptions){
  if(!b.productId)return;const product=draft.products.find(p=>p.id===b.productId);if(!product)return;
  const container=cardContainer(node,parents);set(container,'data-wr-product-id',product.id);
  const depth=options.page==='home'?'':options.page==='detail'?'../../':'../';
  for(const n of elements(container)){
    if(n.tagName==='a'){set(n,'href',depth+productPath(product.id));set(n,'data-wr-page','detail');set(n,'data-wr-product-id',product.id);}
    if(/^h[2-6]$/.test(n.tagName)){n.childNodes=parseFragment(esc(product.translations?.[options.lang]?.name||product.name)).childNodes;for(const c of n.childNodes)c.parentNode=n;}
  }
}
function applyCore(root:Node,draft:Draft,options:RenderOptions){
  const bindings=draft.materials!.textBindings,copy=(id:string)=>bindings.find(b=>b.slotId===id&&b.locale===options.lang)?.text||'';
  for(const n of elements(root)){
    if(n.tagName==='title'){n.childNodes=parseFragment(esc(copy(`${options.page}-seo-title`))).childNodes;for(const c of n.childNodes)c.parentNode=n;}
    if(n.tagName==='meta'&&attr(n,'name')==='description')set(n,'content',copy(`${options.page}-seo-description`));
    if(n.tagName==='body'){set(n,'class',attr(n,'class')+' wr-materials-site');set(n,'data-template',draft.template);}
    if(options.preview&&(n.tagName==='button'&&attr(n,'type')==='submit'||n.tagName==='input'&&attr(n,'type')==='submit'))set(n,'disabled','');
    if(hasFixedInnerColumns(draft,options)&&/grid-template-columns:\s*1fr\s+1(?:\.2)?fr\s*;/.test(attr(n,'style')))set(n,'data-wr-typed-inner-grid','');
  }
  // This literal belongs to the Minimal theme, not the confirmed company. It is
  // concatenated with the dynamic company marker, so it has no copy-slot identity.
  // Match that exact footer node only; approved text bindings remain untouched.
  if(draft.template==='senseng-minimal')for(const footer of elements(root).filter(n=>n.tagName==='footer'))for(const n of elements(footer))for(const child of n.childNodes){
    if('value'in child&&child.nodeName==='#text'&&clean(child.value)===`© 2026 ${draft.company.name}. SWISS ATELIER EDITION.`)child.value=`© 2026 ${draft.company.name}. ${labels[options.lang].rights}`;
  }
}
function retainGallery(root:Node,draft:Draft,options:RenderOptions){
  if(options.page!=='detail')return;
  const productId=options.productId||draft.primaryProductId||draft.products[0]?.id;
  const nodes=elements(root),images=nodes.filter(n=>n.tagName==='img');
  const existing=new Set(images.map(n=>attr(n,'src')));
  const gallery=draft.materials!.imageBindings.filter(b=>b.slotId==='product-gallery'&&b.productId===productId&&!existing.has(safeUrl(options.assetUrl(b.assetId),options.preview))).sort((a,b)=>(a.itemIndex||0)-(b.itemIndex||0));
  if(!gallery.length)return;
  const mainBinding=draft.materials!.imageBindings.find(b=>b.slotId==='product-main'&&b.productId===productId);
  const primary=images.find(n=>attr(n,'data-wr-material-image')==='product-main'&&attr(n,'data-wr-material-product')===productId)||images.find(n=>mainBinding&&attr(n,'src')===safeUrl(options.assetUrl(mainBinding.assetId),options.preview));
  const parent=primary?.parentNode;if(!parent)return;
  if(!attr(primary,'id'))set(primary,'id','wr-detail-main-img');
  const added=parseFragment(`<div class="senseng-detail-thumbs wr-confirmed-gallery" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px">${[...(mainBinding?[mainBinding]:[]),...gallery].map((b,i)=>`<button type="button" class="wr-detail-thumb${i===0?' active':''}" data-wr-material-thumb="" aria-label="${esc(b.alt[options.lang]||b.alt.en||'')}" style="min-width:0;padding:0;cursor:pointer;background:transparent;border:1px solid #ddd">${materialImage(b,options)}</button>`).join('')}</div>`).childNodes;
  for(const node of added){node.parentNode=parent;parent.childNodes.push(node);}
}
function removeUnboundTemplateBackgrounds(root:Node){
  for(const node of elements(root)){
    if(['script','style'].includes(node.tagName)||attr(node,'data-wr-material-image'))continue;
    const style=attr(node,'style');
    if(/url\([^)]*\/templates\/[^)]*\.(?:jpg|png|webp)/.test(style))set(node,'style',style.replace(/(?:background(?:-image)?\s*:)[^;]*url\([^)]*\/templates\/[^)]*\)[^;]*(?:;|$)/g,'background-image:none;'));
    node.attrs=node.attrs.filter(a=>!(/^data-(?:background|bg|image|src)$/.test(a.name)&&a.value.includes('/templates/')));
  }
}
export function renderTypedMaterialsSite(draft:Draft,options:RenderOptions):string{
  const preferExplicitHero=draft.template==='corpox-ai-agency'&&draft.materials?.contractRevision===aiAgencyHeroRevision;
  const isExecutable=Boolean(draft.materials?.contractRevision?.startsWith('2026-09-22.'));
  const modern=draft.materials?.contractRevision===modernMaterialsRevision(draft.template)||isExecutable||preferExplicitHero;
  const modernRevision=preferExplicitHero?aiAgencyHeroRevision:modernMaterialsRevision(draft.template);
  const inv=modern?modernInventory(draft.template,modernRevision):inventory(draft.template);if(!inv||!draft.materials)throw Error('Unsupported typed materials template');
  const modernAbout=modern&&options.page==='about';if(modernAbout)draft=aboutDraft(draft,options.lang);
  const m=draft.materials!,page=(materialsPages.includes(options.page as Page)?options.page:'home') as Page;
  if(inv.legacyText&&!modernAbout){
    const legacy={...draft,banner:undefined,banners:undefined,materials:{...m,contractRevision:junoDisplayRevision,textBindings:m.textBindings.flatMap(b=>(inv.legacyText![b.slotId]||[b.slotId]).map(slotId=>({...b,slotId})))}};
    const root=parse(renderSite(legacy,options));markPresentationRegions(root);prepare(root);
    const texts=new Map(m.textBindings.filter(b=>b.locale===options.lang).map(b=>[b.slotId,b.text]));
    walkCopy(root,(value,attribute)=>{const id=inv.text[page][key(value,attribute)];return id?texts.get(id)||'':value;});
    for(const node of elements(root))if(node.tagName==='img'&&!attr(node,'data-wr-material-image')){
      const binding=m.imageBindings.find(b=>(b.slotId==='product-main'||b.slotId==='product-gallery')&&safeUrl(options.assetUrl(b.assetId),options.preview)===attr(node,'src'));
      if(binding)bindImage(node,binding,options,'image');
    }
    applyCore(root,draft,options);
    retainGallery(root,draft,options);
    removeUnboundTemplateBackgrounds(root);
    polishTypedMaterials(root,draft,options,inv.contract);
    return serialize(root).replace('</head>','<style>.wr-juno-display [data-wr-display-role="scene"] .wr-display-photo{aspect-ratio:650/572}.wr-juno-display .wr-display-grid{grid-template-columns:repeat(min(var(--wr-display-count),4),minmax(0,1fr))}@media(max-width:767px){.wr-juno-display .wr-display-grid{grid-template-columns:repeat(min(var(--wr-display-count),2),minmax(0,1fr))}}</style></head>');
  }
  const root=parse(rawHtml(draft,options,modernAbout));markPresentationRegions(root);prepare(root);
  const textBindings=new Map(m.textBindings.filter(b=>b.locale===options.lang).map(b=>[b.slotId,b.text]));
  const confirmedAbout=new Set([draft.company.aboutHeadline||'',...(draft.company.aboutStory||'').split(/\r?\n/),...(draft.company.aboutHighlights||'').split(/[|丨\r\n]/)].map(clean));
  walkCopy(root,(value,attribute)=>{
    if(modernAbout&&confirmedAbout.has(clean(value)))return value;
    let source=value;
    if(modernAbout)for(const [actual,marker]of [[draft.company.name.toUpperCase(),'__WR_COMPANY__'],[draft.company.name,'__WR_COMPANY__'],[draft.company.establishedYear||'','__WR_YEAR__']])if(actual)source=source.split(actual).join(marker);
    const id=inv.text[page][key(source,attribute)];return id?textBindings.get(id)||'':value;
  },modernAbout);
  if(modernAbout)for(const node of elements(root))if(node.tagName==='img'){
    const b=m.imageBindings.find(b=>attr(node,'src')===`/__WR_ABOUT__/${b.slotId}`);
    if(b){node.attrs=node.attrs.filter(a=>a.name!=='onerror');bindImage(node,b,options,'image');}
  }
  walkMedia(root,draft.template,page,(node,target,_spec,parents,kind)=>{
    const plan=inv.media[page][target];if(!plan)return;
    const bindings=m.imageBindings.filter(b=>b.slotId===plan.slotId);
    const productId=plan.group?draft.products[plan.index]?.id:undefined;
    let b=plan.group?bindings.find(b=>b.productId===productId):bindings[0];
    // A saved hero for another product must not survive a primary-product switch.
    if(draft.template.startsWith('single-')&&plan.slotId.startsWith('hero-slide-')){
      const primary=draft.primaryProductId||draft.products[0]?.id;
      const depictsPrimary=b&&(b.depictedProductIds?.length===1?b.depictedProductIds[0]===primary:b.productId===primary);
      if(!depictsPrimary){
        const main=m.imageBindings.find(item=>item.slotId==='product-main'&&item.productId===primary);
        b=main?{...main,slotId:plan.slotId,role:'scene',depictedProductIds:primary?[primary]:[]}:undefined;
      }
    }
    if(!b){remove(cardContainer(node,parents));return;}
    bindIdentity(node,parents,draft,b,options);bindImage(node,b,options,kind);
  },preferExplicitHero);
  for(const node of elements(root)){
    if(node.tagName!=='img'||attr(node,'data-wr-material-image'))continue;
    const src=attr(node,'src');
    const binding=m.imageBindings.find(b=>(b.slotId==='product-main'||b.slotId==='product-gallery')&&safeUrl(options.assetUrl(b.assetId),options.preview)===src);
    if(binding){bindImage(node,binding,options,'image');continue;}
    if(src.includes('/templates/')&&!/\.svg(?:\?|$)|hero-sky/.test(src)){remove(node);}
  }
  // Static demo videos do not represent the selected collection. Keep the video
  // container for layout but use the confirmed collection poster only.
  for(const node of elements(root))if(node.tagName==='video'&&!node.attrs.some(a=>a.name==='data-sp-video')){
    const hero=m.imageBindings.find(b=>b.slotId==='hero-slide-0');if(hero){set(node,'poster',safeUrl(options.assetUrl(hero.assetId),options.preview));set(node,'data-wr-material-photo','');}
  }
  if(modernAbout)for(const node of elements(root)){
    if(node.tagName==='main')set(node,'data-wr-modern-about','');
    const style=attr(node,'style');
    if(/grid-template-columns:/.test(style))set(node,'data-wr-about-grid','');
    const padding=style.match(/(?:^|;)\s*padding:\s*([\d.]+)px(?:\s+([\d.]+)px)?\s*;/);
    if(padding&&Number(padding[2]||padding[1])>24)set(node,'data-wr-about-wide-padding','');
  }
  applyCore(root,draft,options);
  retainGallery(root,draft,options);
  removeUnboundTemplateBackgrounds(root);
  polishTypedMaterials(root,draft,options,inv.contract,modernAbout);
  return serialize(root).replace('</head>',materialsThemeStyle(draft)+(modernAbout?modernAboutStyle:'')+((newSenseng.test(draft.template)||draft.template.startsWith('corpox-')||hasFixedInnerColumns(draft,options))?typedMobileHeaderStyle:'')+'</head>').replace('<script>','<script>var __name=(value)=>value;').replace('</body>',`<script>(()=>{const __name=(value)=>value;(${materialsRuntime.toString()})();})();</script></body>`);
}

const modernAboutStyle=`<style id="wr-modern-about-responsive">
[data-wr-modern-about]{overflow-wrap:anywhere}
@media(max-width:767px){
 [data-wr-modern-about] [data-wr-about-grid]{grid-template-columns:minmax(0,1fr)!important;gap:24px!important}
 [data-wr-modern-about] [data-wr-about-grid]>*{min-width:0;max-width:100%;grid-column:auto!important}
 [data-wr-modern-about] [data-wr-about-wide-padding]{padding-left:20px!important;padding-right:20px!important}
 [data-wr-modern-about] svg{max-width:100%}
}
</style>`;
