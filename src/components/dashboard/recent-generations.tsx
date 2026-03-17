'use client';

import {
  type GenerationHistoryItem,
  deleteGeneration,
  getGenerationHistory,
  toggleFavorite,
} from '@/actions/generation-history';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import { Download, Heart, Sparkles, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState, useTransition } from 'react';

export function RecentGenerations() {
  const t = useTranslations('Dashboard.recentGenerations');
  const locale = useLocale();
  const [generations, setGenerations] = useState<GenerationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const fetchGenerations = async () => {
      const result = await getGenerationHistory({ limit: 8 });
      if (result.success) {
        setGenerations(result.data);
      }
      setLoading(false);
    };
    fetchGenerations();
  }, []);

  const handleToggleFavorite = (id: string) => {
    startTransition(async () => {
      const result = await toggleFavorite(id);
      if (result.success) {
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === id ? { ...g, isFavorite: result.isFavorite ?? false } : g
          )
        );
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteGeneration(id);
      if (result.success) {
        setGenerations((prev) => prev.filter((g) => g.id !== id));
      }
    });
  };

  const handleDownload = async (imageUrl: string, prompt: string) => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arch-ai-${prompt.slice(0, 20).replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const dateLocale = locale === 'zh' ? zhCN : enUS;

  if (loading) {
    return (
      <Card className="mx-4 border-white/40 bg-background/55 lg:mx-6">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (generations.length === 0) {
    return (
      <Card className="mx-4 border-white/40 bg-background/55 lg:mx-6">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-8" />
            </div>
            <h3 className="text-xl font-medium tracking-[-0.03em]">
              {t('empty.title')}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {t('empty.description')}
            </p>
            <Button className="mt-5" asChild>
              <a href="/ai/image">{t('empty.cta')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-4 border-white/40 bg-background/55 lg:mx-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('title')}</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <a href="/gallery">{t('viewAll')}</a>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {generations.map((generation) => (
            <div
              key={generation.id}
              className="group relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/50"
            >
              {/* Image */}
              <div className="relative aspect-square overflow-hidden bg-muted">
                {generation.imageUrl ? (
                  <Image
                    src={generation.imageUrl}
                    alt={generation.prompt}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Sparkles className="size-8 text-muted-foreground/30" />
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/55 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={() => handleToggleFavorite(generation.id)}
                      disabled={isPending}
                    >
                      {generation.isFavorite ? (
                        <Heart className="size-4 fill-red-500 text-red-500" />
                      ) : (
                        <Heart className="size-4" />
                      )}
                    </Button>

                    <div className="flex gap-1">
                      {generation.imageUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white hover:bg-white/20"
                          onClick={() =>
                            handleDownload(
                              generation.imageUrl!,
                              generation.prompt
                            )
                          }
                        >
                          <Download className="size-4" />
                        </Button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white hover:bg-white/20 hover:text-red-400"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t('deleteDialog.title')}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('deleteDialog.description')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t('deleteDialog.cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(generation.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('deleteDialog.confirm')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="line-clamp-2 text-sm font-medium leading-6 tracking-[-0.01em]">
                  {generation.prompt}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  {generation.templateName && (
                    <Badge variant="secondary" className="text-xs">
                      {generation.templateName}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(generation.createdAt), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
