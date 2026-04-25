import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/actions/image-project', () => ({
  archiveProject: vi.fn(),
  deleteImageProject: vi.fn(),
  toggleProjectPin: vi.fn(),
  updateImageProject: vi.fn(),
}));

import { updateImageProject } from '@/actions/image-project';
import { MAX_BASE64_IMAGE_CHARS } from '@/ai/image/lib/api-utils';
import { POST } from '../route';

const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';
const JPEG_MAGIC_BASE64 = '/9j/';

function buildMaxSizedJpegDataUrl(): string {
  return `${JPEG_DATA_URL_PREFIX}${JPEG_MAGIC_BASE64}${'A'.repeat(MAX_BASE64_IMAGE_CHARS - JPEG_MAGIC_BASE64.length)}`;
}

describe('/api/image/projects/actions POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects protected project fields in update payloads', async () => {
    const response = await POST(
      new Request('http://localhost/api/image/projects/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          projectId: 'project-1',
          data: {
            title: 'ok',
            userId: 'victim-user-id',
            messageCount: 999,
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(updateImageProject).not.toHaveBeenCalled();
  });

  it('passes only allowlisted update fields to the server action', async () => {
    vi.mocked(updateImageProject).mockResolvedValue({ success: true });

    const response = await POST(
      new Request('http://localhost/api/image/projects/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          projectId: 'project-1',
          data: {
            title: 'New title',
            aspectRatio: '16:9',
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(updateImageProject).toHaveBeenCalledWith('project-1', {
      title: 'New title',
      aspectRatio: '16:9',
    });
  });

  it('passes data URL cover images at the base64 size limit', async () => {
    const coverImage = buildMaxSizedJpegDataUrl();
    vi.mocked(updateImageProject).mockResolvedValue({ success: true });

    const response = await POST(
      new Request('http://localhost/api/image/projects/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          projectId: 'project-1',
          data: {
            coverImage,
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(updateImageProject).toHaveBeenCalledWith('project-1', {
      coverImage,
    });
  });
});
