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
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
          <TabsTrigger value="plans" className="text-base">
            {t('tabs.plans')}
          </TabsTrigger>
          <TabsTrigger value="topup" className="text-base relative">
            {t('tabs.topup')}
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
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
