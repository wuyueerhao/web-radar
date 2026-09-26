import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { expect, it } from 'vitest';
import { newBanner } from '../src/shared/banner-config';
import type { Asset } from '../src/shared/model';
import { templateMediaRequirements } from '../src/shared/template-media';
import { renderSite } from '../src/templates';
import { renderReleasedMaterials } from '../src/templates/materials-releases';
import { editDraft } from '../src/worker/domain';
import { draftFromMaterials } from '../src/worker/materials-service';
import { typedMaterialsFixture } from './fixtures/materials-typed';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const nodes = (root: Node): Element[] => [
  ...('tagName' in root ? [root] : []),
  ...('childNodes' in root ? root.childNodes.flatMap(nodes) : []),
];
const attr = (n: Element, name: string) => n.attrs.find((a) => a.name === name)?.value;
const text = (n: Node): string =>
  'value' in n ? n.value : 'childNodes' in n ? n.childNodes.map(text).join(' ') : '';
const hero = (root: Node) =>
  nodes(root).find((n) => attr(n, 'data-wr-banner') === 'custom' || attr(n, 'data-wr-collection-hero') !== undefined)!;
const images = (root: Node) =>
  nodes(root)
    .filter((n) => n.tagName === 'img')
    .map((n) =>
      ['src', 'srcset', 'width', 'height', 'data-wr-material-image'].map((key) => attr(n, key)),
    );
const options = {
  projectId: 'materials-banner',
  lang: 'en' as const,
  page: 'home',
  assetUrl: (id: string) => `/bound/${id}`,
  inquiryUrl: '/inquiry',
  imageVariants: (id: string, widths: number[]) =>
    widths.map((width) => ({ url: `/bound/${id}?width=${width}`, width, height: width / 2 })),
};
async function fixture(template: string) {
  const input = await typedMaterialsFixture(template, 2);
  return draftFromMaterials(
    input,
    Object.fromEntries(input.materials.media.map((a) => [a.id, { id: a.id } as Asset])),
  );
}
const customCopy = {
  eyebrow: 'Saved eyebrow',
  headline: 'Saved headline',
  subtitle: 'Saved subtitle',
  primaryButtonText: 'Saved primary',
  primaryButtonUrl: 'catalog/custom.html',
  secondaryButtonText: 'Saved secondary',
  secondaryButtonUrl: 'contact/custom.html',
  tags: ['Saved tag one', 'Saved tag two'],
  floatingPills: ['Saved pill one', 'Saved pill two'],
};

it.each(Object.keys(templateMediaRequirements))(
  '%s applies saved Banner copy after binding without changing collection media or product content',
  async (template) => {
    const draft = await fixture(template),
      original = structuredClone(draft);
    const baseline = parse(renderSite(draft, options));
    const saved = editDraft(draft, {
      ...draft,
      banners: [{ ...newBanner('home', ['home']), ...customCopy }],
    });
    const output = parse(renderSite(saved, options)),
      banner = hero(output);
    expect(banner).toBeDefined();
    for (const value of [
      'Saved eyebrow',
      'Saved headline',
      'Saved subtitle',
      'Saved primary',
      'Saved secondary',
      ...customCopy.tags,
      ...customCopy.floatingPills,
    ])
      expect(text(banner), template).toContain(value);
    const links = nodes(banner).filter(
      (n) => n.tagName === 'a' && attr(n, 'class')?.includes('button'),
    );
    expect(links.map((n) => attr(n, 'href'))).toEqual([
      'catalog/custom.html',
      'contact/custom.html',
    ]);
    expect(images(output)).toEqual(images(baseline));
    expect(nodes(output).filter((n) => n.tagName === 'h1')).toHaveLength(1);
    expect(nodes(output).some((n) => attr(n, 'data-wr-mobile-menu') !== undefined)).toBe(true);
    expect(saved.materials).toEqual(original.materials);
    expect(draft).toEqual(original);
  },
);

