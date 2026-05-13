'use client';

import { LoadingMessage } from '@/ai/image/components/conversation/LoadingMessage';
import { generateImage } from '@/ai/image/lib/api-utils';
import { parseErrorMessage } from '@/ai/image/lib/error-utils';
import {
  clearFinishedGeneration,
  clearSubmittedGenerationRequest,
  isActiveGenerationRequest,
  isGenerationCancelled,
  normalizePersistedAssistantMessage,
} from '@/ai/image/lib/generation-utils';
import {
  downloadImage,
  getImageSrc,
  preloadImage,
  shareImage,
} from '@/ai/image/lib/image-display-utils';
import {
  getOptionalInputImages,
  resolveInputImages,
} from '@/ai/image/lib/input-images';
import { updateAssistantMessageRequest } from '@/ai/image/lib/workspace-client';
import type {
  GenerationParams,
  ProjectMessageItem,
} from '@/ai/image/lib/workspace-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { logger } from '@/lib/logger';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import {
  AlertCircle,
  Download,
  Edit3,
  Loader2,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

// Entry animation only for messages that were appended *recently* — i.e.
// during this session, not historical messages re-mounting on project
// switch / page refresh. We gate on (1) isLast (only the bottom item) and
// (2) createdAt freshness within ENTRY_FRESHNESS_WINDOW_MS. The window is
// generous enough to cover a slow first paint after generation completes
// but short enough that opening an old project never replays animations.
const ENTRY_FRESHNESS_WINDOW_MS = 5000;

