import { betterFetch } from '@better-fetch/fetch';
import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE_NAME,
  routing,
} from './i18n/routing';
import type { Session } from './lib/auth-types';
import { logger } from './lib/logger';
import {
  DEFAULT_LOGIN_REDIRECT,
  protectedRoutes,
  routesNotAllowedByLoggedInUsers,
} from './routes';

const intlMiddleware = createMiddleware(routing);

/**
 * Get the base URL from the request headers
 * This ensures we use the correct port even if it changes
 */
function getBaseUrlFromRequest(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

/**
 * 1. Next.js proxy (formerly middleware)
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 *
 * 2. Better Auth middleware
 * https://www.better-auth.com/docs/integrations/next#middleware
 *
 * In Next.js proxy, it's recommended to only check for the existence of a session cookie
 * to handle redirection. To avoid blocking requests by making API or database calls.
 */
export default async function proxy(req: NextRequest) {
  const { nextUrl } = req;
  logger.general.debug('middleware start', { pathname: nextUrl.pathname });

  // Handle internal docs link redirection for internationalization
  // Check if this is a docs page without locale prefix
  if (nextUrl.pathname.startsWith('/docs/') || nextUrl.pathname === '/docs') {
    // Get the user's preferred locale from cookie
    const localeCookie = req.cookies.get(LOCALE_COOKIE_NAME);
    const preferredLocale = localeCookie?.value;

    // If user has a non-default locale preference, redirect to localized version
    if (
      preferredLocale &&
      preferredLocale !== DEFAULT_LOCALE &&
      LOCALES.includes(preferredLocale)
    ) {
      const localizedPath = `/${preferredLocale}${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      logger.general.debug('redirecting docs link to preferred locale', {
        localizedPath,
      });
      return NextResponse.redirect(new URL(localizedPath, nextUrl));
    }
  }

  // do not use getSession() here, it will cause error related to edge runtime
  // const session = await getSession();
  let isLoggedIn = false;
  try {
    const { data: session } = await betterFetch<Session>(
      '/api/auth/get-session',
      {
        baseURL: getBaseUrlFromRequest(req),
        headers: {
          cookie: req.headers.get('cookie') || '', // Forward the cookies from the request
        },
      }
    );
    isLoggedIn = !!session;
  } catch (error) {
    // Fetch failed - likely during initial server startup or port mismatch
    // Treat as not logged in and continue with intl middleware
    logger.general.warn('Session fetch failed, treating as not logged in', {
      error,
    });
  }
  // console.log('middleware, isLoggedIn', isLoggedIn);

  // Get the pathname of the request (e.g. /zh/dashboard to /dashboard)
  const pathnameWithoutLocale = getPathnameWithoutLocale(
    nextUrl.pathname,
    LOCALES
  );

  // If the route can not be accessed by logged in users, redirect if the user is logged in
  if (isLoggedIn) {
    const isNotAllowedRoute = routesNotAllowedByLoggedInUsers.some((route) =>
      new RegExp(`^${route}$`).test(pathnameWithoutLocale)
    );
    if (isNotAllowedRoute) {
      logger.general.debug(
        'not allowed route, already logged in, redirecting to dashboard'
      );
      return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
    }
  }

  const isProtectedRoute = protectedRoutes.some((route) =>
    new RegExp(`^${route}$`).test(pathnameWithoutLocale)
  );
  // console.log('middleware, isProtectedRoute', isProtectedRoute);

  // If the route is a protected route, redirect to login if user is not logged in
  if (!isLoggedIn && isProtectedRoute) {
    let callbackUrl = nextUrl.pathname;
    if (nextUrl.search) {
      callbackUrl += nextUrl.search;
    }
    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    logger.general.debug('not logged in, redirecting to login', {
      callbackUrl,
    });
    return NextResponse.redirect(
      new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
    );
  }

  // Apply intlMiddleware for all routes
  logger.general.debug('applying intlMiddleware');
  return intlMiddleware(req);
}

// Note: In Next.js 16, proxy.ts runs on Node.js runtime only (not Edge)
// If you need Edge runtime, keep using middleware.ts

/**
 * Get the pathname of the request (e.g. /zh/dashboard to /dashboard)
 */
function getPathnameWithoutLocale(pathname: string, locales: string[]): string {
  const localePattern = new RegExp(`^/(${locales.join('|')})/`);
  return pathname.replace(localePattern, '/');
}

/**
 * Next.js internationalized routing
 * specify the routes the middleware applies to
 *
 * https://next-intl.dev/docs/routing#base-path
 */
export const config = {
  // The `matcher` is relative to the `basePath`
  matcher: [
    // Match all pathnames except for
    // - if they start with `/api`, `/_next` or `/_vercel`
    // - if they contain a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
