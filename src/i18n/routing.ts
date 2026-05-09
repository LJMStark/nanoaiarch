import { websiteConfig } from '@/config/website';
import { defineRouting } from 'next-intl/routing';

export const DEFAULT_LOCALE = websiteConfig.i18n.defaultLocale;
export const LOCALES = Object.keys(websiteConfig.i18n.locales);

// The name of the cookie that is used to determine the locale
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/**
 * Next.js internationalized routing
 *
 * https://next-intl.dev/docs/routing
 * https://github.com/amannn/next-intl/blob/main/examples/example-app-router/src/i18n/routing.ts
 */
export const routing = defineRouting({
  // A list of all locales that are supported (China-only: zh).
  locales: LOCALES,
  // Default locale when no locale matches
  defaultLocale: DEFAULT_LOCALE,
  // No locale negotiation: a single supported locale (zh) is always used.
  // https://next-intl.dev/docs/routing/middleware#locale-detection
  localeDetection: false,
  // Cookie kept for compatibility with Better Auth's email URL injection;
  // value is effectively always 'zh' under the current locale set.
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
  },
  // No /zh/ prefix in URLs since there is only one locale.
  // https://next-intl.dev/docs/routing#locale-prefix
  localePrefix: 'never',
});
