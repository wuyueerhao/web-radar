export const themeStyles = `
/* ------------------------------------------------------------- */
/* 01. SENSENG CLEAN (Template 1: Clean Living & Consumer Goods) */
/* ------------------------------------------------------------- */
html {
  height: 100%;
}
body[data-template="senseng-clean"],
body[data-template="senseng-video"] {
  --display: "Arial", "Helvetica Neue", sans-serif;
  --body: "Arial", "Helvetica Neue", sans-serif;
  --brand: #0099eb;
  --color-primary: #073b91;
  --color-navy-sub: #0a2b61;
  --color-ink: #102033;
  --color-brand-blue: #0088eb;
  --color-brand-blue-hover: #0077d2;
  --color-pill-blue: #e8f5fd;
  --color-pill-blue-text: #0882d3;
  --color-box-bg: #eef8ff;
  margin: 0;
  background: #ffffff;
  color: #102033;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
body[data-template="senseng-clean"] > main,
body[data-template="senseng-video"] > main {
  flex: 1;
}

/* Senseng Header */
.senseng-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #ffffff;
  border-bottom: 1px solid #edf4fa;
  height: 57px;
  flex-shrink: 0;
}
.senseng-header-inner {
  max-width: 1920px;
  margin: 0 auto;
  height: 100%;
  padding: 0 4.62%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.senseng-logo {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  text-decoration: none;
  line-height: 1;
}
.senseng-logo-text {
  font-size: 34px;
  font-weight: 900;
  letter-spacing: -1.5px;
  color: #073b91;
}
.senseng-logo-smile {
  position: absolute;
  left: 45px;
  bottom: -6px;
  width: 68px;
  height: 10px;
  border-bottom: 4px solid #ff7588;
  border-radius: 50%;
}
.senseng-nav {
  display: flex;
  align-items: center;
  gap: 42px;
}
.senseng-nav-link {
  position: relative;
  font-size: 17px;
  font-weight: 400;
  color: #073b91;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 14px 0;
  text-decoration: none;
  transition: color 0.15s ease;
}
.senseng-nav-link:hover,
.senseng-nav-link.active {
  color: #0088eb;
}
.senseng-nav-link.active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3.5px;
  background: #0088eb;
  border-radius: 2px;
}
.senseng-btn-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #0088eb;
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  padding: 10px 24px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  box-shadow: none;
  transition: background 0.15s ease, transform 0.1s ease;
}
.senseng-btn-pill:hover {
  background: #0077d2;
}
.senseng-btn-pill svg {
  width: 18px;
  height: 18px;
}

/* Senseng Footer */
.senseng-footer {
  max-width: 1536px;
  margin: 0 auto 12px;
  padding: 0 30px;
  flex-shrink: 0;
  width: 100%;
}
.senseng-footer-inner {
  background: #eef8ff;
  border-radius: 24px;
  padding: 16px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}
.senseng-footer-left {
  display: flex;
  align-items: center;
  gap: 60px;
  flex: 1;
}
.senseng-footer-divider {
  width: 1px;
  height: 48px;
  background: #ccdbe6;
  flex-shrink: 0;
}

/* Senseng Hero (Home) */
.senseng-hero {
  container-type: inline-size;
  background: #c8effc;
  overflow: hidden;
}
.senseng-hero-inner {
  width: 100%;
  min-height: 27.93cqw;
  position: relative;
  display: flex;
  align-items: center;
}
.senseng-hero-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.senseng-hero-scene img {
  position: absolute;
  width: 100%;
  max-width: none;
  height: 100%;
  object-fit: fill;
}
/* The generated sky supplies only the cleared text area. The original
   photograph stays above it so packaging, product scale and stacking survive. */
.senseng-hero-scene .senseng-hero-sky {
  height: 109.3%;
  top: 0;
}
.senseng-hero-products {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1536 425'%3E%3Cdefs%3E%3Cfilter id='soft'%3E%3CfeGaussianBlur stdDeviation='6'/%3E%3C/filter%3E%3C/defs%3E%3Cpath fill='white' filter='url(%23soft)' d='M650,-40H1580V470H450V302H540V160H650Z M-40,382H1580V470H-40Z'/%3E%3C/svg%3E");
  mask-size: 100% 100%;
  mask-repeat: no-repeat;
}
.senseng-hero-left {
  position: relative;
  z-index: 2;
  width: 42%;
  margin-left: 4.62%;
  padding: 2.6cqw 0;
}
.senseng-hero-left .senseng-eyebrow {
  font-size: 0.91cqw;
  font-weight: 500;
  margin: 0 0 .9cqw;
}
.senseng-hero-left .senseng-hero-h1 {
  font-size: 3.58cqw;
  line-height: .95;
  letter-spacing: -0.13cqw;
  margin: 0 0 1cqw;
}
.senseng-hero-left .senseng-hero-sub {
  font-size: 1.3cqw;
  line-height: 1.4;
  max-width: 29cqw;
  margin: 0 0 1.3cqw;
}
.senseng-hero-left .senseng-btn-pill {
  font-size: 1.17cqw !important;
  padding: .7cqw 1.7cqw !important;
}
.senseng-hero-left .senseng-btn-pill svg { width: 1.56cqw; height: 1.56cqw; }
.senseng-logo img { width: 170px; height: auto; }
.senseng-header .senseng-logo img { margin-left: -20px; }
.senseng-footer .senseng-logo img { width: 170px; max-width: none; mix-blend-mode: multiply; }
.senseng-eyebrow {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: #073b91;
  margin-bottom: 12px;
}
.senseng-hero-h1 {
  font-size: 48px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -1.5px;
  color: #073b91;
  margin-bottom: 16px;
}
.senseng-hero-sub {
  font-size: 17px;
  line-height: 1.45;
  color: #0a2b61;
  margin-bottom: 24px;
  max-width: 460px;
}
.senseng-hero-right {
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  height: 100%;
}
.senseng-hero-right img {
  max-height: 429px;
  width: 100%;
  object-fit: contain;
  object-position: right bottom;
}

/* Senseng Video Fullscreen Variant */
.senseng-hero-video-full {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100svh;
  min-height: 520px;
  overflow: hidden;
  background: #073b91 url('/templates/senseng/video-poster.jpg') center / cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}
.senseng-hero-video-full video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  object-position: center;
  z-index: 1;
}
/* The bundled 1920×1080 video contains 60px encoded black pillars on each
   side (1800px active picture). Cover using that active picture, not the
   encoded frame. Keep custom project videos on the normal cover rule. */
.senseng-hero-video-bundled video {
  width: 106.666667%;
  left: -3.333333%;
  right: auto;
}
.senseng-hero-video-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7, 59, 145, 0.45) 0%, rgba(7, 38, 107, 0.8) 100%);
  z-index: 2;
}
.senseng-hero-video-content {
  position: relative;
  z-index: 3;
  max-width: 900px;
  text-align: center;
  padding: 48px 24px;
}
.senseng-hero-video-content .senseng-hero-sub { margin: 20px auto 24px; }
.senseng-video-actions { display: flex; gap: 18px; justify-content: center; margin-top: 28px; flex-wrap: wrap; }
.senseng-video-toggle { position: absolute; right: 24px; bottom: 22px; z-index: 4; width: 44px; height: 44px; border: 1px solid #ffffff80; border-radius: 50%; color: white; background: #073b9170; cursor: pointer; }

.senseng-scroll-down {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  color: #ffffff;
  font-size: 12px;
  letter-spacing: 0.2em;
  white-space: nowrap;
  font-weight: 700;
  opacity: 0.8;
}

/* Senseng Value Props */
.senseng-value-props {
  max-width: 1536px;
  margin: 0 auto;
  padding: 48px 40px 40px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 36px;
  background: #ffffff;
  box-sizing: border-box;
}
.senseng-vp-item {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 16px 18px;
  border-radius: 20px;
  background: #fbfdff;
  border: 1px solid #ebf4fb;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
.senseng-vp-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(7, 59, 145, 0.07);
  background: #ffffff;
}
.senseng-vp-icon {
  width: 68px;
  height: 68px;
  min-width: 68px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(7, 59, 145, 0.08);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.senseng-vp-item:hover .senseng-vp-icon {
  transform: scale(1.08) rotate(4deg);
}
.senseng-vp-icon svg {
  width: 34px;
  height: 34px;
}
.senseng-vp-text {
  flex: 1;
  min-width: 0;
}
.senseng-vp-item h3 {
  font-size: 19px;
  font-weight: 800;
  color: #073b91;
  margin: 0 0 8px;
  line-height: 1.3;
  letter-spacing: -0.2px;
}
.senseng-vp-item p {
  font-size: 14.5px;
  line-height: 1.55;
  color: #475569;
  margin: 0;
}

/* Senseng 8-Product Showcase Box */
.senseng-showcase-box {
  max-width: 1536px;
  margin: 0 auto 56px;
  padding: 0 40px;
  box-sizing: border-box;
}
.senseng-showcase-card {
  background: linear-gradient(180deg, #f0f7ff 0%, #e8f4fd 100%);
  border: 1px solid #d4ebfa;
  border-radius: 28px;
  padding: 36px 36px 40px;
  box-shadow: 0 8px 30px rgba(7, 59, 145, 0.05);
  box-sizing: border-box;
}
.senseng-showcase-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  padding: 0 4px;
}
.senseng-showcase-top h2 {
  font-size: 30px;
  font-weight: 900;
  color: #073b91;
  letter-spacing: -0.5px;
  margin: 0;
  line-height: 1.2;
}
.senseng-showcase-viewall,
.senseng-showcase-top > a {
  background: #ffffff;
  color: #0284c7;
  border: 1px solid #cbe4f7;
  border-radius: 9999px;
  padding: 9px 22px;
  font-size: 14.5px;
  font-weight: 700;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(7, 59, 145, 0.05);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}
.senseng-showcase-viewall:hover,
.senseng-showcase-top > a:hover {
  background: #0284c7;
  color: #ffffff !important;
  border-color: #0284c7;
  box-shadow: 0 6px 18px rgba(2, 132, 199, 0.25);
  transform: translateY(-2px);
}
.senseng-grid-8 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}
.senseng-p-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e1effa;
  padding: 20px 18px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 4px 16px rgba(7, 59, 145, 0.04);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
  cursor: pointer;
  box-sizing: border-box;
  min-width: 0;
}
.senseng-p-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 36px rgba(7, 59, 145, 0.12);
  border-color: #b9ddf8;
}
.senseng-p-link {
  text-decoration: none;
  color: inherit;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.senseng-p-card a {
  text-decoration: none;
  color: inherit;
  width: 100%;
}
.senseng-p-img-wrap {
  width: 100%;
  aspect-ratio: 1.25;
  background: #f8fbfe;
  border-radius: 14px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  box-sizing: border-box;
  overflow: hidden;
}
.senseng-p-img-wrap img,
.senseng-p-card img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 6px;
}
.senseng-p-card:hover .senseng-p-img-wrap img,
.senseng-p-card:hover > a > img {
  transform: scale(1.06);
}
.senseng-p-card h4 {
  font-size: 16px;
  font-weight: 800;
  color: #073b91;
  line-height: 1.35;
  margin: 0 0 12px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
}
.senseng-p-spec {
  font-size: 12.5px;
  line-height: 1.5;
  color: #475569;
  margin-bottom: 14px;
  text-align: left;
  width: 100%;
  background: #f4f9fd;
  border: 1px solid #e1eefa;
  border-radius: 12px;
  padding: 10px 14px;
  box-sizing: border-box;
}
.senseng-p-spec-row {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}
.senseng-p-spec-row:last-child {
  margin-bottom: 0;
}
.senseng-p-spec strong {
  color: #073b91;
  font-weight: 700;
  flex-shrink: 0;
}
.senseng-btn-detail {
  width: 100%;
  background: #e6f3fd;
  color: #0284c7;
  border: 1px solid #cbe4f7;
  border-radius: 9999px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 700;
  margin-top: auto;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
.senseng-btn-detail:hover {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3);
  transform: translateY(-1px);
}

/* Shared subscription band, using the same blue, sky and blush palette. */
.senseng-newsletter { width: 100%; max-width: 1536px; margin: 12px auto; padding: 0 30px; }
.senseng-newsletter-inner { display: grid; grid-template-columns: 1fr minmax(360px, 460px); gap: 48px; align-items: center; padding: 32px 40px; border-radius: 24px; background: linear-gradient(115deg, #e8f7ff, #f1f9ff 72%, #fff1f5); border: 1px solid #dceffa; }
.senseng-newsletter h2 { color: #073b91; font-size: 28px; font-weight: 800; letter-spacing: -.5px; margin: 0 0 8px; }
.senseng-newsletter-copy p { font-size: 15px; line-height: 1.5; margin: 0; color: #34516f; }
.senseng-newsletter label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #073b91; }
.senseng-newsletter-controls { display: flex; min-width: 0; padding: 5px; background: white; border: 1px solid #c7e5f6; border-radius: 999px; }
.senseng-newsletter input { min-width: 0; width: 100%; padding: 9px 14px; border: 0; border-radius: 999px; background: white; color: #102033; font-size: 14px; }
.senseng-newsletter button { padding: 10px 22px; border: 0; border-radius: 999px; background: #0088eb; color: white; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; }
.senseng-newsletter button:hover { background: #0077d2; }
.senseng-newsletter .senseng-newsletter-status { margin: 6px 12px 0; min-height: 18px; font-size: 12px; line-height: 1.5; color: #34516f; }
body[data-template="senseng-video"] .senseng-newsletter-inner { background: linear-gradient(115deg, #073b91, #0a4dbf); border-color: transparent; }
body[data-template="senseng-video"] .senseng-newsletter h2,
body[data-template="senseng-video"] .senseng-newsletter label { color: white; }
body[data-template="senseng-video"] .senseng-newsletter p { color: #d5eaff; }
body[data-template="senseng-video"] .senseng-newsletter button { background: #ffd7e0; color: #073b91; }

/* Senseng Catalog */
.senseng-cat-hero {
  max-width: 1536px;
  margin: 0 auto;
  padding: 24px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, #d3f0fe 0%, #edf8ff 100%);
  min-height: 190px;
  overflow: hidden;
  gap: 32px;
}
.senseng-cat-hero > div { min-width: 0; }
.senseng-cat-hero > .cat-hero-left { flex: 1; }
.senseng-cat-hero > div:last-child { max-width: 36%; }
/* Responsive image dimensions must not reserve the source width in this flex row. */
.senseng-cat-hero img { width: auto; max-width: 100%; max-height: 175px; }
.senseng-cat-hero picture { display: contents; }
.senseng-cat-filter-bar {
  max-width: 1536px;
  margin: 20px auto 28px;
  padding: 0 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.senseng-filter-pill {
  border: none;
  background: #eef8fd;
  color: #073b91;
  font-size: 15px;
  font-weight: 700;
  border-radius: 9999px;
  padding: 8px 22px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.senseng-filter-pill.active {
  background: #0088eb;
  color: #ffffff;
}
.senseng-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #ccdbe8;
  border-radius: 9999px;
  padding: 7px 18px;
  width: 240px;
}
.senseng-search-box input {
  border: none;
  outline: none;
  font-size: 14px;
  color: #102033;
  width: 100%;
}
.senseng-cat-section {
  max-width: 1536px;
  margin: 0 auto 32px;
  padding: 0 40px;
}
.senseng-cat-section-hdr {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.senseng-cat-cards-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.senseng-cat-2col {
  max-width: 1536px;
  margin: 0 auto 32px;
  padding: 0 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.senseng-catalog-card {
  background: #ffffff;
  border: 1px solid #e1eef8;
  border-radius: 18px;
  padding: 16px;
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 16px;
  align-items: center;
  box-shadow: 0 4px 14px rgba(7, 59, 145, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.senseng-catalog-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(7, 59, 145, 0.08);
}
.senseng-catalog-card img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: contain;
  border-radius: 10px;
}
.senseng-cat-card-body h4 {
  font-size: 18px;
  font-weight: 900;
  color: #073b91;
  margin-bottom: 6px;
  line-height: 1.25;
}
.senseng-cat-card-body p {
  font-size: 13.5px;
  line-height: 1.4;
  color: #3b5066;
  margin-bottom: 12px;
}

/* Senseng Detail */
.senseng-detail-breadcrumb {
  max-width: 1536px;
  margin: 16px auto 20px;
  padding: 0 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: #647b93;
}
.senseng-detail-breadcrumb a {
  color: #647b93;
  text-decoration: none;
}
.senseng-detail-grid {
  max-width: 1536px;
  margin: 0 auto 36px;
  padding: 0 40px;
  display: grid;
  grid-template-columns: 460px 1fr 430px;
  gap: 32px;
  align-items: start;
}
.senseng-detail-img-box {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #fbfdff;
  border: 1px solid #e1eef8;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.senseng-detail-img-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.senseng-detail-thumbs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
}
.senseng-thumb-arrow {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid #d4e7f5;
  background: #ffffff;
  color: #073b91;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  outline: none;
  font-family: inherit;
  line-height: 1;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
.senseng-thumb-arrow:hover {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
}
.senseng-thumb-arrow:active {
  transform: scale(0.94);
}
.senseng-thumb-btn {
  width: 62px;
  height: 62px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: #fbfdff;
  padding: 4px;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.senseng-thumb-btn:hover {
  border-color: #7dd3fc;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(7, 59, 145, 0.1);
}
.senseng-thumb-btn.active {
  border-color: #0088eb;
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(0, 136, 235, 0.25);
  transform: translateY(-1px);
}
.senseng-thumb-btn img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
  pointer-events: none;
}
.senseng-badge-pill {
  display: inline-block;
  background: #dff4ff;
  color: #0797e8;
  font-size: 14px;
  font-weight: 700;
  padding: 4px 16px;
  border-radius: 9999px;
  margin-bottom: 14px;
}
.senseng-detail-h1 {
  font-size: 42px;
  font-weight: 900;
  color: #073b91;
  letter-spacing: -1px;
  margin: 0 0 12px;
}
.senseng-detail-desc {
  font-size: 16px;
  line-height: 1.55;
  color: #1a2f44;
  margin: 0 0 28px;
}
.senseng-inquiry-box {
  background: #eef8ff;
  border-radius: 24px;
  padding: 24px 26px;
}
.senseng-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.senseng-form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.senseng-form-group label {
  font-size: 13.5px;
  font-weight: 700;
  color: #073b91;
}
.senseng-form input,
.senseng-form select,
.senseng-form textarea {
  width: 100%;
  background: #ffffff;
  border: 1px solid #d3e5f2;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 14px;
  color: #102033;
  outline: none;
  box-sizing: border-box;
}
.senseng-form textarea {
  height: 72px;
  resize: vertical;
}

/* Senseng About & Contact Heroes */
.senseng-about-hero, .senseng-contact-hero {
  container-type: inline-size;
  overflow: hidden;
  background: linear-gradient(180deg, #b9e8f8, #c6ecfa);
}
.senseng-about-hero-inner, .senseng-contact-hero-inner {
  position: relative;
  min-height: 24.1cqw;
  display: flex;
  align-items: flex-start;
}
.senseng-contact-hero-inner { min-height: 20.44cqw; }
.senseng-reference-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1536 370'%3E%3Cdefs%3E%3Cfilter id='soft'%3E%3CfeGaussianBlur stdDeviation='7'/%3E%3C/filter%3E%3C/defs%3E%3Cpath fill='white' filter='url(%23soft)' d='M735,-40H1580V420H-40V330H680V185H735Z M-40,-40H40V420H-40Z'/%3E%3C/svg%3E");
  mask-size: 100% 100%;
}
.senseng-reference-scene img { position: absolute; width: 100%; max-width: none; height: 276.76%; top: -15.405%; }
.senseng-contact-hero .senseng-reference-scene { mask-image: linear-gradient(90deg, transparent 37%, black 40%), linear-gradient(180deg, transparent 80%, black 88%); }
.senseng-contact-hero .senseng-reference-scene img { height: 326.115%; top: -18.15%; }
.senseng-reference-copy { position: relative; width: 48%; margin-left: 4.62%; padding: 2.6cqw 0; z-index: 1; }
.senseng-reference-copy .senseng-eyebrow { font-size: .91cqw; font-weight: 500; margin: 0 0 1cqw; }
.senseng-reference-copy .senseng-hero-h1 { font-size: 3.4cqw; line-height: .96; letter-spacing: -.12cqw; margin: 0 0 1.1cqw; }
.senseng-reference-copy .senseng-hero-sub { font-size: 1.3cqw; max-width: 30cqw; margin: 0 0 1.4cqw; }
.senseng-reference-copy .senseng-btn-pill { font-size: 1.17cqw !important; }
.senseng-contact-hero .senseng-reference-copy h1 { font-size: 4.15cqw !important; margin: 0 0 1cqw !important; }
.senseng-contact-hero .senseng-reference-copy p:not(.senseng-eyebrow) { font-size: 1.4cqw !important; margin: 0 !important; line-height: 1.4 !important; }
.senseng-contact-2col {
  max-width: 1536px;
  margin: 36px auto;
  padding: 0 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}
@media (max-width: 900px) {
  .senseng-contact-2col { grid-template-columns: 1fr; }
}


/* ------------------------------------------------------------- */
/* 02. SENSENG VIDEO (Template 2: 100vh Dynamic Fullscreen Video Hero) */
/* ------------------------------------------------------------- */
body[data-template="senseng-video"] {
  --paper: #ffffff;
  --ink: #073b91;
  --soft: #eef9ff;
  --line: #d6efff;
  --brand: #089ced;
  --brand-ink: #ffffff;
}
.senseng-video .hero {
  min-height: 100vh;
  height: 100vh;
  max-height: none;
  background: #073b91;
  position: relative;
  display: flex;
  align-items: center;
}
.senseng-video .hero video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}
.senseng-video .hero:after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7, 59, 145, 0.72) 0%, rgba(3, 24, 61, 0.85) 100%);
  z-index: 2;
}
.senseng-video .hero-content {
  position: relative;
  z-index: 3;
  color: #ffffff;
  text-align: center;
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.senseng-video .hero .hero-title {
  color: #ffffff;
  text-shadow: 0 4px 16px rgba(0,0,0,0.3);
  font-weight: 900;
  font-size: clamp(3rem, 6.5vw, 5.5rem);
}
.senseng-video .hero p {
  color: #e0f2fe;
  font-size: 1.35rem;
}
.senseng-video .hero-scroll-cue {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  color: #ffffff;
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  animation: bounce 2s infinite;
}
@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translate(-50%, 0); }
  40% { transform: translate(-50%, -10px); }
  60% { transform: translate(-50%, -5px); }
}

/* ------------------------------------------------------------- */
/* 03. SAAS AUTOMATION (Template 3: Automation SaaS Video Background) */
/* ------------------------------------------------------------- */
body[data-template="saas-automation"] {
  --paper: #090d16;
  --ink: #f8fafc;
  --soft: #121826;
  --line: #1e293b;
  --brand: #6366f1;
  --brand-ink: #ffffff;
  --display: Inter, system-ui, sans-serif;
  --body: Inter, system-ui, sans-serif;
}
.saas-automation .nav {
  background: rgba(9, 13, 22, 0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid #1e293b;
}
.saas-automation .hero {
  min-height: 750px;
  height: 88vh;
  background: #090d16;
  position: relative;
  display: flex;
  align-items: center;
}
.saas-automation .hero video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.55;
  z-index: 1;
}
.saas-automation .hero:after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(99, 102, 241, 0.15) 0%, rgba(9, 13, 22, 0.9) 75%);
  z-index: 2;
}
.saas-automation .hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
  align-items: center;
  margin: auto;
}
.saas-automation .hero .hero-title {
  background: linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 800;
  letter-spacing: -0.04em;
}
.saas-automation .product-card {
  background: #121826;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 24px;
  transition: border-color .3s, transform .3s;
}
.saas-automation .product-card:hover {
  border-color: #6366f1;
  transform: translateY(-4px);
}
.saas-automation .button {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border-radius: 10px;
  box-shadow: 0 0 24px rgba(99, 102, 241, 0.4);
}

/* ------------------------------------------------------------- */
/* 04. FINTECH PLATFORM (Template 4: Financial Technology & Asset Management) */
/* ------------------------------------------------------------- */
body[data-template="fintech-platform"] {
  --paper: #f8fafc;
  --ink: #0f172a;
  --soft: #ffffff;
  --line: #e2e8f0;
  --brand: #0284c7;
  --brand-ink: #ffffff;
}
.fintech-platform .nav {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}
.fintech-platform .hero {
  min-height: 600px;
  height: 72vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #ffffff;
}
.fintech-platform .product-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.fintech-platform .button {
  border-radius: 8px;
  font-weight: 600;
}

/* ------------------------------------------------------------- */
/* 05. DIGITAL MARKETING (Template 5: Digital Marketing & Growth Agency) */
/* ------------------------------------------------------------- */
body[data-template="digital-marketing"] {
  --paper: #ffffff;
  --ink: #18181b;
  --soft: #faf5ff;
  --line: #f3e8ff;
  --brand: #d946ef;
  --brand-ink: #ffffff;
}
.digital-marketing .hero {
  min-height: 620px;
  height: 75vh;
  background: linear-gradient(135deg, #4c1d95 0%, #701a75 50%, #831843 100%);
  color: #ffffff;
}
.digital-marketing .button {
  background: linear-gradient(90deg, #d946ef 0%, #ec4899 100%);
  border-radius: 9999px;
  box-shadow: 0 8px 20px rgba(217, 70, 239, 0.35);
}
.digital-marketing .product-card {
  border-radius: 20px;
  background: #faf5ff;
  border: 1px solid #f3e8ff;
  padding: 24px;
}

/* ------------------------------------------------------------- */
/* 06. PORTO ACCOUNTING (Template 6: Audit, Accounting & Corporate Tax Advisory) */
/* ------------------------------------------------------------- */
body[data-template="porto-accounting"] {
  --paper: #fdf1f3;
  --ink: #2b2b2b;
  --soft: #ffffff;
  --line: #e8d8d9;
  --brand: #d90a2c;
  --brand-ink: #ffffff;
  --display: 'Georgia', serif;
  --body: system-ui, -apple-system, sans-serif;
}
.porto-accounting .nav {
  background: #ffffff;
  border-bottom: 2px solid #d90a2c;
}
.porto-accounting .brand {
  font-family: var(--display);
  font-size: 1.85rem;
  color: #2b2b2b;
  letter-spacing: -0.5px;
}
.porto-accounting .hero {
  background: #2b2b2b;
  color: #ffffff;
}
.porto-accounting .hero .button {
  background: #d90a2c;
  color: #ffffff;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.porto-accounting .product-card {
  background: #ffffff;
  border-top: 3px solid #d90a2c;
  border-radius: 4px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

/* ------------------------------------------------------------- */
/* 07. CRAFTO CORPORATE (Template 7: Global Multinational Enterprise Group) */
/* ------------------------------------------------------------- */
body[data-template="crafto-corporate"] {
  --paper: #f9fafb;
  --ink: #111827;
  --soft: #ffffff;
  --line: #e5e7eb;
  --brand: #0047ff;
  --brand-ink: #ffffff;
  --display: 'Helvetica Neue', Arial, sans-serif;
  --body: 'Helvetica Neue', Arial, sans-serif;
}
.crafto-corporate .brand {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 1.3rem;
}
.crafto-corporate .hero {
  min-height: 700px;
  height: 82vh;
  background: #0f172a;
  color: #ffffff;
}
.crafto-corporate .hero .hero-title {
  font-size: clamp(3.5rem, 7vw, 7rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  text-transform: uppercase;
}
.crafto-corporate .product-card {
  border-radius: 0;
  border: 1px solid #111827;
  padding: 20px;
  background: #ffffff;
}

/* ------------------------------------------------------------- */
/* 08. JUNO TOYS (Template 8: Children Toys & Family Retail) */
/* ------------------------------------------------------------- */
body[data-template="juno-toys"] {
  --paper: #fffdf5;
  --ink: #3b2a1a;
  --soft: #fff6d6;
  --line: #fde047;
  --brand: #eab308;
  --brand-ink: #3b2a1a;
  --display: system-ui, -apple-system, sans-serif;
}
.juno-toys .hero {
  min-height: 550px;
  height: 68vh;
  background: linear-gradient(135deg, #fef08a 0%, #fed7aa 50%, #fbcfe8 100%);
  color: #451a03;
}
.juno-toys .hero:after {
  background: none;
}
.juno-toys .hero .hero-title {
  color: #78350f;
  font-weight: 900;
}
.juno-toys .button {
  background: #f59e0b;
  color: #ffffff;
  border-radius: 9999px;
  box-shadow: 0 6px 18px rgba(245, 158, 11, 0.4);
  font-weight: 800;
}
.juno-toys .product-card {
  border-radius: 24px;
  background: #ffffff;
  border: 3px solid #fef08a;
  padding: 16px;
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.12);
}

/* ------------------------------------------------------------- */
/* 09. CORPOX AI AGENCY (Template 9: Artificial Intelligence & Creative Studio) */
/* ------------------------------------------------------------- */
body[data-template="corpox-ai-agency"] {
  --paper: #050811;
  --ink: #f1f5f9;
  --soft: #0b1120;
  --line: #1e293b;
  --brand: #06b6d4;
  --brand-ink: #050811;
  --display: 'Space Grotesk', system-ui, sans-serif;
}
.corpox-ai-agency .nav {
  background: rgba(5, 8, 17, 0.9);
  border-bottom: 1px solid #1e293b;
}
.corpox-ai-agency .hero {
  min-height: 720px;
  height: 85vh;
  background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #050811 70%);
  color: #ffffff;
}
.corpox-ai-agency .hero .hero-title {
  background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 900;
}
.corpox-ai-agency .product-card {
  background: rgba(11, 17, 32, 0.85);
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(12px);
  box-shadow: 0 0 30px rgba(6, 182, 212, 0.08);
}
.corpox-ai-agency .button {
  background: linear-gradient(90deg, #06b6d4 0%, #6366f1 100%);
  border-radius: 8px;
  font-weight: 700;
}

/* ------------------------------------------------------------- */
/* 10. CORPOX CONSULTING (Template 10: Global Strategic Management Advisory) */
/* ------------------------------------------------------------- */
body[data-template="corpox-consulting"] {
  --paper: #f8fafc;
  --ink: #0f172a;
  --soft: #ffffff;
  --line: #e2e8f0;
  --brand: #0f2b59;
  --brand-ink: #ffffff;
  --display: 'Cinzel', 'Times New Roman', serif;
}
.corpox-consulting .nav {
  background: #ffffff;
  border-bottom: 1px solid #cbd5e1;
}
.corpox-consulting .hero {
  min-height: 650px;
  height: 76vh;
  background: linear-gradient(135deg, #0a192f 0%, #172a45 100%);
  color: #ffffff;
}
.corpox-consulting .hero .hero-title {
  font-family: var(--display);
  letter-spacing: -0.02em;
  font-weight: 600;
}
.corpox-consulting .product-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}
.corpox-consulting .button {
  background: #0f2b59;
  color: #ffffff;
  border-radius: 4px;
  border: 1px solid #d4af37;
}

@media (max-width: 1100px) {
  .senseng-header-inner { padding: 0 24px; }
  .senseng-nav { gap: 24px; }
  .senseng-value-props { padding: 32px 24px 28px; gap: 20px; }
  .senseng-vp-icon { width: 56px; height: 56px; min-width: 56px; }
  .senseng-vp-icon svg { width: 28px; height: 28px; }
  .senseng-vp-item { padding: 12px 14px; gap: 14px; }
  .senseng-showcase-box { padding: 0 24px; margin-bottom: 48px; }
  .senseng-showcase-card { padding: 28px 24px 32px; }
  .senseng-grid-8 { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .senseng-p-card { padding: 16px 14px 14px; }
  .senseng-footer-left { gap: 24px; }
  .senseng-footer-inner { flex-wrap: wrap; }
  .senseng-newsletter-inner { gap: 24px; padding: 28px; }
  .senseng-detail-grid { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
  .senseng-detail-grid .senseng-inquiry-box { grid-column: 1 / -1; }
}
@media (max-width: 900px) {
  .senseng-grid-8 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
}
@media (max-width: 760px) {
  .senseng-header { height: auto; position: relative; }
  .senseng-header-inner { flex-wrap: wrap; gap: 10px; padding: 12px 20px 0; }
  .senseng-logo img { width: 116px; }
  .senseng-header .senseng-logo img { margin-left: -13px; }
  .senseng-header-inner > .senseng-btn-pill { padding: 8px 12px; font-size: 11px; gap: 6px; }
  .senseng-nav { order: 3; width: 100%; justify-content: space-between; gap: 14px; }
  .senseng-nav-link { font-size: 15px; padding: 10px 0; }
  .senseng-hero-inner { flex-direction: column; align-items: stretch; }
  .senseng-hero-left { width: auto; margin: 0; padding: 30px 24px 12px; }
  .senseng-hero-left .senseng-eyebrow { font-size: 10px; letter-spacing: .23em; margin: 0 0 14px; }
  .senseng-hero-left .senseng-hero-h1 { font-size: clamp(31px, 6.8vw, 48px); letter-spacing: -1.2px; line-height: 1.04; margin-bottom: 18px; }
  .senseng-hero-left .senseng-hero-sub { font-size: 16px; max-width: 460px; margin: 0 0 20px; }
  .senseng-hero-left .senseng-btn-pill { font-size: 14px !important; padding: 12px 20px !important; }
  .senseng-hero-left .senseng-btn-pill svg { width: 20px; height: 20px; }
  .senseng-hero-scene { position: relative; inset: auto; order: 2; width: 180%; margin-left: -80%; aspect-ratio: 1536 / 429; }
  .senseng-hero-video-full { min-height: 560px; }
  .senseng-hero-video-content .senseng-hero-h1 { font-size: clamp(32px, 7vw, 46px); }
  .senseng-hero-video-content .senseng-eyebrow { font-size: 10px; }
  .senseng-video-actions { gap: 12px; }
  .senseng-video-actions .senseng-btn-pill { font-size: 14px !important; padding: 12px 20px !important; }
  .senseng-value-props { grid-template-columns: 1fr; gap: 16px; padding: 24px 16px 20px; }
  .senseng-vp-item { padding: 12px 14px; }
  .senseng-vp-item h3 { font-size: 18px; }
  .senseng-showcase-box { padding: 0 16px; margin-bottom: 36px; }
  .senseng-showcase-card { padding: 22px 16px 24px; border-radius: 20px; }
  .senseng-showcase-top { padding: 0; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 18px; }
  .senseng-showcase-top h2 { font-size: 22px !important; }
  .senseng-showcase-viewall, .senseng-showcase-top > a { font-size: 12px !important; padding: 6px 14px !important; }
  .senseng-grid-8 { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
  .senseng-p-card { padding: 14px 10px 12px; border-radius: 16px; }
  .senseng-p-card h4 { font-size: 13.5px; min-height: 36px; margin-bottom: 8px; }
  .senseng-p-spec { padding: 8px 10px; font-size: 11.5px; margin-bottom: 10px; }
  .senseng-btn-detail { font-size: 12.5px; padding: 8px 10px; }
  .senseng-footer, .senseng-newsletter { padding: 0 12px; }
  .senseng-footer-inner { padding: 24px; gap: 24px; }
  .senseng-footer-left { flex-direction: column; align-items: flex-start; gap: 16px; }
  .senseng-footer-divider { display: none; }
  .senseng-newsletter-inner { grid-template-columns: minmax(0,1fr); padding: 24px; gap: 20px; }
  .senseng-newsletter h2 { font-size: 26px; }
  .senseng-newsletter button { padding: 10px 14px; }
  .senseng-newsletter input { padding: 9px; font-size: 12px; }
  .senseng-about-hero-inner, .senseng-contact-hero-inner { flex-direction: column; padding: 0; }
  .senseng-reference-copy { width: auto; margin: 0; padding: 30px 24px 12px; }
  .senseng-reference-copy .senseng-eyebrow { font-size: 10px; margin: 0 0 14px; }
  .senseng-reference-copy .senseng-hero-h1 { font-size: 32px; letter-spacing: -1px; line-height: 1.04; margin: 0 0 18px; }
  .senseng-reference-copy .senseng-hero-sub { font-size: 16px; max-width: 100%; margin: 0 0 20px; }
  .senseng-reference-copy .senseng-btn-pill { font-size: 14px !important; }
  .senseng-contact-hero .senseng-reference-copy h1 { font-size: 36px !important; margin-bottom: 16px !important; }
  .senseng-contact-hero .senseng-reference-copy p:not(.senseng-eyebrow) { font-size: 16px !important; }
  .senseng-reference-scene { position: relative; inset: auto; order: 2; width: 180%; margin-left: -80%; aspect-ratio: 1536 / 370; }
  .senseng-contact-hero .senseng-reference-scene { aspect-ratio: 1536 / 314; }
  .senseng-contact-2col, .senseng-detail-grid, .senseng-cat-2col { grid-template-columns: minmax(0,1fr); padding: 0 20px; }
  .senseng-cat-cards-4 { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .senseng-partners { padding: 40px 20px !important; }
  .senseng-partners > div { grid-template-columns: repeat(2,minmax(0,1fr)) !important; gap: 12px !important; }
  .senseng-cat-filter-bar { flex-wrap: wrap; padding: 20px; gap: 16px; }
  .senseng-cat-filter-bar > div:first-child { flex-wrap: wrap; }
  .senseng-filter-pill { padding: 8px 14px; font-size: 13px; }
  .senseng-cat-hero { flex-direction: column; align-items: stretch; height: auto; padding: 28px 20px; gap: 20px; }
  .senseng-cat-hero > div:last-child { max-width: 100%; }
  .senseng-cat-hero h1 { font-size: 36px !important; }
  .senseng-cat-hero h2 { font-size: 22px !important; }
  .senseng-cat-section { padding: 0 20px; }
  .senseng-catalog-card { grid-template-columns: minmax(0,1fr); padding: 12px; gap: 8px; }
  .senseng-cat-card-body h4 { font-size: 16px; margin-top: 0; }
  .senseng-detail-grid > *, .senseng-form > *, .senseng-form input, .senseng-form select, .senseng-form textarea { min-width: 0; }
  .senseng-detail-thumbs { flex-wrap: wrap; justify-content: flex-start; }
  .senseng-detail-breadcrumb { padding: 16px 20px; flex-wrap: wrap; }
  .senseng-detail-h1 { font-size: 32px; }
  .senseng-contact-2col > div { padding: 24px 18px !important; }
}

/* ------------------------------------------------------------- */
/* DYNAMIC EFFECTS: SCROLL REVEAL, HUD SCAN, FLOATING & CARDS    */
/* ------------------------------------------------------------- */
@keyframes wrArcadePulse {
  0% { opacity: 0.4; }
  100% { opacity: 1; filter: drop-shadow(0 0 8px #00f5d4); }
}
@keyframes wrArcadeFloat {
  0% { transform: translateY(0); }
  100% { transform: translateY(-12px); }
}
@keyframes wrArcadeScan {
  0% { top: 0; opacity: 0.9; }
  50% { opacity: 1; }
  100% { top: 100%; opacity: 0.1; }
}
@keyframes wrArcadeBar {
  0% { height: 6px; }
  100% { height: 24px; }
}
@keyframes wrFloat {
  0% { transform: translateY(0); }
  100% { transform: translateY(-10px); }
}
@keyframes wrFloatReverse {
  0% { transform: translateY(0); }
  100% { transform: translateY(10px); }
}

/* Apple-grade Progressive Enhancement & Scroll Reveal (Blur + Scale + Translation) */
[data-reveal] {
  opacity: 1;
  transform: none;
  filter: none;
  transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.85s cubic-bezier(0.16, 1, 0.3, 1),
              filter 0.85s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform, filter;
}
.wr-motion-ready [data-reveal]:not(.wr-revealed) {
  opacity: 0;
  transform: translateY(32px) scale(0.97);
  filter: blur(8px);
}
.wr-motion-ready [data-reveal="fade-up"]:not(.wr-revealed) {
  opacity: 0;
  transform: translateY(32px) scale(0.97);
  filter: blur(8px);
}
.wr-motion-ready [data-reveal="fade-down"]:not(.wr-revealed) {
  opacity: 0;
  transform: translateY(-32px) scale(0.97);
  filter: blur(8px);
}
.wr-motion-ready [data-reveal="slide-left"]:not(.wr-revealed) {
  opacity: 0;
  transform: translateX(-40px);
  filter: blur(6px);
}
.wr-motion-ready [data-reveal="slide-right"]:not(.wr-revealed) {
  opacity: 0;
  transform: translateX(40px);
  filter: blur(6px);
}
.wr-motion-ready [data-reveal="zoom-in"]:not(.wr-revealed) {
  opacity: 0;
  transform: scale(0.90);
  filter: blur(10px);
}
[data-reveal].wr-revealed {
  opacity: 1 !important;
  transform: none !important;
  filter: blur(0px) !important;
}

/* Apple-style Staggered Ripple Entrances */
.wr-motion-ready [data-reveal]:nth-child(1) { transition-delay: 0.04s; }
.wr-motion-ready [data-reveal]:nth-child(2) { transition-delay: 0.09s; }
.wr-motion-ready [data-reveal]:nth-child(3) { transition-delay: 0.14s; }
.wr-motion-ready [data-reveal]:nth-child(4) { transition-delay: 0.19s; }
.wr-motion-ready [data-reveal]:nth-child(5) { transition-delay: 0.24s; }
.wr-motion-ready [data-reveal]:nth-child(6) { transition-delay: 0.29s; }
.wr-motion-ready [data-reveal]:nth-child(7) { transition-delay: 0.34s; }
.wr-motion-ready [data-reveal]:nth-child(8) { transition-delay: 0.39s; }

/* Apple Keynote Floating Levitation */
@keyframes wrAppleHeroFloat {
  0% {
    transform: translateY(0px) rotate(0deg);
    filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.08));
  }
  50% {
    transform: translateY(-12px) rotate(0.6deg);
    filter: drop-shadow(0 25px 40px rgba(0, 0, 0, 0.13));
  }
  100% {
    transform: translateY(0px) rotate(0deg);
    filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.08));
  }
}
.wr-hero-float {
  animation: wrAppleHeroFloat 5s ease-in-out infinite alternate;
  will-change: transform, filter;
}

/* Apple Spring Micro-Interactions on Buttons */
.button, .senseng-btn-pill, .senseng-filter-pill, .senseng-btn-detail {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease, background 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}
.button:hover, .senseng-btn-pill:hover, .senseng-btn-detail:hover {
  transform: scale(1.03) translateY(-1px);
}
.button:active, .senseng-btn-pill:active, .senseng-filter-pill:active, .senseng-btn-detail:active {
  transform: scale(0.95) translateY(1px);
}

/* Apple Frosted Glass Sticky Header */
.senseng-header {
  background: rgba(255, 255, 255, 0.82) !important;
  backdrop-filter: saturate(180%) blur(20px) !important;
  -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
  border-bottom: 1px solid rgba(226, 232, 240, 0.7) !important;
}

/* Apple Watch / Activity Style Dynamic Progress Bars with Liquid Sheen */
.wr-progress-container {
  width: 100%;
  background: rgba(148, 163, 184, 0.15);
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
  height: 8px;
  margin: 6px 0;
}
.wr-progress-bar {
  height: 100%;
  width: 0%;
  border-radius: 9999px;
  background: linear-gradient(90deg, var(--brand, #089ced) 0%, #38bdf8 100%);
  transition: width 1.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}
.wr-progress-bar::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%);
  animation: wrAppleSheen 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes wrAppleSheen {
  0% { transform: translateX(-150%); }
  100% { transform: translateX(150%); }
}

/* Apple Bouncing Next-Screen Indicator */
.wr-scroll-down {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  animation: wrAppleScrollBounce 2.4s cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 8px 18px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #1e293b;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.5);
  transition: all 0.25s ease;
}
.wr-scroll-down:hover {
  animation-play-state: paused;
  transform: translateY(3px) scale(1.03);
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
@keyframes wrAppleScrollBounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0) scale(1); }
  40% { transform: translateY(-8px) scale(1.03); }
  60% { transform: translateY(-3px) scale(1.01); }
}

/* Banner Carousel & Fade Transitions */
.wr-carousel {
  position: relative;
  overflow: hidden;
}
.wr-carousel-track {
  display: flex;
  transition: transform 0.65s cubic-bezier(0.25, 1, 0.5, 1);
  width: 100%;
}
.wr-carousel-slide {
  min-width: 100%;
  flex-shrink: 0;
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.wr-carousel-slide.fade {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.8s ease-in-out;
}
.wr-carousel-slide.fade.active {
  opacity: 1;
  pointer-events: auto;
  position: relative;
}
.wr-carousel-nav {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}
.wr-carousel-dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.45);
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
}
.wr-carousel-dot.active {
  width: 28px;
  background: #ffffff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
}

/* Apple-grade Card Lift & Hover Transitions */
.wr-card-hover, .senseng-p-card, .wr-candy-card, .wr-wonder-card, .wr-arcade-card, .wr-nature-card, .wr-minimal-card {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
  will-change: transform, box-shadow;
}
.senseng-p-card:hover {
  transform: translateY(-8px) scale(1.015);
  box-shadow: 0 22px 45px -8px rgba(7, 59, 145, 0.18) !important;
  border-color: #7dd3fc !important;
}
.senseng-p-card:hover .senseng-p-img-wrap img {
  transform: scale(1.08);
}
.senseng-p-card:hover .senseng-btn-detail {
  background: #0284c7;
  color: #ffffff !important;
  border-color: #0284c7;
  box-shadow: 0 6px 18px rgba(2, 132, 199, 0.3);
}
.senseng-vp-item {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
}
.senseng-vp-item:hover {
  transform: translateY(-6px) scale(1.015);
  box-shadow: 0 16px 36px rgba(7, 59, 145, 0.1) !important;
  border-color: #bae6fd !important;
  background: #ffffff;
}
.senseng-vp-item:hover .senseng-vp-icon {
  transform: scale(1.14) rotate(6deg);
  box-shadow: 0 8px 22px rgba(7, 59, 145, 0.16);
}
.senseng-partners > div > div {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
}
.senseng-partners > div > div:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 45px rgba(7, 59, 145, 0.14) !important;
}

@keyframes wrPulseAura {
  0% { box-shadow: 0 0 0 0 rgba(125, 211, 252, 0.6); }
  70% { box-shadow: 0 0 0 14px rgba(125, 211, 252, 0); }
  100% { box-shadow: 0 0 0 0 rgba(125, 211, 252, 0); }
}
.senseng-video-toggle {
  animation: wrPulseAura 3s infinite;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
}
.senseng-video-toggle:hover {
  transform: scale(1.12);
}

.wr-candy-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 45px rgba(255, 107, 139, 0.22) !important;
  border-color: #ffccd5 !important;
}
.wr-candy-card img {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.wr-candy-card:hover img {
  transform: scale(1.07);
}

.wr-wonder-card:hover {
  transform: translateY(-8px) scale(1.015);
  box-shadow: 0 20px 45px rgba(38, 70, 83, 0.12) !important;
  border-color: #2a9d8f !important;
}
.wr-wonder-card img {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.wr-wonder-card:hover img {
  transform: scale(1.06);
}

.wr-arcade-card:hover {
  transform: translateY(-8px) scale(1.015);
  border-color: #00f5d4 !important;
  box-shadow: 0 0 32px rgba(0, 245, 212, 0.4) !important;
}
.wr-arcade-card img {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.wr-arcade-card:hover img {
  transform: scale(1.07);
}

.wr-nature-card:hover {
  transform: translateY(-8px) scale(1.015);
  box-shadow: 0 20px 45px rgba(45, 74, 34, 0.16) !important;
  border-color: #4a7c59 !important;
}
.wr-nature-card img {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.wr-nature-card:hover img {
  transform: scale(1.06);
}

.wr-minimal-card:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08) !important;
  border-color: #111827 !important;
}
.wr-minimal-card img {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.wr-minimal-card:hover img {
  transform: scale(1.05);
}

.wr-card-hover {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.wr-card-hover:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}

/* ------------------------------------------------------------- */
/* B2B LIGHT-THEMED FLAGSHIP TEMPLATES                           */
/* ------------------------------------------------------------- */
body[data-template="luggage-leather-banner"] {
  background: #fdfcf9;
  color: #1f1610;
}
body[data-template="luggage-voyage-video"] {
  background: #f5f8fc;
  color: #0f172a;
}
body[data-template="jewelry-luxury-banner"] {
  background: #faf8f5;
  color: #1c1417;
}
body[data-template="jewelry-timeless-video"] {
  background: #f8fafc;
  color: #0b192c;
}
body[data-template="homedecor-aesthetic-banner"] {
  background: #fbf9f5;
  color: #292524;
}
body[data-template="homedecor-living-video"] {
  background: #f9fafb;
  color: #111827;
}
body[data-template="furniture-minimal-banner"] {
  background: #ffffff;
  color: #18181b;
}
body[data-template="furniture-spatial-video"] {
  background: #f8fafc;
  color: #0f172a;
}
body[data-template="kitchen-culinary-banner"] {
  background: #f8fafc;
  color: #0f172a;
}
body[data-template="kitchen-gourmet-video"] {
  background: #fffbeb;
  color: #271b12;
}
body[data-template="drinkware-ceramic-banner"] {
  background: #fdfbf7;
  color: #1c1917;
}
body[data-template="drinkware-thermal-video"] {
  background: #f0f9ff;
  color: #0f172a;
}
body[data-template="beauty-skincare-banner"] {
  background: #fffafb;
  color: #1c1917;
}
body[data-template="beauty-glow-video"] {
  background: #faf8ff;
  color: #1e1b4b;
}
body[data-template="electronics-gadget-banner"] {
  background: #f8fafc;
  color: #0f172a;
}
body[data-template="electronics-smart-video"] {
  background: #f1f5f9;
  color: #0f172a;
}
body[data-template="tools-precision-banner"] {
  background: #f4f4f6;
  color: #0f172a;
}
body[data-template="tools-workshop-video"] {
  background: #f5f5f4;
  color: #1c1917;
}
body[data-template="sports-trail-banner"] {
  background: #f6f8f5;
  color: #14532d;
}
body[data-template="sports-kinetic-video"] {
  background: #f8fafc;
  color: #0f172a;
}
/* Pet Supplies — warm coral/sand palette */
body[data-template="pet-supplies-banner"] {
  background: #fef7f4;
  color: #3b1f0e;
}
body[data-template="pet-wellness-video"] {
  background: #f0fdfa;
  color: #134e4a;
}
/* Stationery & Office — sage/cream palette */
body[data-template="stationery-craft-banner"] {
  background: #f8faf6;
  color: #1a2e1a;
}
body[data-template="stationery-studio-video"] {
  background: #f5f7fa;
  color: #1e3a5f;
}
/* Posters, Stickers & Prints — pop/gallery palette */
body[data-template="poster-graphic-banner"] {
  background: #fefbff;
  color: #2d1040;
}
body[data-template="poster-gallery-video"] {
  background: #fffaf5;
  color: #3b1a0a;
}
/* Food & Packaging — terracotta/olive palette */
body[data-template="food-artisan-banner"] {
  background: #fdf8f3;
  color: #3b2712;
}
body[data-template="food-harvest-video"] {
  background: #fafbf5;
  color: #2a3517;
}

/* Single Product Showcase Templates */
body[data-template="single-device-showcase"],
body[data-template="single-artisan-craft"],
body[data-template="single-wellness-nordic"] {
  overflow-x: hidden;
  box-sizing: border-box;
}

body[data-template="single-device-showcase"] *,
body[data-template="single-device-showcase"] *::before,
body[data-template="single-device-showcase"] *::after,
body[data-template="single-artisan-craft"] *,
body[data-template="single-artisan-craft"] *::before,
body[data-template="single-artisan-craft"] *::after,
body[data-template="single-wellness-nordic"] *,
body[data-template="single-wellness-nordic"] *::before,
body[data-template="single-wellness-nordic"] *::after {
  box-sizing: border-box;
}

body[data-template="single-device-showcase"] img,
body[data-template="single-artisan-craft"] img,
body[data-template="single-wellness-nordic"] img {
  max-width: 100%;
  height: auto;
}

body[data-template="single-device-showcase"] {
  background: #f8fafc;
  color: #0f172a;
}
body[data-template="single-artisan-craft"] {
  background: #fdfbf7;
  color: #1e1915;
}
body[data-template="single-wellness-nordic"] {
  background: #f8faf7;
  color: #1e2d21;
}

@media (max-width: 992px) {
  .sa-stages-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
  .sa-hero-pure-image-banner {
    height: 55vh !important;
    min-height: 420px !important;
  }
  .sa-hero-pure-image-plaque {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 16px !important;
  }
  .sw-hero-split-grid {
    grid-template-columns: 1fr !important;
    gap: 40px !important;
  }
}

@media (max-width: 768px) {
  .sd-header-inner,
  .sa-header-inner,
  .sw-header-inner {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 16px !important;
  }
  .sd-nav,
  .sa-nav,
  .sw-nav {
    flex-wrap: wrap !important;
    gap: 10px 16px !important;
  }
  .sd-footer-grid,
  .sa-footer-grid,
  .sw-footer-grid,
  .sd-hero-grid,
  .sd-hero-stats,
  .sd-bento-top,
  .sd-bento-row,
  .sd-bento-row2,
  .sd-layers-grid,
  .sd-spec-grid,
  .sd-detail-main-grid,
  .sd-detail-subspecs,
  .sd-detail-specs,
  .sa-hero-grid,
  .sa-stages-grid,
  .sa-provenance-grid,
  .sa-detail-grid,
  .sw-footer-grid,
  .sw-hero-grid,
  .sw-hero-split-grid,
  .sw-rhythm-grid,
  .sw-clinical-grid,
  .sw-provenance-grid,
  .sw-detail-grid {
    grid-template-columns: 1fr !important;
    gap: 20px !important;
  }
  .sa-hero-pure-image-banner {
    height: 48vh !important;
    min-height: 360px !important;
  }
  .sa-hero-pure-image-plaque {
    bottom: 16px !important;
    left: 16px !important;
    right: 16px !important;
  }
}

/* Shared responsive layout for the single-product editorial sections. */
.wr-single-content-grid > *,
.wr-single-thumbnails > * {
  min-width: 0;
  overflow-wrap: anywhere;
}
.wr-single-table-scroll {
  max-width: 100%;
  overscroll-behavior-x: contain;
}
.wr-single-table-scroll table {
  min-width: 640px;
}
@media (max-width: 768px) {
  .wr-single-content-grid {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 24px !important;
  }
  .wr-single-thumbnails {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    gap: 8px !important;
  }
}

@keyframes wrPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.92);
  }
}
@keyframes wrFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-reveal] {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    transition: none !important;
  }
  .wr-progress-bar {
    transition: none !important;
  }
  .wr-scroll-down {
    animation: none !important;
  }
  * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
  }
}
`;
