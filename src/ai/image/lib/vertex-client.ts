import { GoogleGenAI } from '@google/genai';

// Vertex AI 项目配置
const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'arch-banana-2';
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

// Imagen 模型配置
export const IMAGEN_MODELS = {
  // Nano Banana Pro - Imagen 4 Fast (高质量快速生成)
  'nano-banana-pro': 'imagen-4.0-fast-generate-001',
} as const;

export type ImagenModelKey = keyof typeof IMAGEN_MODELS;

// 创建 Vertex AI 客户端实例（使用服务账户认证）
const createVertexClient = () => {
  // 检查是否配置了服务账户凭证
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentials) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS_JSON is not set. Please configure the service account credentials.'
    );
  }

  // 解析凭证 JSON
  let parsedCredentials: {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  try {
    parsedCredentials = JSON.parse(credentials);
  } catch {
    throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format');
  }

  // 创建 Vertex AI 客户端
  return new GoogleGenAI({
    vertexai: true,
    project: parsedCredentials.project_id || VERTEX_PROJECT,
    location: VERTEX_LOCATION,
    googleAuthOptions: {
      credentials: {
        client_email: parsedCredentials.client_email,
        private_key: parsedCredentials.private_key,
      },
    },
  });
};

// 图像生成请求参数
export interface GenerateImagenParams {
  prompt: string;
  modelKey?: ImagenModelKey;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  numberOfImages?: number;
}

// 图像生成响应
export interface GenerateImagenResult {
  success: boolean;
  image?: string; // base64 编码的图像
  error?: string;
}

/**
 * 使用 Vertex AI Imagen 生成图像
 */
export async function generateImageWithImagen(
  params: GenerateImagenParams
): Promise<GenerateImagenResult> {
  const {
    prompt,
    modelKey = 'nano-banana-pro',
    aspectRatio = '16:9',
    numberOfImages = 1,
  } = params;

  try {
    const client = createVertexClient();
    const modelId = IMAGEN_MODELS[modelKey];

    console.log(
      `[Imagen] Generating image with model=${modelId}, aspectRatio=${aspectRatio}`
    );

    // 使用 generateImages 方法生成图像
    const response = await client.models.generateImages({
      model: modelId,
      prompt,
      config: {
        numberOfImages,
        aspectRatio,
        // 安全设置
        safetyFilterLevel: 'BLOCK_MEDIUM_AND_ABOVE' as any,
        personGeneration: 'ALLOW_ADULT' as any,
        // 禁用增强提示词（对于复杂 prompt 效果更好）
        enhancePrompt: false,
      },
    });

    // 检查响应
    if (!response.generatedImages || response.generatedImages.length === 0) {
      return {
        success: false,
        error: 'No image generated',
      };
    }

    // 获取生成的图像（取第一张）
    const generatedImage = response.generatedImages[0];

    // 获取 base64 图像数据
    // @ts-expect-error - SDK 类型可能不完整
    const imageData = generatedImage.image?.bytesBase64Encoded;
    if (!imageData) {
      return {
        success: false,
        error: 'No image data in response',
      };
    }

    return {
      success: true,
      image: imageData,
    };
  } catch (error) {
    console.error('[Imagen] Image generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
