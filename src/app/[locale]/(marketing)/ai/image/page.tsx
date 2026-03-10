import { ConversationLayout } from '@/ai/image/components/conversation';
import { PendingReferralRecovery } from '@/components/auth/pending-referral-recovery';
import { Skeleton } from '@/components/ui/skeleton';
import { routing } from '@/i18n/routing';
import { constructMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/server';
import { Routes } from '@/routes';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const pt = await getTranslations({ locale, namespace: 'ArchPage' });

  return constructMetadata({
    title: pt('hero.title') + ' | ' + t('title'),
    description: pt('hero.subtitle'),
    locale,
    pathname: '/ai/image',
  });
}

function LoadingFallback() {
  return (
    <div className="flex h-screen">
      <div className="w-64 border-r p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b px-4 flex items-center">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
        <div className="h-32 border-t p-4">
          <Skeleton className="h-16 w-full max-w-3xl mx-auto rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function getLocaleHref(locale: Locale, route: string): string {
  return locale === routing.defaultLocale ? route : `/${locale}${route}`;
}

export default async function AIImagePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const session = await getSession();

  if (!session?.user) {
    const loginSearchParams = new URLSearchParams({
      callbackUrl: getLocaleHref(locale, Routes.AIImage),
    });
    redirect(
      `${getLocaleHref(locale, Routes.Login)}?${loginSearchParams.toString()}`
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <PendingReferralRecovery />
      <ConversationLayout />
    </Suspense>
  );
}
