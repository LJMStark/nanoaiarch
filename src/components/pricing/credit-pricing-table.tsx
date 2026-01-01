'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { websiteConfig } from '@/config/website';
import type { CreditPackageInterval, CreditPackageTier } from '@/credits/types';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CreditPricingCard } from './credit-pricing-card';

interface CreditPricingTableProps {
  userId?: string;
  className?: string;
}

/**
 * Credit Pricing Table with subscription-style layout
 *
 * Displays credit packages in a tier-based layout (Basic/Standard/Pro)
 * with billing interval toggle (Monthly/Quarterly/Yearly)
 */
export function CreditPricingTable({
  userId,
  className,
}: CreditPricingTableProps) {
  const t = useTranslations('CreditPricing');
  const [interval, setInterval] = useState<CreditPackageInterval>('quarter'); // Default to quarterly (best value)

  const packages = websiteConfig.credits.packages;

  // Get unique tiers
  const tiers: CreditPackageTier[] = ['basic', 'standard', 'pro'];

  // Check which intervals are available
  const hasMonthly = Object.values(packages).some(
    (p) => p.interval === 'month'
  );
  const hasQuarterly = Object.values(packages).some(
    (p) => p.interval === 'quarter'
  );
  const hasYearly = Object.values(packages).some((p) => p.interval === 'year');

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {/* Interval Toggle - X style with "Best Value" badge */}
      {(hasMonthly || hasQuarterly || hasYearly) && (
        <div className="flex justify-center">
          <ToggleGroup
            size="lg"
            type="single"
            value={interval}
            onValueChange={(value) =>
              value && setInterval(value as CreditPackageInterval)
            }
            className="border rounded-lg p-1 bg-muted/30"
          >
            {hasYearly && (
              <ToggleGroupItem
                value="year"
                className={cn(
                  'px-6 py-2 cursor-pointer text-sm font-medium rounded-md relative',
                  'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                  'data-[state=off]:hover:bg-muted'
                )}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span>{t('yearly')}</span>
                  {interval === 'year' && (
                    <span className="text-xs opacity-90">{t('bestValue')}</span>
                  )}
                </div>
              </ToggleGroupItem>
            )}
            {hasQuarterly && (
              <ToggleGroupItem
                value="quarter"
                className={cn(
                  'px-6 py-2 cursor-pointer text-sm font-medium rounded-md',
                  'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                  'data-[state=off]:hover:bg-muted'
                )}
              >
                {t('quarterly')}
              </ToggleGroupItem>
            )}
            {hasMonthly && (
              <ToggleGroupItem
                value="month"
                className={cn(
                  'px-6 py-2 cursor-pointer text-sm font-medium rounded-md',
                  'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                  'data-[state=off]:hover:bg-muted'
                )}
              >
                {t('monthly')}
              </ToggleGroupItem>
            )}
          </ToggleGroup>
        </div>
      )}

      {/* Pricing Cards Grid - 3 columns for tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
        {tiers.map((tier) => {
          // Find package for this tier and interval
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

      {/* Free Plan Info */}
      <div className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
        <p>
          {t('freeInfo', {
            credits: websiteConfig.credits.registerGiftCredits.amount,
          })}
        </p>
      </div>
    </div>
  );
}
