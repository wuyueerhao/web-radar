import { parseFragment, serializeOuter, type DefaultTreeAdapterMap } from 'parse5';
import type { Draft, Product } from '../shared/model';
import type { MaterialsTemplateContract } from '../shared/materials';
import { displayProducts } from '../shared/product-display';
import { materialImage } from './materials-render';
import { esc, productPath, type RenderOptions } from './themes/types';
import { labels } from './labels';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const attr = (n: Element, k: string) => n.attrs.find((a) => a.name === k)?.value || '';
const has = (n: Element, k: string) => n.attrs.some((a) => a.name === k);
const set = (n: Element, k: string, v: string) => {
  const a = n.attrs.find((a) => a.name === k);
  if (a) a.value = v;
  else n.attrs.push({ name: k, value: v });
};
const nodes = (n: Node): Element[] => [
  ...('tagName' in n ? [n] : []),
  ...('childNodes' in n ? n.childNodes.flatMap(nodes) : []),
];
const ancestors = (n: Node): Element[] => {
  const result: Element[] = [];
  let p = 'parentNode' in n ? n.parentNode : undefined;
  while (p) {
    if ('tagName' in p) result.push(p);
    p = 'parentNode' in p ? p.parentNode : undefined;
  }
  return result;
};
const text = (n: Node): string =>
  n.nodeName === '#text' && 'value' in n
    ? n.value
    : 'childNodes' in n && !['style', 'script'].includes(n.nodeName)
      ? n.childNodes.map(text).join(' ')
      : '';
const children = (n: Element, html: string) => {
  n.childNodes = parseFragment(html).childNodes;
  for (const c of n.childNodes) c.parentNode = n;
};
const remove = (n: Node) => {
  if ('parentNode' in n && n.parentNode)
    n.parentNode.childNodes = n.parentNode.childNodes.filter((c) => c !== n);
};
const replace = (n: Element, html: string) => {
  const p = n.parentNode;
  if (!p) return;
  const added = parseFragment(html).childNodes;
  for (const c of added) c.parentNode = p;
  p.childNodes.splice(p.childNodes.indexOf(n), 1, ...added);
};
const append = (n: Element, html: string) => {
  const added = parseFragment(html).childNodes;
  for (const c of added) c.parentNode = n;
  n.childNodes.push(...added);
};
const path = (o: RenderOptions, p: string) =>
  (o.page === 'home' ? '' : o.page === 'detail' ? '../../' : '../') + p;
const copy = (d: Draft, o: RenderOptions, id: string) =>
  d.materials!.textBindings.find((b) => b.slotId === id && b.locale === o.lang)?.text || '';

/** Capture old structural semantics before confirmed text replaces demo labels.
 * Never called while building the frozen materials inventory. */
