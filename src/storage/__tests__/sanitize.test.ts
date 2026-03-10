import { resolveSafeUploadFilename, sanitizeStorageFolder } from '../sanitize';

describe('sanitizeStorageFolder', () => {
  it('removes traversal and invalid segments from folder paths', () => {
    expect(sanitizeStorageFolder('../avatars/../../team//drops')).toBe(
      'avatars/team/drops'
    );
  });

  it('returns undefined when no safe folder segments remain', () => {
    expect(sanitizeStorageFolder('../../..')).toBeUndefined();
  });
});

describe('resolveSafeUploadFilename', () => {
  it('keeps only a safe extension derived from the upload', () => {
    expect(
      resolveSafeUploadFilename('../../../avatar.final.png', 'image/png')
    ).toBe('upload.png');
  });

  it('falls back to mime-derived extension when the name is malformed', () => {
    expect(resolveSafeUploadFilename('avatar', 'image/webp')).toBe(
      'upload.webp'
    );
  });
});
