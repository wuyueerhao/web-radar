import { describe, expect, it } from 'vitest';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { renderSite } from '../src/templates';
import { getMaterialsTemplate } from '../src/templates/materials';
import { draftFromMaterials } from '../src/worker/materials-service';
import { defaultDraft, editDraft, validateDraft } from '../src/worker/domain';
import { typedMaterialsFixture } from './fixtures/materials-typed';
import { templateMediaRequirements } from '../src/shared/template-media';
import type { Asset, Draft, Language } from '../src/shared/model';
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value;
function elements(root: Node): Element[] {
  return [
    ...('tagName' in root ? [root] : []),
    ...('childNodes' in root ? root.childNodes.flatMap(elements) : []),
  ];
}
const text = (n: Node): string =>
  n.nodeName === '#text' && 'value' in n
    ? n.value
    : 'childNodes' in n && !['style', 'script'].includes(n.nodeName)
      ? n.childNodes.map(text).join(' ')
      : '';
async function fixture(template: string, count = 19, contractRevision?: string) {
  const input = await typedMaterialsFixture(template, count, contractRevision);
  return draftFromMaterials(
    input,
    Object.fromEntries(input.materials.media.map((a) => [a.id, { id: a.id } as Asset])),
  );
}
const options = (page = 'home', productId = 'p0', lang: Language = 'en') => ({
  projectId: 'test',
  page,
  lang,
  productId,
  assetUrl: (id: string) => `/bound/${id}`,
  inquiryUrl: '/inquiry',
  preview: true,
});
const grouped = (draft: Draft) => Object.assign(draft, { productDisplayGroups: [['p0', 'p1']] });

