import { z } from 'zod';

export const guideIds = [
  'senseng-clean',
  'senseng-video',
  'senseng-candy',
  'senseng-wonder',
  'senseng-arcade',
  'senseng-nature',
  'senseng-minimal',
  'universal-trade-banner',
  'universal-showcase-video',
  'toys-figure-banner',
  'toys-interactive-video',
  'plush-cushion-banner',
  'plush-living-video',
  'apparel-fabric-banner',
  'apparel-runway-video',
  'footwear-craft-banner',
  'footwear-kinetic-video',
  'luggage-leather-banner',
  'luggage-voyage-video',
  'jewelry-luxury-banner',
  'jewelry-timeless-video',
  'homedecor-aesthetic-banner',
  'homedecor-living-video',
  'furniture-minimal-banner',
  'furniture-spatial-video',
  'kitchen-culinary-banner',
  'kitchen-gourmet-video',
  'drinkware-ceramic-banner',
  'drinkware-thermal-video',
  'beauty-skincare-banner',
  'beauty-glow-video',
  'electronics-gadget-banner',
  'electronics-smart-video',
  'tools-precision-banner',
  'tools-workshop-video',
  'sports-trail-banner',
  'sports-kinetic-video',
  'pet-supplies-banner',
  'pet-wellness-video',
  'stationery-craft-banner',
  'stationery-studio-video',
  'poster-graphic-banner',
  'poster-gallery-video',
  'food-artisan-banner',
  'food-harvest-video',
  'single-device-showcase',
  'single-artisan-craft',
  'single-wellness-nordic',
  'saas-automation',
  'corpox-ai-agency',
] as const;
const nonempty = z.string().min(1);
const dimensions = z.strictObject({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const binding = z.strictObject({
  strategy: z.enum([
    'product-image',
    'product-reuse',
    'page-banner',
    'brand',
    'draft-field',
    'manual-template-edit',
  ]),
  path: nonempty,
  note: nonempty,
});
export const guideSchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  revision: nonempty,
  templateId: z.enum(guideIds),
  name: nonempty,
  documentLanguage: z.literal('zh-CN'),
  purpose: nonempty,
  visualSystem: z.strictObject({
    palette: z.array(z.string().regex(/^#[a-f\d]{6}$/i)).min(2),
    artDirection: nonempty,
    composition: nonempty,
    tone: nonempty,
    avoid: z.array(nonempty).min(1),
  }),
  inputContract: z.strictObject({
    required: z.array(nonempty),
    optional: z.array(nonempty),
    missingInputPolicy: nonempty,
    priority: z.array(nonempty),
    untrustedInputPolicy: nonempty,
  }),
  pagePlan: z.strictObject({
    home: z.array(nonempty),
    catalog: z.array(nonempty),
    about: z.array(nonempty),
    contact: z.array(nonempty),
    productDetail: z.array(nonempty),
  }),
  inventory: z.strictObject({
    recommendedDistinctProductImages: z.number().int().positive(),
    minimumProductImages: z.number().int().positive(),
    bundledVideoCount: z.number().int().nonnegative(),
    defaultHero: z.enum(['video', 'image-or-css']),
    reuseRule: nonempty,
    decorativeAssets: nonempty,
  }),
  layoutImageSlots: z
    .array(
      z.strictObject({
        id: nonempty,
        purpose: nonempty,
        dimensions,
        defaultAsset: nonempty,
        binding,
      }),
    )
    .min(1),
  assets: z
    .array(
      z.strictObject({
        id: nonempty,
        kind: z.enum(['image', 'video']),
        purpose: nonempty,
        quantity: z.strictObject({
          min: z.number().int().nonnegative(),
          recommended: z.number().int().positive(),
          max: z.number().int().positive(),
        }),
        dimensions,
        formats: z.array(nonempty).min(1),
        recommendedMaxBytes: z.number().int().positive(),
        required: z.boolean(),
        composition: nonempty,
        promptTemplate: nonempty,
        negativePrompt: nonempty,
        binding,
        checks: z.array(nonempty),
        durationSeconds: z
          .strictObject({
            min: z.number().positive(),
            recommended: z.number().positive(),
            max: z.number().positive(),
          })
          .optional(),
        framesPerSecond: z.number().int().positive().optional(),
        codec: nonempty.optional(),
        posterAsset: nonempty.optional(),
      }),
    )
    .min(1),
  textSlots: z
    .array(
      z.strictObject({
        id: nonempty,
        purpose: nonempty,
        quantity: z.number().int().positive(),
        length: z.strictObject({
          unit: z.literal('unicode-code-points'),
          recommendedMax: z.number().int().positive(),
          maxLines: z.number().int().positive(),
          localeNote: nonempty,
        }),
        promptTemplate: nonempty,
        binding,
      }),
    )
    .min(1),
  generationWorkflow: z.array(nonempty).min(1),
  qualityChecks: z.array(nonempty).min(1),
  outputContract: z.strictObject({
    schemaEndpoint: nonempty,
    description: nonempty,
    requiredFields: z.array(nonempty),
    bindingWarning: nonempty,
  }),
});
export type TemplateGuide = z.infer<typeof guideSchema>;

// A generation manifest, not a publish request. No files are fetched by this API.
export const generationOutputSchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  templateId: z.enum(guideIds),
  guideRevision: nonempty,
  language: z.string().min(2).max(35),
  assets: z
    .array(
      z.strictObject({
        assetSpecId: nonempty,
        productId: nonempty.optional(),
        kind: z.enum(['image', 'video']),
        delivery: z.discriminatedUnion('type', [
          z.strictObject({ type: z.literal('url'), url: z.url().regex(/^https:\/\//) }),
          z.strictObject({ type: z.literal('assetId'), assetId: nonempty }),
        ]),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm']),
        bytes: z.number().int().positive(),
        alt: z.string().max(300),
        durationSeconds: z.number().positive().optional(),
        framesPerSecond: z.number().positive().optional(),
      }),
    )
    .max(100),
  copy: z
    .array(
      z.strictObject({
        textSlotId: nonempty,
        productId: nonempty.optional(),
        page: z.enum(['home', 'catalog', 'about', 'contact', 'productDetail']).optional(),
        itemIndex: z.number().int().nonnegative().optional(),
        text: z.string().max(5000),
        factReferences: z.array(nonempty),
      }),
    )
    .max(300),
  missingFacts: z.array(nonempty).max(100),
  warnings: z.array(nonempty).max(100),
});
export const guideJsonSchema = z.toJSONSchema(guideSchema);
export const outputJsonSchema = z.toJSONSchema(generationOutputSchema);
