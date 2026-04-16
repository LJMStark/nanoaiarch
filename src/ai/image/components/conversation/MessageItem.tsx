'use client';

import { LoadingMessage } from '@/ai/image/components/conversation/LoadingMessage';
import { generateImage } from '@/ai/image/lib/api-utils';
import { parseErrorMessage } from '@/ai/image/lib/error-utils';
import {
  downloadImage,
  getImageSrc,
  shareImage,
} from '@/ai/image/lib/image-display-utils';
import { updateAssistantMessageRequest } from '@/ai/image/lib/workspace-client';
import type {
  GenerationParams,
  ProjectMessageItem,
} from '@/ai/image/lib/workspace-types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import {
  AlertCircle,
  Download,
  Edit3,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

const GenerationParamsSchema = z.object({
  prompt: z.string(),
  aspectRatio: z.string().default('1:1'),
  model: z.string().default('forma'),
  imageQuality: z.enum(['1K', '2K', '4K']).default('2K'),
});

interface MessageItemProps {
  message: ProjectMessageItem;
  isLast: boolean;
}

export function MessageItem({ message, isLast }: MessageItemProps) {
  if (message.role === 'user') {
    return <UserMessage message={message} />;
  }

  return <AssistantMessage message={message} isLast={isLast} />;
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

function clearFinishedGeneration(
  requestToken: string,
  generatingMessageId: string,
  setAbortController: (controller: AbortController | null) => void,
  setGenerationRequestToken: (token: string | null) => void,
  setGenerating: (generating: boolean, messageId?: string | null) => void,
  setGenerationStage: (
    stage: 'submitting' | 'queued' | 'generating' | 'finishing' | null
  ) => void
): void {
  const state = useConversationStore.getState();

  if (state.generationRequestToken === requestToken) {
    setAbortController(null);
    setGenerationRequestToken(null);
  }

  if (state.generatingMessageId === generatingMessageId) {
    setGenerating(false);
    setGenerationStage(null);
  }
}

function UserMessage({ message }: { message: ProjectMessageItem }) {
  const t = useTranslations('ArchPage');
  const userInputImages =
    message.inputImages.length > 0
      ? message.inputImages
      : message.inputImage
        ? [message.inputImage]
        : [];

  return (
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
  );
}

function AssistantMessage({
  message,
  isLast,
}: {
  message: ProjectMessageItem;
  isLast: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isMountedRef = useRef(true);
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
    if (isRetrying || isGenerating) {
      return;
    }

    const userMessage = getPreviousUserMessage();
    if (!userMessage) {
      logger.ai.error('Cannot retry: no previous user message found');
      return;
    }

    let params: GenerationParams = {
      prompt: userMessage.content,
      aspectRatio: '1:1',
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
    const aspectRatio = params.aspectRatio || '1:1';
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
      return;
    }

    const controller = new AbortController();
    const requestToken = crypto.randomUUID();

    setAbortController(controller);
    setGenerationRequestToken(requestToken);
    setGenerating(true, message.id);
    setGenerationStage('submitting');
    setGenerationStage('queued');

    try {
      const conversationHistory = getConversationHistory();
      setGenerationStage('generating');

      const result = await generateImage({
        prompt,
        referenceImages:
          userMessage.inputImages.length > 0
            ? userMessage.inputImages
            : userMessage.inputImage
              ? [userMessage.inputImage]
              : undefined,
        aspectRatio,
        model,
        imageSize: imageQuality,
        signal: controller.signal,
        conversationHistory:
          conversationHistory.length > 0 ? conversationHistory : undefined,
        projectId: message.projectId,
        assistantMessageId: message.id,
      });

      if (!isActiveGenerationRequest(requestToken, message.id)) {
        return;
      }

      if (result.message) {
        setGenerationStage('finishing');
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
      clearFinishedGeneration(
        requestToken,
        message.id,
        setAbortController,
        setGenerationRequestToken,
        setGenerating,
        setGenerationStage
      );

      if (isMountedRef.current) {
        setIsRetrying(false);
      }
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
    return <LoadingMessage />;
  }

  return (
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
          <div
            className="group relative max-w-lg"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="relative overflow-hidden rounded-xl border bg-muted">
              <button
                type="button"
                className="block w-full cursor-zoom-in"
                onClick={() => setIsPreviewOpen(true)}
                aria-label={t('canvas.openPreview')}
              >
                <Image
                  src={getImageSrc(message.outputImage)}
                  alt={t('canvas.generatedImageAlt')}
                  width={512}
                  height={512}
                  sizes="(max-width: 640px) 100vw, 512px"
                  className="h-auto w-full"
                />
              </button>
              <div
                className={cn(
                  'absolute inset-0 hidden items-center justify-center gap-2 bg-black/50 transition-opacity sm:flex',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDownload();
                        }}
                        className="h-10 w-10"
                        aria-label={t('canvas.download')}
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('canvas.download')}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleShare();
                        }}
                        className="h-10 w-10"
                        aria-label={t('canvas.share')}
                      >
                        <Share2 className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('canvas.share')}</TooltipContent>
                  </Tooltip>

                  {isLast && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10"
                          onClick={handleEdit}
                          aria-label={t('canvas.edit')}
                        >
                          <Edit3 className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('canvas.edit')}</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            </div>

            {message.generationTime && (
              <div className="mt-1 text-xs text-muted-foreground">
                {t('canvas.generatedIn', {
                  seconds: (message.generationTime / 1000).toFixed(1),
                })}
                {message.creditsUsed &&
                  ` · ${t('projects.credits', { count: message.creditsUsed })}`}
              </div>
            )}

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
              <DialogContent className="max-w-5xl overflow-hidden p-0">
                <DialogTitle className="sr-only">
                  {t('canvas.generatedImageAlt')}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t('canvas.previewDescription')}
                </DialogDescription>
                <div className="border-b bg-background/95 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDownload()}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {t('canvas.download')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleShare()}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      {t('canvas.share')}
                    </Button>
                    {isLast && (
                      <Button variant="outline" size="sm" onClick={handleEdit}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        {t('canvas.edit')}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="relative h-[80vh] w-full bg-black">
                  <Image
                    src={getImageSrc(message.outputImage)}
                    alt={t('canvas.generatedImageAlt')}
                    fill
                    sizes="100vw"
                    className="object-contain"
                  />
                </div>
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
  );
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
