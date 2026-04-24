'use client';

import { MultiImageUploader } from '@/ai/image/components/MultiImageUploader';
import { GenerationSettings } from '@/ai/image/components/conversation/GenerationSettings';
import { ReferenceImagesPreview } from '@/ai/image/components/conversation/ReferenceImagesPreview';
import { validateBase64Image } from '@/ai/image/lib/api-utils';
import {
  compressAcceptedImageFiles,
  isAcceptedImageType,
} from '@/ai/image/lib/image-compress';
import { MAX_REFERENCE_IMAGES } from '@/ai/image/lib/input-images';
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
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const referenceImagesRef = useRef(referenceImages);
  const isPastingImageRef = useRef(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPastingImage, setIsPastingImage] = useState(false);

  // Get localized error message for image validation
  const getImageValidationError = useCallback(
    (error?: string): string => {
      if (!error) return t('errors.imageTooLarge');

      const normalized = error.toLowerCase();

      if (normalized.includes('invalid url')) {
        return t('errors.invalidUrl');
      }
      if (normalized.includes('来源未被允许')) {
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
    removeMessage,
    replaceMessageId,
    setGenerating,
    getLastOutputImage,
    getConversationHistory,
    setAbortController,
    setGenerationRequestToken,
    setGenerationStage,
  } = useConversationStore();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [draftPrompt]);

  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  useEffect(() => {
    setReferenceImages([]);
    setShowImageUpload(false);
    setImageError(null);
  }, [currentProjectId]);

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
        if (isPastingImageRef.current) {
          return;
        }
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const ingestImageFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file, index, list) => {
        return isAcceptedImageType(file.type) && list.indexOf(file) === index;
      });

      if (imageFiles.length === 0) {
        return;
      }

      if (isPastingImageRef.current) {
        return;
      }

      const remainingSlots =
        MAX_REFERENCE_IMAGES - referenceImagesRef.current.length;
      if (remainingSlots <= 0) {
        toast({
          title: t('upload.maxImagesReached'),
          variant: 'destructive',
        });
        return;
      }

      isPastingImageRef.current = true;
      setIsPastingImage(true);
      try {
        const newImages = await compressAcceptedImageFiles(
          imageFiles.slice(0, remainingSlots)
        );

        if (newImages.length === 0) {
          return;
        }

        const latestRemainingSlots =
          MAX_REFERENCE_IMAGES - referenceImagesRef.current.length;
        if (latestRemainingSlots <= 0) {
          toast({
            title: t('upload.maxImagesReached'),
            variant: 'destructive',
          });
          return;
        }

        handleImagesChange([
          ...referenceImagesRef.current,
          ...newImages.slice(0, latestRemainingSlots),
        ]);
        textareaRef.current?.focus();
      } catch {
        toast({
          title: t('upload.compressFailed'),
          variant: 'destructive',
        });
      } finally {
        isPastingImageRef.current = false;
        setIsPastingImage(false);
      }
    },
    [handleImagesChange, t, toast]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardFiles = [
        ...Array.from(e.clipboardData.items)
          .filter((item) => item.kind === 'file')
          .map((item) => item.getAsFile())
          .filter((file): file is File => Boolean(file)),
        ...Array.from(e.clipboardData.files),
      ];

      if (!clipboardFiles.some((file) => isAcceptedImageType(file.type))) {
        return;
      }

      e.preventDefault();
      await ingestImageFiles(clipboardFiles);
    },
    [ingestImageFiles]
  );

  const isDisabled =
    !currentProjectId ||
    isTemporaryId(currentProjectId) ||
    !draftPrompt.trim() ||
    isGenerating ||
    isPastingImage;
  const isProjectReady =
    Boolean(currentProjectId) && !isTemporaryId(currentProjectId);

  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragCounterRef = useRef(0);

  const hasImageFilesInDrag = useCallback(
    (dataTransfer: DataTransfer | null) => {
      if (!dataTransfer) return false;
      if (Array.from(dataTransfer.types).includes('Files')) {
        return true;
      }
      return Array.from(dataTransfer.items).some(
        (item) => item.kind === 'file'
      );
    },
    []
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!isProjectReady || isPastingImage) return;
      if (!hasImageFilesInDrag(e.dataTransfer)) return;

      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDraggingImage(true);
      }
    },
    [hasImageFilesInDrag, isPastingImage, isProjectReady]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!isProjectReady || isPastingImage) return;
      if (!hasImageFilesInDrag(e.dataTransfer)) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [hasImageFilesInDrag, isPastingImage, isProjectReady]
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragCounterRef.current > 0) {
      dragCounterRef.current -= 1;
    }
    if (dragCounterRef.current === 0) {
      setIsDraggingImage(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingImage(false);

      if (!isProjectReady || isPastingImage) return;

      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length === 0) return;

      await ingestImageFiles(files);
    },
    [ingestImageFiles, isPastingImage, isProjectReady]
  );

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
                onImageQualityChange={setImageQuality}
                onAspectRatioChange={setAspectRatio}
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
            {imageQuality} · {aspectRatio}
          </div>
        </div>
      </div>
    </div>
  );
}
