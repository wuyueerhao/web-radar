import type { Product } from '../../shared/model';
import { isTypedMaterialsSource } from '../materials-typed';
import { esc, safeUrl, type ThemeContext } from './types';
import { getAboutHeadline, getAboutStoryParagraphs, parseAboutHighlights } from './aboutHelper';

export interface ThemedSingleProductItem {
  id: string;
  name: string;
  desc: string;
  badge: string;
  material: string;
  dimensions: string;
  tagline: string;
  img: string;
}

export const SINGLE_DEVICE_DEFAULT: ThemedSingleProductItem = {
  id: 'device-core',
  name: 'CyberKeynote Pro X1 Spatial Acoustic Terminal',
  desc: 'Aerospace-grade titanium unibody acoustic terminal with quad-core neural DSP, 0.12ms ultra-low latency, and 48-hour continuous battery endurance.',
  badge: 'Flagship Edition',
  material: 'Grade-5 Aerospace Titanium + Sapphire Glass Touch Surface',
  dimensions: '142 × 72 × 8.2 mm · 185g ultra-lightweight',
  tagline: 'Zero-Latency Spatial Audio Architecture for Next-Gen Creators',
  img: '/templates/senseng/products-1.jpg',
};

export const SINGLE_DEVICE_EDITIONS: ThemedSingleProductItem[] = [
  {
    id: 'device-core',
    name: 'CyberKeynote Pro X1 Spatial Acoustic Terminal',
    desc: 'Aerospace-grade titanium unibody acoustic terminal with quad-core neural DSP, 0.12ms ultra-low latency, and 48-hour continuous battery endurance.',
    badge: 'Flagship Edition',
    material: 'Grade-5 Aerospace Titanium + Sapphire Glass Touch Surface',
    dimensions: '142 × 72 × 8.2 mm · 185g ultra-lightweight',
    tagline: 'Zero-Latency Spatial Audio Architecture for Next-Gen Creators',
    img: '/templates/senseng/products-1.jpg',
  },
  {
    id: 'device-studio',
    name: 'CyberKeynote Studio Air Desk Monitor',
    desc: 'Near-field reference studio monitor featuring ceramic balanced armature transducers and adaptive room acoustic reflection compensation.',
    badge: 'Studio Edition',
    material: 'Anodized Billet Aluminum & Precision Acoustic Fabric',
    dimensions: '180 × 90 × 85 mm · 340g balanced desk footprint',
    tagline: 'Pure Uncolored Reference Sound for Master Audio Production',
    img: '/templates/senseng/products-2.jpg',
  },
  {
    id: 'device-haptic',
    name: 'CyberKeynote Ultra Tactile Haptic Controller',
    desc: 'Sub-millimeter gesture surface with linear resonant actuators delivering spatial force feedback and precision parameter automation.',
    badge: 'Creator Touch',
    material: 'Ceramic Micro-Bead Coated Glass & Magnesium Chassis',
    dimensions: '130 × 70 × 9.5 mm · 160g ergonomic handheld profile',
    tagline: 'Tactile Physicality Meets Infinite Digital Modulations',
    img: '/templates/senseng/products-3.jpg',
  },
  {
    id: 'device-compact',
    name: 'CyberKeynote Pure Resonance Compact Module',
    desc: 'Ultra-portable dual-driver audio interface with built-in 32-bit float recorder and hardware DSP voice isolation filters.',
    badge: 'Field Edition',
    material: 'Reinforced Carbon Composite & Silicone Impact Armor',
    dimensions: '110 × 60 × 12 mm · 145g all-weather enclosure',
    tagline: 'Studio-Grade Field Capture in Every Creative Environment',
    img: '/templates/senseng/products-4.jpg',
  },
  {
    id: 'device-dock',
    name: 'CyberKeynote MagLock Qi2 Induction Base',
    desc: 'Magnetic wireless induction dock with 15W rapid charging, balanced stereo XLR line outputs, and active Peltier thermal regulation.',
    badge: 'Docking Unit',
    material: 'Solid Milled Titanium Billets & Soft Silicone Pedestal',
    dimensions: '120 × 120 × 24 mm · 420g weighted desk anchor',
    tagline: 'Instant Zero-Cable Connection and Continuous Studio Power',
    img: '/templates/senseng/products-5.jpg',
  },
  {
    id: 'device-sensor',
    name: 'CyberKeynote Ambient Spectrum Sensor Hub',
    desc: 'Quad-microphone acoustic array that samples ambient SPL noise, reverberation time, and humidity to auto-tune frequency response.',
    badge: 'Telemetry Array',
    material: 'Electro-Polished Surgical Steel & Optical Prism Window',
    dimensions: '95 × 95 × 32 mm · 210g discrete placement',
    tagline: 'Live Room Calibration Powered by Micro-Sensory Intelligence',
    img: '/templates/senseng/products-6.jpg',
  },
  {
    id: 'device-pad',
    name: 'CyberKeynote Kinetic Precision Touchpad',
    desc: 'High-density multi-touch expressive pad designed for continuous spatial panning, filter sweeps, and multi-parameter modulation.',
    badge: 'Spatial Pad',
    material: 'Frosted Sapphire Crystal & Beveled Titanium Frame',
    dimensions: '150 × 100 × 7.5 mm · 220g sleek low-profile',
    tagline: 'Intuitive Spatial Modulation at the Touch of a Finger',
    img: '/templates/senseng/products-7.jpg',
  },
  {
    id: 'device-master',
    name: 'CyberKeynote Architect Master Station',
    desc: 'Centralized rack-mountable DSP host unit managing up to 16 synchronized acoustic terminals over low-latency ultra-wideband mesh.',
    badge: 'Enterprise Hub',
    material: '1U Aluminum Rack Chassis & Dual Redundant Power Rails',
    dimensions: '482 × 220 × 44 mm · 2.8kg enterprise rack standard',
    tagline: 'Orchestrate Massive Multi-Room Spatial Sound Installations',
    img: '/templates/senseng/products-8.jpg',
  },
];

export const SINGLE_ARTISAN_DEFAULT: ThemedSingleProductItem = {
  id: 'artisan-core',
  name: 'Atelier Horloger No. 01 Grand Complication',
  desc: 'Individually hand-numbered mechanical masterpiece forged from Swiss Damascus steel with hand-stitched vegetable-tanned Tuscan leather strap.',
  badge: 'Piece Unique · 001/500',
  material: 'Damascus Steel Case + Tuscan Full-Grain Leather + Double Sapphire Glass',
  dimensions: 'Case Diameter 40mm · 10.5mm Thickness · 50m Water Resistance',
  tagline: 'Hand-Calibrated Haute Horlogerie Born in Alpine Solitude',
  img: '/templates/senseng/products-2.jpg',
};

export const SINGLE_ARTISAN_EDITIONS: ThemedSingleProductItem[] = [
  {
    id: 'artisan-core',
    name: 'Atelier Horloger No. 01 Grand Complication',
    desc: 'Individually hand-numbered mechanical masterpiece forged from Swiss Damascus steel with hand-stitched vegetable-tanned Tuscan leather strap.',
    badge: 'Piece Unique · 001/500',
    material: 'Damascus Steel Case + Tuscan Full-Grain Leather + Double Sapphire Glass',
    dimensions: 'Case Diameter 40mm · 10.5mm Thickness · 50m Water Resistance',
    tagline: 'Hand-Calibrated Haute Horlogerie Born in Alpine Solitude',
    img: '/templates/senseng/products-1.jpg',
  },
  {
    id: 'artisan-rose',
    name: 'Atelier Horloger No. 02 Rose Gold Guilloché',
    desc: 'Hand-turned barleycorn guilloché dial with 18K solid rose gold case, blued Breguet hands, and hand-regulated column-wheel chronograph.',
    badge: 'Numbered Edition · 042/300',
    material: '18K 4N Rose Gold (750) Case & Silvered Solid Gold Dial',
    dimensions: 'Case Diameter 39mm · 9.8mm Ultra-Slim · 30m Water Resistance',
    tagline: 'The Resonant Warmth of Traditional Geneva Hand-Engraving',
    img: '/templates/senseng/products-2.jpg',
  },
  {
    id: 'artisan-platinum',
    name: 'Atelier Horloger No. 03 Platinum Tourbillon',
    desc: 'One-minute flying tourbillon carriage floating within a solid platinum 950 case, featuring hand-bevelled bridges and twin coaxial barrels.',
    badge: 'Haute Horlogerie · 008/100',
    material: 'Solid Platinum 950 Case & Black Polished Titanium Cage',
    dimensions: 'Case Diameter 41mm · 11.2mm Thickness · 50m Water Resistance',
    tagline: 'Defying Terrestrial Gravity with Micro-Mechanical Mastery',
    img: '/templates/senseng/products-3.jpg',
  },
  {
    id: 'artisan-skeleton',
    name: 'Atelier Horloger No. 04 Openworked Calibre',
    desc: 'Fully openworked architectural movement showing every tooth of the gear train, finished with 45-degree hand anglage and gentian wood polish.',
    badge: 'Squelette Guild · 015/250',
    material: 'Grade-5 Titanium Case & German Silver Mainplate',
    dimensions: 'Case Diameter 40.5mm · 10.0mm Thickness · 50m Water Resistance',
    tagline: 'Transparency and Light Revealing Every Master Artisan Hour',
    img: '/templates/senseng/products-4.jpg',
  },
  {
    id: 'artisan-enamel',
    name: 'Atelier Horloger No. 05 Grand Feu Enamel',
    desc: 'Pure snow-white Grand Feu enamel dial fired at 800°C over solid gold plate, paired with hand-painted Roman numerals and blued steel indicators.',
    badge: 'Métiers d’Art · 003/150',
    material: '18K White Gold Case & Grand Feu Vitreous Enamel',
    dimensions: 'Case Diameter 38.5mm · 9.2mm Slim · 30m Water Resistance',
    tagline: 'Imperishable Vitreous Enamel Crafted for Centuries to Come',
    img: '/templates/senseng/products-5.jpg',
  },
  {
    id: 'artisan-chronometre',
    name: 'Atelier Horloger No. 06 Observatory Chronomètre',
    desc: 'Calibrated to rigorous Geneva Observatory precision standards with free-sprung balance wheel, overcoil hairspring, and stop-seconds reset.',
    badge: 'Certified Chronomètre',
    material: 'Cryo-Treated 316L Surgical Steel Case & Opaline Dial',
    dimensions: 'Case Diameter 39.5mm · 10.2mm Thickness · 100m Water Resistance',
    tagline: 'Scientific Timekeeping Honored with Traditional Swiss Guild Discipline',
    img: '/templates/senseng/products-6.jpg',
  },
  {
    id: 'artisan-perpetual',
    name: 'Atelier Horloger No. 07 Perpetual Calendar',
    desc: 'Instantaneous perpetual calendar with moonphase aperture made from aventurine glass and hand-carved miniature white gold cratered moon.',
    badge: 'Grand Complication · 005/75',
    material: '18K Honey Gold Case & Aventurine Starfield Dial',
    dimensions: 'Case Diameter 41.5mm · 12.0mm Thickness · 30m Water Resistance',
    tagline: 'Tracking the Celestial Dance of Moon and Leap Year Cycles',
    img: '/templates/senseng/products-7.jpg',
  },
  {
    id: 'artisan-vault',
    name: 'Atelier Horloger Cedar Presentation Chest',
    desc: 'Hand-joined alpine cedar chest with full-grain leather interior compartments, micro-fiber loupe, spare calfskin strap, and brass key.',
    badge: 'Artisan Coffer',
    material: 'Old-Growth Alpine Cedarwood & Brushed Antique Brass',
    dimensions: '320 × 240 × 140 mm · 2.4kg heirloom preservation safe',
    tagline: 'The Reverent Resting Place for a Lifetime Horological Heirloom',
    img: '/templates/senseng/products-8.jpg',
  },
];

export const SINGLE_WELLNESS_DEFAULT: ThemedSingleProductItem = {
  id: 'wellness-core',
  name: 'Nordic Serene Mindful Circadian Lamp & Diffuser',
  desc: 'Biophilic stone-composite ambient diffuser with full-spectrum circadian light rhythm and 100% natural cold-press botanical micro-mist.',
  badge: 'Clinically Proven',
  material: 'Recycled Cast Stone + Brushed Organic Aluminum + FSC Birch Wood',
  dimensions: '160 × 160 × 210 mm · 850g weighted stability',
  tagline: 'Harmonize Your Circadian Rhythm with Calming Alpine Aromatherapy',
  img: '/templates/senseng/products-3.jpg',
};

export const SINGLE_WELLNESS_EDITIONS: ThemedSingleProductItem[] = [
  {
    id: 'wellness-core',
    name: 'Nordic Serene Mindful Circadian Lamp & Diffuser',
    desc: 'Biophilic stone-composite ambient diffuser with full-spectrum circadian light rhythm and 100% natural cold-press botanical micro-mist.',
    badge: 'Clinically Proven',
    material: 'Recycled Cast Stone + Brushed Organic Aluminum + FSC Birch Wood',
    dimensions: '160 × 160 × 210 mm · 850g weighted stability',
    tagline: 'Harmonize Your Circadian Rhythm with Calming Alpine Aromatherapy',
    img: '/templates/senseng/products-1.jpg',
  },
  {
    id: 'wellness-dawn',
    name: 'Nordic Serene Sunrise Awakening Beacon',
    desc: 'Gentle sunrise dawn simulator featuring 480nm blue-enriched illumination that prompts natural cortisol secretion and clear mental focus.',
    badge: 'Morning Protocol',
    material: 'Cast Mineral Ceramic & Reclaimed Nordic Ash Wood',
    dimensions: '140 × 140 × 190 mm · 720g bedside format',
    tagline: 'Wake Rested and Alert without Harsh Sudden Alarm Shocks',
    img: '/templates/senseng/products-2.jpg',
  },
  {
    id: 'wellness-dusk',
    name: 'Nordic Serene Melatonin Sanctuary Lamp',
    desc: 'Zero-blue light bedtime lantern emitting 1800K warm amber candlelight tones that safeguard natural evening melatonin synthesis.',
    badge: 'Sleep Support',
    material: 'Mouth-Blown Opaline Glass & Oiled Oak Timber',
    dimensions: '150 × 150 × 200 mm · 680g bedroom ambient',
    tagline: 'Soothing Evening Illumination for Seamless Transition into Sleep',
    img: '/templates/senseng/products-3.jpg',
  },
  {
    id: 'wellness-mist',
    name: 'Nordic Serene Cold-Press Micro-Nebulizer',
    desc: 'Waterless acoustic nebulizer that atomizes 100% pure botanical essential oils into 5-micron dry aerosol mist without heat or dilution.',
    badge: 'Pure Aromatherapy',
    material: 'Brushed Recycled Aluminum & Borosilicate Glass Chamber',
    dimensions: '100 × 100 × 220 mm · 560g precision diffuser',
    tagline: 'Deliver Therapeutic Forest Phytoncides Straight into Your Living Air',
    img: '/templates/senseng/products-4.jpg',
  },
  {
    id: 'wellness-stone',
    name: 'Nordic Serene Tactile Meditation Stone',
    desc: 'Warm ergonomic handheld resonance stone providing rhythmic haptic pulse guidance for box breathing, mindfulness, and anxiety relief.',
    badge: 'Touch Calming',
    material: 'Honed Nordic Granite & Gentle Soft-Touch Silicone Edge',
    dimensions: '85 × 65 × 28 mm · 210g comforting palm weight',
    tagline: 'A Grounding Physical Anchor for Calming Sensory Overload',
    img: '/templates/senseng/products-5.jpg',
  },
  {
    id: 'wellness-oils',
    name: 'Nordic Serene Circadian Botanical Trio',
    desc: 'Three cold-pressed organic botanical blends formulated for 24-hour physiological rhythm: Morning Pine, Focus Bergamot, and Evening Lavender.',
    badge: 'Certified Organic',
    material: 'Miron Violet Glass Bottles & FSC Recycled Paper Box',
    dimensions: '3 × 15ml Therapeutic Grade Essential Oil Droppers',
    tagline: '100% Clean Wild-Harvested Botanicals with Zero Synthetic Odors',
    img: '/templates/senseng/products-6.jpg',
  },
  {
    id: 'wellness-desk',
    name: 'Nordic Serene Compact Focus Ambient Bar',
    desc: 'Non-glare asymmetric task lamp that floods desk workspaces with high-CRI (98 Ra) daylight-balanced illumination to eliminate visual strain.',
    badge: 'Ergonomic Light',
    material: 'Matte White Powder-Coated Aluminum & FSC Birch Accents',
    dimensions: '380 × 80 × 320 mm · 980g stable base clamp',
    tagline: 'Sustained Afternoon Mental Clarity Guided by Full-Spectrum Daylight',
    img: '/templates/senseng/products-7.jpg',
  },
  {
    id: 'wellness-bundle',
    name: 'Nordic Serene Master Circadian Sanctuary Suite',
    desc: 'Complete living space wellness ecosystem containing the flagship circadian diffuser, morning beacon, evening amber lamp, and 6 oil vials.',
    badge: 'Complete Ritual Kit',
    material: 'Cast Stone, Opaline Glass, Ash Wood & Linen Storage Case',
    dimensions: '420 × 320 × 220 mm · 4.8kg curated wellness sanctuary',
    tagline: 'Transform Your Home into a Pure Scandinavian Restorative Retreat',
    img: '/templates/senseng/products-8.jpg',
  },
];

