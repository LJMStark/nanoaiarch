'use client';

/**
 * Lazy-loaded components for AI Image feature
 * These components are loaded on-demand to reduce initial bundle size
 */

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Loading fallback component
function ModalLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Lazy-loaded GenerationModal
 * Only loaded when user triggers image generation
 */
export const LazyGenerationModal = dynamic(
  () =>
    import('./GenerationModal').then((mod) => ({
      default: mod.GenerationModal,
    })),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

/**
 * Lazy-loaded TemplateDetailModal
 * Only loaded when user clicks on a template
 */
export const LazyTemplateDetailModal = dynamic(
  () =>
    import('./TemplateDetailModal').then((mod) => ({
      default: mod.TemplateDetailModal,
    })),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

/**
 * Lazy-loaded HistoryPanel
 * Only loaded when user opens history
 */
export const LazyHistoryPanel = dynamic(
  () => import('./HistoryPanel').then((mod) => ({ default: mod.HistoryPanel })),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

/**
 * Lazy-loaded TemplateGallery
 * Only loaded when user navigates to gallery view
 */
export const LazyTemplateGallery = dynamic(
  () =>
    import('./TemplateGallery').then((mod) => ({
      default: mod.TemplateGallery,
    })),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);
