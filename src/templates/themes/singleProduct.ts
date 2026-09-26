import type { Draft, Product } from '../../shared/model';
import { esc, productPath, type ThemeContext } from './types';

export const singleProductTemplates = [
  'single-device-showcase',
  'single-artisan-craft',
  'single-wellness-nordic',
] as const;
export const isSingleProductTemplate = (id: string) =>
  (singleProductTemplates as readonly string[]).includes(id);
export function singleProductDraft(draft: Draft): Draft {
  if (!isSingleProductTemplate(draft.template) || draft.products.length < 2) return draft;
  const product = draft.products.find((p) => p.id === draft.primaryProductId) ?? draft.products[0];
  return { ...draft, primaryProductId: product.id, products: [product] };
}
const mediaRoot = '/templates/single-product/';
const designs = {
  'single-device-showcase': {
    theme: 'hardware',
    brand: 'FORM / 01',
    name: 'The connected core.',
    eyebrow: 'HARDWARE, IN FOCUS',
    description:
      'A closer look at the circuitry behind the object. Explore its design, details and possibilities.',
    story: 'Considered from the inside out.',
    note: 'Inside the design',
    cta: 'Explore the device',
    image: 'hardware.jpg',
    section: 'Engineering, up close.',
  },
  'single-artisan-craft': {
    theme: 'artisan',
    brand: 'ATELIER / ONE',
    name: 'Time, beautifully considered.',
    eyebrow: 'AN OBJECT. A STORY.',
    description:
      'A quiet study in texture, proportion and the passage of time. One timepiece, seen in a different light.',
    story: 'The beauty is in the details.',
    note: 'A study in time',
    cta: 'Discover the piece',
    image: 'artisan.jpg',
    section: 'A closer appreciation.',
  },
  'single-wellness-nordic': {
    theme: 'nordic',
    brand: 'STILL / STUDIO',
    name: 'A little light.\nA slower day.',
    eyebrow: 'SPACE TO SLOW DOWN',
    description:
      'A simple light for the spaces you call your own. A companion to a morning page, a quiet corner and the everyday.',
    story: 'Make room for everyday rituals.',
    note: 'Light, at home',
    cta: 'Meet the object',
    image: 'nordic.jpg',
    section: 'At home in your day.',
  },
} as const;

