import { afterEach, describe, expect, it, vi } from 'vitest';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage'
);

describe('conversation-store SSR storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    if (originalLocalStorageDescriptor) {
      Object.defineProperty(
        globalThis,
        'localStorage',
        originalLocalStorageDescriptor
      );
    }
  });

  it('does not log storage errors when localStorage is unavailable', async () => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(import('../conversation-store')).resolves.toBeDefined();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
