import { guideSchema, guideIds, type TemplateGuide } from './schema';
import guide0 from './documents/corpox-ai-agency.json';
import guide7 from './documents/saas-automation.json';
import guide8 from './documents/senseng-clean.json';
import guide9 from './documents/senseng-video.json';
import guide10 from './documents/senseng-candy.json';
import guide11 from './documents/senseng-wonder.json';
import guide12 from './documents/senseng-arcade.json';
import guide13 from './documents/senseng-nature.json';
import guide14 from './documents/senseng-minimal.json';
import guideUniversalBanner from './documents/universal-trade-banner.json';
import guideUniversalVideo from './documents/universal-showcase-video.json';
import guideToysBanner from './documents/toys-figure-banner.json';
import guideToysVideo from './documents/toys-interactive-video.json';
import guidePlushBanner from './documents/plush-cushion-banner.json';
import guidePlushVideo from './documents/plush-living-video.json';
import guideApparelBanner from './documents/apparel-fabric-banner.json';
import guideApparelVideo from './documents/apparel-runway-video.json';
import guideFootwearBanner from './documents/footwear-craft-banner.json';
import guideFootwearVideo from './documents/footwear-kinetic-video.json';
import guideLuggageBanner from './documents/luggage-leather-banner.json';
import guideLuggageVideo from './documents/luggage-voyage-video.json';
import guideJewelryBanner from './documents/jewelry-luxury-banner.json';
import guideJewelryVideo from './documents/jewelry-timeless-video.json';
import guideHomeDecorBanner from './documents/homedecor-aesthetic-banner.json';
import guideHomeDecorVideo from './documents/homedecor-living-video.json';
import guideFurnitureBanner from './documents/furniture-minimal-banner.json';
import guideFurnitureVideo from './documents/furniture-spatial-video.json';
import guideKitchenBanner from './documents/kitchen-culinary-banner.json';
import guideKitchenVideo from './documents/kitchen-gourmet-video.json';
import guideDrinkwareBanner from './documents/drinkware-ceramic-banner.json';
import guideDrinkwareVideo from './documents/drinkware-thermal-video.json';
import guideBeautyBanner from './documents/beauty-skincare-banner.json';
import guideBeautyVideo from './documents/beauty-glow-video.json';
import guideElectronicsBanner from './documents/electronics-gadget-banner.json';
import guideElectronicsVideo from './documents/electronics-smart-video.json';
import guideToolsBanner from './documents/tools-precision-banner.json';
import guideToolsVideo from './documents/tools-workshop-video.json';
import guideSportsBanner from './documents/sports-trail-banner.json';
import guideSportsVideo from './documents/sports-kinetic-video.json';
import guidePetBanner from './documents/pet-supplies-banner.json';
import guidePetVideo from './documents/pet-wellness-video.json';
import guideStationeryBanner from './documents/stationery-craft-banner.json';
import guideStationeryVideo from './documents/stationery-studio-video.json';
import guidePosterBanner from './documents/poster-graphic-banner.json';
import guidePosterVideo from './documents/poster-gallery-video.json';
import guideFoodBanner from './documents/food-artisan-banner.json';
import guideFoodVideo from './documents/food-harvest-video.json';
import guideSingleDevice from './documents/single-device-showcase.json';
import guideSingleArtisan from './documents/single-artisan-craft.json';
import guideSingleWellness from './documents/single-wellness-nordic.json';

const documents = [
  guide0,
  guide7,
  guide8,
  guide9,
  guide10,
  guide11,
  guide12,
  guide13,
  guide14,
  guideUniversalBanner,
  guideUniversalVideo,
  guideToysBanner,
  guideToysVideo,
  guidePlushBanner,
  guidePlushVideo,
  guideApparelBanner,
  guideApparelVideo,
  guideFootwearBanner,
  guideFootwearVideo,
  guideLuggageBanner,
  guideLuggageVideo,
  guideJewelryBanner,
  guideJewelryVideo,
  guideHomeDecorBanner,
  guideHomeDecorVideo,
  guideFurnitureBanner,
  guideFurnitureVideo,
  guideKitchenBanner,
  guideKitchenVideo,
  guideDrinkwareBanner,
  guideDrinkwareVideo,
  guideBeautyBanner,
  guideBeautyVideo,
  guideElectronicsBanner,
  guideElectronicsVideo,
  guideToolsBanner,
  guideToolsVideo,
  guideSportsBanner,
  guideSportsVideo,
  guidePetBanner,
  guidePetVideo,
  guideStationeryBanner,
  guideStationeryVideo,
  guidePosterBanner,
  guidePosterVideo,
  guideFoodBanner,
  guideFoodVideo,
  guideSingleDevice,
  guideSingleArtisan,
  guideSingleWellness,
].map((value) => guideSchema.parse(value));
export const templateGuides: readonly TemplateGuide[] = guideIds.map((id) => {
  const matches = documents.filter((guide) => guide.templateId === id);
  if (matches.length !== 1) throw new Error(`Expected one template guide for ${id}`);
  return matches[0];
});
export function getTemplateGuide(id: string): TemplateGuide | undefined {
  return templateGuides.find((guide) => guide.templateId === id);
}