export function markPresentationRegions(root: Node) {
  for (const n of nodes(root)) {
    if (
      has(n, 'data-counter') ||
      attr(n, 'class').split(/\s+/).includes('vertical-counter') ||
      (/^h[2-6]$/.test(n.tagName) &&
        n.childNodes.some((c) => 'tagName' in c && c.tagName === 'sup' && text(c).trim() === '%'))
    ) {
      const section = ancestors(n).find((p) => p.tagName === 'section');
      if (section) set(section, 'data-wr-old-metrics', '');
    }
    if (
      !['script', 'style'].includes(n.tagName) &&
      n.childNodes.some((c) => c.nodeName === '#text' && 'value' in c && /★{3,}/.test(c.value))
    ) {
      const section = ancestors(n).find((p) => p.tagName === 'section');
      if (section) set(section, 'data-wr-old-reviews', '');
    }
  }
}
function image(
  draft: Draft,
  options: RenderOptions,
  slot: MaterialsTemplateContract['imageSlots'][number],
  assetId: string,
  high = false,
) {
  const b = draft.materials!.imageBindings.find(
    (b) => b.slotId === slot.id && b.assetId === assetId,
  )!;
  const html = materialImage({ ...b, fit: 'contain' }, options),
    root = parseFragment(html),
    img = nodes(root).find((n) => n.tagName === 'img')!;
  set(img, 'data-wr-material-image', b.slotId);
  if (b.productId) set(img, 'data-wr-material-product', b.productId);
  if (!attr(img, 'srcset')) {
    set(img, 'width', String(slot.width));
    set(img, 'height', String(slot.height));
  }
  set(img, 'decoding', 'async');
  if (high) {
    set(img, 'loading', 'eager');
    set(img, 'fetchpriority', 'high');
  }
  return root.childNodes.map((n) => serializeOuter(n)).join('');
}
function shortName(product: Product, options: RenderOptions) {
  let name = product.translations?.[options.lang]?.name || product.name;
  if (product.dimensions)
    name = name
      .replace(product.dimensions, '')
      .replace(/\(\s*\)|\[\s*\]/g, '')
      .replace(/\s+[–—|-]\s*$/, '')
      .trim();
  const size = product.dimensions.match(/^(\d+(?:\.\d+)?)\s*(in(?:ch(?:es)?)?\.?|cm|mm)\b/i);
  if (size) {
    const unit = /^in/i.test(size[2]) ? '(?:inches|inch|in\\.?)' : size[2];
    name = name
      .replace(new RegExp(`\\b${size[1].replace('.', '\\.')}\\s*${unit}\\b[\\s:–—-]*`, 'i'), '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Keep identity words; visual clamping handles unusually long approved names.
  return name || product.name;
}
function cards(
  draft: Draft,
  options: RenderOptions,
  products: Product[],
  contract: MaterialsTemplateContract,
) {
  const slot = contract.imageSlots.find((s) => s.id === 'product-main')!;
  return products
    .map((p) => {
      const href = path(options, productPath(p.id)),
        binding = draft.materials!.imageBindings.find(
          (b) => b.slotId === 'product-main' && b.productId === p.id,
        );
      return `<article class="wr-confirmed-card" data-wr-product-card="" data-wr-product-id="${esc(p.id)}"><a class="wr-confirmed-card-photo" href="${esc(href)}" data-wr-page="detail" data-wr-product-id="${esc(p.id)}">${binding ? image(draft, options, slot, binding.assetId) : ''}</a><div class="wr-confirmed-card-copy"><h3><a href="${esc(href)}" data-wr-page="detail" data-wr-product-id="${esc(p.id)}" title="${esc(p.translations?.[options.lang]?.name || p.name)}">${esc(shortName(p, options))}</a></h3>${p.dimensions ? `<p class="wr-confirmed-spec">${esc(p.dimensions)}</p>` : ''}<a class="wr-confirmed-card-link" href="${esc(href)}" data-wr-page="detail" data-wr-product-id="${esc(p.id)}">${esc(labels[options.lang].details)} <span aria-hidden="true">↗</span></a></div></article>`;
    })
    .join('');
}
/** Preserve any declared non-collection regions that used to share a hero/facts panel. */
function retainedMedia(
  n: Element,
  draft: Draft,
  options: RenderOptions,
  contract: MaterialsTemplateContract,
  includeCollections = false,
) {
  const seen = new Set<string>();
  return nodes(n)
    .filter((el) => el.tagName === 'img' && has(el, 'data-wr-material-image'))
    .map((el) => {
      const id = attr(el, 'data-wr-material-image'),
        spec = contract.imageSlots.find((s) => s.id === id),
        src = attr(el, 'src'),
        identity = id + ':' + attr(el, 'data-wr-material-product');
      if (
        !spec ||
        !spec.role ||
        (!includeCollections && spec.role === 'collection') ||
        seen.has(identity)
      )
        return '';
      seen.add(identity);
      const binding = draft.materials!.imageBindings.find(
        (b) => b.slotId === id && options.assetUrl(b.assetId) === src,
      );
      if (!binding) return '';
      const product = draft.products.find((p) => p.id === binding.productId);
      return `<article class="wr-confirmed-media" data-wr-display-role="${esc(spec.role)}"${product ? ` data-wr-product-id="${esc(product.id)}"` : ''}>${product ? `<a href="${esc(path(options, productPath(product.id)))}" data-wr-page="detail" data-wr-product-id="${esc(product.id)}">` : ''}${image(draft, options, spec, binding.assetId)}${product ? `<h3>${esc(shortName(product, options))}</h3></a>` : ''}</article>`;
    })
    .join('');
}
function collectionHero(
  root: Node,
  draft: Draft,
  options: RenderOptions,
  contract: MaterialsTemplateContract,
) {
  if (options.page !== 'home') return;
  const specs = contract.imageSlots.filter((s) => s.id.startsWith('hero-slide-'));
  const targets = nodes(root).filter((n) =>
    specs.some((s) => s.id === attr(n, 'data-wr-material-image')),
  );
  if (!targets.length) return;
  const containers = [
    ...new Set(
      targets.map(
        (n) =>
          ancestors(n).find((p) =>
            /(?:^|\s)(?:wr-juno-hero|wr-crafto-hero|wr-consulting-hero|senseng-hero)(?:\s|$)/.test(
              attr(p, 'class'),
            ),
          ) || n,
      ),
    ),
  ];
  // Porto's frozen inventory assigned its collection slot to a later CTA.
  // Move that confirmed image into the actual first carousel, preserving its
  // declared scene media separately instead of leaving two competing heroes.
  if (draft.template === 'porto-accounting') {
    const heading = nodes(root).find((n) => n.tagName === 'h1');
    const first =
      heading &&
      ancestors(heading).find((n) => attr(n, 'class').split(/\s+/).includes('owl-carousel'));
    if (first) containers.unshift(first);
  }
  const selected = containers.filter((n) => !ancestors(n).some((p) => containers.includes(p)));
  const extra = selected.map((n) => retainedMedia(n, draft, options, contract)).join('');
  const slides = specs.flatMap((s) =>
    draft.materials!.imageBindings.filter((b) => b.slotId === s.id).map((b) => ({ s, b })),
  );
  const headline =
    copy(draft, options, 'hero-headline') ||
    draft.copy[options.lang]?.headline ||
    draft.company.name;
  const subtitle =
    copy(draft, options, 'hero-subtitle') || draft.copy[options.lang]?.subtitle || '';
  const html = `<section class="wr-confirmed-hero" data-wr-collection-hero=""><div class="wr-confirmed-collection-track" tabindex="0" aria-label="${esc(labels[options.lang].catalog)}">${slides.map(({ s, b }, i) => `<figure class="wr-confirmed-collection-slide" id="wr-collection-${i}" data-wr-collection-slide="${i}">${image(draft, options, s, b.assetId, i === 0)}</figure>`).join('')}</div>${slides.length > 1 ? `<nav class="wr-confirmed-collection-nav" aria-label="${esc(labels[options.lang].catalog)}">${slides.map((_, i) => `<a href="#wr-collection-${i}" aria-label="${esc(labels[options.lang].catalog)} ${i + 1}">${i + 1}</a>`).join('')}</nav>` : ''}<div class="wr-confirmed-hero-copy"><span class="eyebrow">${esc(draft.company.name)}</span><h1>${esc(headline)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}<a class="button" href="${esc(path(options, 'contact/index.html'))}" data-wr-page="contact">${esc(copy(draft, options, 'primary-cta') || draft.copy[options.lang]?.cta || labels[options.lang].contact)} ↗</a></div></section>${extra ? `<section class="wr-confirmed-retained wrap">${extra}</section>` : ''}`;
  replace(selected[0], html);
  for (const n of selected.slice(1)) remove(n);
  for (const n of nodes(root)) if (has(n, 'data-wr-prev') || has(n, 'data-wr-next')) remove(n);
  // Other collection banners also retain their full composition, with copy below.
}
function fullCollections(
  root: Node,
  draft: Draft,
  options: RenderOptions,
  contract: MaterialsTemplateContract,
) {
  for (const n of nodes(root)) {
    const spec = contract.imageSlots.find((s) => s.id === attr(n, 'data-wr-material-image'));
    if (spec?.role !== 'collection' || spec.id.startsWith('hero-slide-')) continue;
    if (n.tagName === 'img') {
      set(
        n,
        'style',
        attr(n, 'style') + ';object-fit:contain!important;--wr-material-fit:contain;',
      );
      if (!attr(n, 'srcset')) {
        set(n, 'width', String(spec.width));
        set(n, 'height', String(spec.height));
      }
      const panel = ancestors(n).find((p) => attr(p, 'class').includes('wr-collection-banner'));
      if (panel) set(panel, 'data-wr-full-collection', '');
      continue;
    }
    const b = draft.materials!.imageBindings.find((b) => b.slotId === spec.id)!;
    set(
      n,
      'style',
      attr(n, 'style').replace(/background(?:-image)?\s*:[^;]+;?/g, '') +
        ';height:auto!important;min-height:0!important;padding:0!important;',
    );
    const content = n.childNodes.map((n) => serializeOuter(n)).join('');
    children(
      n,
      `<div class="wr-confirmed-collection-media">${image(draft, options, spec, b.assetId)}</div><div class="wr-confirmed-banner-copy">${content}</div>`,
    );
    set(n, 'data-wr-full-collection', '');
    n.attrs = n.attrs.filter((a) => a.name !== 'data-wr-material-image');
  }
}
function productLists(
  root: Node,
  draft: Draft,
  options: RenderOptions,
  contract: MaterialsTemplateContract,
) {
  if (!['home', 'catalog'].includes(options.page)) return;
  const candidates = nodes(root)
    .filter((n) => n.tagName === 'img' && attr(n, 'data-wr-material-image') === 'product-main')
    .map((n) =>
      ancestors(n).find(
        (p) =>
          p.tagName === 'article' ||
          /(?:^|\s)(?:wr-[\w-]+-card|senseng-(?:p|catalog|showcase)-card|product-card)(?:\s|$)/.test(
            attr(p, 'class'),
          ),
      ),
    )
    .filter((n): n is Element => Boolean(n));
  const groups = new Map<Element, Element[]>();
  for (const card of new Set(candidates)) {
    const parent = card.parentNode;
    if (parent && 'tagName' in parent) {
      const group = groups.get(parent) || [];
      group.push(card);
      groups.set(parent, group);
    }
  }
  const grid = [...groups].sort((a, b) => b[1].length - a[1].length)[0];
  const products = displayProducts(draft).slice(0, options.page === 'home' ? 8 : undefined);
  const html = `<div class="wr-confirmed-product-grid" data-wr-product-list="${options.page}">${cards(draft, options, products, contract)}</div>`;
  if (grid) {
    replace(grid[0], html);
    for (const [parent, list] of groups)
      if (parent !== grid[0]) for (const card of list) remove(card);
  } else {
    const main =
      nodes(root).find((n) => n.tagName === 'main' || attr(n, 'role') === 'main') ||
      nodes(root).find((n) => attr(n, 'class').split(' ').includes('page_content_wrap')) ||
      nodes(root).find((n) => n.tagName === 'body')!;
    append(
      main,
      `<section class="wrap wr-confirmed-products"><h2>${esc(labels[options.lang].catalog)}</h2>${html}</section>`,
    );
  }
}
function companyFacts(draft: Draft, options: RenderOptions) {
  const c = draft.company,
    ui = labels[options.lang];
  const facts = [options.page === 'about' ? copy(draft, options, 'company-about').trim() : '', c.description, c.targetMarkets, c.customerTypes, c.cooperationProcess].filter(
    (v): v is string => Boolean(v?.trim()),
  );
  return `<section class="wr-confirmed-company wrap" data-wr-company-facts=""><span class="eyebrow">${esc(ui.about)}</span><h2>${esc(c.name)}</h2><p>${esc(ui[c.type])}</p>${[...new Set(facts)].map((value) => `<p>${esc(value)}</p>`).join('')}${c.contactName ? `<p>${esc(c.contactName)}</p>` : ''}${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}<p><a href="${esc(path(options, 'contact/index.html'))}" data-wr-page="contact">${esc(ui.contact)} ↗</a></p></section>`;
}
function factualPanels(
  root: Node,
  draft: Draft,
  options: RenderOptions,
  contract: MaterialsTemplateContract,
) {
  for (const n of nodes(root).filter((n) => has(n, 'data-wr-old-reviews'))) {
    // Approved product text remains a feature, never a purported endorsement.
    for (const el of nodes(n)) {
      if (
        el.childNodes.some((c) => c.nodeName === '#text' && 'value' in c && /★{3,}/.test(c.value))
      )
        remove(el);
    }
    set(n, 'data-wr-product-features', '');
  }
  const metrics = nodes(root).filter((n) => has(n, 'data-wr-old-metrics'));
  for (const n of metrics) {
    const extra = retainedMedia(n, draft, options, contract);
    replace(
      n,
      (options.page === 'home' && n === metrics[0] ? companyFacts(draft, options) : '') +
        (extra ? `<section class="wr-confirmed-retained wrap">${extra}</section>` : ''),
    );
  }
  if (options.page === 'about') {
    const main =
      nodes(root).find((n) => n.tagName === 'main' || attr(n, 'role') === 'main') ||
      nodes(root).find((n) => attr(n, 'class').split(' ').includes('wr-inner'));
    if (main) {
      const extra = retainedMedia(main, draft, options, contract, true),
        grid = nodes(main).find((n) => has(n, 'data-wr-typed-inner-grid'));
      const content =
        companyFacts(draft, options) +
        (extra ? `<section class="wr-confirmed-retained wrap">${extra}</section>` : '');
      children(
        main,
        grid
          ? `<div class="wrap" data-wr-typed-inner-grid="" style="display:grid;grid-template-columns:1fr 1fr;gap:32px">${content}</div>`
          : content,
      );
      set(main, 'style', 'padding:48px 0;');
    }
  } else if (options.page === 'home' && !nodes(root).some((n) => has(n, 'data-wr-company-facts'))) {
    const main = nodes(root).find((n) => n.tagName === 'main' || attr(n, 'role') === 'main');
    if (main) append(main, companyFacts(draft, options));
  }
}
function navigation(root: Node, draft: Draft, options: RenderOptions) {
  const ui = labels[options.lang],
    header = nodes(root).find((n) => n.tagName === 'header');
  for (const n of nodes(root)) {
    if (attr(n, 'class').split(/\s+/).includes('wr-mobile-nav')) remove(n);
    if (attr(n, 'class').split(/\s+/).includes('header-top-bar'))
      set(n, 'data-wr-desktop-extra', '');
    if (/(?:^|\s)(?:review-star-icon|fa-star|bi-star-fill)(?:\s|$)/.test(attr(n, 'class')))
      remove(n);
  }
  if (header) {
    set(header, 'data-wr-desktop-header', '');
    if (
      [
        'saas-automation',
        'fintech-platform',
        'digital-marketing',
        'crafto-corporate',
        'corpox-ai-agency',
        'corpox-consulting',
      ].includes(draft.template)
    ) {
      set(header, 'data-wr-flow-header', '');
      if (draft.template.startsWith('corpox-')) {
        const wrapper = ancestors(header).find((n) =>
          attr(n, 'class').split(/\s+/).includes('header-transparent-with-topbar'),
        );
        if (wrapper) set(wrapper, 'data-wr-flow-header', '');
      } else {
        const nav = header.childNodes.find((n): n is Element => 'tagName' in n);
        if (nav) set(nav, 'data-wr-flow-nav', '');
      }
    }
    const link = (page: string, label: string) =>
      `<a href="${esc(path(options, page === 'home' ? 'index.html' : `${page}/index.html`))}" data-wr-page="${page}">${esc(label)}</a>`;
    const links = ['home', 'catalog', 'about', 'contact']
      .map((page) => {
        const old = nodes(header).find(
          (n) =>
            n.tagName === 'a' &&
            attr(n, 'data-wr-page') === page &&
            ancestors(n).some((p) => p.tagName === 'nav'),
        );
        return link(page, old ? text(old).trim() : ui[page as 'home']);
      })
      .join('');
    const logo = draft.company.logoAssetId
      ? `<img src="${esc(options.assetUrl(draft.company.logoAssetId))}" alt="${esc(draft.company.name)}" loading="eager" fetchpriority="high">`
      : esc(draft.company.name);
    const languages = draft.languages
      .map((lang) => `<a data-wr-lang="${lang}" lang="${lang}" href="#">${lang.toUpperCase()}</a>`)
      .join('');
    const html = `<div class="wr-confirmed-mobile-header" data-wr-mobile-header=""><a class="wr-confirmed-brand" href="${esc(path(options, 'index.html'))}" data-wr-page="home">${logo}</a><a class="wr-confirmed-inquiry" href="${esc(path(options, 'contact/index.html'))}" data-wr-page="contact" data-wr-inquiry-cta="">${esc(ui.contact)} ↗</a><details data-wr-mobile-menu=""><summary aria-label="${esc(ui.menu)}"><span aria-hidden="true">☰</span></summary><nav aria-label="${esc(ui.menu)}">${links}<div class="wr-confirmed-languages">${languages}</div></nav></details></div>`;
    const added = parseFragment(html).childNodes;
    for (const n of added) n.parentNode = header.parentNode;
    header.parentNode!.childNodes.splice(
      header.parentNode!.childNodes.indexOf(header),
      0,
      ...added,
    );
    for (const n of nodes(header).filter((n) => n.tagName === 'img')) {
      set(n, 'loading', 'eager');
      set(n, 'fetchpriority', 'high');
    }
  }
  for (const n of nodes(root)) {
    if (n.tagName === 'select' && attr(n, 'name') === 'productId') {
      const selected =
        draft.productDisplayGroups?.find((g) => g.includes(options.productId || ''))?.[0] ||
        options.productId;
      children(
        n,
        `<option value="">—</option>${displayProducts(draft)
          .map(
            (p) =>
              `<option value="${esc(p.id)}"${p.id === selected ? ' selected' : ''}>${esc(shortName(p, options))}</option>`,
          )
          .join('')}`,
      );
    }
    if (n.tagName === 'a') {
      if (has(n, 'data-wr-lang')) {
        const lang = attr(n, 'data-wr-lang');
        const effectiveId = options.productId || draft.primaryProductId || draft.products[0]?.id;
        const target =
          options.page === 'detail'
            ? (effectiveId ? productPath(effectiveId) : 'products/index.html')
            : options.page === 'home'
              ? 'index.html'
              : `${options.page}/index.html`;
        set(n, 'href', path(options, `../${lang}/${target}`));
      }
      const label = text(n).trim(),
        cta = copy(draft, options, 'primary-cta') || draft.copy[options.lang]?.cta;
      if (
        label &&
        attr(n, 'data-wr-page') !== 'detail' &&
        ((cta && label.replace(/[↗→]/g, '').trim() === cta) ||
          /inquir|request|contact sales/i.test(label)) &&
        !/^mailto:|^tel:/.test(attr(n, 'href'))
      ) {
        set(n, 'href', path(options, 'contact/index.html'));
        set(n, 'data-wr-page', 'contact');
      }
      const productId = attr(n, 'data-wr-product-id');
      if (attr(n, 'data-wr-page') === 'contact' && draft.products.some((p) => p.id === productId)) {
        const canonical =
          draft.productDisplayGroups?.find((group) => group.includes(productId))?.[0] || productId;
        set(
          n,
          'href',
          path(options, `contact/index.html?productId=${encodeURIComponent(canonical)}`),
        );
      }
    }
    if (/(?:^|\s)wr-[\w-]+-ribbon(?:\s|$)/.test(attr(n, 'class')))
      set(n, 'data-wr-announcement', '');
  }
  for (const footer of nodes(root).filter((n) => n.tagName === 'footer')) {
    const catalog = nodes(footer).filter(
      (n) =>
        n.tagName === 'a' &&
        (attr(n, 'data-wr-page') === 'catalog' || /catalog\/index\.html$/.test(attr(n, 'href'))),
    );
    if (catalog.length) {
      children(catalog[0], esc(ui.catalog));
      set(catalog[0], 'href', path(options, 'catalog/index.html'));
      for (const link of catalog.slice(1))
        remove(
          link.parentNode && 'tagName' in link.parentNode && link.parentNode.tagName === 'li'
            ? link.parentNode
            : link,
        );
    }
  }
}
export function polishTypedMaterials(
  root: Node,
  draft: Draft,
  options: RenderOptions,
  contract: MaterialsTemplateContract,
  preserveAboutLayout = false,
) {
  // Single-product layouts already bind their one product and intentionally have
  // three different hero compositions. Do not replace them with a collection.
  if (!draft.template.startsWith('single-')) {
    collectionHero(root, draft, options, contract);
    fullCollections(root, draft, options, contract);
    productLists(root, draft, options, contract);
    if (!preserveAboutLayout) factualPanels(root, draft, options, contract);
  }
  navigation(root, draft, options);
  // Candy leaves this pill behind when the unsupported demo badge text is omitted.
  if (draft.template === 'senseng-candy' && options.page === 'detail') {
    for (const heading of nodes(root).filter(n => n.tagName === 'h1')) {
      const siblings = heading.parentNode?.childNodes.filter((n): n is Element => 'tagName' in n) || [];
      const badge = siblings[siblings.indexOf(heading) - 1];
      if (badge?.tagName === 'div' && !text(badge).trim() && !badge.childNodes.some(n => 'tagName' in n) &&
          attr(badge, 'style').includes('display:inline-flex') && attr(badge, 'style').includes('padding:4px 14px') && attr(badge, 'style').includes('border-radius:9999px')) remove(badge);
    }
  }
  let detailMain = false;
  const product = draft.products.find(
    (p) => p.id === (options.productId || draft.primaryProductId),
  );
  if (
    options.page === 'detail' &&
    product &&
    /^soft(?:\s+squishy)?\s+toy(?:s)?(?:[;\s]|$)/i.test(product.material)
  ) {
    for (const n of nodes(root).filter(
      (n) =>
        ['strong', 'span', 'dd', 'td'].includes(n.tagName) && text(n).trim() === product.material,
    )) {
      const row = ancestors(n).find((p) => p.tagName === 'tr') || n.parentNode;
      if (
        row &&
        'tagName' in row &&
        ['div', 'p', 'tr'].includes(row.tagName) &&
        row.childNodes.filter((c) => 'tagName' in c).length <= 2
      )
        remove(row);
      else remove(n);
    }
  }
  for (const n of nodes(root)) {
    if (has(n, 'data-reveal')) {
      set(n, 'class', attr(n, 'class') + ' wr-revealed');
      set(n, 'style', attr(n, 'style') + ';transition-delay:0s!important;');
    }
    if (
      n.tagName === 'img' &&
      options.page === 'detail' &&
      !detailMain &&
      attr(n, 'data-wr-material-image') === 'product-main' &&
      attr(n, 'data-wr-material-product') === (options.productId || draft.primaryProductId)
    ) {
      set(n, 'loading', 'eager');
      set(n, 'fetchpriority', 'high');
      detailMain = true;
    }
  }
  const head = nodes(root).find((n) => n.tagName === 'head')!;
  append(head, typedPresentationStyle);
}
export const typedPresentationStyle = `<style id="wr-typed-presentation">
.wr-materials-site{--wr-card-radius:20px}.wr-materials-site.senseng-minimal{--wr-card-radius:0px}.wr-materials-site .wr-confirmed-hero{position:relative;display:block;width:100%;height:auto;min-height:0;padding:0;background:var(--wr-background);overflow:hidden}
.wr-confirmed-collection-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;scrollbar-width:thin}.wr-confirmed-collection-slide{flex:0 0 100%;min-width:0;margin:0;scroll-snap-align:start}.wr-confirmed-collection-slide img{display:block;width:100%;height:auto!important;object-fit:contain!important;margin:0;border-radius:0;max-height:none}
.wr-confirmed-hero-copy{position:relative;max-width:1000px;margin:auto;padding:36px 24px 44px;text-align:center}.wr-confirmed-hero-copy h1{font-size:clamp(28px,3.5vw,50px);line-height:1.14;margin:12px 0 18px;color:var(--wr-ink)}.wr-confirmed-hero-copy p{max-width:760px;margin:0 auto 24px;line-height:1.6}.wr-confirmed-hero-copy .button{display:inline-block;padding:14px 24px;border-radius:var(--wr-card-radius);background:var(--wr-accent);color:#fff;white-space:normal}
.wr-confirmed-collection-nav{display:flex;justify-content:center;gap:12px;padding:12px}.wr-confirmed-collection-nav a{display:grid;place-items:center;min-width:36px;height:36px;border:1px solid currentColor;border-radius:50%;color:var(--wr-ink)}
.wr-confirmed-product-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px;width:100%;max-width:1280px;margin:0 auto}.wr-confirmed-products{padding:48px 0}.wr-materials-site .wr-confirmed-card{display:flex;flex-direction:column;min-width:0;overflow:hidden;border-radius:var(--wr-card-radius);border:1px solid color-mix(in srgb,var(--wr-muted) 18%,transparent);background:var(--wr-surface);box-shadow:0 5px 20px #00000005}.wr-confirmed-card-photo{display:block;aspect-ratio:1;padding:16px;background:var(--wr-background)}.wr-confirmed-card-photo img{display:block;width:100%;height:100%!important;object-fit:contain!important}.wr-confirmed-card-copy{display:flex;flex:1;flex-direction:column;padding:18px;gap:12px}.wr-materials-site .wr-confirmed-card h3{margin:0;font-size:18px;line-height:1.35;text-wrap:initial;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.wr-confirmed-card h3 a{color:var(--wr-ink)}.wr-confirmed-spec{margin:0!important;font-size:14px;line-height:1.4}.wr-confirmed-card-link{margin-top:auto;color:var(--wr-accent);font-size:14px;font-weight:700}
.wr-confirmed-company{padding:48px 24px;max-width:1000px;line-height:1.7}.wr-confirmed-company h2{font-size:clamp(26px,3vw,40px)}.wr-confirmed-retained{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;padding:32px 0}.wr-confirmed-media{min-width:0}.wr-confirmed-media img{width:100%;height:auto!important;object-fit:contain!important}.wr-confirmed-media h3{font-size:18px;line-height:1.4}.wr-materials-site [data-wr-full-collection] .wr-collection-copy{position:relative!important;inset:auto!important;transform:none!important;width:100%!important}.wr-materials-site [data-wr-full-collection] .wr-collection-media{aspect-ratio:auto}.wr-confirmed-banner-copy{position:relative!important;padding:28px!important}.wr-confirmed-collection-media img{width:100%;height:auto!important;object-fit:contain!important}
.wr-materials-site [data-reveal]{opacity:1!important;filter:none!important;transform:none!important;transition:opacity .15s!important;transition-delay:0s!important}.wr-confirmed-mobile-header{display:none}.wr-materials-site [data-wr-announcement]{white-space:nowrap;overflow:hidden;padding:8px 16px!important;line-height:20px;max-height:36px;box-sizing:border-box}.wr-materials-site [data-wr-announcement]>.wrap{display:block!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wr-materials-site [data-wr-announcement] span:not(:first-child){display:none}
@media(min-width:768px){.wr-materials-site [data-wr-flow-header],.wr-materials-site [data-wr-flow-nav]{position:relative!important;inset:auto!important;transform:none!important;translate:none!important;height:auto!important;margin:0 auto!important}.wr-materials-site [data-wr-flow-header]{background:var(--wr-surface)}.wr-materials-site [data-wr-flow-header] nav a,.wr-materials-site [data-wr-flow-header] .wr-reference-brand{color:var(--wr-ink)!important}}
@media(max-width:1023px){.wr-confirmed-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:767px){
.wr-materials-site [data-wr-desktop-header],.wr-materials-site [data-wr-desktop-extra]{display:none!important}.wr-materials-site .wr-confirmed-mobile-header{display:flex;position:relative;align-items:center;gap:12px;min-height:68px;padding:10px 16px;box-sizing:border-box;background:var(--wr-surface);color:var(--wr-ink);z-index:1001;border-bottom:1px solid color-mix(in srgb,var(--wr-muted) 15%,transparent)}.wr-confirmed-brand{flex:1;min-width:0;max-width:55%;font-weight:800;font-size:18px;line-height:1.15;color:var(--wr-accent);overflow-wrap:anywhere}.wr-confirmed-brand img{display:block;width:auto;max-width:100%;max-height:42px;object-fit:contain}.wr-confirmed-inquiry{white-space:nowrap;background:var(--wr-accent);color:#fff;border-radius:var(--wr-card-radius);padding:9px 12px;font-size:12px;font-weight:700}.wr-confirmed-mobile-header summary{display:grid;place-items:center;width:40px;height:40px;cursor:pointer;list-style:none;border:1px solid color-mix(in srgb,var(--wr-muted) 30%,transparent);border-radius:10px;font-size:23px}.wr-confirmed-mobile-header summary::-webkit-details-marker{display:none}.wr-confirmed-mobile-header details>nav{position:absolute;top:100%;left:0;right:0;display:grid;gap:6px;padding:16px;background:var(--wr-surface);box-shadow:0 12px 18px #0002}.wr-confirmed-mobile-header details>nav>a{padding:10px;color:var(--wr-ink);font-size:16px;line-height:1.4;overflow-wrap:anywhere}.wr-confirmed-languages{display:flex;flex-wrap:wrap;gap:12px;padding:12px 10px}.wr-confirmed-languages a{color:var(--wr-ink);font-size:14px}.wr-confirmed-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wr-confirmed-card-copy{padding:14px;gap:10px}.wr-materials-site .wr-confirmed-card h3{font-size:16px}.wr-confirmed-card-photo{padding:10px}.wr-confirmed-hero-copy{padding:24px 20px 32px}.wr-confirmed-hero-copy p{font-size:15px}.wr-materials-site main.wr-inner{padding-top:0!important}.wr-confirmed-company{padding:32px 20px}.wr-confirmed-retained{grid-template-columns:repeat(2,minmax(0,1fr))}
}
</style>`;
