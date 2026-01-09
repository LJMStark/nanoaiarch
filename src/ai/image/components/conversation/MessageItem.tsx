'use client';

import { updateProjectActivity } from '@/actions/image-project';
import {
  type GenerationParams,
  type ProjectMessageItem,
  addAssistantMessage,
  deleteMessage,
} from '@/actions/project-message';
import { generateImage } from '@/ai/image/lib/api-utils';
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
import { useEffect, useRef, useState } from 'react';

interface MessageItemProps {
  message: ProjectMessageItem;
  isLast: boolean;
}

// 处理图片 URL：如果是 URL 直接使用，如果是 base64 则添加前缀
const getImageSrc = (imageData: string) => {
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }
  return `data:image/png;base64,${imageData}`;
};

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

// 解析错误消息，返回用户友好的提示
interface TranslationFunction {
  (key: string, values?: Record<string, unknown>): string;
}

function parseErrorMessage(error: unknown, t: TranslationFunction): string {
  if (!(error instanceof Error)) return t('errors.unexpected');

  const msg = error.message.toLowerCase();
  if (msg.includes('unauthorized') || msg.includes('sign in')) {
    return t('errors.signInAgain');
  }
  if (msg.includes('insufficient credits') || msg.includes('credits')) {
    return t('errors.insufficientCredits');
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return t('errors.timeout');
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return t('errors.network');
  }
  return error.message;
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

  // 用于防止组件卸载后更新状态
  const isMountedRef = useRef(true);

  const { messages, addMessage, removeMessage, setGenerating, isGenerating } =
    useConversationStore();

  // 组件卸载时清理
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 获取失败消息对应的用户消息（上一条）
  const getPreviousUserMessage = () => {
    const messageIndex = messages.findIndex((m) => m.id === message.id);
    if (messageIndex <= 0) return null;
    const prevMessage = messages[messageIndex - 1];
    return prevMessage?.role === 'user' ? prevMessage : null;
  };

  // 创建助手消息的辅助函数
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

  // 重试生成
  const handleRetry = async () => {
    if (isRetrying || isGenerating) return;

    const userMessage = getPreviousUserMessage();
    if (!userMessage) {
      logger.ai.error('Cannot retry: no previous user message found');
      return;
    }

    // 解析原始生成参数
    let params: GenerationParams | null = null;
    if (message.generationParams) {
      try {
        params = JSON.parse(message.generationParams) as GenerationParams;
      } catch {
        // 使用默认参数
      }
    }

    const prompt = params?.prompt || userMessage.content;
    const aspectRatio = params?.aspectRatio || '1:1';
    const model = params?.model || 'forma';
    const imageQuality = (params?.imageQuality as '1K' | '2K' | '4K') || '2K';
    const genParams = { prompt, aspectRatio, model, imageQuality };

    logger.ai.info(
      `Starting retry [messageId=${message.id}, projectId=${message.projectId}]`
    );

    setIsRetrying(true);
    setGenerating(true);

    // 删除失败的消息 - 添加错误处理
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

    try {
      // 重新生成图片
      const result = await generateImage({
        prompt,
        referenceImage: userMessage.inputImage || undefined,
        aspectRatio,
        model,
        imageSize: imageQuality,
      });

      // 检查组件是否仍然挂载
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
      // 检查组件是否仍然挂载
      if (!isMountedRef.current) return;

      const errorMessage = parseErrorMessage(error, t as TranslationFunction);
      logger.ai.error('Retry generation error:', error);

      await createAssistantMessage(
        false,
        { error: errorMessage },
        0,
        genParams
      );
    } finally {
      // 只在组件仍挂载时更新状态
      if (isMountedRef.current) {
        setIsRetrying(false);
        setGenerating(false);
      }
    }
  };

  const handleDownload = async () => {
    if (!message.outputImage) return;

    const link = document.createElement('a');
    // 如果是 URL，需要先下载再创建 blob URL
    if (message.outputImage.startsWith('http')) {
      try {
        const response = await fetch(message.outputImage);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = `generation-${message.id}.png`;
        link.click();
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        logger.ai.error('Download failed:', error);
      }
    } else {
      link.href = `data:image/png;base64,${message.outputImage}`;
      link.download = `generation-${message.id}.png`;
      link.click();
    }
  };

  const handleShare = async () => {
    if (!message.outputImage) return;

    try {
      // 获取图片 blob
      let response: Response;
      if (message.outputImage.startsWith('http')) {
        response = await fetch(message.outputImage);
      } else {
        response = await fetch(`data:image/png;base64,${message.outputImage}`);
      }
      const blob = await response.blob();
      const file = new File([blob], 'generation.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t('canvas.shareTitle'),
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
      }
    } catch (error) {
      logger.ai.error('Share failed:', error);
    }
  };

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