describe('confirmed materials presentation', () => {
  it.each(Object.keys(templateMediaRequirements).filter(id => !id.startsWith('single-')))(
    '%s presents uncropped collections, a native mobile menu and visible first content',
    async (template) => {
      const draft = await fixture(template, 2),
        html = renderSite(draft, options()),
        nodes = elements(parse(html));
      const hero = nodes.find((n) => attr(n, 'data-wr-collection-hero') !== undefined);
      expect(hero, template + ' collection hero').toBeDefined();
      expect(
        nodes.filter((n) => n.tagName === 'h1'),
        template + ' one primary heading',
      ).toHaveLength(1);
      expect(
        attr(
          nodes.find((n) => n.tagName === 'img' && attr(n, 'data-wr-material-image'))!,
          'data-wr-material-image',
        ),
        template + ' first content image',
      ).toBe('hero-slide-0');
      expect(
        nodes.some((n) => (attr(n, 'class') || '').split(' ').includes('wr-mobile-nav')),
        template + ' obsolete mobile menu',
      ).toBe(false);
      expect(
        nodes.some(
          (n) => attr(n, 'data-wr-prev') !== undefined || attr(n, 'data-wr-next') !== undefined,
        ),
        template + ' obsolete collection controls',
      ).toBe(false);
      expect(
        nodes.some((n) =>
          /(?:^|\s)(?:vertical-counter|review-star-icon|fa-star|bi-star-fill)(?:\s|$)/.test(
            attr(n, 'class') || '',
          ),
        ),
        template + ' numeric or rating decoration',
      ).toBe(false);
      for (const bar of nodes.filter((n) =>
        (attr(n, 'class') || '').split(' ').includes('header-top-bar'),
      ))
        expect(attr(bar, 'data-wr-desktop-extra')).toBeDefined();

      expect(
        elements(hero!).some((n) => attr(n, 'data-wr-material-image') === 'product-main'),
      ).toBe(false);
      const expected = getMaterialsTemplate(template,draft.materials!.contractRevision)!.imageSlots.filter((s) =>
        s.id.startsWith('hero-slide-'),
      );
      for (const slot of expected) {
        const image = nodes.find(
          (n) => n.tagName === 'img' && attr(n, 'data-wr-material-image') === slot.id,
        );
        expect(image, slot.id).toBeDefined();
        expect(attr(image!, 'width')).toBe(String(slot.width));
        expect(attr(image!, 'height')).toBe(String(slot.height));
        expect(attr(image!, 'style')).toContain('object-fit:contain');
      }
      const menu = nodes.find(
        (n) => n.tagName === 'details' && attr(n, 'data-wr-mobile-menu') !== undefined,
      );
      expect(menu).toBeDefined();
      expect(elements(menu!).some((n) => n.tagName === 'summary')).toBe(true);
      const mobile = nodes.find((n) => attr(n, 'data-wr-mobile-header') !== undefined)!;
      expect(
        elements(mobile).filter((n) => attr(n, 'data-wr-inquiry-cta') !== undefined),
      ).toHaveLength(1);
      expect(
        nodes
          .filter((n) => attr(n, 'data-reveal') !== undefined)
          .every((n) => (attr(n, 'class') || '').split(' ').includes('wr-revealed')),
      ).toBe(true);
      const first = nodes.find(
        (n) => n.tagName === 'img' && attr(n, 'data-wr-material-image') === 'hero-slide-0',
      )!;
      expect(attr(first, 'loading')).toBe('eager');
      expect(attr(first, 'fetchpriority')).toBe('high');
    },
  );

  it.each([
    'saas-automation',
    'fintech-platform',
    'digital-marketing',
    'crafto-corporate',
    'corpox-ai-agency',
    'corpox-consulting',
  ])('%s keeps the real desktop navigation containers in document flow', async (template) => {
    const draft = await fixture(template, 2),
      html = renderSite(draft, options()),
      nodes = elements(parse(html));
    const header = nodes.find((n) => n.tagName === 'header')!;
    expect(attr(header, 'data-wr-flow-header')).toBeDefined();
    if (template.startsWith('corpox-')) {
      const wrapper = nodes.find((n) =>
        (attr(n, 'class') || '').split(' ').includes('header-transparent-with-topbar'),
      );
      if (wrapper) expect(attr(wrapper, 'data-wr-flow-header')).toBeDefined();
    } else
      expect(elements(header).some((n) => attr(n, 'data-wr-flow-nav') !== undefined)).toBe(true);
    expect(html).toContain('[data-wr-flow-header]');
    expect(html).toContain(
      'position:relative!important;inset:auto!important;transform:none!important',
    );
    expect(renderSite({ ...draft, materials: undefined }, options())).not.toContain(
      'data-wr-flow-header',
    );
  });
  it.each(Object.keys(templateMediaRequirements).filter(id => !id.startsWith('single-')))(
    '%s groups only confirmed IDs and preserves stored products and original galleries',
    async (template) => {
      const draft = grouped(await fixture(template));
      draft.products[2].name = draft.products[0].name;
      const before = JSON.stringify(draft);
      for (const [page, count] of [
        ['home', 8],
        ['catalog', 18],
      ] as const) {
        const nodes = elements(parse(renderSite(draft, options(page))));
        const list = nodes.find((n) => attr(n, 'data-wr-product-list') === page)!;
        expect(list, template + ' ' + page).toBeDefined();
        const cards = elements(list).filter((n) => attr(n, 'data-wr-product-card') !== undefined);
        expect(cards).toHaveLength(count);
        expect(cards.some((n) => attr(n, 'data-wr-product-id') === 'p1')).toBe(false);
        expect(cards.some((n) => attr(n, 'data-wr-product-id') === 'p2')).toBe(true);
        expect(cards.every((n) => !text(n).includes('Verified description'))).toBe(true);
      }
      const contact = elements(parse(renderSite(draft, options('contact'))));
      const select = contact.find(
        (n) => n.tagName === 'select' && attr(n, 'name') === 'productId',
      )!;
      expect(
        elements(select).filter((n) => n.tagName === 'option' && attr(n, 'value')),
      ).toHaveLength(18);
      const detail = renderSite(draft, options('detail', 'p1'));
      expect(detail).toContain('/bound/gallery-p1');
      expect(detail).toContain('Actual toy 1');
      const nodes = elements(parse(detail)),
        main = nodes.find(
          (n) =>
            n.tagName === 'img' &&
            attr(n, 'data-wr-material-image') === 'product-main' &&
            attr(n, 'data-wr-material-product') === 'p1',
        )!;
      expect(attr(main, 'loading')).toBe('eager');
      expect(JSON.stringify(draft)).toBe(before);
      expect(draft.products).toHaveLength(19);
    },
  );
  it('preserves legacy company facts and product features without ratings', async () => {
    const draft = await fixture('senseng-candy', 2, '2026-09-19.senseng-candy-materials.1');
    Object.assign(draft.company, {
      description: '',
      targetMarkets: '',
      customerTypes: '',
      cooperationProcess: '',
      certifications: '',
      capabilities: '',
      establishedYear: '',
    });
    draft.copy.en!.about = 'A toy with rounded cheeks';
    draft.materials!.textBindings.find((b) => b.slotId === 'company-about')!.text =
      'A toy with rounded cheeks';
    for (const page of ['home', 'about']) {
      const nodes = elements(parse(renderSite(draft, options(page))));
      expect(text(parse(renderSite(draft, options(page))))).not.toContain('★★★★★');
      const about = nodes.find((n) => attr(n, 'data-wr-company-facts') !== undefined)!;
      expect(about).toBeDefined();
      expect(text(about)).toContain(draft.company.name);
      if (page === 'about') expect(text(about)).toContain('rounded cheeks');
      else expect(text(about)).not.toContain('rounded cheeks');
      expect(text(about)).not.toContain('Soft toy');
      expect(elements(about).some((n) => attr(n, 'data-wr-company-metric') !== undefined)).toBe(
        false,
      );
    }
    draft.company.description = 'A registered trading company';
    draft.company.targetMarkets = 'Europe';
    draft.company.customerTypes = 'Retail buyers';
    draft.company.cooperationProcess = 'Confirm specifications before ordering';
    const nodes = elements(parse(renderSite(draft, options('about')))),
      about = nodes.find((n) => attr(n, 'data-wr-company-facts') !== undefined)!;
    for (const value of [
      draft.company.description,
      draft.company.targetMarkets,
      draft.company.customerTypes,
      draft.company.cooperationProcess,
    ])
      expect(text(about)).toContain(value);
  });

  it('shows a repeated size once per card and omits generic toy descriptions from material specifications', async () => {
    const draft = await fixture('senseng-candy', 2),
      product = draft.products[0];
    product.name = '3.5 Inch Duckling Squishy Friend';
    product.dimensions = '3.5 in compact size';
    product.material = 'Soft squishy toy; paperboard packaging';
    const home = elements(parse(renderSite(draft, options()))),
      card = home.find(
        (n) =>
          attr(n, 'data-wr-product-card') !== undefined && attr(n, 'data-wr-product-id') === 'p0',
      )!;
    expect(text(card).match(/3\.5/g)).toHaveLength(1);
    expect(text(card)).toContain('Duckling Squishy Friend');
    product.name = 'Senseng 3.5 in Cat Squishy Friend';
    const cat = elements(parse(renderSite(draft, options()))).find(
      (n) =>
        attr(n, 'data-wr-product-card') !== undefined && attr(n, 'data-wr-product-id') === 'p0',
    )!;
    expect(text(cat).match(/3\.5/g)).toHaveLength(1);
    expect(text(cat)).toContain('Senseng Cat Squishy Friend');

    const detail = text(parse(renderSite(draft, options('detail'))));
    expect(detail).not.toContain(product.material);
    product.material = 'Silicone';
    expect(text(parse(renderSite(draft, options('detail'))))).toContain('Silicone');
  });

  it('removes only the known empty Candy detail badge without pruning structural containers', async () => {
    const draft = await fixture('senseng-candy', 2);
    const badge = (n: Element) => n.tagName === 'div' && (attr(n, 'style') || '').includes('padding:4px 14px') && (attr(n, 'style') || '').includes('border-radius:9999px');
    const nodes = elements(parse(renderSite(draft, options('detail'))));
    expect(nodes.filter(badge).length).toBe(0);
    expect(nodes.some(n => attr(n, 'class') === 'wr-progress-container')).toBe(true);
    delete draft.materials;
    expect(elements(parse(renderSite(draft, options('detail')))).some(badge)).toBe(true);
  });

  it('keeps a product inquiry preselection when a detail route is an explicit display alias', async () => {
    const draft = grouped(await fixture('senseng-candy', 2));
    draft.products[0].name = 'Contact Sales Sticker';
    const cardLink = elements(parse(renderSite(draft, options()))).find(
      (n) => n.tagName === 'a' && attr(n, 'title') === 'Contact Sales Sticker',
    )!;
    expect(attr(cardLink, 'data-wr-page')).toBe('detail');
    const nodes = elements(parse(renderSite(draft, options('detail', 'p1'))));
    const inquiry = nodes.find(
      (n) =>
        n.tagName === 'a' &&
        attr(n, 'data-wr-page') === 'contact' &&
        attr(n, 'data-wr-product-id') === 'p1',
    )!;
    expect(inquiry).toBeDefined();
    expect(
      new URL(
        attr(inquiry, 'href')!,
        'https://example.test/en/products/p1/index.html',
      ).searchParams.get('productId'),
    ).toBe('p0');
  });
  it.each(Object.keys(templateMediaRequirements).filter(id => !id.startsWith('single-')))(
    '%s routes inquiry and language links correctly at every depth',
    async (template) => {
      const draft = await fixture(template, 2);
      draft.languages = ['en', 'de', 'fr', 'es', 'pt', 'it'];
      draft.copy.en!.cta = 'Send Product Inquiry';
      draft.materials!.textBindings.find((b) => b.slotId === 'primary-cta')!.text =
        'Send Product Inquiry';
      for (const [page, path] of [
        ['home', 'index.html'],
        ['catalog', 'catalog/index.html'],
        ['detail', 'products/p0/index.html'],
        ['about', 'about/index.html'],
        ['contact', 'contact/index.html'],
      ]) {
        const nodes = elements(parse(renderSite(draft, options(page))));
        const links = nodes.filter((n) => n.tagName === 'a' && attr(n, 'data-wr-lang'));
        expect(new Set(links.map((n) => attr(n, 'data-wr-lang'))).size).toBe(6);
        for (const link of links) {
          const url = new URL(attr(link, 'href')!, `https://example.test/en/${path}`);
          expect(url.pathname, template + ':' + page).toBe(
            `/${attr(link, 'data-wr-lang')}/${path}`,
          );
        }
        for (const link of nodes.filter(
          (n) => n.tagName === 'a' && /Send Product Inquiry/.test(text(n)),
        ))
          expect(new URL(attr(link, 'href')!, `https://example.test/en/${path}`).pathname).toBe(
            '/en/contact/index.html',
          );
      }
    },
  );
});

