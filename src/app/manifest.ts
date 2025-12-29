import { defaultMessages } from '@/i18n/messages';
import type { MetadataRoute } from 'next';

/**
 * Generates the Web App Manifest for the application
 *
 * generated file name: manifest.webmanifest
 *
 * ref: https://github.com/amannn/next-intl/blob/main/examples/example-app-router/src/app/manifest.ts
 *
 * The manifest.json provides metadata used when the web app is installed on a
 * user's mobile device or desktop. See https://web.dev/add-manifest/
 *
 * Since the manifest file needs to be placed in the root of the app folder (outside the [locale] dynamic segment),
 * you need to provide a locale explicitly since next-intl can’t infer it from the pathname.
 *
 * Solution: use the default messages (get from the default locale)
 *
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#manifest
 *
 * @returns {MetadataRoute.Manifest} The manifest configuration object
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: defaultMessages.Metadata.name,
    short_name: defaultMessages.Metadata.name,
    description: defaultMessages.Metadata.description,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['productivity', 'design', 'utilities'],
    icons: [
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
