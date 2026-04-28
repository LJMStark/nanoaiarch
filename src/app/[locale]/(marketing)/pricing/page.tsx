import FaqSection from '@/components/blocks/faqs/faqs';
import Container from '@/components/layout/container';
import { SubscriptionStylePricing } from '@/components/pricing/subscription-style-pricing';
import { LOCALES } from '@/i18n/routing';
import { setRequestLocale } from 'next-intl/server';

/**
 * Generate static params for all locales
 * This enables static generation for the pricing page
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

interface PricingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Container className="mt-8 flex max-w-7xl flex-col gap-16 px-4">
      <div className="surface-panel rounded-[2rem] px-4 py-6 sm:px-6 sm:py-8">
        <SubscriptionStylePricing />
      </div>

      <FaqSection />
    </Container>
  );
}
