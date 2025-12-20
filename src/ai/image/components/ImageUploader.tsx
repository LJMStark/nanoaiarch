'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageIcon, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void;
  onImageClear: () => void;
  currentImage?: string;
  className?: string;
  disabled?: boolean;
}

// 最大文件大小 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// 支持的图片格式
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function ImageUploader({
  onImageSelect,
  onImageClear,
  currentImage,
  className,
  disabled = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      // 验证文件类型
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Please select a valid image file (PNG, JPG, WebP, or GIF)');
        return;
      }

      // 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        setError('File size must be less than 10MB');
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
        setError('Failed to read file');
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  // 处理拖拽事件
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  // 处理点击上传
  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

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
          Click X to remove and upload a different image
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
          disabled && 'cursor-not-allowed opacity-50',
          !disabled &&
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
          {isDragging ? (
            <Upload className="h-10 w-10 text-primary" />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragging ? 'Drop image here' : 'Upload an image to edit'}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag and drop or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP, GIF up to 10MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
