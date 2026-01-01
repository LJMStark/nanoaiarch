import { HeaderSection } from '@/components/layout/header-section';
import { SubscriptionStylePricing } from '@/components/pricing/subscription-style-pricing';
import { useTranslations } from 'next-intl';

export default function PricingSection() {
  const t = useTranslations('HomePage.pricing');

  return (
    <section id="pricing" className="px-4 py-16">
      <div className="mx-auto max-w-7xl px-6 space-y-16">
        <HeaderSection
          subtitle={t('subtitle')}
          subtitleAs="h2"
          subtitleClassName="text-4xl font-bold"
          description={t('description')}
          descriptionAs="p"
        />

        <SubscriptionStylePricing />
      </div>
    </section>
  );
}
