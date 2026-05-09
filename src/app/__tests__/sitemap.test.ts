import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/navigation', () => ({
  getLocalePathname: ({ href }: { href: string }) => href,
}));

vi.mock('@/i18n/routing', () => ({
  routing: {
    locales: ['zh'],
    defaultLocale: 'zh',
  },
}));

vi.mock('@/lib/hreflang', () => ({
  generateHreflangUrls: (href: string) => ({
    'zh-CN': `https://nanoaiarch.com${href}`,
  }),
}));

vi.mock('@/lib/source', () => ({
  blogSource: { getPages: vi.fn(() => []) },
  categorySource: { getPages: vi.fn(() => []) },
  source: { generateParams: vi.fn(() => []) },
}));

describe('sitemap', () => {
  it('does not include removed marketing routes', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://nanoaiarch.com';
    const { default: sitemap } = await import('../sitemap');
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).not.toContain('https://nanoaiarch.com/waitlist');
    expect(urls).not.toContain('https://nanoaiarch.com/changelog');
  });
});
