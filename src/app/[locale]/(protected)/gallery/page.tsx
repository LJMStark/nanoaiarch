'use client';

import {
  type GenerationHistoryItem,
  deleteGeneration,
  getGenerationHistory,
  toggleFavorite,
  togglePublic,
} from '@/actions/generation-history';
import { shareImage, urlToBase64 } from '@/ai/image/lib/image-helpers';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import {
  Download,
  Eye,
  EyeOff,
  Globe,
  Grid3X3,
  Heart,
  List,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

export default function GalleryPage() {
  const t = useTranslations('Gallery');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';

  const [generations, setGenerations] = useState<GenerationHistoryItem[]>([]);
  const [filteredGenerations, setFilteredGenerations] = useState<
    GenerationHistoryItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedGeneration, setSelectedGeneration] =
    useState<GenerationHistoryItem | null>(null);

  const dateLocale = locale === 'zh' ? zhCN : enUS;

  const breadcrumbs = [{ label: t('title'), isCurrentPage: true }];

  useEffect(() => {
    const fetchGenerations = async () => {
      const result = await getGenerationHistory({ limit: 100 });
      if (result.success) {
        setGenerations(result.data);
        setFilteredGenerations(result.data);
      }
      setLoading(false);
    };
    fetchGenerations();
  }, []);

  useEffect(() => {
    let filtered = generations;

    // Filter by tab
    if (activeTab === 'favorites') {
      filtered = filtered.filter((g) => g.isFavorite);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.prompt.toLowerCase().includes(query) ||
          g.templateName?.toLowerCase().includes(query) ||
          g.style?.toLowerCase().includes(query)
      );
    }

    setFilteredGenerations(filtered);
  }, [generations, activeTab, searchQuery]);

  const handleToggleFavorite = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const handleTogglePublic = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    startTransition(async () => {
      const result = await togglePublic(id);
      if (result.success) {
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === id ? { ...g, isPublic: result.isPublic ?? false } : g
          )
        );
        // Update selected generation if it's the one being toggled
        if (selectedGeneration?.id === id) {
          setSelectedGeneration((prev) =>
            prev ? { ...prev, isPublic: result.isPublic ?? false } : null
          );
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteGeneration(id);
      if (result.success) {
        setGenerations((prev) => prev.filter((g) => g.id !== id));
        setSelectedGeneration(null);
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
      a.download = `forma-ai-${prompt.slice(0, 20).replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleShare = async (imageUrl: string, prompt: string) => {
    if (!imageUrl) return;

    try {
      const base64 = await urlToBase64(imageUrl);
      await shareImage(base64, prompt);
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />

      <div className="flex flex-1 flex-col p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>

          <Button asChild>
            <a href="/ai/image">
              <Sparkles className="mr-2 size-4" />
              {t('newGeneration')}
            </a>
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
              <TabsTrigger value="favorites">{t('tabs.favorites')}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>

            <div className="flex items-center rounded-md border">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="size-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div
            className={cn(
              'grid gap-4',
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            )}
          >
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredGenerations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Sparkles className="size-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-medium">{t('empty.title')}</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              {activeTab === 'favorites'
                ? t('empty.noFavorites')
                : searchQuery
                  ? t('empty.noResults')
                  : t('empty.description')}
            </p>
            {!searchQuery && activeTab !== 'favorites' && (
              <Button className="mt-6" asChild>
                <a href="/ai/image">{t('empty.cta')}</a>
              </Button>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'grid gap-4',
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            )}
          >
            {filteredGenerations.map((generation) => (
              <Card
                key={generation.id}
                className={cn(
                  'group cursor-pointer overflow-hidden transition-all hover:shadow-lg',
                  viewMode === 'list' && 'flex flex-row'
                )}
                onClick={() => setSelectedGeneration(generation)}
              >
                {/* Image */}
                <div
                  className={cn(
                    'relative overflow-hidden bg-muted',
                    viewMode === 'grid' ? 'aspect-square' : 'w-32 h-32 shrink-0'
                  )}
                >
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

                  {/* Status indicators */}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {generation.isPublic && (
                      <div className="rounded-full bg-black/50 p-1">
                        <Globe className="size-4 text-white" />
                      </div>
                    )}
                    {generation.isFavorite && (
                      <Heart className="size-5 fill-red-500 text-red-500 drop-shadow" />
                    )}
                  </div>
                </div>

                {/* Info */}
                <CardContent
                  className={cn(
                    'p-3',
                    viewMode === 'list' && 'flex-1 flex flex-col justify-center'
                  )}
                >
                  <p className="line-clamp-2 text-sm font-medium">
                    {generation.prompt}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {generation.templateName && (
                      <Badge
                        variant="secondary"
                        className="text-xs truncate max-w-[120px]"
                      >
                        {generation.templateName}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(generation.createdAt), {
                        addSuffix: true,
                        locale: dateLocale,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog
          open={!!selectedGeneration}
          onOpenChange={() => setSelectedGeneration(null)}
        >
          <DialogContent className="max-w-4xl">
            {selectedGeneration && (
              <>
                <DialogHeader>
                  <DialogTitle>{t('detail.title')}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    {selectedGeneration.imageUrl ? (
                      <Image
                        src={selectedGeneration.imageUrl}
                        alt={selectedGeneration.prompt}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Sparkles className="size-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-col">
                    <div className="space-y-4 flex-1">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">
                          {t('detail.prompt')}
                        </h4>
                        <p className="mt-1">{selectedGeneration.prompt}</p>
                      </div>

                      {selectedGeneration.templateName && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">
                            {t('detail.template')}
                          </h4>
                          <Badge variant="secondary" className="mt-1">
                            {selectedGeneration.templateName}
                          </Badge>
                        </div>
                      )}

                      {selectedGeneration.style && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">
                            {t('detail.style')}
                          </h4>
                          <p className="mt-1">{selectedGeneration.style}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">
                          {t('detail.createdAt')}
                        </h4>
                        <p className="mt-1">
                          {format(
                            new Date(selectedGeneration.createdAt),
                            'PPpp',
                            {
                              locale: dateLocale,
                            }
                          )}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">
                          {t('detail.credits')}
                        </h4>
                        <p className="mt-1">{selectedGeneration.creditsUsed}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-6 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={(e) =>
                          handleToggleFavorite(selectedGeneration.id, e)
                        }
                        disabled={isPending}
                      >
                        {selectedGeneration.isFavorite ? (
                          <>
                            <Heart className="mr-2 size-4 fill-red-500 text-red-500" />
                            {t('detail.unfavorite')}
                          </>
                        ) : (
                          <>
                            <Heart className="mr-2 size-4" />
                            {t('detail.favorite')}
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={(e) =>
                          handleTogglePublic(selectedGeneration.id, e)
                        }
                        disabled={isPending}
                      >
                        {selectedGeneration.isPublic ? (
                          <>
                            <EyeOff className="mr-2 size-4" />
                            {t('detail.makePrivate')}
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 size-4" />
                            {t('detail.makePublic')}
                          </>
                        )}
                      </Button>

                      {selectedGeneration.imageUrl && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleDownload(
                              selectedGeneration.imageUrl!,
                              selectedGeneration.prompt
                            )
                          }
                        >
                          <Download className="mr-2 size-4" />
                          {t('detail.download')}
                        </Button>
                      )}

                      {selectedGeneration.imageUrl && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleShare(
                              selectedGeneration.imageUrl!,
                              selectedGeneration.prompt
                            )
                          }
                        >
                          <Share2 className="mr-2 size-4" />
                          {t('detail.share')}
                        </Button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                            <Trash2 className="mr-2 size-4" />
                            {t('detail.delete')}
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
                              onClick={() =>
                                handleDelete(selectedGeneration.id)
                              }
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
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
