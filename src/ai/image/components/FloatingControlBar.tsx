'use client';

// Floating glassmorphism control bar at bottom
// 底部玻璃态悬浮控制栏 - 与主站风格一致

import { BorderBeam } from '@/components/magicui/border-beam';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { Coins, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useRef, type KeyboardEvent } from 'react';
import type { AspectRatioId, StylePresetId } from '../lib/arch-types';
import { getCreditCost } from '../lib/credit-costs';
import type { ImageMode } from '../lib/image-types';
import type { GeminiModelId } from '../lib/provider-config';
import { AspectRatioSelect } from './AspectRatioSelect';
import { StylePresetSelect } from './StylePresetSelect';

interface FloatingControlBarProps {
  // Prompt state
  promptValue: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;

  // Mode and model
  mode: ImageMode;
  selectedModel: GeminiModelId;

  // Reference image (for edit mode)
  referenceImage: string | null;
  onImageUpload: (image: string) => void;
  onImageClear: () => void;

  // Style and aspect ratio
  stylePreset: StylePresetId | null;
  onStyleChange: (preset: StylePresetId | null) => void;
  aspectRatio: AspectRatioId;
  onAspectRatioChange: (ratio: AspectRatioId) => void;

  // Loading state
  isLoading: boolean;

  // Visibility
  className?: string;
}

export function FloatingControlBar({
  promptValue,
  onPromptChange,
  onSubmit,
  mode,
  selectedModel,
  referenceImage,
  onImageUpload,
  onImageClear,
  stylePreset,
  onStyleChange,
  aspectRatio,
  onAspectRatioChange,
  isLoading,
  className,
}: FloatingControlBarProps) {
  const t = useTranslations('ArchPage');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix if present
        const imageData = base64.includes(',') ? base64.split(',')[1] : base64;
        onImageUpload(imageData);
      };
      reader.readAsDataURL(file);

      // Reset input
      e.target.value = '';
    },
    [onImageUpload]
  );

  // Handle keyboard submit
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading && promptValue.trim()) {
          onSubmit();
        }
      }
    },
    [isLoading, promptValue, onSubmit]
  );

  // Get credit cost
  const creditCost = getCreditCost(selectedModel);

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', bounce: 0.3, duration: 0.8, delay: 0.2 }}
      className={cn(
        // Fixed positioning
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        // Enhanced glassmorphism effect - matches main site
        'backdrop-blur-2xl bg-background/70',
        'border border-border/40 rounded-2xl',
        'shadow-2xl shadow-black/10',
        // Dark mode enhancement
        'dark:bg-background/60 dark:border-border/30',
        // Layout
        'w-[calc(100%-2rem)] max-w-3xl',
        'p-4',
        // Overflow for BorderBeam
        'overflow-hidden',
        className
      )}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-end gap-3">
        {/* Image upload / preview */}
        <div className="flex-shrink-0">
          {referenceImage ? (
            // Show preview
            <div className="relative group">
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-border/50">
                <Image
                  src={`data:image/png;base64,${referenceImage}`}
                  alt="Reference"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={onImageClear}
                className={cn(
                  'absolute -top-2 -right-2',
                  'w-5 h-5 rounded-full',
                  'bg-destructive text-destructive-foreground',
                  'flex items-center justify-center',
                  'opacity-0 group-hover:opacity-100 transition-opacity'
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            // Show upload button
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'w-16 h-16 rounded-lg',
                'border-dashed border-2',
                'hover:border-primary hover:bg-primary/5',
                'transition-colors'
              )}
            >
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            </Button>
          )}
        </div>

        {/* Prompt input and controls */}
        <div className="flex-1 space-y-2">
          {/* Textarea */}
          <Textarea
            value={promptValue}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('controls.prompt')}
            className={cn(
              'min-h-[60px] max-h-[120px] resize-none',
              'bg-transparent border-0 focus-visible:ring-0',
              'placeholder:text-muted-foreground/60',
              'text-sm'
            )}
            disabled={isLoading}
          />

          {/* Controls row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StylePresetSelect
                value={stylePreset}
                onChange={onStyleChange}
              />
              <AspectRatioSelect
                value={aspectRatio}
                onChange={onAspectRatioChange}
              />
            </div>

            {/* Generate button with credits */}
            <Button
              onClick={onSubmit}
              disabled={isLoading || !promptValue.trim()}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('controls.generating')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>{t('controls.generate')}</span>
                  <span className="flex items-center gap-1 text-xs opacity-70">
                    <Coins className="h-3 w-3" />
                    {creditCost}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* BorderBeam accent - matches main site style */}
      <BorderBeam
        duration={8}
        size={200}
        className="from-transparent via-primary/30 to-transparent dark:via-primary/20"
      />
    </motion.div>
  );
}
