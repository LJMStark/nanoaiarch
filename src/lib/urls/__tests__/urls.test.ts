import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = process.env;

async function importUrls() {
  vi.resetModules();
  return import('../urls');
}

function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('getBaseUrl', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_BASE_URL = undefined;
    process.env.ALLOW_LOCAL_BASE_URL_IN_PRODUCTION = undefined;
    process.env.PORT = undefined;
    vi.stubGlobal('window', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it('falls back to localhost outside production', async () => {
    setNodeEnv('test');
    const { getBaseUrl } = await importUrls();

    expect(getBaseUrl()).toBe('http://localhost:3000');
  });

  it('requires NEXT_PUBLIC_BASE_URL in production', async () => {
    setNodeEnv('production');
    const { getBaseUrl } = await importUrls();

    expect(() => getBaseUrl()).toThrow('NEXT_PUBLIC_BASE_URL is required');
  });

  it('rejects an invalid base URL in production', async () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_BASE_URL = 'not a url';
    const { getBaseUrl } = await importUrls();

    expect(() => getBaseUrl()).toThrow('valid absolute URL');
  });

  it('rejects localhost in production unless explicitly allowed', async () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    const { getBaseUrl } = await importUrls();

    expect(() => getBaseUrl()).toThrow('must use https');
  });

  it('rejects private hostnames in production', async () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_BASE_URL = 'https://192.168.1.10';
    const { getBaseUrl } = await importUrls();

    expect(() => getBaseUrl()).toThrow('public hostname');
  });

  it('returns a normalized origin for a valid production URL', async () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_BASE_URL = 'https://nanoaiarch.com/some/path';
    const { getBaseUrl } = await importUrls();

    expect(getBaseUrl()).toBe('https://nanoaiarch.com');
  });

  it('allows localhost for explicit production-mode smoke tests', async () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_BASE_URL = 'http://127.0.0.1:3000';
    process.env.ALLOW_LOCAL_BASE_URL_IN_PRODUCTION = 'true';
    const { getBaseUrl } = await importUrls();

    expect(getBaseUrl()).toBe('http://127.0.0.1:3000');
  });
});
