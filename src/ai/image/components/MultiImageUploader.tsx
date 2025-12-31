'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageIcon, Loader2, Plus, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';

// 触发压缩的阈值 4MB（考虑部署平台限制）
const MAX_FILE_SIZE = 4 * 1024 * 1024;
// 压缩目标大小 3MB（留余量给 base64 编码膨胀）
const TARGET_SIZE = 3 * 1024 * 1024;
// 支持的图片格式
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
// 最大图片数量
const MAX_IMAGES = 5;

interface MultiImageUploaderProps {
  onImagesChange: (images: string[]) => void;
  currentImages: string[];
  className?: string;
  disabled?: boolean;
  maxImages?: number;
}

/**
 * 压缩图片到指定大小（使用迭代避免栈溢出）
 */
async function compressImage(
  file: File,
  targetSize: number = TARGET_SIZE
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;

        // 如果图片很大，先缩小尺寸
        const maxDimension = 4096;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // 迭代压缩直到满足大小要求
        let currentQuality = 0.9;
        let currentScale = 1;
        let base64 = '';

        while (true) {
          const scaledWidth = Math.round(width * currentScale);
          const scaledHeight = Math.round(height * currentScale);

          canvas.width = scaledWidth;
          canvas.height = scaledHeight;
          ctx.clearRect(0, 0, scaledWidth, scaledHeight);
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

          const dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
          base64 = dataUrl.split(',')[1];
          const size = Math.round((base64.length * 3) / 4);

          if (
            size <= targetSize ||
            currentQuality <= 0.1 ||
            currentScale <= 0.3
          ) {
            break;
          }

          if (currentQuality > 0.5) {
            currentQuality -= 0.1;
          } else {
            currentScale -= 0.1;
          }
        }

        resolve(base64);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

  // 处理文件选择
  const handleFiles = useCallback(
    async (files: FileList) => {
      setError(null);

      const remainingSlots = maxImages - currentImages.length;
      if (remainingSlots <= 0) {
        setError(t('maxImagesReached'));
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const newImages: string[] = [];

      setIsCompressing(true);
      try {
        for (const file of filesToProcess) {
          // 验证文件类型
          if (!ACCEPTED_TYPES.includes(file.type)) {
            continue;
          }

          let base64: string;
          if (file.size > MAX_FILE_SIZE) {
            // 压缩大文件
            base64 = await compressImage(file);
          } else {
            // 读取小文件
            base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const result = e.target?.result as string;
                resolve(result.split(',')[1]);
              };
              reader.onerror = () => reject(new Error('Failed to read file'));
              reader.readAsDataURL(file);
            });
          }

          newImages.push(base64);
        }

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
                src={`data:image/png;base64,${image}`}
                alt={`Reference ${index + 1}`}
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
        accept={ACCEPTED_TYPES.join(',')}
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
