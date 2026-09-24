import { additionalMaterialsReleases, type MaterialsTemplateRelease } from './materials-release-registry';
import type { ProductIdentity } from '../shared/product-identity';
import type { Draft } from '../shared/model';
import type { MaterialsTemplateContract } from '../shared/materials';
import type { RenderOptions } from './index';
import { getMaterialsTemplate as frozenContract, renderSite as frozenRender } from './releases/baseline-20260922.mjs';
import { frozenMaterialsPreviewRuntime } from './releases/baseline-preview-20260922';
import { getMaterialsTemplate as industryContract, renderSite as industryRender } from './releases/industry-20260922.mjs';
import { frozenIndustryPreviewRuntime } from './releases/industry-preview-20260922';
import { getMaterialsTemplate as outreachContract, renderSite as outreachRender } from './releases/outreach-20260923.mjs';
import { getOutreachDemoContract, repairOutreachMaterials } from './releases/outreach-demo-20260923.mjs';
import { repairMaterialsDemo } from './releases/demo-20260923.mjs';
import { getModernMaterialsTemplate, getTypedMaterialsTemplate } from './materials-typed';

export const materialsRendererRevision = '2026-09-22.baseline-09fb979';
export const industryRendererRevision = '2026-09-22.industry-bafe6c1';
export const executableMaterialsRevision = (id: string) => `2026-09-22.${id}-materials.4`;


export const identityMaterialsRevision = (id: string) => `2026-09-22.${id}-materials.5`;
export const demoMaterialsRevision = (id: string) => `2026-09-23.${id}-materials.6`;
export const demoRendererRevision = '2026-09-23.demo-repair.1';
export const outreachDemoRendererRevision = '2026-09-23.outreach-demo-repair.1';

export function demoMaterialsContract(id: string): MaterialsTemplateContract | undefined {
  const outreach = getOutreachDemoContract(id);
  if (outreach) return outreach;
  const contract = identityMaterialsContract(id);
  if (!contract) return;
  contract.contractRevision = demoMaterialsRevision(id);
  contract.rendererRevision = demoRendererRevision;
  return contract;
}
const templateProductFamilies: Record<string, ProductIdentity["family"][]> = {
  toys: ['toy'], plush: ['plush'], apparel: ['apparel'], footwear: ['footwear'], luggage: ['bags'],
  jewelry: ['jewelry'], homedecor: ['home'], furniture: ['furniture'], kitchen: ['kitchen', 'drinkware'],
  juno: ['toy', 'plush'], senseng: ['toy', 'plush'],
  drinkware: ['drinkware'], beauty: ['beauty'], electronics: ['electronics'], tools: ['tools'], sports: ['outdoor'],
  pet: ['pet'], stationery: ['stationery'], poster: ['flat', 'home'], food: ['food'],
  single: ['electronics', 'general', 'home'],
};
export function identityMaterialsContract(id: string): MaterialsTemplateContract | undefined {
  const outreach = outreachContract(id, identityMaterialsRevision(id));
  if (outreach) return outreach;
  const contract = executableMaterialsContract(id);
  if (!contract) return;
  contract.contractRevision = identityMaterialsRevision(id);
  if (!frozenContract(id)) contract.rendererRevision = industryRendererRevision;
  contract.productApplicability = { version: 1, preferredFamilies: templateProductFamilies[id.split('-')[0]] ?? [],
    requiresPackaging: contract.imageSlots.some(slot => slot.role === 'packaging' && slot.required) };
  contract.requiredCapabilities = [...contract.requiredCapabilities!, 'product.identity.v1'].sort();
  return contract;
}

/** Execution metadata is published only in a new revision. Historical documents stay byte-for-byte unchanged. */
export function executableMaterialsContract(id: string): MaterialsTemplateContract | undefined {
  const outreach = outreachContract(id, executableMaterialsRevision(id));
  if (outreach) return outreach;
  const contract = frozenContract(id) ?? industryContract(id, executableMaterialsRevision(id)) ?? getModernMaterialsTemplate(id);
  if (!contract) return;
  contract.contractRevision = executableMaterialsRevision(id);
  return declareExecutionMetadata(contract);
}

function declareExecutionMetadata(contract:MaterialsTemplateContract):MaterialsTemplateContract {
  contract.rendererRevision = materialsRendererRevision;
  const capabilities = new Set<string>();
  for (const slot of contract.imageSlots) {
    slot.materialSource = slot.id === 'product-main' ? 'product-primary' : slot.id === 'product-gallery' ? 'product-gallery' : 'slot-image';
    slot.productScope = slot.role === 'collection' ? 'all-products' : slot.sourcePolicy === 'illustration' ? 'none' : 'single-product';
    slot.reusePolicy = slot.role === 'collection' || slot.productScope === 'none' ? 'distinct-slot' : 'same-product';
    capabilities.add(slot.materialSource === 'slot-image' ? 'image.slot.v1' : `image.${slot.materialSource}.v1`);
    if (slot.role === 'collection') capabilities.add('image.collection.v1');
    if (slot.sourcePolicy === 'illustration') capabilities.add('image.illustration.v1');
    if (slot.role === 'packaging') capabilities.add('image.packaging-evidence.v1');
    if (slot.repeat === 'per-selection') capabilities.add('selection.product-groups.v1');
  }
  for (const slot of contract.textSlots) {
    slot.format = slot.id === 'about-highlights' ? 'value-label-description-lines' : 'plain-text';
    slot.factSources = ['brand', 'product'];
    capabilities.add(slot.format === 'plain-text' ? 'text.plain.v1' : 'text.value-label-description.v1');
  }
  contract.requiredCapabilities = [...capabilities].sort();
  return contract;
}

