import type { Locale, Messages } from 'next-intl';
import { routing } from './routing';

// Project is China-only — defaultMessages source is zh.json.
// Used by app/manifest.ts (PWA), email templates, page metadata,
// and Discord notifications.
export { default as defaultMessages } from '../../messages/zh.json';

const importLocale = async (locale: Locale): Promise<Messages> => {
  return (await import(`../../messages/${locale}.json`)).default as Messages;
};

export const getDefaultMessages = async (): Promise<Messages> => {
  return await importLocale(routing.defaultLocale);
};

/**
 * Returns messages for the requested locale.
 *
 * For a multi-locale app, this previously deep-merged the requested locale
 * over the default-locale fallback to backstop missing keys. With only `zh`
 * supported there is nothing to merge, so we return the locale messages
 * directly.
 */
export const getMessagesForLocale = async (
  locale: Locale
): Promise<Messages> => {
  return await importLocale(locale);
};
