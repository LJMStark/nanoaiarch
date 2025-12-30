'use client';

import { updateProjectActivity } from '@/actions/image-project';
import { addAssistantMessage, addUserMessage } from '@/actions/project-message';
import { AspectRatioSelect } from '@/ai/image/components/AspectRatioSelect';
import {
  type ImageQuality,
  ImageQualitySelect,
} from '@/ai/image/components/ImageQualitySelect';
import { ImageUploader } from '@/ai/image/components/ImageUploader';
import { generateImage, validateBase64Image } from '@/ai/image/lib/api-utils';
import type { AspectRatioId } from '@/ai/image/lib/arch-types';
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
import { ArrowUp, ImageIcon, Loader2, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

export function ConversationInput() {
  const t = useTranslations('ArchPage');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleImageSelect = (image: string | null) => {
    if (image) {
      const validation = validateBase64Image(image);
      if (!validation.valid) {
        setImageError(validation.error || 'Image too large');
        return;
      }
      // 选择图片后自动关闭上传区域，显示小预览
      setShowImageUpload(false);
    }
    setImageError(null);
    setReferenceImage(image);
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
    const inputImage = referenceImage || getLastOutputImage();

    // Clear input immediately
    clearDraft();
    setReferenceImage(null);
    setShowImageUpload(false);

    // Add user message
    const userResult = await addUserMessage(currentProjectId, {
      content: prompt,
      inputImage: inputImage || undefined,
    });

    if (!userResult.success || !userResult.data) {
      logger.ai.error('Failed to add user message');
      return;
    }

    addMessage(userResult.data);

    // Start generation
    setGenerating(true);
    const startTime = Date.now();

    try {
      // Generate image with quality setting
      const result = await generateImage({
        prompt,
        referenceImage: inputImage || undefined,
        aspectRatio: aspectRatio,
        model: selectedModel,
        imageSize: imageQuality,
      });

      const generationTime = Date.now() - startTime;

      if (result.success && result.image) {
        // Add assistant message with result
        const assistantResult = await addAssistantMessage(currentProjectId, {
          content: '',
          outputImage: result.image,
          generationParams: {
            prompt,
            aspectRatio,
            model: selectedModel,
            imageQuality,
          },
          creditsUsed: result.creditsUsed || 1,
          generationTime,
          status: 'completed',
        });

        if (assistantResult.success && assistantResult.data) {
          addMessage(assistantResult.data);

          // Update project activity
          await updateProjectActivity(currentProjectId, {
            coverImage: result.image,
            creditsUsed: result.creditsUsed || 1,
            incrementGeneration: true,
          });
        }
      } else {
        // Add failed message
        const assistantResult = await addAssistantMessage(currentProjectId, {
          content: result.error || 'Generation failed',
          status: 'failed',
          errorMessage: result.error,
        });

        if (assistantResult.success && assistantResult.data) {
          addMessage(assistantResult.data);
        }
      }
    } catch (error) {
      logger.ai.error('Generation error:', error);
      // Add error message
      const assistantResult = await addAssistantMessage(currentProjectId, {
        content: 'An unexpected error occurred',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      if (assistantResult.success && assistantResult.data) {
        addMessage(assistantResult.data);
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
                <ImageUploader
                  currentImage={referenceImage ?? undefined}
                  onImageSelect={handleImageSelect}
                  onImageClear={() => {
                    setReferenceImage(null);
                    setImageError(null);
                  }}
                />
                {imageError && (
                  <p className="text-sm text-destructive px-1">{imageError}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reference image preview */}
        {referenceImage && !showImageUpload && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <div className="relative h-12 w-12 rounded overflow-hidden">
              <img
                src={`data:image/png;base64,${referenceImage}`}
                alt="Reference"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-sm text-muted-foreground flex-1">
              Reference image attached
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setReferenceImage(null)}
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
                ? 'Describe the image you want to create...'
                : 'Select or create a project to start'
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
                  <label className="text-sm font-medium">Quality</label>
                  <ImageQualitySelect
                    value={imageQuality}
                    onChange={(value) => setImageQuality(value as ImageQuality)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Aspect Ratio</label>
                  <AspectRatioSelect
                    value={aspectRatio}
                    onChange={(value) => setAspectRatio(value as AspectRatioId)}
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