/** This snapshot never imports the mutable standalone theme tree. */
export function releasedMaterialsContract(id: string, revision?: string): MaterialsTemplateContract | undefined {
  const release = availableMaterialsTemplateReleases().find(item => item.contract.templateId === id && (!revision || item.contract.contractRevision === revision));
  if (release) return structuredClone(release.contract);
  if (!revision || revision === demoMaterialsRevision(id)) return demoMaterialsContract(id);
  if (revision === identityMaterialsRevision(id)) return identityMaterialsContract(id);
  if (revision === executableMaterialsRevision(id)) return executableMaterialsContract(id);
  const frozen = frozenContract(id, revision);
  if (frozen) return frozen;
  return industryContract(id, revision) ?? outreachContract(id, revision) ?? getModernMaterialsTemplate(id, revision) ?? (revision === `2026-09-19.${id}-materials.1` ? getTypedMaterialsTemplate(id) : undefined);
}

export function renderReleasedMaterials(draft: Draft, options: RenderOptions): string | undefined {
  const revision = draft.materials?.contractRevision;
  if (!revision) return;
  const release = availableMaterialsTemplateReleases().find(item => item.contract.templateId === draft.template && item.contract.contractRevision === revision);
  if (release) return renderMaterialsTemplateRelease(release,draft,options);
  // The repaired release renders demos, private projects and customer publications alike.
  if (revision === demoMaterialsRevision(draft.template) && demoMaterialsContract(draft.template)) {
    const previous = {...draft, materials: {...draft.materials!, contractRevision: identityMaterialsRevision(draft.template)}};
    const html = renderReleasedMaterials(previous, options);
    if (html === undefined) return;
    return getOutreachDemoContract(draft.template) ? repairOutreachMaterials(html, draft, options) : repairMaterialsDemo(html, draft, options);
  }
  if (outreachContract(draft.template, revision)) return outreachRender(draft, options);
  const original = frozenContract(draft.template, [executableMaterialsRevision(draft.template), identityMaterialsRevision(draft.template)].includes(revision) ? undefined : revision);
  if (!original) {
    const innerRevision = revision === identityMaterialsRevision(draft.template) ? executableMaterialsRevision(draft.template) : revision;
    if (!industryContract(draft.template, innerRevision)) return;
    return industryRender({ ...draft, materials: { ...draft.materials!, contractRevision: innerRevision } }, options);
  }
  const frozenDraft = revision === original.contractRevision ? draft : { ...draft, materials: { ...draft.materials!, contractRevision: original.contractRevision } };
  return frozenRender(frozenDraft, options);
}

/** Preview drops page scripts at its sandbox boundary, so its trusted replacement is versioned too. */
export function releasedMaterialsPreviewRuntime(draft: Draft): string | undefined {
  const revision = draft.materials?.contractRevision;
  const release = availableMaterialsTemplateReleases().find(item => item.contract.templateId === draft.template && item.contract.contractRevision === revision);
  if (release && [demoRendererRevision, outreachDemoRendererRevision].includes(release.contract.rendererRevision || '')) return frozenContract(release.rendererTemplateId) ? frozenMaterialsPreviewRuntime : frozenIndustryPreviewRuntime;
  if (revision && releasedMaterialsContract(draft.template, revision)) return frozenContract(draft.template) ? frozenMaterialsPreviewRuntime : frozenIndustryPreviewRuntime;
}

function materialsRendererContract(release: MaterialsTemplateRelease): MaterialsTemplateContract | undefined {
  if ([demoRendererRevision, outreachDemoRendererRevision].includes(release.contract.rendererRevision || '')) {
    const source = release.rendererContractRevision === demoMaterialsRevision(release.rendererTemplateId) ? demoMaterialsContract(release.rendererTemplateId) : undefined;
    return source?.rendererRevision === release.contract.rendererRevision ? source : undefined;
  }
  if (release.contract.rendererRevision === materialsRendererRevision) return frozenContract(release.rendererTemplateId,release.rendererContractRevision);
}

