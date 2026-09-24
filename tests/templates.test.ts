import { describe, it, expect } from 'vitest';
import type { Draft, Language } from '../src/shared/model';
import { renderSite, renderSiteFiles, labels } from '../src/templates';
const draft = (): Draft => ({
  company: {
    name: 'Field & Form',
    email: 'hello@example.com',
    contactName: 'Alex',
    type: 'trader',
    description: 'Objects selected for daily life.',
    facebook: '',
    instagram: '',
    x: '',
  },
  products: [
    {
      id: 'p-one',
      name: 'Oak form',
      description: 'A compact wooden object.',
      material: 'Oak',
      dimensions: '12 cm',
      imageAssetId: 'product',
    },
  ],
  primaryProductId: 'p-one',
  category: 'general',
  country: 'DE',
  languages: ['en', 'de'],
  template: 'natural',
  brandColor: '#52684b',
  copy: {
    en: {
      headline: 'Good things, thoughtfully chosen.',
      subtitle: 'Objects for everyday life.',
      about: 'Objects selected for daily life.',
      cta: 'Explore our collection',
    },
    de: {
      headline: 'Mit Sorgfalt ausgewählt.',
      subtitle: 'Dinge für den Alltag.',
      about: 'Objekte für jeden Tag.',
      cta: 'Kollektion entdecken',
    },
  },
  duration: 8,
  direction: 'Soft daylight',
  script: 'A gentle product study',
  scriptRevision: 1,
  scenes: [],
  storyboardRevision: 1,
  heroAssetId: 'video',
  posterAssetId: 'poster',
  heroAccepted: true,
});
const opts = {
  projectId: 'project',
  lang: 'en' as Language,
  page: 'home',
  assetUrl: (id: string) => `https://media.example/${id}`,
  inquiryUrl: 'https://wr.example/api/public/sites/project/inquiries',
};
describe('natural website journey', () => {
  it('renders real video, product navigation, contact form and reduced motion fallback', () => {
    const d = draft();
    const home = renderSite(d, opts);
    expect(home).toContain('<video');
    expect(home).toContain('autoplay');
    expect(home).toContain('muted');
    expect(home).toContain('loop');
    expect(home).toContain('prefers-reduced-motion');
    expect(home).toContain('https://media.example/video');
    expect(home).toContain('products/p-one/index.html');
    const contact = renderSite(d, { ...opts, page: 'contact' });
    expect(contact).toContain('name="email"');
    expect(contact).toContain('name="message"');
    expect(contact).toContain(opts.inquiryUrl);
    expect(contact).toContain('crypto.randomUUID');
    expect(contact).toContain('Your inquiry has been saved');
  });
  it('generates five page types in each selected language and all product detail pages', () => {
    const files = renderSiteFiles(draft(), {
      ...opts,
      publicBaseUrl: 'https://wr.example/public/sites/project',
    });
    for (const lang of ['en', 'de'])
      for (const path of [
        'index.html',
        'catalog/index.html',
        'products/p-one/index.html',
        'about/index.html',
        'contact/index.html',
      ])
        expect(files[`${lang}/${path}`]).toContain(`lang="${lang}"`);
    expect(files['de/contact/index.html']).toContain('Anfrage senden');
  });
  it('escapes content, identifiers, invalid colors and unsafe external URLs', () => {
    const d = draft();
    d.company.name = '<script>alert(1)</script>';
    d.company.instagram = 'javascript:alert(1)';
    d.brandColor = 'red;}body{display:none}';
    d.products[0].id = '../../bad" onclick="x';
    d.copy.en!.headline = '<img src=x onerror=alert(1)>';
    const html = renderSite(d, opts);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('red;}');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('href="products/../../');
  });
  it('rejects private preview exports and keeps absent facts absent', () => {
    const d = draft();
    d.company.description = '';
    d.products[0].material = '';
    d.products[0].dimensions = '';
    d.copy.en!.about = '';
    const html = renderSite(d, { ...opts, page: 'about', preview: true });
    expect(html).toContain('noindex');
    expect(html).not.toMatch(/certified|years of experience|ISO 9001|factory capacity/i);
  });
});
describe('three original templates and six UI languages', () => {
  it('uses distinct compositions with a video hero in every style', () => {
    const outputs = ['natural', 'technology', 'explorer'].map((template) =>
      renderSite({ ...draft(), template: template as Draft['template'] }, opts),
    );
    for (let i = 0; i < outputs.length; i++) {
      expect(outputs[i]).toContain(`data-template="${['natural', 'technology', 'explorer'][i]}"`);
      expect(outputs[i]).toContain('<video');
    }
    expect(new Set(outputs).size).toBe(3);
  });
  it('covers every UI label key for all six languages', () => {
    const keys = Object.keys(labels.en).sort();
    for (const lang of ['en', 'de', 'fr', 'es', 'pt', 'it'] as Language[]) {
      expect(Object.keys(labels[lang]).sort()).toEqual(keys);
      for (const text of Object.values(labels[lang])) expect(text.trim()).not.toBe('');
      const d = draft();
      d.languages = ['en', lang];
      d.copy[lang] = d.copy.en;
      expect(renderSite(d, { ...opts, lang, page: 'contact' })).toContain(labels[lang].send);
    }
  });
});
it('keeps one primary heading when the about page reuses the video hero', () => {
  const html = renderSite(draft(), { ...opts, page: 'about' });
  expect(html.match(/<h1[ >]/g)).toHaveLength(1);
});
it('keeps brand-colored text controls readable for light and dark brand colors', () => {
  expect(renderSite({ ...draft(), brandColor: '#ffffff' }, opts)).toContain('--brand-ink:#17261c');
  expect(renderSite({ ...draft(), brandColor: '#000000' }, opts)).toContain('--brand-ink:#ffffff');
});
describe('10 professional preset templates', () => {
  const all10Templates: Draft['template'][] = [
    'senseng-clean',
    'senseng-video',
    'saas-automation',
    'fintech-platform',
    'digital-marketing',
    'porto-accounting',
    'crafto-corporate',
    'juno-toys',
    'corpox-ai-agency',
    'corpox-consulting',
  ];

  it('renders each of the 10 templates with unique composition and data-template attribute', () => {
    const outputs = all10Templates.map((template) => renderSite({ ...draft(), template }, opts));
    for (let i = 0; i < outputs.length; i++) {
      expect(outputs[i]).toContain(`data-template="${all10Templates[i]}"`);
      expect(outputs[i]).toContain('<!doctype html>');
      expect(outputs[i]).toContain('data-wr-page="home"');
      expect(outputs[i]).toContain('data-wr-page="catalog"');
    }
    // All 10 templates produce distinct HTML outputs
    expect(new Set(outputs).size).toBe(10);
  });

  it('verifies specialized features for each template', () => {
    const d = draft();

    // Template 1: 100% webimg senseng clean
    const t1 = renderSite({ ...d, template: 'senseng-clean' }, opts);
    expect(t1).toContain('Sensory & Character Showcase');
    expect(t1).toContain('Shelf-ready squishy lines');

    // Template 2: senseng fullscreen video variant
    const t2 = renderSite({ ...d, template: 'senseng-video' }, opts);
    expect(t2).toContain('hero-scroll-cue');
    expect(t2).toContain('<video id="hero-video"');

    // References retain their actual visual structures and use project images.
    const landmarks = {
      'saas-automation': 'hero-video',
      'fintech-platform': 'financial-management-platform-header',
      'digital-marketing': 'ns-img-291',
      'porto-accounting': 'header-body',
      'crafto-corporate': 'wr-crafto-hero',
      'juno-toys': 'wr-juno-hero',
      'corpox-ai-agency': 'ai-agency-demo-banner',
      'corpox-consulting': 'wr-consulting-hero',
    };
    for (const [template, landmark] of Object.entries(landmarks)) {
      const html = renderSite({ ...d, template: template as Draft['template'] }, opts);
      expect(html).toContain(landmark);
      expect(html).toContain('https://media.example/product');
      expect(html).toContain('data-wr-bound-product="true"');
      expect(html).toContain('products/p-one/index.html');
      expect(html).toContain('https://wr.example/templates/references/');
      expect(html).not.toContain('__WR_');
      expect(html).not.toMatch(/<script[^>]+src=/);
      expect(html).not.toMatch(/ on(?:click|load|error)=/);
    }
  });
});

