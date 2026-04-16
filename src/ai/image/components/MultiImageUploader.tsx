'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageIcon, Loader2, Plus, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import {
  ACCEPTED_IMAGE_TYPES,
  compressAcceptedImageFiles,
} from '../lib/image-compress';

// 最大图片数量
const MAX_IMAGES = 5;

interface MultiImageUploaderProps {
  onImagesChange: (images: string[]) => void;
  currentImages: string[];
  className?: string;
  disabled?: boolean;
  maxImages?: number;
}

export function MultiImageUploader({
  onImagesChange,
  currentImages,
  className,
  disabled = false,
  maxImages = MAX_IMAGES,
}: MultiImageUploaderProps) {
  const t = useTranslations('ArchPage.upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = currentImages.length < maxImages;

  // 处理文件选择 — 始终通过 Canvas 压缩确保 Gemini API 兼容
  const handleFiles = useCallback(
    async (files: FileList) => {
      setError(null);

      const remainingSlots = maxImages - currentImages.length;
      if (remainingSlots <= 0) {
        setError(t('maxImagesReached'));
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      setIsCompressing(true);
      try {
        const newImages = await compressAcceptedImageFiles(filesToProcess);
        if (newImages.length > 0) {
          onImagesChange([...currentImages, ...newImages]);
        }
      } catch {
        setError(t('compressFailed'));
      } finally {
        setIsCompressing(false);
      }
    },
    [currentImages, maxImages, onImagesChange, t]
  );

  // 移除图片
  const handleRemove = useCallback(
    (index: number) => {
      const newImages = currentImages.filter((_, i) => i !== index);
      onImagesChange(newImages);
    },
    [currentImages, onImagesChange]
  );

  // 处理拖拽事件
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !isCompressing && canAddMore) {
        setIsDragging(true);
      }
    },
    [disabled, isCompressing, canAddMore]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isCompressing || !canAddMore) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, isCompressing, canAddMore, handleFiles]
  );

  // 处理点击上传
  const handleClick = useCallback(() => {
    if (!disabled && !isCompressing && canAddMore) {
      fileInputRef.current?.click();
    }
  }, [disabled, isCompressing, canAddMore]);

  // 处理文件输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      e.target.value = '';
    },
    [handleFiles]
  );

  return (
    <div className={className}>
      {/* 已上传的图片预览 */}
      {currentImages.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {currentImages.map((image, index) => (
            <div
              key={index}
              className="relative h-16 w-16 overflow-hidden rounded-lg border bg-muted"
            >
              <Image
                src={
                  image.startsWith('http') || image.startsWith('data:')
                    ? image
                    : `data:image/png;base64,${image}`
                }
                alt={t('referenceImageAlt', { index: index + 1 })}
                fill
                className="object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -right-1 -top-1 h-5 w-5"
                onClick={() => handleRemove(index)}
                disabled={disabled || isCompressing}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* 添加更多按钮 */}
          {canAddMore && (
            <button
              type="button"
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed transition-colors',
                disabled || isCompressing
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:border-primary/50 hover:bg-muted/50'
              )}
              onClick={handleClick}
              disabled={disabled || isCompressing}
            >
              {isCompressing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      )}

      {/* 上传区域（无图片时显示） */}
      {currentImages.length === 0 && (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
            isDragging && 'border-primary bg-primary/5',
            isCompressing && 'border-primary/50 bg-primary/5',
            (disabled || isCompressing) && 'cursor-not-allowed opacity-50',
            !disabled &&
              !isCompressing &&
              'cursor-pointer hover:border-primary/50 hover:bg-muted/50'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            {isCompressing ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : isDragging ? (
              <Upload className="h-10 w-10 text-primary" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isCompressing
                  ? t('compressing')
                  : isDragging
                    ? t('dropHere')
                    : t('uploadToEdit')}
              </p>
              {!isCompressing && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t('dragOrClick')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('multiFileTypes')}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isCompressing}
      />

      {/* 图片数量提示 */}
      {currentImages.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('imageCount', { count: currentImages.length, max: maxImages })}
        </p>
      )}

      {error && (
        <p className="mt-2 text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
