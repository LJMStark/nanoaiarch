'use client';

import { MultiImageUploader } from '@/ai/image/components/MultiImageUploader';
import { GenerationSettings } from '@/ai/image/components/conversation/GenerationSettings';
import { ReferenceImagesPreview } from '@/ai/image/components/conversation/ReferenceImagesPreview';
import { useImageIngestion } from '@/ai/image/hooks/use-image-ingestion';
import { MAX_REFERENCE_IMAGES } from '@/ai/image/lib/input-images';
import { MODEL_DISPLAY_NAMES } from '@/ai/image/lib/provider-config';
import { isTemporaryId } from '@/ai/image/lib/temp-ids';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const [showImageUpload, setShowImageUpload] = useState(false);

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
    setSelectedModel,
    clearDraft,
  } = useProjectStore();

  const {
    isGenerating,
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
  } = useConversationStore();

  const isProjectReady =
    Boolean(currentProjectId) && !isTemporaryId(currentProjectId);

  // All paste / drag / compress / validate logic lives in this hook
  // (Week 4.3). The component itself stays focused on the textarea +
  // submit affordances; new image sources slot in by extending the hook.
  const {
    referenceImages,
    setReferenceImages,
    imageError,
    clearImageError,
    isPastingImage,
    isDraggingImage,
    handleImagesChange: ingestionHandleImagesChange,
    handlePaste,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImageIngestion({
    isProjectReady,
    onAfterIngest: () => textareaRef.current?.focus(),
  });

  // Auto-close the upload picker once images land — keeps the input area
  // focused on the textarea after a successful pick.
  const handleImagesChange = useCallback(
    (images: string[]) => {
      ingestionHandleImagesChange(images);
      if (images.length > 0) setShowImageUpload(false);
    },
    [ingestionHandleImagesChange]
  );

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [draftPrompt]);

  // Reset the image picker whenever the active project changes.
  useEffect(() => {
    setReferenceImages([]);
    setShowImageUpload(false);
    clearImageError();
  }, [currentProjectId, clearImageError, setReferenceImages]);

  // Apply draft reference image from edit action
  useEffect(() => {
    if (!draftImage) return;
    setReferenceImages([draftImage]);
    setShowImageUpload(false);
    clearImageError();
    setDraftImage(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [draftImage, setDraftImage, clearImageError, setReferenceImages]);

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
    setDraftPrompt,
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
    onError: ({ title, description }) =>
      toast({
        title,
        description,
        variant: 'destructive',
      }),
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing || isComposingRef.current) {
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isPastingImage) {
          return;
        }
        handleSubmit();
      }
    },
    [handleSubmit, isPastingImage]
  );

  const isDisabled =
    !isProjectReady || !draftPrompt.trim() || isGenerating || isPastingImage;

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
                  disabled={isPastingImage}
                  maxImages={MAX_REFERENCE_IMAGES}
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
            onRemove={(index) =>
              setReferenceImages((current) =>
                current.filter((_, currentIndex) => currentIndex !== index)
              )
            }
            onClearAll={() => setReferenceImages([])}
          />
        )}

        {/* Main input area */}
        <div
          className={cn(
            'relative rounded-2xl border bg-muted/70 p-3 flex flex-col transition-all',
            isDraggingImage && 'border-primary/70 ring-2 ring-primary/40'
          )}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDraggingImage && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-full border border-primary/50 bg-background/90 px-4 py-2 text-sm font-medium text-primary shadow">
                <ImageIcon className="h-4 w-4" />
                {t('upload.dropHere')}
              </div>
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            placeholder={
              isProjectReady
                ? t('controls.prompt')
                : t('controls.promptNoProject')
            }
            disabled={!isProjectReady}
            className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent px-2 py-1.5 text-[15px] leading-relaxed placeholder:text-muted-foreground/70 focus-visible:ring-0"
            rows={1}
          />

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 sm:mt-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowImageUpload(!showImageUpload)}
                className={cn(
                  'h-9 w-9 flex-shrink-0',
                  showImageUpload && 'bg-accent'
                )}
                disabled={!isProjectReady || isPastingImage}
                aria-label={t('upload.uploadToEdit')}
              >
                <ImageIcon className="h-5 w-5" />
              </Button>

              <GenerationSettings
                imageQuality={imageQuality}
                aspectRatio={aspectRatio}
                selectedModel={selectedModel}
                onImageQualityChange={setImageQuality}
                onAspectRatioChange={setAspectRatio}
                onModelChange={setSelectedModel}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isDisabled}
              size="icon"
              className="h-10 w-10 flex-shrink-0 rounded-full"
              aria-label={
                isGenerating
                  ? t('controls.generating')
                  : isPastingImage
                    ? t('upload.compressing')
                    : t('controls.generate')
              }
            >
              {isGenerating || isPastingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Quick settings chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="text-xs text-muted-foreground px-2">
            {MODEL_DISPLAY_NAMES[selectedModel]} · {imageQuality} ·{' '}
            {aspectRatio}
          </div>
        </div>
      </div>
    </div>
  );
}