describe('reference template product and route integration', () => {
  const templates = [
    'saas-automation',
    'fintech-platform',
    'digital-marketing',
    'porto-accounting',
    'crafto-corporate',
    'juno-toys',
    'corpox-ai-agency',
    'corpox-consulting',
  ] as const;
  for (const template of templates) {
    it(`${template} uses the selected primary image and exports every page`, () => {
      const d = draft();
      d.template = template;
      d.products.push({
        id: 'primary / <item>',
        name: '<Primary product>',
        description: 'Details',
        material: '',
        dimensions: '',
        imageAssetId: 'primary',
      });
      d.primaryProductId = 'primary / <item>';
      const html = renderSite(d, { ...opts, preview: true });
      expect(html).toMatch(
        /<img[^>]*data-wr-product-slot="0"[^>]*src="https:\/\/media.example\/primary"|<img[^>]*src="https:\/\/media.example\/primary"[^>]*data-wr-product-slot="0"/,
      );
      expect(html).toContain('&lt;Primary product&gt;');
      expect(html).not.toContain('<Primary product>');
      const files = renderSiteFiles(d, {
        ...opts,
        publicBaseUrl: 'https://wr.example/public/sites/project',
      });
      for (const page of ['catalog', 'about', 'contact']) {
        expect(files[`en/${page}/index.html`]).toContain('wr-inner');
        expect(files[`en/${page}/index.html`]).toContain('data-wr-page="catalog"');
      }
      expect(files['en/contact/index.html']).toContain('id="inquiry"');
      expect(files['en/contact/index.html']).toContain(opts.inquiryUrl);
      expect(html).toContain('primary%20%2F%20%3Citem%3E/index.html');
    });
  }
});

