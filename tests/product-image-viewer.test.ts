import { afterEach, expect, it, vi } from 'vitest';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import type { Asset } from '../src/shared/model';
import { templateMediaRequirements } from '../src/shared/template-media';
import { renderSite } from '../src/templates';
import { draftFromMaterials } from '../src/worker/materials-service';
import { typedMaterialsFixture } from './fixtures/materials-typed';
import { productImageViewerRuntime } from '../src/shared/product-image-viewer';

afterEach(() => vi.unstubAllGlobals());

it('opens the currently selected original, supports keyboard, and restores focus and scrolling on close', () => {
  const node = () => {
    const attrs = new Map<string, string>();
    const events = new Map<string, (event?: any) => void>();
    return {
      attrs, events, src: '', alt: '', id: '', open: false, children: [] as any[],
      style: { overflow: '' }, focus: vi.fn(),
      setAttribute: (key: string, value: string) => attrs.set(key, value),
      getAttribute: (key: string) => attrs.get(key),
      removeAttribute(key: string) { attrs.delete(key); if (key === 'src') this.src = ''; },
      addEventListener: (key: string, handler: (event?: any) => void) => events.set(key, handler),
      appendChild(child: any) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      closest: () => null,
      querySelector: (_selector: string): any => null,
      showModal() { this.open = true; },
      close() { this.open = false; events.get('close')?.(); },
    };
  };
  const main = node(), body = node(), thumbnail = node(), control = node();
  thumbnail.src = 'blob:authorized-gallery'; thumbnail.alt = 'Side view'; thumbnail.setAttribute('src', thumbnail.src);
  control.setAttribute('data-src', '/private/asset-requires-auth');
  control.querySelector = () => thumbnail;
  const created: ReturnType<typeof node>[] = [];
  body.style.overflow = 'auto';
  vi.stubGlobal('document', {
    querySelectorAll: (selector: string) => selector.startsWith('.senseng-detail-thumbs') ? [control] : [main],
    querySelector: () => ({ textContent: 'Confirmed product name' }), baseURI: 'https://preview.test/',
    getElementById: (id: string) => created.find(n => n.id === id),
    documentElement: { lang: 'en' }, head: node(), body,
    createElement: () => { const n = node(); created.push(n); return n; },
  });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), addEventListener: vi.fn() });
  productImageViewerRuntime();
  const dialog = body.children[0], [close, stage] = dialog.children, image = stage.children[0];
  main.events.get('click')!();
  expect(dialog.open).toBe(false); // Preview assets have not arrived yet.
  main.src = 'blob:authorized-side-view';
  main.alt = 'Selected side view';
  main.setAttribute('src', main.src);
  Object.assign(main, { currentSrc: '/small-thumbnail.webp' });
  main.events.get('click')!();
  expect(dialog.open).toBe(true);
  expect(image.src).toBe('blob:authorized-side-view');
  expect(image.alt).toBe('Selected side view');
  const thumbs = dialog.children[3].children[1].children;
  expect(thumbs).toHaveLength(2);
  expect(dialog.children[3].children[0].textContent).toBe('Confirmed product name');
  thumbs[1].events.get('click')();
  expect(image.src).toBe('blob:authorized-gallery');
  expect(image.alt).toBe('Side view');
  expect(thumbs[0].getAttribute('aria-pressed')).toBe('false');
  expect(thumbs[1].getAttribute('aria-pressed')).toBe('true');
  expect(body.style.overflow).toBe('hidden');
  expect(close.focus).toHaveBeenCalledOnce();
  dialog.events.get('click')({ target: image });
  expect(dialog.open).toBe(true);
  dialog.events.get('click')({ target: dialog });
  expect(dialog.open).toBe(false);
  expect(body.style.overflow).toBe('auto');
  expect(main.focus).toHaveBeenCalledWith({ preventScroll: true });
  main.src = '/original-front.png';
  for (const key of ['Enter', ' ']) {
    const event = { key, preventDefault: vi.fn() };
    main.events.get('keydown')!(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(image.src).toBe('/original-front.png');
    close.events.get('click')();
    expect(dialog.open).toBe(false);
  }
  main.events.get('click')!();
  dialog.open = false; // Native close changes `open` before dispatching its queued event.
  main.events.get('click')!();
  dialog.events.get('close')(); // The previous session's delayed close event.
  expect(dialog.open).toBe(true);
  expect(image.src).toBe('/original-front.png');
  expect(body.style.overflow).toBe('hidden');
  dialog.open = false;
  dialog.events.get('close')();
  expect(body.style.overflow).toBe('auto');
  productImageViewerRuntime();
  expect(body.children).toHaveLength(3);
});