it('standalone language links preserve the current nested product route', async () => {
  for (const template of Object.keys(templateMediaRequirements)) {
    const draft = await fixture(template, 2);
    draft.materials = undefined;
    draft.languages = ['en', 'de'];
    for (const link of elements(parse(renderSite(draft, options('detail')))).filter(
      (n) => n.tagName === 'a' && attr(n, 'data-wr-lang'),
    )) {
      expect(
        new URL(attr(link, 'href')!, 'https://example.test/en/products/p0/index.html').pathname,
        template,
      ).toBe(`/${attr(link, 'data-wr-lang')}/products/p0/index.html`);
    }
  }
});

describe('explicit display group draft metadata', () => {
  const input = () => ({
    ...defaultDraft(),
    products: [0, 1, 2].map((i) => ({
      id: `p${i}`,
      name: 'Same name',
      description: '',
      material: '',
      dimensions: '',
    })),
    primaryProductId: 'p0',
    productDisplayGroups: [['p0', 'p1']],
  });
  it('persists groups without removing any product and permits explicit clearing', () => {
    const draft = validateDraft(input());
    expect((draft as any).productDisplayGroups).toEqual([['p0', 'p1']]);
    expect(draft.products).toHaveLength(3);
    expect(
      (editDraft(draft, { ...draft, productDisplayGroups: [] }) as any).productDisplayGroups,
    ).toEqual([]);
  });
  it.each([
    [['p0']],
    [['p0', 'p0']],
    [['p0', 'missing']],
    [
      ['p0', 'p1'],
      ['p1', 'p2'],
    ],
  ])('rejects invalid groups %j', (...groups) => {
    expect(() => validateDraft({ ...input(), productDisplayGroups: groups })).toThrow();
  });

  it('receiving a revision retains equivalence only with matching verified visual hashes', async () => {
    const input = await typedMaterialsFixture('juno-toys', 3),
      assets = Object.fromEntries(
        input.materials.media.map((a) => [a.id, { id: a.id, sha256: a.sha256 } as Asset]),
      );
    const previous = grouped(draftFromMaterials(input, assets)),
      oldAssets = Object.values(assets).map((a) => ({ ...a }));
    const receive = draftFromMaterials;
    expect(receive(input, assets).productDisplayGroups).toBeUndefined();
    expect(receive(input, assets, previous, oldAssets).productDisplayGroups).toEqual([
      ['p0', 'p1'],
    ]);
    expect(receive(input, assets, previous, []).productDisplayGroups).toBeUndefined();
    const changed = structuredClone(assets);
    changed[input.materials.products[0].primaryMediaId].sha256 = 'f'.repeat(64);
    expect(receive(input, changed, previous, oldAssets).productDisplayGroups).toBeUndefined();
    const generated = input.materials.imageBindings.find(
      (b) => b.productId === 'p0' && !['product-main', 'product-gallery'].includes(b.slotId),
    );
    expect(generated).toBeDefined();
    if (generated) {
      const regenerated = structuredClone(assets);
      regenerated[generated.mediaId].sha256 = 'f'.repeat(64);
      expect(receive(input, regenerated, previous, oldAssets).productDisplayGroups).toBeUndefined();
    }
    input.materials.products = input.materials.products.filter((p) => p.id !== 'p1');
    expect(receive(input, assets, previous, oldAssets).productDisplayGroups).toBeUndefined();
  });
});

