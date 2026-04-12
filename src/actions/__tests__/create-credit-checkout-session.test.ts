import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCreditCheckoutSession } from '../create-credit-checkout-session';

const mocks = vi.hoisted(() => ({
  createCreditCheckout: vi.fn(),
  getCreditPackageById: vi.fn(),
  getLocale: vi.fn(),
}));

vi.mock('@/config/website', () => ({
  websiteConfig: {
    features: {
      enableDatafastRevenueTrack: false,
    },
    routes: {
      defaultLoginRedirect: '/dashboard',
    },
  },
}));

vi.mock('@/credits/server', () => ({
  getCreditPackageById: mocks.getCreditPackageById,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    actions: {
      error: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

vi.mock('@/lib/safe-action', () => ({
  userActionClient: {
    schema: vi.fn().mockReturnValue({
      action: vi.fn((fn) => fn),
    }),
  },
}));

vi.mock('@/lib/urls/urls', () => ({
  getUrlWithLocale: vi.fn((path: string) => path),
}));

vi.mock('@/payment', () => ({
  createCreditCheckout: mocks.createCreditCheckout,
}));

vi.mock('next-intl/server', () => ({
  getLocale: mocks.getLocale,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('createCreditCheckoutSession', () => {
  const ctx = {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Demo User',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLocale.mockResolvedValue('en');
  });

  it('rejects requests when package and price do not match', async () => {
    mocks.getCreditPackageById.mockReturnValue({
      id: 'pkg-basic',
      amount: 30,
      price: {
        priceId: 'price-basic',
        amount: 2900,
        currency: 'CNY',
      },
    });

    const result = await createCreditCheckoutSession({
      parsedInput: {
        userId: 'user-1',
        packageId: 'pkg-basic',
        priceId: 'price-other',
      },
      ctx,
    } as any);

    expect(result).toEqual({
      success: false,
      error: 'Invalid price for credit package',
    });
    expect(mocks.createCreditCheckout).not.toHaveBeenCalled();
  });

  it('creates checkout when package and price match', async () => {
    mocks.getCreditPackageById.mockReturnValue({
      id: 'pkg-basic',
      amount: 30,
      price: {
        priceId: 'price-basic',
        amount: 2900,
        currency: 'CNY',
      },
    });
    mocks.createCreditCheckout.mockResolvedValue({
      provider: 'zpay',
      url: 'https://checkout.example.com',
      sessionId: 'sess-1',
    });

    const result = await createCreditCheckoutSession({
      parsedInput: {
        userId: 'user-1',
        packageId: 'pkg-basic',
        priceId: 'price-basic',
      },
      ctx,
    } as any);

    expect(result).toMatchObject({
      success: true,
      data: {
        provider: 'zpay',
        url: 'https://checkout.example.com',
        sessionId: 'sess-1',
      },
    });
    expect(mocks.createCreditCheckout).toHaveBeenCalledTimes(1);
  });
});
