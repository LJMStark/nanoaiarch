export type PublicGallerySort = 'latest';

export function normalizePublicGallerySort(
  sortBy?: string | null
): PublicGallerySort {
  return sortBy === 'latest' ? 'latest' : 'latest';
}
