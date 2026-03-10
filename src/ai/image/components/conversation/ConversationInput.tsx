'use client';

import { MultiImageUploader } from '@/ai/image/components/MultiImageUploader';
import { GenerationSettings } from '@/ai/image/components/conversation/GenerationSettings';
import { ReferenceImagesPreview } from '@/ai/image/components/conversation/ReferenceImagesPreview';
import { validateBase64Image } from '@/ai/image/lib/api-utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { ArrowUp, ImageIcon, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConversationSubmit } from './use-conversation-submit';

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
    getConversationHistory,
    setAbortController,
    setGenerationStage,
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

  const handleSubmit = useConversationSubmit({
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
  });

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
