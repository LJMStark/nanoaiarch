import { routing } from '@/i18n/routing';
import { logger } from '@/lib/logger';
import type { Locale } from 'next-intl';

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

function isPrivateHostname(hostname: string): boolean {
  return (
    isLocalHostname(hostname) ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function allowLocalProductionBaseUrl(): boolean {
  return process.env.ALLOW_LOCAL_BASE_URL_IN_PRODUCTION === 'true';
}

function getConfiguredBaseUrl(): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_BASE_URL is required in production');
    }

    return `http://localhost:${process.env.PORT ?? 3000}`;
  }

  let url: URL;
  try {
    url = new URL(configuredBaseUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_BASE_URL must be a valid absolute URL');
  }

  if (process.env.NODE_ENV === 'production') {
    const isAllowedLocal = allowLocalProductionBaseUrl();

    if (url.protocol !== 'https:' && !isAllowedLocal) {
      throw new Error('NEXT_PUBLIC_BASE_URL must use https in production');
    }

    if (isPrivateHostname(url.hostname) && !isAllowedLocal) {
      throw new Error(
        'NEXT_PUBLIC_BASE_URL must be a public hostname in production'
      );
    }
  }

  return url.origin;
}

/**
 * Get the base URL of the application
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  return getConfiguredBaseUrl();
}

/**
 * Check if the locale should be appended to the URL
 */
export function shouldAppendLocale(locale?: Locale | null): boolean {
  return !!locale && locale !== routing.defaultLocale && locale !== 'default';
}

/**
 * Get the URL of the application with the locale appended
 */
export function getUrlWithLocale(url: string, locale?: Locale | null): string {
  const baseUrl = getBaseUrl();

  return shouldAppendLocale(locale)
    ? `${baseUrl}/${locale}${url}`
    : `${baseUrl}${url}`;
}

/**
 * Adds locale to the callbackURL parameter in authentication URLs
 *
 * Example:
 * Input: http://localhost:3000/api/auth/reset-password/token?callbackURL=/auth/reset-password
 * Output: http://localhost:3000/api/auth/reset-password/token?callbackURL=/zh/auth/reset-password
 *
 * Input: http://localhost:3000/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9&callbackURL=/dashboard
 * Output: http://localhost:3000/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9&callbackURL=/zh/dashboard
 *
 * @param url - The original URL with callbackURL parameter
 * @param locale - The locale to add to the callbackURL
 * @returns The URL with locale added to callbackURL if necessary
 */
export function getUrlWithLocaleInCallbackUrl(
  url: string,
  locale: Locale
): string {
  // If we shouldn't append locale, return original URL
  if (!shouldAppendLocale(locale)) {
    return url;
  }

  try {
    // Parse the URL
    const urlObj = new URL(url);

    // Check if there's a callbackURL parameter
    const callbackURL = urlObj.searchParams.get('callbackURL');

    if (callbackURL) {
      // Only modify the callbackURL if it doesn't already include the locale
      if (!callbackURL.match(new RegExp(`^/${locale}(/|$)`))) {
        // Add locale to the callbackURL
        const localizedCallbackURL = callbackURL.startsWith('/')
          ? `/${locale}${callbackURL}`
          : `/${locale}/${callbackURL}`;

        // Update the search parameter
        urlObj.searchParams.set('callbackURL', localizedCallbackURL);
      }
    }

    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return the original URL
    logger.general.warn('Failed to parse URL for locale insertion', {
      error,
      url,
    });
    return url;
  }
}

/**
 * Get the URL of the image, if the image is a relative path, it will be prefixed with the base URL
 * @param image - The image URL
 * @returns The URL of the image
 */
export function getImageUrl(image: string): string {
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  if (image.startsWith('/')) {
    return `${getBaseUrl()}${image}`;
  }
  return `${getBaseUrl()}/${image}`;
}

/**
 * Get the Stripe dashboard customer URL
 * @param customerId - The Stripe customer ID
 * @returns The Stripe dashboard customer URL
 */
export function getStripeDashboardCustomerUrl(customerId: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `https://dashboard.stripe.com/test/customers/${customerId}`;
  }
  return `https://dashboard.stripe.com/customers/${customerId}`;
}
