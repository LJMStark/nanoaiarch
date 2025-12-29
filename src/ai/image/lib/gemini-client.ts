import { logger } from '@/lib/logger';
import { GoogleGenAI } from '@google/genai';
import type { GeminiModelKey } from './api-utils';

// Gemini 模型配置
export const GEMINI_MODELS: Record<GeminiModelKey, string> = {
  // Forma AI - Gemini 2.0 Flash (支持原生图像生成)
  forma: 'gemini-2.0-flash-exp',
  // Gemini 2.0 Flash (备选)
  'gemini-flash': 'gemini-2.0-flash-exp',
};

// 创建 Gemini 客户端实例
const createGeminiClient = () => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }
  return new GoogleGenAI({ apiKey });
};

// 图像生成请求参数
export interface GenerateImageParams {
  prompt: string;
  modelKey?: GeminiModelKey;
  referenceImage?: string; // base64 编码的参考图像（用于编辑）
}

// 图像生成响应
export interface GenerateImageResult {
  success: boolean;
  image?: string; // base64 编码的图像
  text?: string; // 模型返回的文本（如果有）
  error?: string;
}

/**
 * 使用 Gemini 生成图像
 * 支持纯文本生成和基于参考图像的编辑
 */
export async function generateImageWithGemini(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const { prompt, modelKey = 'forma', referenceImage } = params;

  try {
    const client = createGeminiClient();
    const modelId = GEMINI_MODELS[modelKey];

    // 构建内容
    const contents: Array<
      string | { inlineData: { mimeType: string; data: string } }
    > = [];

    // 如果有参考图像，先添加图像
    if (referenceImage) {
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: referenceImage,
        },
      });
    }

    // 添加文本提示
    contents.push(prompt);

    // 使用 generateContent 方法生成图像
    const response = await client.models.generateContent({
      model: modelId,
      contents,
      config: {
        responseModalities: ['Text', 'Image'],
      },
    });

    // 解析响应
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      return {
        success: false,
        error: 'No response from model',
      };
    }

    let resultImage: string | undefined;
    let resultText: string | undefined;

    for (const part of candidate.content.parts) {
      if ('text' in part && part.text) {
        resultText = part.text;
      } else if ('inlineData' in part && part.inlineData?.data) {
        resultImage = part.inlineData.data;
      }
    }

    if (!resultImage) {
      return {
        success: false,
        error: resultText || 'No image generated',
        text: resultText,
      };
    }

    return {
      success: true,
      image: resultImage,
      text: resultText,
    };
  } catch (error) {
    logger.ai.error('Image generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * 对话式图像编辑 - 支持多轮对话上下文
 */
export interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
  image?: string; // base64 编码的图像
}

export interface EditImageWithConversationParams {
  messages: ConversationMessage[];
  modelKey?: GeminiModelKey;
}

/**
 * 使用对话上下文编辑图像
 * 支持多轮对话，保持编辑历史
 */
export async function editImageWithConversation(
  params: EditImageWithConversationParams
): Promise<GenerateImageResult> {
  const { messages, modelKey = 'forma' } = params;

  try {
    const client = createGeminiClient();
    const modelId = GEMINI_MODELS[modelKey];

    // 构建对话历史
    const contents = messages.map((msg) => {
      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      // 如果有图像，先添加
      if (msg.image) {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: msg.image,
          },
        });
      }

      // 添加文本
      parts.push({ text: msg.content });

      return {
        role: msg.role,
        parts,
      };
    });

    // 使用 generateContent 方法
    const response = await client.models.generateContent({
      model: modelId,
      contents,
      config: {
        responseModalities: ['Text', 'Image'],
      },
    });

    // 解析响应
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      return {
        success: false,
        error: 'No response from model',
      };
    }

    let resultImage: string | undefined;
    let resultText: string | undefined;

    for (const part of candidate.content.parts) {
      if ('text' in part && part.text) {
        resultText = part.text;
      } else if ('inlineData' in part && part.inlineData?.data) {
        resultImage = part.inlineData.data;
      }
    }

    if (!resultImage) {
      return {
        success: false,
        error: resultText || 'No image generated',
        text: resultText,
      };
    }

    return {
      success: true,
      image: resultImage,
      text: resultText,
    };
  } catch (error) {
    logger.ai.error('Gemini conversation edit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
