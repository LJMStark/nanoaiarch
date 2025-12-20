'use client';

// Quick Action Card - Fast generation input card
// 快速操作卡片 - 快速生成输入卡片

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Coins, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useRef, type KeyboardEvent } from 'react';
import type { AspectRatioId, StylePresetId } from '../../lib/arch-types';
import { getCreditCost } from '../../lib/credit-costs';
import type { GeminiModelId } from '../../lib/provider-config';
import { AspectRatioSelect } from '../AspectRatioSelect';
import { StylePresetSelect } from '../StylePresetSelect';
import { BentoCard } from './BentoCard';
import { BENTO_PRESETS } from './BentoGrid';

interface QuickActionCardProps {
  // Prompt state
  promptValue: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;

  // Reference image
  referenceImage: string | null;
  onImageUpload: (image: string) => void;
  onImageClear: () => void;

  // Style and aspect ratio
  stylePreset: StylePresetId | null;
  onStyleChange: (preset: StylePresetId | null) => void;
  aspectRatio: AspectRatioId;
  onAspectRatioChange: (ratio: AspectRatioId) => void;

  // Model for credits calculation
  selectedModel: GeminiModelId;

  // Loading state
  isLoading: boolean;

  className?: string;
}

/**
 * QuickActionCard - Fast generation input card
 *
 * Features:
 * - Compact prompt input textarea
 * - Image upload with preview
 * - Style and aspect ratio selectors
 * - Generate button with credits indicator
 */
export function QuickActionCard({
  promptValue,
  onPromptChange,
  onSubmit,
  referenceImage,
  onImageUpload,
  onImageClear,
  stylePreset,
  onStyleChange,
  aspectRatio,
  onAspectRatioChange,
  selectedModel,
  isLoading,
  className,
}: QuickActionCardProps) {
  const t = useTranslations('ArchPage');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) return;

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) return;

      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const imageData = base64.includes(',') ? base64.split(',')[1] : base64;
        onImageUpload(imageData);
      };
      reader.readAsDataURL(file);
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

  const creditCost = getCreditCost(selectedModel);

  return (
    <BentoCard
      variant="gradient"
      animate
      animationDelay={0.1}
      hoverGlow={false}
      hoverScale={false}
      className={cn(
        BENTO_PRESETS.quickAction,
        'flex flex-col min-h-[280px]',
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

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Quick Generate</span>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col gap-3">
        {/* Prompt input row */}
        <div className="flex gap-2">
          {/* Image upload / preview */}
          <div className="flex-shrink-0">
            {referenceImage ? (
              <div className="relative group">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/50">
                  <Image
                    src={`data:image/png;base64,${referenceImage}`}
                    alt="Reference"
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={onImageClear}
                  className={cn(
                    'absolute -top-1.5 -right-1.5',
                    'w-5 h-5 rounded-full',
                    'bg-destructive text-destructive-foreground',
                    'flex items-center justify-center',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'text-xs'
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'w-14 h-14 rounded-xl',
                  'border-2 border-dashed border-border/50',
                  'flex items-center justify-center',
                  'hover:border-primary/50 hover:bg-primary/5',
                  'transition-colors'
                )}
              >
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Textarea */}
          <Textarea
            value={promptValue}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('controls.prompt')}
            className={cn(
              'flex-1 min-h-[56px] max-h-[100px] resize-none',
              'bg-background/50 dark:bg-background/30',
              'border-border/50',
              'placeholder:text-muted-foreground/60',
              'text-sm rounded-xl'
            )}
            disabled={isLoading}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
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

          {/* Generate button */}
          <Button
            onClick={onSubmit}
            disabled={isLoading || !promptValue.trim()}
            size="sm"
            className="gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">{t('controls.generating')}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{t('controls.generate')}</span>
                <span className="flex items-center gap-0.5 text-xs opacity-70">
                  <Coins className="h-3 w-3" />
                  {creditCost}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Subtle hint */}
      <p className="text-xs text-muted-foreground/60 mt-2">
        Press Enter to generate, Shift+Enter for new line
      </p>
    </BentoCard>
  );
}
