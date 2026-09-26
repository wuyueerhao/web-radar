# Single-product template media and design — 2026-09-26

Each template presents exactly one primary product. A saved primaryProductId wins; otherwise the first product is used. Additional saved products are preserved, but are not exported as catalog entries or inquiry choices. Product photos and confirmed facts replace sample content. A missing customer product photo stays empty rather than showing a different sample product.

| Template | Home banner | Recommended customer assets |
| --- | --- | --- |
| Single Device Keynote & Hardware Stage | Full-bleed circuit video, dark overlay, live title and CTA | One product master; optional 2–4 detail images of that same product. Background MP4 H.264 1920×1080, 10–20 seconds, muted loop, plus matching poster. |
| Single Artisan Heritage & Atelier Spread | Pure photograph, no overlaid text. Title and CTA below image | One product master; landscape hero 2560×1440, keep subject within central crop. Optional details of the same piece. |
| Single Nordic Serene & Circadian Studio | Split live text / arched lifestyle photograph; stacked on mobile | One product master; portrait lifestyle image 1600×2000, optional detail photos of the same object. No video required. |

Uploaded page Banner settings continue to override the built-in hero. Product-detail pages do not receive page Banners. Preview does not send inquiries. Stock images are demonstration media, not proof of customer specifications, manufacturing, certifications or endorsements.

## Bundled asset provenance

- `hardware.mp4`, `hardware.jpg`: Tima Miroshnichenko, [Printed Circuit Board Close up](https://www.pexels.com/video/printed-circuit-board-close-up-6754820/), [Pexels license](https://www.pexels.com/license/). Original 4K clip transcoded to 1280×720 H.264 for the bundled background, approximately 13 seconds. Poster is the source clip thumbnail. Runtime uses a poster until playback, respects reduced motion and data saver, offers pause/play, and pauses in hidden tabs.
- `artisan.jpg`: Renzo Watches, [person wearing black leather strap analog watch](https://unsplash.com/photos/person-wearing-black-leather-strap-analog-watch-6N-i1CrQkzA), [Unsplash license](https://unsplash.com/license). The photographed brand is not an endorsement; replace with an authorized customer product photo for publication.
- `nordic.jpg`: Nubelson Fernandes, [white and black desk lamp on white wooden table](https://unsplash.com/photos/white-and-black-desk-lamp-on-white-wooden-table-hZTAJIPEoao), [Unsplash license](https://unsplash.com/license).

Photos are bundled under `public/templates/single-product/` rather than requested from a third-party image host at page load. Source author and license references are retained here for maintenance.
