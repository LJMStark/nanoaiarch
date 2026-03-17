import { HeaderSection } from '@/components/layout/header-section';
import { SubscriptionStylePricing } from '@/components/pricing/subscription-style-pricing';
import { useTranslations } from 'next-intl';

export default function PricingSection() {
  const t = useTranslations('HomePage.pricing');

  return (
    <section id="pricing" className="px-4 py-16">
      <div className="mx-auto max-w-7xl space-y-12">
        <HeaderSection
          className="mx-auto items-center text-center"
          subtitle={t('subtitle')}
          subtitleAs="h2"
          subtitleClassName="text-4xl sm:text-5xl"
          description={t('description')}
          descriptionAs="p"
        />

        <div className="surface-panel rounded-[2rem] px-4 py-6 sm:px-6 sm:py-8">
          <SubscriptionStylePricing />
        </div>
      </div>
    </section>
  );
}
