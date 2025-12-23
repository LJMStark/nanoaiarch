'use client';

// Generation result display canvas
// 生成结果展示画布 - 与主站风格一致

import { BorderBeam } from '@/components/magicui/border-beam';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Coins,
  Download,
  Loader2,
  Maximize2,
  Share2,
} from 'lucide-react';
import { motion } from 'motion/react';
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

interface GenerationCanvasProps {
  image: ImageResult | null;
  error: ImageError | null;
  timing: ProviderTiming | null;
  isLoading: boolean;
  activePrompt: string;
  lastCreditsUsed: number | null;
  onFullscreen?: () => void;
  className?: string;
}

export function GenerationCanvas({
  image,
  error,
  timing,
  isLoading,
  activePrompt,
  lastCreditsUsed,
  onFullscreen,
  className,
}: GenerationCanvasProps) {
  const t = useTranslations('ArchPage');
  const [isHovering, setIsHovering] = useState(false);

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

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'relative flex flex-col items-center justify-center min-h-[400px]',
          'bg-muted/30 rounded-2xl border border-dashed overflow-hidden',
          className
        )}
      >
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-primary/20 animate-pulse" />
          <Loader2 className="absolute inset-0 m-auto h-12 w-12 text-primary animate-spin" />
        </div>
        <p className="mt-6 font-medium text-lg">{t('canvas.generating')}</p>
        {timing?.startTime && (
          <div className="mt-2 text-sm text-muted-foreground">
            <Stopwatch startTime={timing.startTime} />
          </div>
        )}
        <p className="mt-4 text-sm text-muted-foreground max-w-md text-center px-4">
          {activePrompt.slice(0, 150)}
          {activePrompt.length > 150 && '...'}
        </p>
        <BorderBeam
          duration={6}
          size={200}
          className="from-transparent via-primary/40 to-transparent"
        />
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center min-h-[400px]',
          'bg-destructive/5 rounded-xl border border-destructive/20',
          className
        )}
      >
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="font-medium text-destructive">{t('canvas.error')}</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md text-center">
          {error.message}
        </p>
      </div>
    );
  }

  // No image state
  if (!image) {
    return null;
  }

  // Image display
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
      className={cn('relative group', className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Image container */}
      <div className="relative rounded-2xl overflow-hidden bg-muted border border-border/50">
        <Image
          src={`data:image/png;base64,${image.image}`}
          alt={activePrompt}
          width={1024}
          height={768}
          className="w-full h-auto"
        />

        {/* Overlay with actions */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity',
            isHovering ? 'opacity-100' : 'opacity-0'
          )}
        >
          {/* Top bar - metadata */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
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
          <div className="absolute inset-0 flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="h-5 w-5" />
              {t('canvas.download')}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleShare}
              className="gap-2"
            >
              <Share2 className="h-5 w-5" />
              {t('canvas.share')}
            </Button>
            {onFullscreen && (
              <Button variant="secondary" size="icon" onClick={onFullscreen}>
                <Maximize2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Text description if available */}
      {image.text && (
        <div className="mt-4 p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">{image.text}</p>
        </div>
      )}

      {/* BorderBeam on hover */}
      {isHovering && (
        <BorderBeam
          duration={4}
          size={200}
          className="from-transparent via-primary/50 to-transparent"
        />
      )}
    </motion.div>
  );
}