/** Explicit mappings let a new template choose stable slot names without Product Radar knowing them. */
export function renderMaterialsTemplateRelease(release: MaterialsTemplateRelease, draft: Draft, options: RenderOptions): string {
  const source = materialsRendererContract(release);
  if (validateMaterialsTemplateRelease(release).length || !source || !draft.materials) throw Error('Unknown materials renderer release');
  const map = <T extends {slotId:string}>(bindings:T[], mapping:Record<string,string>):T[] => bindings.map(binding => {
    const slotId = mapping[binding.slotId];
    if (!slotId) throw Error(`Unbound materials slot ${binding.slotId}`);
    return {...binding,slotId};
  });
  const materials = {...draft.materials,templateId:release.rendererTemplateId,contractRevision:release.rendererContractRevision,imageBindings:map(draft.materials.imageBindings,release.imageSlotMap),textBindings:map(draft.materials.textBindings,release.textSlotMap)};
  const copy = {...draft.copy};
  for (const locale of draft.languages) {
    const value = (slotId:string) => materials.textBindings.find(binding => binding.slotId === slotId && binding.locale === locale)?.text || '';
    copy[locale] = {headline:value('hero-headline'),subtitle:value('hero-subtitle'),cta:value('primary-cta'),about:value('company-about')};
  }
  const mapped = {...draft,template:release.rendererTemplateId as Draft['template'],copy,materials};
  return [demoRendererRevision, outreachDemoRendererRevision].includes(release.contract.rendererRevision || '') ? renderReleasedMaterials(mapped,options)! : frozenRender(mapped,options);
}

/** Alias releases may rename slots and narrow copy limits, but cannot claim layout capacity absent from their renderer. */
export function validateMaterialsTemplateRelease(release:MaterialsTemplateRelease):string[] {
  const errors:string[]=[];
  const source=materialsRendererContract(release);
  const contract=release.contract;
  if(frozenContract(contract.templateId,contract.contractRevision)||industryContract(contract.templateId,contract.contractRevision)||outreachContract(contract.templateId,contract.contractRevision)||([executableMaterialsRevision(contract.templateId),identityMaterialsRevision(contract.templateId),demoMaterialsRevision(contract.templateId)].includes(contract.contractRevision)&&identityMaterialsContract(contract.templateId)))errors.push('published_template_revision_collision');
  if(!source)return [...errors,'renderer_release_unavailable'];
  const expected=declareExecutionMetadata(source);
  if(contract.schemaVersion!=='wr-template-materials-v1'||!contract.materialsReady||contract.imagePolicy!==expected.imagePolicy||contract.contentPolicy!==expected.contentPolicy||JSON.stringify(contract.pages)!==JSON.stringify(expected.pages)||JSON.stringify(contract.selectionGroups)!==JSON.stringify(expected.selectionGroups)||JSON.stringify(contract.optionalSections.map(s=>s.id))!==JSON.stringify(expected.optionalSections.map(s=>s.id)))errors.push('renderer_contract_incompatible');
  const compare=(kind:'image'|'text')=>{
    const slots=kind==='image'?contract.imageSlots:contract.textSlots;
    const targets=kind==='image'?expected.imageSlots:expected.textSlots;
    const mapping=kind==='image'?release.imageSlotMap:release.textSlotMap;
    if(new Set(slots.map(s=>s.id)).size!==slots.length||Object.keys(mapping).length!==slots.length||Object.keys(mapping).some(id=>!slots.some(s=>s.id===id))||slots.some(s=>!mapping[s.id])||targets.some(s=>!Object.values(mapping).includes(s.id)))errors.push(`${kind}_mapping_incomplete`);
    if(new Set(Object.values(mapping)).size!==Object.values(mapping).length)errors.push(`${kind}_mapping_duplicate`);
    for(const slot of slots){
      const target=targets.find(s=>s.id===mapping[slot.id]);
      if(!target){errors.push(`${kind}_mapping_unknown`);continue;}
      const keys=kind==='image'?['page','min','max','required','repeat','selectionGroup','role','sourcePolicy','materialSource','productScope','reusePolicy','maxProducts','width','height','fit','allowedMimeTypes']:['page','min','max','required','repeat','format','factSources'];
      if(keys.some(key=>JSON.stringify(Reflect.get(slot,key))!==JSON.stringify(Reflect.get(target,key))))errors.push(`${kind}_mapping_incompatible`);
      if('maxCodePoints'in slot&&'maxCodePoints'in target&&(slot.maxCodePoints<1||slot.maxCodePoints>target.maxCodePoints||slot.maxLines<1||slot.maxLines>target.maxLines))errors.push('text_mapping_incompatible');
    }
  };
  compare('image');compare('text');
  if(JSON.stringify([...(contract.requiredCapabilities||[])].sort())!==JSON.stringify([...(expected.requiredCapabilities||[]), ...(contract.productApplicability ? ['product.identity.v1'] : [])].sort()))errors.push('capability_declaration_mismatch');
  return [...new Set(errors)];
}

export function validateMaterialsReleaseRegistry(releases:readonly MaterialsTemplateRelease[]):string[] {
  const keys=releases.map(release=>JSON.stringify([release.contract.templateId,release.contract.contractRevision]));
  return [...(new Set(keys).size===keys.length?[]:['duplicate_template_revision']),...releases.flatMap(validateMaterialsTemplateRelease)];
}

export function availableMaterialsTemplateReleases():readonly MaterialsTemplateRelease[] {
  return additionalMaterialsReleases.filter(release=>!validateMaterialsTemplateRelease(release).length&&additionalMaterialsReleases.filter(other=>other.contract.templateId===release.contract.templateId&&other.contract.contractRevision===release.contract.contractRevision).length===1);
}
