import { bannerLink, selectedBanner } from './banner-config';
import { bannerRuntime } from './banner-runtime';
import { parse, parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import type { BannerSlide, Draft } from './model';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
const attr = (node: Element, name: string) => node.attrs.find((a) => a.name === name)?.value ?? '';
const elements = (node: Node): Element[] =>
  'childNodes' in node
    ? node.childNodes.flatMap((child) =>
        'tagName' in child ? [child, ...elements(child)] : elements(child),
      )
    : [];
const visibleText = (node: Node): string =>
  'value' in node
    ? node.value
    : 'childNodes' in node
      ? node.childNodes.map(visibleText).join('')
      : '';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Apply page-scoped media at render time, preserving the original generated artifact. */
export function withBanner(
  html: string,
  draft: Draft,
  assetUrl: (id: string) => string,
  target: boolean | string | { page: string; productId?: string },
): string {
  const page =
    typeof target === 'boolean'
      ? target
        ? 'home'
        : ''
      : typeof target === 'string'
        ? target
        : target.page;
  const banner = selectedBanner(
    draft,
    page,
    typeof target === 'object' ? target.productId : undefined,
  );
  if (!banner) return html;
  const hasMedia = banner.kind === 'video' ? Boolean(banner.videoAssetId) : banner.slides.length > 0;
  const isImageMode = banner.mode === 'image';
  const hasCustomCopy = Boolean(
    banner.eyebrow ||
      banner.headline ||
      banner.subtitle ||
      banner.primaryButtonText ||
      banner.primaryButtonUrl ||
      banner.secondaryButtonText ||
      banner.secondaryButtonUrl ||
      (banner.tags && banner.tags.length > 0) ||
      (banner.floatingPills && banner.floatingPills.length > 0),
  );
  if (!hasMedia && !isImageMode && !hasCustomCopy)
    return html;
  const video = banner.kind === 'video';
  const document = parse(html);
  const all = elements(document);
  if (all.some((node) => attr(node, 'data-wr-banner') === 'custom')) return html;
  const body = all.find((node) => node.tagName === 'body');
  const head = all.find((node) => node.tagName === 'head');
  if (!body || !head) return html;
  const materialsPage = attr(body, 'class').split(/\s+/).includes('wr-materials-site');
  // The confirmed hero contains collection controls, not the site navigation.
  const collectionHero = all.find((node) => node.attrs.some((a) => a.name === 'data-wr-collection-hero'));
  // Prefer an explicit model marker, then known top-level hero names. Never replace navigation.
  let hero =
    collectionHero ??
    all.find(
      (node) =>
        ['section', 'div', 'header'].includes(node.tagName) &&
        node.attrs.some((a) => a.name === 'data-wr-hero') &&
        !elements(node).some((child) => child.tagName === 'nav'),
    ) ??
    all.find(
      (node) =>
        ['section', 'div', 'header'].includes(node.tagName) &&
        !elements(node).some((child) => child.tagName === 'nav') &&
        /(?:^|[\s_-])(?:(?:[a-z0-9_-]*-)?(?:hero|banner)(?:-[a-z0-9_-]+)?|wr-inner-title)(?:\s|$)/i.test(
          `${attr(node, 'id')} ${attr(node, 'class')}`,
        ),
    );
  // Pure-image single-product heroes keep editable text in the following panel.
  if (hero && !hasMedia && hasCustomCopy && attr(hero, 'data-sp-hero') === 'image') {
    hero = all.find(node => node.attrs.some(a => a.name === 'data-sp-hero-copy')) ?? hero;
  }
  if (!hero && page === 'home') {
    const h1 = all.find((node) => node.tagName === 'h1');
    let parent = h1?.parentNode;
    while (parent && 'tagName' in parent && !['main', 'body'].includes(parent.tagName)) {
      if (
        parent.tagName === 'section' &&
        !elements(parent).some((node) => node.tagName === 'nav')
      ) {
        hero = parent;
        break;
      }
      parent = parent.parentNode;
    }
  }
  const fullImage = !video && (banner.mode === 'image' || (!hero && hasMedia));
  const slideHasCopy = (slide: BannerSlide) => !fullImage && Boolean(
    slide.eyebrow || slide.headline || slide.subtitle || slide.buttonText || slide.secondaryButtonText,
  );
  const hasSlideCopy = banner.slides.some(slideHasCopy);
  const slides = banner.slides
    .map(
      (slide, i) =>
        `<div class="wr-banner-slide" data-wr-slide ${i ? 'hidden aria-hidden="true"' : 'aria-hidden="false"'}><img data-wr-banner-image src="${escape(assetUrl(slide.assetId))}" alt="${escape(slide.alt)}" loading="eager" ${i ? '' : 'fetchpriority="high"'} decoding="async">${slideHasCopy(slide) ? `<div class="wr-banner-slide-copy">${slide.eyebrow ? `<div class="wr-banner-slide-eyebrow" style="font-size:0.9rem;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;opacity:0.9;">${escape(slide.eyebrow)}</div>` : ''}${slide.headline ? `<h2 class="wr-banner-slide-title">${escape(slide.headline)}</h2>` : ''}${slide.subtitle ? `<p class="wr-banner-slide-desc">${escape(slide.subtitle)}</p>` : ''}<div style="display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap;">${slide.buttonText ? `<a class="button wr-banner-slide-btn" href="${escape(bannerLink(slide.buttonUrl || 'contact/index.html'))}">${escape(slide.buttonText)} ↗</a>` : ''}${slide.secondaryButtonText ? `<a class="button wr-banner-slide-btn wr-banner-slide-btn-sub" style="background:rgba(255,255,255,0.2)!important;color:#fff!important;border:2px solid rgba(255,255,255,0.6)!important;" href="${escape(bannerLink(slide.secondaryButtonUrl || 'contact/index.html'))}">${escape(slide.secondaryButtonText)}</a>` : ''}</div></div>` : ''}</div>`,
    )
    .join('');
  const poster = banner.posterAssetId ? escape(assetUrl(banner.posterAssetId)) : '';
  const media = video
    ? `${poster ? `<img class="wr-banner-poster" src="${poster}" alt="" aria-hidden="true">` : ''}<video data-wr-banner-video src="${escape(assetUrl(banner.videoAssetId!))}" ${poster ? `poster="${poster}"` : ''} muted loop playsinline preload="metadata" aria-label="Banner background video"></video>`
    : slides;
  const controls =
    video || banner.slides.length > 1
      ? `<div class="wr-banner-controls" role="group" aria-label="Banner controls">${video ? '' : `<button type="button" data-wr-banner-prev aria-label="Previous banner">←</button><span data-wr-banner-status aria-live="off">1 / ${banner.slides.length}</span><button type="button" data-wr-banner-next aria-label="Next banner">→</button>`}<button type="button" data-wr-banner-toggle aria-label="Play banner">▶</button></div>`
      : '';
  const image = hasMedia ? `<div class="wr-banner-media">${media}</div>` : '';
  const createdHero = !hero;
  const defaultButtonText = draft.copy[draft.languages[0]]?.cta || 'Contact';
  const defaultButtonUrl = `${page === 'home' ? '' : '../'}contact/index.html`;
  if (!hero) {
    const heading = all.some((node) => node.tagName === 'h1') ? 'h2' : 'h1';
    const copy = hasCustomCopy ? `<div class="wr-confirmed-hero-copy">${banner.eyebrow ? `<span class="eyebrow">${escape(banner.eyebrow)}</span>` : ''}${banner.headline ? `<${heading}>${escape(banner.headline)}</${heading}>` : ''}${banner.subtitle ? `<p>${escape(banner.subtitle)}</p>` : ''}${banner.primaryButtonText || banner.primaryButtonUrl ? `<a class="button" href="${escape(bannerLink(banner.primaryButtonUrl || defaultButtonUrl))}">${escape(banner.primaryButtonText || defaultButtonText)}</a>` : ''}</div>` : '';
    hero = parseFragment(`<section>${copy}</section>`).childNodes[0] as Element;
    const main = all.find((node) => node.tagName === 'main') ?? body;
    const header = main.childNodes.findIndex(
      (node) => 'tagName' in node && node.tagName === 'header',
    );
    main.childNodes.splice(header + 1, 0, hero);
    hero.parentNode = main;
  }
  hero.attrs.push(
    { name: 'data-wr-banner', value: 'custom' },
    { name: 'data-autoplay', value: String(banner.autoplay) },
    { name: 'data-interval', value: String(banner.interval) },
  );
  if (collectionHero && fullImage && !hasMedia) {
    // Pure-image mode without an upload keeps the bound collection, only hiding its copy.
    const copy = elements(hero).find((node) => attr(node, 'class') === 'wr-confirmed-hero-copy');
    const heading = elements(hero).find((node) => node.tagName === 'h1');
    hero.childNodes = hero.childNodes.filter((node) => node !== copy);
    hero.attrs.push({ name: 'data-wr-banner-mode', value: 'image' });
    if (heading) {
      heading.attrs.push({ name: 'style', value: 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)' });
      heading.parentNode = hero;
      hero.childNodes.push(heading);
    }
    return serialize(document);
  }
  if (fullImage) {
    hero.attrs.push({ name: 'data-wr-banner-mode', value: 'image' });
    const heading = elements(hero).find((node) => node.tagName === 'h1');
    if (hasMedia) {
      hero.childNodes = parseFragment(image).childNodes;
      if (heading) {
        heading.attrs = heading.attrs.filter((a) => a.name !== 'class');
        heading.attrs.push({ name: 'class', value: 'wr-banner-heading' });
        heading.parentNode = hero;
        hero.childNodes.push(heading);
      }
    } else {
      hero.attrs.push({ name: 'data-wr-banner-hide-overlay', value: 'true' });
      if (heading) {
        heading.attrs = heading.attrs.filter((a) => a.name !== 'class');
        heading.attrs.push({ name: 'class', value: 'wr-banner-heading' });
        heading.parentNode = hero;
        hero.childNodes = [heading];
      } else {
        hero.childNodes = [];
      }
    }
  } else {
    const copy = elements(hero).find((node) => attr(node, 'class') === 'wr-confirmed-hero-copy') || (materialsPage ? hero : undefined);
    if (copy) {
      const appendCopy = (html: string) => {
        for (const node of parseFragment(html).childNodes) {
          node.parentNode = copy;
          copy.childNodes.push(node);
        }
      };
      if (banner.eyebrow && !elements(copy).some((node) => /(?:^|[\s_-])(?:eyebrow|badge)(?:[\s_-]|$)/i.test(attr(node, 'class')))) appendCopy(`<span class="eyebrow">${escape(banner.eyebrow)}</span>`);
      if (banner.subtitle && !elements(copy).some((node) => node.tagName === 'p')) appendCopy('<p></p>');
      const buttons = () => elements(copy).filter((node) => node.tagName === 'a' && (attr(node, 'class').includes('button') || attr(node, 'class').includes('btn')));
      if ((banner.primaryButtonText || banner.primaryButtonUrl) && !buttons().length) appendCopy(`<a class="button" href="${escape(bannerLink(banner.primaryButtonUrl || defaultButtonUrl))}">${escape(banner.primaryButtonText || defaultButtonText)}</a>`);
      if (banner.secondaryButtonText || banner.secondaryButtonUrl) {
        const primary = buttons()[0];
        if (buttons().length < 2) appendCopy(`<a class="button" style="margin:8px" href="${escape(bannerLink(banner.secondaryButtonUrl || (primary ? attr(primary, 'href') : defaultButtonUrl)))}">${escape(banner.secondaryButtonText || (primary ? visibleText(primary) : defaultButtonText))}</a>`);
      }
      for (const [name, values] of [['tags', banner.tags], ['pills', banner.floatingPills]] as const) {
        const supplied = values?.filter((value) => value.trim());
        if (supplied?.length) appendCopy(`<div class="wr-banner-custom-${name}" style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:18px">${supplied.map((value) => `<span style="padding:8px 14px;border:1px solid currentColor;border-radius:999px">${escape(value)}</span>`).join('')}</div>`);
      }
    }
    if (hasCustomCopy) {
      if (banner.headline) {
        const h1 = elements(hero).find((node) => node.tagName === 'h1');
        if (h1) {
          h1.childNodes = [{ nodeName: '#text', value: banner.headline, parentNode: h1 } as any];
        }
      }
      if (banner.subtitle) {
        const p = elements(hero).find(
          (node) => node.tagName === 'p' && !attr(node, 'class').includes('eyebrow'),
        );
        if (p) {
          p.childNodes = [{ nodeName: '#text', value: banner.subtitle, parentNode: p } as any];
        }
      }
      if (banner.eyebrow) {
        const eyebrowNode = elements(hero).find((node) => {
          const cls = attr(node, 'class');
          return /(?:^|[\s_-])(?:eyebrow|badge)(?:[\s_-]|$)/i.test(cls);
        });
        if (eyebrowNode) {
          eyebrowNode.childNodes = [
            { nodeName: '#text', value: banner.eyebrow, parentNode: eyebrowNode } as any,
          ];
        }
      }
      if (banner.primaryButtonText || banner.primaryButtonUrl) {
        const buttons = elements(hero).filter(
          (node) =>
            node.tagName === 'a' &&
            (attr(node, 'class').includes('button') || attr(node, 'class').includes('btn')),
        );
        if (buttons[0]) {
          if (banner.primaryButtonText) {
            buttons[0].childNodes = [
              {
                nodeName: '#text',
                value: `${banner.primaryButtonText} ↗`,
                parentNode: buttons[0],
              } as any,
            ];
          }
          if (banner.primaryButtonUrl) {
            const hrefAttr = buttons[0].attrs.find((a) => a.name === 'href');
            if (hrefAttr) hrefAttr.value = bannerLink(banner.primaryButtonUrl);
            else buttons[0].attrs.push({ name: 'href', value: bannerLink(banner.primaryButtonUrl) });
          }
        }
      }
      if (banner.secondaryButtonText || banner.secondaryButtonUrl) {
        const buttons = elements(hero).filter(
          (node) =>
            node.tagName === 'a' &&
            (attr(node, 'class').includes('button') || attr(node, 'class').includes('btn')),
        );
        if (buttons[1]) {
          if (banner.secondaryButtonText) {
            buttons[1].childNodes = [
              {
                nodeName: '#text',
                value: banner.secondaryButtonText,
                parentNode: buttons[1],
              } as any,
            ];
          }
          if (banner.secondaryButtonUrl) {
            const hrefAttr = buttons[1].attrs.find((a) => a.name === 'href');
            if (hrefAttr) hrefAttr.value = bannerLink(banner.secondaryButtonUrl);
            else buttons[1].attrs.push({ name: 'href', value: bannerLink(banner.secondaryButtonUrl) });
          }
        }
      }
    }
    // Copy-only edits keep the uncropped collection track and its responsive layout.
    if ((materialsPage || createdHero) && !hasMedia) return serialize(document);
    if (hasMedia) {
    if (collectionHero) hero.childNodes = hero.childNodes.filter((node) =>
      !('tagName' in node && ['wr-confirmed-collection-track', 'wr-confirmed-collection-nav'].includes(attr(node, 'class'))),
    );
    // Remove old media to prevent both loading and playback underneath the chosen image.
    const strip = (node: Element) => {
      node.childNodes = node.childNodes.filter(
        (child) =>
          !('tagName' in child && ['video', 'picture', 'img', 'canvas'].includes(child.tagName)),
      );
      node.childNodes.forEach((child) => {
        if ('tagName' in child) strip(child);
      });
    };
    strip(hero);
    const cleanEmptyMedia = (node: Element) => {
      node.childNodes = node.childNodes.filter(
        (child) =>
          !(
            'tagName' in child &&
            (attr(child, 'id') === 'video-toggle' ||
              (child.tagName === 'figure' &&
                !visibleText(child).trim() &&
                !elements(child).some((n) => ['a', 'button'].includes(n.tagName))))
          ),
      );
      node.childNodes.forEach((child) => {
        if ('tagName' in child) cleanEmptyMedia(child);
      });
    };
    cleanEmptyMedia(hero);
    hero.childNodes.unshift(...parseFragment(image).childNodes);
    }
  }
  hero.childNodes.push(...parseFragment(controls).childNodes);
  hero.childNodes.forEach((node) => {
    node.parentNode = hero!;
  });
  const position = ['top', 'center', 'bottom'].includes(banner.position)
    ? banner.position
    : 'center';
  const fit = banner.fit === 'contain' ? 'contain' : 'cover';
  let css = `[data-wr-banner=custom]{position:relative!important;isolation:isolate;overflow:hidden!important}[data-wr-banner=custom]::before,[data-wr-banner=custom]::after{display:none!important}.wr-banner-media{pointer-events:none}.wr-banner-media img,.wr-banner-media video{display:block!important;width:100%!important;max-width:none!important;height:100%!important;object-fit:${video ? 'cover' : fit}!important;object-position:center ${position}!important;transform:none!important;margin:0!important}.wr-banner-media [hidden]{visibility:hidden!important;opacity:0!important}.wr-banner-media [data-wr-slide]:not([hidden]){visibility:visible!important;opacity:1!important}.wr-banner-controls{position:absolute!important;bottom:20px!important;left:50%!important;transform:translateX(-50%)!important;display:flex!important;gap:12px!important;align-items:center!important;z-index:10!important;padding:6px 12px!important;border-radius:30px!important;background:#102030d9!important;color:#fff!important;font:14px system-ui!important}.wr-banner-controls button{display:inline-flex!important;align-items:center;justify-content:center;width:40px!important;height:40px!important;min-width:40px;border:1px solid #ffffff80!important;border-radius:50%!important;background:transparent!important;color:#fff!important;cursor:pointer;padding:0!important}.wr-banner-controls button:focus-visible{outline:3px solid #fff;outline-offset:2px}.wr-banner-heading{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important}`;
  if (fullImage) {
    css += `[data-wr-banner=custom]{display:block!important;padding:0!important;height:auto!important;min-height:0!important;max-height:none!important;background:none!important}[data-wr-banner=custom]>:not(.wr-banner-media):not(.wr-banner-controls):not(.wr-banner-heading){display:none!important}[data-wr-banner=custom] [class*="hero-left"],[data-wr-banner=custom] [class*="stage"],[data-wr-banner=custom] [class*="candy-stage"],[data-wr-banner=custom] [class*="scroll-down"],[data-wr-banner=custom] .hero-title,[data-wr-banner=custom] .hero-sub,[data-wr-banner=custom] .button{display:none!important}.wr-banner-media{display:grid!important;position:relative!important}.wr-banner-media img{grid-area:1/1!important;position:relative!important;height:auto!important;${banner.slides.length > 1 ? 'aspect-ratio:16/7;' : ''}}`;
    if (!hasMedia) {
      css += `[data-wr-banner=custom][data-wr-banner-hide-overlay="true"] h1,[data-wr-banner=custom][data-wr-banner-hide-overlay="true"] h2,[data-wr-banner=custom][data-wr-banner-hide-overlay="true"] p,[data-wr-banner=custom][data-wr-banner-hide-overlay="true"] .button,[data-wr-banner=custom][data-wr-banner-hide-overlay="true"] .senseng-btn-pill,[data-wr-banner=custom][data-wr-banner-hide-overlay="true"] [class*="hero-left"],[data-wr-banner=custom][data-wr-banner-hide-overlay="true"] [data-reveal="fade-up"]:first-child,[data-wr-banner=custom][data-wr-banner-hide-overlay="true"] .wr-scroll-down{display:none!important}`;
    }
  }
  else
    css += `[data-wr-banner=custom]{min-height:clamp(620px,50vw,960px);background:#17212b!important}[data-wr-banner=custom]>:not(.wr-banner-media):not(.wr-banner-controls){position:relative;z-index:2}[data-wr-banner=custom] [class*=hero-scene],[data-wr-banner=custom] [class*=video-overlay],[data-wr-banner=custom] .hero-controls,[data-wr-banner=custom] .hero-scroll-cue{display:none!important}[data-wr-banner=custom] [style*="background-image"]{background-image:none!important}.wr-banner-media{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:-1!important}.wr-banner-media img,.wr-banner-media video{position:absolute!important;inset:0!important}.wr-banner-slide{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important}.wr-banner-slide-copy{position:relative!important;z-index:3!important;max-width:960px!important;padding:60px 24px!important;text-align:center!important;color:#fff!important;text-shadow:0 3px 15px rgba(0,0,0,0.6)!important}.wr-banner-slide-title{font-size:clamp(2.4rem,5vw,4.4rem)!important;font-weight:800!important;line-height:1.12!important;margin:0 0 16px!important;color:#fff!important}.wr-banner-slide-desc{font-size:1.2rem!important;line-height:1.65!important;max-width:720px!important;margin:0 auto 24px!important;color:#f1f5f9!important}.wr-banner-slide-btn{background:var(--brand,#f59e0b)!important;color:#fff!important;font-weight:800!important;border-radius:9999px!important;padding:15px 36px!important;display:inline-block!important;box-shadow:0 8px 24px rgba(0,0,0,0.3)!important}`;
  if (hasSlideCopy)
    css += `[data-wr-banner=custom]>:not(.wr-banner-media):not(.wr-banner-controls){display:none!important}`;
  if (video || banner.height === 'screen')
    css += `html,body{overflow-x:clip}[data-wr-banner=custom]{box-sizing:border-box!important;width:100vw!important;max-width:none!important;margin-left:calc(50% - 50vw)!important;margin-right:0!important;border-radius:0!important;min-height:100svh!important;height:100svh!important;padding-top:0!important;padding-bottom:0!important;display:grid!important;align-content:center!important}[data-wr-banner=custom]>.wr-banner-media{position:absolute!important;inset:0!important;height:100%!important}[data-wr-banner=custom] .wr-banner-media img{height:100%!important;aspect-ratio:auto!important}`;
  if (!fullImage && (banner.contrast === 'light' || banner.contrast === 'dark')) {
    const dark = banner.contrast === 'dark';
    css += `[data-wr-banner=custom]::after{content:"";display:block!important;position:absolute!important;inset:0!important;z-index:0!important;pointer-events:none;background:${dark ? 'rgba(5,15,30,.60)' : 'rgba(255,255,255,.75)'}!important}[data-wr-banner=custom] h1,[data-wr-banner=custom] h2,[data-wr-banner=custom] p,[data-wr-banner=custom] .eyebrow{color:${dark ? '#fff' : '#162536'}!important;-webkit-text-fill-color:currentColor!important}`;
  }
  const style = parseFragment(`<style>${css}</style>`).childNodes[0];
  style.parentNode = head;
  head.childNodes.push(style);
  if (video || banner.slides.length > 1) {
    const script = parseFragment(`<script>${bannerRuntime}</script>`).childNodes[0];
    script.parentNode = body;
    body.childNodes.push(script);
  }
  return serialize(document);
}
