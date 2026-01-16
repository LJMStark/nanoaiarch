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

// Credit error types for API responses
type CreditErrorType = 'unauthorized' | 'insufficient_credits' | 'other';

interface UseImageGenerationReturn {
  // Generation results
  image: ImageResult | null;
  error: ImageError | null;
  timing: ProviderTiming | null;
  isLoading: boolean;
  activePrompt: string;

  // Mode and model
  mode: ImageMode;
  selectedModel: GeminiModelId;

  // Edit-related state
  referenceImage: string | null;
  conversationHistory: ConversationMessage[];
  editHistory: EditHistoryItem[];

  // Credits-related state
  lastCreditsUsed: number | null;
  creditErrorType: CreditErrorType | null;

  // Actions
  setMode: (mode: ImageMode) => void;
  setSelectedModel: (model: GeminiModelId) => void;
  setReferenceImage: (image: string | null) => void;
  generateImage: (prompt: string) => Promise<void>;
  editImage: (prompt: string) => Promise<void>;
  resetState: () => void;
  clearEditHistory: () => void;
  selectHistoryItem: (item: EditHistoryItem) => void;
}

// Generate unique ID using crypto.randomUUID for better collision resistance
function generateId(): string {
  return crypto.randomUUID();
}

// Maximum conversation history length to prevent memory overflow
const MAX_CONVERSATION_HISTORY = 10;

export function useImageGeneration(): UseImageGenerationReturn {
  // Core state
  const [image, setImage] = useState<ImageResult | null>(null);
  const [error, setError] = useState<ImageError | null>(null);
  const [timing, setTiming] = useState<ProviderTiming | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState('');

  // Concurrency control
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  // Mode and model state
  const [mode, setMode] = useState<ImageMode>('generate');
  const [selectedModel, setSelectedModel] =
    useState<GeminiModelId>(DEFAULT_MODEL);

  // Edit-related state
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);

  // Credits state
  const [lastCreditsUsed, setLastCreditsUsed] = useState<number | null>(null);
  const [creditErrorType, setCreditErrorType] =
    useState<CreditErrorType | null>(null);

  // Reset all state to initial values
  const resetState = useCallback(() => {
    setImage(null);
    setError(null);
    setTiming(null);
    setIsLoading(false);
    setActivePrompt('');
    setConversationHistory([]);
    setLastCreditsUsed(null);
    setCreditErrorType(null);
    setActiveRequestId(null);
  }, []);

  // Clear edit history
  const clearEditHistory = useCallback(() => {
    setEditHistory([]);
  }, []);

  // Select a history item and set it as reference
  const selectHistoryItem = useCallback((item: EditHistoryItem) => {
    setReferenceImage(item.afterImage);
    setImage({
      provider: 'duomi',
      image: item.afterImage,
    });
  }, []);

  // Generate image from text prompt
  const generateImage = useCallback(
    async (prompt: string) => {
      // Prevent concurrent requests
      if (activeRequestId) {
        logger.ai.warn(
          '[Image Generation] Request already in progress, ignoring duplicate request'
        );
        return;
      }

      const requestId = generateId();
      setActiveRequestId(requestId);

      setActivePrompt(prompt);
      setError(null);
      setCreditErrorType(null);
      setLastCreditsUsed(null);
      setIsLoading(true);

      const startTime = Date.now();
      setTiming({ startTime });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150 * 1000);

      try {
        const response = await fetch('/api/generate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            provider: 'duomi',
            modelId: selectedModel,
            referenceImage: mode === 'edit' ? referenceImage : undefined,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = (await response.json()) as GenerateImageResponse & {
          creditsUsed?: number;
        };

        // Handle error status codes
        if (response.status === 401) {
          setCreditErrorType('unauthorized');
          throw new Error(data.error || 'Please sign in to generate images');
        }
        if (response.status === 402) {
          setCreditErrorType('insufficient_credits');
          throw new Error(data.error || 'Insufficient credits');
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
          // Record credits used
          if (data.creditsUsed) {
            setLastCreditsUsed(data.creditsUsed);
          }

          setImage({
            provider: 'duomi',
            image: data.image,
            modelId: selectedModel,
            text: data.text,
          });

          // In edit mode, add to edit history
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
            // Update reference image to newly generated image
            setReferenceImage(data.image);
          }
        } else {
          throw new Error('No image in response');
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          setError({
            provider: 'duomi',
            message: 'Request timed out. Please try again.',
          });
        } else {
          logger.ai.error('Image generation error:', err);
          setError({
            provider: 'duomi',
            message:
              err instanceof Error
                ? err.message
                : 'An unexpected error occurred',
          });
        }
        setImage(null);
      } finally {
        setIsLoading(false);
        setActiveRequestId(null);
      }
    },
    [selectedModel, mode, referenceImage, activeRequestId]
  );

  // Edit image using conversational approach
  const editImage = useCallback(
    async (prompt: string) => {
      if (!referenceImage) {
        setError({
          provider: 'duomi',
          message: 'Please upload an image first',
        });
        return;
      }

      // Prevent concurrent requests
      if (activeRequestId) {
        logger.ai.warn(
          '[Image Edit] Request already in progress, ignoring duplicate request'
        );
        return;
      }

      const requestId = generateId();
      setActiveRequestId(requestId);

      setActivePrompt(prompt);
      setError(null);
      setCreditErrorType(null);
      setLastCreditsUsed(null);
      setIsLoading(true);

      const startTime = Date.now();
      setTiming({ startTime });

      // Add user message to conversation history
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150 * 1000);

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
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = (await response.json()) as GenerateImageResponse & {
          creditsUsed?: number;
        };

        // Handle error status codes
        if (response.status === 401) {
          setCreditErrorType('unauthorized');
          throw new Error(data.error || 'Please sign in to edit images');
        }
        if (response.status === 402) {
          setCreditErrorType('insufficient_credits');
          throw new Error(data.error || 'Insufficient credits');
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
          // Record credits used
          if (data.creditsUsed) {
            setLastCreditsUsed(data.creditsUsed);
          }

          // Add model response to conversation history
          const modelMessage: ConversationMessage = {
            id: generateId(),
            role: 'model',
            content: data.text || 'Image edited successfully',
            image: data.image,
            timestamp: Date.now(),
          };
          setConversationHistory((prev) => [...prev, modelMessage]);

          setImage({
            provider: 'duomi',
            image: data.image,
            modelId: selectedModel,
            text: data.text,
          });

          // Add to edit history
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

          // Update reference image
          setReferenceImage(data.image);
        } else {
          throw new Error('No image in response');
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          setError({
            provider: 'duomi',
            message: 'Request timed out. Please try again.',
          });
        } else {
          logger.ai.error('Image edit error:', err);
          setError({
            provider: 'duomi',
            message:
              err instanceof Error
                ? err.message
                : 'An unexpected error occurred',
          });
        }
        // Don't rollback conversation history - keep the user message
        // The error state will be displayed to the user
      } finally {
        setIsLoading(false);
        setActiveRequestId(null);
      }
    },
    [selectedModel, referenceImage, conversationHistory, activeRequestId]
  );

  return {
    // Generation results
    image,
    error,
    timing,
    isLoading,
    activePrompt,

    // Mode and model
    mode,
    selectedModel,

    // Edit-related state
    referenceImage,
    conversationHistory,
    editHistory,

    // Credits state
    lastCreditsUsed,
    creditErrorType,

    // Actions
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
