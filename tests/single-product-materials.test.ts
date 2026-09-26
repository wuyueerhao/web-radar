import { describe, expect, it } from 'vitest';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { renderSite } from '../src/templates';
import { singleProductTemplates } from '../src/templates/themes/singleProduct';
import { typedMaterialsFixture } from './fixtures/materials-typed';
import { draftFromMaterials } from '../src/worker/materials-service';
import type { Asset } from '../src/shared/model';
import { newBanner } from '../src/shared/banner-config';
type Node = DefaultTreeAdapterMap['node'];
const nodes = (n: Node): DefaultTreeAdapterMap['element'][] => [
  ...('tagName' in n ? [n] : []),
  ...('childNodes' in n ? n.childNodes.flatMap(nodes) : []),
];
const attr = (n: DefaultTreeAdapterMap['element'], key: string) =>
  n.attrs.find((a) => a.name === key)?.value;
const options = {
  projectId: 'single',
  lang: 'en' as const,
  page: 'home',
  preview: true,
  assetUrl: (id: string) => '/bound/' + id,
  inquiryUrl: '/inquiry',
};
describe('single-product confirmed layouts', () => {
  it.each(singleProductTemplates)(
    '%s preserves its hero and primary product without changing saved records',
    async (template) => {
      const input = await typedMaterialsFixture(template, 3);
      const draft = draftFromMaterials(
        input,
        Object.fromEntries(input.materials.media.map((m) => [m.id, { id: m.id } as Asset])),
      );
      draft.primaryProductId = 'p1';
      const before = JSON.stringify(draft);
      for (const page of ['home', 'catalog', 'detail', 'contact']) {
        const html = renderSite(draft, { ...options, page }),
          all = nodes(parse(html));
        expect(all.filter((n) => n.tagName === 'h1')).toHaveLength(1);
        expect(all.some((n) => attr(n, 'data-wr-product-list') !== undefined)).toBe(false);
        expect(html).not.toContain('Actual toy 2');
        expect(html).not.toContain('Actual toy 0');
        if (page === 'home') {
          const hero = all.find((n) => attr(n, 'data-sp-hero') !== undefined)!;
          expect(hero).toBeDefined();
        const boundHero = all.find(n => attr(n, 'data-wr-material-image') === 'hero-slide-0')!;
        expect(attr(boundHero, boundHero.tagName === 'video' ? 'poster' : 'src')).toContain('/bound/m1');
          expect(all.some((n) => attr(n, 'data-wr-collection-hero') !== undefined)).toBe(false);
          if (template === 'single-artisan-craft')
            expect(
              nodes(hero).some((n) => ['h1', 'h2', 'p', 'a', 'button'].includes(n.tagName)),
            ).toBe(false);
          if (template === 'single-wellness-nordic')
            expect(attr(hero, 'style') || '').not.toContain('background-image');
          if (template === 'single-device-showcase')
            expect(
              nodes(hero).some(
                (n) =>
                  n.tagName === 'video' &&
                  attr(n, 'data-src')?.endsWith('hardware.mp4') &&
                  attr(n, 'loop') !== undefined,
              ),
            ).toBe(true);
        }
        if (page === 'detail') expect(html).toContain('/bound/gallery-p1');
        if (page === 'contact')
          expect(
            all
              .filter((n) => n.tagName === 'option' && attr(n, 'value'))
              .map((n) => attr(n, 'value')),
          ).toEqual(['p1']);
      }
      expect(JSON.stringify(draft)).toBe(before);
    },
  );
  it.each(singleProductTemplates)(
    '%s supports page Banner image replacement without adding a second H1',
    async (template) => {
      const input = await typedMaterialsFixture(template, 1);
      const draft = draftFromMaterials(
        input,
        Object.fromEntries(input.materials.media.map((m) => [m.id, { id: m.id } as Asset])),
      );
      draft.banners = [
        {
          ...newBanner('home', ['home']),
          mode: 'image',
          slides: [{ assetId: 'own-banner', alt: 'Own product photograph' }],
        },
      ];
      const all = nodes(parse(renderSite(draft, options)));
      expect(all.filter((n) => n.tagName === 'h1')).toHaveLength(1);
      expect(all.some((n) => n.tagName === 'img' && attr(n, 'src') === '/bound/own-banner')).toBe(
        true,
      );
    },
  );
});