it('renders saved gallery images and fixed website copy on product details only',()=>{
  const d=draft();
  Object.assign(d.products[0],{tagline:'Made for daily use',sellingPoints:['Approved feature'],applications:['At home'],gallery:[{assetId:'product',sourceImageId:'original',kind:'original',caption:'Original'},{assetId:'side-view',sourceImageId:'side',kind:'angle',caption:'Side view'}]});
  const html=renderSite(d,{...opts,page:'detail',productId:'p-one'});
  expect(html).toContain('https://media.example/side-view');
  expect(html).toContain('Made for daily use');
  expect(html).toContain('Approved feature');
  expect(html).toContain('At home');
  expect(renderSite(d,{...opts,page:'catalog'})).not.toContain('https://media.example/side-view');
});

describe('senseng toy templates (senseng-candy, senseng-wonder, senseng-arcade, senseng-nature, senseng-minimal)', () => {
  const toyTemplates: Draft['template'][] = [
    'senseng-candy',
    'senseng-wonder',
    'senseng-arcade',
    'senseng-nature',
    'senseng-minimal',
  ];

  for (const template of toyTemplates) {
    it(`renders ${template} full website journey across 5 page types`, () => {
      const d = draft();
      d.template = template;
      d.languages = ['en', 'de'];

      // Home
      const homeHtml = renderSite(d, opts);
      expect(homeHtml).toContain(`data-template="${template}"`);
      expect(homeHtml).toContain('data-wr-page="home"');
      expect(homeHtml).toContain('<!doctype html>');
      expect(homeHtml).toContain('products/p-one/index.html');

      // Catalog
      const catalogHtml = renderSite(d, { ...opts, page: 'catalog' });
      expect(catalogHtml).toContain('data-wr-page="catalog"');
      expect(catalogHtml).toContain('products/p-one/index.html');

      // Detail
      const detailHtml = renderSite(d, { ...opts, page: 'detail', productId: 'p-one' });
      expect(detailHtml).toContain('data-wr-page="detail"');
      expect(detailHtml).toContain('p-one');

      // About
      const aboutHtml = renderSite(d, { ...opts, page: 'about' });
      expect(aboutHtml).toContain('data-wr-page="about"');
      expect(aboutHtml).toContain('Field &amp; Form');

      // Contact
      const contactHtml = renderSite(d, { ...opts, page: 'contact' });
      expect(contactHtml).toContain('data-wr-page="contact"');
      expect(contactHtml).toContain('id="inquiry"');
      expect(contactHtml).toContain(opts.inquiryUrl);

      // Render all site files
      const files = renderSiteFiles(d, {
        ...opts,
        publicBaseUrl: 'https://wr.example/public/sites/project',
      });
      for (const lang of ['en', 'de']) {
        for (const path of [
          'index.html',
          'catalog/index.html',
          'products/p-one/index.html',
          'about/index.html',
          'contact/index.html',
        ]) {
          expect(files[`${lang}/${path}`]).toBeDefined();
          expect(files[`${lang}/${path}`]).toContain(`lang="${lang}"`);
        }
      }
    });
  }

  it('verifies specialized layout signatures and dynamic motion features for all 5 toy templates', () => {
    const d = draft();

    // senseng-candy: Candy pop playground layout
    const candyHome = renderSite({ ...d, template: 'senseng-candy' }, opts);
    expect(candyHome).toContain('wr-candy-ribbon');
    expect(candyHome).toContain('wr-candy-hero');
    expect(candyHome).toContain('wr-candy-stage');
    expect(candyHome).toContain('wr-candy-card');

    const candyAbout = renderSite({ ...d, template: 'senseng-candy' }, { ...opts, page: 'about' });
    expect(candyAbout).toContain('wr-senseng-candy-inner');

    // senseng-wonder: Nordic storybook bento layout
    const wonderHome = renderSite({ ...d, template: 'senseng-wonder' }, opts);
    expect(wonderHome).toContain('wr-wonder-ribbon');
    expect(wonderHome).toContain('wr-wonder-hero');
    expect(wonderHome).toContain('wr-wonder-card');
    expect(wonderHome).toContain('CHAPTER 01');

    const wonderContact = renderSite({ ...d, template: 'senseng-wonder' }, { ...opts, page: 'contact' });
    expect(wonderContact).toContain('wr-senseng-wonder-inner');

    // senseng-arcade: Cyber Pop HUD & dynamic effects
    const arcadeHome = renderSite({ ...d, template: 'senseng-arcade' }, opts);
    expect(arcadeHome).toContain('wr-arcade-hud');
    expect(arcadeHome).toContain('wr-arcade-hero');
    expect(arcadeHome).toContain('wrArcadeScan');
    expect(arcadeHome).toContain('wr-arcade-card');
    expect(arcadeHome).toContain('data-reveal');
    expect(arcadeHome).toContain('data-counter');
    expect(arcadeHome).toContain('data-progress');
    expect(arcadeHome).toContain('wr-progress-bar');

    const arcadeAbout = renderSite({ ...d, template: 'senseng-arcade' }, { ...opts, page: 'about' });
    expect(arcadeAbout).toContain('wr-senseng-arcade-inner');
    expect(arcadeAbout).toContain('FOOD-GRADE SILICONE');

    // senseng-nature: Botanical Forest & Organic Counters
    const natureHome = renderSite({ ...d, template: 'senseng-nature' }, opts);
    expect(natureHome).toContain('wr-nature-hero');
    expect(natureHome).toContain('wr-nature-card');
    expect(natureHome).toContain('wr-nature-frame');
    expect(natureHome).toContain('data-reveal');
    expect(natureHome).toContain('data-counter');
    expect(natureHome).toContain('data-progress');

    const natureCatalog = renderSite({ ...d, template: 'senseng-nature' }, { ...opts, page: 'catalog' });
    expect(natureCatalog).toContain('wr-senseng-nature-inner');
    expect(natureCatalog).toContain('wr-nature-grid');

    // senseng-minimal: Swiss Modernist Atelier & Precision Damping
    const minimalHome = renderSite({ ...d, template: 'senseng-minimal' }, opts);
    expect(minimalHome).toContain('wr-minimal-hero');
    expect(minimalHome).toContain('wr-minimal-card');
    expect(minimalHome).toContain('wr-minimal-podium');
    expect(minimalHome).toContain('data-reveal');
    expect(minimalHome).toContain('data-progress');

    const minimalDetail = renderSite(
      { ...d, template: 'senseng-minimal' },
      { ...opts, page: 'detail', productId: 'p-one' },
    );
    expect(minimalDetail).toContain('wr-senseng-minimal-inner');
    expect(minimalDetail).toContain('TECHNICAL ANATOMY');

    // Verify all 5 templates have distinct layouts and content structures
    const homes = [candyHome, wonderHome, arcadeHome, natureHome, minimalHome];
    const uniqueHomes = new Set(homes);
    expect(uniqueHomes.size).toBe(5);
  });
});

