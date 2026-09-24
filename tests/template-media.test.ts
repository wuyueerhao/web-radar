import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../src/client/TemplateSelector';
import { templateMediaRequirements } from '../src/shared/template-media';
import { getMaterialsTemplate } from '../src/templates/materials';
import { referenceLayouts } from '../src/templates/themes/referenceLayouts';

describe('template media checklist stays aligned with the renderer', () => {
  it('covers exactly the selectable templates', () => {
    expect(TEMPLATES).toHaveLength(50);
    expect(Object.keys(templateMediaRequirements).sort()).toEqual(
      TEMPLATES.map((t) => t.id).sort(),
    );
  });
  it.each(['fintech-platform', 'digital-marketing', 'porto-accounting', 'crafto-corporate', 'juno-toys', 'corpox-consulting'])(
    '%s remains readable for existing sites but is absent from the new-site selector', (id) => {
      expect(TEMPLATES.some(template => template.id === id)).toBe(false);
      expect(templateMediaRequirements).not.toHaveProperty(id);
      expect(getMaterialsTemplate(id)).toMatchObject({ templateId: id, materialsReady: true });
      expect(getMaterialsTemplate(id, `2026-09-19.${id}-materials.1`)).toMatchObject({ templateId: id, materialsReady: true });
    },
  );
  it.each(Object.entries(referenceLayouts).filter(([id]) => id in templateMediaRequirements))(
    '%s reflects actual image slots and bundled videos',
    (id, layout) => {
      const media = templateMediaRequirements[id as keyof typeof templateMediaRequirements]!;
      expect(media.productCount).toBe(layout.slots.length);
      expect(media.videos).toBe((layout.html.match(/<video\b/g) || []).length);
      const dimensions = layout.slots.map((s) => `${s.width}x${s.height}`).sort();
      expect(
        media.slots.flatMap((s) => Array(s.count).fill(`${s.width}x${s.height}`)).sort(),
      ).toEqual(dimensions);
    },
  );
});
