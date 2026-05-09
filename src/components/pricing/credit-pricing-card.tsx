'use client';

import { Button } from '@/components/ui/button';
import type { CreditPackage } from '@/credits/types';
import { useCurrentUser } from '@/hooks/use-auth';
import { useMounted } from '@/hooks/use-mounted';
import { useLocalePathname } from '@/i18n/navigation';
import { formatPrice } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { Check, Flame } from 'lucide-react';
import { useMessages, useTranslations } from 'next-intl';
import { LoginWrapper } from '../auth/login-wrapper';
import { CreditCheckoutButton } from '../settings/credits/credit-checkout-button';
import { Badge } from '../ui/badge';

interface CreditPricingCardProps {
  package: CreditPackage;
  userId?: string;
  className?: string;
  isPopular?: boolean;
}

/**
 * Compute the display discount label, e.g. 5900 of 6900 → "8.5折".
 *
 * In Chinese commercial UX, 折扣 represents the multiplier of original price:
 * 8.5折 = pay 85% = 15% off.
 */
function computeDiscountLabel(
  amount: number,
  originalPrice?: number
): string | null {
  if (!originalPrice || originalPrice <= amount) return null;
  const tenths = Math.round((amount / originalPrice) * 100) / 10;
  // Drop trailing .0 (e.g. 5.0折 → 5折) for cleaner display.
  const display = tenths % 1 === 0 ? tenths.toFixed(0) : tenths.toFixed(1);
  return `${display}折`;
}

/**
 * Per-100-credit unit price for the "X¥/100积分" subtext.
 * Returns the amount in CNY (not cents) with appropriate decimals.
 */
function computeUnitPricePer100(priceInCents: number, credits: number): string {
  const yuan = priceInCents / 100;
  const per100 = (yuan / credits) * 100;
  // Show 1-2 decimals depending on magnitude
  return per100 >= 10 ? per100.toFixed(1) : per100.toFixed(2);
}

/**
 * Subscription-style member tier card matching the China-market reference design:
 * tier name + discount badge, big discounted price next to strikethrough original,
 * per-100-credit unit cost, CTA, "送 X 积分" highlight box, monthly image estimate,
 * feature checklist, plus an optional HOT ribbon for the popular tier.
 */
export function CreditPricingCard({
  package: pkg,
  userId,
  className,
  isPopular = false,
}: CreditPricingCardProps) {
  const t = useTranslations('CreditPricing.Card');
  const messages = useMessages();
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const mounted = useMounted();

  // Pull dynamic feature lists out of the raw messages object since next-intl's
  // strictly typed t() rejects template-string keys like `features.${tier}.1`.
  const cardMessages = (messages as Record<string, unknown>).CreditPricing as
    | { Card?: { features?: Record<string, Record<string, string>> } }
    | undefined;
  const tierFeatures =
    pkg.tier && cardMessages?.Card?.features?.[pkg.tier]
      ? Object.values(cardMessages.Card.features[pkg.tier])
      : [];

  const formattedPrice = formatPrice(pkg.price.amount, pkg.price.currency);
  const formattedOriginalPrice = pkg.price.originalPrice
    ? formatPrice(pkg.price.originalPrice, pkg.price.currency)
    : null;

  const tierName = pkg.tier ? t(`tiers.${pkg.tier}`) : pkg.name || '';
  const intervalLabel = pkg.interval ? t(`intervals.${pkg.interval}`) : '';
  const discountLabel = computeDiscountLabel(
    pkg.price.amount,
    pkg.price.originalPrice
  );
  const unitPrice = computeUnitPricePer100(pkg.price.amount, pkg.amount);

  return (
    <div
      className={cn(
        'relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-shadow',
        isPopular
          ? 'border-primary/40 shadow-[0_0_0_1px_var(--primary)/40,0_8px_30px_-10px_var(--primary)/30]'
          : 'border-border/60',
        className
      )}
    >
      {/* HOT corner ribbon for the popular tier */}
      {isPopular && (
        <div className="absolute -top-3 right-4 flex items-center gap-1 rounded-md bg-orange-500 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white shadow-md">
          <Flame className="size-3" />
          HOT
        </div>
      )}

      {/* Tier name + discount badge */}
      <div className="flex items-center gap-2">
        <h3 className="text-xl font-semibold">{tierName}</h3>
        {discountLabel && (
          <Badge
            variant="secondary"
            className="border-emerald-400/30 bg-emerald-400/15 text-emerald-300"
          >
            {discountLabel}
          </Badge>
        )}
      </div>

      {/* Price block */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-semibold tracking-tight">
          {formattedPrice}
        </span>
        <span className="text-sm text-muted-foreground">/ {intervalLabel}</span>
        {formattedOriginalPrice && (
          <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/60">
            {formattedOriginalPrice}
          </span>
        )}
      </div>

      {/* Per-100-credit unit price */}
      <p className="mt-2 text-xs text-muted-foreground">
        {t('unitPrice', { price: unitPrice })}
      </p>

      {/* CTA button */}
      <div className="mt-6">
        {mounted && currentUser ? (
          <CreditCheckoutButton
            userId={currentUser.id}
            packageId={pkg.id}
            priceId={pkg.price.priceId}
            size="lg"
            className={cn(
              'w-full cursor-pointer font-medium',
              isPopular &&
                'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
            )}
            variant={isPopular ? 'default' : 'secondary'}
          >
            {t('subscribe')}
          </CreditCheckoutButton>
        ) : (
          <LoginWrapper mode="modal" asChild callbackUrl={currentPath}>
            <Button
              variant={isPopular ? 'default' : 'secondary'}
              size="lg"
              className={cn(
                'w-full cursor-pointer font-medium',
                isPopular &&
                  'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
              )}
            >
              {t('subscribe')}
            </Button>
          </LoginWrapper>
        )}
      </div>

      {/* "送 X 积分" highlight box */}
      <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-orange-400">
            🔥 {t('giftCredits', { amount: pkg.amount.toLocaleString() })}
          </span>
        </div>
        {pkg.monthlyImageEstimate && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t('monthlyImageEstimate', {
              count: pkg.monthlyImageEstimate.toLocaleString(),
            })}
          </p>
        )}
      </div>

      {/* Feature checklist */}
      <ul className="mt-6 flex flex-col gap-3 text-sm">
        {tierFeatures.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 flex-shrink-0 text-emerald-400" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
