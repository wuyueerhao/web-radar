import type { TemplateId } from './model';

export interface TemplateMediaRequirements {
  productCount: number;
  productSize: string;
  bannerSize: string;
  bannerNote: string;
  videos: number;
  slots: { count: number; width: number; height: number }[];
}

// Original slot geometry mirrors referenceLayouts; keep the large HTML bundle out of the editor.
// Product counts are recommendations for avoiding repeated images, never upload minimums.
export const templateMediaRequirements: Partial<Record<TemplateId, TemplateMediaRequirements>> = {
  'senseng-clean': {
    productCount: 8,
    productSize: '1536 × 1024（3:2）',
    bannerSize: '2560 × 800（3.2:1 宽幅展台，适合 2K/大屏通栏）',
    bannerNote: '经典展台与天空背景已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1536,
        height: 1024,
      },
    ],
  },
  'senseng-video': {
    productCount: 8,
    productSize: '1536 × 1024（3:2）',
    bannerSize: '2560 × 1440（16:9 全屏画卷，适配 2K/4K/Retina 大屏）',
    bannerNote: '保留默认背景时无需上传。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1536,
        height: 1024,
      },
    ],
  },
  'senseng-candy': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 930（8:3 宽幅甜美画卷，适配萌宠主图排版）',
    bannerNote: '马卡龙糖果粉彩背景与悬浮萌宠特写已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'senseng-wonder': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1070（12:5 北欧治愈插画与自然光画卷）',
    bannerNote: '北欧温暖画卷与波浪曲线沉浸背景已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'senseng-arcade': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1000（16:6 赛博霓虹机能全景背景）',
    bannerNote: '赛博机能 HUD 仪表台与极光电光特写已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'senseng-nature': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（8:3 森林原木与自然光晨雾背景）',
    bannerNote: '原野森林生态画卷与晨雾自然光影已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'senseng-minimal': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 830（3:1 极简现代艺术画廊宽幅背景）',
    bannerNote: '瑞士国际主义极简雕塑展台与纯净留白已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'universal-trade-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 900（16:5 全品类现代旗舰展台，适配大屏通栏）',
    bannerNote: '现代化全品类旗舰商贸展台与 Apple 液态玻璃光影已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'universal-showcase-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 全景沉浸视界动态视频，适配 2K/4K 大屏）',
    bannerNote: '100vh 动态出海商贸与智能制造视界视频已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'toys-figure-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（8:3 赛博机能与潮玩亚克力展台背景）',
    bannerNote: '潮玩艺术展馆、霓虹微光与亚克力悬浮展台已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'toys-interactive-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 动态机动潮玩与可动机甲视频，适配 2K/4K）',
    bannerNote: '可动机甲与互动公仔动态演示全屏视频已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'plush-cushion-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 900（16:5 奶油风云朵云绒治愈展台）',
    bannerNote: '奶油风超柔治愈美学、云朵波浪与亲肤触感展台已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'plush-living-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 慢调软包时光沉浸视频，适配 2K/4K）',
    bannerNote: '慢镜头生活场景短片与晨光微风慢回弹动效已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'apparel-fabric-banner': {
    productCount: 8,
    productSize: '1200 × 1600（3:4 高定画册比例）',
    bannerSize: '2560 × 960（8:3 国际时装杂志 Editorial 画册留白展台）',
    bannerNote: '高定面料经纬微距光影与典雅英文字体排版已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1600,
      },
    ],
  },
  'apparel-runway-video': {
    productCount: 8,
    productSize: '1200 × 1600（3:4 高定画册比例）',
    bannerSize: '2560 × 1440（16:9 Runway 走秀模特与高定面料飘逸视频，适配 2K/4K）',
    bannerNote: '动态时装风尚走秀模特与高定飘逸面料全屏视频已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1600,
      },
    ],
  },
  'footwear-craft-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 920（16:5.7 先锋工匠鞋履气垫透视展台）',
    bannerNote: '工程级鞋底气垫透视与手工缝线工匠皮革展台已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'footwear-kinetic-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 破风越野冲刺与回弹动能视频，适配 2K/4K）',
    bannerNote: '户外越野冲刺、抓地爆发与动力回弹全屏动态短片已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'luggage-leather-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 940（16:5.9 托斯卡纳手工植鞣皮具明亮画册展台）',
    bannerNote: '天然植鞣皮质感与暖米白展台已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'luggage-voyage-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 阳光航站楼登机动态全景视频，适配 2K/4K）',
    bannerNote: '阳光航站楼机组出行全景视频已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'jewelry-luxury-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 950（16:6 旺多姆高珠明亮采光展盒）',
    bannerNote: '珍珠米白丝绸展台与香槟金光晕已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'jewelry-timeless-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 瑞士日内瓦制表工坊自然光陀飞轮视频，适配 2K/4K）',
    bannerNote: '瑞士日内瓦无尘明亮制表工坊与自产陀飞轮高帧率微距视频已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'homedecor-aesthetic-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 980（16:6.1 晨光日式侘寂素烧陶艺生活展台）',
    bannerNote: '燕麦柔奶白陶艺生活场景与1280度高温窑变肌理已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'homedecor-living-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 百叶窗阳光流动治愈生活短片，适配 2K/4K）',
    bannerNote: '百叶窗阳光流动与现代艺术居所生活短片已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'furniture-minimal-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 920（16:5.7 美术馆级包豪斯实木展台）',
    bannerNote: '纯白几何网格底色与大正传统榫卯拆解图已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'furniture-spatial-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 现代紧凑型空间折叠家具演示视频，适配 2K/4K）',
    bannerNote: '小户型多功能变形家具平滑折叠演示视频已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'kitchen-culinary-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 洁净不锈钢主厨料理台展台）',
    bannerNote: '67层折叠锻打水波纹与15度水冷微开刃金相图已内置。',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'kitchen-gourmet-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 阳光法式私厨慢炖料理短片，适配 2K/4K）',
    bannerNote: '慢动作法式烹饪与汤汁微滚视频已内置。',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'drinkware-ceramic-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 artisan stoneware kiln studio）',
    bannerNote: 'Warm stoneware kiln photography with ceramic texture backgrounds.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'drinkware-thermal-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 thermal insulation lab demo video）',
    bannerNote: 'Vacuum insulation thermal performance demonstration video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'beauty-skincare-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 luminous skincare studio）',
    bannerNote: 'Rose-gold dewy skincare editorial photography.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'beauty-glow-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 holographic glow serum application video）',
    bannerNote: 'Iridescent holographic glow serum texture video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'electronics-gadget-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 dark tech showcase studio）',
    bannerNote: 'Dark graphite floating device photography with spec callouts.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'electronics-smart-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 deep-space smart device demo video）',
    bannerNote: 'Neon-pulse smart device feature demonstration video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'tools-precision-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 industrial blueprint workshop）',
    bannerNote: 'Blueprint grid with safety-orange precision tool photography.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'tools-workshop-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 dark forge welding workshop video）',
    bannerNote: 'Welding spark and forging process demonstration video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'sports-trail-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 alpine trail expedition scene）',
    bannerNote: 'Topographic contour mountain trail expedition photography.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'sports-kinetic-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 high-velocity sports action video）',
    bannerNote: 'Kinetic motion-blur action sports performance video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'pet-supplies-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 warm coral pet supplies showcase）',
    bannerNote: 'Playful coral-apricot pet product floating display.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'pet-wellness-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 teal-mint pet wellness lifestyle video）',
    bannerNote: 'Pet wellness and care lifestyle cinematic video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'stationery-craft-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 sage cream stationery craft studio）',
    bannerNote: 'Sage-cream minimalist desk workspace photography.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'stationery-studio-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 luxury desk studio writing demo video）',
    bannerNote: 'Premium desk accessory and writing demonstration video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'poster-graphic-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 pop-art graphic print gallery）',
    bannerNote: 'Memphis-style pop-art graphic print display.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'poster-gallery-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 sunset gallery exhibition showcase video）',
    bannerNote: 'Art gallery exhibition and print showcase cinematic video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'food-artisan-banner': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 960（16:6 terracotta artisan farm-to-table studio）',
    bannerNote: 'Terracotta and olive artisan food photography.',
    videos: 0,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'food-harvest-video': {
    productCount: 8,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 golden harvest table cinematic video）',
    bannerNote: 'Golden amber harvest table and ingredient cinematic video.',
    videos: 1,
    slots: [
      {
        count: 8,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'single-device-showcase': {
    productCount: 1,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 dark keynote cyber hardware showcase）',
    bannerNote: '单一主商品；电路微距视频背景。建议另备同一商品的细节与场景图，不需要多个商品。',
    videos: 1,
    slots: [
      {
        count: 1,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'single-artisan-craft': {
    productCount: 1,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '2560 × 1440（16:9 纯图摄影 Banner）',
    bannerNote: '单一主商品；整幅纯图 Banner，图片内不叠加文字；标题与按钮在图片下方。',
    videos: 0,
    slots: [
      {
        count: 1,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'single-wellness-nordic': {
    productCount: 1,
    productSize: '1200 × 1200（1:1）',
    bannerSize: '1600 × 2000（4:5 图文首屏右侧配图）',
    bannerNote: '单一主商品；左文右图，手机上下排列。保留图片主体，文字独立可编辑。',
    videos: 0,
    slots: [
      {
        count: 1,
        width: 1200,
        height: 1200,
      },
    ],
  },
  'saas-automation': {
    productCount: 12,
    productSize: '1200 × 1200（1:1），主体四周留白',
    bannerSize: '2560 × 1140（9:4 现代科技软件大屏通栏）',
    bannerNote: '保留默认背景时无需上传。',
    videos: 1,
    slots: [
      {
        count: 1,
        width: 2580,
        height: 1594,
      },
      {
        count: 1,
        width: 660,
        height: 1040,
      },
      {
        count: 1,
        width: 842,
        height: 576,
      },
      {
        count: 1,
        width: 680,
        height: 354,
      },
      {
        count: 1,
        width: 585,
        height: 285,
      },
      {
        count: 1,
        width: 585,
        height: 368,
      },
      {
        count: 4,
        width: 1186,
        height: 928,
      },
      {
        count: 1,
        width: 1090,
        height: 336,
      },
      {
        count: 1,
        width: 456,
        height: 352,
      },
    ],
  },
  'corpox-ai-agency': {
    productCount: 12,
    productSize: '1200 × 1200（1:1），主体四周留白',
    bannerSize: '2560 × 1100（7:3 智能算力网格全景背景）',
    bannerNote: '保留默认背景时无需上传。',
    videos: 0,
    slots: [
      {
        count: 3,
        width: 842,
        height: 730,
      },
      {
        count: 6,
        width: 494,
        height: 494,
      },
      {
        count: 1,
        width: 980,
        height: 1100,
      },
      {
        count: 2,
        width: 1068,
        height: 1215,
      },
    ],
  },
};

