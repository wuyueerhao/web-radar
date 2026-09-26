import React, { useState } from 'react';
import type { Draft, TemplateId } from '../shared/model';
import { Button, Icon } from './components';
import { templateMediaRequirements } from '../shared/template-media';

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  englishName: string;
  tagline: string;
  category: 'consumer' | 'tech' | 'enterprise' | 'creative' | 'single';
  industries: string[];
  features: string[];
  accentColor: string;
  badge: string;
  hasVideo?: boolean;
  previewImg: string;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'senseng-clean',
    name: '经典工贸',
    englishName: 'Clean Trade',
    tagline: '参考 webimg 原案；高雅明亮排版，强化货架视觉与批发询盘',
    category: 'consumer',
    industries: ['跨境工贸', '消费玩具', '日用百货', '家居收纳', '快消品'],
    features: ['按设计图重建', '左文右图 Hero 展位', '8宫格品类橱窗', '快速询盘表单'],
    accentColor: '#089ced',
    badge: '参考设计图 · 首选模版',
    previewImg: '/templates/previews/senseng-clean.jpg',
  },
  {
    id: 'senseng-video',
    name: '全屏视频版',
    englishName: 'Immersive Video',
    tagline: '模版 1 动感升级：首屏 100vh 全屏视频背景铺满，带呼吸感大标题与平滑下滚',
    category: 'consumer',
    industries: ['品牌出海', '精品独立站', '潮流消费品', '生态家居', '外贸工厂'],
    features: ['100vh 动态视频全屏铺满', '半透明磨砂质感浮层', '平滑下滚引导箭头', '声画动效控制'],
    accentColor: '#0284c7',
    badge: '首屏动态视频 · 沉浸震撼',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'senseng-candy',
    name: '缤纷糖果乐园',
    englishName: 'Candy Pop & Play',
    tagline: '专为儿童萌趣玩具与触感解压公仔定制；马卡龙粉彩体系、立体圆角泡泡与感官触觉矩阵',
    category: 'consumer',
    industries: ['儿童玩具', '萌宠解压', '感官潮玩', '亲子母婴', '外贸出口'],
    features: ['马卡龙糖果配色', '左右分栏萌趣舞台', '4大感官魔力标签', '立体糖果展台网格'],
    accentColor: '#ff6b8b',
    badge: '童趣感官玩具 · 爆款首选',
    previewImg: '/templates/previews/senseng-candy.jpg',
  },
  {
    id: 'senseng-wonder',
    name: '北欧温润工坊',
    englishName: 'Nordic Wonder Studio',
    tagline: '专为品质玩具独立站与全龄桌面疗愈设计；温暖奶油大地色、北欧便当盒画廊与波浪有机曲线',
    category: 'consumer',
    industries: ['益智玩具', '治愈解压', '精品独立站', '生活美学潮玩', '品牌代工'],
    features: ['全屏画卷轮播', '北欧便当盒画廊', '波浪有机曲线分割', '材质工艺与FAQ'],
    accentColor: '#f77f00',
    badge: '北欧温润绘本 · 精品独立站',
    previewImg: '/templates/previews/senseng-wonder.jpg',
  },
  {
    id: 'senseng-arcade',
    name: '霓虹赛博潮玩',
    englishName: 'Cyber Arcade & Pop',
    tagline: '机能潮玩机甲 HUD 与电光霓虹；物理触感动态进度条、实时跑数与赛博盲盒展台',
    category: 'consumer',
    industries: ['潮流盲盒', '机能玩具', '极客解压', '电竞桌面潮玩', '外贸直采'],
    features: ['赛博HUD仪表台', '物理参数动态进度条', '实时跑数计数器', '街机芯片卡片'],
    accentColor: '#00f5d4',
    badge: '机能赛博潮玩 · 动态跑数',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'senseng-nature',
    name: '森林原野工坊',
    englishName: 'Botanical & Forest',
    tagline: '零塑环保自然主义；晨露鼠尾草绿、生态减碳动态进度条、波浪曲线与植物画册瀑布流',
    category: 'consumer',
    industries: ['母婴玩具', '环保可降解', '自然生活美学', '绿色供应链', '亲子早教'],
    features: ['柔和波浪弧线', '生态减碳进度条', '晨雾滑入动效', '植物标本瀑布流'],
    accentColor: '#4a7c59',
    badge: '零塑环保自然 · 动态减碳条',
    previewImg: '/templates/previews/senseng-nature.jpg',
  },
  {
    id: 'senseng-minimal',
    name: '瑞士极简生活馆',
    englishName: 'Swiss Minimal Gallery',
    tagline: '瑞士现代主义大留白与艺术品展台；精密阻尼刻度条、典藏编号序列与奢品解构详情',
    category: 'creative',
    industries: ['艺术潮玩', '设计师买手店', '奢品感官生活', '现代家居', '高端礼品'],
    features: ['艺术馆聚光灯展台', '精密材料学阻尼刻度', '编号典藏展签', '奢品级单品解构'],
    accentColor: '#c59b27',
    badge: '瑞士极简画廊 · 奢品级解构',
    previewImg: '/templates/previews/senseng-minimal.jpg',
  },
  {
    id: 'saas-automation',
    name: 'SaaS 智能自动化',
    englishName: 'Automation SaaS Tailwind',
    tagline: '参考 automation-saas-tailwind；浅色视频首屏、悬浮胶囊导航与玻璃面板',
    category: 'tech',
    industries: ['SaaS 软件', '云计算', '开发者工具', '自动化平台', '出海软件'],
    features: ['参考站原版视频', '悬浮圆角导航', '玻璃展示面板', '自动绑定产品图片'],
    accentColor: '#bef264',
    badge: '原版动态视频 · 清透浅色',
    hasVideo: true,
    previewImg: '/templates/previews/saas-automation.jpg',
  },
  {
    id: 'corpox-ai-agency',
    name: 'Corpox AI 智能工坊',
    englishName: 'Corpox Next-Gen AI Studio',
    tagline: '参考 Corpox AI Agency；浅粉同心拱形背景、珊瑚红按钮与居中大字',
    category: 'tech',
    industries: ['AI 大模型', '具身智能 / 机器人', '机器视觉', '算法实验室', '硬核前沿科技'],
    features: ['浅粉同心拱形', '珊瑚红强调色', '居中大字排版', '自动绑定产品图片'],
    accentColor: '#ef6464',
    badge: '浅粉珊瑚 · AI 创意',
    previewImg: '/templates/previews/corpox-ai-agency.jpg',
  },
  {
    id: 'universal-trade-banner',
    name: '全品类精选展台',
    englishName: 'Universal Trade Banner',
    tagline: '通用商品旗舰展台；多层次悬浮微晶白底、Apple 液态玻璃胶囊导航与动态品类筛选魔盒',
    category: 'enterprise',
    industries: ['通用商品', '外贸出口', '日用消费品', '综合商贸', '多品类供应链'],
    features: ['全品类旗舰展台', 'Apple 液态玻璃', '动态品类筛选魔盒', '全套多语言富内页'],
    accentColor: '#1e3a8a',
    badge: '通用商品 · 旗舰展台',
    previewImg: '/templates/previews/senseng-clean.jpg',
  },
  {
    id: 'universal-showcase-video',
    name: '全景商贸视界',
    englishName: 'Universal Showcase Video',
    tagline: '100vh 动态出海商贸与智能制造视界视频；流体毛玻璃音画控制器与实时跑数商贸指标',
    category: 'enterprise',
    industries: ['跨境商贸', '通用制造', '综合工贸', '大宗采购', '出海品牌'],
    features: ['100vh 沉浸视频背景', '流体毛玻璃控制器', '商贸出海动态跑数', '多语言内页矩阵'],
    accentColor: '#0284c7',
    badge: '通用商品 · 沉浸视频',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'toys-figure-banner',
    name: '潮玩手办殿堂',
    englishName: 'Toys & Figure Banner',
    tagline: '赛博机能与潮玩艺术展馆；霓虹微光亚克力展台、3D 景深悬浮盲盒展签与材质解构',
    category: 'creative',
    industries: ['玩具与公仔', '潮流手办', '机甲模型', 'IP 授权衍生', '盲盒收藏'],
    features: ['赛博亚克力展台', '盲盒编号展签', '模具精度解构', '全套手办定制内页'],
    accentColor: '#8b5cf6',
    badge: '玩具公仔 · 潮玩展台',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'toys-interactive-video',
    name: '机动潮玩动感视界',
    englishName: 'Toys Interactive Video',
    tagline: '可动机甲与互动公仔动态演示全屏视频；悬浮磨砂玻璃 HUD 仪表与光效粒子动效',
    category: 'consumer',
    industries: ['玩具与公仔', '机动潮玩', '可动机甲', '益智模型', '遥控与声光玩具'],
    features: ['100vh 可动机甲视频', '磨砂玻璃 HUD 仪表', '动态参数进度条', '全套机甲规格内页'],
    accentColor: '#f59e0b',
    badge: '玩具公仔 · 动感视界',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'plush-cushion-banner',
    name: '云朵云绒治愈馆',
    englishName: 'Plush & Cushion Banner',
    tagline: '奶油风超柔治愈美学；云朵轻柔波浪分割、亲肤触感微交互与婴儿级环保材质印章',
    category: 'consumer',
    industries: ['毛绒与靠垫', '毛绒玩偶', '慢回弹靠垫', '治愈抱枕', '家居软饰'],
    features: ['奶油风云朵美学', '亲肤触感微交互', '母婴级环保认证', '全套治愈系内页'],
    accentColor: '#e07a5f',
    badge: '毛绒靠垫 · 云绒治愈',
    previewImg: '/templates/previews/senseng-candy.jpg',
  },
  {
    id: 'plush-living-video',
    name: '慢调软包时光',
    englishName: 'Plush Living Video',
    tagline: '慢镜头生活场景短片；晨光微风拂动织绒与慢回弹靠垫解压受压恢复动效，清透晨雾液态毛玻璃',
    category: 'consumer',
    industries: ['毛绒与靠垫', '慢调生活', '精品软装', '治愈解压公仔', '舒适靠枕'],
    features: ['100vh 慢镜头织绒视频', '慢回弹受压恢复评测', '晨雾液态毛玻璃', '温馨家居全套内页'],
    accentColor: '#797d62',
    badge: '毛绒靠垫 · 慢调视界',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-nature.jpg',
  },
  {
    id: 'apparel-fabric-banner',
    name: '奢品织造工坊',
    englishName: 'Apparel & Fabric Banner',
    tagline: '国际时装杂志 Editorial 画册留白排版；高定面料经纬微距光影与典雅英文字体',
    category: 'creative',
    industries: ['服装与纺织品', '高端成衣', '时装定制', '经纬织物', '设计师买手女装'],
    features: ['时装画册留白排版', '经纬面料微距光影', '液态玻璃质感挂牌', 'CLO 3D 快速出样内页'],
    accentColor: '#27272a',
    badge: '服装纺织 · 奢品工坊',
    previewImg: '/templates/previews/senseng-minimal.jpg',
  },
  {
    id: 'apparel-runway-video',
    name: '动态时装风尚视界',
    englishName: 'Apparel Runway Video',
    tagline: 'Runway 走秀模特与高定面料飘逸动态视频；悬浮极简透明玻璃导航栏与光影折射',
    category: 'creative',
    industries: ['服装与纺织品', 'T台秀场风尚', '先锋时装品牌', '功能性运动服装', '外贸针织成衣'],
    features: ['100vh Runway 走秀视频', '悬浮透明玻璃导航', '面料垂坠动态质感', '时装季刊全套内页'],
    accentColor: '#b45309',
    badge: '服装纺织 · 秀场风尚',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'footwear-craft-banner',
    name: '先锋工匠鞋履台',
    englishName: 'Footwear Craft Banner',
    tagline: '工程级鞋底气垫透视；手工缝线与工匠皮革展台、材质分层解构悬浮标牌',
    category: 'consumer',
    industries: ['鞋靴制造', '户外徒步靴', '碳板竞速跑鞋', '固特异正装皮鞋', '潮牌运动鞋'],
    features: ['鞋底气垫工程透视', '分层解构悬浮标牌', '力学生物工效学', '全套鞋履定制内页'],
    accentColor: '#d97706',
    badge: '鞋靴制造 · 先锋工匠',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'footwear-kinetic-video',
    name: '破风运动鞋履动效',
    englishName: 'Footwear Kinetic Video',
    tagline: '户外越野冲刺、抓地爆发与动力回弹全屏动态短片；流光破风线条与物理抗扭刻度',
    category: 'tech',
    industries: ['鞋靴制造', '专业越野跑鞋', '轻量化马拉松竞速', '机能运动装备', '智能穿戴鞋履'],
    features: ['100vh 越野爆发冲刺视频', '物理抗扭动态刻度', '超临界发泡参数分析', '生物力学全套内页'],
    accentColor: '#10b981',
    badge: '鞋靴制造 · 破风动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'luggage-leather-banner',
    name: '托斯卡纳植鞣皮具',
    englishName: 'Tuscan Leather Goods',
    tagline: '托斯卡纳植鞣皮革行会认证；原色包浆蜕变时间线、马鞍双针缝线与纯铜五金',
    category: 'creative',
    industries: ['皮具箱包', '手工皮具', '轻奢配饰', '商务公文包', '外贸直采'],
    features: ['岁月包浆三重蜕变', '植鞣皮革行会背书', '马鞍双针纯铜五金', '传世手作全套内页'],
    accentColor: '#96562c',
    badge: '箱包 · 托斯卡纳植鞣',
    previewImg: '/templates/previews/senseng-clean.jpg',
  },
  {
    id: 'luggage-voyage-video',
    name: '航空工程旅行箱动效',
    englishName: 'AeroVoyage Travel Video',
    tagline: '德国拜耳三层防弹PC全屏动态视频；90cm跌落无损、Hinomoto静音轮系测试跑数',
    category: 'tech',
    industries: ['旅行拉杆箱', 'PC登机箱', '铝镁合金托运箱', '战术机能背包', '航空采购'],
    features: ['100vh 机场穿梭实录视频', '90cm跌落破坏性实验', 'Hinomoto万向静音轮', '航空商旅全套内页'],
    accentColor: '#0284c7',
    badge: '箱包 · 航空工程动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'jewelry-luxury-banner',
    name: '巴黎旺多姆高定珠宝',
    englishName: 'Place Vendôme Haute Joaillerie',
    tagline: '巴黎高级珠宝沙龙典藏；GIA 4C切工净度显微矩阵、微镶法式爪镶与金伯利道德可溯源',
    category: 'creative',
    industries: ['高级珠宝', 'GIA钻石戒指', '彩色宝石', '木佐祖母绿', '高级定制'],
    features: ['GIA 4C显微晶相矩阵', '巴黎沙龙微镶工艺', '金伯利道德溯源背书', '私享定制全套内页'],
    accentColor: '#c59b27',
    badge: '珠宝 · 旺多姆高定',
    previewImg: '/templates/previews/senseng-clean.jpg',
  },
  {
    id: 'jewelry-timeless-video',
    name: '瑞士机械时计陀飞轮动效',
    englishName: 'Swiss Horology Video',
    tagline: '瑞士高级制表工坊全屏机械微距动效；60秒飞行陀飞轮、日内瓦印记手工倒角与COSC认证',
    category: 'tech',
    industries: ['机械腕表', '瑞士陀飞轮', '万年历复杂时计', '精密钟表', '钟表OEM'],
    features: ['100vh 陀飞轮微距动态视频', '28800次高频游丝摆轮', '日内瓦波纹手工倒角', '天文台认证全套内页'],
    accentColor: '#2563eb',
    badge: '腕表 · 瑞士机械动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'homedecor-aesthetic-banner',
    name: '地中海粗陶与天然洞石',
    englishName: 'Mediterranean Stoneware & Travertine',
    tagline: '1300°C高温粗陶与罗马原生洞石；自然陈腐原泥、矿物氧化物洗染与质朴侘寂器形',
    category: 'creative',
    industries: ['家居装饰', '艺术陶瓷', '天然石材', '空间软装', '设计师买手店'],
    features: ['1300°C柴窑结晶完全玻化', '罗马天然原生孔隙洞石', '草木灰矿物调色洗染', '美学软装全套内页'],
    accentColor: '#b45309',
    badge: '家居 · 地中海陶艺',
    previewImg: '/templates/previews/senseng-wonder.jpg',
  },
  {
    id: 'homedecor-living-video',
    name: '日式侘寂环境光感官动效',
    englishName: 'Japandi Sensory Living Video',
    tagline: '晨光穿透亚麻窗帘静谧客厅动态视频；2700K昼夜节律调光、美利奴吸音羊毛格栅',
    category: 'consumer',
    industries: ['空间美学', '环境照明', '日式侘寂', '精品度假酒店', '感官软装'],
    features: ['100vh 静谧光影动态视频', '2700K节律漫反射和纸灯', '0.65NRC美利奴吸音羊毛', '感官陈设全套内页'],
    accentColor: '#d97706',
    badge: '家居 · 侘寂光影动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'furniture-minimal-banner',
    name: '包豪斯纯实木大匠工坊',
    englishName: 'Bauhaus Solid Woodcraft',
    tagline: '包豪斯纯粹结构主义；北美特级FAS黑胡桃木、传统双重抱头榫卯与零外露螺丝',
    category: 'enterprise',
    industries: ['实木家具', '黑胡桃餐桌椅', '包豪斯设计', '建筑师定制', '高端木作'],
    features: ['双重抱头榫卯结构拆解', '北美FAS纯实木大板直拼', '德国欧诗木植物木蜡油', '建筑级木作全套内页'],
    accentColor: '#a16207',
    badge: '家具 · 包豪斯实木',
    previewImg: '/templates/previews/senseng-minimal.jpg',
  },
  {
    id: 'furniture-spatial-video',
    name: '微公寓空间折叠变形动效',
    englishName: 'Spatial Kinetic Furniture Video',
    tagline: '现代城市微公寓空间折叠动态视频；德国气压助推隐形壁床、+45%高坪效释放',
    category: 'tech',
    industries: ['变形家具', '微公寓收纳', '智能折叠壁床', '长租公寓工程', '空间优化'],
    features: ['100vh 空间瞬时折叠动态视频', '德国Suspa气压双活塞机构', '50000次开合寿命认证', '微公寓整装全套内页'],
    accentColor: '#ea580c',
    badge: '家具 · 空间折叠动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'kitchen-culinary-banner',
    name: '米其林大马士革极刃工坊',
    englishName: 'Michelin Damascus Cutlery',
    tagline: '日本武生VG-10核心67层折叠锻打；60±2 HRC洛氏硬度、15°纯手工水磨双面极刃',
    category: 'consumer',
    industries: ['专业厨刀', '大马士革刀剪', '米其林后厨', '餐具器皿', '厨房用品'],
    features: ['67层折叠羽毛锻打花纹', '-196°C深冷液氮金相处理', '双面15°水磨镜面锋刃', '米其林后厨全套内页'],
    accentColor: '#b91c1c',
    badge: '厨具 · 大马士革极刃',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'kitchen-gourmet-video',
    name: '法式高定铸铁与铜芯炊具动效',
    englishName: 'French Gourmet Cookware Video',
    tagline: '大厨爆炒与煎烤诱人美食全屏动态视频；三层微晶玻璃质珐琅、五层纯铜芯导热黑科技',
    category: 'consumer',
    industries: ['高端锅具', '珐琅铸铁锅', '铜芯不锈钢煎锅', '烘焙器皿', '餐饮供应链'],
    features: ['100vh 珍馐烹饪动态视频', '三层微晶玻璃质珐琅锁鲜', '五层纯铜芯超速导热夹层', '星级后厨全套内页'],
    accentColor: '#c2410c',
    badge: '厨具 · 法式炊具动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'drinkware-ceramic-banner',
    name: '柴烧陶艺与手作陶坊',
    englishName: 'Artisan Ceramic & Kiln Studio',
    tagline: '天然信乐古原矿陶土与柴烧草木灰釉；1280°C原矿还原烧制，保留朴拙手作肌理与微孔透气性',
    category: 'consumer',
    industries: ['精品杯壶', '紫砂陶瓷', '手工陶艺', '手冲咖啡具', '外贸水杯'],
    features: ['1280°C柴烧原矿草木灰釉', '天然双重微孔自然透气', '极简液态玻璃冷凝拟真卡片', '手作窑坊专属全套内页'],
    accentColor: '#8c5936',
    badge: '杯壶 · 柴烧陶艺',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'drinkware-thermal-video',
    name: '双层真空锁温实验室动效',
    englishName: 'Thermal Lab Vacuum Tumbler Video',
    tagline: '冰川极寒冷凝与滚烫蒸汽动态视频；18/8医用级奥氏体不锈钢、航天级镀铜真空阻断层',
    category: 'consumer',
    industries: ['真空保温杯', '智能测温杯', '钛合金户外水壶', '车载咖啡杯', '杯壶出海'],
    features: ['100vh 冷热极端温差动态视频', '航天级镀铜真空阻热夹层', '24小时保冷保热仪表动效', '锁温实验室全套内页'],
    accentColor: '#0284c7',
    badge: '杯壶 · 锁温实验室动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'beauty-skincare-banner',
    name: '极萃植愈与分子护肤工坊',
    englishName: 'Botanical Skincare & Serum Atelier',
    tagline: '超临界微囊包裹高活性植萃精油；100%无水浓缩纯露基底，奢润水光玻璃肌与屏障修护',
    category: 'consumer',
    industries: ['植萃护肤', '精油个护', '无水配方', '有机美妆', '国风美妆'],
    features: ['超临界超低温微囊锁鲜萃取', '水光液态玻璃流体拟态质感', '分子透皮微水滴悬浮微动效', '植愈护肤全套定制内页'],
    accentColor: '#db2777',
    badge: '美妆 · 植萃灵光',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'beauty-glow-video',
    name: '焕颜全息流光医美动效',
    englishName: 'Luminous Glow & Serum Video',
    tagline: '全息光感精华液滴透润吸收动态视频；多维胜肽抗老、冻干微晶即刻渗透修护光损伤',
    category: 'consumer',
    industries: ['抗老精华', '修护冻干粉', '功效护肤', '院线医美', '护肤彩妆出海'],
    features: ['100vh 晶莹精华悬浮流光视频', '全息流光卡片交互透光呼吸', '抗老胜肽分子结构三维演示', '院线级护肤全套内页'],
    accentColor: '#9333ea',
    badge: '美妆 · 焕颜光感动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'electronics-gadget-banner',
    name: '声学旗舰与前沿数码展厅',
    englishName: 'Precision Hi-Fi Audio & Tech Gear',
    tagline: '定制铍振膜超低失真发烧声学单元；碳纤维腔体与电路微痕图腾，全景声声场沉浸体验',
    category: 'tech',
    industries: ['声学耳机', '数码周边', '智能桌面', '便携影音', '消费电子'],
    features: ['定制镀铍超宽频声学动圈', '电路微痕暗黑科技液态玻璃', '全频声学阻抗测量曲率看板', '旗舰数码全套专属内页'],
    accentColor: '#2563eb',
    badge: '电子 · 声学旗舰',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'electronics-smart-video',
    name: '未来智控全屋生态动效',
    englishName: 'Smart Living & Automation Video',
    tagline: '全屋物联网传感器微秒级联动动态视频；自研AIoT神经边缘芯片、低功耗全景空间智控',
    category: 'tech',
    industries: ['智能小家电', '空气炸锅', '扫地机器人', '智能厨电', '智能家居出海'],
    features: ['100vh 极黑深空智控联动动态视频', '微秒级边缘计算节点透镜', '动态响应式数据流指示灯光', '智能生态全套定制内页'],
    accentColor: '#06b6d4',
    badge: '家电 · 智控生态动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'tools-precision-banner',
    name: '微米级数控蓝图精工工场',
    englishName: 'Precision CNC & Industrial Hardware',
    tagline: '德国TIN涂层整体硬质合金与微米卡尺；±0.002mm超高加工公差，工业蓝图刻度美学',
    category: 'enterprise',
    industries: ['工业五金', '数控刀具', '精密量具', '汽修工具', '手工具出海'],
    features: ['±0.002mm微米级机械精度', '工业工程蓝图坐标网格视效', '液态防油污强化玻璃卡片', '精密五金全套定制内页'],
    accentColor: '#ea580c',
    badge: '工具 · 蓝图精工',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'tools-workshop-video',
    name: '工业锻造火花与动力机械动效',
    englishName: 'Heavy Workshop & Power Tools Video',
    tagline: '重型车床火花飞溅与无刷电机破岩动态视频；大扭矩双重过载保护、军工级防尘抗摔外壳',
    category: 'enterprise',
    industries: ['动力工具', '无刷电钻', '激光测距', '重型机械', '工业装备出海'],
    features: ['100vh 淬火飞溅重工现场动态视频', '无刷高扭力电机剖面动态展示', '重载防撞抗震安全系数标定', '工业锻工全套专属内页'],
    accentColor: '#d97706',
    badge: '设备 · 熔炼锻造动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'sports-trail-banner',
    name: '高山巅峰探险与轻量化行装',
    englishName: 'Alpine Trail & Ultralight Expeditions',
    tagline: 'Dyneema复合晶须纤维超轻防撕裂防暴雨；等高线海拔梯度视差，征服8000米极地气候',
    category: 'consumer',
    industries: ['高山徒步', '露营装备', '轻量帐篷', '越野跑装备', '户外出海'],
    features: ['Dyneema晶须超轻防撕裂科技', '高海拔地理等高线视差微层', '极寒暴风雨阻水液态流光面板', '高山徒步全套定制内页'],
    accentColor: '#059669',
    badge: '户外 · 巅峰探险',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'sports-kinetic-video',
    name: '破风竞速骑行与动力学动效',
    englishName: 'Kinetic Aero Racing & Speed Video',
    tagline: '风洞实验室疾速破风与公路越野冲线动态视频；单体全碳纤维气动车架、全天候抓地力矩阵',
    category: 'consumer',
    industries: ['竞速骑行', '公路车配件', '运动穿戴', '竞技滑雪', '极限运动出海'],
    features: ['100vh 极限速度气动破风动态视频', '风洞气动阻力雷达动态分析', '碳纤维应力分布晶格微动画', '极限竞速全套专属内页'],
    accentColor: '#e11d48',
    badge: '运动 · 极速破风动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'pet-supplies-banner',
    name: '温暖萌宠乐园与工匠宠物用品',
    englishName: 'Pet Supplies & Artisan Pet Craft',
    tagline: '温暖珊瑚粉与杏色渐变，圆角萌宠卡片与漂浮爪印微动效；兽医认证安全材料与环保无毒测试',
    category: 'consumer',
    industries: ['宠物用品', '猫狗项圈', '宠物窝垫', '益智玩具', '宠物出海'],
    features: ['温暖珊瑚粉活力萌宠视觉', '漂浮爪印微交互动画', '兽医权威认证材质解析', '萌宠用品全套专属内页'],
    accentColor: '#e85d5d',
    badge: '宠物 · 萌宠工匠',
    previewImg: '/templates/previews/senseng-candy.jpg',
  },
  {
    id: 'pet-wellness-video',
    name: '薄荷青绿宠物健康与机能护理',
    englishName: 'Pet Wellness & Health Care Video',
    tagline: '100vh 清新薄荷绿宠物户外奔跑动态视频；曲面流体有机布局与波浪微动效、水质过滤科技看板',
    category: 'consumer',
    industries: ['宠物健康', '机能喂食器', '宠物水质过滤', '宠物医疗', '高端宠物出海'],
    features: ['100vh 宠物户外奔跑动态视频', '曲面流体有机自然微动效', '水质过滤与喂食科技看板', '宠物护理全套专属内页'],
    accentColor: '#0d9488',
    badge: '宠物 · 健康护理动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'stationery-craft-banner',
    name: '鼠尾草绿极简纸品与文具工坊',
    englishName: 'Stationery Craft & Minimalist Paper Atelier',
    tagline: '鼠尾草绿与温润米白棉纸纹理，手绘铅笔线框与瑞士网格排版；FSC森林认证原木浆与无酸纸耐久实验',
    category: 'creative',
    industries: ['纸品文具', '手账活页本', '精装笔记本', '高档书写工具', '文创办公出海'],
    features: ['鼠尾草绿自然纸品美学', '笔记本格线精妙边框与铅笔排版', 'FSC环保与无酸纸实验看板', '纸品文具全套专属内页'],
    accentColor: '#6b8f71',
    badge: '文具 · 纸品工坊',
    previewImg: '/templates/previews/senseng-nature.jpg',
  },
  {
    id: 'stationery-studio-video',
    name: '深海藏青与轻奢雅致办公美学',
    englishName: 'Stationery Studio & Executive Desk Video',
    tagline: '100vh 精密机械笔与胡桃木收纳架旋转特写动态视频；建筑感精密切割网格与真皮桌垫质感',
    category: 'enterprise',
    industries: ['商务文具', '机械书写工具', '实木桌面收纳', '皮质文具', '高端办公出海'],
    features: ['100vh 雅致商务桌面动态视频', '建筑感精密切割网格布局', '真皮与黄铜微距高光质感', '轻奢办公全套专属内页'],
    accentColor: '#1e3a5f',
    badge: '文具 · 轻奢办公动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'poster-graphic-banner',
    name: '孟菲斯波普霓虹艺术与潮玩贴纸',
    englishName: 'Poster Graphic & Pop Art Prints',
    tagline: '电光洋红与青翠蓝撞色，孟菲斯几何波普图形与对角偏移网格；UV防褪色与高粘度背胶看板',
    category: 'consumer',
    industries: ['艺术微喷', '潮流海报', '激光贴纸', '车身贴花', '文化印刷出海'],
    features: ['孟菲斯波普几何前卫构图', '复古半色调网点与撞色高光', 'UV耐晒与防水背胶材料解析', '潮流海报全套专属内页'],
    accentColor: '#e91e8c',
    badge: '文创 · 波普潮贴',
    previewImg: '/templates/previews/senseng-wonder.jpg',
  },
  {
    id: 'poster-gallery-video',
    name: '日落画廊与艺术微喷展厅',
    englishName: 'Poster Gallery & Sunset Art Exhibition Video',
    tagline: '100vh 美术馆画廊漫游与展厅灯光动态视频；落日霞光渐变背景与错落有致的艺术微喷画廊墙',
    category: 'consumer',
    industries: ['画廊展览', '装饰画框', '艺术微喷', '数码印刷', '文创艺术出海'],
    features: ['100vh 美术馆展览漫游视频', '画廊墙马赛克式错落布局', '悬浮聚光灯照射微交互', '艺术微喷全套专属内页'],
    accentColor: '#ff6b35',
    badge: '文创 · 画廊展厅动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'food-artisan-banner',
    name: '赤陶橄榄自然农庄与匠心食品',
    englishName: 'Food Artisan & Farm-to-Table Packaging',
    tagline: '赤陶红与橄榄绿自然大地色系，牛皮纸原浆肌理；高山原蜜与初榨橄榄油欧盟有机冷灌装看板',
    category: 'consumer',
    industries: ['有机食品', '农庄特产', '食品包装', '调味酱料', '健康食品出海'],
    features: ['赤陶橄榄自然田园风味美学', '有机牛皮纸原浆手作质感', '欧盟有机与无菌冷灌装车间解析', '匠心食品全套专属内页'],
    accentColor: '#c2703e',
    badge: '食品 · 田园匠心',
    previewImg: '/templates/previews/senseng-arcade.jpg',
  },
  {
    id: 'food-harvest-video',
    name: '金秋丰收晨光与庄园食品盛宴',
    englishName: 'Food Harvest & Golden Table Cinematic Video',
    tagline: '100vh 晨曦麦田采摘与原浆烘焙慢动作电影视频；金琥珀色与森林深绿、溯源直采气调保鲜矩阵',
    category: 'consumer',
    industries: ['庄园食品', '烘焙糕点', '原浆果汁', '精品咖啡', '高端餐饮出海'],
    features: ['100vh 晨曦麦田慢动作电影视频', '金琥珀与森林绿奢雅丰收感', '溯源农场直采与气调保鲜看板', '庄园食品全套专属内页'],
    accentColor: '#d4a843',
    badge: '食品 · 丰收晨光动效',
    hasVideo: true,
    previewImg: '/templates/previews/senseng-video.jpg',
  },
  {
    id: 'single-device-showcase',
    name: '极客硬件展台 · 单品旗舰',
    englishName: 'Single Device Keynote & Hardware Stage',
    tagline: '单款科技硬件的沉浸式发布页；电路微距视频背景、深色舞台、主商品特写与真实参数',
    category: 'single',
    industries: ['声学硬件', '智能穿戴', '极客数码', '单品旗舰发布', '高科技众筹'],
    features: ['电路微距视频背景 · 可暂停', '深色硬件发布舞台', '聚焦一个主商品与真实参数', '同一商品细节图集与询盘'],
    accentColor: '#0284c7',
    badge: '单产品发布 · 硬件旗舰',
    hasVideo: true,
    previewImg: '/templates/previews/single-device-showcase.b636c180e1d4dfcd.jpg',
  },
  {
    id: 'single-artisan-craft',
    name: '典藏工坊腕表 · 单品奢作',
    englishName: 'Single Artisan Heritage & Atelier Spread',
    tagline: '单款腕表或手作品的摄影画册；纯图 Banner、图片下方独立标题与按钮、暖调纸感和衬线排版',
    category: 'single',
    industries: ['高级制表', '手工皮具', '珠宝孤品', '单品艺术收藏', '奢侈品定制'],
    features: ['整幅纯图 Banner · 无叠字', '暖调纸感与衬线画册', '围绕一件作品展示材质与细节', '作品详情、品牌故事与询盘'],
    accentColor: '#c5a880',
    badge: '单产品奢华 · 工匠典藏',
    previewImg: '/templates/previews/single-artisan-craft.cfd2241d68d14f55.jpg',
  },
  {
    id: 'single-wellness-nordic',
    name: '北欧轻愈生活 · 单品纯净',
    englishName: 'Single Nordic Serene & Circadian Studio',
    tagline: '单款家居器物的北欧生活页面；鼠尾草绿与燕麦白、左文右图首屏、柔和拱形摄影与日常场景',
    category: 'single',
    industries: ['芳疗香氛', '纯净护肤', '智能健康', '单品家居美学', '自然疗愈独立站'],
    features: ['图文分栏首屏 · 手机上下排列', '鼠尾草绿与燕麦白', '一个主商品与日常使用场景', '独立商品详情与咨询页面'],
    accentColor: '#4a7c59',
    badge: '单产品治愈 · 北欧晨雾',
    previewImg: '/templates/previews/single-wellness-nordic.7034a49e9eccbc00.jpg',
  },
];

