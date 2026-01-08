'use client';

import { updateProjectActivity } from '@/actions/image-project';
import {
  addAssistantMessage,
  addUserMessage,
  updateAssistantMessage,
} from '@/actions/project-message';
import { AspectRatioSelect } from '@/ai/image/components/AspectRatioSelect';
import { ImageQualitySelect } from '@/ai/image/components/ImageQualitySelect';
import { MultiImageUploader } from '@/ai/image/components/MultiImageUploader';
import { generateImage, validateBase64Image } from '@/ai/image/lib/api-utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, ImageIcon, Loader2, Settings2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

export function ConversationInput() {
  const t = useTranslations('ArchPage');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  const getImageValidationError = (error?: string) => {
    if (!error) return t('errors.imageTooLarge');
    const normalized = error.toLowerCase();
    if (normalized.includes('invalid url')) return t('errors.invalidUrl');
    if (normalized.includes('invalid image data'))
      return t('errors.invalidImageData');
    if (normalized.includes('maximum') || normalized.includes('exceeds')) {
      return t('errors.imageTooLarge');
    }
    return t('errors.imageTooLarge');
  };

  const handleImagesChange = (images: string[]) => {
    // 验证所有图片
    for (const image of images) {
      const validation = validateBase64Image(image);
      if (!validation.valid) {
        setImageError(getImageValidationError(validation.error));
        return;
      }
    }
    setImageError(null);
    setReferenceImages(images);
    // 有图片时自动关闭上传区域，显示预览
    if (images.length > 0) {
      setShowImageUpload(false);
    }
  };

  const {
    currentProjectId,
    draftPrompt,
    imageQuality,
    aspectRatio,
    selectedModel,
    setDraftPrompt,
    setImageQuality,
    setAspectRatio,
    clearDraft,
  } = useProjectStore();

  const {
    isGenerating,
    addMessage,
    updateMessage,
    setGenerating,
    getLastOutputImage,
  } = useConversationStore();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [draftPrompt]);

  const handleSubmit = async () => {
    if (!draftPrompt.trim() || isGenerating || !currentProjectId) return;

    const prompt = draftPrompt.trim();
    // 多图支持：优先使用用户上传的图片，否则使用最后一次生成的图片
    const inputImages =
      referenceImages.length > 0
        ? referenceImages
        : ([getLastOutputImage()].filter(Boolean) as string[]);

    // Clear input immediately
    clearDraft();
    setReferenceImages([]);
    setShowImageUpload(false);

    // Add user message (只显示第一张图作为预览)
    const userResult = await addUserMessage(currentProjectId, {
      content: prompt,
      inputImage: inputImages[0] || undefined,
    });

    if (!userResult.success || !userResult.data) {
      logger.ai.error('Failed to add user message');
      return;
    }

    addMessage(userResult.data);

    // Start generation - 先创建 generating 状态的消息
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
      logger.ai.error('Failed to create generating message');
      return;
    }

    const generatingMessage = generatingResult.data;
    addMessage(generatingMessage);
    setGenerating(true, generatingMessage.id);
    const startTime = Date.now();

    try {
      // Generate image with quality setting (支持多图参考)
      const result = await generateImage({
        prompt,
        referenceImages: inputImages.length > 0 ? inputImages : undefined,
        aspectRatio: aspectRatio,
        model: selectedModel,
        imageSize: imageQuality,
      });

      const generationTime = Date.now() - startTime;

      if (result.success && result.image) {
        // 更新 generating 消息为 completed
        const updateResult = await updateAssistantMessage(generatingMessage.id, {
          content: '',
          outputImage: result.image,
          creditsUsed: result.creditsUsed || 1,
          generationTime,
          status: 'completed',
        });

        if (updateResult.success && updateResult.data) {
          updateMessage(generatingMessage.id, updateResult.data);

          // Update project activity
          const activityResult = await updateProjectActivity(currentProjectId, {
            coverImage: result.image,
            creditsUsed: result.creditsUsed || 1,
            incrementGeneration: true,
          });

          // 监控失败情况
          if (!activityResult.success) {
            logger.ai.error('updateProjectActivity failed', {
              projectId: currentProjectId,
              messageId: generatingMessage.id,
              error: activityResult.error,
            });
          }
        }
      } else {
        // 更新 generating 消息为 failed
        const updateResult = await updateAssistantMessage(generatingMessage.id, {
          content: result.error || t('errors.generationFailed'),
          status: 'failed',
          errorMessage: result.error,
        });

        if (updateResult.success && updateResult.data) {
          updateMessage(generatingMessage.id, updateResult.data);
        }
      }
    } catch (error) {
      logger.ai.error('Generation error:', error);
      // 更新 generating 消息为 failed
      const updateResult = await updateAssistantMessage(generatingMessage.id, {
        content: t('errors.unexpected'),
        status: 'failed',
        errorMessage:
          error instanceof Error ? error.message : t('errors.unknown'),
      });

      if (updateResult.success && updateResult.data) {
        updateMessage(generatingMessage.id, updateResult.data);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = !currentProjectId || !draftPrompt.trim() || isGenerating;

  return (
    <div className="border-t bg-background p-4 flex-shrink-0">
      <div className="max-w-3xl mx-auto space-y-3">
        {/* Image upload area (collapsible) */}
        <AnimatePresence>
          {showImageUpload && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pb-3 space-y-2">
                <MultiImageUploader
                  currentImages={referenceImages}
                  onImagesChange={handleImagesChange}
                />
                {imageError && (
                  <p className="text-sm text-destructive px-1">{imageError}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reference images preview */}
        {referenceImages.length > 0 && !showImageUpload && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <div className="flex gap-1">
              {referenceImages.slice(0, 3).map((img, idx) => {
                // Type safety check
                const imageSrc =
                  typeof img === 'string' ? `data:image/png;base64,${img}` : '';
                if (!imageSrc) {
                  console.error('Invalid image data at index', idx, img);
                  return null;
                }
                return (
                  <div
                    key={idx}
                    className="relative h-10 w-10 rounded overflow-hidden"
                  >
                    <img
                      src={imageSrc}
                      alt={`Reference ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                );
              })}
              {referenceImages.length > 3 && (
                <div className="h-10 w-10 rounded bg-background/50 flex items-center justify-center text-xs text-muted-foreground">
                  +{referenceImages.length - 3}
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground flex-1">
              {t('controls.referenceCount', { count: referenceImages.length })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setReferenceImages([])}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Main input area */}
        <div className="flex items-end gap-2 bg-muted rounded-xl p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowImageUpload(!showImageUpload)}
            className={cn(
              'h-9 w-9 flex-shrink-0',
              showImageUpload && 'bg-accent'
            )}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>

          <Textarea
            ref={textareaRef}
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              currentProjectId
                ? t('controls.prompt')
                : t('controls.promptNoProject')
            }
            disabled={!currentProjectId}
            className="flex-1 resize-none bg-transparent border-0 focus-visible:ring-0 min-h-[36px] max-h-[200px] py-2"
            rows={1}
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
              >
                <Settings2 className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('controls.quality')}
                  </label>
                  <ImageQualitySelect
                    value={imageQuality}
                    onChange={setImageQuality}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('controls.aspectRatio')}
                  </label>
                  <AspectRatioSelect
                    value={aspectRatio}
                    onChange={setAspectRatio}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            onClick={handleSubmit}
            disabled={isDisabled}
            size="icon"
            className="rounded-full h-9 w-9 flex-shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Quick settings chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="text-xs text-muted-foreground px-2">
            {imageQuality} · {aspectRatio}
          </div>
        </div>
      </div>
    </div>
  );
}
