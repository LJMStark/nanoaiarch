import { unstable_cache } from 'next/cache';
import { cache } from 'react';

/**
 * Cache durations in seconds
 */
export const CACHE_DURATIONS = {
  /** Short-lived cache for frequently changing data (1 minute) */
  SHORT: 60,
  /** Medium cache for semi-static data (5 minutes) */
  MEDIUM: 300,
  /** Long cache for rarely changing data (1 hour) */
  LONG: 3600,
  /** Static cache for configuration data (24 hours) */
  STATIC: 86400,
} as const;

/**
 * Cache tags for revalidation
 */
export const CACHE_TAGS = {
  USER_CREDITS: 'user-credits',
  USER_PLAN: 'user-plan',
  PRICE_PLANS: 'price-plans',
  PUBLIC_GALLERY: 'public-gallery',
  BLOG_POSTS: 'blog-posts',
  PROJECT_STATS: 'project-stats',
} as const;

/**
 * Create a cached function with Next.js unstable_cache
 * Use for data that can be shared across requests
 */
export function createCachedFn<
  T extends (...args: Parameters<T>) => Promise<ReturnType<T>>,
>(
  fn: T,
  keyParts: string[],
  options: {
    revalidate?: number;
    tags?: string[];
  } = {}
) {
  return unstable_cache(fn, keyParts, {
    revalidate: options.revalidate ?? CACHE_DURATIONS.MEDIUM,
    tags: options.tags,
  });
}

/**
 * Create a request-scoped cached function with React cache
 * Use for data that should be deduplicated within a single request
 */
export function createRequestCache<
  T extends (...args: Parameters<T>) => ReturnType<T>,
>(fn: T): T {
  return cache(fn) as T;
}
