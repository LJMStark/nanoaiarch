'use client';

import { generateImage } from '@/ai/image/lib/api-utils';
import {
  createPendingGenerationRequest,
  updateAssistantMessageRequest,
} from '@/ai/image/lib/workspace-client';
import type { ProjectMessageItem } from '@/ai/image/lib/workspace-types';
import { logger } from '@/lib/logger';
import { useConversationStore } from '@/stores/conversation-store';
import { useCallback } from 'react';

export interface MessageUpdateData {
  outputImage?: string | null;
  creditsUsed?: number | null;
  generationTime?: number | null;
  status: 'generating' | 'completed' | 'failed';
  content?: string;
  errorMessage?: string | null;
}

interface GenerationStateDependencies {
  setAbortController: (controller: AbortController | null) => void;
  setGenerationRequestToken: (token: string | null) => void;
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
  updateMessage: (messageId: string, data: Partial<ProjectMessageItem>) => void;
  removeMessage: (messageId: string) => void;
  replaceMessageId: (
    oldId: string,
    newId: string,
    updates?: Partial<ProjectMessageItem>
  ) => void;
  setGenerating: (isGenerating: boolean, generatingMessageId?: string) => void;
  getLastOutputImage: () => string | null;
  getConversationHistory: () => ConversationMessageLike[];
  setAbortController: (controller: AbortController | null) => void;
  setGenerationRequestToken: (token: string | null) => void;
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

function clearFinishedGeneration(
  requestToken: string,
  generatingMessageId: string | null,
  dependencies: GenerationStateDependencies & {
    setGenerating: (
      isGenerating: boolean,
      generatingMessageId?: string
    ) => void;
  }
): void {
  const state = useConversationStore.getState();

  if (state.generationRequestToken === requestToken) {
    dependencies.setAbortController(null);
    dependencies.setGenerationRequestToken(null);
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

function isActiveGenerationRequest(
  requestToken: string,
  generatingMessageId: string
): boolean {
  const state = useConversationStore.getState();
  return (
    state.generationRequestToken === requestToken &&
    state.generatingMessageId === generatingMessageId
  );
}

function normalizePersistedAssistantMessage(
  message: PersistedAssistantMessageLike
): Partial<ProjectMessageItem> {
  return {
    content: message.content,
    outputImage: message.outputImage,
    generationParams: message.generationParams,
    creditsUsed: message.creditsUsed,
    generationTime: message.generationTime,
    status: message.status,
    errorMessage: message.errorMessage,
    orderIndex: message.orderIndex,
    createdAt: new Date(message.createdAt),
  };
}

function createTempMessage(
  projectId: string,
  role: 'user' | 'assistant',
  content: string,
  inputImage: string | null
): ProjectMessageItem {
  return {
    id: `temp-${crypto.randomUUID()}`,
    projectId,
    role,
    content,
    inputImage,
    outputImage: null,
    maskImage: null,
    generationParams: null,
    creditsUsed: null,
    generationTime: null,
    status: role === 'assistant' ? 'generating' : 'completed',
    errorMessage: null,
    orderIndex: Date.now(),
    createdAt: new Date().toISOString(),
  };
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
  removeMessage,
  replaceMessageId,
  setGenerating,
  getLastOutputImage,
  getConversationHistory,
  setAbortController,
  setGenerationRequestToken,
  setGenerationStage,
  onError,
}: UseConversationSubmitParams): () => Promise<void> {
  const persistFailureState = useCallback(
    async (messageId: string, data: MessageUpdateData): Promise<void> => {
      const updateResult = await updateAssistantMessageRequest(messageId, data);

      if (updateResult.success && updateResult.data) {
        updateMessage(
          messageId,
          normalizePersistedAssistantMessage({
            ...updateResult.data,
            createdAt:
              updateResult.data.createdAt instanceof Date
                ? updateResult.data.createdAt.toISOString()
                : new Date(updateResult.data.createdAt).toISOString(),
          })
        );
        return;
      }

      updateMessage(messageId, data);

      logger.ai.error('Failed to persist assistant message update', {
        messageId,
        error: updateResult.error,
        status: data.status,
      });

      onError?.({
        title: '更新生成状态失败',
        description: updateResult.error || '生成状态更新失败，请重试',
      });
    },
    [onError, updateMessage]
  );

  return useCallback(async () => {
    if (!draftPrompt.trim() || isGenerating || !currentProjectId) {
      return;
    }

    const prompt = draftPrompt.trim();
    const inputImages = getInputImages(referenceImages, getLastOutputImage);

    // Optimistic: immediately show messages and loading state
    const tempUserMsg = createTempMessage(
      currentProjectId,
      'user',
      prompt,
      inputImages[0] || null
    );
    const tempAssistantMsg = createTempMessage(
      currentProjectId,
      'assistant',
      '',
      null
    );

    addMessage(tempUserMsg);
    addMessage(tempAssistantMsg);

    clearDraft();
    setReferenceImages([]);
    setShowImageUpload(false);

    const controller = new AbortController();
    const requestToken = crypto.randomUUID();

    setAbortController(controller);
    setGenerationRequestToken(requestToken);
    setGenerating(true, tempAssistantMsg.id);
    setGenerationStage('submitting');

    // Bootstrap with server (user already sees loading UI)
    const bootstrapResult = await createPendingGenerationRequest(
      currentProjectId,
      {
        content: prompt,
        inputImage: inputImages[0] || undefined,
        generationParams: {
          prompt,
          aspectRatio,
          model: selectedModel,
          imageQuality,
        },
      }
    );

    if (!bootstrapResult.success || !bootstrapResult.data) {
      // Rollback: remove temp messages
      removeMessage(tempUserMsg.id);
      removeMessage(tempAssistantMsg.id);
      setGenerating(false);
      setGenerationStage(null);
      setAbortController(null);
      setGenerationRequestToken(null);

      logger.ai.error('Failed to create pending generation', {
        projectId: currentProjectId,
        error: bootstrapResult.error,
      });
      onError?.({
        title: '发送失败',
        description: bootstrapResult.error || '创建生成任务失败，请重试',
      });
      return;
    }

    const { userMessage, assistantMessage } = bootstrapResult.data;

    // Replace temp IDs with real server IDs
    replaceMessageId(tempUserMsg.id, userMessage.id, userMessage);
    replaceMessageId(
      tempAssistantMsg.id,
      assistantMessage.id,
      assistantMessage
    );

    const generatingMessageId = assistantMessage.id;
    setGenerationStage('queued');

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
        projectId: currentProjectId,
        assistantMessageId: generatingMessageId,
      });

      if (!isActiveGenerationRequest(requestToken, generatingMessageId)) {
        return;
      }

      if (result.message) {
        setGenerationStage('finishing');
        updateMessage(
          result.message.id,
          normalizePersistedAssistantMessage(result.message)
        );
        return;
      }

      if (isGenerationCancelled(result.error)) {
        await persistFailureState(generatingMessageId, {
          content: t('loading.cancelled'),
          status: 'failed',
          errorMessage: 'Generation cancelled',
        });
        return;
      }

      await persistFailureState(generatingMessageId, {
        content: result.error || t('errors.generationFailed'),
        status: 'failed',
        errorMessage: result.error,
      });
    } catch (error) {
      logger.ai.error('Generation error:', error);

      if (!isActiveGenerationRequest(requestToken, generatingMessageId)) {
        return;
      }

      const failureState = getFailureState(error, t);
      await persistFailureState(generatingMessageId, {
        content: failureState.content,
        status: 'failed',
        errorMessage: failureState.errorMessage,
      });
    } finally {
      clearFinishedGeneration(requestToken, generatingMessageId, {
        setAbortController,
        setGenerationRequestToken,
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
    onError,
    persistFailureState,
    referenceImages,
    removeMessage,
    replaceMessageId,
    selectedModel,
    setAbortController,
    setGenerationRequestToken,
    setGenerating,
    setGenerationStage,
    setReferenceImages,
    setShowImageUpload,
    t,
    updateMessage,
  ]);
}
type PersistedAssistantMessageLike = {
  content: string;
  outputImage: string | null;
  generationParams: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  status: string;
  errorMessage: string | null;
  orderIndex: number;
  createdAt: string | Date;
};
