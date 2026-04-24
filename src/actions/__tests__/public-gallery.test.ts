import { normalizePublicGallerySort } from '@/lib/public-gallery';
import { describe, expect, it } from 'vitest';

describe('normalizePublicGallerySort', () => {
  it('keeps latest as the only supported sort order', () => {
    expect(normalizePublicGallerySort('latest')).toBe('latest');
    expect(normalizePublicGallerySort(undefined)).toBe('latest');
  });

  it('downgrades unsupported popular sorting to latest', () => {
    expect(normalizePublicGallerySort('popular')).toBe('latest');
  });
});
