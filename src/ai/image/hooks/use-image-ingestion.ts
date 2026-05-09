'use client';

import { validateBase64Image } from '@/ai/image/lib/api-utils';
import {
  compressAcceptedImageFiles,
  isAcceptedImageType,
} from '@/ai/image/lib/image-compress';
import { MAX_REFERENCE_IMAGES } from '@/ai/image/lib/input-images';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

/**
 * Encapsulates the "user gave me an image" path for the conversation
 * input — paste, drag-drop, and the explicit upload picker — into a
 * single hook (Week 4.3).
 *
 * Why extract: ConversationInput.tsx had grown to 484 lines mixing
 * text input, image ingestion, drag UX, and submit. The image side has
 * its own state machine (validation -> compression -> drag overlay)
 * that's logically self-contained, easier to test in isolation, and
 * paves the way for adding new image sources (camera, URL paste, etc.)
 * without touching the input component.
 *
 * The hook owns:
 *   - referenceImages (the array bound to the eventual generation request)
 *   - imageError (last validation error, displayed under the picker)
 *   - isPastingImage (true while compression is in flight; disables submit)
 *   - isDraggingImage (true while a file drag hovers the input area)
 *   - paste / drag / drop event handlers
 *
 * The owning component still controls the submit pipeline and the
 * "show upload picker" toggle.
 */
export interface UseImageIngestionOptions {
  /**
   * Whether the surrounding project is in a state that accepts images.
   * Drag/drop is no-op when false (avoids confusing UX where dropping
   * onto a temp project silently does nothing).
   */
  isProjectReady: boolean;
  /**
   * Called after a successful ingest (compressed images appended to
   * referenceImages). Used by the parent to focus the textarea so the
   * user can keep typing without a click.
   */
  onAfterIngest?: () => void;
}

export interface UseImageIngestionResult {
  referenceImages: string[];
  /**
   * React's full Dispatch<SetStateAction<...>> shape so callers can use
   * either array form (`setReferenceImages([])`) or functional updater
   * form (`setReferenceImages((current) => current.filter(...))`).
   */
  setReferenceImages: Dispatch<SetStateAction<string[]>>;
  imageError: string | null;
  clearImageError: () => void;
  isPastingImage: boolean;
  isDraggingImage: boolean;
  handleImagesChange: (images: string[]) => void;
  ingestImageFiles: (files: File[]) => Promise<void>;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => Promise<void>;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void>;
}

export function useImageIngestion({
  isProjectReady,
  onAfterIngest,
}: UseImageIngestionOptions): UseImageIngestionResult {
  const t = useTranslations('ArchPage');
  const { toast } = useToast();

  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPastingImage, setIsPastingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // Refs mirror state for use inside async/event handlers without
  // capturing stale values.
  const referenceImagesRef = useRef(referenceImages);
  const isPastingImageRef = useRef(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  /**
   * Maps validation errors from validateBase64Image() into the
   * locale-appropriate user-facing message. Keep this map small —
   * specific cases first, generic fallback last.
   */
  const getImageValidationError = useCallback(
    (error?: string): string => {
      if (!error) return t('errors.imageTooLarge');
      const normalized = error.toLowerCase();
      if (normalized.includes('invalid url')) return t('errors.invalidUrl');
      if (normalized.includes('来源未被允许')) return t('errors.invalidUrl');
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

  const handleImagesChange = useCallback(
    (images: string[]) => {
      // Validate every entry before committing — a single bad blob
      // poisons the whole array.
      for (const image of images) {
        const validation = validateBase64Image(image);
        if (!validation.valid) {
          setImageError(getImageValidationError(validation.error));
          return;
        }
      }
      setImageError(null);
      setReferenceImages(images);
    },
    [getImageValidationError]
  );

  const ingestImageFiles = useCallback(
    async (files: File[]) => {
      // De-dup + filter to image MIME types upfront. Browsers occasionally
      // hand the same File object via multiple drag events.
      const imageFiles = files.filter((file, index, list) => {
        return isAcceptedImageType(file.type) && list.indexOf(file) === index;
      });

      if (imageFiles.length === 0) return;
      if (isPastingImageRef.current) return;

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
        if (newImages.length === 0) return;

        // Re-check slot count after the await — another paste/drag could
        // have landed during compression.
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
        onAfterIngest?.();
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
    [handleImagesChange, onAfterIngest, t, toast]
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

      // preventDefault so the textarea doesn't also paste the file path
      // as text.
      e.preventDefault();
      await ingestImageFiles(clipboardFiles);
    },
    [ingestImageFiles]
  );

  const hasImageFilesInDrag = useCallback(
    (dataTransfer: DataTransfer | null) => {
      if (!dataTransfer) return false;
      if (Array.from(dataTransfer.types).includes('Files')) return true;
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
      if (dragCounterRef.current === 1) setIsDraggingImage(true);
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
    if (dragCounterRef.current > 0) dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDraggingImage(false);
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

  const clearImageError = useCallback(() => setImageError(null), []);

  return {
    referenceImages,
    setReferenceImages,
    imageError,
    clearImageError,
    isPastingImage,
    isDraggingImage,
    handleImagesChange,
    ingestImageFiles,
    handlePaste,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
