'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useMessages, useTranslations } from 'next-intl';

interface FreeTierCardProps {
  className?: string;
}

/**
 * 非会员 (free tier) card rendered as the first column of the membership table.
 * Mirrors the layout of CreditPricingCard so all four columns share the same
 * vertical rhythm: tier name, big "¥0" price, disabled "current plan" CTA,
 * and a feature checklist sourced from i18n.
 */
export function FreeTierCard({ className }: FreeTierCardProps) {
  // We dual-import: t() for static keys (typed) and messages for the
  // dynamic features list (template keys aren't allowed by next-intl typing).
  const t = useTranslations('CreditPricing');
  const messages = useMessages();
  const freeTier = (messages as Record<string, unknown>).CreditPricing as
    | {
        FreeTier?: {
          tierName?: string;
          currentPlan?: string;
          features?: Record<string, string>;
        };
      }
    | undefined;
  const features = freeTier?.FreeTier?.features
    ? Object.values(freeTier.FreeTier.features)
    : [];

  return (
    <div
      className={cn(
        'relative flex h-full flex-col rounded-2xl border border-border/60 bg-card p-6',
        className
      )}
    >
      <h3 className="text-xl font-semibold">
        {freeTier?.FreeTier?.tierName ?? t('Card.tiers.basic')}
      </h3>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-semibold tracking-tight">
          ¥0
        </span>
      </div>

      <div className="mt-6">
        <Button
          disabled
          variant="secondary"
          size="lg"
          className="w-full cursor-not-allowed opacity-70"
        >
          {freeTier?.FreeTier?.currentPlan ?? '当前使用'}
        </Button>
      </div>

      <ul className="mt-6 flex flex-col gap-3 text-sm">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 flex-shrink-0 text-emerald-400" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