it.each(Object.keys(templateMediaRequirements).filter(id => !id.startsWith('single-')))('%s restores confirmed About copy in old drafts without changing their contract', async template => {
  const revision = `2026-09-19.${template}-materials.1`;
  const draft = await fixture(template, 2, revision);
  Object.assign(draft.company, {description: '', targetMarkets: '', customerTypes: '', cooperationProcess: ''});
  const introduction = 'Confirmed brand introduction for retail buyers <script>alert(1)</script>';
  draft.materials!.textBindings.find(b => b.slotId === 'company-about')!.text = introduction;
  draft.copy.en!.about = 'Unbound draft introduction';
  const before = JSON.stringify(draft);
  const html = renderSite(draft, options('about'));
  const main = elements(parse(html)).find(n => n.tagName === 'main')!;
  expect(text(main)).toContain(introduction);
  expect(text(main)).not.toContain('Unbound draft introduction');
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(JSON.stringify(draft)).toBe(before);
});
it('uses the requested locale for legacy About copy and displays duplicate facts once', async () => {
  const draft = await fixture('senseng-arcade', 2, '2026-09-19.senseng-arcade-materials.1');
  draft.company.description = 'Nuestra colección para compradores';
  draft.materials!.textBindings.push({slotId: 'company-about', locale: 'es', text: draft.company.description, factReferences: ['f1']});
  const html = renderSite(draft, options('about', 'p0', 'es'));
  const main = elements(parse(html)).find(n => n.tagName === 'main')!;
  expect(text(main).split(draft.company.description)).toHaveLength(2);
  expect(text(main)).not.toContain('A confirmed brand');
});
