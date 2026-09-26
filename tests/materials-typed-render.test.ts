import {describe,expect,it} from 'vitest';
import {parse} from 'parse5';
import type {Draft,TemplateId} from '../src/shared/model';
import {templateMediaRequirements} from '../src/shared/template-media';
import {getTypedMaterialsTemplate,renderTypedMaterialsSite} from '../src/templates/materials-typed';
import {getMaterialsTemplate} from '../src/templates/materials';
import {renderSite} from '../src/templates';
import {createHash} from 'node:crypto';
import typedManifest from '../docs/materials-requirements/typed-2026-09-19.json';
import {newBanner} from '../src/shared/banner-config';

function fixture(id:string,count=2):Draft {
  const contract=getTypedMaterialsTemplate(id)!;
  const products=Array.from({length:count},(_,i)=>({id:`real-${i}`,name:`Actual product ${i}`,description:`Verified description ${i}`,material:'Wood',dimensions:'10 cm',imageAssetId:`main-${i}`,gallery:[{assetId:`main-${i}`,sourceImageId:`main-${i}`,kind:'original' as const,caption:'Primary'},{assetId:`extra-${i}`,sourceImageId:`extra-${i}`,kind:'detail' as const,caption:'Detail'}]}));
  const ids=products.map(p=>p.id),selection={sceneProductIds:ids.slice(0,contract.selectionGroups?.scene||0),featuredProductIds:ids.slice(0,contract.selectionGroups?.featured||0)};
  return {template:id as TemplateId,company:{name:'Actual brand',description:'Confirmed company description',type:'trader',email:'sales@example.com',contactName:'Sales',facebook:'',instagram:'',x:''},products,primaryProductId:ids[0],country:'US',category:'',languages:['en'],brandColor:'#112233',copy:{en:{headline:'Actual collection',subtitle:'Confirmed introduction',about:'Confirmed company description',cta:'Contact sales'}},duration:8,direction:'',script:'',scriptRevision:0,scenes:[],storyboardRevision:0,heroAccepted:false,materials:{templateId:id,contractRevision:contract.contractRevision,visual:{palette:{primary:'#112233',secondary:'#445566',background:'#ffffff',surface:'#eeeeee',text:'#112233',mutedText:'#667788'},backgroundStyle:'plain',imageTreatment:'natural',compositionSummary:'Confirmed products'},displaySelection:selection,omittedSectionIds:contract.optionalSections.map(s=>s.id),textBindings:contract.textSlots.map((s,i)=>({slotId:s.id,locale:'en',text:`Approved copy ${i}`,factReferences:[]})),imageBindings:contract.imageSlots.flatMap(s=>{
    const targets=s.repeat==='per-product-gallery'?products.flatMap(p=>[{productId:p.id,itemIndex:1}]):s.repeat==='per-selection'?(selection[s.selectionGroup==='scene'?'sceneProductIds':'featuredProductIds']||[]).map(productId=>({productId})):s.repeat==='per-product'?ids.slice(0,s.maxProducts||ids.length).map(productId=>({productId})):s.role==='scene'||s.role==='front'||s.role==='packaging'||s.role==='main'||s.role==='detail'?[{productId:ids[0]}]:[{}];
    return targets.map(target=>({slotId:s.id,...target,assetId:s.id==='product-main'?products.find(p=>p.id===('productId'in target?target.productId:undefined))!.imageAssetId:s.id==='product-gallery'?`extra-${ids.indexOf(('productId'in target?target.productId:'') as string)}`:`bound-${s.id}-${'productId'in target?target.productId:'all'}`,fit:s.fit,focalPoint:{x:.5,y:.5},alt:{en:'Approved image'},role:s.role,depictedProductIds:s.role==='collection'?ids:'productId'in target?[target.productId as string]:[]}));
  })}};
}
const visible=(html:string)=>{const root=parse(html);let text='';const visit=(n:any)=>{if(['script','style','svg'].includes(n.tagName))return;if(n.nodeName==='#text')text+=n.value+' ';for(const c of n.childNodes||[])visit(c);};visit(root);return text;};
describe('typed materials preserve template layouts with confirmed content',()=>{
  it('covers every current template and exposes stable text identities',()=>{
    for(const id of Object.keys(templateMediaRequirements)){
      const c=getTypedMaterialsTemplate(id)!;
      expect(c?.materialsReady,id).toBe(true);expect(c.imagePolicy).toBe('typed-regions-v1');
      expect(c.textSlots.some(s=>/^.+-copy-\d+$/.test(s.id)),id).toBe(false);
      expect(c.pages).toHaveLength(5);
      expect(new Set(c.imageSlots.map(s=>s.id)).size,id+' unique images').toBe(c.imageSlots.length);
      expect(new Set(c.textSlots.map(s=>s.id)).size,id+' unique copy').toBe(c.textSlots.length);
      expect(c.imageSlots.some(s=>s.id==='product-main'&&!s.maxProducts),id).toBe(true);
    }
  });
  it.each(Object.keys(templateMediaRequirements))('%s renders all pages without template sample claims or sample products',id=>{
    const draft=fixture(id,2);
    for(const page of ['home','catalog','detail','about','contact']){
      const html=renderTypedMaterialsSite(draft,{projectId:'typed',lang:'en',page,productId:'real-0',assetUrl:id=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true});
      expect(html).toContain('data-template=');
      expect(/\bdata-(?:counter|suffix|progress)="/.test(html),id+':'+page+' numeric writer').toBe(false);
      expect(html).not.toMatch(/data-wr-product-id="demo-/);
      expect(visible(html)).not.toMatch(/50,000|100% Certified|500 pcs|Certified Excellence/);
      expect(visible(html).includes('Actual brand'),id+':'+page+' brand').toBe(true);
    }
  });
  it('keeps all catalog products while the Juno scene and paired rows retain their own limits',()=>{
    const c=getTypedMaterialsTemplate('juno-toys')!;
    expect(c.selectionGroups).toEqual({scene:4,featured:6});
    expect(c.imageSlots.find(s=>s.id==='hero-slide-0')).toMatchObject({width:2560,height:1040});
    const draft=fixture('juno-toys',8);
    const html=renderTypedMaterialsSite(draft,{projectId:'typed',lang:'en',page:'home',assetUrl:id=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true});
    expect((html.match(/<article[^>]+data-wr-display-role="scene"/g)||[])).toHaveLength(4);
    expect((html.match(/<article[^>]+data-wr-display-role="packaging"/g)||[])).toHaveLength(6);
    expect(html).toContain('Actual product 7');
  });
  it.each([1,5,20])('fills every declared region for %i products, retaining original galleries and exact cardinality',count=>{
    for(const id of Object.keys(templateMediaRequirements)){
      const draft=fixture(id,count),contract=getTypedMaterialsTemplate(id)!,seen=new Set<string>();
      for(const page of ['home','catalog','detail','about','contact']){
        const html=renderTypedMaterialsSite(draft,{projectId:'typed',lang:'en',page,productId:'real-0',assetUrl:id=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true});
        const visit=(n:any)=>{if(n.tagName==='img'||n.attrs?.some((a:any)=>a.name==='data-wr-material-image')){const attrs=Object.fromEntries((n.attrs||[]).map((a:any)=>[a.name,a.value]));if(attrs['data-wr-material-image'])seen.add(attrs['data-wr-material-image']);}for(const c of n.childNodes||[])visit(c);};visit(parse(html));
        if(page==='catalog')for(const p of (id.startsWith('single-')?draft.products.slice(0,1):draft.products))expect(html.includes(`data-wr-product-id="${p.id}"`),id+' catalog '+p.id).toBe(true);
        if(page==='detail')expect(html.includes('/bound/extra-0'),id+' original gallery').toBe(true);
      }
      expect(contract.imageSlots.filter(s=>s.id!=='product-gallery'&&!seen.has(s.id)).map(s=>s.id),id+' unused contract image slots').toEqual([]);
    }
  });
  it.each(Object.keys(templateMediaRequirements))('%s empty optional facts do not activate template demo claims',id=>{
    const draft=fixture(id,1);draft.company.description='';draft.company.address='';draft.company.phone='';draft.company.whatsapp='';draft.copy.en!.about='';draft.products[0].description='';draft.products[0].material='';draft.products[0].dimensions='';
    for(const page of ['detail','about','contact']){
      const text=visible(renderTypedMaterialsSite(draft,{projectId:'typed',lang:'en',page,productId:'real-0',assetUrl:id=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true}));
      expect(/\b(?:EN71|ASTM|ISO 9001|50,000|Shantou|Shenzhen|patented|Food-Grade|100% Certified)\b/.test(text),id+':'+page+' unsupported fact '+text.match(/.{0,70}(?:EN71|ASTM|ISO 9001|50,000|Shantou|Shenzhen|patented|Food-Grade|100% Certified).{0,90}/)?.[0]).toBe(false);
    }
  });
  it('removes customer logos and sliced testimonial photographs from approved reference pages',()=>{
    for(const id of ['saas-automation','fintech-platform','digital-marketing','crafto-corporate']){
      const draft=fixture(id,2),root=parse(renderTypedMaterialsSite(draft,{projectId:'typed',lang:'en',page:'home',assetUrl:id=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true}));
      const remaining:string[]=[];const walk=(n:any)=>{const a=Object.fromEntries((n.attrs||[]).map((a:any)=>[a.name,a.value]));if(n.tagName!=='style'&&n.tagName!=='script'){
        if(n.tagName==='img'&&/logo|trusted partner/i.test(a.alt||'')&&/\/templates\//.test(a.src||''))remaining.push(a.alt);
        if(/url\([^)]*\/templates\/[^)]*\.(?:jpg|png|webp)/.test(a.style||''))remaining.push(a.style);
      }for(const c of n.childNodes||[])walk(c);};walk(root);expect(remaining,id).toEqual([]);
    }
  });
  it.each(['candy','wonder','arcade','nature','minimal'])('keeps complete confirmed %s labels inside the native mobile menu',theme=>{
    const draft=fixture(`senseng-${theme}`,2);
    const catalogSlot=getTypedMaterialsTemplate(draft.template)!.textSlots.find(s=>s.page==='home'&&s.exampleText==='Collection')!;
    draft.materials!.textBindings.find(b=>b.slotId===catalogSlot.id)!.text='Explore the collection';
    const options={projectId:'typed',lang:'en' as const,page:'home',assetUrl:(id:string)=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true};
    const html=renderTypedMaterialsSite(draft,options),nodes:any[]=[];
    const visit=(n:any)=>{nodes.push(n);for(const child of n.childNodes||[])visit(child);};visit(parse(html));
    const style=nodes.find(n=>n.tagName==='style'&&n.attrs.some((a:any)=>a.name==='id'&&a.value==='wr-typed-mobile-header'));
    expect(Boolean(style),'scoped responsive header style').toBe(true);
    const css=style.childNodes.map((n:any)=>n.value||'').join('');
    expect(css).toContain('@media(max-width:767px)');
    expect(html).toContain('data-wr-mobile-menu=""');
    expect(html).toContain('<summary aria-label=');
    expect(css).toContain('overflow-wrap:anywhere');
    expect(visible(html)).toContain('Explore the collection');
    expect(renderSite({...draft,materials:undefined},options).includes('id="wr-typed-mobile-header"')).toBe(false);
  });
  it.each(['corpox-ai-agency','corpox-consulting'])('keeps a wrapping %s brand inside its mobile header',id=>{
    const draft=fixture(id,2);draft.company.name='Example Brand';
    const html=renderTypedMaterialsSite(draft,{projectId:'typed',lang:'en',page:'home',assetUrl:id=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true});
    expect(html).toContain('.logo .wr-reference-brand{display:flex!important;align-items:center;line-height:1.2!important;height:100%');
    expect(visible(html)).toContain('Example Brand');
  });
  it('removes only the Minimal copyright template suffix while preserving brand, rights and confirmed copy',()=>{
    const draft=fixture('senseng-minimal',1);
    draft.company.name='Swiss Atelier Customer Brand';
    const slot=getTypedMaterialsTemplate(draft.template)!.textSlots.find(s=>s.page==='home'&&s.exampleText==='Collection')!;
    draft.materials!.textBindings.find(b=>b.slotId===slot.id)!.text='SWISS ATELIER EDITION.';
    const options={projectId:'typed',lang:'en' as const,page:'home',assetUrl:(id:string)=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true};
    const copy=visible(renderTypedMaterialsSite(draft,options));
    expect(copy).toContain('© 2026 Swiss Atelier Customer Brand. All rights reserved');
    expect(copy).not.toContain('© 2026 Swiss Atelier Customer Brand. SWISS ATELIER EDITION.');
    expect(copy).toContain('SWISS ATELIER EDITION.');
    expect(renderSite({...draft,materials:undefined},options)).toContain('© 2026 Swiss Atelier Customer Brand. SWISS ATELIER EDITION.');
  });
  it('preserves the published contract manifest through render-only corrections',()=>{
    for(const [id,locked] of Object.entries(typedManifest.templates))expect(createHash('sha256').update(JSON.stringify(getMaterialsTemplate(id,locked.contractRevision))).digest('hex'),id).toBe(locked.sha256);
  });
  it('replaces Arcade demo metrics with supported company facts',()=>{
    const draft=fixture('senseng-arcade',2),contract=getTypedMaterialsTemplate(draft.template)!;
    const slot=contract.textSlots.find(s=>s.page==='home'&&s.exampleText==='60+')!;
    const approved='Manufacturing details available on request';
    draft.materials!.textBindings.find(b=>b.slotId===slot.id)!.text=approved;
    const options={projectId:'typed',lang:'en' as const,page:'home',assetUrl:(id:string)=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true};
    const html=renderTypedMaterialsSite(draft,options);
    expect(html).toContain('data-wr-company-facts=""');
    expect(visible(html)).toContain('Confirmed company description');
    expect(visible(html)).not.toContain(approved);
    expect(renderSite({...draft,materials:undefined},options).includes('data-wr-typed-facts-grid')).toBe(false);
  });
  it.each(['saas-automation','fintech-platform','digital-marketing'])('stacks fixed %s inner-page columns on mobile without changing standalone layouts',id=>{
    const draft=fixture(id,2);
    for(const page of ['about','contact']){
      const options={projectId:'typed',lang:'en' as const,page,assetUrl:(id:string)=>`/bound/${id}`,inquiryUrl:'/inquiry',preview:true};
      const html=renderTypedMaterialsSite(draft,options),nodes:any[]=[];
      const visit=(n:any)=>{nodes.push(n);for(const child of n.childNodes||[])visit(child);};visit(parse(html));
      const marked=nodes.filter(n=>n.attrs?.some((a:any)=>a.name==='data-wr-typed-inner-grid'));
      expect(marked.length,id+':'+page).toBeGreaterThan(0);
      expect(html).toContain('[data-wr-typed-inner-grid]{grid-template-columns:minmax(0,1fr)!important');
      expect(html).toContain('[data-wr-typed-inner-grid]>*{min-width:0;max-width:100%;grid-column:auto!important}');
      if(page==='contact')expect(marked.some(n=>n.tagName==='form'),id+' form also stacks').toBe(true);
      expect(renderSite({...draft,materials:undefined},options).includes('data-wr-typed-inner-grid')).toBe(false);
    }
  });
  it('keeps prepared image dimensions and all slot identities after presentation relocation',()=>{
    for(const id of Object.keys(templateMediaRequirements)){
      const draft=fixture(id,2),seen=new Set<string>();
      for(const page of ['home','catalog','detail','about','contact']){
        const html=renderTypedMaterialsSite(draft,{projectId:'typed',lang:'en',page,productId:'real-0',assetUrl:id=>`/bound/${id}`,inquiryUrl:'/inquiry',imageVariants:(id,widths)=>widths.map(w=>({url:`/bound/${id}?width=${w}`,width:w,height:w/2}))});
        const walk=(n:any)=>{const a=Object.fromEntries((n.attrs||[]).map((a:any)=>[a.name,a.value]));if(a['data-wr-material-image'])seen.add(a['data-wr-material-image']);if(n.tagName==='img'&&a.srcset){expect(Number(a.height),id+':'+page+' intrinsic ratio').toBe(Number(a.width)/2);expect(a.src).not.toContain('?width=');}for(const c of n.childNodes||[])walk(c);};walk(parse(html));
      }
      expect(getTypedMaterialsTemplate(id)!.imageSlots.filter(s=>s.id!=='product-gallery'&&!seen.has(s.id)).map(s=>s.id),id+' missing optimized slot').toEqual([]);
    }
  });

  it.each(['image','background'] as const)('preserves confirmed collections and responsive media with unassigned %s Banner settings',mode=>{
    for(const id of Object.keys(templateMediaRequirements)){
      const draft=fixture(id,2),contract=getTypedMaterialsTemplate(id)!;
      draft.banners=[{...newBanner('saved-home',[]),mode,headline:'Standalone Banner headline',subtitle:'Standalone Banner subtitle',tags:['Standalone Banner tag'],slides:[{assetId:'standalone-banner',alt:'Standalone Banner image'}]}];
      const root=parse(renderSite(draft,{projectId:'typed',lang:'en',page:'home',assetUrl:assetId=>`/bound/${assetId}`,inquiryUrl:'/inquiry',imageVariants:(assetId,widths)=>widths.map(width=>({url:`/bound/${assetId}?width=${width}`,width,height:width/2}))}));
      const images:any[]=[];let primaryHeadings=0,collectionHeroes=0,customBanners=0;
      const walk=(n:any)=>{const a=Object.fromEntries((n.attrs||[]).map((a:any)=>[a.name,a.value]));if(n.tagName==='img')images.push(a);if(n.tagName==='h1')primaryHeadings++;if('data-wr-collection-hero'in a)collectionHeroes++;if(a['data-wr-banner']==='custom')customBanners++;for(const child of n.childNodes||[])walk(child);};walk(root);
      expect(collectionHeroes,id+' collection hero').toBe(id.startsWith('single-')?0:1);
      expect(primaryHeadings,id+' primary heading').toBe(1);
      expect(customBanners,id+' confirmed-material boundary').toBe(0);
      for(const slot of contract.imageSlots.filter(s=>!id.startsWith('single-')&&s.id.startsWith('hero-slide-'))){
        const image=images.find(a=>a['data-wr-material-image']===slot.id);
        expect(image,id+' '+slot.id).toBeDefined();
        expect(image.src).toContain(`/bound/bound-${slot.id}-all`);
        expect(image.srcset).toContain('?width=640 640w');
        expect(Number(image.height)).toBe(Number(image.width)/2);
        expect(image.style).toContain('object-fit:contain');
      }
    }
  });

});
