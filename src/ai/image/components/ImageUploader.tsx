'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void;
  onImageClear: () => void;
  currentImage?: string;
  className?: string;
  disabled?: boolean;
}

// 触发压缩的阈值 4MB（考虑部署平台限制）
const MAX_FILE_SIZE = 4 * 1024 * 1024;
// 压缩目标大小 3MB（留余量给 base64 编码膨胀）
const TARGET_SIZE = 3 * 1024 * 1024;
// 支持的图片格式
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * 压缩图片到指定大小
 */
async function compressImage(
  file: File,
  targetSize: number = TARGET_SIZE
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      // 计算压缩参数
      let { width, height } = img;
      const quality = 0.9;

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
      const compress = (
        currentQuality: number,
        currentScale: number
      ): string => {
        const scaledWidth = Math.round(width * currentScale);
        const scaledHeight = Math.round(height * currentScale);

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        ctx.clearRect(0, 0, scaledWidth, scaledHeight);
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

        // 使用 JPEG 格式压缩（压缩率更好）
        const dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        const base64 = dataUrl.split(',')[1];
        const size = Math.round((base64.length * 3) / 4);

        if (
          size <= targetSize ||
          currentQuality <= 0.1 ||
          currentScale <= 0.3
        ) {
          return base64;
        }

        // 继续降低质量或尺寸
        if (currentQuality > 0.5) {
          return compress(currentQuality - 0.1, currentScale);
        }
        return compress(currentQuality, currentScale - 0.1);
      };

      try {
        const result = compress(quality, 1);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function ImageUploader({
  onImageSelect,
  onImageClear,
  currentImage,
  className,
  disabled = false,
}: ImageUploaderProps) {
  const t = useTranslations('ArchPage.upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // 验证文件类型
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(t('invalidType'));
        return;
      }

      // 如果文件过大，自动压缩
      if (file.size > MAX_FILE_SIZE) {
        setIsCompressing(true);
        try {
          const compressedBase64 = await compressImage(file);
          onImageSelect(compressedBase64);
        } catch {
          setError(t('compressFailed'));
        } finally {
          setIsCompressing(false);
        }
        return;
      }

      // 读取文件为 base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // 移除 data:image/xxx;base64, 前缀
        const base64 = result.split(',')[1];
        onImageSelect(base64);
      };
      reader.onerror = () => {
        setError(t('readFailed'));
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect, t]
  );

  // 处理拖拽事件
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !isCompressing) {
        setIsDragging(true);
      }
    },
    [disabled, isCompressing]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isCompressing) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, isCompressing, handleFile]
  );

  // 处理点击上传
  const handleClick = useCallback(() => {
    if (!disabled && !isCompressing) {
      fileInputRef.current?.click();
    }
  }, [disabled, isCompressing]);

  // 处理文件输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // 重置 input 以允许重新选择相同文件
      e.target.value = '';
    },
    [handleFile]
  );

  // 如果已有图片，显示预览
  if (currentImage) {
    return (
      <div className={cn('relative', className)}>
        <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
          <Image
            src={`data:image/png;base64,${currentImage}`}
            alt="Uploaded image"
            fill
            className="object-cover"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8"
            onClick={onImageClear}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('removeHint')}
        </p>
      </div>
    );
  }

  // 上传区域
  return (
    <div className={className}>
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
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />

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
                  {t('fileTypes')}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
