import {describe,expect,it} from 'vitest';
import {materialsSubmissionSchema,materialsPages} from '../src/shared/materials';
import {templateMediaRequirements} from '../src/shared/template-media';
import type {Asset} from '../src/shared/model';
import {getMaterialsTemplate,validateMaterialsPositions} from '../src/templates/materials';
import {draftFromMaterials} from '../src/worker/materials-service';
import {editDraft} from '../src/worker/domain';
import {renderSite} from '../src/templates';
import {typedMaterialsFixture} from './fixtures/materials-typed';
import {createHash} from 'node:crypto';
import lockedContracts from '../docs/materials-requirements/typed-2026-09-19.json';

describe('all-template confirmed materials handoff',()=>{
  it('freezes published revision semantics across template layout changes',()=>{
    for(const[id,locked]of Object.entries(lockedContracts.templates)){
      const contract=getMaterialsTemplate(id,locked.contractRevision)!;
      expect(createHash('sha256').update(JSON.stringify(contract)).digest('hex'),id).toBe(locked.sha256);
    }
  });
  it.each(Object.keys(templateMediaRequirements))('%s accepts and preserves 1, 5 and 20 products across edits and all pages',async id=>{
    const profile=getMaterialsTemplate(id)!;
    expect(profile.imagePolicy).toBe('typed-regions-v1');
    expect(profile.imageSlots.filter(s=>['product-main','product-gallery'].includes(s.id)).every(s=>!s.role&&s.maxProducts===undefined)).toBe(true);
    for(const count of [1,5,20]){
      const input=await typedMaterialsFixture(id,count),m=input.materials;
      expect(materialsSubmissionSchema.safeParse(input).success,`${id}:${count}:wire`).toBe(true);
      expect(validateMaterialsPositions(m),`${id}:${count}:positions`).toEqual([]);
      const draft=draftFromMaterials(input,Object.fromEntries(m.media.map(a=>[a.id,{id:`stored-${a.id}`} as Asset])));
      expect(draft.products).toHaveLength(count);
      expect(draft.company).toMatchObject({targetMarkets:'United States',customerTypes:'Retail buyers',cooperationProcess:'Confirm specifications and request a sample'});
      expect(draft.products.map(p=>p.gallery?.length)).toEqual(Array(count).fill(2));
      if(id.startsWith('single-'))draft.primaryProductId=`p${count-1}`;
      const edited=editDraft(draft,structuredClone(draft));
      expect(edited.materials?.imageBindings).toHaveLength(m.imageBindings.length);
      for(const page of materialsPages){
        const html=renderSite(edited,{projectId:'fixture',page,lang:'en',productId:`p${count-1}`,assetUrl:id=>`/test/${id}`,inquiryUrl:'/inquiry',preview:true});
        expect(html).toContain('wr-materials-site');
        expect(html).not.toContain('data-wr-product-id="demo-');
        if(page==='catalog'||page==='detail')expect(html).toContain(`Actual toy ${count-1}`);
        if(page==='detail')expect(html.includes(`stored-gallery-p${count-1}`),`${id}:${count}:original gallery`).toBe(true);
      }
    }
  },30000);
});