const PRESET_COLORS = [
  { label: '品牌天蓝', value: '#089ced' },
  { label: '科技靛蓝', value: '#6366f1' },
  { label: '波尔多红', value: '#d90a2c' },
  { label: '克莱因蓝', value: '#0047ff' },
  { label: '活力暖黄', value: '#eab308' },
  { label: '霓虹青碧', value: '#06b6d4' },
  { label: '洋红极光', value: '#d946ef' },
  { label: '庄严深蓝', value: '#0f2b59' },
  { label: '自然墨绿', value: '#416851' },
];

const CATEGORIES = [
  { id: 'all', label: `全部模版 (${TEMPLATES.length})` },
  { id: 'single', label: `单品独立站与专品 (${TEMPLATES.filter((t) => t.category === 'single').length})` },
  { id: 'consumer', label: `品类与消费出海 (${TEMPLATES.filter((t) => t.category === 'consumer').length})` },
  { id: 'tech', label: `科技与 SaaS (${TEMPLATES.filter((t) => t.category === 'tech').length})` },
  { id: 'enterprise', label: `商贸与通用商品 (${TEMPLATES.filter((t) => t.category === 'enterprise').length})` },
  { id: 'creative', label: `艺术与时尚创意 (${TEMPLATES.filter((t) => t.category === 'creative').length})` },
] as const;