export function renderSingleProductPage(ctx: ThemeContext, template: string): string {
  if (template === 'single-device-showcase') {
    return renderSingleDevicePage(ctx);
  }
  if (template === 'single-artisan-craft') {
    return renderSingleArtisanPage(ctx);
  }
  return renderSingleWellnessPage(ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SINGLE DEVICE SHOWCASE (Keynote Engineering Lab & Precision Bento)
// ─────────────────────────────────────────────────────────────────────────────

function renderSingleDevicePage(ctx: ThemeContext): string {
  const { draft, options, path, navAttrs, ui } = ctx;
  const page = options.page || 'home';
  const company = draft.company;
  const brandName = company.name || 'CYBERKEYNOTE';

  const products = draft.products.length > 0 ? draft.products : SINGLE_DEVICE_EDITIONS.map(e => ({
    id: e.id,
    name: e.name,
    description: e.desc,
    material: e.material,
    dimensions: e.dimensions,
    tagline: e.tagline,
    imageAssetId: undefined,
  } as Product));

  const primary = products[0] || ({
    id: SINGLE_DEVICE_DEFAULT.id,
    name: SINGLE_DEVICE_DEFAULT.name,
    description: SINGLE_DEVICE_DEFAULT.desc,
    material: SINGLE_DEVICE_DEFAULT.material,
    dimensions: SINGLE_DEVICE_DEFAULT.dimensions,
    tagline: SINGLE_DEVICE_DEFAULT.tagline,
  } as Product);

  const mainProduct = products.find((p) => p.id === options.productId) || primary;
  const mainImg = mainProduct.imageAssetId
    ? ctx.asset(mainProduct.imageAssetId)
    : SINGLE_DEVICE_DEFAULT.img;

  const headerHtml = `
    <header style="position:sticky;top:0;z-index:90;background:rgba(255,255,255,0.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(226,232,240,0.9);padding:16px 24px;">
      <div class="sd-header-inner" style="max-width:1320px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:20px;">
        <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg, #0284c7 0%, #2563eb 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(2,132,199,0.25);">
            <span style="color:#ffffff;font-size:1.15rem;font-weight:900;font-family:monospace;">◈</span>
          </div>
          <div>
            <div style="font-size:1.05rem;font-weight:900;letter-spacing:0.06em;color:#0f172a;text-transform:uppercase;font-family:system-ui,-apple-system,sans-serif;">${esc(brandName)}</div>
            <div style="font-size:0.68rem;letter-spacing:0.16em;color:#0284c7;text-transform:uppercase;font-family:monospace;font-weight:700;">SYSTEM // ONLINE</div>
          </div>
        </a>
        <nav class="sd-nav" style="display:flex;align-items:center;gap:28px;">
          <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;color:#334155;font-size:0.86rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">${esc(ui.home)}</a>
          <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;color:#334155;font-size:0.86rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Editions</a>
          <a href="${path('about/index.html')}" ${navAttrs('about')} style="text-decoration:none;color:#334155;font-size:0.86rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">${esc(ui.about)}</a>
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;color:#334155;font-size:0.86rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">${esc(ui.contact)}</a>
        </nav>
        <div style="display:flex;align-items:center;gap:12px;">
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;padding:10px 22px;border-radius:8px;background:linear-gradient(135deg, #0284c7, #2563eb);color:#ffffff;font-size:0.84rem;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;box-shadow:0 4px 16px rgba(2,132,199,0.3);">
            Pre-Order Unit ↗
          </a>
        </div>
      </div>
    </header>
  `;

  const footerHtml = `
    <footer style="background:#f1f5f9;color:#475569;padding:70px 24px 36px;border-top:1px solid #e2e8f0;">
      <div style="max-width:1320px;margin:0 auto;">
        <div class="sd-footer-grid" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:48px;">
          <div>
            <div style="font-size:1.15rem;font-weight:900;color:#0f172a;letter-spacing:0.06em;margin-bottom:12px;text-transform:uppercase;">${esc(brandName)}</div>
            <p style="font-size:0.88rem;line-height:1.65;color:#475569;max-width:320px;">
              ${esc(company.description || 'Pioneering bionic hardware engineering and zero-latency audio architecture for visionary creators worldwide.')}
            </p>
            <div style="display:flex;gap:12px;margin-top:18px;">${ctx.socials}</div>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.12em;color:#0284c7;text-transform:uppercase;margin-bottom:14px;font-family:monospace;">// Navigation</div>
            <a href="${path('index.html')}" ${navAttrs('home')} style="display:block;color:#475569;text-decoration:none;font-size:0.85rem;padding:4px 0;font-weight:500;">${esc(ui.home)}</a>
            <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="display:block;color:#475569;text-decoration:none;font-size:0.85rem;padding:4px 0;font-weight:500;">Hardware Editions</a>
            <a href="${path('about/index.html')}" ${navAttrs('about')} style="display:block;color:#475569;text-decoration:none;font-size:0.85rem;padding:4px 0;font-weight:500;">Engineering Manifesto</a>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.12em;color:#0284c7;text-transform:uppercase;margin-bottom:14px;font-family:monospace;">// Support</div>
            <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="display:block;color:#475569;text-decoration:none;font-size:0.85rem;padding:4px 0;font-weight:500;">Developer & B2B Inquiry</a>
            <a href="mailto:${esc(company.email)}" style="display:block;color:#475569;text-decoration:none;font-size:0.85rem;padding:4px 0;font-weight:500;">${esc(company.email)}</a>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.12em;color:#0284c7;text-transform:uppercase;margin-bottom:14px;font-family:monospace;">// Global HQ</div>
            <p style="font-size:0.85rem;color:#475569;line-height:1.55;">${esc(company.address || 'Tokyo · San Francisco · Munich R&D Labs')}</p>
          </div>
        </div>
        <div style="border-top:1px solid #cbd5e1;padding-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:#64748b;font-family:monospace;">
          <span>&copy; ${new Date().getUTCFullYear()} ${esc(brandName)}. ALL SYSTEMS NORMAL.</span>
          <div class="languages" style="display:flex;gap:8px;">${ctx.languageLinks}</div>
        </div>
      </div>
    </footer>
  `;

  let mainHtml = '';

  if (page === 'home') {
    mainHtml = `
      <main style="background:#f8fafc;color:#0f172a;overflow:hidden;">
        <!-- HERO KEYNOTE STAGE -->
        <section style="position:relative;padding:80px 24px 90px;min-height:90vh;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e2e8f0;background-image:radial-gradient(rgba(148,163,184,0.18) 1px, transparent 1px);background-size:32px 32px;">
          <div style="position:absolute;top:25%;left:50%;transform:translate(-50%,-50%);width:700px;height:700px;border-radius:50%;background:radial-gradient(circle, rgba(2,132,199,0.09) 0%, rgba(99,102,241,0.03) 50%, transparent 70%);pointer-events:none;filter:blur(50px);"></div>

          <div class="sd-hero-grid" style="max-width:1320px;width:100%;margin:0 auto;display:grid;grid-template-columns:1.05fr 0.95fr;gap:60px;align-items:center;position:relative;">
            <div>
              <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:999px;background:#f0f9ff;border:1px solid #bae6fd;color:#0284c7;font-size:0.76rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;font-family:monospace;margin-bottom:24px;">
                <span style="width:7px;height:7px;border-radius:50%;background:#0284c7;box-shadow:0 0 8px #0284c7;"></span>
                Flagship Single-Product Keynote
              </div>
              <h1 style="font-size:clamp(2.4rem, 5vw, 3.8rem);font-weight:900;line-height:1.08;letter-spacing:-0.03em;margin:0 0 20px;color:#0f172a;">
                ${esc(draft.copy[ctx.lang]?.headline || primary.name)}
              </h1>
              <p style="font-size:1.15rem;line-height:1.65;color:#475569;margin:0 0 32px;max-width:540px;">
                ${esc(draft.copy[ctx.lang]?.subtitle || primary.description)}
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:48px;">
                <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;padding:15px 32px;border-radius:8px;background:linear-gradient(135deg, #0284c7, #2563eb);color:#ffffff;font-size:0.95rem;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;box-shadow:0 6px 20px rgba(2,132,199,0.3);">
                  Configure & Order ↗
                </a>
                <a href="#architecture" style="text-decoration:none;padding:15px 28px;border-radius:8px;background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;font-size:0.95rem;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                  Explore Architecture ↓
                </a>
              </div>
              <!-- Telemetry indicators -->
              <div class="sd-hero-stats" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;padding-top:24px;border-top:1px solid #e2e8f0;">
                <div>
                  <div style="font-size:1.45rem;font-weight:900;color:#0284c7;font-family:monospace;">0.12ms</div>
                  <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:600;margin-top:2px;">Ultra-Low Latency</div>
                </div>
                <div>
                  <div style="font-size:1.45rem;font-weight:900;color:#0f172a;font-family:monospace;">Titanium</div>
                  <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:600;margin-top:2px;">Aerospace Unibody</div>
                </div>
                <div>
                  <div style="font-size:1.45rem;font-weight:900;color:#0284c7;font-family:monospace;">48 Hrs</div>
                  <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:600;margin-top:2px;">Continuous Power</div>
                </div>
              </div>
            </div>

            <!-- Pedestal Visual Stage -->
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;width:440px;height:440px;border-radius:50%;border:1px dashed rgba(2,132,199,0.25);animation:wrSpin 30s linear infinite;"></div>
              <div style="position:absolute;width:520px;height:520px;border-radius:50%;border:1px solid rgba(226,232,240,0.8);"></div>
              <div style="position:relative;background:#ffffff;padding:40px;border-radius:28px;border:1px solid #e2e8f0;box-shadow:0 25px 60px -15px rgba(15,23,42,0.1), 0 0 30px rgba(2,132,199,0.06);width:100%;max-width:440px;">
                <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 15px 30px rgba(15,23,42,0.1));">

                <div style="position:absolute;top:20px;left:-20px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid #bae6fd;border-radius:8px;padding:8px 14px;font-family:monospace;font-size:0.74rem;font-weight:700;color:#0284c7;box-shadow:0 6px 20px rgba(15,23,42,0.08);">
                  CORE // 9.8 TFLOPS DSP
                </div>
                <div style="position:absolute;bottom:30px;right:-20px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid #c7d2fe;border-radius:8px;padding:8px 14px;font-family:monospace;font-size:0.74rem;font-weight:700;color:#4f46e5;box-shadow:0 6px 20px rgba(15,23,42,0.08);">
                  IP68 // 50M SUBMERSIBLE
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- HORIZONTAL TICKER -->
        <section style="background:#ffffff;border-bottom:1px solid #e2e8f0;padding:18px 24px;font-family:monospace;font-size:0.8rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">
          <div style="max-width:1320px;margin:0 auto;display:flex;justify-content:space-between;flex-wrap:wrap;gap:20px;">
            <span><span style="color:#0284c7;">◈</span> ACOUSTIC RESOLUTION: 384kHz / 32-BIT</span>
            <span><span style="color:#0284c7;">◈</span> THD+N DISTORTION: &lt; 0.0003%</span>
            <span><span style="color:#0284c7;">◈</span> BLUETOOTH 5.4 + ULTRA-WIDEBAND</span>
            <span><span style="color:#0284c7;">◈</span> AIR-DROP READY</span>
          </div>
        </section>

        <!-- ARCHITECTURE BENTO GRID -->
        <section id="architecture" style="background:#f8fafc;padding:90px 24px;max-width:1320px;margin:0 auto;">
          <div style="text-align:center;max-width:680px;margin:0 auto 60px;">
            <div style="color:#0284c7;font-family:monospace;font-size:0.8rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">// SYSTEM ARCHITECTURE</div>
            <h2 style="font-size:2.4rem;font-weight:900;color:#0f172a;letter-spacing:-0.02em;margin:0 0 16px;">Engineered to the Atomic Micron</h2>
            <p style="color:#475569;font-size:1.05rem;line-height:1.6;">Every millimeter of internal volume is calibrated to eliminate thermal dissipation constraints and maximize harmonic resonance.</p>
          </div>

          <div class="sd-bento-top" style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:24px;margin-bottom:24px;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:36px;position:relative;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.03);">
              <div style="position:absolute;top:0;right:0;width:240px;height:240px;background:radial-gradient(circle, rgba(2,132,199,0.08) 0%, transparent 70%);pointer-events:none;"></div>
              <div style="font-size:0.75rem;color:#0284c7;font-family:monospace;font-weight:700;margin-bottom:12px;">MODULE 01 // COMPUTATIONAL ACOUSTICS</div>
              <h3 style="font-size:1.5rem;font-weight:800;color:#0f172a;margin:0 0 12px;">Neural Acoustic DSP Engine</h3>
              <p style="color:#475569;font-size:0.95rem;line-height:1.6;margin-bottom:24px;">Real-time continuous 192-point acoustic calibration that adapts to room geometry, temperature, and ambient noise profiles within 2 milliseconds.</p>
              <div style="height:100px;background:#f1f5f9;border-radius:12px;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;gap:4px;padding:0 20px;">
                ${Array.from({ length: 32 }, (_, i) => `<div style="flex:1;background:linear-gradient(to top, #0284c7, #3b82f6);height:${Math.sin(i * 0.4) * 35 + 45}%;border-radius:2px;opacity:0.9;"></div>`).join('')}
              </div>
            </div>

            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:36px;box-shadow:0 10px 30px rgba(15,23,42,0.03);">
              <div style="font-size:0.75rem;color:#4f46e5;font-family:monospace;font-weight:700;margin-bottom:12px;">MODULE 02 // CHASSIS ALLOY</div>
              <h3 style="font-size:1.5rem;font-weight:800;color:#0f172a;margin:0 0 12px;">Grade-5 Titanium Exoskeleton</h3>
              <p style="color:#475569;font-size:0.95rem;line-height:1.6;">Precision CNC milled from solid aerospace titanium billets. 40% lighter than surgical steel, with zero flex and zero acoustic coloration.</p>
              <div style="margin-top:20px;padding:14px 18px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;font-family:monospace;font-size:0.8rem;color:#0284c7;font-weight:700;">
                SPEC: Ti-6Al-4V · DENSITY 4.43 g/cm³ · TENSILE 950 MPa
              </div>
            </div>
          </div>

          <div class="sd-bento-row" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:24px;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,0.03);">
              <div style="font-size:1.8rem;margin-bottom:12px;">⚡</div>
              <h4 style="font-size:1.15rem;font-weight:800;color:#0f172a;margin:0 0 8px;">Magnetic MagLock Dock</h4>
              <p style="color:#475569;font-size:0.88rem;line-height:1.5;">Snaps onto any metallic surface or desktop pedestal with 15W Qi2 wireless induction charging.</p>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,0.03);">
              <div style="font-size:1.8rem;margin-bottom:12px;">🔒</div>
              <h4 style="font-size:1.15rem;font-weight:800;color:#0f172a;margin:0 0 8px;">End-to-End Privacy Enclave</h4>
              <p style="color:#475569;font-size:0.88rem;line-height:1.5;">Local on-device audio telemetry processing. No voice or acoustic data ever transmits over external networks.</p>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,0.03);">
              <div style="font-size:1.8rem;margin-bottom:12px;">🛡️</div>
              <h4 style="font-size:1.15rem;font-weight:800;color:#0f172a;margin:0 0 8px;">5-Year Global Warranty</h4>
              <p style="color:#475569;font-size:0.88rem;line-height:1.5;">Express replacement program and dedicated hardware concierge for certified enterprise deployments.</p>
            </div>
          </div>
        </section>

        <!-- EXPLODED LAYER BREAKDOWN -->
        <section style="background:#ffffff;padding:90px 24px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
          <div class="sd-bento-row2" style="max-width:1320px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
            <div>
              <div style="color:#0284c7;font-family:monospace;font-size:0.8rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;">// EXPLODED ANATOMY</div>
              <h2 style="font-size:2.2rem;font-weight:900;color:#0f172a;margin:0 0 20px;">Four Layers of Pure Acoustic Precision</h2>
              <p style="color:#475569;font-size:1rem;line-height:1.6;margin-bottom:32px;">Every component is bonded with micro-tolerances under 5 microns, delivering uncompromised acoustic fidelity.</p>

              <div style="display:flex;flex-direction:column;gap:16px;">
                <div style="padding:16px 20px;border-left:4px solid #0284c7;background:#f8fafc;border-radius:0 12px 12px 0;border:1px solid #e2e8f0;border-left-width:4px;">
                  <div style="font-size:0.8rem;color:#0284c7;font-family:monospace;font-weight:700;">LAYER 01</div>
                  <div style="font-weight:800;font-size:1rem;color:#0f172a;margin:2px 0;">Sapphire Crystal Capacitive Matrix</div>
                  <div style="font-size:0.84rem;color:#64748b;">Scratch-proof optical grade sapphire with sub-millimeter gesture sensitivity.</div>
                </div>
                <div style="padding:16px 20px;border-left:4px solid #2563eb;background:#f8fafc;border-radius:0 12px 12px 0;border:1px solid #e2e8f0;border-left-width:4px;">
                  <div style="font-size:0.8rem;color:#2563eb;font-family:monospace;font-weight:700;">LAYER 02</div>
                  <div style="font-weight:800;font-size:1rem;color:#0f172a;margin:2px 0;">Quad-Core Neural Audio Processor</div>
                  <div style="font-size:0.84rem;color:#64748b;">55nm ultra-low-power silicon delivering 12-channel real-time spatial synthesis.</div>
                </div>
                <div style="padding:16px 20px;border-left:4px solid #7c3aed;background:#f8fafc;border-radius:0 12px 12px 0;border:1px solid #e2e8f0;border-left-width:4px;">
                  <div style="font-size:0.8rem;color:#7c3aed;font-family:monospace;font-weight:700;">LAYER 03</div>
                  <div style="font-weight:800;font-size:1rem;color:#0f172a;margin:2px 0;">Neodymium N52 Magnetic Flux Motor</div>
                  <div style="font-size:0.84rem;color:#64748b;">Highest flux density permanent magnet driving a carbon-nanotube composite dome.</div>
                </div>
                <div style="padding:16px 20px;border-left:4px solid #059669;background:#f8fafc;border-radius:0 12px 12px 0;border:1px solid #e2e8f0;border-left-width:4px;">
                  <div style="font-size:0.8rem;color:#059669;font-family:monospace;font-weight:700;">LAYER 04</div>
                  <div style="font-weight:800;font-size:1rem;color:#0f172a;margin:2px 0;">CNC Resonant Titanium Back-Chamber</div>
                  <div style="font-size:0.84rem;color:#64748b;">Acoustically tuned waveguide chamber completely preventing back-wave interference.</div>
                </div>
              </div>
            </div>

            <div style="text-align:center;">
              <img src="${esc(mainImg)}" alt="Exploded Architecture" style="width:100%;max-width:480px;filter:drop-shadow(0 20px 40px rgba(15,23,42,0.12));">
            </div>
          </div>
        </section>

        <!-- HARDWARE COMPARISON MATRIX TABLE -->
        <section style="background:#f8fafc;padding:90px 24px;border-bottom:1px solid #e2e8f0;">
          <div style="max-width:1100px;margin:0 auto;">
            <div style="text-align:center;max-width:680px;margin:0 auto 48px;">
              <div style="color:#0284c7;font-family:monospace;font-size:0.8rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">// BENCHMARK MATRIX</div>
              <h2 style="font-size:2.2rem;font-weight:900;color:#0f172a;margin:0 0 12px;">Laboratory Verification Comparison</h2>
              <p style="color:#475569;font-size:1rem;">Certified performance parameters measured under standard laboratory conditions.</p>
            </div>

            <div class="wr-single-table-scroll" role="region" aria-label="Hardware specification comparison" tabindex="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow-x:auto;box-shadow:0 10px 30px rgba(15,23,42,0.04);">
              <table style="width:100%;border-collapse:collapse;font-size:0.92rem;text-align:left;">
                <thead>
                  <tr style="background:#f1f5f9;border-bottom:1px solid #e2e8f0;color:#334155;font-family:monospace;font-size:0.82rem;">
                    <th style="padding:18px 24px;">HARDWARE SPECIFICATION</th>
                    <th style="padding:18px 24px;color:#0284c7;">PRO X1 FLAGSHIP</th>
                    <th style="padding:18px 24px;">STUDIO AIR</th>
                    <th style="padding:18px 24px;">COMPACT FIELD</th>
                  </tr>
                </thead>
                <tbody style="color:#334155;">
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:18px 24px;font-weight:700;color:#0f172a;">Transmission Latency</td>
                    <td style="padding:18px 24px;font-family:monospace;font-weight:900;color:#0284c7;">0.12 ms UWB</td>
                    <td style="padding:18px 24px;font-family:monospace;">0.85 ms Wi-Fi 7</td>
                    <td style="padding:18px 24px;font-family:monospace;">1.20 ms BT 5.4</td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:18px 24px;font-weight:700;color:#0f172a;">Enclosure Material</td>
                    <td style="padding:18px 24px;font-weight:600;">Grade-5 Titanium Ti-6Al-4V</td>
                    <td style="padding:18px 24px;">Milled 6061 Billet Aluminum</td>
                    <td style="padding:18px 24px;">Impact Carbon Polymer</td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:18px 24px;font-weight:700;color:#0f172a;">Acoustic Dynamic Range</td>
                    <td style="padding:18px 24px;font-family:monospace;font-weight:900;color:#0284c7;">134 dB SNR</td>
                    <td style="padding:18px 24px;font-family:monospace;">126 dB SNR</td>
                    <td style="padding:18px 24px;font-family:monospace;">118 dB SNR</td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:18px 24px;font-weight:700;color:#0f172a;">Battery Continuous Runtime</td>
                    <td style="padding:18px 24px;font-family:monospace;font-weight:900;color:#0284c7;">48 Hours LiFePO4</td>
                    <td style="padding:18px 24px;font-family:monospace;">Desk Powered</td>
                    <td style="padding:18px 24px;font-family:monospace;">24 Hours Li-Ion</td>
                  </tr>
                  <tr>
                    <td style="padding:18px 24px;font-weight:700;color:#0f172a;">Ingress Water Rating</td>
                    <td style="padding:18px 24px;font-family:monospace;font-weight:900;color:#0284c7;">IP68 Submersible (50m)</td>
                    <td style="padding:18px 24px;font-family:monospace;">IP52 Splashproof</td>
                    <td style="padding:18px 24px;font-family:monospace;">IP67 Weatherproof</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- SINGLE PRODUCT PACKAGE CONFIGURATOR -->
        <section style="padding:90px 24px;max-width:1320px;margin:0 auto;">
          <div style="text-align:center;max-width:680px;margin:0 auto 60px;">
            <div style="color:#0284c7;font-family:monospace;font-size:0.8rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">// ORDER CONFIGURATIONS</div>
            <h2 style="font-size:2.4rem;font-weight:900;color:#0f172a;letter-spacing:-0.02em;margin:0 0 16px;">Select Your Production Tier</h2>
            <p style="color:#475569;font-size:1.05rem;line-height:1.6;">Direct factory allocation with global expedited delivery and dedicated developer SDK access.</p>
          </div>

          <div class="sd-layers-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:28px;">
            <!-- Tier 1 -->
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:36px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 24px rgba(15,23,42,0.03);">
              <div>
                <div style="font-size:0.8rem;font-family:monospace;color:#64748b;font-weight:700;margin-bottom:8px;">TIER 01 // ESSENTIALS</div>
                <h3 style="font-size:1.4rem;font-weight:800;color:#0f172a;margin:0 0 12px;">Standard Device Kit</h3>
                <div style="font-size:2.2rem;font-weight:900;color:#0f172a;margin-bottom:20px;">$499 <span style="font-size:0.85rem;color:#64748b;font-weight:500;">/ unit</span></div>
                <ul style="padding-left:18px;color:#475569;font-size:0.9rem;line-height:1.8;margin:0 0 28px;">
                  <li>Flagship Titanium Hardware Terminal</li>
                  <li>Braided Kevlar USB-C Quick Cable (2m)</li>
                  <li>Standard Protective Microfiber Sleeve</li>
                  <li>2-Year Global Hardware Warranty</li>
                </ul>
              </div>
              <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-align:center;text-decoration:none;padding:14px;border-radius:8px;background:#f8fafc;color:#0f172a;font-size:0.88rem;font-weight:700;border:1px solid #cbd5e1;">
                Inquire Tier 1
              </a>
            </div>

            <!-- Tier 2 (Featured) -->
            <div style="background:#ffffff;border:2px solid #0284c7;border-radius:20px;padding:36px;display:flex;flex-direction:column;justify-content:space-between;position:relative;box-shadow:0 16px 40px rgba(2,132,199,0.12);">
              <div style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:#0284c7;color:#ffffff;font-size:0.72rem;font-weight:900;padding:4px 16px;border-radius:999px;font-family:monospace;letter-spacing:0.08em;">
                POPULAR CHOICE
              </div>
              <div>
                <div style="font-size:0.8rem;font-family:monospace;color:#0284c7;font-weight:700;margin-bottom:8px;">TIER 02 // CREATOR STUDIO</div>
                <h3 style="font-size:1.4rem;font-weight:800;color:#0f172a;margin:0 0 12px;">Studio Creator Bundle</h3>
                <div style="font-size:2.2rem;font-weight:900;color:#0284c7;margin-bottom:20px;">$699 <span style="font-size:0.85rem;color:#64748b;font-weight:500;">/ unit</span></div>
                <ul style="padding-left:18px;color:#334155;font-size:0.9rem;line-height:1.8;margin:0 0 28px;">
                  <li>Flagship Titanium Hardware Terminal</li>
                  <li>Magnetic MagLock 15W Qi2 Desktop Dock</li>
                  <li>Milled Aluminum Hard Travel Case</li>
                  <li>Audio Developer API & Python SDK Access</li>
                  <li>3-Year Express Replacement Warranty</li>
                </ul>
              </div>
              <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-align:center;text-decoration:none;padding:14px;border-radius:8px;background:linear-gradient(135deg, #0284c7, #2563eb);color:#ffffff;font-size:0.88rem;font-weight:800;letter-spacing:0.04em;box-shadow:0 4px 16px rgba(2,132,199,0.3);">
                Reserve Studio Bundle ↗
              </a>
            </div>

            <!-- Tier 3 -->
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:36px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 24px rgba(15,23,42,0.03);">
              <div>
                <div style="font-size:0.8rem;font-family:monospace;color:#64748b;font-weight:700;margin-bottom:8px;">TIER 03 // COLLECTOR</div>
                <h3 style="font-size:1.4rem;font-weight:800;color:#0f172a;margin:0 0 12px;">Founder Collector Edition</h3>
                <div style="font-size:2.2rem;font-weight:900;color:#0f172a;margin-bottom:20px;">$1,199 <span style="font-size:0.85rem;color:#64748b;font-weight:500;">/ unit</span></div>
                <ul style="padding-left:18px;color:#475569;font-size:0.9rem;line-height:1.8;margin:0 0 28px;">
                  <li>Limited Serialized Run (001 - 500)</li>
                  <li>Custom Laser Engraved Serial & Call-Sign</li>
                  <li>Pelican Storm Military Waterproof Vault Case</li>
                  <li>Lifetime Hardware Concierge & Direct Lab Support</li>
                  <li>VIP Invitation to Annual Keynote Labs</li>
                </ul>
              </div>
              <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-align:center;text-decoration:none;padding:14px;border-radius:8px;background:#f8fafc;color:#0f172a;font-size:0.88rem;font-weight:700;border:1px solid #cbd5e1;">
                Inquire Collector Tier
              </a>
            </div>
          </div>
        </section>
      </main>
    `;
  } else if (page === 'catalog') {
    // ── CATALOG: Hardware Ecosystem & Editions Bento ──
    mainHtml = `
      <main style="background:#f8fafc;color:#0f172a;padding:80px 24px;">
        <div style="max-width:1320px;margin:0 auto;">
          <!-- Lineup Hero Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:20px;margin-bottom:48px;padding-bottom:32px;border-bottom:1px solid #e2e8f0;">
            <div>
              <div style="color:#0284c7;font-family:monospace;font-size:0.8rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">// HARDWARE LINEUP & ECOSYSTEM</div>
              <h1 style="font-size:2.6rem;font-weight:900;color:#0f172a;margin:0 0 12px;">Hardware Editions & Modular Components</h1>
              <p style="color:#475569;font-size:1.05rem;max-width:640px;margin:0;">Every unit in the lineup shares our core ultra-low latency architecture, calibrated for modular interconnection.</p>
            </div>
            <!-- Category Filter Badges -->
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <span style="padding:8px 16px;border-radius:999px;background:#0284c7;color:#ffffff;font-size:0.8rem;font-weight:700;font-family:monospace;">ALL PLATFORMS (8)</span>
              <span style="padding:8px 16px;border-radius:999px;background:#ffffff;border:1px solid #cbd5e1;color:#475569;font-size:0.8rem;font-weight:600;font-family:monospace;">TERMINALS</span>
              <span style="padding:8px 16px;border-radius:999px;background:#ffffff;border:1px solid #cbd5e1;color:#475569;font-size:0.8rem;font-weight:600;font-family:monospace;">MODULES</span>
            </div>
          </div>

          <!-- Featured Platform Callout -->
          <div class="wr-single-content-grid" style="background:linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);border:1px solid #bae6fd;border-radius:24px;padding:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;margin-bottom:48px;box-shadow:0 10px 30px rgba(2,132,199,0.06);">
            <div>
              <div style="font-size:0.75rem;color:#0284c7;font-family:monospace;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">FEATURED FLAGSHIP ARCHITECTURE</div>
              <h2 style="font-size:2rem;font-weight:900;color:#0f172a;margin:0 0 12px;">${esc(primary.name)}</h2>
              <p style="color:#475569;font-size:0.98rem;line-height:1.6;margin:0 0 24px;">${esc(primary.description)}</p>
              <div style="display:flex;gap:20px;font-family:monospace;font-size:0.82rem;color:#0284c7;margin-bottom:28px;">
                <span>⚡ 0.12ms LATENCY</span>
                <span>🛡️ TITANIUM UNIBODY</span>
                <span>🔋 48H POWER</span>
              </div>
              <a href="${path(`products/${primary.id}/index.html`)}" style="display:inline-block;text-decoration:none;padding:12px 28px;border-radius:8px;background:linear-gradient(135deg, #0284c7, #2563eb);color:#ffffff;font-size:0.88rem;font-weight:800;letter-spacing:0.04em;">
                Inspect Technical Specification ↗
              </a>
            </div>
            <div style="text-align:center;">
              <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;max-height:280px;object-fit:contain;filter:drop-shadow(0 15px 30px rgba(15,23,42,0.1));">
            </div>
          </div>

          <!-- Editions Bento Grid -->
          <div class="sd-spec-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:32px;">
            ${products.map((p, idx) => {
              const pImg = p.imageAssetId ? ctx.asset(p.imageAssetId) : (SINGLE_DEVICE_EDITIONS[idx % SINGLE_DEVICE_EDITIONS.length]?.img || SINGLE_DEVICE_DEFAULT.img);
              return `
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 24px rgba(15,23,42,0.04);transition:transform 0.3s ease, box-shadow 0.3s ease;">
                  <div style="padding:32px;background:#f8fafc;text-align:center;border-bottom:1px solid #e2e8f0;position:relative;">
                    <span style="position:absolute;top:16px;right:16px;background:#ffffff;border:1px solid #e2e8f0;padding:4px 10px;border-radius:999px;font-size:0.72rem;font-family:monospace;font-weight:700;color:#0284c7;">EDITION 0${idx + 1}</span>
                    <img src="${esc(pImg)}" alt="${esc(p.name)}" style="width:100%;max-height:220px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(15,23,42,0.06));">
                  </div>
                  <div style="padding:24px;flex:1;display:flex;flex-direction:column;justify-content:space-between;">
                    <div>
                      <div style="font-size:0.75rem;color:#0284c7;font-family:monospace;font-weight:700;margin-bottom:6px;">MODULE REVISION // 0${idx + 1}</div>
                      <h3 style="font-size:1.2rem;font-weight:800;color:#0f172a;margin:0 0 8px;">${esc(p.name)}</h3>
                      <p style="font-size:0.88rem;color:#475569;line-height:1.55;margin:0 0 16px;">${esc(p.description)}</p>

                      <!-- Hardware Tag Badges -->
                      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">
                        <span style="background:#f1f5f9;color:#334155;font-size:0.72rem;padding:3px 8px;border-radius:4px;font-family:monospace;">${esc(p.material ? p.material.split('+')[0].trim() : 'Titanium')}</span>
                        <span style="background:#f0f9ff;color:#0284c7;font-size:0.72rem;padding:3px 8px;border-radius:4px;font-family:monospace;">0.12ms DSP</span>
                      </div>
                    </div>
                    <div style="display:flex;gap:10px;">
                      <a href="${path(`products/${p.id}/index.html`)}" style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:8px;background:#f8fafc;color:#0f172a;font-size:0.84rem;font-weight:700;border:1px solid #cbd5e1;">
                        Inspect Specs ↗
                      </a>
                      <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:8px;background:linear-gradient(135deg, #0284c7, #2563eb);color:#ffffff;font-size:0.84rem;font-weight:800;">
                        Inquire Unit
                      </a>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </main>
    `;
  } else if (page === 'detail') {
    // ── DETAIL: Deep Laboratory Specification & CAD Blueprint ──
    mainHtml = `
      <main style="background:#f8fafc;color:#0f172a;padding:80px 24px;">
        <div style="max-width:1320px;margin:0 auto;">
          <!-- Dual Column Main Viewport -->
          <div class="sd-detail-main-grid" style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;align-items:flex-start;margin-bottom:60px;">
            <div>
              <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:48px;text-align:center;box-shadow:0 12px 36px rgba(15,23,42,0.06);position:relative;">
                <span style="position:absolute;top:20px;left:20px;background:#f0f9ff;border:1px solid #bae6fd;padding:4px 12px;border-radius:6px;font-size:0.74rem;font-family:monospace;font-weight:700;color:#0284c7;">OPTICAL RETICLE // 1X</span>
                <img id="wr-detail-main-img" data-wr-material-image="product-main" data-wr-material-product="${esc(mainProduct.id)}" src="${esc(mainImg)}" alt="${esc(mainProduct.name)}" style="width:100%;max-height:480px;object-fit:contain;filter:drop-shadow(0 15px 30px rgba(15,23,42,0.1));">
              </div>

              <!-- Multi-Angle Thumbnail Strip -->
              <div class="wr-single-thumbnails" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;margin-top:20px;">
                ${[0, 1, 2, 3].map((idx) => {
                  const thumbImg = SINGLE_DEVICE_EDITIONS[idx]?.img || mainImg;
                  return `
                    <div style="background:#ffffff;border:1px solid ${idx === 0 ? '#0284c7' : '#e2e8f0'};border-radius:12px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                      <img src="${esc(thumbImg)}" alt="Angle ${idx + 1}" style="width:100%;height:60px;object-fit:contain;">
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <div>
              <div style="display:inline-block;padding:6px 14px;background:#f0f9ff;border:1px solid #bae6fd;color:#0284c7;font-family:monospace;font-size:0.75rem;font-weight:700;border-radius:6px;margin-bottom:16px;">
                CONFIRMED HARDWARE REVISION v4.2
              </div>
              <h1 style="font-size:2.4rem;font-weight:900;color:#0f172a;margin:0 0 16px;">${esc(mainProduct.name)}</h1>
              <p style="font-size:1.1rem;color:#475569;line-height:1.65;margin:0 0 28px;">${esc(mainProduct.description)}</p>

              <!-- Verified Metrics Box -->
              <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(15,23,42,0.03);margin-bottom:32px;">
                <div style="font-size:0.75rem;color:#0284c7;font-family:monospace;font-weight:700;margin-bottom:14px;">// VERIFIED TECHNICAL METRICS</div>
                <div class="sd-detail-subspecs" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:0.88rem;">
                  <div>
                    <span style="color:#64748b;font-size:0.82rem;">Materials:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px;">${esc(mainProduct.material || 'Grade-5 Aerospace Titanium')}</div>
                  </div>
                  <div>
                    <span style="color:#64748b;font-size:0.82rem;">Dimensions:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px;">${esc(mainProduct.dimensions || '142 × 72 × 8.2 mm · 185g')}</div>
                  </div>
                  <div>
                    <span style="color:#64748b;font-size:0.82rem;">Acoustic Protocol:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px;">LDAC / aptX HD / UWB 32-Bit</div>
                  </div>
                  <div>
                    <span style="color:#64748b;font-size:0.82rem;">Ingress Protection:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px;">IP68 Submersible (50m)</div>
                  </div>
                </div>
              </div>

              <!-- Allocation CTA & Back -->
              <div style="display:flex;gap:16px;">
                <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="flex:1;text-align:center;text-decoration:none;padding:16px;border-radius:8px;background:linear-gradient(135deg, #0284c7, #2563eb);color:#ffffff;font-size:0.95rem;font-weight:800;letter-spacing:0.04em;box-shadow:0 4px 16px rgba(2,132,199,0.3);">
                  Reserve Production Unit ↗
                </a>
                <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="padding:16px 24px;border-radius:8px;background:#ffffff;color:#0f172a;text-decoration:none;font-size:0.95rem;font-weight:700;border:1px solid #cbd5e1;">
                  Back to Editions
                </a>
              </div>
            </div>
          </div>

          <!-- Technical CAD Blueprint Wireframe Section -->
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:48px;margin-bottom:60px;box-shadow:0 10px 30px rgba(15,23,42,0.03);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;flex-wrap:wrap;gap:16px;">
              <div>
                <div style="color:#0284c7;font-family:monospace;font-size:0.75rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">// CAD SCHEMATIC DIAGRAM</div>
                <h2 style="font-size:1.8rem;font-weight:900;color:#0f172a;margin:4px 0 0;">Micron-Toleranced Chassis Blueprint</h2>
              </div>
              <div style="font-family:monospace;font-size:0.82rem;color:#64748b;background:#f8fafc;padding:6px 16px;border-radius:6px;border:1px solid #e2e8f0;">
                TOLERANCE ±0.005mm · CAD REV 9.4
              </div>
            </div>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:24px;text-align:center;">
              <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:16px;padding:24px;">
                <div style="font-family:monospace;font-size:0.8rem;color:#0284c7;margin-bottom:8px;">FRONT VIEW // 142mm</div>
                <div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#94a3b8;">
                  [ ■■■■■■■■■■■■ ]
                </div>
                <div style="font-size:0.8rem;color:#475569;">Precision capacitive glass front profile</div>
              </div>
              <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:16px;padding:24px;">
                <div style="font-family:monospace;font-size:0.8rem;color:#0284c7;margin-bottom:8px;">SIDE VIEW // 8.2mm</div>
                <div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#94a3b8;">
                  [ ❚ ]
                </div>
                <div style="font-size:0.8rem;color:#475569;">Aerospace Grade-5 Titanium bevel edge</div>
              </div>
              <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:16px;padding:24px;">
                <div style="font-family:monospace;font-size:0.8rem;color:#0284c7;margin-bottom:8px;">REAR DOCK // 72mm</div>
                <div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#94a3b8;">
                  [ ◉ Qi2 ]
                </div>
                <div style="font-size:0.8rem;color:#475569;">Magnetic MagLock 15W induction ring</div>
              </div>
            </div>
          </div>

          <!-- What is in the Box -->
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:48px;box-shadow:0 10px 30px rgba(15,23,42,0.03);">
            <div style="color:#0284c7;font-family:monospace;font-size:0.75rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">// PACKAGING MANIFEST</div>
            <h2 style="font-size:1.8rem;font-weight:900;color:#0f172a;margin:0 0 32px;">What’s Included in Your Hardware Kit</h2>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:24px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center;">
                <div style="font-size:2rem;margin-bottom:12px;">📱</div>
                <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">Acoustic Terminal</div>
                <div style="font-size:0.82rem;color:#64748b;">Serialized Pro X1 unit</div>
              </div>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center;">
                <div style="font-size:2rem;margin-bottom:12px;">🔌</div>
                <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">Kevlar Cable</div>
                <div style="font-size:0.82rem;color:#64748b;">Braided 2m USB-C 240W</div>
              </div>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center;">
                <div style="font-size:2rem;margin-bottom:12px;">🧰</div>
                <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">Pelican Vault Case</div>
                <div style="font-size:0.82rem;color:#64748b;">Milled custom foam insert</div>
              </div>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center;">
                <div style="font-size:2rem;margin-bottom:12px;">📄</div>
                <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">Calibration Pass</div>
                <div style="font-size:0.82rem;color:#64748b;">Lab certificate & API key</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else if (page === 'about') {
    // ── ABOUT: The Engineering Manifesto & Acoustic Facilities ──
    const aboutHeadline = getAboutHeadline(draft.company, 'The Engineering Manifesto');
    const paragraphs = getAboutStoryParagraphs(draft.company);

    mainHtml = `
      <main style="background:#f8fafc;color:#0f172a;padding:80px 24px;">
        <div style="max-width:1100px;margin:0 auto;">
          <!-- Manifesto Hero -->
          <div style="max-width:880px;margin-bottom:60px;">
            <div style="color:#0284c7;font-family:monospace;font-size:0.8rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;">// LAB ORIGINS & PHILOSOPHY</div>
            <h1 style="font-size:2.8rem;font-weight:900;letter-spacing:-0.02em;color:#0f172a;margin:0 0 24px;">${esc(aboutHeadline)}</h1>

            <div style="font-size:1.15rem;line-height:1.8;color:#334155;">
              ${paragraphs.length ? paragraphs.map(p => `<p style="margin-bottom:20px;">${esc(p)}</p>`).join('') : `
                <p style="margin-bottom:20px;">We established this engineering lab with a singular obsession: to build one perfect hardware instrument without the compromises imposed by mass-market consumer electronics.</p>
                <p style="margin-bottom:20px;">By refusing to produce dozens of disposable models each year, our entire research team focuses every hour on refining our single flagship platform—advancing firmware, materials tolerance, and acoustic fidelity for a global community of discerning professionals.</p>
              `}
            </div>
          </div>

          <!-- 3 Stats Metrics -->
          <div class="sd-detail-specs" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:24px;padding:36px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 8px 24px rgba(15,23,42,0.03);margin-bottom:60px;">
            <div>
              <div style="font-size:2.4rem;font-weight:900;color:#0284c7;font-family:monospace;">100%</div>
              <div style="font-size:0.88rem;color:#64748b;margin-top:4px;font-weight:600;">Single-Product Focus</div>
              <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">No disposable annual churn.</div>
            </div>
            <div>
              <div style="font-size:2.4rem;font-weight:900;color:#0284c7;font-family:monospace;">5μm</div>
              <div style="font-size:0.88rem;color:#64748b;margin-top:4px;font-weight:600;">CNC Machining Tolerance</div>
              <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">Sub-micron acoustic boundary seal.</div>
            </div>
            <div>
              <div style="font-size:2.4rem;font-weight:900;color:#0284c7;font-family:monospace;">0.003%</div>
              <div style="font-size:0.88rem;color:#64748b;margin-top:4px;font-weight:600;">Total Harmonic Distortion</div>
              <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">Calibrated in anechoic chambers.</div>
            </div>
          </div>

          <!-- Laboratory Research Facilities -->
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:48px;box-shadow:0 10px 30px rgba(15,23,42,0.03);margin-bottom:60px;">
            <div style="color:#0284c7;font-family:monospace;font-size:0.75rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">// RESEARCH INFRASTRUCTURE</div>
            <h2 style="font-size:2rem;font-weight:900;color:#0f172a;margin:0 0 32px;">Three Dedicated Acoustic Facilities</h2>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:28px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
                <div style="font-family:monospace;font-size:0.75rem;color:#0284c7;font-weight:700;margin-bottom:8px;">FACILITY 01 // MUNICH</div>
                <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin:0 0 10px;">Anechoic Sound Vault</h3>
                <p style="font-size:0.88rem;color:#475569;line-height:1.6;margin:0;">Isolated on 40-ton pneumatic air springs, eliminating all external vibrations down to 2Hz.</p>
              </div>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
                <div style="font-family:monospace;font-size:0.75rem;color:#0284c7;font-weight:700;margin-bottom:8px;">FACILITY 02 // TOKYO</div>
                <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin:0 0 10px;">DSP Silicon Cleanroom</h3>
                <p style="font-size:0.88rem;color:#475569;line-height:1.6;margin:0;">Class-100 microelectronics cleanroom for proprietary neural audio DSP firmware synthesis.</p>
              </div>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
                <div style="font-family:monospace;font-size:0.75rem;color:#0284c7;font-weight:700;margin-bottom:8px;">FACILITY 03 // SAN FRANCISCO</div>
                <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin:0 0 10px;">Titanium CNC Studio</h3>
                <p style="font-size:0.88rem;color:#475569;line-height:1.6;margin:0;">5-axis simultaneous CNC mills machining aerospace unibody structures with laser telemetry.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else {
    // ── CONTACT: Direct Laboratory & B2B Inquiry ──
    mainHtml = `
      <main style="background:#f8fafc;color:#0f172a;padding:80px 24px;">
        <div style="max-width:1100px;margin:0 auto;">
          <div class="wr-single-content-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:flex-start;">
            <!-- Left: Transmission Form -->
            <div>
              <div style="color:#0284c7;font-family:monospace;font-size:0.8rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;">// SECURE TRANSMISSION</div>
              <h1 style="font-size:2.6rem;font-weight:900;color:#0f172a;margin:0 0 16px;">Direct Laboratory & B2B Inquiry</h1>
              <p style="color:#475569;font-size:1.05rem;line-height:1.6;margin-bottom:36px;">For volume hardware allocation, developer kits, and certified distributor partnerships.</p>

              <form action="${esc(ctx.options.inquiryUrl)}" method="post" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:36px;display:flex;flex-direction:column;gap:20px;box-shadow:0 10px 30px rgba(15,23,42,0.04);">
                <div>
                  <label style="display:block;font-size:0.8rem;font-family:monospace;font-weight:700;color:#0284c7;margin-bottom:6px;">COMMUNICATION PROTOCOL // EMAIL</label>
                  <input type="email" name="email" required placeholder="contact@organization.com" style="width:100%;padding:14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;color:#0f172a;font-size:0.95rem;">
                </div>
                <div>
                  <label style="display:block;font-size:0.8rem;font-family:monospace;font-weight:700;color:#0284c7;margin-bottom:6px;">HARDWARE SELECTION // PRODUCT</label>
                  <select name="productId" style="width:100%;padding:14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;color:#0f172a;font-size:0.95rem;">
                    <option value="">— Select Edition —</option>
                    ${products.map(p => `<option value="${esc(p.id)}"${p.id === options.productId ? ' selected' : ''}>${esc(ctx.translateProduct(p).name)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block;font-size:0.8rem;font-family:monospace;font-weight:700;color:#0284c7;margin-bottom:6px;">INQUIRY PAYLOAD // MESSAGE</label>
                  <textarea name="message" rows="5" required placeholder="Specify your desired allocation units, integration timeline, or technical inquiry." style="width:100%;padding:14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;color:#0f172a;font-size:0.95rem;"></textarea>
                </div>
                <button type="submit" style="padding:16px;background:linear-gradient(135deg, #0284c7, #2563eb);border:none;border-radius:8px;color:#ffffff;font-size:1rem;font-weight:900;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase;box-shadow:0 4px 16px rgba(2,132,199,0.3);">
                  Transmit Transmission ↗
                </button>
              </form>
            </div>

            <!-- Right: Direct Channels & Lab Schedule -->
            <div style="display:flex;flex-direction:column;gap:24px;">
              <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.03);">
                <div style="font-family:monospace;font-size:0.75rem;color:#0284c7;font-weight:700;margin-bottom:10px;">// DIRECT TELEMETRY CHANNELS</div>
                <div style="display:flex;flex-direction:column;gap:12px;font-size:0.9rem;">
                  <div>
                    <span style="color:#64748b;display:block;font-size:0.75rem;">DEVELOPER RELATIONS</span>
                    <strong style="color:#0f172a;">dev@${esc(company.email ? company.email.split('@')[1] || 'cyberkeynote.io' : 'cyberkeynote.io')}</strong>
                  </div>
                  <div>
                    <span style="color:#64748b;display:block;font-size:0.75rem;">ENTERPRISE ALLOCATION DESK</span>
                    <strong style="color:#0f172a;">${esc(company.email || 'b2b@cyberkeynote.io')}</strong>
                  </div>
                </div>
              </div>

              <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.03);">
                <div style="font-family:monospace;font-size:0.75rem;color:#0284c7;font-weight:700;margin-bottom:10px;">// BATCH ALLOCATION CALENDAR</div>
                <div style="display:flex;flex-direction:column;gap:14px;font-size:0.86rem;color:#475569;">
                  <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                    <span>Batch 01 (Production):</span>
                    <strong style="color:#059669;">SHIPPING NOW</strong>
                  </div>
                  <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                    <span>Batch 02 (Studio Kits):</span>
                    <strong style="color:#0284c7;">ALLOCATING</strong>
                  </div>
                  <div style="display:flex;justify-content:space-between;">
                    <span>Batch 03 (Enterprise):</span>
                    <strong style="color:#64748b;">Q4 2026</strong>
                  </div>
                </div>
              </div>

              <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.03);">
                <div style="font-family:monospace;font-size:0.75rem;color:#0284c7;font-weight:700;margin-bottom:10px;">// SECURITY & ENCRYPTION</div>
                <p style="font-size:0.86rem;color:#475569;line-height:1.55;margin:0;">
                  All hardware inquiry payloads are processed on isolated local enclaves. Your organization’s development timelines remain strictly confidential under mutual NDA.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  return `${headerHtml}${mainHtml}${footerHtml}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SINGLE ARTISAN CRAFT (Swiss Horological Magazine & Guild Ledger)
// ─────────────────────────────────────────────────────────────────────────────

function renderSingleArtisanPage(ctx: ThemeContext): string {
  const { draft, options, path, navAttrs, ui } = ctx;
  const page = options.page || 'home';
  const company = draft.company;
  const brandName = company.name || 'ATELIER VENDÔME';

  const products = draft.products.length > 0 ? draft.products : SINGLE_ARTISAN_EDITIONS.map(e => ({
    id: e.id,
    name: e.name,
    description: e.desc,
    material: e.material,
    dimensions: e.dimensions,
    tagline: e.tagline,
    imageAssetId: undefined,
  } as Product));

  const primary = products[0] || ({
    id: SINGLE_ARTISAN_DEFAULT.id,
    name: SINGLE_ARTISAN_DEFAULT.name,
    description: SINGLE_ARTISAN_DEFAULT.desc,
    material: SINGLE_ARTISAN_DEFAULT.material,
    dimensions: SINGLE_ARTISAN_DEFAULT.dimensions,
    tagline: SINGLE_ARTISAN_DEFAULT.tagline,
  } as Product);

  const mainProduct = products.find((p) => p.id === options.productId) || primary;
  const mainImg = mainProduct.imageAssetId
    ? ctx.asset(mainProduct.imageAssetId)
    : SINGLE_ARTISAN_DEFAULT.img;

  const headerHtml = `
    <header style="background:rgba(253,251,247,0.95);border-bottom:1px solid #ebe4d8;padding:22px 32px;position:sticky;top:0;z-index:90;backdrop-filter:blur(12px);">
      <div class="sa-header-inner" style="max-width:1320px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;">
        <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;color:#1e1915;">
          <div style="font-family:Georgia,serif;font-size:1.45rem;font-weight:700;letter-spacing:0.04em;">${esc(brandName)}</div>
          <div style="font-size:0.68rem;letter-spacing:0.25em;color:#b8924b;text-transform:uppercase;font-family:system-ui,sans-serif;margin-top:2px;">MAÎTRE HORLOGER · PIÈCE UNIQUE</div>
        </a>
        <nav class="sa-nav" style="display:flex;align-items:center;gap:32px;">
          <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;color:#2c2420;font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;font-family:system-ui,sans-serif;font-weight:600;">${esc(ui.home)}</a>
          <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;color:#2c2420;font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;font-family:system-ui,sans-serif;font-weight:600;">The Commission</a>
          <a href="${path('about/index.html')}" ${navAttrs('about')} style="text-decoration:none;color:#2c2420;font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;font-family:system-ui,sans-serif;font-weight:600;">Atelier Legacy</a>
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;color:#2c2420;font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;font-family:system-ui,sans-serif;font-weight:600;">${esc(ui.contact)}</a>
        </nav>
        <div>
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;padding:12px 24px;border:1px solid #b8924b;background:#ffffff;color:#1e1915;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;border-radius:2px;box-shadow:0 2px 8px rgba(184,146,75,0.12);">
            Request Allocation ↗
          </a>
        </div>
      </div>
    </header>
  `;

  const footerHtml = `
    <footer style="background:#f4efe6;color:#2d241e;padding:70px 32px 36px;border-top:2px solid #b8924b;">
      <div style="max-width:1320px;margin:0 auto;">
        <div class="sa-footer-grid" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px;">
          <div>
            <div style="font-family:Georgia,serif;font-size:1.4rem;font-weight:700;letter-spacing:0.04em;margin-bottom:12px;color:#8c6827;">${esc(brandName)}</div>
            <p style="font-size:0.88rem;line-height:1.7;color:#5c4e42;max-width:320px;font-family:Georgia,serif;">
              ${esc(company.description || 'Independent Swiss haute horlogerie atelier hand-crafting heirloom pieces with unapologetic reverence for traditional guild finishing.')}
            </p>
            <div style="display:flex;gap:12px;margin-top:20px;">${ctx.socials}</div>
          </div>
          <div>
            <div style="font-size:0.75rem;letter-spacing:0.18em;color:#8c6827;text-transform:uppercase;font-weight:700;margin-bottom:16px;">The Guild</div>
            <a href="${path('index.html')}" ${navAttrs('home')} style="display:block;color:#4a3f35;text-decoration:none;font-size:0.86rem;padding:4px 0;">${esc(ui.home)}</a>
            <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="display:block;color:#4a3f35;text-decoration:none;font-size:0.86rem;padding:4px 0;">Numbered Editions</a>
            <a href="${path('about/index.html')}" ${navAttrs('about')} style="display:block;color:#4a3f35;text-decoration:none;font-size:0.86rem;padding:4px 0;">Atelier Heritage</a>
          </div>
          <div>
            <div style="font-size:0.75rem;letter-spacing:0.18em;color:#8c6827;text-transform:uppercase;font-weight:700;margin-bottom:16px;">Private Client</div>
            <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="display:block;color:#4a3f35;text-decoration:none;font-size:0.86rem;padding:4px 0;">Bespoke Commissions</a>
            <a href="mailto:${esc(company.email)}" style="display:block;color:#4a3f35;text-decoration:none;font-size:0.86rem;padding:4px 0;">${esc(company.email)}</a>
          </div>
          <div>
            <div style="font-size:0.75rem;letter-spacing:0.18em;color:#8c6827;text-transform:uppercase;margin-bottom:16px;">Salon & Workshop</div>
            <p style="font-size:0.86rem;color:#5c4e42;line-height:1.6;font-family:Georgia,serif;">${esc(company.address || 'Vallée de Joux · Geneva · Paris Salon')}</p>
          </div>
        </div>
        <div style="border-top:1px solid #ded5c7;padding-top:28px;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:#786b61;">
          <span>&copy; ${new Date().getUTCFullYear()} ${esc(brandName)}. HAND-NUMBERED & CALIBRATED IN SWITZERLAND.</span>
          <div class="languages" style="display:flex;gap:8px;">${ctx.languageLinks}</div>
        </div>
      </div>
    </footer>
  `;

  let mainHtml = '';

  if (page === 'home') {
    mainHtml = `
      <main style="background:#fdfbf7;color:#1e1915;">
        <!-- EDITORIAL ASYMMETRIC SPREAD -->
        <section class="sa-hero-grid" style="padding:90px 32px 110px;max-width:1320px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
          <div>
            <div style="font-size:0.75rem;letter-spacing:0.25em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:16px;">
              ISSUE NO. VII · CALIBRE ROYAL
            </div>
            <h1 style="font-family:Georgia,serif;font-size:clamp(2.4rem, 4.6vw, 3.8rem);font-weight:400;line-height:1.12;color:#1e1915;margin:0 0 24px;">
              ${esc(draft.copy[ctx.lang]?.headline || primary.name)}
            </h1>
            <p style="font-family:Georgia,serif;font-size:1.15rem;line-height:1.75;color:#4a3f35;margin:0 0 36px;font-style:italic;">
              "${esc(draft.copy[ctx.lang]?.subtitle || primary.description)}"
            </p>
            <div style="display:flex;align-items:center;gap:20px;margin-bottom:48px;">
              <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;padding:16px 36px;background:#2a221b;color:#fdfbf7;font-size:0.88rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;border:1px solid #2a221b;border-radius:2px;box-shadow:0 4px 16px rgba(42,34,27,0.2);">
                Examine The Piece ↗
              </a>
              <div style="font-family:Georgia,serif;font-size:0.92rem;color:#786b61;">
                Strictly Limited to 500 Numbered Examples
              </div>
            </div>

            <!-- Artisan certification note -->
            <div style="border-top:1px solid #e8e2d8;padding-top:24px;display:flex;align-items:center;gap:18px;">
              <div style="width:48px;height:48px;border-radius:50%;border:1px solid #b8924b;display:flex;align-items:center;justify-content:center;color:#b8924b;font-size:1.2rem;font-family:Georgia,serif;">
                ⚜
              </div>
              <div style="font-size:0.85rem;color:#6b5e52;line-height:1.5;">
                Every individual piece requires 220 consecutive hours of hand-filing, anglage bevelling, and master balance calibration.
              </div>
            </div>
          </div>

          <!-- Masterpiece Portrait Frame -->
          <div style="position:relative;padding:24px;">
            <div style="position:absolute;inset:0;border:1px solid #d4af37;pointer-events:none;transform:rotate(-1deg);"></div>
            <div style="background:#ffffff;border:1px solid #e8e2d8;padding:40px;box-shadow:0 24px 60px rgba(44,36,32,0.06);position:relative;">
              <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;max-height:460px;object-fit:contain;">
              <div style="text-align:center;margin-top:24px;font-family:Georgia,serif;font-style:italic;font-size:0.86rem;color:#786b61;">
                Piece No. 042 / 500 · Hand-Polished Damascus Steel & 24K Gilded Accents
              </div>
            </div>
          </div>
        </section>

        <!-- PROVENANCE & MATERIALS LEDGER -->
        <section style="background:#f7f2ea;padding:90px 32px;border-top:1px solid #e8e2d8;border-bottom:1px solid #e8e2d8;">
          <div style="max-width:1100px;margin:0 auto;">
            <div style="text-align:center;max-width:640px;margin:0 auto 48px;">
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:8px;">OFFICIAL ARCHIVAL DOCUMENT</div>
              <h2 style="font-family:Georgia,serif;font-size:2.2rem;font-weight:400;color:#1e1915;margin:0 0 12px;">Certificate of Material Provenance</h2>
              <p style="font-family:Georgia,serif;font-size:1rem;color:#6b5e52;font-style:italic;">Each finished object is accompanied by an authenticated ledger guaranteeing raw material origin and artisanal lineage.</p>
            </div>

            <div style="background:#ffffff;border:1px solid #d4af37;border-radius:4px;padding:36px;box-shadow:0 12px 36px rgba(44,36,32,0.04);">
              <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;font-size:0.95rem;">
                <tbody>
                  <tr style="border-bottom:1px solid #e8e2d8;">
                    <td style="padding:16px;color:#786b61;width:240px;font-style:italic;">Primary Alloy Case</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">${esc(primary.material || 'Swiss Damascus Steel (316L Core + Rose Gold Inlay)')}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e8e2d8;">
                    <td style="padding:16px;color:#786b61;font-style:italic;">Movement & Calibre</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">Calibre 1888 Mechanical Hand-Wound · 28,800 vph · 72h Reserve</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e8e2d8;">
                    <td style="padding:16px;color:#786b61;font-style:italic;">Strap & Habillage</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">Full-Grain Tuscan Vegetable Leather · Saddler Hand-Stitched Linen</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e8e2d8;">
                    <td style="padding:16px;color:#786b61;font-style:italic;">Artisanal Bench Hours</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">220 Recorded Master Hours per Finished Unit</td>
                  </tr>
                  <tr>
                    <td style="padding:16px;color:#786b61;font-style:italic;">Restoration Covenant</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">Lifetime Archival Restoration Guarantee with Certified Maker Sign-off</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- 5-STAGE MÉTIERS D'ART TIMELINE -->
        <section style="padding:100px 32px;max-width:1320px;margin:0 auto;">
          <div style="text-align:center;max-width:680px;margin:0 auto 60px;">
            <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:8px;">THE ATELIER PROTOCOL</div>
            <h2 style="font-family:Georgia,serif;font-size:2.4rem;font-weight:400;color:#1e1915;margin:0 0 16px;">The 5 Stages of Timeless Execution</h2>
            <p style="font-family:Georgia,serif;font-size:1.05rem;color:#6b5e52;line-height:1.7;">From unyielding raw mineral to a whispering mechanical symphony.</p>
          </div>

          <div class="sa-stages-grid" style="display:grid;grid-template-columns:repeat(5, 1fr);gap:20px;">
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:26px;border-top:3px solid #b8924b;border-radius:4px;box-shadow:0 8px 24px rgba(44,36,32,0.03);">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#b8924b;font-weight:700;margin-bottom:8px;">I</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;color:#1e1915;">Ore Selection</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Selecting micro-crystallized steel alloys with zero internal structural voids.</p>
            </div>
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:26px;border-top:3px solid #b8924b;border-radius:4px;box-shadow:0 8px 24px rgba(44,36,32,0.03);">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#b8924b;font-weight:700;margin-bottom:8px;">II</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;color:#1e1915;">Hand Forging</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Cold hammer-forged to compress grain structure for exceptional acoustic resonance.</p>
            </div>
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:26px;border-top:3px solid #b8924b;border-radius:4px;box-shadow:0 8px 24px rgba(44,36,32,0.03);">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#b8924b;font-weight:700;margin-bottom:8px;">III</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;color:#1e1915;">Anglage Bevelling</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Gentian wood peg polishing creates mirrored 45° chamfers on all interior components.</p>
            </div>
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:26px;border-top:3px solid #b8924b;border-radius:4px;box-shadow:0 8px 24px rgba(44,36,32,0.03);">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#b8924b;font-weight:700;margin-bottom:8px;">IV</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;color:#1e1915;">Master Regulation</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Regulated in 6 positions across 21 days for precision under -1/+2 seconds daily.</p>
            </div>
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:26px;border-top:3px solid #b8924b;border-radius:4px;box-shadow:0 8px 24px rgba(44,36,32,0.03);">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#b8924b;font-weight:700;margin-bottom:8px;">V</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;color:#1e1915;">Cedar Packaging</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Encased in handcrafted alpine cedar chests with individual leather inspection certificates.</p>
            </div>
          </div>
        </section>

        <!-- ATELIER BENCHWORK & MASTER PROFILE -->
        <section style="background:#f7f2ea;padding:90px 32px;border-top:1px solid #e8e2d8;">
          <div class="wr-single-content-grid" style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
            <div>
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:12px;">VALLÉE DE JOUX BENCHWORK</div>
              <h2 style="font-family:Georgia,serif;font-size:2.2rem;font-weight:400;color:#1e1915;margin:0 0 20px;">The Solitude of the Master Finisher</h2>
              <p style="font-family:Georgia,serif;font-size:1.05rem;line-height:1.8;color:#5c4e42;margin:0 0 24px;">
                High in the Swiss Jura mountains, winter snows enforce a sacred calm. In our workshop, time is measured not by clocks, but by the slow passage of sandpaper, diamond paste, and gentle boxwood burnishers bringing raw steel to a flawless mirror shine.
              </p>
              <div style="border-left:2px solid #b8924b;padding-left:20px;font-family:Georgia,serif;font-style:italic;color:#786b61;font-size:0.95rem;">
                "A machine can cut to a micron. Only the human nerve ending can feel when an edge breathes light."
              </div>
            </div>
            <div style="background:#ffffff;border:1px solid #d4af37;padding:32px;box-shadow:0 16px 40px rgba(44,36,32,0.05);text-align:center;">
              <img src="/templates/senseng/products-4.jpg" alt="Artisan Bench" style="width:100%;max-height:280px;object-fit:contain;margin-bottom:16px;">
              <div style="font-family:Georgia,serif;font-size:0.88rem;color:#8c6827;font-weight:700;">Atelier Bench No. 04 · Hand-Anglage Station</div>
            </div>
          </div>
        </section>
      </main>
    `;
  } else if (page === 'catalog') {
    // ── CATALOG: Asymmetric Archival Portfolio Spread ──
    mainHtml = `
      <main style="background:#fdfbf7;color:#1e1915;padding:90px 32px;">
        <div style="max-width:1320px;margin:0 auto;">
          <!-- Archival Registry Banner -->
          <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:20px;margin-bottom:60px;padding-bottom:32px;border-bottom:1px solid #e8e2d8;">
            <div>
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:8px;">GENEVA ARCHIVAL REGISTRY</div>
              <h1 style="font-family:Georgia,serif;font-size:2.8rem;font-weight:400;color:#1e1915;margin:0 0 16px;">The Collection of Numbered Commissions</h1>
              <p style="font-family:Georgia,serif;font-size:1.05rem;color:#6b5e52;line-height:1.6;margin:0;">Strictly limited annual batches hand-finished under the personal supervision of our guild masters.</p>
            </div>
            <div style="background:#f7f2ea;border:1px solid #d4af37;padding:12px 24px;border-radius:4px;font-family:Georgia,serif;text-align:right;">
              <div style="font-size:0.75rem;color:#b8924b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">2026 ALLOCATION STATUS</div>
              <div style="font-size:1.15rem;font-weight:700;color:#1e1915;margin-top:2px;">42 / 500 COMMISSIONS CLAIMED</div>
            </div>
          </div>

          <!-- Featured Spotlight Article -->
          <div class="wr-single-content-grid" style="background:#ffffff;border:1px solid #d4af37;padding:48px;border-radius:4px;display:grid;grid-template-columns:1.1fr 0.9fr;gap:48px;align-items:center;margin-bottom:60px;box-shadow:0 12px 36px rgba(44,36,32,0.04);">
            <div>
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:10px;">HISTORIC ATELIER HIGHLIGHT</div>
              <h2 style="font-family:Georgia,serif;font-size:2.2rem;font-weight:400;color:#1e1915;margin:0 0 16px;">${esc(primary.name)}</h2>
              <p style="font-family:Georgia,serif;font-size:1.05rem;color:#5c4e42;line-height:1.75;margin:0 0 24px;">
                ${esc(primary.description)} Hand-finished with 45° gentian wood anglage, featuring our certified 72-hour power reserve calibre.
              </p>
              <div style="font-family:Georgia,serif;font-size:0.92rem;color:#786b61;margin-bottom:28px;">
                <strong>Archival Allocation:</strong> Piece 001/500 Reserved for Guild Vault
              </div>
              <a href="${path(`products/${primary.id}/index.html`)}" style="display:inline-block;padding:14px 32px;background:#2a221b;color:#fdfbf7;text-decoration:none;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;border-radius:2px;">
                Examine Master Ledger ↗
              </a>
            </div>
            <div style="text-align:center;">
              <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;max-height:320px;object-fit:contain;">
            </div>
          </div>

          <!-- Asymmetric Editions Grid -->
          <div class="sa-provenance-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:36px;">
            ${products.map((p, idx) => {
              const pImg = p.imageAssetId ? ctx.asset(p.imageAssetId) : (SINGLE_ARTISAN_EDITIONS[idx % SINGLE_ARTISAN_EDITIONS.length]?.img || SINGLE_ARTISAN_DEFAULT.img);
              return `
                <div style="background:#ffffff;border:1px solid #e8e2d8;padding:36px;border-radius:4px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 12px 30px rgba(44,36,32,0.03);position:relative;">
                  <span style="position:absolute;top:16px;right:16px;font-family:Georgia,serif;font-size:0.78rem;color:#b8924b;font-weight:700;">N° 0${idx + 1}</span>
                  <div style="text-align:center;margin-bottom:24px;">
                    <img src="${esc(pImg)}" alt="${esc(p.name)}" style="width:100%;max-height:240px;object-fit:contain;">
                  </div>
                  <div>
                    <div style="font-size:0.72rem;letter-spacing:0.18em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:8px;">VARIATION // 0${idx + 1}</div>
                    <h3 style="font-family:Georgia,serif;font-size:1.3rem;font-weight:700;color:#1e1915;margin:0 0 10px;">${esc(p.name)}</h3>
                    <p style="font-family:Georgia,serif;font-size:0.88rem;color:#6b5e52;line-height:1.6;margin:0 0 20px;">${esc(p.description)}</p>

                    <div style="font-family:Georgia,serif;font-size:0.8rem;color:#786b61;margin-bottom:18px;">
                      <em>${esc(p.material || 'Damascus Steel & Full-Grain Leather')}</em>
                    </div>

                    <div style="display:flex;gap:12px;">
                      <a href="${path(`products/${p.id}/index.html`)}" style="flex:1;text-align:center;text-decoration:none;padding:12px;border:1px solid #1e1915;color:#1e1915;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">
                        View Ledger
                      </a>
                      <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="flex:1;text-align:center;text-decoration:none;padding:12px;background:#2a221b;color:#fdfbf7;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">
                        Commission
                      </a>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </main>
    `;
  } else if (page === 'detail') {
    // ── DETAIL: Hand-Numbered Pièce Unique Ledger & Calibre Specs ──
    mainHtml = `
      <main style="background:#fdfbf7;color:#1e1915;padding:90px 32px;">
        <div style="max-width:1320px;margin:0 auto;">
          <!-- Master Frame & Description -->
          <div class="sa-detail-grid" style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;align-items:center;margin-bottom:60px;">
            <div style="background:#ffffff;border:1px solid #d4af37;padding:48px;border-radius:4px;text-align:center;box-shadow:0 20px 50px rgba(44,36,32,0.06);position:relative;">
              <span style="position:absolute;top:20px;left:20px;font-family:Georgia,serif;font-size:0.75rem;letter-spacing:0.15em;color:#b8924b;font-weight:700;">GENEVAL GUILD REGISTRATION</span>
              <img id="wr-detail-main-img" data-wr-material-image="product-main" data-wr-material-product="${esc(mainProduct.id)}" src="${esc(mainImg)}" alt="${esc(mainProduct.name)}" style="width:100%;max-height:460px;object-fit:contain;">
            </div>

            <div>
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:12px;">HAND-NUMBERED PIÈCE UNIQUE</div>
              <h1 style="font-family:Georgia,serif;font-size:2.5rem;font-weight:400;color:#1e1915;margin:0 0 16px;">${esc(mainProduct.name)}</h1>
              <p style="font-family:Georgia,serif;font-size:1.1rem;color:#4a3f35;line-height:1.75;margin:0 0 32px;font-style:italic;">${esc(mainProduct.description)}</p>

              <div style="background:#f7f2ea;border-left:3px solid #b8924b;padding:24px;border-radius:0 4px 4px 0;margin-bottom:36px;font-family:Georgia,serif;font-size:0.92rem;color:#4a3f35;">
                <p style="margin:0 0 8px;"><strong>Materials:</strong> ${esc(mainProduct.material || 'Damascus Steel, Tuscan Full-Grain Leather')}</p>
                <p style="margin:0 0 8px;"><strong>Dimensions:</strong> ${esc(mainProduct.dimensions || '40mm Diameter · 10.5mm Thickness')}</p>
                <p style="margin:0;"><strong>Archival Seal:</strong> Hand-inspected and sealed in Geneva Atelier.</p>
              </div>

              <div style="display:flex;gap:16px;">
                <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="padding:16px 36px;background:#2a221b;color:#fdfbf7;text-decoration:none;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;border-radius:2px;box-shadow:0 4px 16px rgba(42,34,27,0.2);">
                  Request Commission Appointment ↗
                </a>
              </div>
            </div>
          </div>

          <!-- Movement Technical Specifications Ledger -->
          <div style="background:#ffffff;border:1px solid #e8e2d8;border-radius:4px;padding:48px;margin-bottom:60px;box-shadow:0 12px 36px rgba(44,36,32,0.03);">
            <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:8px;">HAUTE HORLOGERIE CALIBRE</div>
            <h2 style="font-family:Georgia,serif;font-size:2rem;font-weight:400;color:#1e1915;margin:0 0 32px;">Mechanical Architecture & Guilloché Standards</h2>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:24px;font-family:Georgia,serif;">
              <div style="background:#fdfbf7;border:1px solid #e8e2d8;padding:20px;border-radius:2px;">
                <div style="color:#b8924b;font-size:0.8rem;text-transform:uppercase;margin-bottom:6px;">Escapement Cadence</div>
                <div style="font-size:1.3rem;font-weight:700;color:#1e1915;">28,800 vph</div>
                <div style="font-size:0.8rem;color:#786b61;margin-top:4px;">4 Hz Swiss balance</div>
              </div>
              <div style="background:#fdfbf7;border:1px solid #e8e2d8;padding:20px;border-radius:2px;">
                <div style="color:#b8924b;font-size:0.8rem;text-transform:uppercase;margin-bottom:6px;">Power Reserve</div>
                <div style="font-size:1.3rem;font-weight:700;color:#1e1915;">72 Hours</div>
                <div style="font-size:0.8rem;color:#786b61;margin-top:4px;">Twin coaxial spring barrels</div>
              </div>
              <div style="background:#fdfbf7;border:1px solid #e8e2d8;padding:20px;border-radius:2px;">
                <div style="color:#b8924b;font-size:0.8rem;text-transform:uppercase;margin-bottom:6px;">Jewel Count</div>
                <div style="font-size:1.3rem;font-weight:700;color:#1e1915;">33 Rubies</div>
                <div style="font-size:0.8rem;color:#786b61;margin-top:4px;">Hand-set in gold chatons</div>
              </div>
              <div style="background:#fdfbf7;border:1px solid #e8e2d8;padding:20px;border-radius:2px;">
                <div style="color:#b8924b;font-size:0.8rem;text-transform:uppercase;margin-bottom:6px;">Hand Anglage</div>
                <div style="font-size:1.3rem;font-weight:700;color:#1e1915;">45° Mirror</div>
                <div style="font-size:0.8rem;color:#786b61;margin-top:4px;">Gentian wood polished</div>
              </div>
            </div>
          </div>

          <!-- Leather Habillage & Presentation Chest Story -->
          <div class="wr-single-content-grid" style="background:#f7f2ea;border:1px solid #d4af37;border-radius:4px;padding:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;">
            <div>
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:8px;">TUSCAN VEGETABLE LEATHER</div>
              <h2 style="font-family:Georgia,serif;font-size:2rem;font-weight:400;color:#1e1915;margin:0 0 16px;">Traditional Saddler Hand-Stitching</h2>
              <p style="font-family:Georgia,serif;font-size:1rem;color:#5c4e42;line-height:1.75;margin:0 0 16px;">
                Each strap is cut from full-grain bovine hides steeped for 90 days in natural chestnut and mimosa tannins along the river Arno. Stitched entirely by hand with beeswaxed French linen thread that never unravels.
              </p>
              <div style="font-family:Georgia,serif;font-size:0.9rem;color:#786b61;">
                Included: Hand-joined alpine cedar presentation safe with brass key and calfskin travel pouch.
              </div>
            </div>
            <div style="text-align:center;">
              <img src="/templates/senseng/products-8.jpg" alt="Cedar Presentation Coffer" style="width:100%;max-height:260px;object-fit:contain;">
            </div>
          </div>
        </div>
      </main>
    `;
  } else if (page === 'about') {
    // ── ABOUT: The Atelier Heritage & Century Timeline ──
    const aboutHeadline = getAboutHeadline(draft.company, 'The Atelier Heritage');
    const paragraphs = getAboutStoryParagraphs(draft.company);

    mainHtml = `
      <main style="background:#fdfbf7;color:#1e1915;padding:90px 32px;">
        <div style="max-width:1100px;margin:0 auto;">
          <div style="max-width:880px;margin-bottom:60px;">
            <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:12px;">GENEVAL HOROLOGICAL ARCHIVE</div>
            <h1 style="font-family:Georgia,serif;font-size:2.8rem;font-weight:400;color:#1e1915;margin:0 0 28px;">${esc(aboutHeadline)}</h1>

            <div style="font-family:Georgia,serif;font-size:1.15rem;line-height:1.85;color:#3d332a;margin-bottom:48px;">
              ${paragraphs.length ? paragraphs.map(p => `<p style="margin-bottom:24px;">${esc(p)}</p>`).join('') : `
                <p style="margin-bottom:24px;">Founded on the principle of unhurried perfection, our atelier exists outside the cadence of industrial production. We create one single mechanical object, devoting months of artisan benchwork to each individual execution.</p>
                <p style="margin-bottom:24px;">By rejecting the temptation of annual mass collections, our master watchmakers preserve centuries-old hand-filing, anglage bevelling, and balance regulation techniques that have disappeared from modern assembly lines.</p>
              `}
            </div>

            <div style="border:1px solid #d4af37;padding:32px;background:#ffffff;border-radius:4px;text-align:center;font-family:Georgia,serif;font-style:italic;color:#6b5e52;box-shadow:0 8px 24px rgba(44,36,32,0.03);">
              "We do not build for the season. We build for the third generation that will inherit this timepiece."
            </div>
          </div>

          <!-- Four Guild Métiers d'Art Cards -->
          <div style="background:#f7f2ea;border:1px solid #e8e2d8;border-radius:4px;padding:48px;margin-bottom:60px;">
            <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:8px;">THE FOUR GUILD MÉTIERS</div>
            <h2 style="font-family:Georgia,serif;font-size:2rem;font-weight:400;color:#1e1915;margin:0 0 32px;">Custodians of Disappearing Alpine Crafts</h2>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:24px;font-family:Georgia,serif;">
              <div style="background:#ffffff;border:1px solid #e8e2d8;padding:24px;border-top:3px solid #b8924b;">
                <h3 style="font-size:1.15rem;margin:0 0 8px;color:#1e1915;">Master Angleur</h3>
                <p style="font-size:0.85rem;color:#6b5e52;line-height:1.6;margin:0;">Files and chamfers internal bridge angles under loupe without mechanical guides.</p>
              </div>
              <div style="background:#ffffff;border:1px solid #e8e2d8;padding:24px;border-top:3px solid #b8924b;">
                <h3 style="font-size:1.15rem;margin:0 0 8px;color:#1e1915;">Guillocheur</h3>
                <p style="font-size:0.85rem;color:#6b5e52;line-height:1.6;margin:0;">Operates 19th-century rose engine lathes to engrave barleycorn patterns by hand.</p>
              </div>
              <div style="background:#ffffff;border:1px solid #e8e2d8;padding:24px;border-top:3px solid #b8924b;">
                <h3 style="font-size:1.15rem;margin:0 0 8px;color:#1e1915;">Grand Feu Enameller</h3>
                <p style="font-size:0.85rem;color:#6b5e52;line-height:1.6;margin:0;">Layers pulverized vitreous enamel over gold discs, firing each piece at 800°C.</p>
              </div>
              <div style="background:#ffffff;border:1px solid #e8e2d8;padding:24px;border-top:3px solid #b8924b;">
                <h3 style="font-size:1.15rem;margin:0 0 8px;color:#1e1915;">Master Regulateur</h3>
                <p style="font-size:0.85rem;color:#6b5e52;line-height:1.6;margin:0;">Calibrates balance hairspring curvature across 6 positions for chronometric poise.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else {
    // ── CONTACT: Private Salon Consultation ──
    mainHtml = `
      <main style="background:#fdfbf7;color:#1e1915;padding:90px 32px;">
        <div style="max-width:1100px;margin:0 auto;">
          <div class="wr-single-content-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:flex-start;">
            <div>
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:12px;">PRIVATE SALON CONSULTATION</div>
              <h1 style="font-family:Georgia,serif;font-size:2.6rem;font-weight:400;color:#1e1915;margin:0 0 16px;">Commission an Allocation</h1>
              <p style="font-family:Georgia,serif;font-size:1.05rem;color:#6b5e52;line-height:1.6;margin-bottom:40px;">Private client concierge for individual numbered allocations, bespoke case engravings, and private salon appointments.</p>

              <form action="${esc(ctx.options.inquiryUrl)}" method="post" style="background:#ffffff;border:1px solid #e8e2d8;border-radius:4px;padding:40px;display:flex;flex-direction:column;gap:24px;box-shadow:0 12px 36px rgba(44,36,32,0.04);">
                <div>
                  <label style="display:block;font-family:Georgia,serif;font-size:0.9rem;color:#4a3f35;margin-bottom:8px;">Client Email Address</label>
                  <input type="email" name="email" required placeholder="client@estate.com" style="width:100%;padding:14px;border:1px solid #d4ccbf;background:#fdfbf7;font-family:Georgia,serif;font-size:0.95rem;color:#1e1915;">
                </div>
                <div>
                  <label style="display:block;font-family:Georgia,serif;font-size:0.9rem;color:#4a3f35;margin-bottom:8px;">Desired Horological Commission</label>
                  <select name="productId" style="width:100%;padding:14px;border:1px solid #d4ccbf;background:#fdfbf7;font-family:Georgia,serif;font-size:0.95rem;color:#1e1915;">
                    <option value="">— Select Commission Edition —</option>
                    ${products.map(p => `<option value="${esc(p.id)}"${p.id === options.productId ? ' selected' : ''}>${esc(ctx.translateProduct(p).name)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block;font-family:Georgia,serif;font-size:0.9rem;color:#4a3f35;margin-bottom:8px;">Inquiry & Commission Notes</label>
                  <textarea name="message" rows="5" required placeholder="Please outline your preferred finish, custom engraving initials, or private appointment timing." style="width:100%;padding:14px;border:1px solid #d4ccbf;background:#fdfbf7;font-family:Georgia,serif;font-size:0.95rem;color:#1e1915;"></textarea>
                </div>
                <button type="submit" style="padding:16px;background:#2a221b;color:#fdfbf7;border:none;font-size:0.86rem;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;cursor:pointer;border-radius:2px;box-shadow:0 4px 16px rgba(42,34,27,0.2);">
                  Submit Commission Request ↗
                </button>
              </form>
            </div>

            <!-- Right: Guild Salons & Protocol -->
            <div style="display:flex;flex-direction:column;gap:24px;font-family:Georgia,serif;">
              <div style="background:#ffffff;border:1px solid #e8e2d8;border-radius:4px;padding:32px;box-shadow:0 8px 24px rgba(44,36,32,0.03);">
                <div style="font-size:0.75rem;letter-spacing:0.18em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:12px;">PRIVATE VIEWING SALONS</div>
                <div style="display:flex;flex-direction:column;gap:16px;font-size:0.92rem;color:#4a3f35;">
                  <div>
                    <strong style="color:#1e1915;display:block;">GENEVA SALON</strong>
                    Place de la Fusterie 12 · By Appointment Only
                  </div>
                  <div>
                    <strong style="color:#1e1915;display:block;">PARIS SALON</strong>
                    Place Vendôme 18 · By Appointment Only
                  </div>
                  <div>
                    <strong style="color:#1e1915;display:block;">TOKYO SALON</strong>
                    Ginza 6-Chome · Private Client Suite
                  </div>
                </div>
              </div>

              <div style="background:#f7f2ea;border:1px solid #d4af37;border-radius:4px;padding:32px;">
                <div style="font-size:0.75rem;letter-spacing:0.18em;color:#b8924b;text-transform:uppercase;font-weight:700;margin-bottom:10px;">COMMISSION PROCESS</div>
                <p style="font-size:0.88rem;color:#5c4e42;line-height:1.7;margin:0;">
                  Once an allocation is accepted, our master watchmaker corresponds directly with the commissioner, sharing high-magnification bench photographs as your numbered timepiece progresses from raw mineral to final regulation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  return `${headerHtml}${mainHtml}${footerHtml}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SINGLE WELLNESS NORDIC (Scandinavian Daylight Sanctuary & Biophilic Rituals)
// ─────────────────────────────────────────────────────────────────────────────

function renderSingleWellnessPage(ctx: ThemeContext): string {
  const { draft, options, path, navAttrs, ui } = ctx;
  const page = options.page || 'home';
  const company = draft.company;
  const brandName = company.name || 'NORDIC SERENE';

  const products = draft.products.length > 0 ? draft.products : SINGLE_WELLNESS_EDITIONS.map(e => ({
    id: e.id,
    name: e.name,
    description: e.desc,
    material: e.material,
    dimensions: e.dimensions,
    tagline: e.tagline,
    imageAssetId: undefined,
  } as Product));

  const primary = products[0] || ({
    id: SINGLE_WELLNESS_DEFAULT.id,
    name: SINGLE_WELLNESS_DEFAULT.name,
    description: SINGLE_WELLNESS_DEFAULT.desc,
    material: SINGLE_WELLNESS_DEFAULT.material,
    dimensions: SINGLE_WELLNESS_DEFAULT.dimensions,
    tagline: SINGLE_WELLNESS_DEFAULT.tagline,
  } as Product);

  const mainProduct = products.find((p) => p.id === options.productId) || primary;
  const mainImg = mainProduct.imageAssetId
    ? ctx.asset(mainProduct.imageAssetId)
    : SINGLE_WELLNESS_DEFAULT.img;

  const headerHtml = `
    <header style="background:rgba(248,250,247,0.94);backdrop-filter:blur(16px);border-bottom:1px solid rgba(58,83,66,0.12);padding:18px 28px;position:sticky;top:0;z-index:90;">
      <div class="sw-header-inner" style="max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;">
        <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;display:flex;align-items:center;gap:10px;">
          <div style="width:30px;height:30px;border-radius:50%;background:#3a5342;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:0.9rem;box-shadow:0 2px 8px rgba(58,83,66,0.2);">
            🌿
          </div>
          <div>
            <div style="font-size:1.12rem;font-weight:800;color:#1e2d21;letter-spacing:-0.02em;">${esc(brandName)}</div>
            <div style="font-size:0.68rem;color:#4a6755;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;">Circadian Living · Copenhagen</div>
          </div>
        </a>
        <nav class="sw-nav" style="display:flex;align-items:center;gap:28px;">
          <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;color:#3a5342;font-size:0.88rem;font-weight:600;">${esc(ui.home)}</a>
          <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;color:#3a5342;font-size:0.88rem;font-weight:600;">Daily Rituals</a>
          <a href="${path('about/index.html')}" ${navAttrs('about')} style="text-decoration:none;color:#3a5342;font-size:0.88rem;font-weight:600;">Nordic Ethos</a>
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;color:#3a5342;font-size:0.88rem;font-weight:600;">${esc(ui.contact)}</a>
        </nav>
        <div>
          <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;padding:10px 24px;border-radius:999px;background:#3a5342;color:#ffffff;font-size:0.86rem;font-weight:700;box-shadow:0 4px 14px rgba(58,83,66,0.22);">
            Begin Ritual ↗
          </a>
        </div>
      </div>
    </header>
  `;

  const footerHtml = `
    <footer style="background:#edf3ec;color:#1e2d21;padding:64px 28px 32px;border-top:1px solid #d5e2d2;">
      <div style="max-width:1280px;margin:0 auto;">
        <div class="sd-footer-grid" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:44px;">
          <div>
            <div style="font-size:1.2rem;font-weight:800;color:#1e2d21;margin-bottom:12px;">${esc(brandName)}</div>
            <p style="font-size:0.88rem;line-height:1.65;color:#4a6350;max-width:320px;">
              ${esc(company.description || 'Designing biophilic everyday objects that restore sensory calm and align human wellness with natural circadian cycles.')}
            </p>
            <div style="display:flex;gap:12px;margin-top:18px;">${ctx.socials}</div>
          </div>
          <div>
            <div style="font-size:0.76rem;font-weight:800;letter-spacing:0.1em;color:#3a5342;text-transform:uppercase;margin-bottom:14px;">The Ritual</div>
            <a href="${path('index.html')}" ${navAttrs('home')} style="display:block;color:#3d5644;text-decoration:none;font-size:0.86rem;padding:4px 0;font-weight:500;">${esc(ui.home)}</a>
            <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="display:block;color:#3d5644;text-decoration:none;font-size:0.86rem;padding:4px 0;font-weight:500;">Starter Bundles</a>
            <a href="${path('about/index.html')}" ${navAttrs('about')} style="display:block;color:#3d5644;text-decoration:none;font-size:0.86rem;padding:4px 0;font-weight:500;">Circadian Science</a>
          </div>
          <div>
            <div style="font-size:0.76rem;font-weight:800;letter-spacing:0.1em;color:#3a5342;text-transform:uppercase;margin-bottom:14px;">Inquiries</div>
            <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="display:block;color:#3d5644;text-decoration:none;font-size:0.86rem;padding:4px 0;font-weight:500;">Hospitality & Spa Partnerships</a>
            <a href="mailto:${esc(company.email)}" style="display:block;color:#3d5644;text-decoration:none;font-size:0.86rem;padding:4px 0;font-weight:500;">${esc(company.email)}</a>
          </div>
          <div>
            <div style="font-size:0.76rem;font-weight:800;letter-spacing:0.1em;color:#3a5342;text-transform:uppercase;margin-bottom:14px;">Studio</div>
            <p style="font-size:0.86rem;color:#4a6350;line-height:1.55;">${esc(company.address || 'Bredgade 24 · 1260 Copenhagen K · Denmark')}</p>
          </div>
        </div>
        <div style="border-top:1px solid #d5e2d2;padding-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:#58735f;">
          <span>&copy; ${new Date().getUTCFullYear()} ${esc(brandName)}. 100% PLASTIC-FREE PACKAGING & FSC CERTIFIED.</span>
          <div class="languages" style="display:flex;gap:8px;">${ctx.languageLinks}</div>
        </div>
      </div>
    </footer>
  `;

  let mainHtml = '';

  if (page === 'home') {
    mainHtml = `
      <main style="background:#f8faf7;color:#1e2d21;">
        <!-- SUNLIT BIOPHILIC HERO -->
        <section class="sw-hero-grid" style="padding:90px 28px 100px;max-width:1280px;margin:0 auto;display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;align-items:center;">
          <div>
            <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:999px;background:#e3ebd9;color:#3a5342;font-size:0.78rem;font-weight:700;margin-bottom:24px;">
              <span>🌱</span> 100% Natural Materials · Clinically Formulated
            </div>
            <h1 style="font-size:clamp(2.4rem, 4.8vw, 3.6rem);font-weight:900;line-height:1.1;color:#1e2d21;margin:0 0 20px;letter-spacing:-0.03em;">
              ${esc(draft.copy[ctx.lang]?.headline || primary.name)}
            </h1>
            <p style="font-size:1.12rem;line-height:1.65;color:#4c6251;margin:0 0 36px;max-width:520px;">
              ${esc(draft.copy[ctx.lang]?.subtitle || primary.description)}
            </p>
            <div style="display:flex;gap:16px;margin-bottom:44px;">
              <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;padding:16px 36px;border-radius:999px;background:#3a5342;color:#ffffff;font-size:0.96rem;font-weight:700;box-shadow:0 6px 20px rgba(58,83,66,0.25);">
                Begin Your Daily Ritual ↗
              </a>
              <a href="#circadian" style="text-decoration:none;padding:16px 28px;border-radius:999px;background:#ffffff;color:#3a5342;border:1px solid #d4decf;font-size:0.96rem;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                The 24h Rhythm ↓
              </a>
            </div>

            <!-- Eco & Health Badges -->
            <div style="display:flex;gap:24px;padding-top:24px;border-top:1px solid #dce4d7;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.4rem;">🍃</span>
                <span style="font-size:0.86rem;font-weight:700;color:#3a5342;">Zero Synthetic VOCs</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.4rem;">☀️</span>
                <span style="font-size:0.86rem;font-weight:700;color:#3a5342;">Full-Spectrum Melatonin Support</span>
              </div>
            </div>
          </div>

          <!-- Studio Showcase Frame -->
          <div style="position:relative;background:linear-gradient(145deg, #ffffff 0%, #edf3eb 100%);border-radius:36px;padding:48px;box-shadow:0 20px 50px rgba(58,83,66,0.08);border:1px solid #dbe3d6;text-align:center;">
            <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;max-height:440px;object-fit:contain;filter:drop-shadow(0 16px 32px rgba(58,83,66,0.12));">
            <div style="display:inline-flex;align-items:center;gap:8px;margin-top:20px;padding:8px 16px;background:#ffffff;border-radius:999px;font-size:0.8rem;font-weight:700;color:#3a5342;box-shadow:0 4px 12px rgba(0,0,0,0.05);border:1px solid #dce4d7;">
              <span>✨</span> Pure Mineral Cast Stone & Solid Birch
            </div>
          </div>
        </section>

        <!-- 24-HOUR CIRCADIAN RHYTHM -->
        <section id="circadian" style="background:#ffffff;padding:90px 28px;border-top:1px solid #e1e9dc;border-bottom:1px solid #e1e9dc;">
          <div style="max-width:1280px;margin:0 auto;">
            <div style="text-align:center;max-width:680px;margin:0 auto 60px;">
              <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">CIRCADIAN HARMONY</div>
              <h2 style="font-size:2.3rem;font-weight:900;color:#1e2d21;margin:0 0 16px;">One Device. Synchronized to Your Sun.</h2>
              <p style="color:#4c6251;font-size:1.05rem;line-height:1.65;">Natural sensory shifts that gently cue alertness in morning and restful sleep at night.</p>
            </div>

            <div class="sw-rhythm-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:32px;">
              <div style="background:#f8faf7;border-radius:24px;padding:36px;border:1px solid #dce4d7;box-shadow:0 8px 24px rgba(58,83,66,0.03);">
                <div style="font-size:2rem;margin-bottom:12px;">🌅</div>
                <div style="font-size:0.8rem;font-weight:800;color:#c47355;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">07:00 // AWAKENING</div>
                <h3 style="font-size:1.35rem;font-weight:800;color:#1e2d21;margin:0 0 12px;">Sunrise Mimicking Glow</h3>
                <p style="color:#4c6251;font-size:0.92rem;line-height:1.6;">Gradual 480nm blue-enriched illumination combined with revitalizing Siberian fir micro-mist clears morning grogginess naturally.</p>
              </div>

              <div style="background:#f8faf7;border-radius:24px;padding:36px;border:1px solid #dce4d7;box-shadow:0 8px 24px rgba(58,83,66,0.03);">
                <div style="font-size:2rem;margin-bottom:12px;">🌿</div>
                <div style="font-size:0.8rem;font-weight:800;color:#3a5342;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">14:00 // DEEP FOCUS</div>
                <h3 style="font-size:1.35rem;font-weight:800;color:#1e2d21;margin:0 0 12px;">Cognitive Balance Flow</h3>
                <p style="color:#4c6251;font-size:0.92rem;line-height:1.6;">Neutral 4000K balanced daylight prevents afternoon screen fatigue while organic rosemary and cedarwood enhance mental clarity.</p>
              </div>

              <div style="background:#f8faf7;border-radius:24px;padding:36px;border:1px solid #dce4d7;box-shadow:0 8px 24px rgba(58,83,66,0.03);">
                <div style="font-size:2rem;margin-bottom:12px;">🌙</div>
                <div style="font-size:0.8rem;font-weight:800;color:#6b5278;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">21:00 // WIND-DOWN</div>
                <h3 style="font-size:1.35rem;font-weight:800;color:#1e2d21;margin:0 0 12px;">Melatonin-Safe Amber</h3>
                <p style="color:#4c6251;font-size:0.92rem;line-height:1.6;">Zero blue-light 1800K candle warmth with therapeutic French lavender micro-droplets invites deep restorative REM sleep.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- CLINICAL PROOF SPECTRUM -->
        <section style="padding:90px 28px;max-width:1280px;margin:0 auto;">
          <div class="sw-clinical-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
            <div>
              <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">CLINICAL RESULTS</div>
              <h2 style="font-size:2.2rem;font-weight:900;color:#1e2d21;margin:0 0 18px;">Scientifically Tested in Double-Blind Trials</h2>
              <p style="color:#4c6251;font-size:1rem;line-height:1.65;margin-bottom:32px;">Over 800 participants tracked across 60 days demonstrated measurable cortisol reduction and sleep latency improvements.</p>

              <div style="display:flex;flex-direction:column;gap:18px;">
                <div style="display:flex;align-items:center;gap:20px;background:#ffffff;padding:20px 24px;border-radius:18px;border:1px solid #dce4d7;box-shadow:0 6px 18px rgba(58,83,66,0.04);">
                  <div style="font-size:2.2rem;font-weight:900;color:#3a5342;">94%</div>
                  <div style="font-size:0.92rem;color:#4c6251;line-height:1.45;">Fell asleep within 15 minutes without prescription sleep aids.</div>
                </div>
                <div style="display:flex;align-items:center;gap:20px;background:#ffffff;padding:20px 24px;border-radius:18px;border:1px solid #dce4d7;box-shadow:0 6px 18px rgba(58,83,66,0.04);">
                  <div style="font-size:2.2rem;font-weight:900;color:#3a5342;">38%</div>
                  <div style="font-size:0.92rem;color:#4c6251;line-height:1.45;">Reduction in salivary evening cortisol biomarkers.</div>
                </div>
                <div style="display:flex;align-items:center;gap:20px;background:#ffffff;padding:20px 24px;border-radius:18px;border:1px solid #dce4d7;box-shadow:0 6px 18px rgba(58,83,66,0.04);">
                  <div style="font-size:2.2rem;font-weight:900;color:#3a5342;">100%</div>
                  <div style="font-size:0.92rem;color:#4c6251;line-height:1.45;">Biodegradable zero-plastic construction with zero electronic waste.</div>
                </div>
              </div>
            </div>

            <div style="text-align:center;">
              <img src="${esc(mainImg)}" alt="Clinical Wellness" style="width:100%;max-width:440px;filter:drop-shadow(0 20px 40px rgba(58,83,66,0.12));">
            </div>
          </div>
        </section>

        <!-- SENSORY LIVING TESTIMONIAL JOURNAL -->
        <section style="background:#ffffff;padding:90px 28px;border-top:1px solid #e1e9dc;">
          <div style="max-width:1280px;margin:0 auto;">
            <div style="text-align:center;max-width:680px;margin:0 auto 50px;">
              <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">MINDFUL PRACTITIONERS</div>
              <h2 style="font-size:2.2rem;font-weight:900;color:#1e2d21;margin:0 0 12px;">Notes from Daily Living Spaces</h2>
              <p style="color:#4c6251;font-size:1rem;">How natural circadian rhythms transform home environments across the globe.</p>
            </div>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:32px;">
              <div style="background:#f8faf7;border-radius:24px;padding:32px;border:1px solid #dce4d7;">
                <div style="color:#c47355;font-size:1.2rem;margin-bottom:12px;">“</div>
                <p style="font-size:0.95rem;line-height:1.65;color:#3d5644;margin:0 0 20px;">
                  The amber 1800K candle shift completely eliminated my evening screen restlessness. My bedroom finally feels like an organic sanctuary.
                </p>
                <div style="font-weight:800;color:#1e2d21;font-size:0.9rem;">Astrid Lindqvist</div>
                <div style="font-size:0.78rem;color:#6b8572;">Architect & Minimalist · Stockholm</div>
              </div>

              <div style="background:#f8faf7;border-radius:24px;padding:32px;border:1px solid #dce4d7;">
                <div style="color:#3a5342;font-size:1.2rem;margin-bottom:12px;">“</div>
                <p style="font-size:0.95rem;line-height:1.65;color:#3d5644;margin:0 0 20px;">
                  As a clinical sleep researcher, the acoustic nebulizer’s cold-press micro-droplets deliver true phytoncide benefits without heating the delicate terpenes.
                </p>
                <div style="font-weight:800;color:#1e2d21;font-size:0.9rem;">Dr. Jens Møller</div>
                <div style="font-size:0.78rem;color:#6b8572;">Somnology Fellow · Copenhagen</div>
              </div>

              <div style="background:#f8faf7;border-radius:24px;padding:32px;border:1px solid #dce4d7;">
                <div style="color:#c47355;font-size:1.2rem;margin-bottom:12px;">“</div>
                <p style="font-size:0.95rem;line-height:1.65;color:#3d5644;margin:0 0 20px;">
                  We installed these across all 18 retreat suites in our fjord spa. Our guests consistently remark on the profound quality of morning alertness.
                </p>
                <div style="font-weight:800;color:#1e2d21;font-size:0.9rem;">Freja Nørgaard</div>
                <div style="font-size:0.78rem;color:#6b8572;">Wellness Director · Western Fjords</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    `;
  } else if (page === 'catalog') {
    // ── CATALOG: Daily Rituals & Circadian Bundles ──
    mainHtml = `
      <main style="background:#f8faf7;color:#1e2d21;padding:90px 28px;">
        <div style="max-width:1280px;margin:0 auto;">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:20px;margin-bottom:50px;padding-bottom:32px;border-bottom:1px solid #dce4d7;">
            <div>
              <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">MINDFUL SANCTUARIES</div>
              <h1 style="font-size:2.6rem;font-weight:900;color:#1e2d21;margin:0 0 12px;">Daily Wellness Packages & Botanical Refills</h1>
              <p style="color:#4c6251;font-size:1.05rem;max-width:620px;margin:0;">Choose the mindful ritual bundle suited for your living space, bedroom, or studio desk.</p>
            </div>
            <!-- Ritual Categories -->
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <span style="padding:8px 18px;border-radius:999px;background:#3a5342;color:#ffffff;font-size:0.82rem;font-weight:700;">ALL RITUALS (8)</span>
              <span style="padding:8px 18px;border-radius:999px;background:#ffffff;border:1px solid #d4decf;color:#3a5342;font-size:0.82rem;font-weight:700;">MORNING AWAKENING</span>
              <span style="padding:8px 18px;border-radius:999px;background:#ffffff;border:1px solid #d4decf;color:#3a5342;font-size:0.82rem;font-weight:700;">EVENING REST</span>
            </div>
          </div>

          <!-- Featured Ritual Highlight Banner -->
          <div class="wr-single-content-grid" style="background:linear-gradient(135deg, #ffffff 0%, #edf3eb 100%);border-radius:32px;padding:44px;border:1px solid #dce4d7;display:grid;grid-template-columns:1.1fr 0.9fr;gap:40px;align-items:center;margin-bottom:50px;box-shadow:0 12px 36px rgba(58,83,66,0.05);">
            <div>
              <div style="display:inline-block;padding:4px 14px;background:#e3ebd9;color:#3a5342;border-radius:999px;font-size:0.75rem;font-weight:700;margin-bottom:12px;">FEATURED CIRCADIAN SUITE</div>
              <h2 style="font-size:2rem;font-weight:900;color:#1e2d21;margin:0 0 12px;">${esc(primary.name)}</h2>
              <p style="color:#4c6251;font-size:1rem;line-height:1.65;margin:0 0 20px;">${esc(primary.description)}</p>
              <div style="display:flex;gap:20px;font-size:0.86rem;font-weight:700;color:#3a5342;margin-bottom:24px;">
                <span>🍃 100% Recycled Cast Stone</span>
                <span>☀️ Circadian Lighting</span>
                <span>🌲 FSC Birch Wood</span>
              </div>
              <a href="${path(`products/${primary.id}/index.html`)}" style="display:inline-block;padding:14px 32px;border-radius:999px;background:#3a5342;color:#ffffff;text-decoration:none;font-size:0.9rem;font-weight:700;box-shadow:0 4px 14px rgba(58,83,66,0.25);">
                Explore Full Ritual Details ↗
              </a>
            </div>
            <div style="text-align:center;">
              <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;max-height:280px;object-fit:contain;filter:drop-shadow(0 15px 30px rgba(58,83,66,0.1));">
            </div>
          </div>

          <!-- Ritual Grid -->
          <div class="sd-spec-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:32px;">
            ${products.map((p, idx) => {
              const pImg = p.imageAssetId ? ctx.asset(p.imageAssetId) : (SINGLE_WELLNESS_EDITIONS[idx % SINGLE_WELLNESS_EDITIONS.length]?.img || SINGLE_WELLNESS_DEFAULT.img);
              return `
                <div style="background:#ffffff;border-radius:24px;padding:32px;border:1px solid #dce4d7;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 10px 30px rgba(58,83,66,0.04);">
                  <div style="text-align:center;margin-bottom:20px;">
                    <img src="${esc(pImg)}" alt="${esc(p.name)}" style="width:100%;max-height:220px;object-fit:contain;">
                  </div>
                  <div>
                    <div style="font-size:0.75rem;font-weight:700;color:#4a6755;text-transform:uppercase;margin-bottom:6px;">RITUAL SET // 0${idx + 1}</div>
                    <h3 style="font-size:1.25rem;font-weight:800;color:#1e2d21;margin:0 0 8px;">${esc(p.name)}</h3>
                    <p style="font-size:0.9rem;color:#4c6251;line-height:1.55;margin:0 0 20px;">${esc(p.description)}</p>
                    <div style="display:flex;gap:12px;">
                      <a href="${path(`products/${p.id}/index.html`)}" style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:999px;border:1px solid #3a5342;color:#3a5342;font-size:0.86rem;font-weight:700;">
                        Details
                      </a>
                      <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:999px;background:#3a5342;color:#ffffff;font-size:0.86rem;font-weight:700;box-shadow:0 4px 12px rgba(58,83,66,0.2);">
                        Order Set
                      </a>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </main>
    `;
  } else if (page === 'detail') {
    // ── DETAIL: Biophilic Object & Circadian Dial ──
    mainHtml = `
      <main style="background:#f8faf7;color:#1e2d21;padding:90px 28px;">
        <div style="max-width:1280px;margin:0 auto;">
          <!-- Dual Column Main -->
          <div class="sa-detail-grid" style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;align-items:center;margin-bottom:60px;">
            <div style="background:#ffffff;border-radius:32px;padding:48px;border:1px solid #dce4d7;text-align:center;box-shadow:0 16px 40px rgba(58,83,66,0.06);position:relative;">
              <span style="position:absolute;top:20px;left:20px;background:#e3ebd9;color:#3a5342;padding:4px 12px;border-radius:999px;font-size:0.75rem;font-weight:700;">COPENHAGEN DESIGN SEAL</span>
              <img id="wr-detail-main-img" data-wr-material-image="product-main" data-wr-material-product="${esc(mainProduct.id)}" src="${esc(mainImg)}" alt="${esc(mainProduct.name)}" style="width:100%;max-height:460px;object-fit:contain;">
            </div>

            <div>
              <div style="display:inline-block;padding:6px 16px;background:#e3ebd9;color:#3a5342;border-radius:999px;font-size:0.75rem;font-weight:700;margin-bottom:14px;">
                CERTIFIED BIOPHILIC LIVING
              </div>
              <h1 style="font-size:2.4rem;font-weight:900;color:#1e2d21;margin:0 0 16px;">${esc(mainProduct.name)}</h1>
              <p style="font-size:1.1rem;color:#4c6251;line-height:1.65;margin:0 0 28px;">${esc(mainProduct.description)}</p>

              <div style="background:#ffffff;border-radius:20px;padding:28px;border:1px solid #dce4d7;box-shadow:0 4px 16px rgba(58,83,66,0.03);margin-bottom:32px;font-size:0.9rem;color:#3a5342;">
                <p style="margin:0 0 10px;"><strong>Sustainable Materials:</strong> ${esc(mainProduct.material || 'Recycled Cast Stone + FSC Birch Wood')}</p>
                <p style="margin:0 0 10px;"><strong>Dimensions:</strong> ${esc(mainProduct.dimensions || '160 × 160 × 210 mm · 850g weighted')}</p>
                <p style="margin:0;"><strong>Safety Standard:</strong> 100% BPA-Free, Lead-Free & Hypoallergenic.</p>
              </div>

              <div style="display:flex;gap:16px;">
                <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="padding:16px 36px;border-radius:999px;background:#3a5342;color:#ffffff;text-decoration:none;font-size:0.95rem;font-weight:700;box-shadow:0 6px 20px rgba(58,83,66,0.25);">
                  Order Ritual Bundle ↗
                </a>
              </div>
            </div>
          </div>

          <!-- Circadian Schedule Visualization Dial -->
          <div style="background:#ffffff;border-radius:32px;padding:48px;border:1px solid #dce4d7;margin-bottom:60px;box-shadow:0 10px 30px rgba(58,83,66,0.04);">
            <div style="text-align:center;max-width:680px;margin:0 auto 40px;">
              <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">BIOMETRIC ILLUMINATION</div>
              <h2 style="font-size:2rem;font-weight:900;color:#1e2d21;margin:0 0 12px;">Full-Spectrum Daylight Kelvin Curve</h2>
              <p style="color:#4c6251;font-size:0.95rem;">Gentle color temperature modulation calibrated to natural human retinal ganglion cells.</p>
            </div>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:20px;">
              <div style="background:#f8faf7;border-radius:20px;padding:24px;border:1px solid #dce4d7;text-align:center;">
                <div style="font-size:1.8rem;margin-bottom:8px;">🌅</div>
                <div style="font-weight:800;color:#c47355;margin-bottom:4px;">06:30 - 08:30</div>
                <div style="font-size:1.2rem;font-weight:900;color:#1e2d21;">2700K → 4800K</div>
                <div style="font-size:0.8rem;color:#4c6251;margin-top:4px;">Sunrise awakening curve</div>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;border:1px solid #dce4d7;text-align:center;">
                <div style="font-size:1.8rem;margin-bottom:8px;">☀️</div>
                <div style="font-weight:800;color:#3a5342;margin-bottom:4px;">09:00 - 16:00</div>
                <div style="font-size:1.2rem;font-weight:900;color:#1e2d21;">5500K Clean</div>
                <div style="font-size:0.8rem;color:#4c6251;margin-top:4px;">High-focus daylight flow</div>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;border:1px solid #dce4d7;text-align:center;">
                <div style="font-size:1.8rem;margin-bottom:8px;">🌇</div>
                <div style="font-weight:800;color:#c47355;margin-bottom:4px;">18:00 - 21:00</div>
                <div style="font-size:1.2rem;font-weight:900;color:#1e2d21;">2700K Warm</div>
                <div style="font-size:0.8rem;color:#4c6251;margin-top:4px;">Sunset wind-down mode</div>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;border:1px solid #dce4d7;text-align:center;">
                <div style="font-size:1.8rem;margin-bottom:8px;">🌙</div>
                <div style="font-weight:800;color:#6b5278;margin-bottom:4px;">21:30 - Sleep</div>
                <div style="font-size:1.2rem;font-weight:900;color:#1e2d21;">1800K Amber</div>
                <div style="font-size:0.8rem;color:#4c6251;margin-top:4px;">Zero blue light sanctuary</div>
              </div>
            </div>
          </div>

          <!-- Unboxing Sensory Kit -->
          <div style="background:#ffffff;border-radius:32px;padding:48px;border:1px solid #dce4d7;box-shadow:0 10px 30px rgba(58,83,66,0.04);">
            <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">WHAT’S INSIDE</div>
            <h2 style="font-size:1.8rem;font-weight:900;color:#1e2d21;margin:0 0 28px;">The Complete Mindful Ritual Unboxing</h2>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:24px;">
              <div style="background:#f8faf7;border-radius:20px;padding:24px;text-align:center;border:1px solid #dce4d7;">
                <div style="font-size:2rem;margin-bottom:8px;">🏺</div>
                <div style="font-weight:800;color:#1e2d21;margin-bottom:4px;">Cast Stone Diffuser</div>
                <div style="font-size:0.82rem;color:#4c6251;">Weighted stable base</div>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;text-align:center;border:1px solid #dce4d7;">
                <div style="font-size:2rem;margin-bottom:8px;">🌿</div>
                <div style="font-weight:800;color:#1e2d21;margin-bottom:4px;">3 Botanical Oils</div>
                <div style="font-size:0.82rem;color:#4c6251;">Morning, Focus, Sleep 15ml</div>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;text-align:center;border:1px solid #dce4d7;">
                <div style="font-size:2rem;margin-bottom:8px;">🧶</div>
                <div style="font-weight:800;color:#1e2d21;margin-bottom:4px;">Nordic Linen Pouch</div>
                <div style="font-size:0.82rem;color:#4c6251;">Handmade organic cotton</div>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;text-align:center;border:1px solid #dce4d7;">
                <div style="font-size:2rem;margin-bottom:8px;">🌱</div>
                <div style="font-weight:800;color:#1e2d21;margin-bottom:4px;">Planting Certificate</div>
                <div style="font-size:0.82rem;color:#4c6251;">10 trees planted in Denmark</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else if (page === 'about') {
    // ── ABOUT: Form Follows Nature & Forestry ──
    const aboutHeadline = getAboutHeadline(draft.company, 'Form Follows Nature');
    const paragraphs = getAboutStoryParagraphs(draft.company);

    mainHtml = `
      <main style="background:#f8faf7;color:#1e2d21;padding:90px 28px;">
        <div style="max-width:1100px;margin:0 auto;">
          <div style="max-width:880px;margin-bottom:60px;">
            <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">NORDIC DESIGN ETHOS</div>
            <h1 style="font-size:2.8rem;font-weight:900;color:#1e2d21;margin:0 0 24px;">${esc(aboutHeadline)}</h1>

            <div style="font-size:1.12rem;line-height:1.8;color:#3d5042;margin-bottom:48px;">
              ${paragraphs.length ? paragraphs.map(p => `<p style="margin-bottom:20px;">${esc(p)}</p>`).join('') : `
                <p style="margin-bottom:20px;">Born in Copenhagen, our studio creates calm in a world overwhelmed by synthetic noise. We believe in designing one single mindful instrument that harmonizes human physiology with the cycles of the sun.</p>
                <p style="margin-bottom:20px;">By using zero plastics and working exclusively with cast mineral stone and reclaimed Nordic birch, every object we produce is meant to breathe longevity, tranquility, and natural balance into your sanctuary.</p>
              `}
            </div>

            <div style="background:#ffffff;border-radius:24px;padding:36px;border:1px solid #dce4d7;text-align:center;box-shadow:0 8px 24px rgba(58,83,66,0.04);">
              <div style="font-size:2rem;margin-bottom:8px;">🌿</div>
              <div style="font-size:1.1rem;font-weight:800;color:#1e2d21;margin-bottom:6px;">B-Corp Certified & Climate Neutral</div>
              <p style="color:#4c6251;font-size:0.92rem;margin:0;">Every purchase funds 10 planted native trees in Danish regenerative conservation forests.</p>
            </div>
          </div>

          <!-- The 3 Pillars of Living Well -->
          <div style="background:#ffffff;border-radius:32px;padding:48px;border:1px solid #dce4d7;box-shadow:0 10px 30px rgba(58,83,66,0.04);">
            <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">FOUR STUDIO PRINCIPLES</div>
            <h2 style="font-size:2rem;font-weight:900;color:#1e2d21;margin:0 0 32px;">How We Design for Human Senses</h2>

            <div class="wr-single-content-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:24px;">
              <div style="background:#f8faf7;border-radius:20px;padding:24px;border:1px solid #dce4d7;">
                <div style="font-size:1.8rem;margin-bottom:8px;">☀️</div>
                <h3 style="font-size:1.1rem;font-weight:800;color:#1e2d21;margin:0 0 8px;">Solar Sync</h3>
                <p style="font-size:0.85rem;color:#4c6251;line-height:1.55;margin:0;">Matching natural kelvin transitions without harsh artificial blue spikes.</p>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;border:1px solid #dce4d7;">
                <div style="font-size:1.8rem;margin-bottom:8px;">🪨</div>
                <h3 style="font-size:1.1rem;font-weight:800;color:#1e2d21;margin:0 0 8px;">Mineral Purity</h3>
                <p style="font-size:0.85rem;color:#4c6251;line-height:1.55;margin:0;">Cast minerals and birch wood replacing synthetic polycarbonates.</p>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;border:1px solid #dce4d7;">
                <div style="font-size:1.8rem;margin-bottom:8px;">🔇</div>
                <h3 style="font-size:1.1rem;font-weight:800;color:#1e2d21;margin:0 0 8px;">Sub-18dB Silence</h3>
                <p style="font-size:0.85rem;color:#4c6251;line-height:1.55;margin:0;">Quieter than falling pine needles, promoting uninterrupted deep sleep.</p>
              </div>
              <div style="background:#f8faf7;border-radius:20px;padding:24px;border:1px solid #dce4d7;">
                <div style="font-size:1.8rem;margin-bottom:8px;">🌲</div>
                <h3 style="font-size:1.1rem;font-weight:800;color:#1e2d21;margin:0 0 8px;">Regenerative</h3>
                <p style="font-size:0.85rem;color:#4c6251;line-height:1.55;margin:0;">Giving back ten times the natural biomass consumed in production.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else {
    // ── CONTACT: Mindful Living Partnerships ──
    mainHtml = `
      <main style="background:#f8faf7;color:#1e2d21;padding:90px 28px;">
        <div style="max-width:1100px;margin:0 auto;">
          <div class="wr-single-content-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:flex-start;">
            <div>
              <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">GET IN TOUCH</div>
              <h1 style="font-size:2.6rem;font-weight:900;color:#1e2d21;margin:0 0 16px;">Mindful Living Partnerships</h1>
              <p style="color:#4c6251;font-size:1.05rem;line-height:1.6;margin-bottom:40px;">Connect with our Copenhagen studio for spa installations, corporate wellness programs, and boutique distribution.</p>

              <form action="${esc(ctx.options.inquiryUrl)}" method="post" style="background:#ffffff;border-radius:24px;border:1px solid #dce4d7;padding:40px;display:flex;flex-direction:column;gap:24px;box-shadow:0 12px 30px rgba(58,83,66,0.04);">
                <div>
                  <label style="display:block;font-size:0.85rem;font-weight:700;color:#3a5342;margin-bottom:8px;">Your Email Address</label>
                  <input type="email" name="email" required placeholder="name@wellness-studio.com" style="width:100%;padding:14px;border:1px solid #d4decf;border-radius:12px;background:#fbfcf9;font-size:0.95rem;color:#1e2d21;">
                </div>
                <div>
                  <label style="display:block;font-size:0.85rem;font-weight:700;color:#3a5342;margin-bottom:8px;">Select Wellness Instrument</label>
                  <select name="productId" style="width:100%;padding:14px;border:1px solid #d4decf;border-radius:12px;background:#fbfcf9;font-size:0.95rem;color:#1e2d21;">
                    <option value="">— Select Studio Ritual —</option>
                    ${products.map(p => `<option value="${esc(p.id)}"${p.id === options.productId ? ' selected' : ''}>${esc(ctx.translateProduct(p).name)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block;font-size:0.85rem;font-weight:700;color:#3a5342;margin-bottom:8px;">Partnership Message</label>
                  <textarea name="message" rows="5" required placeholder="Tell us about your space, retail boutique, or hotel wellness project." style="width:100%;padding:14px;border:1px solid #d4decf;border-radius:12px;background:#fbfcf9;font-size:0.95rem;color:#1e2d21;"></textarea>
                </div>
                <button type="submit" style="padding:16px;background:#3a5342;color:#ffffff;border:none;border-radius:999px;font-size:0.95rem;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(58,83,66,0.25);">
                  Send Partnership Inquiry ↗
                </button>
              </form>
            </div>

            <!-- Right: Studio Network -->
            <div style="display:flex;flex-direction:column;gap:24px;">
              <div style="background:#ffffff;border-radius:24px;border:1px solid #dce4d7;padding:32px;box-shadow:0 8px 24px rgba(58,83,66,0.03);">
                <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">VISITING STUDIOS</div>
                <div style="display:flex;flex-direction:column;gap:16px;font-size:0.9rem;">
                  <div>
                    <strong style="color:#1e2d21;display:block;">COPENHAGEN CANAL STUDIO</strong>
                    Bredgade 24 · 1260 Copenhagen K · Denmark
                  </div>
                  <div>
                    <strong style="color:#1e2d21;display:block;">STOCKHOLM SANCTUARY</strong>
                    Södermalm Strand 8 · Stockholm · Sweden
                  </div>
                  <div>
                    <strong style="color:#1e2d21;display:block;">KYOTO BIOPHILIC PAVILION</strong>
                    Higashiyama Ward · Kyoto · Japan
                  </div>
                </div>
              </div>

              <div style="background:#edf3ec;border-radius:24px;border:1px solid #d5e2d2;padding:32px;">
                <div style="color:#3a5342;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">SUSTAINABILITY & TRADE INQUIRIES</div>
                <p style="font-size:0.88rem;color:#3d5644;line-height:1.65;margin:0;">
                  We provide custom wooden mounting brackets and volume botanical refill cartridges for hotels, architectural studios, and luxury spas worldwide.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  return `${headerHtml}${mainHtml}${footerHtml}`;
}
