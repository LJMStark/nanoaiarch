import { beforeEach, describe, expect, it, vi } from 'vitest';
import { S3Provider } from '../s3';

const mocks = vi.hoisted(() => ({
  putObject: vi.fn(),
}));

vi.mock('s3mini', () => ({
  S3mini: vi.fn().mockImplementation(function S3mini() {
    return {
      putObject: mocks.putObject,
    };
  }),
}));

describe('S3Provider', () => {
  beforeEach(() => {
    mocks.putObject.mockReset();
    mocks.putObject.mockResolvedValue({ ok: true });
  });

  it('uploads immutable objects with cache-control metadata', async () => {
    const provider = new S3Provider({
      region: 'auto',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      bucketName: 'bucket',
      publicUrl: 'https://cdn.example.com',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    const result = await provider.uploadFile({
      file: Buffer.from('image'),
      filename: 'image.png',
      contentType: 'image/png',
      folder: 'generated/project-1',
    });

    expect(mocks.putObject).toHaveBeenCalledWith(
      expect.stringMatching(/^generated\/project-1\/.+\.png$/),
      Buffer.from('image'),
      'image/png',
      undefined,
      { 'Cache-Control': 'public, max-age=31536000, immutable' }
    );
    expect(result.url).toMatch(
      /^https:\/\/cdn\.example\.com\/generated\/project-1\/.+\.png$/
    );
  });

  it('omits Cache-Control header when no cacheControl is configured', async () => {
    const provider = new S3Provider({
      region: 'auto',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      bucketName: 'bucket',
    });

    await provider.uploadFile({
      file: Buffer.from('image'),
      filename: 'image.png',
      contentType: 'image/png',
    });

    expect(mocks.putObject).toHaveBeenCalledWith(
      expect.any(String),
      Buffer.from('image'),
      'image/png',
      undefined,
      undefined
    );
  });
});
