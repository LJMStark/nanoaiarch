'use client';

import { updateProjectActivity } from '@/actions/image-project';
import {
  addAssistantMessage,
  addUserMessage,
  updateAssistantMessage,
} from '@/actions/project-message';
import { MultiImageUploader } from '@/ai/image/components/MultiImageUploader';
import { GenerationSettings } from '@/ai/image/components/conversation/GenerationSettings';
import { ReferenceImagesPreview } from '@/ai/image/components/conversation/ReferenceImagesPreview';
import { generateImage, validateBase64Image } from '@/ai/image/lib/api-utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, ImageIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

// Message update data type for server/client sync
interface MessageUpdateData {
  outputImage?: string;
  creditsUsed?: number;
  generationTime?: number;
  status: 'completed' | 'failed';
  content?: string;
  errorMessage?: string;
}

export function ConversationInput() {
  const t = useTranslations('ArchPage');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  // Get localized error message for image validation
  const getImageValidationError = useCallback(
    (error?: string): string => {
      if (!error) return t('errors.imageTooLarge');

      const normalized = error.toLowerCase();

      if (normalized.includes('invalid url')) {
        return t('errors.invalidUrl');
      }
      if (normalized.includes('invalid image data')) {
        return t('errors.invalidImageData');
      }
      if (normalized.includes('maximum') || normalized.includes('exceeds')) {
        return t('errors.imageTooLarge');
      }

      return t('errors.imageTooLarge');
    },
    [t]
  );

  // Handle image changes: validate and update state
  const handleImagesChange = useCallback(
    (images: string[]) => {
      // Validate all images
      for (const image of images) {
        const validation = validateBase64Image(image);
        if (!validation.valid) {
          setImageError(getImageValidationError(validation.error));
          return;
        }
      }
      setImageError(null);
      setReferenceImages(images);
      // Auto-close upload area when images are added, show preview
      if (images.length > 0) {
        setShowImageUpload(false);
      }
    },
    [getImageValidationError]
  );

  const {
    currentProjectId,
    draftPrompt,
    draftImage,
    imageQuality,
    aspectRatio,
    selectedModel,
    setDraftPrompt,
    setDraftImage,
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

  // Apply draft reference image from edit action
  useEffect(() => {
    if (!draftImage) return;
    setReferenceImages([draftImage]);
    setShowImageUpload(false);
    setImageError(null);
    setDraftImage(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [draftImage, setDraftImage]);

  // Helper function to update message state (syncs server and client)
  const updateMessageState = useCallback(
    async (messageId: string, data: MessageUpdateData): Promise<void> => {
      const updateResult = await updateAssistantMessage(messageId, data);
      if (updateResult.success) {
        updateMessage(messageId, data);
      }
    },
    [updateMessage]
  );

  const handleSubmit = useCallback(async () => {
    if (!draftPrompt.trim() || isGenerating || !currentProjectId) return;

    const prompt = draftPrompt.trim();
    // Multi-image support: prefer user-uploaded images, fallback to last generated image
    const inputImages =
      referenceImages.length > 0
        ? referenceImages
        : ([getLastOutputImage()].filter(Boolean) as string[]);

    // Clear input immediately
    clearDraft();
    setReferenceImages([]);
    setShowImageUpload(false);

    // Add user message (show first image as preview)
    const userResult = await addUserMessage(currentProjectId, {
      content: prompt,
      inputImage: inputImages[0] || undefined,
    });

    if (!userResult.success || !userResult.data) {
      logger.ai.error('Failed to add user message');
      return;
    }

    addMessage(userResult.data);

    // Create message with 'generating' status
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
      // Generate image (supports multi-image reference)
      const result = await generateImage({
        prompt,
        referenceImages: inputImages.length > 0 ? inputImages : undefined,
        aspectRatio: aspectRatio,
        model: selectedModel,
        imageSize: imageQuality,
      });

      const generationTime = Date.now() - startTime;

      if (result.success && result.image) {
        // Update to completed status
        await updateMessageState(generatingMessage.id, {
          outputImage: result.image,
          creditsUsed: result.creditsUsed || 1,
          generationTime,
          status: 'completed',
        });

        // Update project activity
        const activityResult = await updateProjectActivity(currentProjectId, {
          coverImage: result.image,
          creditsUsed: result.creditsUsed || 1,
          incrementGeneration: true,
        });

        if (!activityResult.success) {
          logger.ai.error('updateProjectActivity failed', {
            projectId: currentProjectId,
            messageId: generatingMessage.id,
            error: activityResult.error,
          });
        }
      } else {
        // Update to failed status
        const errorContent = result.error || t('errors.generationFailed');
        await updateMessageState(generatingMessage.id, {
          content: errorContent,
          status: 'failed',
          errorMessage: result.error,
        });
      }
    } catch (error) {
      logger.ai.error('Generation error:', error);
      // Update to failed status
      const errorContent = t('errors.unexpected');
      const errorMsg =
        error instanceof Error ? error.message : t('errors.unknown');
      await updateMessageState(generatingMessage.id, {
        content: errorContent,
        status: 'failed',
        errorMessage: errorMsg,
      });
    } finally {
      setGenerating(false);
    }
  }, [
    draftPrompt,
    isGenerating,
    currentProjectId,
    referenceImages,
    getLastOutputImage,
    clearDraft,
    addMessage,
    aspectRatio,
    selectedModel,
    imageQuality,
    setGenerating,
    updateMessageState,
    t,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

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
        {!showImageUpload && (
          <ReferenceImagesPreview
            images={referenceImages}
            onRemove={() => setReferenceImages([])}
          />
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

          <GenerationSettings
            imageQuality={imageQuality}
            aspectRatio={aspectRatio}
            onImageQualityChange={setImageQuality}
            onAspectRatioChange={setAspectRatio}
          />

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