it('uses a bounded lens and adjacent original-image pane for desktop hover without opening a modal', () => {
  const node = () => ({
    id: '', src: '', alt: '', naturalWidth: 1600, naturalHeight: 1000, hidden: true, open: false,
    style: {} as Record<string, string>, attrs: new Map<string, string>(), events: new Map<string, (e: any) => void>(), children: [] as any[],
    setAttribute(key: string, value: string) { this.attrs.set(key, value); },
    getAttribute(key: string) { return this.attrs.get(key); },
    removeAttribute(key: string) { this.attrs.delete(key); },
    appendChild(child: any) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    closest: () => null,
    addEventListener(key: string, fn: (e: any) => void) { this.events.set(key, fn); },
    getBoundingClientRect: () => ({ left: 80, top: 100, right: 560, bottom: 460, width: 480, height: 360 }),
    focus: vi.fn(), showModal: vi.fn(), close: vi.fn(),
  });
  const main = node(), body = node(), created: ReturnType<typeof node>[] = [], windowEvents = new Map<string, () => void>();
  main.src = 'blob:private-original'; main.alt = 'Original product'; main.setAttribute('src', main.src);
  vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector.startsWith('.senseng-detail-thumbs') ? [] : [main], querySelector: () => null, getElementById: (id: string) => created.find(n => n.id === id), documentElement: { lang: 'en' }, head: node(), body,
    createElement: () => { const n = node(); created.push(n); return n; } });
  vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900, matchMedia: () => ({ matches: true }), addEventListener: (key: string, fn: () => void) => windowEvents.set(key, fn) });
  vi.stubGlobal('getComputedStyle', () => ({ objectFit: 'contain', objectPosition: '50% 50%' }));
  productImageViewerRuntime();
  main.events.get('pointermove')?.({ clientX: 320, clientY: 280, pointerType: 'mouse' });
  const lens = created.find(n => n.id === 'wr-product-image-lens'), pane = created.find(n => n.id === 'wr-product-image-detail');
  expect(lens).toBeDefined(); expect(pane).toBeDefined();
  expect(lens!.hidden).toBe(false); expect(pane!.hidden).toBe(false);
  expect(parseFloat(pane!.style.left)).toBeGreaterThanOrEqual(560);
  expect(pane!.children[0].src).toBe('blob:private-original');
  expect(created.find(n => n.id === 'wr-product-image-viewer')!.showModal).not.toHaveBeenCalled();
  main.events.get('pointermove')?.({ clientX: 999, clientY: 999, pointerType: 'mouse' });
  expect(parseFloat(lens!.style.left) + parseFloat(lens!.style.width)).toBeLessThanOrEqual(560);
  expect(parseFloat(lens!.style.top) + parseFloat(lens!.style.height)).toBeLessThanOrEqual(430); // contain leaves 30 px of letterbox space
  main.src = 'blob:new-selection'; main.events.get('pointermove')?.({ clientX: 400, clientY: 280, pointerType: 'mouse' });
  expect(pane!.children[0].src).toBe('blob:new-selection');
  windowEvents.get('scroll')?.(); expect(lens!.hidden).toBe(true); expect(pane!.hidden).toBe(true);
  main.events.get('click')?.({ clientX: 400, clientY: 280 });
  expect(created.find(n => n.id === 'wr-product-image-viewer')!.showModal).toHaveBeenCalledOnce();
  expect(main.getAttribute('aria-haspopup')).toBe('dialog');
});

type Node = DefaultTreeAdapterMap['node'];
function mainImages(node: Node): DefaultTreeAdapterMap['element'][] {
  const own = 'tagName' in node && node.tagName === 'img' && node.attrs.some(
    a => a.name === 'id' && ['detailMainImg', 'wr-detail-main-img'].includes(a.value),
  ) ? [node] : [];
  return [...own, ...('childNodes' in node ? node.childNodes.flatMap(mainImages) : [])];
}

it.each(Object.keys(templateMediaRequirements))('%s can enlarge the selected product in standalone and confirmed-materials details', async template => {
  for (const revision of [undefined, `2026-09-19.${template}-materials.1`]) {
    const input = await typedMaterialsFixture(template, 2, revision);
    const draft = draftFromMaterials(input, Object.fromEntries(input.materials.media.map(m => [m.id, { id: m.id } as Asset])));
    if (template.startsWith('single-')) draft.primaryProductId = 'p1';
    const options = { projectId: 'fixture', lang: 'en' as const, page: 'detail', productId: 'p1', assetUrl: (id: string) => `/images/${id}`, inquiryUrl: '/inquiry' };
    for (const materials of [draft.materials, undefined]) {
      const html = renderSite({ ...draft, materials }, options);
      const images = mainImages(parse(html));
      expect(images, `${template}:${revision || 'current'}:${Boolean(materials)} main`).toHaveLength(1);
      expect(images[0].attrs.find(a => a.name === 'src')?.value).toBe('/images/m1');
      expect(html.match(/<script id="wr-product-image-viewer-script">/g)).toHaveLength(1);
    }
    for (const page of ['home', 'catalog', 'about', 'contact']) {
      expect(renderSite(draft, { ...options, page })).not.toContain('id="wr-product-image-viewer-script"');
    }
    // A single original still needs an enlargement target, even without thumbnails.
    draft.products[1].gallery = [];
    draft.materials!.imageBindings = draft.materials!.imageBindings.filter(b => b.slotId !== 'product-gallery');
    expect(mainImages(parse(renderSite(draft, options)))).toHaveLength(1);
  }
});
