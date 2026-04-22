// Architectural template definitions (35 templates)
// 建筑模版定义（35 个模版）

import type { ArchTemplate } from './arch-types';

// All architectural templates organized by category
// 按分类组织的所有建筑模版
export const ARCH_TEMPLATES: ArchTemplate[] = [
  // ============================================
  // Render Style Transfer (渲染风格迁移) - 3 templates
  // ============================================
  {
    id: 'style-transfer-modern',
    categoryId: 'render-style',
    titleKey: 'ArchPage.templates.styleTransferModern.title',
    descriptionKey: 'ArchPage.templates.styleTransferModern.description',
    promptTemplate:
      '将这张建筑图像转换为现代极简风格。应用简洁的几何线条、白色和中性色调色板、大面积玻璃幕墙、极少装饰，同时保持原始建筑形体和比例不变。',
    previewImage: '/arch/templates/style-transfer-modern-output.png',
    inputImage: '/arch/templates/style-transfer-modern-input.png',
    defaultStyle: 'modern-minimalist',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['style', 'transfer', 'modern', 'minimalist'],
    featured: true,
    order: 1,
  },
  {
    id: 'style-transfer-traditional',
    categoryId: 'render-style',
    titleKey: 'ArchPage.templates.styleTransferTraditional.title',
    descriptionKey: 'ArchPage.templates.styleTransferTraditional.description',
    promptTemplate:
      '将这张建筑图像转换为新中式风格。应用传统中国元素如坡屋顶、庭院美学、木材和石材等材质，同时保持当代设计的诠释方式。',
    previewImage: '/arch/templates/style-transfer-traditional-output.png',
    inputImage: '/arch/templates/style-transfer-traditional-input.png',
    defaultStyle: 'new-chinese',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['style', 'transfer', 'traditional', 'chinese'],
    featured: true,
    order: 2,
  },
  {
    id: 'style-transfer-artistic',
    categoryId: 'render-style',
    titleKey: 'ArchPage.templates.styleTransferArtistic.title',
    descriptionKey: 'ArchPage.templates.styleTransferArtistic.description',
    promptTemplate:
      '将这张建筑图像转换为艺术水彩渲染风格。应用手绘水彩美学，包含柔和扩散的边缘、透明色彩渲染、可见的笔触纹理以及具有艺术气息的大气透视效果。',
    previewImage: '/arch/templates/style-transfer-artistic-output.png',
    inputImage: '/arch/templates/style-transfer-artistic-input.png',
    defaultStyle: 'watercolor',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['style', 'transfer', 'artistic', 'watercolor'],
    order: 3,
  },

  // ============================================
  // Model to Render (模型转效果图) - 3 templates
  // ============================================
  {
    id: 'white-model-render',
    categoryId: 'model-to-render',
    titleKey: 'ArchPage.templates.whiteModelRender.title',
    descriptionKey: 'ArchPage.templates.whiteModelRender.description',
    promptTemplate:
      '将这个白色建筑体量模型转换为照片级真实感渲染图。将白色体块解读为真实建筑，添加玻璃幕墙、合适的材质、窗户布置和建筑细部。加入真实的天空、地面、景观绿化和环境氛围。',
    previewImage: '/arch/templates/white-model-render-output.png',
    inputImage: '/arch/templates/white-model-render-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['model', 'render', 'photorealistic', 'massing'],
    featured: true,
    order: 4,
  },
  {
    id: 'block-model-render',
    categoryId: 'model-to-render',
    titleKey: 'ArchPage.templates.blockModelRender.title',
    descriptionKey: 'ArchPage.templates.blockModelRender.description',
    promptTemplate:
      '将这个方块/体量模型转换为详细的建筑渲染图。保持体量和形体，但添加真实的立面处理、材质、窗户、阳台和屋顶细部。加入城市环境和大气光照效果。',
    previewImage: '/arch/templates/block-model-render-output.png',
    inputImage: '/arch/templates/block-model-render-input-1.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['model', 'block', 'render', 'volumetric'],
    order: 5,
  },
  {
    id: 'rhino-to-render',
    categoryId: 'model-to-render',
    titleKey: 'ArchPage.templates.rhinoToRender.title',
    descriptionKey: 'ArchPage.templates.rhinoToRender.description',
    promptTemplate:
      '将这个 Rhino/SketchUp 3D 模型截图转换为照片级真实感建筑可视化图像。保持精确的几何形体，同时应用真实材质、灯光、景观绿化和环境氛围。保留模型中的所有设计意图。',
    previewImage: '/arch/templates/rhino-to-render-output.png',
    inputImage: '/arch/templates/rhino-to-render-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['model', 'rhino', 'sketchup', 'render'],
    featured: true,
    order: 6,
  },

  // ============================================
  // Sketch to Render (草图转效果图) - 2 templates
  // ============================================
  {
    id: 'sketch-to-render',
    categoryId: 'sketch-to-render',
    titleKey: 'ArchPage.templates.sketchToRender.title',
    descriptionKey: 'ArchPage.templates.sketchToRender.description',
    promptTemplate:
      '将这张建筑草图或手绘图转换为照片级真实感可视化图像。忠实地解读草图中的线条和形体，同时添加真实的材质、合适的灯光、景观绿化和环境氛围。保持草图中的设计意图。',
    previewImage: '/arch/templates/sketch-to-render-output.png',
    inputImage: '/arch/templates/sketch-to-render-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['sketch', 'render', 'hand-drawn', 'concept'],
    featured: true,
    order: 7,
  },
  {
    id: 'diagram-to-render',
    categoryId: 'sketch-to-render',
    titleKey: 'ArchPage.templates.diagramToRender.title',
    descriptionKey: 'ArchPage.templates.diagramToRender.description',
    promptTemplate:
      '将这张建筑分析图或概念草图转换为详细的渲染图。将图解元素解读为真实的建筑构件，应用合适的材质、尺度和环境氛围，同时尊重概念设计的意图。',
    previewImage: '/arch/templates/diagram-to-render-output.png',
    inputImage: '/arch/templates/diagram-to-render-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['diagram', 'render', 'concept', 'visualization'],
    order: 8,
  },

  // ============================================
  // Master Plan (总平与规划) - 3 templates
  // ============================================
  {
    id: 'masterplan-aerial',
    categoryId: 'masterplan',
    titleKey: 'ArchPage.templates.masterplanAerial.title',
    descriptionKey: 'ArchPage.templates.masterplanAerial.description',
    promptTemplate:
      '根据这张总平面图或场地规划，生成鸟瞰可视化效果图。以三维形式展示建筑并呈现详细的屋顶，添加多种树木植被的景观绿化、道路和步行路径、水景等。使用温暖的黄金时段大气光照。达到专业建筑可视化品质。',
    previewImage: '/arch/templates/masterplan-aerial-output.png',
    inputImage: '/arch/templates/masterplan-aerial-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['masterplan', 'aerial', 'urban', 'birdseye'],
    featured: true,
    order: 9,
  },
  {
    id: 'satellite-to-render',
    categoryId: 'masterplan',
    titleKey: 'ArchPage.templates.satelliteToRender.title',
    descriptionKey: 'ArchPage.templates.satelliteToRender.description',
    promptTemplate:
      '将这张卫星/航拍图像转换为规划设计可视化效果。在现有环境中叠加新的建筑设计方案，展示与周边城市肌理的融合、新的景观绿化以及改善后的公共空间。',
    previewImage: '/arch/templates/satellite-to-render-output.png',
    inputImage: '/arch/templates/satellite-to-render-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['satellite', 'aerial', 'urban', 'development'],
    order: 10,
  },
  {
    id: 'site-analysis-texture',
    categoryId: 'masterplan',
    titleKey: 'ArchPage.templates.siteAnalysisTexture.title',
    descriptionKey: 'ArchPage.templates.siteAnalysisTexture.description',
    promptTemplate:
      '根据这个场地生成城市肌理分析图。用简洁清晰的图形语言展示建筑轮廓、街道肌理、开放空间和绿地。突出密度变化和空间层级关系。',
    previewImage: '/arch/templates/site-analysis-texture-output.png',
    inputImage: '/arch/templates/site-analysis-texture-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['site', 'analysis', 'texture', 'urban'],
    order: 11,
  },

  // ============================================
  // Facade Design (立面设计) - 3 templates
  // ============================================
  {
    id: 'facade-generate',
    categoryId: 'facade',
    titleKey: 'ArchPage.templates.facadeGenerate.title',
    descriptionKey: 'ArchPage.templates.facadeGenerate.description',
    promptTemplate:
      '生成一个当代建筑的立面设计方案。展示详细的立面图，包含窗户排列样式、材质表达、入口设计和建筑细部。加入微妙的环境氛围，如天空渐变和地面线条。',
    previewImage: '/arch/templates/facade-generate-output.png',
    defaultStyle: 'modern-minimalist',
    defaultAspectRatio: 'auto',
    requiresInput: false,
    tags: ['facade', 'elevation', 'design', 'generate'],
    featured: true,
    order: 12,
  },
  {
    id: 'material-replace',
    categoryId: 'facade',
    titleKey: 'ArchPage.templates.materialReplace.title',
    descriptionKey: 'ArchPage.templates.materialReplace.description',
    promptTemplate:
      '替换这栋建筑的立面材质，同时保持原始形体、窗户位置和比例不变。应用新的材质处理，包括幕墙系统、玻璃样式和表面饰面。保持建筑的整体特征。',
    previewImage: '/arch/templates/material-replace-output.jpg',
    inputImage: '/arch/templates/material-replace-input-1.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['material', 'facade', 'replace', 'renovation'],
    order: 13,
  },
  {
    id: 'facade-renovation',
    categoryId: 'facade',
    titleKey: 'ArchPage.templates.facadeRenovation.title',
    descriptionKey: 'ArchPage.templates.facadeRenovation.description',
    promptTemplate:
      '对这栋建筑的立面进行当代化改造设计。在尊重原始结构的前提下更新外观，添加现代元素如新的玻璃幕墙系统、遮阳构件、绿化元素和改善后的入口设计。',
    previewImage: '/arch/templates/facade-renovation-output.png',
    inputImage: '/arch/templates/facade-renovation-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['facade', 'renovation', 'update', 'contemporary'],
    order: 14,
  },

  // ============================================
  // Section Diagrams (剖面图) - 2 templates
  // ============================================
  {
    id: 'section-diagram',
    categoryId: 'section',
    titleKey: 'ArchPage.templates.sectionDiagram.title',
    descriptionKey: 'ArchPage.templates.sectionDiagram.description',
    promptTemplate:
      '创建一张详细的建筑剖面图。展示切面处的材质填充图案、室内空间及家具示意、清晰可见的结构构件、用于比例参考的人物剪影以及外部环境。达到专业技术图纸品质。',
    previewImage: '/arch/templates/section-diagram-output.png',
    inputImage: '/arch/templates/section-diagram-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['section', 'diagram', 'technical', 'building'],
    order: 15,
  },
  {
    id: 'section-perspective',
    categoryId: 'section',
    titleKey: 'ArchPage.templates.sectionPerspective.title',
    descriptionKey: 'ArchPage.templates.sectionPerspective.description',
    promptTemplate:
      '生成一张剖透视图，同时展示切面和透视视角下的室内空间。揭示室内空间组织、垂直交通、挑空空间和空间关系。包含真实的材质、灯光和人物剪影。',
    previewImage: '/arch/templates/section-perspective-output.png',
    defaultAspectRatio: 'auto',
    requiresInput: false,
    tags: ['section', 'perspective', 'spatial', 'interior'],
    featured: true,
    order: 16,
  },

  // ============================================
  // Analysis Diagrams (分析图) - 4 templates
  // ============================================
  {
    id: 'sasaki-analysis',
    categoryId: 'analysis',
    titleKey: 'ArchPage.templates.sasakiAnalysis.title',
    descriptionKey: 'ArchPage.templates.sasakiAnalysis.description',
    promptTemplate:
      '创建一张 Sasaki 风格的场地分析图。采用简洁、极简的图形风格，使用有限且精致的配色方案、表达不同分析层级的透明叠加、清晰的图标和简单几何形状、区域识别的柔和渐变、精细的线条和专业的图解品质。',
    previewImage: '/arch/templates/sasaki-analysis-output.png',
    defaultAspectRatio: 'auto',
    requiresInput: false,
    tags: ['sasaki', 'analysis', 'diagram', 'site'],
    featured: true,
    order: 17,
  },
  {
    id: 'sunlight-analysis',
    categoryId: 'analysis',
    titleKey: 'ArchPage.templates.sunlightAnalysis.title',
    descriptionKey: 'ArchPage.templates.sunlightAnalysis.description',
    promptTemplate:
      '为这栋建筑或场地生成日照阴影分析图。展示不同时段的阴影投射、日照区域和遮蔽分析。使用从暖色（高日照）到冷色（阴影）的色彩渐变，包含太阳轨迹指示。',
    previewImage: '/arch/templates/sunlight-analysis-output.png',
    inputImage: '/arch/templates/sunlight-analysis-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['sunlight', 'shadow', 'analysis', 'solar'],
    order: 18,
  },
  {
    id: 'circulation-analysis',
    categoryId: 'analysis',
    titleKey: 'ArchPage.templates.circulationAnalysis.title',
    descriptionKey: 'ArchPage.templates.circulationAnalysis.description',
    promptTemplate:
      '创建一张人流动线分析图。用方向箭头展示流动模式，区分主要和次要路径，标识节点和集散空间，并用色彩编码区分不同的使用人群。采用清晰的图解风格。',
    previewImage: '/arch/templates/circulation-analysis-output.png',
    inputImage: '/arch/templates/circulation-analysis-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['circulation', 'flow', 'analysis', 'movement'],
    order: 19,
  },
  {
    id: 'wind-analysis',
    categoryId: 'analysis',
    titleKey: 'ArchPage.templates.windAnalysis.title',
    descriptionKey: 'ArchPage.templates.windAnalysis.description',
    promptTemplate:
      '生成一张风环境分析图，展示主导风向、风廊、避风区域和潜在的风力影响区。使用流线、箭头和色彩渐变表示风力强度，包含指北针方向标注。',
    previewImage: '/arch/templates/wind-analysis-output.png',
    inputImage: '/arch/templates/wind-analysis-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['wind', 'ventilation', 'analysis', 'climate'],
    order: 20,
  },

  // ============================================
  // Floor Plan (平面图) - 2 templates
  // ============================================
  {
    id: 'floorplan-color',
    categoryId: 'floor-plan',
    titleKey: 'ArchPage.templates.floorplanColor.title',
    descriptionKey: 'ArchPage.templates.floorplanColor.description',
    promptTemplate:
      '按空间类型/功能为这张建筑平面图进行色彩编码。客厅/公共区域用暖色调、私密空间用冷色调、服务/设备区域用中性色调、交通空间用浅色强调色。保持线条图清晰，添加微妙的阴影增加层次感，达到专业展示品质。',
    previewImage: '/arch/templates/floorplan-color-output.png',
    inputImage: '/arch/templates/floorplan-color-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['floorplan', 'color', 'diagram', 'residential'],
    featured: true,
    order: 21,
  },
  {
    id: 'masterplan-color',
    categoryId: 'floor-plan',
    titleKey: 'ArchPage.templates.masterplanColor.title',
    descriptionKey: 'ArchPage.templates.masterplanColor.description',
    promptTemplate:
      '为这张场地总平面图添加功能色彩编码。区分建筑用途（住宅、商业、综合体）、开放空间、停车区域、交通流线和市政基础设施，使用统一协调的配色方案，保持图纸可读性。',
    previewImage: '/arch/templates/masterplan-color-output.png',
    inputImage: '/arch/templates/masterplan-color-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['masterplan', 'color', 'zoning', 'urban'],
    order: 22,
  },

  // ============================================
  // Renovation (建筑改造) - 2 templates
  // ============================================
  {
    id: 'renovation-modern',
    categoryId: 'renovation',
    titleKey: 'ArchPage.templates.renovationModern.title',
    descriptionKey: 'ArchPage.templates.renovationModern.description',
    promptTemplate:
      '将这栋既有/老旧建筑转变为现代化设计。保留定义建筑特征的关键原始元素，同时引入当代设计介入。通过恰当的材质选择实现新旧的无缝融合。',
    previewImage: '/arch/templates/renovation-modern-output.png',
    inputImage: '/arch/templates/renovation-modern-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['renovation', 'modern', 'adaptive', 'reuse'],
    featured: true,
    order: 23,
  },
  {
    id: 'renovation-commercial',
    categoryId: 'renovation',
    titleKey: 'ArchPage.templates.renovationCommercial.title',
    descriptionKey: 'ArchPage.templates.renovationCommercial.description',
    promptTemplate:
      '将这栋既有建筑改造为商业/零售空间。添加新的店面、标识区域、户外休息区和改善后的人行界面。在尊重原始结构的同时，营造具有吸引力的商业氛围。',
    previewImage: '/arch/templates/renovation-commercial-output.png',
    inputImage: '/arch/templates/renovation-commercial-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['renovation', 'commercial', 'retail', 'adaptive'],
    order: 24,
  },

  // ============================================
  // Perspective Views (透视视角) - 2 templates
  // ============================================
  {
    id: 'interior-perspective',
    categoryId: 'perspective',
    titleKey: 'ArchPage.templates.interiorPerspective.title',
    descriptionKey: 'ArchPage.templates.interiorPerspective.description',
    promptTemplate:
      '生成一张室内建筑透视图。展示具有正确透视的空间纵深，自然光与人工照明，墙面/地面/天花的材质饰面，家具布局和建筑细部。强调空间氛围、宜居性和人的尺度感。',
    previewImage: '/arch/templates/interior-perspective-output.png',
    defaultStyle: 'modern-minimalist',
    defaultAspectRatio: 'auto',
    requiresInput: false,
    tags: ['interior', 'perspective', 'render', 'space'],
    featured: true,
    order: 25,
  },
  {
    id: 'axonometric-view',
    categoryId: 'perspective',
    titleKey: 'ArchPage.templates.axonometricView.title',
    descriptionKey: 'ArchPage.templates.axonometricView.description',
    promptTemplate:
      '生成建筑的分解轴测图。展示结构层、楼板、围护系统和主要建筑构件的垂直分离，采用纯白背景。达到技术图解品质，保持统一的线条粗细。',
    previewImage: '/arch/templates/axonometric-view-output.png',
    defaultAspectRatio: 'auto',
    requiresInput: false,
    tags: ['axonometric', 'exploded', 'diagram', 'technical'],
    order: 26,
  },

  // ============================================
  // New Templates (新增模版) - 9 templates
  // ============================================
  {
    id: 'multi-reference-render',
    categoryId: 'model-to-render',
    titleKey: 'ArchPage.templates.multiReferenceRender.title',
    descriptionKey: 'ArchPage.templates.multiReferenceRender.description',
    promptTemplate:
      '根据提供的场地红线范围，结合参考图的建筑风格和景观设计，生成住宅社区可视化效果图。在场地内保持合理的建筑布局，营造丰富精致的景观流线，确保合适的容积率。',
    previewImage: '/arch/templates/multi-reference-render-output.png',
    inputImage: '/arch/templates/multi-reference-render-input-1.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['multi-reference', 'composite', 'residential', 'masterplan'],
    featured: true,
    order: 27,
  },
  {
    id: 'aerial-to-street',
    categoryId: 'perspective',
    titleKey: 'ArchPage.templates.aerialToStreet.title',
    descriptionKey: 'ArchPage.templates.aerialToStreet.description',
    promptTemplate:
      '将这张鸟瞰/俯瞰视角图像转换为街道层面的人视透视图。生成聚焦于主入口或关键建筑特征的近景视角，保持建筑设计的同时添加真实的地面层细节、人行空间元素和人视高度的氛围感。',
    previewImage: '/arch/templates/aerial-to-street-output.png',
    inputImage: '/arch/templates/aerial-to-street-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['perspective', 'street', 'entrance', 'human-scale'],
    order: 28,
  },
  {
    id: 'redline-landscape',
    categoryId: 'masterplan',
    titleKey: 'ArchPage.templates.redlineLandscape.title',
    descriptionKey: 'ArchPage.templates.redlineLandscape.description',
    promptTemplate:
      '在红线边界内设计一个口袋公园。包含蜿蜒的步行道、散布的小型构筑物，以及三个景观节点：小型舞台广场、儿童游乐区和露营草坪。营造自然和谐的布局与丰富的景观流线。保持场地轮廓和道路位置不变。',
    previewImage: '/arch/templates/redline-landscape-output.png',
    inputImage: '/arch/templates/redline-landscape-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['landscape', 'park', 'pocket-park', 'redline'],
    order: 29,
  },
  {
    id: 'interior-annotate',
    categoryId: 'floor-plan',
    titleKey: 'ArchPage.templates.interiorAnnotate.title',
    descriptionKey: 'ArchPage.templates.interiorAnnotate.description',
    promptTemplate:
      '根据标注过的平面图生成室内可视化效果图。将红色标注解读为设计要求和布局规格，创建现代极简风格的室内空间并按标注放置家具。应用电影感灯光效果，包含自然光和阴影。最终渲染中去除所有标注痕迹。',
    previewImage: '/arch/templates/interior-annotate-output.jpg',
    inputImage: '/arch/templates/interior-annotate-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['interior', 'annotate', 'kitchen', 'floor-plan'],
    order: 30,
  },
  {
    id: 'building-migration',
    categoryId: 'model-to-render',
    titleKey: 'ArchPage.templates.buildingMigration.title',
    descriptionKey: 'ArchPage.templates.buildingMigration.description',
    promptTemplate:
      '将参考图中的建筑移植到目标场地地形上。使建筑适应坡地或地形变化，同时保持其原始的建筑特征。确保与场地环境和自然景观的恰当融合。',
    previewImage: '/arch/templates/building-migration-output.png',
    inputImage: '/arch/templates/building-migration-input-1.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['migration', 'site', 'terrain', 'composite'],
    order: 31,
  },
  {
    id: 'interior-renovation',
    categoryId: 'renovation',
    titleKey: 'ArchPage.templates.interiorRenovation.title',
    descriptionKey: 'ArchPage.templates.interiorRenovation.description',
    promptTemplate:
      '将这个杂乱或未完工的室内空间转变为精致的客厅设计。去除施工元素和杂物，同时保留原始的空间结构和天花。应用现代轻奢风格，合理布置家具。添加电影感灯光效果，包含自然光和阴影效果。',
    previewImage: '/arch/templates/interior-renovation-output.jpg',
    inputImage: '/arch/templates/interior-renovation-input.jpg',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['interior', 'renovation', 'living-room', 'modern'],
    order: 32,
  },
  {
    id: 'ground-floor-design',
    categoryId: 'renovation',
    titleKey: 'ArchPage.templates.groundFloorDesign.title',
    descriptionKey: 'ArchPage.templates.groundFloorDesign.description',
    promptTemplate:
      '将这个底层或裙房空间改造为功能性配套区域。添加健身设施、阅读休闲区和社交空间，同时保留现有的柱网和天花结构。去除临时隔断，营造具有吸引力的空间氛围，配以合适的灯光和家具。',
    previewImage: '/arch/templates/ground-floor-design-output.png',
    inputImage: '/arch/templates/ground-floor-design-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['ground-floor', 'amenity', 'lobby', 'renovation'],
    order: 33,
  },
  {
    id: 'redline-to-design',
    categoryId: 'masterplan',
    titleKey: 'ArchPage.templates.redlineToDesign.title',
    descriptionKey: 'ArchPage.templates.redlineToDesign.description',
    promptTemplate:
      '根据场地红线和道路结构，重新规划设计该场地并转换为专业的鸟瞰建筑可视化效果图。保持原始场地形状和周边环境。采用 BIG 事务所风格，合理布置建筑，增强绿化和景观设计。最终渲染中去除红线标注。',
    previewImage: '/arch/templates/redline-to-design-output.png',
    inputImage: '/arch/templates/redline-to-design-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['redline', 'masterplan', 'birdseye', 'urban'],
    order: 34,
  },
  {
    id: 'day-to-night',
    categoryId: 'render-style',
    titleKey: 'ArchPage.templates.dayToNight.title',
    descriptionKey: 'ArchPage.templates.dayToNight.description',
    promptTemplate:
      '将这个日间建筑场景转换为夜景效果，保持空间关系不变。添加室内灯光、立面照明和夜间环境氛围。强调室内空间发出的温暖灯光效果，营造戏剧性的照明效果。',
    previewImage: '/arch/templates/day-to-night-output.png',
    inputImage: '/arch/templates/day-to-night-input.png',
    defaultAspectRatio: 'auto',
    requiresInput: true,
    tags: ['night', 'lighting', 'atmosphere', 'style-transfer'],
    order: 35,
  },
];

// Get featured templates
// 获取精选模版
export const FEATURED_TEMPLATES = ARCH_TEMPLATES.filter((t) => t.featured);

// Get templates by category
// 根据分类获取模版
export function getTemplatesByCategory(categoryId: string): ArchTemplate[] {
  if (categoryId === 'all') {
    return [...ARCH_TEMPLATES].sort(
      (a, b) => (a.order ?? 99) - (b.order ?? 99)
    );
  }
  return ARCH_TEMPLATES.filter((t) => t.categoryId === categoryId).sort(
    (a, b) => (a.order ?? 99) - (b.order ?? 99)
  );
}

// Get template by ID
// 根据 ID 获取模版
export function getTemplateById(id: string): ArchTemplate | undefined {
  return ARCH_TEMPLATES.find((t) => t.id === id);
}

// Search templates by query
// 按关键词搜索模版
export function searchTemplates(query: string): ArchTemplate[] {
  const lowerQuery = query.toLowerCase();
  return ARCH_TEMPLATES.filter(
    (t) =>
      t.tags.some((tag) => tag.includes(lowerQuery)) ||
      t.id.includes(lowerQuery)
  );
}
