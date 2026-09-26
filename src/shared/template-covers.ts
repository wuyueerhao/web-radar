import manifest from '../worker/template-guides/covers.json';

const covers: Readonly<Record<string, { url: string }>> = manifest;
const legacy: Readonly<Record<string, string>> = {
  natural: 'senseng-clean', technology: 'saas-automation', explorer: 'crafto-corporate',
};
const legacyCovers = new Set(['fintech-platform','digital-marketing','porto-accounting','crafto-corporate','juno-toys','corpox-consulting']);
/** Each current template uses its own rendered homepage, including industry variants. */
export function templateCoverUrl(template: string): string {
  const id=legacy[template] || template;
  return covers[id]?.url || (legacyCovers.has(id) ? `/templates/previews/${id}.jpg` : covers['senseng-clean'].url);
}
