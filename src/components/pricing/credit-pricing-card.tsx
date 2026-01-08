'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { CreditPackage } from '@/credits/types';
import { useCurrentUser } from '@/hooks/use-auth';
import { useMounted } from '@/hooks/use-mounted';
import { useLocalePathname } from '@/i18n/navigation';
import { formatPrice } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { CheckCircleIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
 * Credit Pricing Card for subscription-style layout
 */
export function CreditPricingCard({
  package: pkg,
  userId,
  className,
  isPopular = false,
}: CreditPricingCardProps) {
  const t = useTranslations('CreditPricing.Card');
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const mounted = useMounted();

  // Format price
  const formattedPrice = formatPrice(pkg.price.amount, pkg.price.currency);

  // Get tier name
  const tierName = pkg.tier ? t(`tiers.${pkg.tier}`) : pkg.name || '';

  // Get interval label
  const intervalLabel = pkg.interval ? t(`intervals.${pkg.interval}`) : '';

  // Calculate monthly equivalent for quarterly/yearly
  let monthlyEquivalent = '';
  if (pkg.interval === 'quarter') {
    const monthly = pkg.price.amount / 3;
    monthlyEquivalent = formatPrice(monthly, pkg.price.currency);
  } else if (pkg.interval === 'year') {
    const monthly = pkg.price.amount / 12;
    monthlyEquivalent = formatPrice(monthly, pkg.price.currency);
  }

  return (
    <Card
      className={cn(
        'flex flex-col h-full relative',
        isPopular && 'border-primary border-2 shadow-lg',
        className
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
          <Badge
            variant="default"
            className="bg-primary text-primary-foreground"
          >
            {t('recommended')}
          </Badge>
        </div>
      )}

      <CardHeader>
        <CardTitle>
          <h3 className="font-semibold text-xl">{tierName}</h3>
        </CardTitle>

        {/* Price display */}
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{formattedPrice}</span>
            <span className="text-muted-foreground">/ {intervalLabel}</span>
          </div>

          {/* Monthly equivalent for quarter/year */}
          {monthlyEquivalent && (
            <div className="mt-2 text-sm text-muted-foreground">
              {t('monthlyEquivalent', { price: monthlyEquivalent })}
            </div>
          )}

          {/* Savings badge */}
          {pkg.savings && pkg.savings > 0 && (
            <div className="mt-3">
              <Badge
                variant="secondary"
                className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100"
              >
                {t('save')} {pkg.savings}%
              </Badge>
            </div>
          )}
        </div>

        <CardDescription>
          <p className="text-sm mt-4">
            {pkg.description || t('defaultDescription')}
          </p>
        </CardDescription>

        {/* Action button */}
        {mounted && currentUser ? (
          <CreditCheckoutButton
            userId={currentUser.id}
            packageId={pkg.id}
            priceId={pkg.price.priceId}
            className="mt-4 w-full cursor-pointer"
            variant={isPopular ? 'default' : 'outline'}
          >
            {t('subscribe')}
          </CreditCheckoutButton>
        ) : (
          <LoginWrapper mode="modal" asChild callbackUrl={currentPath}>
            <Button
              variant={isPopular ? 'default' : 'outline'}
              className="mt-4 w-full cursor-pointer"
            >
              {t('subscribe')}
            </Button>
          </LoginWrapper>
        )}
      </CardHeader>

      <CardContent className="space-y-4 flex-1">
        <hr className="border-dashed" />

        {/* Features list */}
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="size-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <span>{t('features.credits', { amount: pkg.amount })}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="size-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <span>{t('features.images', { count: pkg.amount })}</span>
          </li>
          {pkg.expireDays && (
            <li className="flex items-start gap-2">
              <CheckCircleIcon className="size-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <span>{t('features.expiry', { days: pkg.expireDays })}</span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="size-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <span>{t('features.allModels')}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="size-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <span>{t('features.priority')}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
