import FaqSection from '@/components/blocks/faqs/faqs';
import Container from '@/components/layout/container';
import { PricingTable } from '@/components/pricing/pricing-table';
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
    <Container className="mt-8 max-w-6xl px-4 flex flex-col gap-16">
      <PricingTable />

      <FaqSection />
    </Container>
  );
}
