import { beforeEach, describe, expect, it, vi } from 'vitest';
import { S3Provider } from '../s3';

const mocks = vi.hoisted(() => ({
  signedRequest: vi.fn(),
  putObject: vi.fn(),
}));

vi.mock('s3mini', () => ({
  s3mini: vi.fn().mockImplementation(function s3mini() {
    return {
      _signedRequest: mocks.signedRequest,
      putObject: mocks.putObject,
    };
  }),
}));

describe('S3Provider', () => {
  beforeEach(() => {
    mocks.signedRequest.mockReset();
    mocks.putObject.mockReset();
    mocks.signedRequest.mockResolvedValue({ ok: true });
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

    expect(mocks.signedRequest).toHaveBeenCalledWith(
      'PUT',
      expect.stringMatching(/^generated\/project-1\/.+\.png$/),
      expect.objectContaining({
        body: Buffer.from('image'),
        headers: expect.objectContaining({
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': 5,
          'Content-Type': 'image/png',
        }),
        tolerated: [200],
      })
    );
    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(result.url).toMatch(
      /^https:\/\/cdn\.example\.com\/generated\/project-1\/.+\.png$/
    );
  });
});
