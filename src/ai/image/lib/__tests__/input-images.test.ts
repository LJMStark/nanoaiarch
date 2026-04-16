import { describe, expect, it } from 'vitest';
import { getOptionalInputImages, resolveInputImages } from '../input-images';

describe('resolveInputImages', () => {
  it('deduplicates and trims input images while keeping the fallback image', () => {
    expect(
      resolveInputImages(['  image-a  ', 'image-b', 'image-a'], 'image-c')
    ).toEqual(['image-a', 'image-b', 'image-c']);
  });

  it('returns the fallback image when the input image list is empty', () => {
    expect(resolveInputImages([], 'image-a')).toEqual(['image-a']);
  });
});

describe('getOptionalInputImages', () => {
  it('returns undefined when no input images are available', () => {
    expect(getOptionalInputImages([], null)).toBeUndefined();
  });
});
