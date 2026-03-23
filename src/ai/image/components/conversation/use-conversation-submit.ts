'use client';

import {
  type ProjectMessageItem,
  addAssistantMessage,
  addUserMessage,
  updateAssistantMessage,
} from '@/actions/project-message';
import { generateImage } from '@/ai/image/lib/api-utils';
import { logger } from '@/lib/logger';
import { useConversationStore } from '@/stores/conversation-store';
import { useCallback } from 'react';

export interface MessageUpdateData {
  outputImage?: string;
  creditsUsed?: number;
  generationTime?: number;
  status: 'completed' | 'failed';
  content?: string;
  errorMessage?: string;
}

interface GenerationStateDependencies {
  setAbortController: (controller: AbortController | null) => void;
  setGenerationStage: (
    stage: 'submitting' | 'queued' | 'generating' | 'finishing' | null
  ) => void;
}

interface ConversationMessageLike {
  role: 'user' | 'model';
  content: string;
  image?: string;
}

type ConversationTranslationKey =
  | 'loading.cancelled'
  | 'errors.generationFailed'
  | 'errors.unexpected'
  | 'errors.unknown';

interface UseConversationSubmitParams {
  t: (key: ConversationTranslationKey) => string;
  currentProjectId: string | null;
  draftPrompt: string;
  referenceImages: string[];
  aspectRatio: string;
  selectedModel: string;
  imageQuality: '1K' | '2K' | '4K';
  isGenerating: boolean;
  clearDraft: () => void;
  setReferenceImages: (images: string[]) => void;
  setShowImageUpload: (visible: boolean) => void;
  addMessage: (message: ProjectMessageItem) => void;
  updateMessage: (messageId: string, data: MessageUpdateData) => void;
  setGenerating: (isGenerating: boolean, generatingMessageId?: string) => void;
  getLastOutputImage: () => string | null;
  getConversationHistory: () => ConversationMessageLike[];
  setAbortController: (controller: AbortController | null) => void;
  setGenerationStage: (
    stage: 'submitting' | 'queued' | 'generating' | 'finishing' | null
  ) => void;
  onError?: (error: { title: string; description: string }) => void;
}

function getInputImages(
  referenceImages: string[],
  getLastOutputImage: () => string | null
): string[] {
  if (referenceImages.length > 0) {
    return referenceImages;
  }

  return [getLastOutputImage()].filter(Boolean) as string[];
}

function resetPendingGeneration(
  controller: AbortController,
  dependencies: GenerationStateDependencies
): void {
  const state = useConversationStore.getState();

  if (state.abortController === controller) {
    dependencies.setAbortController(null);
    dependencies.setGenerationStage(null);
  }
}

function clearFinishedGeneration(
  controller: AbortController,
  generatingMessageId: string | null,
  dependencies: GenerationStateDependencies & {
    setGenerating: (
      isGenerating: boolean,
      generatingMessageId?: string
    ) => void;
  }
): void {
  const state = useConversationStore.getState();

  if (state.abortController === controller) {
    dependencies.setAbortController(null);
  }

  if (
    !generatingMessageId ||
    state.generatingMessageId === generatingMessageId
  ) {
    dependencies.setGenerating(false);
    dependencies.setGenerationStage(null);
  }
}

function getFailureState(
  error: unknown,
  t: (key: ConversationTranslationKey) => string
): Pick<MessageUpdateData, 'content' | 'errorMessage'> {
  const isCancelled = error instanceof Error && error.name === 'AbortError';

  return {
    content: isCancelled ? t('loading.cancelled') : t('errors.unexpected'),
    errorMessage: isCancelled
      ? 'Generation cancelled'
      : error instanceof Error
        ? error.message
        : t('errors.unknown'),
  };
}

function isGenerationCancelled(error?: string): boolean {
  return error === 'Generation cancelled' || error === '生成已取消';
}

