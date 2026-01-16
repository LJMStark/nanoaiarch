'use client';

import { updateProjectActivity } from '@/actions/image-project';
import {
  type GenerationParams,
  type ProjectMessageItem,
  addAssistantMessage,
  deleteMessage,
} from '@/actions/project-message';
import { generateImage } from '@/ai/image/lib/api-utils';
import { parseErrorMessage } from '@/ai/image/lib/error-utils';
import {
  downloadImage,
  getImageSrc,
  shareImage,
} from '@/ai/image/lib/image-display-utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/stores/conversation-store';
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

// Zod schema for generation parameters validation
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

function UserMessage({ message }: { message: ProjectMessageItem }) {
  const t = useTranslations('ArchPage');
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="bg-muted">
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2 min-w-0">
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        {message.inputImage && (
          <div className="relative w-48 aspect-square rounded-lg overflow-hidden border">
            <Image
              src={getImageSrc(message.inputImage)}
              alt={t('canvas.referenceImageAlt')}
              fill
              className="object-cover"
            />
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
  const isFailed = message.status === 'failed';
  const isGeneratingNow = message.status === 'generating';
  const t = useTranslations('ArchPage');

  // Prevent state updates after component unmount
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { messages, addMessage, removeMessage, setGenerating, isGenerating } =
    useConversationStore();

  // Cleanup on component unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Get the previous user message corresponding to a failed message
  const getPreviousUserMessage = () => {
    const messageIndex = messages.findIndex((m) => m.id === message.id);
    if (messageIndex <= 0) return null;
    const prevMessage = messages[messageIndex - 1];
    return prevMessage?.role === 'user' ? prevMessage : null;
  };

  // Helper function to create assistant message
  const createAssistantMessage = async (
    success: boolean,
    result: { image?: string; error?: string; creditsUsed?: number },
    generationTime: number,
    params: {
      prompt: string;
      aspectRatio: string;
      model: string;
      imageQuality: string;
    }
  ) => {
    const assistantResult = await addAssistantMessage(message.projectId, {
      content: success ? '' : result.error || t('errors.generationFailed'),
      outputImage: success ? result.image : undefined,
      generationParams: params,
      creditsUsed: success ? result.creditsUsed || 1 : undefined,
      generationTime: success ? generationTime : undefined,
      status: success ? 'completed' : 'failed',
      errorMessage: success ? undefined : result.error,
    });

    if (assistantResult.success && assistantResult.data) {
      addMessage(assistantResult.data);

      if (success && result.image) {
        await updateProjectActivity(message.projectId, {
          coverImage: result.image,
          creditsUsed: result.creditsUsed || 1,
          incrementGeneration: true,
        });
      }
    }
  };

  // Retry generation
  const handleRetry = async () => {
    if (isRetrying || isGenerating) return;

    const userMessage = getPreviousUserMessage();
    if (!userMessage) {
      logger.ai.error('Cannot retry: no previous user message found');
      return;
    }

    // Parse original generation parameters with Zod validation
    let params: GenerationParams = {
      prompt: userMessage.content,
      aspectRatio: '1:1',
      model: 'forma',
      imageQuality: '2K',
    };

    if (message.generationParams) {
      try {
        const parsed = JSON.parse(message.generationParams);

        // Validate with Zod schema
        const validationResult = GenerationParamsSchema.safeParse(parsed);

        if (validationResult.success) {
          params = validationResult.data;
        } else {
          logger.ai.warn('Failed to validate generation params, using defaults', {
            error: validationResult.error.message,
          });
          // Use default params already set above
        }
      } catch (error) {
        logger.ai.warn('Failed to parse generation params, using defaults', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Use default params already set above
      }
    }

    const prompt = params.prompt || userMessage.content;
    const aspectRatio = params.aspectRatio || '1:1';
    const model = params.model || 'forma';
    const imageQuality = (params.imageQuality as '1K' | '2K' | '4K') || '2K';
    const genParams = { prompt, aspectRatio, model, imageQuality };

    logger.ai.info(
      `Starting retry [messageId=${message.id}, projectId=${message.projectId}]`
    );

    setIsRetrying(true);
    setGenerating(true);

    // Delete failed message with error handling
    const deleteResult = await deleteMessage(message.id);
    if (!deleteResult.success) {
      logger.ai.error('Failed to delete failed message:', deleteResult.error);
      if (isMountedRef.current) {
        setIsRetrying(false);
        setGenerating(false);
      }
      return;
    }
    removeMessage(message.id);

    const startTime = Date.now();

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      // Regenerate image
      const result = await generateImage({
        prompt,
        referenceImage: userMessage.inputImage || undefined,
        aspectRatio,
        model,
        imageSize: imageQuality,
      });

      // Check if component is still mounted
      if (!isMountedRef.current) return;

      const generationTime = Date.now() - startTime;

      if (result.success && result.image) {
        logger.ai.info(
          `Retry succeeded [messageId=${message.id}, generationTime=${generationTime}ms]`
        );
        await createAssistantMessage(true, result, generationTime, genParams);
      } else {
        logger.ai.warn(
          `Retry failed [messageId=${message.id}, error=${result.error}]`
        );
        await createAssistantMessage(false, result, 0, genParams);
      }
    } catch (error) {
      // Check if component is still mounted
      if (!isMountedRef.current) return;

      const errorMessage = parseErrorMessage(error, (key: string) =>
        t(key as never)
      );
      logger.ai.error('Retry generation error:', error);

      await createAssistantMessage(
        false,
        { error: errorMessage },
        0,
        genParams
      );
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsRetrying(false);
        setGenerating(false);
        abortControllerRef.current = null;
      }
    }
  };

  // Download image
  const handleDownload = useCallback(async () => {
    if (!message.outputImage) return;

    try {
      await downloadImage(message.outputImage, `generation-${message.id}.png`);
    } catch (error) {
      logger.ai.error('Download failed:', error);
    }
  }, [message.outputImage, message.id]);

  // Share image
  const handleShare = useCallback(async () => {
    if (!message.outputImage) return;

    try {
      await shareImage(message.outputImage, t('canvas.shareTitle'));
    } catch (error) {
      // User cancellation is expected behavior, not an error
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      logger.ai.error('Share failed:', error);
    }
  }, [message.outputImage, t]);

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0 bg-primary">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-3 min-w-0">
        {isGeneratingNow ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
            <span className="text-sm text-muted-foreground flex-1">
              {t('canvas.generating')}
            </span>
          </div>
        ) : isFailed ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <span className="text-sm text-destructive flex-1">
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
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              {t('canvas.retry')}
            </Button>
          </div>
        ) : message.outputImage ? (
          <div
            className="relative group max-w-lg"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="relative rounded-xl overflow-hidden border bg-muted">
              <Image
                src={getImageSrc(message.outputImage)}
                alt={t('canvas.generatedImageAlt')}
                width={512}
                height={512}
                className="w-full h-auto"
              />

              {/* Hover overlay with actions */}
              <div
                className={cn(
                  'absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={handleDownload}
                        className="h-10 w-10"
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
                        onClick={handleShare}
                        className="h-10 w-10"
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

            {/* Generation info */}
            {message.generationTime && (
              <div className="mt-1 text-xs text-muted-foreground">
                {t('canvas.generatedIn', {
                  seconds: (message.generationTime / 1000).toFixed(1),
                })}
                {message.creditsUsed &&
                  ` · ${t('projects.credits', {
                    count: message.creditsUsed,
                  })}`}
              </div>
            )}
          </div>
        ) : null}

        {message.content && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>
    </div>
  );
}
