import { logger } from '@/lib/logger';
import { useCallback, useState } from 'react';
import type { GenerateImageResponse } from '../lib/api-types';
import type {
  ConversationMessage,
  EditHistoryItem,
  ImageError,
  ImageMode,
  ImageResult,
  ProviderTiming,
} from '../lib/image-types';
import {
  DEFAULT_MODEL,
  type GeminiModelId,
  type ProviderKey,
} from '../lib/provider-config';

// Credits 错误类型
type CreditErrorType = 'unauthorized' | 'insufficient_credits' | 'other';

interface UseImageGenerationReturn {
  // 生成结果
  image: ImageResult | null;
  error: ImageError | null;
  timing: ProviderTiming | null;
  isLoading: boolean;
  activePrompt: string;

  // 模式和模型
  mode: ImageMode;
  selectedModel: GeminiModelId;

  // 编辑相关
  referenceImage: string | null;
  conversationHistory: ConversationMessage[];
  editHistory: EditHistoryItem[];

  // Credits 相关
  lastCreditsUsed: number | null;
  creditErrorType: CreditErrorType | null;

  // 操作方法
  setMode: (mode: ImageMode) => void;
  setSelectedModel: (model: GeminiModelId) => void;
  setReferenceImage: (image: string | null) => void;
  generateImage: (prompt: string) => Promise<void>;
  editImage: (prompt: string) => Promise<void>;
  resetState: () => void;
  clearEditHistory: () => void;
  selectHistoryItem: (item: EditHistoryItem) => void;
}

// 生成唯一 ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// 对话历史最大长度限制（防止内存溢出）
const MAX_CONVERSATION_HISTORY = 10;

