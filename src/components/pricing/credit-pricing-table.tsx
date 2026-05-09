'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { websiteConfig } from '@/config/website';
import type { CreditPackageInterval, CreditPackageTier } from '@/credits/types';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CreditPricingCard } from './credit-pricing-card';
import { FreeTierCard } from './free-tier-card';

interface CreditPricingTableProps {
  userId?: string;
  className?: string;
}

const TIERS: CreditPackageTier[] = ['basic', 'standard', 'pro'];

/**
 * Subscription-style membership table laid out as 4 columns:
 *   [非会员] [黄金会员] [铂金会员] [钻石会员]
 *
 * The interval toggle (按月 / 按年) only affects the paid columns;
 * the free tier is constant. Quarter packages were retired — only month
 * and year intervals are exposed in the UI.
 *
 * Backend reality vs UX: zpay does not support recurring billing, so each
 * "subscription" purchase is a one-time charge under the hood. The UI is
 * intentionally framed as a subscription to match user expectations and
 * simplify migration when a recurring-capable provider is wired in later.
 */
export function CreditPricingTable({
  userId,
  className,
}: CreditPricingTableProps) {
  const t = useTranslations('CreditPricing');
  const [interval, setInterval] = useState<CreditPackageInterval>('month');

  const packages = websiteConfig.credits.packages;

  const hasMonthly = Object.values(packages).some(
    (p) => p.interval === 'month'
  );
  const hasYearly = Object.values(packages).some((p) => p.interval === 'year');

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {/* Interval toggle — defaults to monthly */}
      {(hasMonthly || hasYearly) && (
        <div className="flex justify-center">
          <ToggleGroup
            size="lg"
            type="single"
            value={interval}
            onValueChange={(value) =>
              value && setInterval(value as CreditPackageInterval)
            }
            className="rounded-full border border-border/70 bg-background/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
          >
            {hasMonthly && (
              <ToggleGroupItem
                value="month"
                className={cn(
                  'min-h-11 cursor-pointer rounded-full px-6 py-2 text-sm font-medium',
                  'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                  'data-[state=off]:hover:bg-muted'
                )}
              >
                {t('monthly')}
              </ToggleGroupItem>
            )}
            {hasYearly && (
              <ToggleGroupItem
                value="year"
                className={cn(
                  'min-h-11 cursor-pointer rounded-full px-6 py-2 text-sm font-medium',
                  'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                  'data-[state=off]:hover:bg-muted'
                )}
              >
                {t('yearly')}
              </ToggleGroupItem>
            )}
          </ToggleGroup>
        </div>
      )}

      {/* 4-column membership grid: free + 3 tiers */}
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <FreeTierCard />

        {TIERS.map((tier) => {
          const pkg = Object.values(packages).find(
            (p) => p.tier === tier && p.interval === interval && !p.disabled
          );

          if (!pkg) return null;

          return (
            <CreditPricingCard
              key={`${tier}-${interval}`}
              package={pkg}
              userId={userId}
              isPopular={pkg.popular}
            />
          );
        })}
      </div>
    </div>
  );
}