export function useConversationSubmit({
  t,
  currentProjectId,
  draftPrompt,
  referenceImages,
  aspectRatio,
  selectedModel,
  imageQuality,
  isGenerating,
  clearDraft,
  setReferenceImages,
  setShowImageUpload,
  addMessage,
  updateMessage,
  setGenerating,
  getLastOutputImage,
  getConversationHistory,
  setAbortController,
  setGenerationStage,
  onError,
}: UseConversationSubmitParams): () => Promise<void> {
  const updateMessageState = useCallback(
    async (messageId: string, data: MessageUpdateData): Promise<void> => {
      const updateResult = await updateAssistantMessage(messageId, data);

      // Keep the UI responsive even if persisting the final state fails.
      updateMessage(messageId, data);

      if (!updateResult.success) {
        logger.ai.error('Failed to persist assistant message update', {
          messageId,
          error: updateResult.error,
          status: data.status,
        });

        onError?.({
          title:
            data.status === 'completed' ? '保存结果失败' : '更新生成状态失败',
          description:
            updateResult.error ||
            (data.status === 'completed'
              ? '图片已生成，但保存失败，请重试'
              : '生成状态更新失败，请重试'),
        });
      }
    },
    [onError, updateMessage]
  );

  return useCallback(async () => {
    if (!draftPrompt.trim() || isGenerating || !currentProjectId) {
      return;
    }

    const prompt = draftPrompt.trim();
    const inputImages = getInputImages(referenceImages, getLastOutputImage);

    clearDraft();
    setReferenceImages([]);
    setShowImageUpload(false);

    const controller = new AbortController();
    setAbortController(controller);
    setGenerationStage('submitting');
    let generatingMessageId: string | null = null;

    const userResult = await addUserMessage(currentProjectId, {
      content: prompt,
      inputImage: inputImages[0] || undefined,
    });

    if (!userResult.success || !userResult.data) {
      logger.ai.error('Failed to add user message', {
        projectId: currentProjectId,
        error: userResult.error,
      });
      onError?.({
        title: '发送失败',
        description: userResult.error || '添加用户消息失败，请重试',
      });
      resetPendingGeneration(controller, {
        setAbortController,
        setGenerationStage,
      });
      return;
    }

    addMessage(userResult.data);

    const generatingResult = await addAssistantMessage(currentProjectId, {
      content: '',
      status: 'generating',
      generationParams: {
        prompt,
        aspectRatio,
        model: selectedModel,
        imageQuality,
      },
    });

    if (!generatingResult.success || !generatingResult.data) {
      logger.ai.error('Failed to create generating message', {
        projectId: currentProjectId,
        error: generatingResult.error,
      });
      onError?.({
        title: '生成失败',
        description: generatingResult.error || '创建生成任务失败，请重试',
      });
      resetPendingGeneration(controller, {
        setAbortController,
        setGenerationStage,
      });
      return;
    }

    const generatingMessage = generatingResult.data;
    generatingMessageId = generatingMessage.id;
    addMessage(generatingMessage);
    setGenerating(true, generatingMessage.id);
    setGenerationStage('queued');
    const startTime = Date.now();

    try {
      const conversationHistory = getConversationHistory();
      setGenerationStage('generating');

      const result = await generateImage({
        prompt,
        referenceImages: inputImages.length > 0 ? inputImages : undefined,
        aspectRatio,
        model: selectedModel,
        imageSize: imageQuality,
        signal: controller.signal,
        conversationHistory:
          conversationHistory.length > 0 ? conversationHistory : undefined,
      });

      const generationTime = Date.now() - startTime;

      if (isGenerationCancelled(result.error)) {
        await updateMessageState(generatingMessage.id, {
          content: t('loading.cancelled'),
          status: 'failed',
          errorMessage: 'Generation cancelled',
        });
        return;
      }

      setGenerationStage('finishing');

      if (result.success && result.image) {
        await updateMessageState(generatingMessage.id, {
          outputImage: result.image,
          creditsUsed: result.creditsUsed || 1,
          generationTime,
          status: 'completed',
        });
        return;
      }

      const errorContent = result.error || t('errors.generationFailed');
      await updateMessageState(generatingMessage.id, {
        content: errorContent,
        status: 'failed',
        errorMessage: result.error,
      });
    } catch (error) {
      logger.ai.error('Generation error:', error);
      const failureState = getFailureState(error, t);

      await updateMessageState(generatingMessage.id, {
        content: failureState.content,
        status: 'failed',
        errorMessage: failureState.errorMessage,
      });
    } finally {
      clearFinishedGeneration(controller, generatingMessageId, {
        setAbortController,
        setGenerating,
        setGenerationStage,
      });
    }
  }, [
    addMessage,
    aspectRatio,
    clearDraft,
    currentProjectId,
    draftPrompt,
    getConversationHistory,
    getLastOutputImage,
    imageQuality,
    isGenerating,
    referenceImages,
    selectedModel,
    setAbortController,
    setGenerating,
    setGenerationStage,
    setReferenceImages,
    setShowImageUpload,
    t,
    onError,
    updateMessageState,
  ]);
}
