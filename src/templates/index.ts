import { renderReleasedMaterials } from './materials-releases';
import { withBanner } from '../shared/banner';
import type { Draft, Language, Product } from '../shared/model';
import { withFavicon } from '../shared/favicon';
import { labels } from './labels';
import { styles } from './styles';
import { themeStyles } from './themes/styles';
import { buildThemeContext } from './themes/types';
import { renderSensengHome, renderSensengPage } from './themes/senseng';
import { isReferenceTemplate, renderReferencePage } from './themes/reference';
import { renderSaasHome } from './themes/saasAutomation';
import { renderFintechHome } from './themes/fintechPlatform';
import { renderMarketingHome } from './themes/digitalMarketing';
import { renderAccountingHome } from './themes/portoAccounting';
import { renderCraftoHome } from './themes/craftoCorporate';
import { renderToysHome } from './themes/junoToys';
import { renderAiAgencyHome } from './themes/corpoxAiAgency';
import { renderConsultingHome } from './themes/corpoxConsulting';
import { renderCandyHome, renderCandyPage } from './themes/sensengCandy';
import { renderWonderHome, renderWonderPage } from './themes/sensengWonder';
import { renderArcadeHome, renderArcadePage } from './themes/sensengArcade';
import { renderNatureHome, renderNaturePage } from './themes/sensengNature';
import { renderMinimalHome, renderMinimalPage } from './themes/sensengMinimal';
import { renderUniversalPage } from './themes/universalTrade';
import { renderToysFigureThemePage } from './themes/toysFigure';
import { renderPlushPage } from './themes/plushCushion';
import { renderApparelPage } from './themes/apparelTextile';
import { renderFootwearPage } from './themes/footwearShoes';
import { renderLuggageBagsTemplate } from './themes/luggageBags';
import { renderJewelryWatchesTemplate } from './themes/jewelryWatches';
import { renderHomeDecorTemplate } from './themes/homeDecor';
import { renderFurnitureStorageTemplate } from './themes/furnitureStorage';
import { renderKitchenwareTablewareTemplate } from './themes/kitchenwareTableware';
import { renderDrinkwarePage } from './themes/drinkwareCeramic';
import { renderBeautyPage } from './themes/beautyPersonalCare';
import { renderElectronicsPage } from './themes/electronicsGadget';
import { renderToolsPage } from './themes/toolsEquipment';
import { renderSportsPage } from './themes/sportsOutdoor';
import { renderPetSuppliesPage } from './themes/petSupplies';
import { renderStationeryPage } from './themes/stationeryOffice';
import { renderPosterPage } from './themes/posterPrints';
import { renderFoodPage } from './themes/foodPackaging';
import { renderSingleProductPage, singleProductDraft, isSingleProductTemplate, singleProductRuntime } from './themes/singleProduct';
import { singleProductStyles } from './themes/singleProductStyles';
import { materialProductImage,materialsSensengBody,materialsSeo,materialsThemeStyle } from './materials-render';
import { materialsRuntime } from '../shared/materials-runtime';
import { withProductImageViewer } from '../shared/product-image-viewer';
import { isTypedMaterials, isTypedMaterialsSource,isModernAboutSource, renderTypedMaterialsSite } from './materials-typed';
import { parseAboutHighlights, getAboutStoryParagraphs, getAboutHeadline } from './themes/aboutHelper';
export { labels };
export interface RenderOptions {
  projectId: string;
  lang: Language;
  page: string;
  productId?: string;
  assetUrl: (id: string) => string;
  imageVariants?: (id: string, widths: number[], includeOriginal?: boolean) => {url: string; width: number; height: number}[] | undefined;
  inquiryUrl: string;
  preview?: boolean;
  /** Canonical WR URL already supplied by renderSiteFiles during publication. */
  publicBaseUrl?: string;
}
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const json = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
function safeUrl(value: string, blob = false): string {
  try {
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
    const u = new URL(value);
    if (u.username || u.password) return '';
    if (
      u.protocol === 'https:' ||
      (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) ||
      (blob && u.protocol === 'blob:')
    )
      return u.href;
  } catch {}
  return '';
}
function segment(id: string): string {
  if (id === '.' || id === '..' || !id) return 'item';
  return encodeURIComponent(id).replace(/\./g, '%2E');
}
const productPath = (id?: string) => `products/${segment(id || '')}/index.html`;
export function renderSite(draft: Draft, options: RenderOptions): string {
  if (!isTypedMaterialsSource(draft)) draft = singleProductDraft(draft);
  if (isSingleProductTemplate(draft.template) && draft.products.length) options = { ...options, productId: (draft.products.find(p => p.id === draft.primaryProductId) ?? draft.products[0]).id };
  const released = renderReleasedMaterials(draft, options);
  if (released !== undefined) return released;
  const html = renderSiteContent(draft, options);
  if (options.page !== 'detail' || html.includes('id="wr-product-image-viewer-script"')) return html;
  return withProductImageViewer(html);
}
function renderSiteContent(draft: Draft, options: RenderOptions): string {
  const effectiveProductId = options.productId || draft.primaryProductId || draft.products[0]?.id;
  if(isTypedMaterials(draft))return withBanner(renderTypedMaterialsSite(draft,options),draft,options.assetUrl,{page:options.page,productId:effectiveProductId});
  const rendered=withBanner(withFavicon(renderSiteHtml(draft, options), draft, options.assetUrl), draft, options.assetUrl, {page: options.page, productId: effectiveProductId});
  // Several standalone headers build their own language links and used catalog
  // depth on product pages. Normalize those links at the common output boundary.
  const depth=options.page==='home'?'':options.page==='detail'?'../../':'../';
  const target=options.page==='detail'?(effectiveProductId?productPath(effectiveProductId):'catalog/index.html'):options.page==='home'?'index.html':`${options.page}/index.html`;
  const html=rendered.replace(/<a\b[^>]*\bdata-wr-lang="([a-z]{2})"[^>]*>/g,(tag,lang:string)=>draft.languages.includes(lang as Language)?tag.replace(/\bhref="[^"]*"/,`href="${esc(`${depth}../${lang}/${target}`)}"`):tag);
  // Wrangler's keepNames inserts __name calls inside stringified functions.
  // Keep the approved branch self-contained when it runs outside the Worker.
  return draft.materials?html.replace('<script>', '<script>var __name=(value)=>value;').replace('</body>',`<script>(()=>{const __name=(value)=>value;(${materialsRuntime.toString()})();})();</script></body>`):html;
}
function renderSiteHtml(draft: Draft, options: RenderOptions): string {
  const lang = draft.languages.includes(options.lang) ? options.lang : 'en';
  const ui = labels[lang];
  const template = draft.template || 'senseng-clean';
  const page = ['home', 'catalog', 'detail', 'about', 'contact'].includes(options.page)
    ? options.page
    : 'home';
  const company = draft.company;
  const copy = draft.copy[lang] ?? {
    headline: company.slogan || company.name,
    subtitle: company.description || '',
    about: lang === 'en' ? company.description : '',
    cta: ui.discover,
  };
  const depth = page === 'home' ? '' : page === 'detail' ? '../../' : '../';
  const path = (p: string) => `${depth}${p}`;
  const navPath = (p: string) => (p === 'home' ? 'index.html' : `${p}/index.html`);
  const color = /^#[0-9a-f]{6}$/i.test(draft.brandColor) ? draft.brandColor : '#52684b';
  const asset = (id?: string) => (id ? safeUrl(options.assetUrl(id), options.preview) : '');
  const translate = (p: Product) => ({
    name: p.translations?.[lang]?.name ?? p.name,
    description: p.translations?.[lang]?.description ?? (lang === 'en' ? p.description : ''),
  });
  const mainProduct =
    draft.products.find((p) => p.id === draft.primaryProductId) ?? draft.products[0];
  const defaultProductImg =
    asset(mainProduct?.imageAssetId) ||
    asset(draft.products.find((p) => p.imageAssetId)?.imageAssetId);
  const img = (p: Product) => {
    const url = asset(p.imageAssetId) || defaultProductImg;
    const prepared=materialProductImage(draft,options,p);
    if(prepared)return `<div class="product-image">${prepared}</div>`;
    return `<div class="product-image">${url ? `<img src="${esc(url)}" alt="${esc(translate(p).name)}" loading="lazy" decoding="async">` : `<span class="empty-image">${esc(ui.unavailable)}</span>`}</div>`;
  };
  const gallery = (p: Product) => {
    const images = (p.gallery ?? []).filter(image=>image.assetId !== p.imageAssetId && asset(image.assetId));
    if(draft.materials)return images.length?`<div class="product-gallery" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px">${images.map(image=>materialProductImage(draft,options,p,image.assetId)||'').join('')}</div>`:'';
    return images.length ? `<div class="product-gallery" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px">${images.map(image=>`<img src="${esc(asset(image.assetId))}" alt="${esc(image.caption || translate(p).name)}" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:contain">`).join('')}</div>` : '';
  };
  const websiteDetails = (p: Product) => lang === 'en' ? `${p.tagline ? `<p>${esc(p.tagline)}</p>` : ''}${[p.sellingPoints,p.applications].map(values=>values?.length ? `<ul>${values.map(value=>`<li>${esc(value)}</li>`).join('')}</ul>` : '').join('')}` : '';
  const navAttrs = (p: string, id?: string) =>
    `data-wr-page="${p}"${id ? ` data-wr-product-id="${esc(id)}"` : ''}`;
  const navLink = (p: string, label: string) =>
    `<a href="${path(navPath(p))}" ${navAttrs(p)}${p === page ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  const cards = (products: Product[]) =>
    products.length
      ? `<div class="grid">${products.map((p, i) => `<article class="product-card wr-card-hover" data-reveal="fade-up"><p class="product-number">${String(i + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}</p><a href="${path(productPath(p.id))}" ${navAttrs('detail', p.id)}>${img(p)}<h3>${esc(translate(p).name)}</h3></a>${translate(p).description ? `<p>${esc(translate(p).description)}</p>` : ''}<a class="text-link" href="${path(productPath(p.id))}" ${navAttrs('detail', p.id)}>${esc(ui.details)} <span aria-hidden="true">↗</span></a></article>`).join('')}</div>`
      : `<p class="muted">${esc(ui.noProducts)}</p>`;
  const channels = [1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const brandInk =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179
      ? '#17261c'
      : '#ffffff';
  const poster = asset(draft.posterAssetId) || asset(mainProduct?.imageAssetId);
  const video = asset(draft.heroAssetId);
  const hero = `<section class="hero" aria-label="${esc(copy.headline)}">${poster ? `<img class="poster" src="${esc(poster)}" alt="">` : ''}${video ? `<video id="hero-video" autoplay muted loop playsinline preload="metadata"${poster ? ` poster="${esc(poster)}"` : ''} aria-hidden="true"><source src="${esc(video)}"></video>` : ''}<div class="wrap hero-content" data-reveal="fade-up"><span class="eyebrow">${esc(company.name)}</span><${page === 'home' ? 'h1' : 'h2'} class="hero-title">${esc(copy.headline)}</${page === 'home' ? 'h1' : 'h2'}>${copy.subtitle ? `<p>${esc(copy.subtitle)}</p>` : ''}<a class="button" href="${path('catalog/index.html')}" ${navAttrs('catalog')}>${esc(copy.cta || ui.discover)} <span aria-hidden="true">↗</span></a></div>${video ? `<div class="hero-controls"><button type="button" id="video-toggle" class="video-control" aria-label="${esc(ui.pause)}">Ⅱ</button></div>` : ''}</section>`;
  const contactBand = `<section class="contact-band" data-reveal="fade-up"><div class="wrap"><div><span class="eyebrow">${esc(ui.contact)}</span><h2>${esc(ui.conversation)}</h2></div><a class="button" href="${path('contact/index.html')}" ${navAttrs('contact')}>${esc(ui.contact)} <span aria-hidden="true">↗</span></a></div></section>`;
  const aboutText = copy.about || '';
  const story = `<section class="story wrap" data-reveal="fade-up">${mainProduct ? `<div class="story-visual wr-hero-float">${asset(mainProduct.imageAssetId) ? `<img src="${esc(asset(mainProduct.imageAssetId))}" alt="${esc(translate(mainProduct).name)}" loading="lazy">` : ''}</div>` : ''}<div><span class="eyebrow">${esc(ui.about)}</span><h2>${esc(company.name)}</h2>${aboutText ? `<p>${esc(aboutText)}</p>` : ''}<a class="text-link" href="${path('about/index.html')}" ${navAttrs('about')}>${esc(ui.about)} ↗</a></div></section>`;
  let content = '';
  if (page === 'home') {
    const ctx = buildThemeContext(draft, options);
    switch (template) {
      case 'senseng-clean':
        content = renderSensengHome(ctx, false);
        break;
      case 'senseng-video':
        content = renderSensengHome(ctx, true);
        break;
      case 'saas-automation':
        content = renderSaasHome(ctx);
        break;
      case 'fintech-platform':
        content = renderFintechHome(ctx);
        break;
      case 'digital-marketing':
        content = renderMarketingHome(ctx);
        break;
      case 'porto-accounting':
        content = renderAccountingHome(ctx);
        break;
      case 'crafto-corporate':
        content = renderCraftoHome(ctx);
        break;
      case 'juno-toys':
        content = renderToysHome(ctx);
        break;
      case 'corpox-ai-agency':
        content = renderAiAgencyHome(ctx);
        break;
      case 'corpox-consulting':
        content = renderConsultingHome(ctx);
        break;
      case 'senseng-candy':
        content = renderCandyHome(ctx);
        break;
      case 'senseng-wonder':
        content = renderWonderHome(ctx);
        break;
      case 'senseng-arcade':
        content = renderArcadeHome(ctx);
        break;
      case 'senseng-nature':
        content = renderNatureHome(ctx);
        break;
      case 'senseng-minimal':
        content = renderMinimalHome(ctx);
        break;
      default:
        content = `${hero}<section class="chapter wrap"><div class="section-top"><div><span class="eyebrow">${esc(ui.products)}</span><h2>${esc(ui.catalog)}</h2></div><a class="text-link" href="catalog/index.html" ${navAttrs('catalog')}>${esc(ui.allProducts)} ↗</a></div>${cards(draft.products.slice(0, template === 'explorer' ? 4 : 3))}</section>${story}${contactBand}`;
        break;
    }
  }
  if (page === 'catalog')
    content = `<div class="wrap"><header class="page-heading"><span class="eyebrow">${esc(company.name)}</span><h1>${esc(ui.catalog)}</h1></header><section class="chapter" style="padding-top:0">${cards(draft.products)}</section></div>${contactBand}`;
  if (page === 'about') {
    const headline = getAboutHeadline(company, company.name);
    const storyParas = getAboutStoryParagraphs(company, copy.about);
    const aboutImg = asset(company.aboutImageAssetId) || poster || defaultProductImg;
    const secondaryImg = asset(company.aboutSecondaryImageAssetId);
    const stats = parseAboutHighlights(company.aboutHighlights, [
      { value: company.establishedYear ? `${company.establishedYear}` : '10+ Yrs', num: company.establishedYear ? parseInt(company.establishedYear, 10) || 10 : 10, suffix: company.establishedYear ? '' : ' Yrs', label: 'Industry Experience', desc: 'Proven export reliability & track record' },
      { value: '99.8%', num: 99.8, suffix: '%', label: 'Delivery On-Time Rate', desc: 'Strict milestone & quality assurance' },
      { value: '50+', num: 50, suffix: '+', label: 'Export Markets', desc: 'Worldwide partner network across continents' },
      { value: '100%', num: 100, suffix: '%', label: 'Quality Compliance', desc: 'Rigorous manufacturing standards' },
    ]);

    const statsHtml = `
      <div class="about-stats wrap" data-reveal="fade-up">
        ${stats.map((s) => `
          <div class="about-stat-card wr-card-hover" data-reveal="fade-up">
            <div class="about-stat-val" data-counter="${s.num}" data-suffix="${esc(s.suffix || '')}" data-prefix="${esc(s.prefix || '')}">${esc(s.value)}</div>
            <div class="about-stat-label">${esc(s.label)}</div>
            ${s.desc ? `<div class="about-stat-desc">${esc(s.desc)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    const secondaryHtml = secondaryImg ? `
      <section class="about-secondary-grid wrap" data-reveal="fade-up">
        <div class="about-media-box wr-card-hover">
          <img src="${esc(secondaryImg)}" alt="${esc(company.name)} facility" loading="lazy">
        </div>
        <div>
          <span class="eyebrow">${esc(ui.about)} · CAPABILITIES</span>
          <h2 style="font-size:clamp(1.8rem,3vw,2.4rem);margin:12px 0 16px;">Precision Manufacturing & Scalable Delivery</h2>
          <p style="font-size:1.05rem;line-height:1.75;opacity:0.85;">${esc(company.capabilities || 'State-of-the-art facility equipped for high-throughput precision, strict batch testing, and streamlined global fulfillment.')}</p>
          ${company.certifications ? `
            <div style="margin-top:20px;padding:16px;background:var(--paper);border-radius:0 8px 8px 0;border:1px solid var(--line);border-left:4px solid var(--brand);">
              <strong style="display:block;font-size:0.85rem;text-transform:uppercase;color:var(--brand);margin-bottom:4px;">Verified Certifications</strong>
              <span style="font-size:0.92rem;font-weight:600;">${esc(company.certifications)}</span>
            </div>
          ` : ''}
        </div>
      </section>
    ` : '';

    content = `
      <div class="wrap">
        <header class="page-heading" data-reveal="fade-up">
          <span class="eyebrow">${esc(ui.about)} · ${esc(company.type === 'factory' ? ui.factory : ui.trader)}${company.establishedYear ? ` · EST. ${esc(company.establishedYear)}` : ''}</span>
          <h1>${esc(headline)}</h1>
          ${copy.subtitle ? `<p>${esc(copy.subtitle)}</p>` : ''}
        </header>
        <section class="about-split" data-reveal="fade-up">
          <div>
            <span class="eyebrow" style="color:var(--brand);">${esc(company.name)}</span>
            <h2 style="margin:12px 0 20px;">${esc(company.slogan || 'Dedicated to Quality, Reliability & Partnership')}</h2>
            <div style="display:flex;flex-direction:column;gap:16px;font-size:1.05rem;line-height:1.8;opacity:.9;">
              ${storyParas.length > 0 ? storyParas.map((p) => `<p>${esc(p)}</p>`).join('') : `<p>${esc(aboutText || company.description)}</p>`}
            </div>
            ${company.capabilities ? `
              <div style="margin-top:24px;padding:18px 22px;background:var(--soft);border-radius:8px;border:1px solid var(--line);">
                <div style="font-size:0.8rem;font-weight:700;letter-spacing:0.08em;color:var(--brand);text-transform:uppercase;">Core Competence & Capability</div>
                <div style="margin-top:6px;font-size:0.95rem;font-weight:550;">${esc(company.capabilities)}</div>
              </div>
            ` : ''}
            <div style="margin-top:28px;">
              <a class="button" href="${path('contact/index.html')}" ${navAttrs('contact')}>
                ${esc(ui.inquire)} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <div class="about-media-box wr-card-hover" data-reveal="fade-up">
            <img src="${esc(aboutImg)}" alt="${esc(company.name)}" loading="lazy">
            <div class="about-badge-floating">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--brand);"></span>
              <span>${esc(company.type === 'factory' ? 'Direct Factory Exporter' : 'Established Trading Partner')}</span>
            </div>
          </div>
        </section>
      </div>
      ${statsHtml}
      ${secondaryHtml}
      ${contactBand}
    `;
  }
  if (page === 'detail') {
    const p = draft.products.find((item) => item.id === options.productId);
    content = p
      ? `<section class="detail wrap"><div>${img(p)}${gallery(p)}</div><div><a class="text-link" href="${path('catalog/index.html')}" ${navAttrs('catalog')}>← ${esc(ui.back)}</a><h1>${esc(translate(p).name)}</h1>${websiteDetails(p)}${translate(p).description ? `<p>${esc(translate(p).description)}</p>` : ''}<dl class="specs">${p.material ? `<div><dt>${esc(ui.material)}</dt><dd>${esc(p.material)}</dd></div>` : ''}${p.dimensions ? `<div><dt>${esc(ui.dimensions)}</dt><dd>${esc(p.dimensions)}</dd></div>` : ''}</dl><a class="button" href="${path('contact/index.html')}?productId=${esc(encodeURIComponent(p.id))}" ${navAttrs('contact', p.id)}>${esc(ui.inquire)} ↗</a></div></section><section class="chapter wrap"><div class="section-top"><h2>${esc(ui.related)}</h2></div>${cards(draft.products.filter((item) => item.id !== p.id).slice(0, 3))}</section>`
      : `<section class="chapter wrap"><h1>${esc(ui.noProducts)}</h1></section>`;
  }
  if (page === 'contact') {
    const waDigits = (company.whatsapp || '').replace(/[^0-9]/g, '');
    content = `<div class="wrap"><header class="page-heading"><span class="eyebrow">${esc(ui.contact)}</span><h1>${esc(ui.conversation)}</h1><p>${esc(ui.contactIntro)}</p></header><section class="contact-layout"><div class="contact-details">${company.contactName ? `<h3>${esc(company.contactName)}</h3>` : ''}<p><strong>${esc(company.name)}</strong></p><p>${esc(ui.emailDirect)}<br><a class="text-link" href="mailto:${esc(company.email)}">${esc(company.email)}</a></p>${company.phone ? `<p style="margin-top:12px">Phone<br><a class="text-link" href="tel:${esc(company.phone)}">${esc(company.phone)}</a></p>` : ''}${waDigits ? `<p style="margin-top:12px">WhatsApp<br><a class="text-link" target="_blank" rel="noopener noreferrer" href="https://wa.me/${esc(waDigits)}">+${esc(waDigits)} (Chat Now ↗)</a></p>` : ''}${company.address ? `<p style="margin-top:12px">Address<br><span>${esc(company.address)}</span></p>` : ''}</div><form id="inquiry" action="${esc(safeUrl(options.inquiryUrl))}" method="post" class="form-grid"><label class="field">${esc(ui.name)}<input name="name" autocomplete="name" required maxlength="120"></label><label class="field">${esc(ui.email)}<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label class="field full">${esc(ui.company)} (${esc(ui.optional)})<input name="company" autocomplete="organization" maxlength="200"></label><label class="field full">${esc(ui.product)} (${esc(ui.optional)})<select name="productId"><option value="">—</option>${draft.products.map((p) => `<option value="${esc(p.id)}"${p.id === options.productId ? ' selected' : ''}>${esc(translate(p).name)}</option>`).join('')}</select></label><label class="field full">${esc(ui.message)}<textarea name="message" required maxlength="5000" rows="5"></textarea></label><div class="honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><button class="button" type="submit"${options.preview ? ' disabled' : ''}>${esc(ui.send)} ↗</button><p class="form-status" role="status" aria-live="polite"></p></form></section></div>`;
  }
  const socials = (['linkedin', 'facebook', 'instagram', 'x'] as const)
    .map((k) => {
      const url = safeUrl(company[k] || '');
      return url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${k === 'linkedin' ? 'LinkedIn' : k === 'x' ? 'X' : k === 'facebook' ? 'Facebook' : 'Instagram'}</a>`
        : '';
    })
    .join('');
  const languageLinks = draft.languages
    .map((l) => {
      const effectiveId = options.productId || draft.primaryProductId || draft.products[0]?.id;
      const target =
        page === 'detail' && effectiveId ? productPath(effectiveId) : navPath(page);
      return `<a href="${depth}../${l}/${target}" lang="${l}" data-wr-lang="${l}" aria-current="${l === lang}">${l.toUpperCase()}</a>`;
    })
    .join('');
  const logo = asset(company.logoAssetId);
  const brand = logo ? `<img src="${esc(logo)}" alt="${esc(company.name)}">` : esc(company.name);
  const script = `(()=>{const motion=matchMedia('(prefers-reduced-motion: reduce)'),v=document.getElementById('hero-video'),toggle=document.getElementById('video-toggle');const labels=${json({ pause: ui.pause, play: ui.play, sending: ui.sending, sent: ui.sent, failed: ui.failed, send: ui.send })};function update(){document.body.classList.toggle('reduced-motion',motion.matches);if(v){v.muted=true;if(motion.matches)v.pause();else v.play().catch(()=>{});}if(toggle){toggle.textContent=v&&v.paused?'▶':'Ⅱ';toggle.setAttribute('aria-label',v&&v.paused?labels.play:labels.pause);}}motion.addEventListener('change',update);update();toggle?.addEventListener('click',()=>{if(!v)return;if(v.paused){document.body.classList.remove('reduced-motion');v.play().catch(()=>{});}else v.pause();toggle.textContent=v.paused?'▶':'Ⅱ';toggle.setAttribute('aria-label',v.paused?labels.play:labels.pause);});if('IntersectionObserver' in window&&!motion.matches){document.body.classList.add('wr-motion-ready');const ro=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('wr-revealed');ro.unobserve(e.target);}});},{threshold:0.10});document.querySelectorAll('[data-reveal]').forEach((el,idx)=>{const rect=el.getBoundingClientRect();if(rect.top<window.innerHeight&&rect.bottom>0){el.classList.add('wr-revealed');}else{if(!el.style.transitionDelay){const delay=(idx%8)*0.06;el.style.transitionDelay=delay+'s';}ro.observe(el);}});const bo=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){const val=e.target.getAttribute('data-progress');if(val)e.target.style.width=val+'%';bo.unobserve(e.target);}});},{threshold:0.15});document.querySelectorAll('.wr-progress-bar[data-progress]').forEach(el=>bo.observe(el));const co=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){const target=parseFloat(e.target.getAttribute('data-counter')||'0');const suffix=e.target.getAttribute('data-suffix')||'';const raw=e.target.getAttribute('data-counter')||'';const dec=raw.includes('.')?raw.split('.')[1].length:0;const duration=1400;const start=performance.now();function tick(now){const p=Math.min((now-start)/duration,1);const ease=p===1?1:1-Math.pow(2,-10*p);const cur=dec>0?(ease*target).toFixed(dec):Math.floor(ease*target).toLocaleString();e.target.textContent=cur+suffix;if(p<1)requestAnimationFrame(tick);else e.target.textContent=(dec>0?target.toFixed(dec):target.toLocaleString())+suffix;}requestAnimationFrame(tick);co.unobserve(e.target);}});},{threshold:0.15});document.querySelectorAll('[data-counter]').forEach(el=>co.observe(el));const cards=document.querySelectorAll('.senseng-p-card,.wr-candy-card,.wr-wonder-card,.wr-arcade-card,.wr-nature-card,.wr-minimal-card,.wr-card-hover,.product-card,.wr-product-card');cards.forEach(card=>{card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-0.5;const y=(e.clientY-r.top)/r.height-0.5;card.style.transform='perspective(1000px) rotateX('+(-y*6).toFixed(2)+'deg) rotateY('+(x*6).toFixed(2)+'deg) translateY(-8px) scale3d(1.015,1.015,1.015)';});card.addEventListener('mouseleave',()=>{card.style.transform='';});});}else{document.querySelectorAll('[data-reveal]').forEach(el=>el.classList.add('wr-revealed'));document.querySelectorAll('.wr-progress-bar[data-progress]').forEach(el=>{el.style.width=el.getAttribute('data-progress')+'%';});}document.querySelectorAll('.wr-scroll-down').forEach(btn=>{btn.addEventListener('click',e=>{e.preventDefault();const next=btn.closest('section')?.nextElementSibling||document.querySelector('main>section:nth-of-type(2),#main>section:nth-of-type(2),.chapter');if(next)next.scrollIntoView({behavior:'smooth'});});});document.querySelectorAll('.wr-carousel').forEach(c=>{const slides=c.querySelectorAll('.wr-carousel-slide'),dots=c.querySelectorAll('.wr-carousel-dot');if(slides.length<=1)return;let cur=0,t;function to(n){slides.forEach((s,i)=>{s.classList.toggle('active',i===n);if(s.parentElement?.classList.contains('wr-carousel-track'))s.parentElement.style.transform='translateX(-'+(n*100)+'%)';});dots.forEach((d,i)=>d.classList.toggle('active',i===n));cur=n;}function next(){to((cur+1)%slides.length);}function play(){stop();t=setInterval(next,4200);}function stop(){if(t)clearInterval(t);}dots.forEach((d,i)=>d.addEventListener('click',()=>{to(i);play();}));c.addEventListener('mouseenter',stop);c.addEventListener('mouseleave',play);play();});document.querySelectorAll('.wr-detail-thumb,.senseng-thumb-btn').forEach(t=>{t.addEventListener('click',()=>{const src=t.getAttribute('data-large')||t.getAttribute('data-src')||t.querySelector('img')?.src;const main=document.getElementById('detailMainImg')||document.getElementById('wr-detail-main-img');if(src&&main){main.closest('picture')?.querySelectorAll('source').forEach(s=>s.remove());main.removeAttribute('srcset');main.removeAttribute('sizes');main.src=src;}const container=t.closest('.senseng-detail-thumbs')||t.parentElement;container?.querySelectorAll('.wr-detail-thumb,.senseng-thumb-btn').forEach(sibling=>sibling.classList.remove('active'));t.classList.add('active');});});document.querySelectorAll('.senseng-detail-thumbs').forEach(group=>{const buttons=Array.from(group.querySelectorAll('.senseng-thumb-btn,.wr-detail-thumb'));const main=document.getElementById('detailMainImg')||document.getElementById('wr-detail-main-img');if(!main||!buttons.length)return;let current=Math.max(0,buttons.findIndex(b=>b.classList.contains('active')));const show=(idx)=>{current=(idx+buttons.length)%buttons.length;const btn=buttons[current];const img=btn.querySelector('img');const src=btn.getAttribute('data-src')||btn.getAttribute('data-large')||(img&&img.src);if(!src)return;main.closest('picture')?.querySelectorAll('source').forEach(s=>s.remove());main.removeAttribute('srcset');main.removeAttribute('sizes');main.src=src;if(img&&img.alt)main.alt=img.alt;buttons.forEach((b,i)=>b.classList.toggle('active',i===current));};const arrows=group.querySelectorAll('.senseng-thumb-arrow');arrows[0]?.addEventListener('click',()=>show(current-1));arrows[1]?.addEventListener('click',()=>show(current+1));});const form=document.getElementById('inquiry');if(form&&!${Boolean(options.preview)}){const p=new URL(location.href).searchParams.get('productId');if(p&&Array.from(form.productId.options).some(o=>o.value===p))form.productId.value=p;let requestId=crypto.randomUUID();let submitted='';form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('button[type=submit]'),status=form.querySelector('[role=status]');button.disabled=true;button.textContent=labels.sending;const fields=Object.fromEntries(new FormData(form));const serialized=JSON.stringify(fields);if(submitted&&submitted!==serialized)requestId=crypto.randomUUID();submitted=serialized;try{const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,requestId})});if(!response.ok)throw Error();status.textContent=labels.sent;form.reset();requestId=crypto.randomUUID();submitted='';}catch{status.textContent=labels.failed;}finally{button.disabled=false;button.textContent=labels.send+' ↗';}});}})();`;
  const isSenseng = template === 'senseng-clean' || template === 'senseng-video';
  if (isSenseng) {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = draft.materials?materialsSensengBody(ctx):renderSensengPage(ctx, template === 'senseng-video',isTypedMaterialsSource(draft)||isModernAboutSource(draft),isModernAboutSource(draft));
    if(draft.materials){
      const seo=materialsSeo(draft,options)!;
      return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(seo.title)}</title><meta name="description" content="${esc(seo.description)}">${options.preview?'<meta name="robots" content="noindex,nofollow">':''}<style>${styles}\n${themeStyles}</style>${materialsThemeStyle(draft)}</head><body class="${template} wr-materials-site" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${bodyHtml}<script>${script}</script></body></html>`;
    }
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'senseng-candy') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderCandyPage(ctx);
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'senseng-wonder') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderWonderPage(ctx);
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'senseng-arcade') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderArcadePage(ctx);
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'senseng-nature') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderNaturePage(ctx);
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'senseng-minimal') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderMinimalPage(ctx);
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'universal-trade-banner' || template === 'universal-showcase-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderUniversalPage(ctx, template === 'universal-showcase-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'toys-figure-banner' || template === 'toys-interactive-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderToysFigureThemePage(ctx, template === 'toys-interactive-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'plush-cushion-banner' || template === 'plush-living-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderPlushPage(ctx, template === 'plush-living-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'apparel-fabric-banner' || template === 'apparel-runway-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderApparelPage(ctx, template === 'apparel-runway-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'footwear-craft-banner' || template === 'footwear-kinetic-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderFootwearPage(ctx, template === 'footwear-kinetic-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'luggage-leather-banner' || template === 'luggage-voyage-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderLuggageBagsTemplate(ctx, template === 'luggage-voyage-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'jewelry-luxury-banner' || template === 'jewelry-timeless-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderJewelryWatchesTemplate(ctx, template === 'jewelry-timeless-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'homedecor-aesthetic-banner' || template === 'homedecor-living-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderHomeDecorTemplate(ctx, template === 'homedecor-living-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'furniture-minimal-banner' || template === 'furniture-spatial-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderFurnitureStorageTemplate(ctx, template === 'furniture-spatial-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'kitchen-culinary-banner' || template === 'kitchen-gourmet-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderKitchenwareTablewareTemplate(ctx, template === 'kitchen-gourmet-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'drinkware-ceramic-banner' || template === 'drinkware-thermal-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderDrinkwarePage(ctx, template === 'drinkware-thermal-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'beauty-skincare-banner' || template === 'beauty-glow-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderBeautyPage(ctx, template === 'beauty-glow-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'electronics-gadget-banner' || template === 'electronics-smart-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderElectronicsPage(ctx, template === 'electronics-smart-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'tools-precision-banner' || template === 'tools-workshop-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderToolsPage(ctx, template === 'tools-workshop-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'sports-trail-banner' || template === 'sports-kinetic-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderSportsPage(ctx, template === 'sports-kinetic-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'pet-supplies-banner' || template === 'pet-wellness-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderPetSuppliesPage(ctx, template === 'pet-wellness-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'stationery-craft-banner' || template === 'stationery-studio-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderStationeryPage(ctx, template === 'stationery-studio-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'poster-graphic-banner' || template === 'poster-gallery-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderPosterPage(ctx, template === 'poster-gallery-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'food-artisan-banner' || template === 'food-harvest-video') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderFoodPage(ctx, template === 'food-harvest-video');
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script></body></html>`;
  }
  if (template === 'single-device-showcase' || template === 'single-artisan-craft' || template === 'single-wellness-nordic') {
    const ctx = buildThemeContext(draft, options);
    const bodyHtml = renderSingleProductPage(ctx, template);
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}\n${singleProductStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}${bodyHtml}<script>${script}</script><script>${singleProductRuntime}</script></body></html>`;
  }
  if (isReferenceTemplate(template)) return renderReferencePage(draft, { ...options, page }, content, script);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page === 'home' ? company.name : `${page === 'detail' ? translate(draft.products.find((p) => p.id === options.productId) ?? mainProduct ?? ({ name: ui.product, description: '' } as Product)).name : ui[page as 'home' | 'catalog' | 'about' | 'contact']} · ${company.name}`)}</title><meta name="description" content="${esc(copy.subtitle)}">${options.preview ? '<meta name="robots" content="noindex,nofollow">' : ''}<style>${styles}\n${themeStyles}</style></head><body class="${template}" data-template="${template}" style="--brand:${color};--brand-ink:${brandInk}">${options.preview ? `<div class="preview-bar">${esc(ui.preview)}</div>` : ''}<a class="skip" href="#main">${esc(ui.skip)}</a><header class="wrap nav"><a class="brand" href="${path('index.html')}" ${navAttrs('home')}>${brand}</a><nav aria-label="${esc(ui.menu)}">${navLink('home', ui.home)}${navLink('catalog', ui.catalog)}${navLink('about', ui.about)}${navLink('contact', ui.contact)}</nav><div class="languages" aria-label="${esc(ui.language)}">${languageLinks}</div></header><main id="main">${content}</main><footer class="footer wrap"><div class="footer-top"><a class="brand" href="${path('index.html')}" ${navAttrs('home')}>${esc(company.name)}</a><div class="socials">${socials}</div><a class="text-link" href="mailto:${esc(company.email)}">${esc(company.email)}</a></div><div class="footer-bottom"><span>© ${new Date().getUTCFullYear()} ${esc(company.name)}</span><span>${esc(ui.rights)}</span></div></footer><script>${script}</script></body></html>`;
}
export function renderSiteFiles(
  draft: Draft,
  options: Omit<RenderOptions, 'lang' | 'page'> & { publicBaseUrl: string },
): Record<string, string> {
  if (options.preview) throw Error('Private preview cannot be exported');
  draft = singleProductDraft(draft);
  const files: Record<string, string> = {};
  for (const lang of draft.languages) {
    for (const page of ['home', 'catalog', 'about', 'contact'])
      files[`${lang}/${page === 'home' ? 'index.html' : `${page}/index.html`}`] = renderSite(
        draft,
        { ...options, lang, page },
      );
    for (const product of draft.products)
      files[`${lang}/${productPath(product.id)}`] = renderSite(draft, {
        ...options,
        lang,
        page: 'detail',
        productId: product.id,
      });
  }
  files['index.html'] =
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=en/index.html"><title>${esc(draft.company.name)}</title><a href="en/index.html">${esc(draft.company.name)}</a></html>`;
  files['index.html'] = withFavicon(files['index.html'], draft, options.assetUrl);
  // Exported sites run on their own domain; bundled template media lives on the builder.
  if (isSingleProductTemplate(draft.template)) {
    const mediaOrigin = new URL(options.publicBaseUrl).origin;
    for (const key of Object.keys(files)) files[key] = files[key].replace(/(["'(])\/templates\/single-product\//g, `$1${mediaOrigin}/templates/single-product/`);
  }
  return files;
}
