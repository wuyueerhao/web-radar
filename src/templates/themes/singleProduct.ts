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
// 1. SINGLE DEVICE SHOWCASE (Cyber Keynote Dark High-Tech)
// ─────────────────────────────────────────────────────────────────────────────

function renderSingleDevicePage(ctx: ThemeContext): string {
  const { draft, options, path, navAttrs, ui } = ctx;
  const page = options.page || 'home';
  const company = draft.company;
  const brandName = company.name || 'CYBERKEYNOTE';

  // Extract products
  const products = draft.products.length > 0 ? draft.products : [];
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
    <header style="position:sticky;top:0;z-index:90;background:rgba(8,9,14,0.85);backdrop-filter:blur(16px);border-bottom:1px solid rgba(0,240,255,0.15);padding:14px 24px;">
      <div style="max-width:1320px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:20px;">
        <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;display:flex;align-items:center;gap:12px;">
          <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg, #00f0ff 0%, #0066ff 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(0,240,255,0.5);">
            <span style="color:#08090e;font-size:1.1rem;font-weight:900;font-family:monospace;">◈</span>
          </div>
          <div>
            <div style="font-size:1.05rem;font-weight:900;letter-spacing:0.08em;color:#ffffff;text-transform:uppercase;font-family:system-ui,sans-serif;">${esc(brandName)}</div>
            <div style="font-size:0.68rem;letter-spacing:0.18em;color:#00f0ff;text-transform:uppercase;font-family:monospace;">SYSTEM // ONLINE</div>
          </div>
        </a>
        <nav style="display:flex;align-items:center;gap:24px;">
          <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;color:rgba(255,255,255,0.85);font-size:0.86rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">${esc(ui.home)}</a>
          <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;color:rgba(255,255,255,0.85);font-size:0.86rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Editions</a>
          <a href="${path('about/index.html')}" ${navAttrs('about')} style="text-decoration:none;color:rgba(255,255,255,0.85);font-size:0.86rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">${esc(ui.about)}</a>
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;color:rgba(255,255,255,0.85);font-size:0.86rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">${esc(ui.contact)}</a>
        </nav>
        <div style="display:flex;align-items:center;gap:12px;">
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;padding:10px 20px;border-radius:6px;background:linear-gradient(90deg, #00f0ff, #0070f3);color:#08090e;font-size:0.84rem;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;box-shadow:0 0 20px rgba(0,240,255,0.4);">
            Pre-Order Unit ↗
          </a>
        </div>
      </div>
    </header>
  `;

  const footerHtml = `
    <footer style="background:#040508;color:rgba(255,255,255,0.7);padding:60px 24px 32px;border-top:1px solid rgba(0,240,255,0.12);">
      <div style="max-width:1320px;margin:0 auto;">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px;">
          <div>
            <div style="font-size:1.15rem;font-weight:900;color:#ffffff;letter-spacing:0.06em;margin-bottom:12px;text-transform:uppercase;">${esc(brandName)}</div>
            <p style="font-size:0.85rem;line-height:1.6;color:rgba(255,255,255,0.6);max-width:320px;">
              ${esc(company.description || 'Pioneering bionic hardware engineering and zero-latency audio architecture for visionary creators worldwide.')}
            </p>
            <div style="display:flex;gap:12px;margin-top:16px;">${ctx.socials}</div>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.12em;color:#00f0ff;text-transform:uppercase;margin-bottom:14px;font-family:monospace;">// Navigation</div>
            <a href="${path('index.html')}" ${navAttrs('home')} style="display:block;color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85rem;padding:4px 0;">${esc(ui.home)}</a>
            <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="display:block;color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85rem;padding:4px 0;">Hardware Editions</a>
            <a href="${path('about/index.html')}" ${navAttrs('about')} style="display:block;color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85rem;padding:4px 0;">Engineering Manifesto</a>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.12em;color:#00f0ff;text-transform:uppercase;margin-bottom:14px;font-family:monospace;">// Support</div>
            <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="display:block;color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85rem;padding:4px 0;">Developer & B2B Inquiry</a>
            <a href="mailto:${esc(company.email)}" style="display:block;color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85rem;padding:4px 0;">${esc(company.email)}</a>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.12em;color:#00f0ff;text-transform:uppercase;margin-bottom:14px;font-family:monospace;">// Global HQ</div>
            <p style="font-size:0.85rem;color:rgba(255,255,255,0.6);line-height:1.5;">${esc(company.address || 'Tokyo · San Francisco · Munich R&D Labs')}</p>
          </div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:rgba(255,255,255,0.4);font-family:monospace;">
          <span>&copy; ${new Date().getUTCFullYear()} ${esc(brandName)}. ALL SYSTEMS NORMAL.</span>
          <div class="languages" style="display:flex;gap:8px;">${ctx.languageLinks}</div>
        </div>
      </div>
    </footer>
  `;

  let mainHtml = '';

  if (page === 'home') {
    mainHtml = `
      <main style="background:#08090e;color:#ffffff;overflow:hidden;">
        <!-- HERO STAGE -->
        <section style="position:relative;padding:90px 24px 100px;min-height:92vh;display:flex;align-items:center;justify-content:center;border-bottom:1px solid rgba(0,240,255,0.12);">
          <div style="position:absolute;top:20%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;border-radius:50%;background:radial-gradient(circle, rgba(0,240,255,0.12) 0%, rgba(99,102,241,0.04) 50%, transparent 70%);pointer-events:none;filter:blur(40px);"></div>
          
          <div style="max-width:1320px;width:100%;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;position:relative;">
            <div>
              <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:4px;background:rgba(0,240,255,0.08);border:1px solid rgba(0,240,255,0.3);color:#00f0ff;font-size:0.75rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;font-family:monospace;margin-bottom:24px;">
                <span style="width:6px;height:6px;border-radius:50%;background:#00f0ff;box-shadow:0 0 8px #00f0ff;"></span>
                Flagship Single-Product Keynote
              </div>
              <h1 style="font-size:clamp(2.4rem, 5vw, 3.8rem);font-weight:900;line-height:1.06;letter-spacing:-0.03em;margin:0 0 20px;background:linear-gradient(135deg, #ffffff 40%, rgba(255,255,255,0.6) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
                ${esc(draft.copy[ctx.lang]?.headline || primary.name)}
              </h1>
              <p style="font-size:1.15rem;line-height:1.6;color:rgba(255,255,255,0.7);margin:0 0 32px;max-width:540px;">
                ${esc(draft.copy[ctx.lang]?.subtitle || primary.description)}
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:48px;">
                <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;padding:15px 32px;border-radius:6px;background:linear-gradient(90deg, #00f0ff, #0070f3);color:#08090e;font-size:0.96rem;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;box-shadow:0 0 25px rgba(0,240,255,0.45);">
                  Configure & Order ↗
                </a>
                <a href="#architecture" style="text-decoration:none;padding:15px 28px;border-radius:6px;background:rgba(255,255,255,0.05);color:#ffffff;border:1px solid rgba(255,255,255,0.2);font-size:0.96rem;font-weight:700;">
                  Explore Architecture ↓
                </a>
              </div>
              <!-- Telemetry indicators -->
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);">
                <div>
                  <div style="font-size:1.4rem;font-weight:900;color:#00f0ff;font-family:monospace;">0.12ms</div>
                  <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-top:2px;">Ultra-Low Latency</div>
                </div>
                <div>
                  <div style="font-size:1.4rem;font-weight:900;color:#00f0ff;font-family:monospace;">Titanium</div>
                  <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-top:2px;">Aerospace Unibody</div>
                </div>
                <div>
                  <div style="font-size:1.4rem;font-weight:900;color:#00f0ff;font-family:monospace;">48 Hrs</div>
                  <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-top:2px;">Continuous Power</div>
                </div>
              </div>
            </div>

            <!-- Pedestal Visual -->
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;width:380px;height:380px;border-radius:50%;border:1px dashed rgba(0,240,255,0.3);animation:wrSpin 30s linear infinite;"></div>
              <div style="position:absolute;width:460px;height:460px;border-radius:50%;border:1px solid rgba(0,112,243,0.15);"></div>
              <div style="position:relative;background:radial-gradient(circle, rgba(17,19,28,0.9) 0%, rgba(8,9,14,0.95) 100%);padding:36px;border-radius:24px;border:1px solid rgba(0,240,255,0.25);box-shadow:0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,240,255,0.15);width:100%;max-width:440px;">
                <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 15px 30px rgba(0,240,255,0.2));">
                
                <!-- Floating HUD Chips -->
                <div style="position:absolute;top:20px;left:-20px;background:rgba(8,9,14,0.9);backdrop-filter:blur(8px);border:1px solid rgba(0,240,255,0.4);border-radius:6px;padding:6px 12px;font-family:monospace;font-size:0.72rem;color:#00f0ff;box-shadow:0 4px 16px rgba(0,0,0,0.5);">
                  CORE // 9.8 TFLOPS DSP
                </div>
                <div style="position:absolute;bottom:30px;right:-20px;background:rgba(8,9,14,0.9);backdrop-filter:blur(8px);border:1px solid rgba(99,102,241,0.4);border-radius:6px;padding:6px 12px;font-family:monospace;font-size:0.72rem;color:#a5b4fc;box-shadow:0 4px 16px rgba(0,0,0,0.5);">
                  IP68 // 50M SUBMERSIBLE
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- HORIZONTAL TICKER -->
        <section style="background:#040508;border-bottom:1px solid rgba(0,240,255,0.1);padding:18px 24px;font-family:monospace;font-size:0.8rem;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.12em;">
          <div style="max-width:1320px;margin:0 auto;display:flex;justify-content:space-between;flex-wrap:wrap;gap:20px;">
            <span>◈ ACOUSTIC RESOLUTION: 384kHz / 32-BIT</span>
            <span>◈ THD+N DISTORTION: &lt; 0.0003%</span>
            <span>◈ BLUETOOTH 5.4 + ULTRA-WIDEBAND</span>
            <span>◈ AIR-DROP READY</span>
          </div>
        </section>

        <!-- ARCHITECTURE BENTO GRID -->
        <section id="architecture" style="padding:90px 24px;max-width:1320px;margin:0 auto;">
          <div style="text-align:center;max-width:680px;margin:0 auto 60px;">
            <div style="color:#00f0ff;font-family:monospace;font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">// SYSTEM ARCHITECTURE</div>
            <h2 style="font-size:2.4rem;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;">Engineered to the Atomic Micron</h2>
            <p style="color:rgba(255,255,255,0.65);font-size:1.05rem;line-height:1.6;">Every millimeter of internal volume is calibrated to eliminate thermal dissipation constraints and maximize harmonic resonance.</p>
          </div>

          <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:24px;margin-bottom:24px;">
            <div style="background:rgba(17,19,28,0.6);border:1px solid rgba(0,240,255,0.18);border-radius:16px;padding:36px;position:relative;overflow:hidden;">
              <div style="position:absolute;top:0;right:0;width:240px;height:240px;background:radial-gradient(circle, rgba(0,240,255,0.08) 0%, transparent 70%);pointer-events:none;"></div>
              <div style="font-size:0.75rem;color:#00f0ff;font-family:monospace;margin-bottom:12px;">MODULE 01 // COMPUTATIONAL ACOUSTICS</div>
              <h3 style="font-size:1.5rem;font-weight:800;margin:0 0 12px;">Neural Acoustic DSP Engine</h3>
              <p style="color:rgba(255,255,255,0.65);font-size:0.95rem;line-height:1.6;margin-bottom:24px;">Real-time continuous 192-point acoustic calibration that adapts to room geometry, temperature, and ambient noise profiles within 2 milliseconds.</p>
              <div style="height:100px;background:rgba(0,0,0,0.4);border-radius:8px;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;gap:4px;padding:0 20px;">
                ${Array.from({ length: 32 }, (_, i) => `<div style="flex:1;background:linear-gradient(to top, #0070f3, #00f0ff);height:${Math.sin(i * 0.4) * 35 + 45}%;border-radius:2px;opacity:0.85;"></div>`).join('')}
              </div>
            </div>

            <div style="background:rgba(17,19,28,0.6);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:36px;">
              <div style="font-size:0.75rem;color:#a5b4fc;font-family:monospace;margin-bottom:12px;">MODULE 02 // CHASSIS ALLOY</div>
              <h3 style="font-size:1.5rem;font-weight:800;margin:0 0 12px;">Grade-5 Titanium Exoskeleton</h3>
              <p style="color:rgba(255,255,255,0.65);font-size:0.95rem;line-height:1.6;">Precision CNC milled from solid aerospace titanium billets. 40% lighter than surgical steel, with zero flex and zero acoustic coloration.</p>
              <div style="margin-top:20px;padding:12px 16px;background:rgba(0,0,0,0.5);border-radius:8px;font-family:monospace;font-size:0.8rem;color:#00f0ff;">
                SPEC: Ti-6Al-4V · DENSITY 4.43 g/cm³ · TENSILE 950 MPa
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:24px;">
            <div style="background:rgba(17,19,28,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;">
              <div style="font-size:1.8rem;margin-bottom:12px;">⚡</div>
              <h4 style="font-size:1.15rem;font-weight:800;margin:0 0 8px;">Magnetic MagLock Dock</h4>
              <p style="color:rgba(255,255,255,0.6);font-size:0.88rem;line-height:1.5;">Snaps onto any metallic surface or desktop pedestal with 15W Qi2 wireless induction charging.</p>
            </div>
            <div style="background:rgba(17,19,28,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;">
              <div style="font-size:1.8rem;margin-bottom:12px;">🔒</div>
              <h4 style="font-size:1.15rem;font-weight:800;margin:0 0 8px;">End-to-End Privacy Enclave</h4>
              <p style="color:rgba(255,255,255,0.6);font-size:0.88rem;line-height:1.5;">Local on-device audio telemetry processing. No voice or acoustic data ever transmits over external networks.</p>
            </div>
            <div style="background:rgba(17,19,28,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;">
              <div style="font-size:1.8rem;margin-bottom:12px;">🛡️</div>
              <h4 style="font-size:1.15rem;font-weight:800;margin:0 0 8px;">5-Year Global Warranty</h4>
              <p style="color:rgba(255,255,255,0.6);font-size:0.88rem;line-height:1.5;">Express replacement program and dedicated hardware concierge for certified enterprise deployments.</p>
            </div>
          </div>
        </section>

        <!-- EXPLODED LAYER BREAKDOWN -->
        <section style="background:#05060a;padding:90px 24px;border-top:1px solid rgba(0,240,255,0.1);border-bottom:1px solid rgba(0,240,255,0.1);">
          <div style="max-width:1320px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
            <div>
              <div style="color:#00f0ff;font-family:monospace;font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;">// EXPLODED ANATOMY</div>
              <h2 style="font-size:2.2rem;font-weight:900;margin:0 0 20px;">Four Layers of Pure Acoustic Precision</h2>
              <p style="color:rgba(255,255,255,0.65);font-size:1rem;line-height:1.6;margin-bottom:32px;">Every component is bonded with micro-tolerances under 5 microns, delivering uncompromised acoustic fidelity.</p>

              <div style="display:flex;flex-direction:column;gap:16px;">
                <div style="padding:16px 20px;border-left:3px solid #00f0ff;background:rgba(17,19,28,0.4);border-radius:0 8px 8px 0;">
                  <div style="font-size:0.8rem;color:#00f0ff;font-family:monospace;">LAYER 01</div>
                  <div style="font-weight:800;font-size:1rem;margin:2px 0;">Sapphire Crystal Capacitive Matrix</div>
                  <div style="font-size:0.84rem;color:rgba(255,255,255,0.55);">Scratch-proof optical grade sapphire with sub-millimeter gesture sensitivity.</div>
                </div>
                <div style="padding:16px 20px;border-left:3px solid #0070f3;background:rgba(17,19,28,0.4);border-radius:0 8px 8px 0;">
                  <div style="font-size:0.8rem;color:#0070f3;font-family:monospace;">LAYER 02</div>
                  <div style="font-weight:800;font-size:1rem;margin:2px 0;">Quad-Core Neural Audio Processor</div>
                  <div style="font-size:0.84rem;color:rgba(255,255,255,0.55);">55nm ultra-low-power silicon delivering 12-channel real-time spatial synthesis.</div>
                </div>
                <div style="padding:16px 20px;border-left:3px solid #a855f7;background:rgba(17,19,28,0.4);border-radius:0 8px 8px 0;">
                  <div style="font-size:0.8rem;color:#a855f7;font-family:monospace;">LAYER 03</div>
                  <div style="font-weight:800;font-size:1rem;margin:2px 0;">Neodymium N52 Magnetic Flux Motor</div>
                  <div style="font-size:0.84rem;color:rgba(255,255,255,0.55);">Highest flux density permanent magnet driving a carbon-nanotube composite dome.</div>
                </div>
                <div style="padding:16px 20px;border-left:3px solid #10b981;background:rgba(17,19,28,0.4);border-radius:0 8px 8px 0;">
                  <div style="font-size:0.8rem;color:#10b981;font-family:monospace;">LAYER 04</div>
                  <div style="font-weight:800;font-size:1rem;margin:2px 0;">CNC Resonant Titanium Back-Chamber</div>
                  <div style="font-size:0.84rem;color:rgba(255,255,255,0.55);">Acoustically tuned waveguide chamber completely preventing back-wave interference.</div>
                </div>
              </div>
            </div>

            <div style="text-align:center;">
              <img src="${esc(mainImg)}" alt="Exploded Architecture" style="width:100%;max-width:480px;filter:drop-shadow(0 20px 40px rgba(0,240,255,0.25));">
            </div>
          </div>
        </section>

        <!-- SINGLE PRODUCT PACKAGE CONFIGURATOR -->
        <section style="padding:90px 24px;max-width:1320px;margin:0 auto;">
          <div style="text-align:center;max-width:680px;margin:0 auto 60px;">
            <div style="color:#00f0ff;font-family:monospace;font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;">// ORDER CONFIGURATIONS</div>
            <h2 style="font-size:2.4rem;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;">Select Your Production Tier</h2>
            <p style="color:rgba(255,255,255,0.65);font-size:1.05rem;line-height:1.6;">Direct factory allocation with global expedited delivery and dedicated developer SDK access.</p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:28px;">
            <!-- Tier 1 -->
            <div style="background:#0f111a;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:36px;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <div style="font-size:0.8rem;font-family:monospace;color:rgba(255,255,255,0.5);margin-bottom:8px;">TIER 01 // ESSENTIALS</div>
                <h3 style="font-size:1.4rem;font-weight:800;margin:0 0 12px;">Standard Device Kit</h3>
                <div style="font-size:2rem;font-weight:900;color:#ffffff;margin-bottom:20px;">$499 <span style="font-size:0.85rem;color:rgba(255,255,255,0.5);font-weight:400;">/ unit</span></div>
                <ul style="padding-left:18px;color:rgba(255,255,255,0.7);font-size:0.9rem;line-height:1.8;margin:0 0 28px;">
                  <li>Flagship Titanium Hardware Terminal</li>
                  <li>Braided Kevlar USB-C Quick Cable (2m)</li>
                  <li>Standard Protective Microfiber Sleeve</li>
                  <li>2-Year Global Hardware Warranty</li>
                </ul>
              </div>
              <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-align:center;text-decoration:none;padding:12px;border-radius:6px;background:rgba(255,255,255,0.08);color:#ffffff;font-size:0.88rem;font-weight:700;border:1px solid rgba(255,255,255,0.2);">
                Inquire Tier 1
              </a>
            </div>

            <!-- Tier 2 (Featured) -->
            <div style="background:linear-gradient(180deg, #121829 0%, #0c101c 100%);border:2px solid #00f0ff;border-radius:16px;padding:36px;display:flex;flex-direction:column;justify-content:space-between;position:relative;box-shadow:0 0 40px rgba(0,240,255,0.18);">
              <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#00f0ff;color:#08090e;font-size:0.72rem;font-weight:900;padding:4px 14px;border-radius:999px;font-family:monospace;letter-spacing:0.08em;">
                POPULAR CHOICE
              </div>
              <div>
                <div style="font-size:0.8rem;font-family:monospace;color:#00f0ff;margin-bottom:8px;">TIER 02 // CREATOR STUDIO</div>
                <h3 style="font-size:1.4rem;font-weight:800;margin:0 0 12px;">Studio Creator Bundle</h3>
                <div style="font-size:2rem;font-weight:900;color:#00f0ff;margin-bottom:20px;">$699 <span style="font-size:0.85rem;color:rgba(255,255,255,0.5);font-weight:400;">/ unit</span></div>
                <ul style="padding-left:18px;color:rgba(255,255,255,0.85);font-size:0.9rem;line-height:1.8;margin:0 0 28px;">
                  <li>Flagship Titanium Hardware Terminal</li>
                  <li>Magnetic MagLock 15W Qi2 Desktop Dock</li>
                  <li>Milled Aluminum Hard Travel Case</li>
                  <li>Audio Developer API & Python SDK Access</li>
                  <li>3-Year Express Replacement Warranty</li>
                </ul>
              </div>
              <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-align:center;text-decoration:none;padding:12px;border-radius:6px;background:linear-gradient(90deg, #00f0ff, #0070f3);color:#08090e;font-size:0.88rem;font-weight:800;letter-spacing:0.04em;">
                Reserve Studio Bundle ↗
              </a>
            </div>

            <!-- Tier 3 -->
            <div style="background:#0f111a;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:36px;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <div style="font-size:0.8rem;font-family:monospace;color:rgba(255,255,255,0.5);margin-bottom:8px;">TIER 03 // COLLECTOR</div>
                <h3 style="font-size:1.4rem;font-weight:800;margin:0 0 12px;">Founder Collector Edition</h3>
                <div style="font-size:2rem;font-weight:900;color:#ffffff;margin-bottom:20px;">$1,199 <span style="font-size:0.85rem;color:rgba(255,255,255,0.5);font-weight:400;">/ unit</span></div>
                <ul style="padding-left:18px;color:rgba(255,255,255,0.7);font-size:0.9rem;line-height:1.8;margin:0 0 28px;">
                  <li>Limited Serialized Run (001 - 500)</li>
                  <li>Custom Laser Engraved Serial & Call-Sign</li>
                  <li>Pelican Storm Military Waterproof Vault Case</li>
                  <li>Lifetime Hardware Concierge & Direct Lab Support</li>
                  <li>VIP Invitation to Annual Keynote Labs</li>
                </ul>
              </div>
              <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-align:center;text-decoration:none;padding:12px;border-radius:6px;background:rgba(255,255,255,0.08);color:#ffffff;font-size:0.88rem;font-weight:700;border:1px solid rgba(255,255,255,0.2);">
                Inquire Collector Tier
              </a>
            </div>
          </div>
        </section>
      </main>
    `;
  } else if (page === 'catalog') {
    // ── CATALOG: Flagship Configurations & Modules ──
    mainHtml = `
      <main style="background:#08090e;color:#ffffff;padding:80px 24px;">
        <div style="max-width:1320px;margin:0 auto;">
          <div style="margin-bottom:48px;">
            <div style="color:#00f0ff;font-family:monospace;font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">// HARDWARE LINEUP</div>
            <h1 style="font-size:2.6rem;font-weight:900;margin:0 0 12px;">Hardware Editions & Bundles</h1>
            <p style="color:rgba(255,255,255,0.65);font-size:1.05rem;">Choose the precise configuration engineered for your production environment.</p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:32px;">
            ${products.map((p, idx) => {
              const pImg = p.imageAssetId ? ctx.asset(p.imageAssetId) : SINGLE_DEVICE_DEFAULT.img;
              return `
                <div style="background:#11131c;border:1px solid rgba(0,240,255,0.15);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;transition:transform 0.3s ease;">
                  <div style="padding:28px;background:radial-gradient(circle, rgba(0,240,255,0.05) 0%, transparent 70%);text-align:center;">
                    <img src="${esc(pImg)}" alt="${esc(p.name)}" style="width:100%;max-height:220px;object-fit:contain;">
                  </div>
                  <div style="padding:24px;border-top:1px solid rgba(255,255,255,0.08);flex:1;display:flex;flex-direction:column;justify-content:space-between;">
                    <div>
                      <div style="font-size:0.75rem;color:#00f0ff;font-family:monospace;margin-bottom:6px;">SPEC TIER // 0${idx + 1}</div>
                      <h3 style="font-size:1.2rem;font-weight:800;margin:0 0 8px;">${esc(p.name)}</h3>
                      <p style="font-size:0.88rem;color:rgba(255,255,255,0.6);line-height:1.5;margin:0 0 16px;">${esc(p.description)}</p>
                    </div>
                    <div style="display:flex;gap:10px;">
                      <a href="${path(`products/${p.id}/index.html`)}" style="flex:1;text-align:center;text-decoration:none;padding:10px;border-radius:6px;background:rgba(255,255,255,0.08);color:#ffffff;font-size:0.84rem;font-weight:700;border:1px solid rgba(255,255,255,0.2);">
                        Inspect Specs ↗
                      </a>
                      <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="flex:1;text-align:center;text-decoration:none;padding:10px;border-radius:6px;background:#00f0ff;color:#08090e;font-size:0.84rem;font-weight:800;">
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
    // ── DETAIL: Deep Laboratory Specification ──
    mainHtml = `
      <main style="background:#08090e;color:#ffffff;padding:80px 24px;">
        <div style="max-width:1320px;margin:0 auto;">
          <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;align-items:flex-start;margin-bottom:80px;">
            <div style="background:#11131c;border:1px solid rgba(0,240,255,0.25);border-radius:20px;padding:48px;text-align:center;box-shadow:0 0 40px rgba(0,240,255,0.1);">
              <img id="wr-detail-main-img" data-wr-material-image="product-main" data-wr-material-product="${esc(mainProduct.id)}" src="${esc(mainImg)}" alt="${esc(mainProduct.name)}" style="width:100%;max-height:480px;object-fit:contain;filter:drop-shadow(0 15px 30px rgba(0,240,255,0.2));">
            </div>

            <div>
              <div style="display:inline-block;padding:4px 12px;background:rgba(0,240,255,0.1);border:1px solid #00f0ff;color:#00f0ff;font-family:monospace;font-size:0.75rem;border-radius:4px;margin-bottom:16px;">
                CONFIRMED HARDWARE REVISION v4.2
              </div>
              <h1 style="font-size:2.4rem;font-weight:900;margin:0 0 16px;">${esc(mainProduct.name)}</h1>
              <p style="font-size:1.1rem;color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 28px;">${esc(mainProduct.description)}</p>

              <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:24px;border:1px solid rgba(255,255,255,0.1);margin-bottom:32px;">
                <div style="font-size:0.75rem;color:#00f0ff;font-family:monospace;margin-bottom:12px;">// VERIFIED TECHNICAL METRICS</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:0.88rem;">
                  <div>
                    <span style="color:rgba(255,255,255,0.5);">Materials:</span>
                    <div style="font-weight:700;color:#ffffff;margin-top:2px;">${esc(mainProduct.material || 'Grade-5 Aerospace Titanium')}</div>
                  </div>
                  <div>
                    <span style="color:rgba(255,255,255,0.5);">Dimensions:</span>
                    <div style="font-weight:700;color:#ffffff;margin-top:2px;">${esc(mainProduct.dimensions || '142 × 72 × 8.2 mm · 185g')}</div>
                  </div>
                  <div>
                    <span style="color:rgba(255,255,255,0.5);">Acoustic Protocol:</span>
                    <div style="font-weight:700;color:#ffffff;margin-top:2px;">LDAC / aptX HD / UWB 32-Bit</div>
                  </div>
                  <div>
                    <span style="color:rgba(255,255,255,0.5);">Ingress Protection:</span>
                    <div style="font-weight:700;color:#ffffff;margin-top:2px;">IP68 Submersible (50m)</div>
                  </div>
                </div>
              </div>

              <div style="display:flex;gap:16px;">
                <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="flex:1;text-align:center;text-decoration:none;padding:16px;border-radius:6px;background:linear-gradient(90deg, #00f0ff, #0070f3);color:#08090e;font-size:0.95rem;font-weight:800;letter-spacing:0.04em;">
                  Reserve Production Unit ↗
                </a>
                <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="padding:16px 24px;border-radius:6px;background:rgba(255,255,255,0.08);color:#ffffff;text-decoration:none;font-size:0.95rem;font-weight:700;border:1px solid rgba(255,255,255,0.2);">
                  Back to Editions
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else if (page === 'about') {
    // ── ABOUT: The Engineering Manifesto ──
    const aboutHeadline = getAboutHeadline(draft.company, 'The Engineering Manifesto');
    const paragraphs = getAboutStoryParagraphs(draft.company);

    mainHtml = `
      <main style="background:#08090e;color:#ffffff;padding:80px 24px;">
        <div style="max-width:960px;margin:0 auto;">
          <div style="color:#00f0ff;font-family:monospace;font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;">// LAB ORIGINS & PHILOSOPHY</div>
          <h1 style="font-size:2.8rem;font-weight:900;letter-spacing:-0.02em;margin:0 0 24px;">${esc(aboutHeadline)}</h1>
          
          <div style="font-size:1.15rem;line-height:1.75;color:rgba(255,255,255,0.8);margin-bottom:48px;">
            ${paragraphs.length ? paragraphs.map(p => `<p style="margin-bottom:20px;">${esc(p)}</p>`).join('') : `
              <p style="margin-bottom:20px;">We established this engineering lab with a singular obsession: to build one perfect hardware instrument without the compromises imposed by mass-market consumer electronics.</p>
              <p style="margin-bottom:20px;">By refusing to produce dozens of disposable models each year, our entire research team focuses every hour on refining our single flagship platform—advancing firmware, materials tolerance, and acoustic fidelity for a global community of discerning professionals.</p>
            `}
          </div>

          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:24px;padding:36px;background:#11131c;border:1px solid rgba(0,240,255,0.2);border-radius:16px;">
            <div>
              <div style="font-size:2rem;font-weight:900;color:#00f0ff;font-family:monospace;">100%</div>
              <div style="font-size:0.85rem;color:rgba(255,255,255,0.7);margin-top:4px;">Single-Product Focus</div>
            </div>
            <div>
              <div style="font-size:2rem;font-weight:900;color:#00f0ff;font-family:monospace;">5μm</div>
              <div style="font-size:0.85rem;color:rgba(255,255,255,0.7);margin-top:4px;">CNC Machining Tolerance</div>
            </div>
            <div>
              <div style="font-size:2rem;font-weight:900;color:#00f0ff;font-family:monospace;">0.003%</div>
              <div style="font-size:0.85rem;color:rgba(255,255,255,0.7);margin-top:4px;">Total Harmonic Distortion</div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else {
    // ── CONTACT ──
    mainHtml = `
      <main style="background:#08090e;color:#ffffff;padding:80px 24px;">
        <div style="max-width:800px;margin:0 auto;">
          <div style="color:#00f0ff;font-family:monospace;font-size:0.8rem;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;">// SECURE TRANSMISSION</div>
          <h1 style="font-size:2.6rem;font-weight:900;margin:0 0 16px;">Direct Laboratory & B2B Inquiry</h1>
          <p style="color:rgba(255,255,255,0.65);font-size:1.05rem;line-height:1.6;margin-bottom:40px;">For volume hardware allocation, developer kits, and certified distributor partnerships.</p>

          <form action="${esc(ctx.options.inquiryUrl)}" method="post" style="background:#11131c;border:1px solid rgba(0,240,255,0.2);border-radius:16px;padding:36px;display:flex;flex-direction:column;gap:20px;">
            <div>
              <label style="display:block;font-size:0.8rem;font-family:monospace;color:#00f0ff;margin-bottom:6px;">COMMUNICATION PROTOCOL // EMAIL</label>
              <input type="email" name="email" required placeholder="contact@organization.com" style="width:100%;padding:14px;background:#08090e;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#ffffff;font-size:0.95rem;">
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-family:monospace;color:#00f0ff;margin-bottom:6px;">HARDWARE SELECTION // PRODUCT</label>
              <select name="productId" style="width:100%;padding:14px;background:#08090e;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#ffffff;font-size:0.95rem;">
                <option value="">— Select Edition —</option>
                ${products.map(p => `<option value="${esc(p.id)}"${p.id === options.productId ? ' selected' : ''}>${esc(ctx.translateProduct(p).name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-family:monospace;color:#00f0ff;margin-bottom:6px;">INQUIRY PAYLOAD // MESSAGE</label>
              <textarea name="message" rows="5" required placeholder="Specify your desired allocation units, integration timeline, or technical inquiry." style="width:100%;padding:14px;background:#08090e;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#ffffff;font-size:0.95rem;"></textarea>
            </div>
            <button type="submit" style="padding:15px;background:linear-gradient(90deg, #00f0ff, #0070f3);border:none;border-radius:6px;color:#08090e;font-size:1rem;font-weight:900;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase;">
              Transmit Transmission ↗
            </button>
          </form>
        </div>
      </main>
    `;
  }

  return `${headerHtml}${mainHtml}${footerHtml}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SINGLE ARTISAN CRAFT (Luxury Atelier Heritage)
// ─────────────────────────────────────────────────────────────────────────────

function renderSingleArtisanPage(ctx: ThemeContext): string {
  const { draft, options, path, navAttrs, ui } = ctx;
  const page = options.page || 'home';
  const company = draft.company;
  const brandName = company.name || 'ATELIER VENDÔME';

  const products = draft.products.length > 0 ? draft.products : [];
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
    <header style="background:#faf8f5;border-bottom:1px solid #e8e2d8;padding:24px 32px;position:sticky;top:0;z-index:90;backdrop-filter:blur(8px);">
      <div style="max-width:1320px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;">
        <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;color:#1e1915;">
          <div style="font-family:Georgia,serif;font-size:1.45rem;font-weight:700;letter-spacing:0.04em;">${esc(brandName)}</div>
          <div style="font-size:0.68rem;letter-spacing:0.25em;color:#c29b38;text-transform:uppercase;font-family:system-ui,sans-serif;margin-top:2px;">MAÎTRE HORLOGER · PIÈCE UNIQUE</div>
        </a>
        <nav style="display:flex;align-items:center;gap:32px;">
          <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;color:#2c2420;font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;font-family:system-ui,sans-serif;font-weight:600;">${esc(ui.home)}</a>
          <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;color:#2c2420;font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;font-family:system-ui,sans-serif;font-weight:600;">The Commission</a>
          <a href="${path('about/index.html')}" ${navAttrs('about')} style="text-decoration:none;color:#2c2420;font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;font-family:system-ui,sans-serif;font-weight:600;">Atelier Legacy</a>
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;color:#2c2420;font-size:0.86rem;letter-spacing:0.08em;text-transform:uppercase;font-family:system-ui,sans-serif;font-weight:600;">${esc(ui.contact)}</a>
        </nav>
        <div>
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;padding:12px 24px;border:1px solid #c29b38;background:#1e1915;color:#fcfaf6;font-size:0.82rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;border-radius:2px;">
            Request Allocation ↗
          </a>
        </div>
      </div>
    </header>
  `;

  const footerHtml = `
    <footer style="background:#1a1614;color:#fcfaf6;padding:70px 32px 36px;border-top:2px solid #c29b38;">
      <div style="max-width:1320px;margin:0 auto;">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px;">
          <div>
            <div style="font-family:Georgia,serif;font-size:1.4rem;font-weight:700;letter-spacing:0.04em;margin-bottom:12px;color:#c29b38;">${esc(brandName)}</div>
            <p style="font-size:0.88rem;line-height:1.7;color:rgba(252,250,246,0.65);max-width:320px;font-family:Georgia,serif;">
              ${esc(company.description || 'Independent Swiss haute horlogerie atelier hand-crafting heirloom pieces with unapologetic reverence for traditional guild finishing.')}
            </p>
            <div style="display:flex;gap:12px;margin-top:20px;">${ctx.socials}</div>
          </div>
          <div>
            <div style="font-size:0.75rem;letter-spacing:0.18em;color:#c29b38;text-transform:uppercase;margin-bottom:16px;">The Guild</div>
            <a href="${path('index.html')}" ${navAttrs('home')} style="display:block;color:rgba(252,250,246,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">${esc(ui.home)}</a>
            <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="display:block;color:rgba(252,250,246,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">Numbered Editions</a>
            <a href="${path('about/index.html')}" ${navAttrs('about')} style="display:block;color:rgba(252,250,246,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">Atelier Heritage</a>
          </div>
          <div>
            <div style="font-size:0.75rem;letter-spacing:0.18em;color:#c29b38;text-transform:uppercase;margin-bottom:16px;">Private Client</div>
            <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="display:block;color:rgba(252,250,246,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">Bespoke Commissions</a>
            <a href="mailto:${esc(company.email)}" style="display:block;color:rgba(252,250,246,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">${esc(company.email)}</a>
          </div>
          <div>
            <div style="font-size:0.75rem;letter-spacing:0.18em;color:#c29b38;text-transform:uppercase;margin-bottom:16px;">Salon & Workshop</div>
            <p style="font-size:0.86rem;color:rgba(252,250,246,0.65);line-height:1.6;font-family:Georgia,serif;">${esc(company.address || 'Vallée de Joux · Geneva · Paris Salon')}</p>
          </div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:28px;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:rgba(252,250,246,0.45);">
          <span>&copy; ${new Date().getUTCFullYear()} ${esc(brandName)}. HAND-NUMBERED & CALIBRATED IN SWITZERLAND.</span>
          <div class="languages" style="display:flex;gap:8px;">${ctx.languageLinks}</div>
        </div>
      </div>
    </footer>
  `;

  let mainHtml = '';

  if (page === 'home') {
    mainHtml = `
      <main style="background:#fcfaf6;color:#1e1915;">
        <!-- EDITORIAL ASYMMETRIC SPREAD -->
        <section style="padding:90px 32px 110px;max-width:1320px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
          <div>
            <div style="font-size:0.75rem;letter-spacing:0.25em;color:#c29b38;text-transform:uppercase;font-weight:700;margin-bottom:16px;">
              ISSUE NO. VII · CALIBRE ROYAL
            </div>
            <h1 style="font-family:Georgia,serif;font-size:clamp(2.4rem, 4.6vw, 3.8rem);font-weight:400;line-height:1.12;color:#1e1915;margin:0 0 24px;">
              ${esc(draft.copy[ctx.lang]?.headline || primary.name)}
            </h1>
            <p style="font-family:Georgia,serif;font-size:1.15rem;line-height:1.75;color:#4a3f35;margin:0 0 36px;font-style:italic;">
              "${esc(draft.copy[ctx.lang]?.subtitle || primary.description)}"
            </p>
            <div style="display:flex;align-items:center;gap:20px;margin-bottom:48px;">
              <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;padding:16px 36px;background:#1e1915;color:#fcfaf6;font-size:0.88rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;border:1px solid #1e1915;">
                Examine The Piece ↗
              </a>
              <div style="font-family:Georgia,serif;font-size:0.92rem;color:#857567;">
                Strictly Limited to 500 Numbered Examples
              </div>
            </div>

            <!-- Artisan certification note -->
            <div style="border-top:1px solid #e8e2d8;padding-top:24px;display:flex;align-items:center;gap:18px;">
              <div style="width:48px;height:48px;border-radius:50%;border:1px solid #c29b38;display:flex;align-items:center;justify-content:center;color:#c29b38;font-size:1.2rem;font-family:Georgia,serif;">
                ⚜
              </div>
              <div style="font-size:0.85rem;color:#6b5e52;line-height:1.5;">
                Every individual piece requires 220 consecutive hours of hand-filing, anglage bevelling, and master balance calibration.
              </div>
            </div>
          </div>

          <!-- Masterpiece Portrait Frame -->
          <div style="position:relative;padding:24px;">
            <div style="position:absolute;inset:0;border:1px solid #c29b38;pointer-events:none;transform:rotate(-1deg);"></div>
            <div style="background:#ffffff;border:1px solid #e8e2d8;padding:40px;box-shadow:0 24px 60px rgba(44,36,32,0.08);position:relative;">
              <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;max-height:460px;object-fit:contain;">
              <div style="text-align:center;margin-top:24px;font-family:Georgia,serif;font-style:italic;font-size:0.86rem;color:#857567;">
                Piece No. 042 / 500 · Hand-Polished Damascus Steel & 24K Gilded Accents
              </div>
            </div>
          </div>
        </section>

        <!-- PROVENANCE & MATERIALS LEDGER -->
        <section style="background:#f4efe6;padding:90px 32px;border-top:1px solid #e8e2d8;border-bottom:1px solid #e8e2d8;">
          <div style="max-width:1100px;margin:0 auto;">
            <div style="text-align:center;max-width:640px;margin:0 auto 48px;">
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#c29b38;text-transform:uppercase;font-weight:700;margin-bottom:8px;">OFFICIAL ARCHIVAL DOCUMENT</div>
              <h2 style="font-family:Georgia,serif;font-size:2.2rem;font-weight:400;margin:0 0 12px;">Certificate of Material Provenance</h2>
              <p style="font-family:Georgia,serif;font-size:1rem;color:#6b5e52;font-style:italic;">Each finished object is accompanied by an authenticated ledger guaranteeing raw material origin and artisanal lineage.</p>
            </div>

            <div style="background:#ffffff;border:1px solid #c29b38;border-radius:2px;padding:36px;box-shadow:0 12px 36px rgba(0,0,0,0.04);">
              <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;font-size:0.95rem;">
                <tbody>
                  <tr style="border-bottom:1px solid #e8e2d8;">
                    <td style="padding:16px;color:#857567;width:240px;font-style:italic;">Primary Alloy Case</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">${esc(primary.material || 'Swiss Damascus Steel (316L Core + Rose Gold Inlay)')}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e8e2d8;">
                    <td style="padding:16px;color:#857567;font-style:italic;">Movement & Calibre</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">Calibre 1888 Mechanical Hand-Wound · 28,800 vph · 72h Reserve</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e8e2d8;">
                    <td style="padding:16px;color:#857567;font-style:italic;">Strap & Habillage</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">Full-Grain Tuscan Vegetable Leather · Saddler Hand-Stitched Linen</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e8e2d8;">
                    <td style="padding:16px;color:#857567;font-style:italic;">Artisanal Bench Hours</td>
                    <td style="padding:16px;color:#1e1915;font-weight:700;">220 Recorded Master Hours per Finished Unit</td>
                  </tr>
                  <tr>
                    <td style="padding:16px;color:#857567;font-style:italic;">Restoration Covenant</td>
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
            <div style="font-size:0.75rem;letter-spacing:0.2em;color:#c29b38;text-transform:uppercase;font-weight:700;margin-bottom:8px;">THE ATELIER PROTOCOL</div>
            <h2 style="font-family:Georgia,serif;font-size:2.4rem;font-weight:400;margin:0 0 16px;">The 5 Stages of Timeless Execution</h2>
            <p style="font-family:Georgia,serif;font-size:1.05rem;color:#6b5e52;line-height:1.7;">From unyielding raw mineral to a whispering mechanical symphony.</p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:20px;">
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:24px;border-top:3px solid #c29b38;">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c29b38;margin-bottom:8px;">I</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;">Ore Selection</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Selecting micro-crystallized steel alloys with zero internal structural voids.</p>
            </div>
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:24px;border-top:3px solid #c29b38;">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c29b38;margin-bottom:8px;">II</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;">Hand Forging</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Cold hammer-forged to compress grain structure for exceptional acoustic resonance.</p>
            </div>
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:24px;border-top:3px solid #c29b38;">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c29b38;margin-bottom:8px;">III</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;">Anglage Bevelling</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Gentian wood peg polishing creates mirrored 45° chamfers on all interior components.</p>
            </div>
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:24px;border-top:3px solid #c29b38;">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c29b38;margin-bottom:8px;">IV</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;">Master Regulation</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Regulated in 6 positions across 21 days for precision under -1/+2 seconds daily.</p>
            </div>
            <div style="border:1px solid #e8e2d8;background:#ffffff;padding:24px;border-top:3px solid #c29b38;">
              <div style="font-family:Georgia,serif;font-size:1.5rem;color:#c29b38;margin-bottom:8px;">V</div>
              <h4 style="font-family:Georgia,serif;font-size:1.1rem;margin:0 0 8px;">Cedar Packaging</h4>
              <p style="font-size:0.84rem;color:#6b5e52;line-height:1.6;">Encased in handcrafted alpine cedar chests with individual leather inspection certificates.</p>
            </div>
          </div>
        </section>
      </main>
    `;
  } else if (page === 'catalog') {
    mainHtml = `
      <main style="background:#fcfaf6;color:#1e1915;padding:90px 32px;">
        <div style="max-width:1320px;margin:0 auto;">
          <div style="text-align:center;max-width:680px;margin:0 auto 60px;">
            <div style="font-size:0.75rem;letter-spacing:0.2em;color:#c29b38;text-transform:uppercase;font-weight:700;margin-bottom:8px;">THE COLLECTION OF EDITIONS</div>
            <h1 style="font-family:Georgia,serif;font-size:2.8rem;font-weight:400;margin:0 0 16px;">Rare Commission Finishes</h1>
            <p style="font-family:Georgia,serif;font-size:1.05rem;color:#6b5e52;line-height:1.6;">Each finish variation is hand-finished in strictly limited annual batches.</p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(340px, 1fr));gap:36px;">
            ${products.map((p, idx) => {
              const pImg = p.imageAssetId ? ctx.asset(p.imageAssetId) : SINGLE_ARTISAN_DEFAULT.img;
              return `
                <div style="background:#ffffff;border:1px solid #e8e2d8;padding:36px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 12px 30px rgba(0,0,0,0.03);">
                  <div style="text-align:center;margin-bottom:24px;">
                    <img src="${esc(pImg)}" alt="${esc(p.name)}" style="width:100%;max-height:260px;object-fit:contain;">
                  </div>
                  <div>
                    <div style="font-size:0.72rem;letter-spacing:0.18em;color:#c29b38;text-transform:uppercase;margin-bottom:8px;">VARIATION // 0${idx + 1}</div>
                    <h3 style="font-family:Georgia,serif;font-size:1.35rem;font-weight:700;margin:0 0 10px;">${esc(p.name)}</h3>
                    <p style="font-family:Georgia,serif;font-size:0.9rem;color:#6b5e52;line-height:1.6;margin:0 0 24px;">${esc(p.description)}</p>
                    <div style="display:flex;gap:12px;">
                      <a href="${path(`products/${p.id}/index.html`)}" style="flex:1;text-align:center;text-decoration:none;padding:12px;border:1px solid #1e1915;color:#1e1915;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">
                        View Ledger
                      </a>
                      <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="flex:1;text-align:center;text-decoration:none;padding:12px;background:#1e1915;color:#ffffff;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">
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
    mainHtml = `
      <main style="background:#fcfaf6;color:#1e1915;padding:90px 32px;">
        <div style="max-width:1320px;margin:0 auto;">
          <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;align-items:center;">
            <div style="background:#ffffff;border:1px solid #c29b38;padding:48px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.06);">
              <img id="wr-detail-main-img" data-wr-material-image="product-main" data-wr-material-product="${esc(mainProduct.id)}" src="${esc(mainImg)}" alt="${esc(mainProduct.name)}" style="width:100%;max-height:460px;object-fit:contain;">
            </div>

            <div>
              <div style="font-size:0.75rem;letter-spacing:0.2em;color:#c29b38;text-transform:uppercase;font-weight:700;margin-bottom:12px;">HAND-NUMBERED PIÈCE UNIQUE</div>
              <h1 style="font-family:Georgia,serif;font-size:2.5rem;font-weight:400;margin:0 0 16px;">${esc(mainProduct.name)}</h1>
              <p style="font-family:Georgia,serif;font-size:1.1rem;color:#4a3f35;line-height:1.75;margin:0 0 32px;font-style:italic;">${esc(mainProduct.description)}</p>

              <div style="background:#f4efe6;border-left:3px solid #c29b38;padding:20px;margin-bottom:36px;font-family:Georgia,serif;font-size:0.92rem;color:#4a3f35;">
                <p style="margin:0 0 8px;"><strong>Materials:</strong> ${esc(mainProduct.material || 'Damascus Steel, Tuscan Full-Grain Leather')}</p>
                <p style="margin:0 0 8px;"><strong>Dimensions:</strong> ${esc(mainProduct.dimensions || '40mm Diameter · 10.5mm Thickness')}</p>
                <p style="margin:0;"><strong>Archival Seal:</strong> Hand-inspected and sealed in Geneva Atelier.</p>
              </div>

              <div style="display:flex;gap:16px;">
                <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="padding:16px 36px;background:#1e1915;color:#fcfaf6;text-decoration:none;font-size:0.86rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">
                  Request Commission Appointment ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else if (page === 'about') {
    const aboutHeadline = getAboutHeadline(draft.company, 'The Atelier Heritage');
    const paragraphs = getAboutStoryParagraphs(draft.company);
    mainHtml = `
      <main style="background:#fcfaf6;color:#1e1915;padding:90px 32px;">
        <div style="max-width:920px;margin:0 auto;">
          <div style="font-size:0.75rem;letter-spacing:0.2em;color:#c29b38;text-transform:uppercase;font-weight:700;margin-bottom:12px;">GENEVAL HOROLOGICAL ARCHIVE</div>
          <h1 style="font-family:Georgia,serif;font-size:2.8rem;font-weight:400;margin:0 0 28px;">${esc(aboutHeadline)}</h1>
          
          <div style="font-family:Georgia,serif;font-size:1.15rem;line-height:1.85;color:#3d332a;margin-bottom:48px;">
            ${paragraphs.length ? paragraphs.map(p => `<p style="margin-bottom:24px;">${esc(p)}</p>`).join('') : `
              <p style="margin-bottom:24px;">Founded on the principle of unhurried perfection, our atelier exists outside the cadence of industrial production. We create one single mechanical object, devoting months of artisan benchwork to each individual execution.</p>
              <p style="margin-bottom:24px;">By rejecting the temptation of annual mass collections, our master watchmakers preserve centuries-old hand-filing, anglage bevelling, and balance regulation techniques that have disappeared from modern assembly lines.</p>
            `}
          </div>

          <div style="border:1px solid #c29b38;padding:32px;background:#ffffff;text-align:center;font-family:Georgia,serif;font-style:italic;color:#6b5e52;">
            "We do not build for the season. We build for the third generation that will inherit this timepiece."
          </div>
        </div>
      </main>
    `;
  } else {
    mainHtml = `
      <main style="background:#fcfaf6;color:#1e1915;padding:90px 32px;">
        <div style="max-width:800px;margin:0 auto;">
          <div style="font-size:0.75rem;letter-spacing:0.2em;color:#c29b38;text-transform:uppercase;font-weight:700;margin-bottom:12px;">PRIVATE SALON CONSULTATION</div>
          <h1 style="font-family:Georgia,serif;font-size:2.6rem;font-weight:400;margin:0 0 16px;">Commission an Allocation</h1>
          <p style="font-family:Georgia,serif;font-size:1.05rem;color:#6b5e52;line-height:1.6;margin-bottom:40px;">Private client concierge for individual numbered allocations and bespoke engraving requests.</p>

          <form action="${esc(ctx.options.inquiryUrl)}" method="post" style="background:#ffffff;border:1px solid #e8e2d8;padding:40px;display:flex;flex-direction:column;gap:24px;box-shadow:0 12px 36px rgba(0,0,0,0.04);">
            <div>
              <label style="display:block;font-family:Georgia,serif;font-size:0.9rem;color:#4a3f35;margin-bottom:8px;">Client Email Address</label>
              <input type="email" name="email" required placeholder="client@estate.com" style="width:100%;padding:14px;border:1px solid #d4ccbf;background:#fcfaf6;font-family:Georgia,serif;font-size:0.95rem;">
            </div>
            <div>
              <label style="display:block;font-family:Georgia,serif;font-size:0.9rem;color:#4a3f35;margin-bottom:8px;">Desired Horological Commission</label>
              <select name="productId" style="width:100%;padding:14px;border:1px solid #d4ccbf;background:#fcfaf6;font-family:Georgia,serif;font-size:0.95rem;color:#1e1915;">
                <option value="">— Select Commission Edition —</option>
                ${products.map(p => `<option value="${esc(p.id)}"${p.id === options.productId ? ' selected' : ''}>${esc(ctx.translateProduct(p).name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-family:Georgia,serif;font-size:0.9rem;color:#4a3f35;margin-bottom:8px;">Inquiry & Commission Notes</label>
              <textarea name="message" rows="5" required placeholder="Please outline your preferred finish, custom engraving initials, or private appointment timing." style="width:100%;padding:14px;border:1px solid #d4ccbf;background:#fcfaf6;font-family:Georgia,serif;font-size:0.95rem;"></textarea>
            </div>
            <button type="submit" style="padding:16px;background:#1e1915;color:#fcfaf6;border:none;font-size:0.86rem;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;cursor:pointer;">
              Submit Commission Request ↗
            </button>
          </form>
        </div>
      </main>
    `;
  }

  return `${headerHtml}${mainHtml}${footerHtml}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SINGLE WELLNESS NORDIC (Scandinavian Biophilic Pure Living)
// ─────────────────────────────────────────────────────────────────────────────

function renderSingleWellnessPage(ctx: ThemeContext): string {
  const { draft, options, path, navAttrs, ui } = ctx;
  const page = options.page || 'home';
  const company = draft.company;
  const brandName = company.name || 'NORDIC SERENE';

  const products = draft.products.length > 0 ? draft.products : [];
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
    <header style="background:rgba(244,246,242,0.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(58,83,66,0.12);padding:18px 28px;position:sticky;top:0;z-index:90;">
      <div style="max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;">
        <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;display:flex;align-items:center;gap:10px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#3a5342;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:0.9rem;">
            🌿
          </div>
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:#233527;letter-spacing:-0.02em;">${esc(brandName)}</div>
            <div style="font-size:0.68rem;color:#4a6755;letter-spacing:0.06em;text-transform:uppercase;">Circadian Living · Copenhagen</div>
          </div>
        </a>
        <nav style="display:flex;align-items:center;gap:28px;">
          <a href="${path('index.html')}" ${navAttrs('home')} style="text-decoration:none;color:#3a5342;font-size:0.88rem;font-weight:600;">${esc(ui.home)}</a>
          <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;color:#3a5342;font-size:0.88rem;font-weight:600;">Daily Rituals</a>
          <a href="${path('about/index.html')}" ${navAttrs('about')} style="text-decoration:none;color:#3a5342;font-size:0.88rem;font-weight:600;">Nordic Ethos</a>
          <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="text-decoration:none;color:#3a5342;font-size:0.88rem;font-weight:600;">${esc(ui.contact)}</a>
        </nav>
        <div>
          <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;padding:10px 22px;border-radius:999px;background:#3a5342;color:#ffffff;font-size:0.86rem;font-weight:700;box-shadow:0 4px 14px rgba(58,83,66,0.25);">
            Begin Ritual ↗
          </a>
        </div>
      </div>
    </header>
  `;

  const footerHtml = `
    <footer style="background:#28382c;color:#f4f6f2;padding:64px 28px 32px;">
      <div style="max-width:1280px;margin:0 auto;">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px;">
          <div>
            <div style="font-size:1.2rem;font-weight:800;margin-bottom:12px;">${esc(brandName)}</div>
            <p style="font-size:0.88rem;line-height:1.65;color:rgba(244,246,242,0.7);max-width:320px;">
              ${esc(company.description || 'Designing biophilic everyday objects that restore sensory calm and align human wellness with natural circadian cycles.')}
            </p>
            <div style="display:flex;gap:12px;margin-top:16px;">${ctx.socials}</div>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.1em;color:#e8c5b0;text-transform:uppercase;margin-bottom:14px;">The Ritual</div>
            <a href="${path('index.html')}" ${navAttrs('home')} style="display:block;color:rgba(244,246,242,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">${esc(ui.home)}</a>
            <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="display:block;color:rgba(244,246,242,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">Starter Bundles</a>
            <a href="${path('about/index.html')}" ${navAttrs('about')} style="display:block;color:rgba(244,246,242,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">Circadian Science</a>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.1em;color:#e8c5b0;text-transform:uppercase;margin-bottom:14px;">Inquiries</div>
            <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="display:block;color:rgba(244,246,242,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">Hospitality & Spa Partnerships</a>
            <a href="mailto:${esc(company.email)}" style="display:block;color:rgba(244,246,242,0.7);text-decoration:none;font-size:0.86rem;padding:4px 0;">${esc(company.email)}</a>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.1em;color:#e8c5b0;text-transform:uppercase;margin-bottom:14px;">Studio</div>
            <p style="font-size:0.86rem;color:rgba(244,246,242,0.7);line-height:1.5;">${esc(company.address || 'Bredgade 24 · 1260 Copenhagen K · Denmark')}</p>
          </div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:rgba(244,246,242,0.5);">
          <span>&copy; ${new Date().getUTCFullYear()} ${esc(brandName)}. 100% PLASTIC-FREE PACKAGING & FSC CERTIFIED.</span>
          <div class="languages" style="display:flex;gap:8px;">${ctx.languageLinks}</div>
        </div>
      </div>
    </footer>
  `;

  let mainHtml = '';

  if (page === 'home') {
    mainHtml = `
      <main style="background:#f4f6f2;color:#28382c;">
        <!-- SUNLIT BIOPHILIC HERO -->
        <section style="padding:90px 28px 100px;max-width:1280px;margin:0 auto;display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;align-items:center;">
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
              <a href="${path('catalog/index.html')}" ${navAttrs('catalog')} style="text-decoration:none;padding:16px 36px;border-radius:999px;background:#3a5342;color:#ffffff;font-size:0.96rem;font-weight:700;box-shadow:0 6px 20px rgba(58,83,66,0.3);">
                Begin Your Daily Ritual ↗
              </a>
              <a href="#circadian" style="text-decoration:none;padding:16px 28px;border-radius:999px;background:#ffffff;color:#3a5342;border:1px solid #d4decf;font-size:0.96rem;font-weight:700;">
                The 24h Rhythm ↓
              </a>
            </div>

            <!-- Eco & Health Badges -->
            <div style="display:flex;gap:20px;padding-top:24px;border-top:1px solid #dce4d7;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.4rem;">🍃</span>
                <span style="font-size:0.84rem;font-weight:700;color:#3a5342;">Zero Synthetic VOCs</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.4rem;">☀️</span>
                <span style="font-size:0.84rem;font-weight:700;color:#3a5342;">Full-Spectrum Melatonin Support</span>
              </div>
            </div>
          </div>

          <!-- Studio Showcase Frame -->
          <div style="position:relative;background:radial-gradient(circle, #ffffff 0%, #e9efe4 100%);border-radius:36px;padding:48px;box-shadow:0 20px 50px rgba(58,83,66,0.08);border:1px solid #dbe3d6;text-align:center;">
            <img src="${esc(mainImg)}" alt="${esc(primary.name)}" style="width:100%;max-height:440px;object-fit:contain;filter:drop-shadow(0 16px 32px rgba(58,83,66,0.12));">
            <div style="display:inline-flex;align-items:center;gap:8px;margin-top:20px;padding:6px 14px;background:#ffffff;border-radius:999px;font-size:0.78rem;font-weight:700;color:#3a5342;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
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

            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:32px;">
              <div style="background:#f4f6f2;border-radius:24px;padding:36px;border:1px solid #dce4d7;">
                <div style="font-size:2rem;margin-bottom:12px;">🌅</div>
                <div style="font-size:0.8rem;font-weight:800;color:#c47355;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">07:00 // AWAKENING</div>
                <h3 style="font-size:1.35rem;font-weight:800;margin:0 0 12px;">Sunrise Mimicking Glow</h3>
                <p style="color:#4c6251;font-size:0.92rem;line-height:1.6;">Gradual 480nm blue-enriched illumination combined with revitalizing Siberian fir micro-mist clears morning grogginess naturally.</p>
              </div>

              <div style="background:#f4f6f2;border-radius:24px;padding:36px;border:1px solid #dce4d7;">
                <div style="font-size:2rem;margin-bottom:12px;">🌿</div>
                <div style="font-size:0.8rem;font-weight:800;color:#3a5342;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">14:00 // DEEP FOCUS</div>
                <h3 style="font-size:1.35rem;font-weight:800;margin:0 0 12px;">Cognitive Balance Flow</h3>
                <p style="color:#4c6251;font-size:0.92rem;line-height:1.6;">Neutral 4000K balanced daylight prevents afternoon screen fatigue while organic rosemary and cedarwood enhance mental clarity.</p>
              </div>

              <div style="background:#f4f6f2;border-radius:24px;padding:36px;border:1px solid #dce4d7;">
                <div style="font-size:2rem;margin-bottom:12px;">🌙</div>
                <div style="font-size:0.8rem;font-weight:800;color:#6b5278;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">21:00 // WIND-DOWN</div>
                <h3 style="font-size:1.35rem;font-weight:800;margin:0 0 12px;">Melatonin-Safe Amber</h3>
                <p style="color:#4c6251;font-size:0.92rem;line-height:1.6;">Zero blue-light 1800K candle warmth with therapeutic French lavender micro-droplets invites deep restorative REM sleep.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- CLINICAL PROOF SPECTRUM -->
        <section style="padding:90px 28px;max-width:1280px;margin:0 auto;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
            <div>
              <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">CLINICAL RESULTS</div>
              <h2 style="font-size:2.2rem;font-weight:900;color:#1e2d21;margin:0 0 18px;">Scientifically Tested in Double-Blind Trials</h2>
              <p style="color:#4c6251;font-size:1rem;line-height:1.65;margin-bottom:32px;">Over 800 participants tracked across 60 days demonstrated measurable cortisol reduction and sleep latency improvements.</p>

              <div style="display:flex;flex-direction:column;gap:18px;">
                <div style="display:flex;align-items:center;gap:20px;background:#ffffff;padding:20px 24px;border-radius:18px;border:1px solid #dce4d7;">
                  <div style="font-size:2rem;font-weight:900;color:#3a5342;">94%</div>
                  <div style="font-size:0.9rem;color:#4c6251;line-height:1.4;">Fell asleep within 15 minutes without prescription sleep aids.</div>
                </div>
                <div style="display:flex;align-items:center;gap:20px;background:#ffffff;padding:20px 24px;border-radius:18px;border:1px solid #dce4d7;">
                  <div style="font-size:2rem;font-weight:900;color:#3a5342;">38%</div>
                  <div style="font-size:0.9rem;color:#4c6251;line-height:1.4;">Reduction in salivary evening cortisol biomarkers.</div>
                </div>
                <div style="display:flex;align-items:center;gap:20px;background:#ffffff;padding:20px 24px;border-radius:18px;border:1px solid #dce4d7;">
                  <div style="font-size:2rem;font-weight:900;color:#3a5342;">100%</div>
                  <div style="font-size:0.9rem;color:#4c6251;line-height:1.4;">Biodegradable zero-plastic construction with zero electronic waste.</div>
                </div>
              </div>
            </div>

            <div style="text-align:center;">
              <img src="${esc(mainImg)}" alt="Clinical Wellness" style="width:100%;max-width:440px;filter:drop-shadow(0 20px 40px rgba(58,83,66,0.15));">
            </div>
          </div>
        </section>
      </main>
    `;
  } else if (page === 'catalog') {
    mainHtml = `
      <main style="background:#f4f6f2;color:#28382c;padding:90px 28px;">
        <div style="max-width:1280px;margin:0 auto;">
          <div style="text-align:center;max-width:680px;margin:0 auto 60px;">
            <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">STARTER KITS & REFILLS</div>
            <h1 style="font-size:2.6rem;font-weight:900;color:#1e2d21;margin:0 0 16px;">Daily Wellness Packages</h1>
            <p style="color:#4c6251;font-size:1.05rem;">Choose the mindful ritual bundle suited for your living space.</p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:32px;">
            ${products.map((p, idx) => {
              const pImg = p.imageAssetId ? ctx.asset(p.imageAssetId) : SINGLE_WELLNESS_DEFAULT.img;
              return `
                <div style="background:#ffffff;border-radius:24px;padding:32px;border:1px solid #dce4d7;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 10px 30px rgba(0,0,0,0.03);">
                  <div style="text-align:center;margin-bottom:20px;">
                    <img src="${esc(pImg)}" alt="${esc(p.name)}" style="width:100%;max-height:220px;object-fit:contain;">
                  </div>
                  <div>
                    <div style="font-size:0.75rem;font-weight:700;color:#4a6755;text-transform:uppercase;margin-bottom:6px;">RITUAL SET // 0${idx + 1}</div>
                    <h3 style="font-size:1.25rem;font-weight:800;color:#1e2d21;margin:0 0 8px;">${esc(p.name)}</h3>
                    <p style="font-size:0.9rem;color:#4c6251;line-height:1.5;margin:0 0 20px;">${esc(p.description)}</p>
                    <div style="display:flex;gap:12px;">
                      <a href="${path(`products/${p.id}/index.html`)}" style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:999px;border:1px solid #3a5342;color:#3a5342;font-size:0.86rem;font-weight:700;">
                        Details
                      </a>
                      <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:999px;background:#3a5342;color:#ffffff;font-size:0.86rem;font-weight:700;">
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
    mainHtml = `
      <main style="background:#f4f6f2;color:#28382c;padding:90px 28px;">
        <div style="max-width:1280px;margin:0 auto;">
          <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;align-items:center;">
            <div style="background:#ffffff;border-radius:32px;padding:48px;border:1px solid #dce4d7;text-align:center;box-shadow:0 16px 40px rgba(58,83,66,0.06);">
              <img id="wr-detail-main-img" data-wr-material-image="product-main" data-wr-material-product="${esc(mainProduct.id)}" src="${esc(mainImg)}" alt="${esc(mainProduct.name)}" style="width:100%;max-height:460px;object-fit:contain;">
            </div>

            <div>
              <div style="display:inline-block;padding:6px 14px;background:#e3ebd9;color:#3a5342;border-radius:999px;font-size:0.75rem;font-weight:700;margin-bottom:14px;">
                CERTIFIED BIOPHILIC LIVING
              </div>
              <h1 style="font-size:2.4rem;font-weight:900;color:#1e2d21;margin:0 0 16px;">${esc(mainProduct.name)}</h1>
              <p style="font-size:1.1rem;color:#4c6251;line-height:1.65;margin:0 0 28px;">${esc(mainProduct.description)}</p>

              <div style="background:#ffffff;border-radius:18px;padding:24px;border:1px solid #dce4d7;margin-bottom:32px;font-size:0.9rem;color:#3a5342;">
                <p style="margin:0 0 8px;"><strong>Sustainable Materials:</strong> ${esc(mainProduct.material || 'Recycled Cast Stone + FSC Birch Wood')}</p>
                <p style="margin:0 0 8px;"><strong>Dimensions:</strong> ${esc(mainProduct.dimensions || '160 × 160 × 210 mm · 850g weighted')}</p>
                <p style="margin:0;"><strong>Safety Standard:</strong> 100% BPA-Free, Lead-Free & Hypoallergenic.</p>
              </div>

              <div style="display:flex;gap:16px;">
                <a href="${path('contact/index.html')}" ${navAttrs('contact')} style="padding:16px 36px;border-radius:999px;background:#3a5342;color:#ffffff;text-decoration:none;font-size:0.95rem;font-weight:700;box-shadow:0 6px 20px rgba(58,83,66,0.3);">
                  Order Ritual Bundle ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  } else if (page === 'about') {
    const aboutHeadline = getAboutHeadline(draft.company, 'Form Follows Nature');
    const paragraphs = getAboutStoryParagraphs(draft.company);
    mainHtml = `
      <main style="background:#f4f6f2;color:#28382c;padding:90px 28px;">
        <div style="max-width:920px;margin:0 auto;">
          <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">NORDIC DESIGN ETHOS</div>
          <h1 style="font-size:2.8rem;font-weight:900;color:#1e2d21;margin:0 0 24px;">${esc(aboutHeadline)}</h1>
          
          <div style="font-size:1.12rem;line-height:1.8;color:#3d5042;margin-bottom:48px;">
            ${paragraphs.length ? paragraphs.map(p => `<p style="margin-bottom:20px;">${esc(p)}</p>`).join('') : `
              <p style="margin-bottom:20px;">Born in Copenhagen, our studio creates calm in a world overwhelmed by synthetic noise. We believe in designing one single mindful instrument that harmonizes human physiology with the cycles of the sun.</p>
              <p style="margin-bottom:20px;">By using zero plastics and working exclusively with cast mineral stone and reclaimed Nordic birch, every object we produce is meant to breathe longevity, tranquility, and natural balance into your sanctuary.</p>
            `}
          </div>

          <div style="background:#ffffff;border-radius:24px;padding:36px;border:1px solid #dce4d7;text-align:center;">
            <div style="font-size:2rem;margin-bottom:8px;">🌿</div>
            <div style="font-size:1.1rem;font-weight:800;color:#28382c;margin-bottom:6px;">B-Corp Certified & Climate Neutral</div>
            <p style="color:#4c6251;font-size:0.92rem;margin:0;">Every purchase funds 10 planted native trees in Danish regenerative conservation forests.</p>
          </div>
        </div>
      </main>
    `;
  } else {
    mainHtml = `
      <main style="background:#f4f6f2;color:#28382c;padding:90px 28px;">
        <div style="max-width:800px;margin:0 auto;">
          <div style="color:#4a6755;font-size:0.78rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">GET IN TOUCH</div>
          <h1 style="font-size:2.6rem;font-weight:900;color:#1e2d21;margin:0 0 16px;">Mindful Living Partnerships</h1>
          <p style="color:#4c6251;font-size:1.05rem;line-height:1.6;margin-bottom:40px;">Connect with our Copenhagen studio for spa installations, corporate wellness programs, and boutique distribution.</p>

          <form action="${esc(ctx.options.inquiryUrl)}" method="post" style="background:#ffffff;border-radius:24px;border:1px solid #dce4d7;padding:40px;display:flex;flex-direction:column;gap:24px;box-shadow:0 12px 30px rgba(0,0,0,0.03);">
            <div>
              <label style="display:block;font-size:0.85rem;font-weight:700;color:#3a5342;margin-bottom:8px;">Your Email Address</label>
              <input type="email" name="email" required placeholder="name@wellness-studio.com" style="width:100%;padding:14px;border:1px solid #d4decf;border-radius:12px;background:#fbfcf9;font-size:0.95rem;">
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;font-weight:700;color:#3a5342;margin-bottom:8px;">Select Wellness Instrument</label>
              <select name="productId" style="width:100%;padding:14px;border:1px solid #d4decf;border-radius:12px;background:#fbfcf9;font-size:0.95rem;color:#28382c;">
                <option value="">— Select Studio Ritual —</option>
                ${products.map(p => `<option value="${esc(p.id)}"${p.id === options.productId ? ' selected' : ''}>${esc(ctx.translateProduct(p).name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;font-weight:700;color:#3a5342;margin-bottom:8px;">Partnership Message</label>
              <textarea name="message" rows="5" required placeholder="Tell us about your space, retail boutique, or hotel wellness project." style="width:100%;padding:14px;border:1px solid #d4decf;border-radius:12px;background:#fbfcf9;font-size:0.95rem;"></textarea>
            </div>
            <button type="submit" style="padding:16px;background:#3a5342;color:#ffffff;border:none;border-radius:999px;font-size:0.95rem;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(58,83,66,0.3);">
              Send Partnership Inquiry ↗
            </button>
          </form>
        </div>
      </main>
    `;
  }

  return `${headerHtml}${mainHtml}${footerHtml}`;
}
