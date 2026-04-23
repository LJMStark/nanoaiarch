import { describe, expect, it } from 'vitest';
import { normalizePublicGallerySort } from '../public-gallery';

describe('normalizePublicGallerySort', () => {
  it('keeps latest as the only supported sort order', () => {
    expect(normalizePublicGallerySort('latest')).toBe('latest');
    expect(normalizePublicGallerySort(undefined)).toBe('latest');
  });

  it('downgrades unsupported popular sorting to latest', () => {
    expect(normalizePublicGallerySort('popular')).toBe('latest');
  });
});
