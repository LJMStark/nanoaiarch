'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { websiteConfig } from '@/config/website';
import { useCreditBalance } from '@/hooks/use-credits';
import { useLocaleRouter } from '@/i18n/navigation';
import { Routes } from '@/routes';
import { useCreditsModalStore } from '@/stores/credits-modal-store';
import { Coins, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Modal shown when a generation submission fails with 402 INSUFFICIENT_CREDITS.
 *
 * Conversion-critical surface: this is the moment a user is most likely to
 * upgrade. We show:
 *   - Their current balance (live from useCreditBalance)
 *   - The amount this generation needed (passed via the modal store)
 *   - The recommended ("popular") credit package as a one-click jump
 *   - A secondary link to the full /pricing page for power users
 *
 * Triggered globally via useCreditsModalStore.getState().open({ requiredCredits })
 * — see useConversationSubmit's catch block.
 */
export function InsufficientCreditsModal() {
  const t = useTranslations('CreditsModal');
  const router = useLocaleRouter();

  const isOpen = useCreditsModalStore((s) => s.isOpen);
  const requiredCredits = useCreditsModalStore((s) => s.requiredCredits);
  const close = useCreditsModalStore((s) => s.close);

  // useCreditBalance is React Query backed — cached and refreshed by the
  // global query client, so opening this modal does not refetch on every
  // mount unless the cache is stale.
  const { data: currentBalance, isLoading: isBalanceLoading } =
    useCreditBalance();

  // Recommended package: the package flagged `popular: true` for the monthly
  // interval, which currently maps to 铂金会员/standard_month. Users wanting
  // a different tier can click the secondary link to /pricing.
  const recommendedPackage = Object.values(websiteConfig.credits.packages).find(
    (pkg) => pkg.popular && pkg.interval === 'month' && !pkg.disabled
  );

  function handleNavigateToPricing() {
    close();
    router.push(Routes.Pricing);
  }

  function handleQuickPurchase() {
    // For now we route to /pricing with the recommended tier focused via
    // hash. A future iteration can call createCreditCheckoutAction directly
    // and skip the pricing page entirely for one-click upgrade.
    close();
    router.push(
      recommendedPackage
        ? `${Routes.Pricing}#${recommendedPackage.id}`
        : Routes.Pricing
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-5 text-orange-400" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('currentBalance')}</span>
            <span className="font-mono font-semibold">
              {isBalanceLoading
                ? '...'
                : t('creditsAmount', { amount: currentBalance ?? 0 })}
            </span>
          </div>
          {requiredCredits !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('required')}</span>
              <span className="font-mono font-semibold text-orange-400">
                {t('creditsAmount', { amount: requiredCredits })}
              </span>
            </div>
          )}
        </div>

        {recommendedPackage && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <Sparkles className="size-4" />
              {t('recommendedTitle')}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold">
                ¥{(recommendedPackage.price.amount / 100).toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('recommendedAmount', {
                  amount: recommendedPackage.amount.toLocaleString(),
                })}
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6 gap-2 sm:gap-2">
          <Button variant="ghost" onClick={close}>
            {t('cancel')}
          </Button>
          <Button variant="outline" onClick={handleNavigateToPricing}>
            {t('viewAllPlans')}
          </Button>
          {recommendedPackage && (
            <Button
              onClick={handleQuickPurchase}
              className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
            >
              {t('quickUpgrade')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