describe('8 new industry templates across 4 categories', () => {
  const newTemplates = [
    'pet-supplies-banner',
    'pet-wellness-video',
    'stationery-craft-banner',
    'stationery-studio-video',
    'poster-graphic-banner',
    'poster-gallery-video',
    'food-artisan-banner',
    'food-harvest-video',
  ] as const;

  for (const template of newTemplates) {
    it(`renders ${template} full website journey with zero Chinese in EN`, () => {
      const d = draft();
      d.template = template;
      const pages = ['home', 'catalog', 'detail', 'about', 'contact'] as const;
      for (const page of pages) {
        const html = renderSite(d, { ...opts, page, productId: 'p-one', preview: true });
        expect(html).toContain(`data-template="${template}"`);
        expect(html).not.toMatch(/[\u4e00-\u9fa5]/);
      }
    });
  }

  it('renders unique styling and elements for each of the 8 new templates', () => {
    const d = draft();
    const renderedHomes = newTemplates.map((t) => {
      d.template = t;
      return renderSite(d, opts);
    });
    // All 8 homepages must be completely distinct
    const uniqueSet = new Set(renderedHomes);
    expect(uniqueSet.size).toBe(8);
  });
});

describe('3 single-product showcase templates', () => {
  const singleTemplates = [
    'single-device-showcase',
    'single-artisan-craft',
    'single-wellness-nordic',
  ] as const;

  for (const template of singleTemplates) {
    it(`renders ${template} full website journey with zero Chinese in EN`, () => {
      const d = draft();
      d.template = template;
      const pages = ['home', 'catalog', 'detail', 'about', 'contact'] as const;
      for (const page of pages) {
        const html = renderSite(d, { ...opts, page, productId: 'p-one', preview: true });
        expect(html).toContain(`data-template="${template}"`);
        expect(html).not.toMatch(/[\u4e00-\u9fa5]/);
      }
    });
  }

  it('renders unique signatures, layouts, and storytelling features for each single-product template', () => {
    const d = draft();

    // 1. single-device-showcase: Cyber Keynote dark futuristic telemetry HUD & architecture breakdown
    const deviceHome = renderSite({ ...d, template: 'single-device-showcase' }, opts);
    expect(deviceHome).toContain('0.12ms');
    expect(deviceHome).toContain('Flagship Single-Product Keynote');
    expect(deviceHome).toContain('SYSTEM // ONLINE');
    expect(deviceHome).toContain('EXPLODED ANATOMY');

    const deviceDetail = renderSite(
      { ...d, template: 'single-device-showcase' },
      { ...opts, page: 'detail', productId: 'p-one' },
    );
    expect(deviceDetail).toContain('wr-detail-main-img');
    expect(deviceDetail).toContain('VERIFIED TECHNICAL METRICS');
    expect(deviceDetail).toContain('IP68 Submersible');

    // 2. single-artisan-craft: Warm ivory gold luxury atelier & 5-stage craftsmanship timeline
    const artisanHome = renderSite({ ...d, template: 'single-artisan-craft' }, opts);
    expect(artisanHome).toContain('THE ATELIER PROTOCOL');
    expect(artisanHome).toContain('The 5 Stages of Timeless Execution');
    expect(artisanHome).toContain('Certificate of Material Provenance');

    const artisanDetail = renderSite(
      { ...d, template: 'single-artisan-craft' },
      { ...opts, page: 'detail', productId: 'p-one' },
    );
    expect(artisanDetail).toContain('wr-detail-main-img');
    expect(artisanDetail).toContain('HAND-NUMBERED PIÈCE UNIQUE');
    expect(artisanDetail).toContain('Geneva Atelier');

    // 3. single-wellness-nordic: Sage & oat organic biophilic wellness & 24h circadian rhythm guide
    const wellnessHome = renderSite({ ...d, template: 'single-wellness-nordic' }, opts);
    expect(wellnessHome).toContain('One Device. Synchronized to Your Sun.');
    expect(wellnessHome).toContain('The 24h Rhythm');
    expect(wellnessHome).toContain('Scientifically Tested in Double-Blind Trials');

    const wellnessDetail = renderSite(
      { ...d, template: 'single-wellness-nordic' },
      { ...opts, page: 'detail', productId: 'p-one' },
    );
    expect(wellnessDetail).toContain('wr-detail-main-img');
    expect(wellnessDetail).toContain('CERTIFIED BIOPHILIC LIVING');
    expect(wellnessDetail).toContain('100% BPA-Free');

    // Verify all 3 single-product templates have completely distinct homepages
    const homes = [deviceHome, artisanHome, wellnessHome];
    const uniqueHomes = new Set(homes);
    expect(uniqueHomes.size).toBe(3);
  });
});