it.each(['senseng-candy', 'juno-toys'])(
  '%s applies saved image and background Banner media to the whole bound hero',
  async (template) => {
    const draft = await fixture(template);
    for (const mode of ['image', 'background'] as const) {
      const saved = editDraft(draft, {
        ...draft,
        banners: [
          {
            ...newBanner('home', ['home']),
            ...customCopy,
            mode,
            slides: [
              {
                assetId: 'custom-hero',
                alt: 'Saved collection image',
                ...(mode === 'image' ? { headline: 'Hidden slide headline' } : {}),
              },
            ],
          },
        ],
      });
      const output = parse(renderSite(saved, options)),
        banner = hero(output);
      expect(images(banner).map((i) => i[0])).toEqual(['/bound/custom-hero']);
      expect(nodes(output).filter((n) => n.tagName === 'h1')).toHaveLength(1);
      expect(nodes(banner).some((n) => attr(n, 'class') === 'wr-confirmed-collection-nav')).toBe(
        false,
      );
      if (mode === 'image') {
        expect(nodes(banner).filter((n) => ['h2', 'p', 'a'].includes(n.tagName))).toHaveLength(0);
        expect(text(banner)).not.toContain('Hidden slide headline');
        expect(text(banner)).not.toContain('Saved tag');
      } else {
        expect(text(banner)).toContain('Saved headline');
        expect(text(banner)).toContain('Saved secondary');
        expect(text(banner)).toContain('Saved pill one');
      }
      const remaining = nodes(output).filter((n) => attr(n, 'data-wr-product-card') !== undefined);
      expect(remaining).toHaveLength(2);
      expect(images(remaining[0])[0][1]).toContain('width=640');
    }
  },
);

it.each(
  Object.keys(templateMediaRequirements).flatMap((template) =>
    ['catalog', 'about', 'contact'].map((page) => [template, page]),
  ),
)('applies every saved copy control to the assigned typed %s %s page', async (template, page) => {
  const draft = await fixture(template);
  const saved = editDraft(draft, {
    ...draft,
    banners: [{ ...newBanner('page', [page as 'catalog' | 'about' | 'contact']), ...customCopy }],
  });
  const output = parse(renderSite(saved, { ...options, page }));
  const banner = nodes(output).find((n) => attr(n, 'data-wr-banner') === 'custom')!;
  for (const value of [
    'Saved eyebrow',
    'Saved headline',
    'Saved subtitle',
    'Saved primary',
    'Saved secondary',
    ...customCopy.tags,
    ...customCopy.floatingPills,
  ])
    expect(text(banner)).toContain(value);
});

it('keeps unconfigured output and page/detail scope unchanged for typed materials', async () => {
  const draft = await fixture('senseng-candy');
  expect(renderSite(draft, options)).toBe(renderReleasedMaterials(draft, options));
  const empty = editDraft(draft, { ...draft, banners: [newBanner('new-home', ['home'])] });
  expect(renderSite(empty, options)).toBe(renderSite(draft, options));
  const saved = editDraft(draft, {
    ...draft,
    banners: [{ ...newBanner('about', ['about']), headline: 'About Banner heading' }],
  });
  expect(renderSite(saved, options)).toBe(renderSite(draft, options));
  for (const page of ['catalog', 'detail']) {
    const scoped = { ...options, page, productId: draft.primaryProductId };
    expect(renderSite(saved, scoped)).toBe(renderSite(draft, scoped));
  }
  expect(text(parse(renderSite(saved, { ...options, page: 'about' })))).toContain(
    'About Banner heading',
  );
});

it.each(['senseng-candy', 'juno-toys'])(
  '%s keeps confirmed collection images when pure-image mode has no uploaded media',
  async (template) => {
    const draft = await fixture(template),
      baseline = parse(renderSite(draft, options));
    const saved = editDraft(draft, {
      ...draft,
      banners: [{ ...newBanner('home', ['home']), mode: 'image' }],
    });
    const output = parse(renderSite(saved, options)),
      banner = hero(output);
    expect(images(output)).toEqual(images(baseline));
    expect(nodes(banner).some((n) => attr(n, 'class') === 'wr-confirmed-hero-copy')).toBe(false);
    expect(nodes(output).filter((n) => n.tagName === 'h1')).toHaveLength(1);
  },
);
