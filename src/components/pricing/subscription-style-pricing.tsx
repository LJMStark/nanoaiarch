'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from 'next-intl';
import { CreditPricingTable } from './credit-pricing-table';
import { FlexibleTopupTable } from './flexible-topup-table';

interface SubscriptionStylePricingProps {
  userId?: string;
  className?: string;
}

export function SubscriptionStylePricing({
  userId,
  className,
}: SubscriptionStylePricingProps) {
  const t = useTranslations('Pricing');

  return (
    <div className={className}>
      {/* 一次性购买声明 — zpay 不支持自动续费，明确告知避免误导 */}
      <div className="mb-8 flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-300">
        <span>💎</span>
        <span>一次性购买，无自动续费，到期后手动续购</span>
      </div>

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
