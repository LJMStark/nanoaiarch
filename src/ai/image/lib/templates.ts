// Architectural template definitions (20+ templates)
// 建筑模版定义（20+ 个模版）

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
      'Transform this architectural image into modern minimalist style. Apply clean geometric lines, white and neutral color palette, large glass surfaces, minimal ornamentation while maintaining the original building form and proportions.',
    previewImage: '/arch/templates/style-transfer-modern-output.png',
    inputImage: '/arch/templates/style-transfer-modern-input.png',
    defaultStyle: 'modern-minimalist',
    defaultAspectRatio: '16:9',
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
      'Transform this architectural image into new Chinese traditional style. Apply traditional Chinese elements like sloped rooflines, courtyard aesthetics, timber and stone materials, while maintaining contemporary interpretation.',
    previewImage: '/arch/templates/style-transfer-traditional-output.png',
    inputImage: '/arch/templates/style-transfer-traditional-input.png',
    defaultStyle: 'new-chinese',
    defaultAspectRatio: '16:9',
    requiresInput: true,
    tags: ['style', 'transfer', 'traditional', 'chinese'],
    order: 2,
  },
  {
    id: 'style-transfer-artistic',
    categoryId: 'render-style',
    titleKey: 'ArchPage.templates.styleTransferArtistic.title',
    descriptionKey: 'ArchPage.templates.styleTransferArtistic.description',
    promptTemplate:
      'Transform this architectural image into artistic watercolor rendering style. Apply hand-painted watercolor aesthetics with soft diffused edges, transparent color washes, visible brushwork texture, and artistic atmospheric perspective.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultStyle: 'watercolor',
    defaultAspectRatio: '4:3',
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
      'Convert this white architectural massing model into a photorealistic render. Interpret the white volumes as a real building with glass facades, appropriate materials, window placements, and architectural details. Add realistic sky, ground plane, landscaping, and environmental context.',
    previewImage: '/arch/templates/white-model-render-output.png',
    inputImage: '/arch/templates/white-model-render-input.png',
    defaultAspectRatio: '16:9',
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
      'Transform this block/volumetric model into a detailed architectural render. Keep the massing and form but add realistic facade treatments, materials, windows, balconies, and rooftop details. Include urban context and atmospheric lighting.',
    previewImage: '/arch/templates/block-model-render-output.png',
    inputImage: '/arch/templates/block-model-render-input.png',
    defaultAspectRatio: '16:9',
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
      'Convert this Rhino/SketchUp 3D model screenshot into a photorealistic architectural visualization. Maintain exact geometry while applying realistic materials, lighting, landscaping, and environmental atmosphere. Preserve all design intent from the model.',
    previewImage: '/arch/templates/rhino-to-render-output.png',
    inputImage: '/arch/templates/rhino-to-render-input.png',
    defaultAspectRatio: '16:9',
    requiresInput: true,
    tags: ['model', 'rhino', 'sketchup', 'render'],
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
      'Transform this architectural sketch or hand drawing into a photorealistic visualization. Interpret the sketched lines and forms faithfully while adding realistic materials, proper lighting, landscaping and environmental context. Maintain the design intent from the sketch.',
    previewImage: '/arch/templates/sketch-to-render-output.png',
    inputImage: '/arch/templates/sketch-to-render-input.png',
    defaultAspectRatio: '16:9',
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
      'Transform this architectural diagram or concept sketch into a detailed render. Interpret the diagrammatic elements as real building components. Apply appropriate materials, scale, and realistic context while respecting the conceptual intent.',
    previewImage: '/arch/templates/diagram-to-render-output.png',
    inputImage: '/arch/templates/diagram-to-render-input.png',
    defaultAspectRatio: '16:9',
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
      "Generate a bird's eye aerial visualization from this master plan or site plan. Show buildings in 3D form with detailed rooftops, landscaping with various trees and vegetation, roads and pathways, water features if present. Use warm atmospheric lighting suggesting golden hour. Professional architectural visualization quality.",
    previewImage: '/arch/templates/masterplan-aerial-output.png',
    inputImage: '/arch/templates/masterplan-aerial-input.png',
    defaultAspectRatio: '1:1',
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
      'Transform this satellite/aerial image into a proposed development visualization. Overlay the new building design onto the existing context, showing integration with surrounding urban fabric, new landscaping, and improved public spaces.',
    previewImage: '/arch/templates/satellite-to-render-output.png',
    inputImage: '/arch/templates/satellite-to-render-input.png',
    defaultAspectRatio: '1:1',
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
      'Generate an urban texture analysis diagram from this site. Show building footprints, street patterns, open spaces, and green areas using clean graphic representation. Highlight density variations and spatial hierarchies.',
    previewImage: '/arch/templates/site-analysis-texture-output.png',
    inputImage: '/arch/templates/site-analysis-texture-input.png',
    defaultAspectRatio: '1:1',
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
      'Generate an architectural facade design for a contemporary building. Show detailed elevation with window patterns, material expressions, entrance design, and architectural details. Include subtle environmental context with sky gradient and ground line.',
    previewImage: '/arch/templates/placeholder.svg',
    defaultStyle: 'modern-minimalist',
    defaultAspectRatio: '16:9',
    requiresInput: false,
    tags: ['facade', 'elevation', 'design', 'generate'],
    order: 12,
  },
  {
    id: 'material-replace',
    categoryId: 'facade',
    titleKey: 'ArchPage.templates.materialReplace.title',
    descriptionKey: 'ArchPage.templates.materialReplace.description',
    promptTemplate:
      'Replace the facade materials on this building while maintaining the original form, window positions, and proportions. Apply new material treatments including cladding, glazing patterns, and surface finishes. Keep the architectural character intact.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '16:9',
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
      'Renovate this building facade with contemporary interventions. Update the exterior while respecting the original structure. Add modern elements like new glazing systems, sun shading, green elements, and improved entrances.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '16:9',
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
      'Create a detailed architectural building section diagram. Show the cut plane with proper hatching for materials, interior spaces with appropriate furnishing indications, structural elements clearly visible, human figures for scale, and exterior context. Professional technical drawing quality.',
    previewImage: '/arch/templates/section-diagram-output.png',
    inputImage: '/arch/templates/section-diagram-input.png',
    defaultAspectRatio: '16:9',
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
      'Generate a sectional perspective showing both the cut plane and interior spaces in perspective view. Reveal interior organization, vertical circulation, double-height spaces, and spatial relationships. Include realistic materials, lighting, and human figures.',
    previewImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '16:9',
    requiresInput: false,
    tags: ['section', 'perspective', 'spatial', 'interior'],
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
      'Create a Sasaki-style site analysis diagram with clean, minimal graphic style, limited sophisticated color palette, transparent overlays showing different analysis layers, clear iconography and simple geometric shapes, soft gradients for zone identification, thin precise linework, and professional diagrammatic quality.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '1:1',
    requiresInput: true,
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
      'Generate a sunlight and shadow analysis diagram for this building or site. Show shadow patterns at different times of day, solar exposure zones, and shading analysis. Use color gradients from warm (high sun exposure) to cool (shade). Include sun path indicators.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '1:1',
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
      'Create a circulation flow analysis diagram. Show movement patterns with directional arrows, distinguish between primary and secondary routes, indicate nodes and gathering spaces, and use color coding for different user types. Clean diagrammatic style.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '1:1',
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
      'Generate a wind flow analysis diagram showing prevailing wind patterns, wind corridors, sheltered zones, and potential turbulence areas. Use streamlines, arrows, and color gradients to indicate wind intensity. Include compass orientation.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '1:1',
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
      'Color-code this architectural floor plan by space type/function using a professional color scheme. Living/common areas in warm tones, private spaces in cool tones, service/utility areas in neutral tones, circulation in light accent color. Maintain linework clarity, add subtle shadows for depth, professional presentation quality.',
    previewImage: '/arch/templates/floorplan-color-output.png',
    inputImage: '/arch/templates/floorplan-color-input.png',
    defaultAspectRatio: '4:3',
    requiresInput: true,
    tags: ['floorplan', 'color', 'diagram', 'residential'],
    order: 21,
  },
  {
    id: 'masterplan-color',
    categoryId: 'floor-plan',
    titleKey: 'ArchPage.templates.masterplanColor.title',
    descriptionKey: 'ArchPage.templates.masterplanColor.description',
    promptTemplate:
      'Add functional color coding to this site or master plan. Differentiate building uses (residential, commercial, mixed-use), open spaces, parking, circulation, and infrastructure using a coherent color palette. Maintain plan readability.',
    previewImage: '/arch/templates/masterplan-color-output.png',
    inputImage: '/arch/templates/masterplan-color-input.png',
    defaultAspectRatio: '1:1',
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
      'Transform this existing/old building into a modernized design. Preserve key original architectural elements that define the building character while introducing contemporary interventions. Balance old and new seamlessly with respectful material choices.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '16:9',
    requiresInput: true,
    tags: ['renovation', 'modern', 'adaptive', 'reuse'],
    order: 23,
  },
  {
    id: 'renovation-commercial',
    categoryId: 'renovation',
    titleKey: 'ArchPage.templates.renovationCommercial.title',
    descriptionKey: 'ArchPage.templates.renovationCommercial.description',
    promptTemplate:
      'Convert this existing building into a commercial/retail destination. Add new shopfronts, signage zones, outdoor seating areas, and improved pedestrian interface. Create an inviting commercial atmosphere while respecting the original structure.',
    previewImage: '/arch/templates/placeholder.svg',
    inputImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '16:9',
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
      'Generate an interior architectural perspective. Show spatial depth with proper perspective, natural and artificial lighting, material finishes on walls/floors/ceilings, furniture layout, and architectural details. Emphasize atmosphere, livability, and human scale.',
    previewImage: '/arch/templates/placeholder.svg',
    defaultStyle: 'modern-minimalist',
    defaultAspectRatio: '16:9',
    requiresInput: false,
    tags: ['interior', 'perspective', 'render', 'space'],
    order: 25,
  },
  {
    id: 'axonometric-view',
    categoryId: 'perspective',
    titleKey: 'ArchPage.templates.axonometricView.title',
    descriptionKey: 'ArchPage.templates.axonometricView.description',
    promptTemplate:
      'Generate an exploded axonometric view of the building. Show structural layers, floor plates, envelope systems, and major building components separated vertically with clean white background. Technical diagram quality with consistent line weights.',
    previewImage: '/arch/templates/placeholder.svg',
    defaultAspectRatio: '1:1',
    requiresInput: false,
    tags: ['axonometric', 'exploded', 'diagram', 'technical'],
    order: 26,
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
