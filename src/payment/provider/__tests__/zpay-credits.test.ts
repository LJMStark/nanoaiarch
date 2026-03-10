import { describe, expect, it } from 'vitest';
import { resolveCreditPurchaseFromWebhook } from '../zpay-credits';

describe('resolveCreditPurchaseFromWebhook', () => {
  it('uses the server-side package amount instead of payload credits', () => {
    const result = resolveCreditPurchaseFromWebhook({
      params: {
        money: '29.00',
        param: JSON.stringify({
          packageId: 'small',
          credits: 999999,
        }),
      },
      creditPackage: {
        id: 'small',
        amount: 30,
        expireDays: 30,
        price: {
          priceId: 'credits_small',
          amount: 2900,
          currency: 'CNY',
        },
      },
    });

    expect(result).toEqual({
      packageId: 'small',
      amount: 30,
      expireDays: 30,
      description: '+30 credits for package small (¥29.00)',
    });
  });

  it('returns null when package is missing from webhook params', () => {
    expect(
      resolveCreditPurchaseFromWebhook({
        params: {
          money: '29.00',
        },
        creditPackage: null,
      })
    ).toBeNull();
  });
});