function MessageEnter({
  isLast,
  createdAt,
  children,
}: {
  isLast: boolean;
  createdAt: string | Date;
  children: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  const isFresh =
    Date.now() - new Date(createdAt).getTime() < ENTRY_FRESHNESS_WINDOW_MS;
  const shouldAnimate = isLast && isFresh && !shouldReduceMotion;
  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

const GenerationParamsSchema = z.object({
  prompt: z.string(),
  aspectRatio: z.string().default('auto'),
  model: z.string().default('forma'),
  imageQuality: z.enum(['1K', '2K', '4K']).default('2K'),
});

interface MessageItemProps {
  message: ProjectMessageItem;
  isLast: boolean;
}

interface ImageActionRowProps {
  variant: 'outline' | 'ghost';
  containerClassName: string;
  buttonClassName: string;
  showEdit: boolean;
  onDownload: () => void;
  onShare: () => void;
  onEdit: (event: React.MouseEvent) => void;
}

function ImageActionRow({
  variant,
  containerClassName,
  buttonClassName,
  showEdit,
  onDownload,
  onShare,
  onEdit,
}: ImageActionRowProps): React.JSX.Element {
  const t = useTranslations('ArchPage');
  return (
    <div className={containerClassName}>
      <Button
        variant={variant}
        size="sm"
        onClick={onDownload}
        aria-label={t('canvas.download')}
        className={buttonClassName}
      >
        <Download className="h-4 w-4" />
        <span className="text-xs">{t('canvas.download')}</span>
      </Button>
      <Button
        variant={variant}
        size="sm"
        onClick={onShare}
        aria-label={t('canvas.share')}
        className={buttonClassName}
      >
        <Share2 className="h-4 w-4" />
        <span className="text-xs">{t('canvas.share')}</span>
      </Button>
      {showEdit && (
        <Button
          variant={variant}
          size="sm"
          onClick={onEdit}
          aria-label={t('canvas.edit')}
          className={buttonClassName}
        >
          <Edit3 className="h-4 w-4" />
          <span className="text-xs">{t('canvas.edit')}</span>
        </Button>
      )}
    </div>
  );
}

// memo: virtualized rows in MessageList re-render on every scroll tick;
// without memo the entire MessageItem subtree (incl. images + tooltips)
// reconciles unnecessarily. Zustand keeps individual message refs stable
// when other messages mutate, so default shallow comparison is correct.
export const MessageItem = memo(function MessageItem({
  message,
  isLast,
}: MessageItemProps) {
  if (message.role === 'user') {
    return <UserMessage message={message} isLast={isLast} />;
  }

  return <AssistantMessage message={message} isLast={isLast} />;
});

function UserMessage({
  message,
  isLast,
}: {
  message: ProjectMessageItem;
  isLast: boolean;
}) {
  const t = useTranslations('ArchPage');
  const userInputImages = resolveInputImages(
    message.inputImages,
    message.inputImage
  );

  return (
    <MessageEnter isLast={isLast} createdAt={message.createdAt}>
      <div className="flex w-full justify-end px-2 py-2">
        <div className="flex max-w-[85%] flex-col gap-2 rounded-2xl bg-muted/60 px-4 py-2.5 sm:max-w-[75%]">
          <p className="break-words whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {message.content}
          </p>
          {userInputImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {userInputImages.map((inputImage, index) => (
                <div
                  key={`${message.id}-input-${index}`}
                  className="relative aspect-square w-24 overflow-hidden rounded-lg border sm:w-32"
                >
                  <Image
                    src={getImageSrc(inputImage)}
                    alt={`${t('canvas.referenceImageAlt')} ${index + 1}`}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MessageEnter>
  );
}

function AssistantMessage({
  message,
  isLast,
}: {
  message: ProjectMessageItem;
  isLast: boolean;
}) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isMountedRef = useRef(true);
  const retryInFlightRef = useRef(false);
  const isFailed = message.status === 'failed';
  const isGeneratingNow = message.status === 'generating';
  const t = useTranslations('ArchPage');
  const { setDraftImage } = useProjectStore();
  const {
    messages,
    updateMessage,
    setGenerating,
    isGenerating,
    getConversationHistory,
    setAbortController,
    setGenerationRequestToken,
    setGenerationStage,
  } = useConversationStore();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getPreviousUserMessage = () => {
    const messageIndex = messages.findIndex(
      (candidate) => candidate.id === message.id
    );
    if (messageIndex <= 0) {
      return null;
    }

    const previousMessage = messages[messageIndex - 1];
    return previousMessage?.role === 'user' ? previousMessage : null;
  };

  const persistFailureState = useCallback(
    async (data: {
      content: string;
      errorMessage: string;
    }) => {
      const result = await updateAssistantMessageRequest(message.id, {
        content: data.content,
        status: 'failed',
        errorMessage: data.errorMessage,
      });

      if (result.success && result.data) {
        updateMessage(
          message.id,
          normalizePersistedAssistantMessage({
            ...result.data,
            createdAt:
              result.data.createdAt instanceof Date
                ? result.data.createdAt.toISOString()
                : new Date(result.data.createdAt).toISOString(),
          })
        );
        return;
      }

      updateMessage(message.id, {
        content: data.content,
        status: 'failed',
        errorMessage: data.errorMessage,
      });
    },
    [message.id, updateMessage]
  );

  const handleRetry = async () => {
    if (isRetrying || retryInFlightRef.current || isGenerating) {
      return;
    }
    retryInFlightRef.current = true;

    const userMessage = getPreviousUserMessage();
    if (!userMessage) {
      logger.ai.error('Cannot retry: no previous user message found');
      retryInFlightRef.current = false;
      return;
    }

    let params: GenerationParams = {
      prompt: userMessage.content,
      aspectRatio: 'auto',
      model: 'forma',
      imageQuality: '2K',
    };

    if (message.generationParams) {
      try {
        const parsed = JSON.parse(message.generationParams);
        const validationResult = GenerationParamsSchema.safeParse(parsed);

        if (validationResult.success) {
          params = validationResult.data;
        } else {
          logger.ai.warn(
            'Failed to validate generation params, using defaults',
            {
              error: validationResult.error.message,
            }
          );
        }
      } catch (error) {
        logger.ai.warn('Failed to parse generation params, using defaults', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const prompt = params.prompt || userMessage.content;
    const aspectRatio = params.aspectRatio || 'auto';
    const model = params.model || 'forma';
    const imageQuality = (params.imageQuality as '1K' | '2K' | '4K') || '2K';

    setIsRetrying(true);

    // Optimistic: immediately show loading state
    const prevErrorMessage = message.errorMessage;
    const prevContent = message.content;
    updateMessage(message.id, {
      content: '',
      outputImage: null,
      creditsUsed: null,
      generationTime: null,
      status: 'generating',
      errorMessage: null,
    });

    // Sync with server in background
    const resumeResult = await updateAssistantMessageRequest(message.id, {
      content: '',
      outputImage: null,
      creditsUsed: null,
      generationTime: null,
      status: 'generating',
      errorMessage: null,
    });

    if (!resumeResult.success || !resumeResult.data) {
      logger.ai.error('Failed to resume failed assistant message', {
        messageId: message.id,
        error: resumeResult.error,
      });
      // Rollback to failed state
      updateMessage(message.id, {
        content: prevContent,
        status: 'failed',
        errorMessage: prevErrorMessage,
      });
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
      retryInFlightRef.current = false;
      return;
    }

    const controller = new AbortController();
    const requestToken = crypto.randomUUID();
    const generationAttemptId = crypto.randomUUID();

    setAbortController(controller);
    setGenerationRequestToken(requestToken);
    setGenerating(true, message.id);
    setGenerationStage('submitting');
    setGenerationStage('queued');
    let keepRecoveryPolling = false;

    try {
      const conversationHistory =
        model === 'gpt-image-2' ? [] : getConversationHistory();
      const retryInputImages =
        model === 'gpt-image-2'
          ? []
          : (getOptionalInputImages(
              userMessage.inputImages,
              userMessage.inputImage
            ) ?? []);
      setGenerationStage('generating');

      const result = await generateImage({
        prompt,
        referenceImages:
          retryInputImages.length > 0 ? retryInputImages : undefined,
        aspectRatio,
        model,
        imageSize: imageQuality,
        signal: controller.signal,
        conversationHistory:
          conversationHistory.length > 0 ? conversationHistory : undefined,
        projectId: message.projectId,
        assistantMessageId: message.id,
        generationAttemptId,
      });

      if (!isActiveGenerationRequest(requestToken, message.id)) {
        return;
      }

      if (result.message) {
        if (result.message.status === 'generating') {
          updateMessage(
            message.id,
            normalizePersistedAssistantMessage(result.message)
          );
          clearSubmittedGenerationRequest(requestToken, message.id, {
            setAbortController,
            setGenerationRequestToken,
            setGenerating,
            setGenerationStage,
          });
          keepRecoveryPolling = true;
          return;
        }

        setGenerationStage('finishing');
        if (result.message.outputImage) {
          await preloadImage(result.message.outputImage);
        }
        updateMessage(
          message.id,
          normalizePersistedAssistantMessage(result.message)
        );
        return;
      }

      if (isGenerationCancelled(result.error)) {
        await persistFailureState({
          content: t('loading.cancelled'),
          errorMessage: 'Generation cancelled',
        });
        return;
      }

      await persistFailureState({
        content: result.error || t('errors.generationFailed'),
        errorMessage: result.error || t('errors.generationFailed'),
      });
    } catch (error) {
      logger.ai.error('Retry generation error:', error);

      if (!isActiveGenerationRequest(requestToken, message.id)) {
        return;
      }

      await persistFailureState({
        content: parseErrorMessage(error, (key: string) => t(key as never)),
        errorMessage:
          error instanceof Error ? error.message : t('errors.unknown'),
      });
    } finally {
      if (!keepRecoveryPolling) {
        clearFinishedGeneration(requestToken, message.id, {
          setAbortController,
          setGenerationRequestToken,
          setGenerating,
          setGenerationStage,
        });
      }

      if (isMountedRef.current) {
        setIsRetrying(false);
      }
      retryInFlightRef.current = false;
    }
  };

  const handleDownload = useCallback(async () => {
    if (!message.outputImage) {
      return;
    }

    try {
      await downloadImage(message.outputImage, `generation-${message.id}.png`);
    } catch (error) {
      logger.ai.error('Download failed:', error);
    }
  }, [message.id, message.outputImage]);

  const handleShare = useCallback(async () => {
    if (!message.outputImage) {
      return;
    }

    try {
      await shareImage(message.outputImage, t('canvas.shareTitle'));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      logger.ai.error('Share failed:', error);
    }
  }, [message.outputImage, t]);

  const handleEdit = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!message.outputImage) {
        return;
      }

      setDraftImage(message.outputImage);
      setIsPreviewOpen(false);
    },
    [message.outputImage, setDraftImage]
  );

  if (isGeneratingNow) {
    return <LoadingMessage message={message} />;
  }

  return (
    <MessageEnter isLast={isLast} createdAt={message.createdAt}>
      <div className="flex w-full justify-start px-2 py-2">
        <div className="min-w-0 flex-1 space-y-4 max-w-[90%] sm:max-w-[85%]">
          {isFailed ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
              <span className="flex-1 text-sm text-destructive">
                {message.errorMessage || t('errors.generationFailed')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying || isGenerating}
                className="flex-shrink-0"
              >
                {isRetrying ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-4 w-4" />
                )}
                {t('canvas.retry')}
              </Button>
            </div>
          ) : message.outputImage ? (
            <div className="max-w-lg space-y-2">
              <button
                type="button"
                className="block cursor-zoom-in"
                onClick={() => setIsPreviewOpen(true)}
                aria-label={t('canvas.openPreview')}
              >
                <img
                  src={getImageSrc(message.outputImage)}
                  alt={t('canvas.generatedImageAlt')}
                  className="block h-auto w-auto max-w-full rounded-xl"
                />
              </button>

              <ImageActionRow
                variant="outline"
                containerClassName="flex flex-wrap items-center gap-2"
                buttonClassName="h-9 gap-1.5"
                showEdit={isLast}
                onDownload={() => void handleDownload()}
                onShare={() => void handleShare()}
                onEdit={handleEdit}
              />

              {message.generationTime && (
                <div className="text-xs text-muted-foreground">
                  {t('canvas.generatedIn', {
                    seconds: (message.generationTime / 1000).toFixed(1),
                  })}
                  {message.creditsUsed &&
                    ` · ${t('projects.credits', { count: message.creditsUsed })}`}
                </div>
              )}

              <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="!max-w-[95vw] sm:!max-w-[95vw] w-fit !p-0 !border-0 !bg-transparent !shadow-none !gap-3">
                  <DialogTitle className="sr-only">
                    {t('canvas.generatedImageAlt')}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {t('canvas.previewDescription')}
                  </DialogDescription>
                  <img
                    src={getImageSrc(message.outputImage)}
                    alt={t('canvas.generatedImageAlt')}
                    className="block h-auto w-auto max-h-[85vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
                  />
                  <ImageActionRow
                    variant="ghost"
                    containerClassName="mx-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-background/95 px-2.5 py-1.5 shadow-lg backdrop-blur"
                    buttonClassName="h-8 gap-1.5"
                    showEdit={isLast}
                    onDownload={() => void handleDownload()}
                    onShare={() => void handleShare()}
                    onEdit={handleEdit}
                  />
                </DialogContent>
              </Dialog>
            </div>
          ) : null}

          {message.content && (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {message.content}
            </p>
          )}
        </div>
      </div>
    </MessageEnter>
  );
}
