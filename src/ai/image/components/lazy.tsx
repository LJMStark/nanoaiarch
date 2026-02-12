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


