import { CustomPage } from '@/components/page/custom-page';
import { LOCALES } from '@/i18n/routing';
import { constructMetadata } from '@/lib/metadata';
import { pagesSource } from '@/lib/source';
import type { NextPageProps } from '@/types/next-page-props';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

/**
 * Generate static params for all locales
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const page = pagesSource.getPage(['privacy-policy'], locale);

  if (!page) {
    console.warn(
      `generateMetadata, page not found for privacy-policy, locale: ${locale}`
    );
    return {};
  }

  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return constructMetadata({
    title: page.data.title + ' | ' + t('title'),
    description: page.data.description,
    locale,
    pathname: '/privacy',
  });
}

export default async function PrivacyPolicyPage(props: NextPageProps) {
  const params = await props.params;
  if (!params) {
    notFound();
  }

  const locale = params.locale as string;
  setRequestLocale(locale);
  const page = pagesSource.getPage(['privacy-policy'], locale);

  if (!page) {
    notFound();
  }

  return <CustomPage page={page} />;
}
