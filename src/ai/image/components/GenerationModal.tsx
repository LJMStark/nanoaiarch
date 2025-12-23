'use client';

// Generation Modal - Modal for generation process and results
// 生成弹窗 - 展示生成过程和结果

import { BorderBeam } from '@/components/magicui/border-beam';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Coins,
  Download,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useState } from 'react';
import { downloadImage, shareImage } from '../lib/image-helpers';
import type {
  ImageError,
  ImageResult,
  ProviderTiming,
} from '../lib/image-types';
import { Stopwatch } from './Stopwatch';

interface GenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Generation state
  image: ImageResult | null;
  error: ImageError | null;
  timing: ProviderTiming | null;
  isLoading: boolean;
  activePrompt: string;
  lastCreditsUsed: number | null;
  // Actions
  onRegenerate?: () => void;
}

/**
 * GenerationModal - Modal for displaying generation process and results
 *
 * Features:
 * - Loading state with animation
 * - Error state with retry option
 * - Result display with download/share actions
 * - Seamless transitions between states
 */
export function GenerationModal({
  open,
  onOpenChange,
  image,
  error,
  timing,
  isLoading,
  activePrompt,
  lastCreditsUsed,
  onRegenerate,
}: GenerationModalProps) {
  const t = useTranslations('ArchPage');

  // Handle download
  const handleDownload = useCallback(async () => {
    if (image?.image) {
      await downloadImage(image.image, 'arch-ai');
    }
  }, [image]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (image?.image) {
      await shareImage(image.image, activePrompt);
    }
  }, [image, activePrompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-3xl w-[95vw] p-0 gap-0 overflow-hidden',
          'bg-background/95 backdrop-blur-xl',
          'border-border/50'
        )}
      >
        {/* Header */}
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-medium">
              <Sparkles className="w-4 h-4 text-primary" />
              {isLoading
                ? t('canvas.generating')
                : error
                  ? t('canvas.error')
                  : 'Generated Image'}
            </DialogTitle>
            {/* Close button is handled by DialogContent */}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-4 pt-2">
          <AnimatePresence mode="wait">
            {isLoading && (
              <LoadingState
                key="loading"
                timing={timing}
                activePrompt={activePrompt}
              />
            )}

            {error && !isLoading && (
              <ErrorState key="error" error={error} onRetry={onRegenerate} />
            )}

            {image && !isLoading && !error && (
              <ResultState
                key="result"
                image={image}
                activePrompt={activePrompt}
                lastCreditsUsed={lastCreditsUsed}
                timing={timing}
                onDownload={handleDownload}
                onShare={handleShare}
                onRegenerate={onRegenerate}
              />
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Loading state component
// 加载状态组件
function LoadingState({
  timing,
  activePrompt,
}: {
  timing: ProviderTiming | null;
  activePrompt: string;
}) {
  const t = useTranslations('ArchPage');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'relative flex flex-col items-center justify-center',
        'min-h-[400px] rounded-xl overflow-hidden',
        'bg-muted/30 border border-dashed'
      )}
    >
      {/* Animated loader */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-primary/20 animate-pulse" />
        <Loader2 className="absolute inset-0 m-auto h-10 w-10 text-primary animate-spin" />
      </div>

      {/* Status text */}
      <p className="mt-6 font-medium text-lg">{t('canvas.generating')}</p>

      {/* Timer */}
      {timing?.startTime && (
        <div className="mt-2 text-sm text-muted-foreground">
          <Stopwatch startTime={timing.startTime} />
        </div>
      )}

      {/* Active prompt preview */}
      <p className="mt-4 text-sm text-muted-foreground max-w-md text-center px-4 line-clamp-2">
        {activePrompt}
      </p>

      {/* Border beam */}
      <BorderBeam
        duration={6}
        size={200}
        className="from-transparent via-primary/40 to-transparent"
      />
    </motion.div>
  );
}

// Error state component
// 错误状态组件
function ErrorState({
  error,
  onRetry,
}: {
  error: ImageError;
  onRetry?: () => void;
}) {
  const t = useTranslations('ArchPage');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'flex flex-col items-center justify-center',
        'min-h-[400px] rounded-xl',
        'bg-destructive/5 border border-destructive/20'
      )}
    >
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <p className="font-medium text-destructive">{t('canvas.error')}</p>
      <p className="mt-2 text-sm text-muted-foreground max-w-md text-center px-4">
        {error.message}
      </p>

      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-6 gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </motion.div>
  );
}

// Result state component
// 结果状态组件
function ResultState({
  image,
  activePrompt,
  lastCreditsUsed,
  timing,
  onDownload,
  onShare,
  onRegenerate,
}: {
  image: ImageResult;
  activePrompt: string;
  lastCreditsUsed: number | null;
  timing: ProviderTiming | null;
  onDownload: () => void;
  onShare: () => void;
  onRegenerate?: () => void;
}) {
  const t = useTranslations('ArchPage');
  const [isHovering, setIsHovering] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Image container */}
      <div
        className="relative rounded-xl overflow-hidden bg-muted group"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <Image
          src={`data:image/png;base64,${image.image}`}
          alt={activePrompt}
          width={1024}
          height={768}
          className="w-full h-auto"
        />

        {/* Hover overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity',
            isHovering ? 'opacity-100' : 'opacity-0'
          )}
        >
          {/* Top bar with metadata */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {lastCreditsUsed && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 text-white text-xs">
                  <Coins className="h-3 w-3" />
                  {lastCreditsUsed}
                </span>
              )}
              {timing?.elapsed && (
                <span className="px-2 py-1 rounded-full bg-black/50 text-white text-xs">
                  {(timing.elapsed / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          {/* Center actions */}
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={onDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {t('canvas.download')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onShare}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              {t('canvas.share')}
            </Button>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Prompt display */}
        <p className="text-sm text-muted-foreground line-clamp-1 flex-1">
          {activePrompt}
        </p>

        {/* Regenerate button */}
        {onRegenerate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            className="gap-2 flex-shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </Button>
        )}
      </div>

      {/* Text description if available */}
      {image.text && (
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">{image.text}</p>
        </div>
      )}
    </motion.div>
  );
}
