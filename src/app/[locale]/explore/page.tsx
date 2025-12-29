'use client';

import {
  type PublicGeneration,
  getAvailableStyles,
  getAvailableTemplates,
  getPublicGenerations,
} from '@/actions/public-gallery';
import {
  ExploreDetail,
  ExploreFilters,
  ExploreGrid,
} from '@/components/explore';
import Container from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Compass, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

export default function ExplorePage() {
  const t = useTranslations('Explore');

  // Data state
  const [generations, setGenerations] = useState<PublicGeneration[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>(
    []
  );

  // Filter state
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Detail modal state
  const [selectedGeneration, setSelectedGeneration] =
    useState<PublicGeneration | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Load filter options
  useEffect(() => {
    const loadFilters = async () => {
      const [stylesResult, templatesResult] = await Promise.all([
        getAvailableStyles(),
        getAvailableTemplates(),
      ]);
      setStyles(stylesResult);
      setTemplates(templatesResult);
    };
    loadFilters();
  }, []);

  // Load generations
  const loadGenerations = useCallback(
    async (pageNum: number, append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const result = await getPublicGenerations({
        page: pageNum,
        pageSize: 20,
        style: selectedStyle || undefined,
        template: selectedTemplate || undefined,
        sortBy,
      });

      if (result.success) {
        setGenerations((prev) =>
          append ? [...prev, ...result.data] : result.data
        );
        setTotalPages(result.totalPages);
      }

      setIsLoading(false);
      setIsLoadingMore(false);
    },
    [selectedStyle, selectedTemplate, sortBy]
  );

  // Initial load and filter changes
  useEffect(() => {
    setPage(1);
    loadGenerations(1, false);
  }, [loadGenerations]);

  // Handle load more
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadGenerations(nextPage, true);
  };

  // Handle card click
  const handleCardClick = (generation: PublicGeneration) => {
    setSelectedGeneration(generation);
    setIsDetailOpen(true);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setSelectedStyle(null);
    setSelectedTemplate(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Container className="py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('title')}</h1>
              <p className="text-muted-foreground">{t('description')}</p>
            </div>
          </div>

          {/* Filters */}
          <ExploreFilters
            styles={styles}
            templates={templates}
            selectedStyle={selectedStyle}
            selectedTemplate={selectedTemplate}
            sortBy={sortBy}
            onStyleChange={setSelectedStyle}
            onTemplateChange={setSelectedTemplate}
            onSortChange={setSortBy}
            onClear={handleClearFilters}
          />
        </div>

        {/* Grid */}
        <ExploreGrid
          generations={generations}
          isLoading={isLoading}
          onCardClick={handleCardClick}
        />

        {/* Load more */}
        {!isLoading && page < totalPages && (
          <div className="flex justify-center mt-8">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="min-w-[120px]"
            >
              {isLoadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('loadMore')
              )}
            </Button>
          </div>
        )}
      </Container>

      {/* Detail modal */}
      <ExploreDetail
        generation={selectedGeneration}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
