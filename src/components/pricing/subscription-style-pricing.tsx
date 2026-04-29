'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from 'next-intl';
import { CreditPricingTable } from './credit-pricing-table';
import { FlexibleTopupTable } from './flexible-topup-table';

interface SubscriptionStylePricingProps {
  userId?: string;
  className?: string;
}

/**
 * Subscription-style pricing with two modes:
 * 1. Subscription Plans (tier-based with interval toggle)
 * 2. Flexible Top-up (simple credit packages)
 */
export function SubscriptionStylePricing({
  userId,
  className,
}: SubscriptionStylePricingProps) {
  const t = useTranslations('Pricing');

  return (
    <div className={className}>
      <Tabs defaultValue="plans" className="w-full">
        {/* Tab Switcher */}
        <TabsList className="mx-auto mb-12 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="plans" className="min-h-11 text-base">
            {t('tabs.plans')}
          </TabsTrigger>
          <TabsTrigger value="topup" className="relative min-h-11 text-base">
            {t('tabs.topup')}
            <span className="absolute -right-2 -top-2 rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-primary">
              {t('tabs.new')}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Subscription Plans Tab */}
        <TabsContent value="plans" className="mt-0">
          <CreditPricingTable userId={userId} />
        </TabsContent>

        {/* Flexible Top-up Tab */}
        <TabsContent value="topup" className="mt-0">
          <FlexibleTopupTable userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
