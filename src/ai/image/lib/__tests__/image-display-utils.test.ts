import {
  buildImageProxyUrl,
  downloadImage,
  fetchImageBlob,
} from '@/ai/image/lib/image-display-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('image-display-utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:mock-url'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads fetched blobs through a temporary anchor element', async () => {
    const blob = new Blob(['image'], { type: 'image/png' });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    } as unknown as Response);

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await downloadImage('https://example.com/image.png', 'generated.png');

    expect(fetchMock).toHaveBeenCalledWith(
      buildImageProxyUrl('https://example.com/image.png')
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalledTimes(1);

    const link = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(link.download).toBe('generated.png');
    expect(link.href).toBe('blob:mock-url');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(link);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('throws when fetching the image fails', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      blob: vi.fn(),
    } as unknown as Response);

    await expect(
      fetchImageBlob('https://example.com/image.png')
    ).rejects.toThrow('Failed to fetch image: 403');
  });

  it('builds a same-origin proxy url for remote images', () => {
    expect(buildImageProxyUrl('https://example.com/image.png')).toBe(
      '/api/image/proxy?url=https%3A%2F%2Fexample.com%2Fimage.png'
    );
  });
});