export default function TemplateSelector({
  draft,
  onUpdateDraft,
  onProceedToPublish,
  onBackToBasics,
  onSwitchToClone,
  onPreview,
}: {
  draft: Draft;
  onUpdateDraft: (patch: Partial<Draft>) => void;
  onProceedToPublish: () => void;
  onBackToBasics: () => void;
  onSwitchToClone?: () => void;
  onPreview: (template: TemplateDefinition) => void;
}) {
  const currentTemplate = draft.template || 'senseng-clean';
  const media = templateMediaRequirements[currentTemplate];
  const selectedTemplate = TEMPLATES.find((template) => template.id === currentTemplate);
  const currentColor = draft.brandColor || '#089ced';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTemplates = TEMPLATES.filter((tmpl) =>
    selectedCategory === 'all' ? true : tmpl.category === selectedCategory,
  );

  return (
    <div className="template-selector-container">
      <div className="template-step-header">
        <div>
          <span className="step-tag">极速建站分支 · 第 2 步 / 共 3 步</span>
          <h2>选择网站模版与品牌调色</h2>
          <p className="step-subtitle">
            共提供 {TEMPLATES.length}
            套精心设计的高保真行业旗舰模版（涵盖通用商品、玩具与公仔、毛绒与靠垫、服装与纺织品、鞋靴及科技出海等多品类，包含宽幅展台与沉浸视频型）。选中后将自动灌注你的公司与产品数据。
          </p>
        </div>

        <div
          className="branch-switch-badge"
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          {onSwitchToClone && (
            <Button
              kind="quiet"
              onClick={onSwitchToClone}
              style={{ color: '#4f46e5', fontWeight: 700 }}
            >
              <span>🎯 切换为 设计稿还原</span>
            </Button>
          )}
        </div>
      </div>

      {/* 像素级克隆专属横幅 */}
      {onSwitchToClone && (
        <div
          onClick={onSwitchToClone}
          style={{
            background:
              'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)',
            border: '1.5px dashed #6366f1',
            borderRadius: '14px',
            padding: '16px 20px',
            margin: '16px 0 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = '#4338ca')}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '28px' }}>🎯</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e1b4b' }}>
                没有看中现成模版？试试「设计稿还原模式」
              </div>
              <div style={{ fontSize: '12px', color: '#4338ca', marginTop: '3px' }}>
                上传整套页面设计图与产品素材，参考网址可补充文字内容；生成后对照预览检查布局与图片。
              </div>
            </div>
          </div>
          <Button
            kind="primary"
            style={{ background: '#4f46e5', fontSize: '13px', padding: '6px 16px' }}
          >
            立即开启克隆模式 →
          </Button>
        </div>
      )}

      {media && (
        <section className="template-media-guide" aria-label="当前模板素材清单">
          <h3>{selectedTemplate?.name} · 素材准备清单</h3>
          <p>
            产品主图每款 1
            张，已有产品图片会自动使用；同一图片可以复用到多个展示位置。以下为建议尺寸（宽 ×
            高，单位 px），无需按展示位置重复上传。
          </p>
          <dl className="template-media-summary">
            <div>
              <dt>产品图片</dt>
              <dd>
                建议 {media.productCount} 张不同产品主图 · {media.productSize}
              </dd>
              <small>按实际产品数量准备，少于建议数量也可使用模板。</small>
            </div>
            <div>
              <dt>首页 Banner（选填）</dt>
              <dd>{media.bannerSize} · 1 张；轮播 2–12 张</dd>
              <small>{media.bannerNote} 多图保持相同比例。</small>
            </div>
            <div>
              <dt>视频背景（选填）</dt>
              <dd>{media.videos ? `内置 ${media.videos} 段视频；无需额外上传` : '默认无需视频'}</dd>
              <small>
                自定义全屏背景：每组 1 段 MP4 / WebM，建议 2560 × 1440（16:9，适配 27–32 寸大屏及 4K），另备 1
                张同尺寸封面。超宽屏可用 3840 × 2160，边缘预留安全裁切空间。
              </small>
            </div>
            <div>
              <dt>品牌素材（选填）</dt>
              <dd>Logo 1 张 · 建议 600 × 200；网站图标 1 张 · 建议 512 × 512</dd>
              <small>图片支持 PNG / JPEG / WebP；透明 Logo 优先 PNG。网站图标也支持 ICO。</small>
            </div>
          </dl>
          <details key={currentTemplate}>
            <summary>
              查看模板展示图的数量与原始尺寸（
              {media.slots.reduce((sum, slot) => sum + slot.count, 0)} 处）
            </summary>
            <p>
              这些位置由产品主图自动填充；没有产品图片时使用内置示例图。尺寸用于了解原设计比例，不是分别上传的入口。装饰图与背景已内置。
            </p>
            <ul className="template-slot-sizes">
              {media.slots.map((slot) => (
                <li key={`${slot.width}-${slot.height}`}>
                  <strong>{slot.count} 处</strong>
                  <span>
                    {slot.width} × {slot.height} px
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <p className="template-media-help">
            产品图在「资料与产品」上传；替换首页或独立页面的背景、轮播及视频，在「页面 Banner /
            视频」设置。背景上的文字与按钮由页面呈现，建议上传不带文字的素材。
          </p>
        </section>
      )}

      {/* 分类筛选 Tab 栏 */}
      <div className="template-category-filters" role="group" aria-label="模板分类">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            aria-pressed={selectedCategory === cat.id}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 模版卡片选择区域 */}
      <div
        className="template-cards-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))' }}
      >
        {filteredTemplates.map((tmpl) => {
          const requirements = templateMediaRequirements[tmpl.id];
          const isSelected = currentTemplate === tmpl.id;
          return (
            <div
              key={tmpl.id}
              className={`template-card ${isSelected ? 'selected' : ''}`}
              onClick={() =>
                onUpdateDraft({
                  buildBranch: 'template',
                  template: tmpl.id,
                  brandColor: tmpl.accentColor,
                })
              }
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  onUpdateDraft({
                    buildBranch: 'template',
                    template: tmpl.id,
                    brandColor: tmpl.accentColor,
                  });
                }
              }}
              role="button"
              tabIndex={0}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <div
                className="template-card-badge"
                style={{ background: tmpl.hasVideo ? '#4f46e5' : undefined }}
              >
                {tmpl.badge}
              </div>

              {/* 真实模版视觉缩略图 */}
              <div
                className="template-mockup-preview"
                style={{
                  position: 'relative',
                  height: '210px',
                  overflow: 'hidden',
                  borderRadius: '8px 8px 0 0',
                  background: '#f8fafc',
                }}
              >
                <img
                  src={tmpl.previewImg}
                  alt={tmpl.name}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    transition: 'transform 0.3s ease',
                  }}
                />
                {tmpl.hasVideo && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(7, 59, 145, 0.88)',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backdropFilter: 'blur(4px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      zIndex: 2,
                    }}
                  >
                    <span>▶</span> 动态视频首屏
                  </div>
                )}
              </div>

              <div className="template-card-body" style={{ flex: 1 }}>
                <div className="template-name-row">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{tmpl.name}</h3>
                    <span className="template-en-name">{tmpl.englishName}</span>
                  </div>
                  {isSelected && (
                    <span className="selected-indicator">
                      <Icon name="check" size={16} /> 已选用
                    </span>
                  )}
                </div>

                <p className="template-tagline" style={{ minHeight: '44px' }}>
                  {tmpl.tagline}
                </p>

                <div className="template-tags">
                  {tmpl.industries.map((ind) => (
                    <span key={ind} className="industry-tag">
                      {ind}
                    </span>
                  ))}
                </div>

                {requirements && (
                  <div className="template-media-card" aria-label={`${tmpl.name}素材要求`}>
                    <strong>图片 / 视频准备</strong>
                    <span>
                      产品图：建议 {requirements.productCount} 张 · {requirements.productSize}
                    </span>
                    <span>Banner：选填 1 张 · {requirements.bannerSize}</span>
                    <span>
                      视频：
                      {requirements.videos
                        ? `已内置 ${requirements.videos} 段 · 可用 2560 × 1440 替换首页背景`
                        : '默认 0 段；可自行添加全屏背景'}
                    </span>
                    <small>选中模板查看完整清单；产品图会自动复用。</small>
                  </div>
                )}

                <ul className="template-feature-list">
                  {tmpl.features.map((feat) => (
                    <li key={feat}>
                      <Icon name="check" size={13} /> {feat}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="template-card-footer"
                style={{ marginTop: 'auto', display: 'flex', gap: 10 }}
              >
                <Button
                  kind="quiet"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPreview(tmpl);
                  }}
                  aria-label={`预览 ${tmpl.name}`}
                >
                  <Icon name="eye" size={16} /> 预览模版
                </Button>
                <button
                  type="button"
                  className={`select-tmpl-btn ${isSelected ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateDraft({
                      buildBranch: 'template',
                      template: tmpl.id,
                      brandColor: tmpl.accentColor,
                    });
                  }}
                >
                  {isSelected ? '✓ 当前已选用' : '选用此模版'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 品牌主色调选择 */}
      <div className="brand-color-section panel" style={{ marginTop: '32px' }}>
        <div className="panel-title">
          <span className="section-index">★</span>
          <h3>品牌主色调 (Brand Color)</h3>
          <span>应用于网站导航高亮、按钮、视觉线条与联系卡片</span>
        </div>

        <div className="brand-color-controls">
          <div className="color-preset-pills">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`color-pill ${currentColor === c.value ? 'selected' : ''}`}
                onClick={() => onUpdateDraft({ brandColor: c.value })}
              >
                <span className="color-circle" style={{ backgroundColor: c.value }} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          <div className="custom-color-picker">
            <span>自定义取色：</span>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onUpdateDraft({ brandColor: e.target.value })}
              title="选择自定义主色调"
            />
            <code className="color-code">{currentColor.toUpperCase()}</code>
          </div>
        </div>
      </div>

      {/* 底部导航与操作栏 */}
      <div className="template-action-bar">
        <Button kind="quiet" onClick={onBackToBasics}>
          <Icon name="back" />
          返回修改资料与产品
        </Button>

        <div className="action-bar-right">
          <Button
            kind="primary"
            onClick={() => {
              onUpdateDraft({ templateConfirmed: true });
              onProceedToPublish();
            }}
          >
            生成并进入预览发布 (第 3 步)
            <Icon name="arrow" />
          </Button>
        </div>
      </div>
    </div>
  );
}