export function useImageGeneration(): UseImageGenerationReturn {
  // 基础状态
  const [image, setImage] = useState<ImageResult | null>(null);
  const [error, setError] = useState<ImageError | null>(null);
  const [timing, setTiming] = useState<ProviderTiming | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState('');

  // 模式和模型
  const [mode, setMode] = useState<ImageMode>('generate');
  const [selectedModel, setSelectedModel] =
    useState<GeminiModelId>(DEFAULT_MODEL);

  // 编辑相关
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);

  // Credits 相关
  const [lastCreditsUsed, setLastCreditsUsed] = useState<number | null>(null);
  const [creditErrorType, setCreditErrorType] =
    useState<CreditErrorType | null>(null);

  // 重置状态
  const resetState = useCallback(() => {
    setImage(null);
    setError(null);
    setTiming(null);
    setIsLoading(false);
    setActivePrompt('');
    setConversationHistory([]);
    setLastCreditsUsed(null);
    setCreditErrorType(null);
  }, []);

  // 清除编辑历史
  const clearEditHistory = useCallback(() => {
    setEditHistory([]);
  }, []);

  // 选择历史记录项
  const selectHistoryItem = useCallback((item: EditHistoryItem) => {
    setReferenceImage(item.afterImage);
    setImage({
      provider: 'gemini',
      image: item.afterImage,
    });
  }, []);

  // 生成图像（文本到图像）
  const generateImage = useCallback(
    async (prompt: string) => {
      setActivePrompt(prompt);
      setError(null);
      setCreditErrorType(null);
      setLastCreditsUsed(null);
      setIsLoading(true);

      const startTime = Date.now();
      setTiming({ startTime });

      try {
        const response = await fetch('/api/generate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            provider: 'gemini',
            modelId: selectedModel,
            referenceImage: mode === 'edit' ? referenceImage : undefined,
          }),
        });

        const data = (await response.json()) as GenerateImageResponse & {
          creditsUsed?: number;
        };

        // 处理特定的错误状态码
        if (response.status === 401) {
          setCreditErrorType('unauthorized');
          throw new Error(data.error || 'Please sign in to generate images');
        }

        if (response.status === 402) {
          setCreditErrorType('insufficient_credits');
          throw new Error(
            data.error ||
              'Insufficient credits. Please purchase more credits to continue.'
          );
        }

        if (!response.ok) {
          setCreditErrorType('other');
          throw new Error(data.error || `Server error: ${response.status}`);
        }

        const completionTime = Date.now();
        const elapsed = completionTime - startTime;

        setTiming({
          startTime,
          completionTime,
          elapsed,
        });

        if (data.image) {
          // 记录消耗的 credits
          if (data.creditsUsed) {
            setLastCreditsUsed(data.creditsUsed);
          }

          setImage({
            provider: 'gemini',
            image: data.image,
            modelId: selectedModel,
            text: data.text,
          });

          // 如果是编辑模式，添加到编辑历史
          if (mode === 'edit' && referenceImage) {
            setEditHistory((prev) => [
              {
                id: generateId(),
                prompt,
                beforeImage: referenceImage,
                afterImage: data.image!,
                timestamp: Date.now(),
              },
              ...prev,
            ]);
            // 更新参考图像为新生成的图像
            setReferenceImage(data.image);
          }
        } else {
          throw new Error('No image in response');
        }
      } catch (err) {
        logger.ai.error('Image generation error:', err);
        setError({
          provider: 'gemini',
          message:
            err instanceof Error ? err.message : 'An unexpected error occurred',
        });
        setImage(null);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedModel, mode, referenceImage]
  );

  // 编辑图像（对话式编辑）
  const editImage = useCallback(
    async (prompt: string) => {
      if (!referenceImage) {
        setError({
          provider: 'gemini',
          message: 'Please upload an image first',
        });
        return;
      }

      setActivePrompt(prompt);
      setError(null);
      setCreditErrorType(null);
      setLastCreditsUsed(null);
      setIsLoading(true);

      const startTime = Date.now();
      setTiming({ startTime });

      // 添加用户消息到对话历史
      const userMessage: ConversationMessage = {
        id: generateId(),
        role: 'user',
        content: prompt,
        image: conversationHistory.length === 0 ? referenceImage : undefined,
        timestamp: Date.now(),
      };

      const newHistory = [...conversationHistory, userMessage].slice(
        -MAX_CONVERSATION_HISTORY
      );
      setConversationHistory(newHistory);

      try {
        const response = await fetch('/api/edit-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newHistory.map((msg) => ({
              role: msg.role,
              content: msg.content,
              image: msg.image,
            })),
            modelId: selectedModel,
          }),
        });

        const data = (await response.json()) as GenerateImageResponse & {
          creditsUsed?: number;
        };

        // 处理特定的错误状态码
        if (response.status === 401) {
          setCreditErrorType('unauthorized');
          throw new Error(data.error || 'Please sign in to edit images');
        }

        if (response.status === 402) {
          setCreditErrorType('insufficient_credits');
          throw new Error(
            data.error ||
              'Insufficient credits. Please purchase more credits to continue.'
          );
        }

        if (!response.ok) {
          setCreditErrorType('other');
          throw new Error(data.error || `Server error: ${response.status}`);
        }

        const completionTime = Date.now();
        const elapsed = completionTime - startTime;

        setTiming({
          startTime,
          completionTime,
          elapsed,
        });

        if (data.image) {
          // 记录消耗的 credits
          if (data.creditsUsed) {
            setLastCreditsUsed(data.creditsUsed);
          }

          // 添加模型响应到对话历史
          const modelMessage: ConversationMessage = {
            id: generateId(),
            role: 'model',
            content: data.text || 'Image edited successfully',
            image: data.image,
            timestamp: Date.now(),
          };
          setConversationHistory((prev) => [...prev, modelMessage]);

          setImage({
            provider: 'gemini',
            image: data.image,
            modelId: selectedModel,
            text: data.text,
          });

          // 添加到编辑历史
          setEditHistory((prev) => [
            {
              id: generateId(),
              prompt,
              beforeImage: referenceImage,
              afterImage: data.image!,
              timestamp: Date.now(),
            },
            ...prev,
          ]);

          // 更新参考图像
          setReferenceImage(data.image);
        } else {
          throw new Error('No image in response');
        }
      } catch (err) {
        logger.ai.error('Image edit error:', err);
        setError({
          provider: 'gemini',
          message:
            err instanceof Error ? err.message : 'An unexpected error occurred',
        });
        // 移除失败的用户消息
        setConversationHistory(conversationHistory);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedModel, referenceImage, conversationHistory]
  );

  return {
    // 生成结果
    image,
    error,
    timing,
    isLoading,
    activePrompt,

    // 模式和模型
    mode,
    selectedModel,

    // 编辑相关
    referenceImage,
    conversationHistory,
    editHistory,

    // Credits 相关
    lastCreditsUsed,
    creditErrorType,

    // 操作方法
    setMode,
    setSelectedModel,
    setReferenceImage,
    generateImage,
    editImage,
    resetState,
    clearEditHistory,
    selectHistoryItem,
  };
}
