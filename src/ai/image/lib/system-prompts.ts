// System prompt engineering for architectural visualization
// 建筑可视化系统提示词工程

import type { AspectRatioId, StylePresetId } from './arch-types';
import { getStylePromptSuffix } from './style-presets';

// Base system prompt for all architectural generations
// 所有建筑生成的基础系统提示词
const ARCH_SYSTEM_PROMPT_BASE = `You are an expert architectural visualization AI specializing in photorealistic renders and professional architectural imagery.

Core Requirements:
- Professional architectural photography composition with proper perspective
- 8K resolution quality rendering with fine details
- Accurate architectural proportions, perspective, and human scale
- Realistic lighting conditions, material textures, and environmental context
- Clean, publication-ready output suitable for professional presentations
- Proper depth of field and atmospheric perspective
- Contextual landscaping and entourage when appropriate

Output Guidelines:
- Maintain architectural accuracy and structural feasibility
- Apply realistic material properties and lighting physics
- Include appropriate environmental elements (sky, vegetation, people for scale)
- Ensure consistent style throughout the image
`;

// Build enhanced prompt with system context
// 构建带系统上下文的增强提示词
export function buildArchPrompt(
  userPrompt: string,
  stylePreset?: StylePresetId,
  aspectRatio?: AspectRatioId,
  additionalContext?: string
): string {
  const parts: string[] = [ARCH_SYSTEM_PROMPT_BASE];

  // Add style-specific instructions
  // 添加风格特定指令
  if (stylePreset) {
    const styleInstructions = getStylePromptSuffix(stylePreset);
    parts.push(`\nArchitectural Style:\n${styleInstructions}`);
  }

  // Add aspect ratio context
  // 添加画幅比例上下文
  if (aspectRatio) {
    const ratioContext = getAspectRatioContext(aspectRatio);
    parts.push(`\nImage Composition:\n${ratioContext}`);
  }

  // Add user request
  // 添加用户请求
  parts.push(`\nUser Request:\n${userPrompt}`);

  // Add additional context if provided
  // 添加额外上下文（如有）
  if (additionalContext) {
    parts.push(`\nAdditional Context:\n${additionalContext}`);
  }

  return parts.join('\n');
}

// Get composition context based on aspect ratio
// 根据画幅比例获取构图上下文
function getAspectRatioContext(aspectRatio: AspectRatioId): string {
  const contexts: Record<AspectRatioId, string> = {
    '1:1':
      'Square composition. Centered subject, balanced framing, suitable for social media or detail shots.',
    '16:9':
      'Wide cinematic composition. Panoramic view, emphasize horizontal lines, ideal for exterior perspectives and landscape views.',
    '4:3':
      'Standard composition. Classic framing, versatile for both interior and exterior shots.',
    '3:4':
      'Portrait composition. Vertical emphasis, suitable for tower buildings or interior height shots.',
    '9:16':
      'Vertical mobile composition. Strong vertical lines, ideal for tall structures or vertical section views.',
  };
  return contexts[aspectRatio];
}

// Template-specific prompt builders
// 模版专用提示词构建器

export function buildWhiteModelPrompt(userPrompt: string): string {
  return buildArchPrompt(
    userPrompt,
    'white-model',
    undefined,
    'Convert the architectural massing model into a photorealistic render. Interpret the white volumes as a real building with appropriate materials, windows, and details. Add realistic context including sky, ground plane, and subtle environmental elements.'
  );
}

export function buildSketchToRenderPrompt(userPrompt: string): string {
  return buildArchPrompt(
    userPrompt,
    undefined,
    undefined,
    'Transform this architectural sketch or hand drawing into a photorealistic visualization. Interpret the sketched lines and forms faithfully while adding realistic materials, lighting, and environmental context. Maintain the design intent from the sketch.'
  );
}

export function buildMasterplanPrompt(userPrompt: string): string {
  return buildArchPrompt(
    userPrompt,
    undefined,
    '16:9',
    "Generate a bird's eye aerial visualization from this master plan or site plan. Show buildings in 3D form with rooftops, landscaping with trees and vegetation, roads and pathways, water features if present. Use warm atmospheric lighting suggesting morning or evening golden hour."
  );
}

export function buildSasakiAnalysisPrompt(userPrompt: string): string {
  return `Create a Sasaki-style site analysis diagram with the following characteristics:
- Clean, minimal graphic style with limited color palette
- Transparent overlays showing different analysis layers
- Clear iconography and simple geometric shapes
- Soft gradients for zone identification
- Thin precise linework
- White or light background
- Professional diagrammatic quality

Analysis content: ${userPrompt}`;
}

export function buildSectionDiagramPrompt(userPrompt: string): string {
  return `Create a detailed architectural section diagram showing:
- Clear cut plane with proper hatching for cut materials
- Interior and exterior spaces with appropriate labels
- Human figures for scale
- Material indications through texture/hatching
- Structural elements clearly visible
- Lighting conditions if relevant
- Professional architectural drawing quality

Section requirements: ${userPrompt}`;
}

export function buildFloorplanColorPrompt(userPrompt: string): string {
  return `Color-code this architectural floor plan using a professional color scheme:
- Different colors for different space types/functions
- Living/common areas in warm tones
- Private spaces in cool tones
- Service/utility areas in neutral tones
- Circulation in light accent color
- Maintain linework clarity
- Add subtle shadows for depth
- Professional architectural presentation quality

Floor plan: ${userPrompt}`;
}

export function buildFacadePrompt(userPrompt: string): string {
  return buildArchPrompt(
    userPrompt,
    undefined,
    '16:9',
    'Generate an architectural facade design or elevation. Show the building front with accurate proportions, window placements, material expressions, and architectural details. Include subtle environmental context with sky and ground.'
  );
}

export function buildRenovationPrompt(userPrompt: string): string {
  return buildArchPrompt(
    userPrompt,
    undefined,
    undefined,
    "Transform this existing/old building into a renovated design. Preserve key original architectural elements that define the building's character while introducing contemporary interventions. Balance old and new seamlessly."
  );
}

export function buildInteriorPrompt(userPrompt: string): string {
  return buildArchPrompt(
    userPrompt,
    undefined,
    '16:9',
    'Generate an interior architectural perspective. Show spatial depth, natural and artificial lighting, material finishes, furniture layout, and architectural details. Emphasize atmosphere and livability.'
  );
}
