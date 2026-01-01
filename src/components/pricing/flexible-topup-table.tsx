'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { websiteConfig } from '@/config/website';
import type { CreditPackage } from '@/credits/types';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useMounted } from '@/hooks/use-mounted';
import { useLocalePathname } from '@/i18n/navigation';
import { formatPrice } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { LoginWrapper } from '../auth/login-wrapper';
import { CreditCheckoutButton } from '../settings/credits/credit-checkout-button';
import { Badge } from '../ui/badge';

interface FlexibleTopupTableProps {
  userId?: string;
  className?: string;
}

/**
 * Display package type with optional new user fields
 */
type DisplayPackage = CreditPackage & {
  isNewUser?: boolean;
  bonus?: number;
};

/**
 * Flexible Top-up Table
 * Shows simple credit packages without tier/interval structure
 */
export function FlexibleTopupTable({
  userId,
  className,
}: FlexibleTopupTableProps) {
  const t = useTranslations('Pricing.Topup');
  const currentUser = useCurrentUser();
  const currentPath = useLocalePathname();
  const mounted = useMounted();

  // Get packages without tier/interval (legacy packages or custom packages)
  const displayPackages: DisplayPackage[] = Object.values(
    websiteConfig.credits.packages
  ).filter((pkg) => !pkg.tier && !pkg.interval && !pkg.disabled);

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {/* Info text */}
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {/* Show message if no packages available */}
      {displayPackages.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {t('noPackagesAvailable')}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('useSubscriptionPlans')}
          </p>
        </div>
      ) : (
        /* Packages Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto w-full">
          {displayPackages.map((pkg) => {
            const formattedPrice = formatPrice(
              pkg.price.amount,
              pkg.price.currency
            );
            const isNewUser = pkg.isNewUser || false;

            return (
              <Card
                key={pkg.id}
                className={cn(
                  'flex flex-col relative',
                  pkg.popular && 'border-primary border-2'
                )}
              >
                {/* New User badge */}
                {isNewUser && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-orange-500 text-white">
                      {t('newUser')}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    {t('topup')}
                  </div>

                  {/* Price */}
                  <div className="text-4xl font-bold">{formattedPrice}</div>

                  {/* Original price with strikethrough if newUser */}
                  {isNewUser && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <span className="line-through">
                        {formatPrice(pkg.price.amount * 5, pkg.price.currency)}
                      </span>
                      <span className="ml-2 text-orange-500">
                        {t('limitedOffer')}
                      </span>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="flex flex-col gap-4 flex-1">
                  {/* Credits info */}
                  <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-semibold text-primary">
                      {pkg.amount}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t('credits')}
                    </div>
                  </div>

                  {/* Bonus info */}
                  {pkg.bonus && (
                    <div className="text-sm text-green-600 dark:text-green-400 text-center">
                      + {pkg.bonus} {t('bonusCredits')}
                    </div>
                  )}

                  {/* Buy button */}
                  <div className="mt-auto">
                    {mounted && currentUser ? (
                      <CreditCheckoutButton
                        userId={currentUser.id}
                        packageId={pkg.id}
                        priceId={pkg.price.priceId}
                        className="w-full"
                        variant={pkg.popular ? 'default' : 'outline'}
                      >
                        {t('buyNow')}
                      </CreditCheckoutButton>
                    ) : (
                      <LoginWrapper
                        mode="modal"
                        asChild
                        callbackUrl={currentPath}
                      >
                        <Button
                          variant={pkg.popular ? 'default' : 'outline'}
                          className="w-full cursor-pointer"
                        >
                          {t('buyNow')}
                        </Button>
                      </LoginWrapper>
                    )}
                  </div>

                  {/* One-time purchase notice for newUser */}
                  {isNewUser && (
                    <div className="text-xs text-center text-muted-foreground">
                      {t('oneTimeOnly')}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