/** One product owns every image, fact and inquiry. Demo imagery is used only without a product. */
export function renderSingleProductPage(ctx: ThemeContext, template: string): string {
  const design = designs[template as keyof typeof designs];
  const { draft, page, ui, lang, path, navAttrs, navLink, asset } = ctx;
  const product = ctx.mainProduct;
  const demo = !product;
  const translated = product ? ctx.translateProduct(product) : undefined;
  const name = translated?.name || design.name;
  const description = translated?.description || (demo ? design.description : '');
  const imageUrl = product ? asset(product.imageAssetId) : mediaRoot + design.image;
  const gallery =
    product?.gallery
      ?.map((item) => ({ url: asset(item.assetId), caption: item.caption || name }))
      .filter((item) => item.url && item.url !== imageUrl) ?? [];
  const copy = draft.copy[lang];
  const brand = draft.company.name || design.brand;
  const productHref = product ? path(productPath(product.id)) : path('catalog/index.html');
  const productAttrs = product ? navAttrs('detail', product.id) : navAttrs('catalog');
  const link = (text: string, secondary = false) =>
    `<a class="sp-button${secondary ? ' sp-secondary' : ''}" href="${esc(productHref)}" ${productAttrs}>${esc(text)} <span aria-hidden="true">↗</span></a>`;
  const contact = `<a class="sp-button" href="${path('contact/index.html')}" ${navAttrs('contact')}>${esc(ui.inquire)} <span aria-hidden="true">↗</span></a>`;
  const photo = (url: string, alt: string, cls = '', eager = false) =>
    url
      ? `<img class="${cls}" ${cls === 'wr-detail-main-img' ? 'id="wr-detail-main-img"' : ''} src="${esc(url)}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"'} decoding="async">`
      : `<div class="sp-no-photo">${esc(ui.product)}</div>`;
  const header = `<a class="skip" href="#main">${esc(ui.skip)}</a><header class="sp-header"><a class="sp-brand" href="${path('index.html')}" ${navAttrs('home')}>${draft.company.logoAssetId ? ctx.brandLogo : esc(brand)}</a><nav aria-label="${esc(ui.menu)}">${navLink('home', ui.home)}${navLink('catalog', ui.product)}${navLink('about', ui.about)}${navLink('contact', ui.contact)}</nav><div class="sp-languages">${ctx.languageLinks}</div></header>`;
  const headline = page === 'home' ? copy?.headline || name : name;
  const title = `<span class="sp-kicker">${esc(demo ? design.eyebrow : brand)}</span><h1>${esc(headline)}</h1>${description ? `<p class="sp-lead">${esc(description)}</p>` : ''}`;
  const overview = `<section class="sp-section sp-overview"><div class="sp-section-heading"><span class="sp-kicker">01 / ${esc(ui.product)}</span><h2>${esc(demo ? design.section : name)}</h2></div><div class="sp-split"><figure class="sp-product-photo">${photo(imageUrl, name)}<figcaption>${esc(name)}</figcaption></figure><div class="sp-copy"><span class="sp-kicker">${esc(demo ? design.note : ui.details)}</span><h3>${esc(product?.tagline || (demo ? design.story : name))}</h3>${description ? `<p>${esc(description)}</p>` : ''}${facts(product, ui)}${product?.sellingPoints?.length ? `<ul class="sp-points">${product.sellingPoints.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>` : ''}${link(demo ? design.cta : ui.details)}</div></div></section>`;
  const galleryHtml = gallery.length
    ? `<section class="sp-section"><div class="sp-section-heading"><span class="sp-kicker">02 / ${esc(ui.details)}</span><h2>${esc(name)}</h2></div><div class="sp-gallery">${gallery.map((item) => `<figure>${photo(item.url, item.caption)}<figcaption>${esc(item.caption)}</figcaption></figure>`).join('')}</div></section>`
    : '';
  const closing = `<section class="sp-closing"><span class="sp-kicker">${esc(brand)}</span><h2>${esc(demo ? 'Let’s talk about the details.' : name)}</h2><p>${esc(ui.contactIntro)}</p>${contact}</section>`;
  let content: string;
  if (page === 'home') {
    let hero: string;
    if (design.theme === 'hardware') {
      // Stock footage supplies atmosphere; the selected product remains the focal image.
      hero = `<section class="sp-hero sp-video-hero" data-wr-hero data-sp-hero="video"><div class="sp-video-scene"><img class="sp-poster" src="${mediaRoot}hardware.jpg" alt="" fetchpriority="high"><video data-sp-video data-src="${mediaRoot}hardware.mp4" poster="${mediaRoot}hardware.jpg" muted loop playsinline preload="none" aria-label="Circuit board background"></video></div><div class="sp-video-overlay"></div><div class="sp-video-copy">${title}<div class="sp-actions">${link(demo ? design.cta : ui.details)}<a class="sp-text-link" href="#product">${esc(ui.product)} ↓</a></div></div>${product && imageUrl && imageUrl !== mediaRoot + design.image ? `<figure class="sp-hero-product">${photo(imageUrl, name, '', true)}</figure>` : ''}<div class="sp-hero-bottom"><span>${esc(demo ? 'DESIGN FROM THE INSIDE OUT' : name)}</span><button type="button" data-sp-video-toggle hidden aria-label="Play background video">Play video</button></div></section>`;
    } else if (design.theme === 'artisan') {
      hero = `<section class="sp-hero sp-pure-image" data-wr-hero data-sp-hero="image">${photo(imageUrl, name, '', true)}</section><section class="sp-artisan-intro" data-sp-hero-copy><span class="sp-kicker">${esc(demo ? design.eyebrow : brand)}</span><div><h1>${esc(headline)}</h1>${description ? `<p class="sp-lead">${esc(description)}</p>` : ''}${link(demo ? design.cta : ui.details)}</div><span class="sp-edition" aria-hidden="true">01</span></section>`;
    } else {
      hero = `<section class="sp-hero sp-nordic-hero" data-wr-hero data-sp-hero="image-text"><div class="sp-nordic-copy">${title}${link(demo ? design.cta : ui.details)}<div class="sp-small-note">${esc(demo ? 'A considered object for your everyday space.' : product?.tagline || '')}</div></div><figure>${photo(imageUrl, name, '', true)}<figcaption>${esc(demo ? 'THE EVERYDAY, IN A NEW LIGHT' : name)}</figcaption></figure></section>`;
    }
    content = hero + `<div id="product">${overview}</div>` + galleryHtml + closing;
  } else if (page === 'catalog' || page === 'detail') {
    content = `<section class="sp-section sp-detail" data-wr-product-id="${esc(product?.id || '')}"><div class="sp-split"><figure class="sp-product-photo">${photo(imageUrl, name, 'wr-detail-main-img', true)}</figure><div class="sp-copy">${title}${facts(product, ui)}${product?.sellingPoints?.length ? `<ul class="sp-points">${product.sellingPoints.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>` : ''}${contact}</div></div></section>${galleryHtml}${product?.applications?.length ? `<section class="sp-section"><h2>${esc(ui.details)}</h2><ul class="sp-points">${product.applications.map((text) => `<li>${esc(text)}</li>`).join('')}</ul></section>` : ''}${closing}`;
  } else if (page === 'about') {
    const story = draft.company.aboutStory || copy?.about || draft.company.description;
    content = `<section class="sp-section sp-about"><span class="sp-kicker">${esc(ui.about)}</span><h1>${esc(draft.company.aboutHeadline || brand)}</h1><div class="sp-split"><figure class="sp-product-photo">${photo(imageUrl, name, '', true)}</figure><div class="sp-copy"><h2>${esc(demo ? design.story : name)}</h2>${
      story
        ? story
            .split(/\n+/)
            .map((text) => `<p>${esc(text)}</p>`)
            .join('')
        : ''
    }${draft.company.capabilities ? `<p>${esc(draft.company.capabilities)}</p>` : ''}${contact}</div></div></section>`;
  } else {
    content = `<section class="sp-section sp-contact"><div><span class="sp-kicker">${esc(brand)}</span><h1>${esc(ui.contact)}</h1><p class="sp-lead">${esc(ui.contactIntro)}</p>${draft.company.email ? `<a class="sp-text-link" href="mailto:${esc(draft.company.email)}">${esc(draft.company.email)}</a>` : ''}${draft.company.address ? `<p>${esc(draft.company.address)}</p>` : ''}</div><div class="sp-form">${ctx.inquiryFormHtml}</div></section>`;
  }
  return `<div class="sp-site sp-${design.theme}">${header}<main id="main">${content}</main><footer class="sp-footer"><a class="sp-brand" href="${path('index.html')}" ${navAttrs('home')}>${esc(brand)}</a><div>${ctx.socials}</div><small>© ${new Date().getUTCFullYear()} ${esc(brand)}</small></footer></div>`;
}
function facts(product: Product | undefined, ui: ThemeContext['ui']): string {
  const rows = [
    [ui.material, product?.material],
    [ui.dimensions, product?.dimensions],
  ].filter(([, value]) => value);
  return rows.length
    ? `<dl class="sp-facts">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`
    : '';
}

export const singleProductRuntime = `(()=>{const v=document.querySelector('[data-sp-video]'),b=document.querySelector('[data-sp-video-toggle]');if(!v||!b)return;const motion=matchMedia('(prefers-reduced-motion: reduce)');let requested=!motion.matches&&!navigator.connection?.saveData;const sync=()=>{b.textContent=v.paused?'Play video':'Pause video';b.setAttribute('aria-label',v.paused?'Play background video':'Pause background video');b.setAttribute('aria-pressed',String(!v.paused));};const play=()=>{if(!v.src)v.src=v.dataset.src;v.play().catch(sync);};b.hidden=false;b.onclick=()=>{requested=v.paused;if(requested)play();else v.pause();};v.addEventListener('play',sync);v.addEventListener('pause',sync);v.addEventListener('error',()=>{b.hidden=true;});motion.addEventListener('change',()=>{if(motion.matches){requested=false;v.pause();}});document.addEventListener('visibilitychange',()=>{if(document.hidden)v.pause();else if(requested)play();});sync();if(requested)play();})();`;
