'use client';

import type { PublicGeneration } from '@/actions/public-gallery';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface ExploreDetailProps {
  generation: PublicGeneration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExploreDetail({
  generation,
  open,
  onOpenChange,
}: ExploreDetailProps) {
  const t = useTranslations('Explore');
  const locale = useLocale();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!generation) return null;

  const initials = generation.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generation.prompt);
      setCopied(true);
      toast({ title: t('promptCopied') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t('copyFailed'), variant: 'destructive' });
    }
  };

  const handleDownload = async () => {
    if (!generation.imageUrl) return;

    try {
      const response = await fetch(generation.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arch-ai-${generation.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t('downloadStarted') });
    } catch {
      toast({ title: t('downloadFailed'), variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/explore/${generation.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this AI creation',
          text: generation.prompt,
          url: shareUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: t('linkCopied') });
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('viewCreation')}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="relative aspect-square bg-muted">
            {generation.imageUrl ? (
              <Image
                src={generation.imageUrl}
                alt={generation.prompt}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 flex flex-col">
            {/* User info */}
            <Link
              href={`/u/${generation.user.id}`}
              className="flex items-center gap-3 mb-6 hover:opacity-80 transition-opacity group/user"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={generation.user.image || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium group-hover/user:text-primary transition-colors">
                  {generation.user.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(generation.createdAt)}
                </p>
              </div>
            </Link>

            {/* Prompt */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t('prompt')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="h-8 gap-1"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {t('copy')}
                </Button>
              </div>
              <p className="text-sm leading-relaxed mb-4">
                {generation.prompt}
              </p>

              {/* Metadata */}
              <div className="flex flex-wrap gap-2 mb-6">
                {generation.style && (
                  <Badge variant="secondary">{generation.style}</Badge>
                )}
                {generation.templateName && (
                  <Badge variant="outline">{generation.templateName}</Badge>
                )}
                {generation.aspectRatio && (
                  <Badge variant="outline">{generation.aspectRatio}</Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                {t('download')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-1"
              >
                <Share2 className="h-4 w-4" />
                {t('share')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
