'use client';

import type { PublicGeneration } from '@/actions/public-gallery';
import { ExploreCard, ExploreCardSkeleton } from './ExploreCard';

interface ExploreGridProps {
  generations: PublicGeneration[];
  isLoading?: boolean;
  onCardClick: (generation: PublicGeneration) => void;
}

export function ExploreGrid({
  generations,
  isLoading,
  onCardClick,
}: ExploreGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <ExploreCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-1">No creations yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Be the first to share your architectural visualizations with the
          community
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {generations.map((generation, index) => (
        <ExploreCard
          key={generation.id}
          generation={generation}
          index={index}
          onClick={() => onCardClick(generation)}
        />
      ))}
    </div>
  );
}
