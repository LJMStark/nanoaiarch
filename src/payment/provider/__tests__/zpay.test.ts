import { PaymentScenes } from '@/payment/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZpayProvider } from '../zpay';

const mocks = vi.hoisted(() => ({
  addCredits: vi.fn(),
  addLifetimeMonthlyCredits: vi.fn(),
  completeReferral: vi.fn(),
  getCreditPackageById: vi.fn(),
  getDb: vi.fn(),
  findPlanByPlanId: vi.fn(),
  findPlanByPriceId: vi.fn(),
  sendNotification: vi.fn(),
  websiteConfig: {
    referral: {
      enable: false,
    },
    credits: {
      enableCredits: true,
    },
  },
}));

vi.mock('@/config/website', () => ({
  websiteConfig: mocks.websiteConfig,
}));

vi.mock('@/credits/credits', () => ({
  addCredits: mocks.addCredits,
  addLifetimeMonthlyCredits: mocks.addLifetimeMonthlyCredits,
}));

vi.mock('@/credits/referral', () => ({
  completeReferral: mocks.completeReferral,
}));

vi.mock('@/credits/server', () => ({
  getCreditPackageById: mocks.getCreditPackageById,
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    payment: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

vi.mock('@/lib/price-plan', () => ({
  findPlanByPlanId: mocks.findPlanByPlanId,
  findPlanByPriceId: mocks.findPlanByPriceId,
}));

vi.mock('@/notification/notification', () => ({
  sendNotification: mocks.sendNotification,
}));

function createDbMock(paymentRecord: Record<string, unknown>) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([paymentRecord]),
  };

  const returning = vi.fn().mockResolvedValue([paymentRecord]);
  const where = vi.fn().mockReturnValue({
    returning,
  });
  const set = vi.fn().mockReturnValue({
    where,
  });
  const update = vi.fn().mockReturnValue({
    set,
  });

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update,
    __updateWhere: where,
  };
}

function createSignedPayload(
  provider: ZpayProvider,
  overrides?: Record<string, string>
) {
  const params: Record<string, string> = {
    out_trade_no: 'invoice-1',
    trade_no: 'trade-1',
    trade_status: 'TRADE_SUCCESS',
    money: '29.00',
    pid: 'test-pid',
    type: 'alipay',
    ...overrides,
  };

  params.sign = (provider as any).generateSign(params);
  return JSON.stringify(params);
}

describe('ZpayProvider webhook hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.websiteConfig.referral.enable = false;
    process.env.ZPAY_PID = 'test-pid';
    process.env.ZPAY_KEY = 'test-key';
    process.env.ZPAY_NOTIFY_URL = 'https://example.com/notify';
    process.env.ZPAY_RETURN_URL = 'https://example.com/return';
  });

  it('does not finalize payment when credit fulfillment fails', async () => {
    const paymentRecord = {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      paid: false,
      scene: PaymentScenes.CREDIT,
      priceId: 'price-basic',
      userId: 'user-1',
    };
    const db = createDbMock(paymentRecord);
    mocks.getDb.mockResolvedValue(db);

    const provider = new ZpayProvider();
    (provider as any).processCreditPurchase = vi
      .fn()
      .mockRejectedValue(new Error('fulfillment failed'));

    await expect(
      provider.handleWebhookEvent(createSignedPayload(provider), '')
    ).rejects.toThrow('fulfillment failed');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('throws when credit webhook params are missing packageId', async () => {
    const provider = new ZpayProvider();

    await expect(
      (provider as any).processCreditPurchase(
        {
          id: 'payment-1',
          invoiceId: 'invoice-1',
          priceId: 'price-basic',
          userId: 'user-1',
        },
        { money: '29.00' }
      )
    ).rejects.toThrow('Missing packageId in webhook params');
  });

  it('throws when lifetime webhook amount does not match expected price', async () => {
    mocks.findPlanByPriceId.mockReturnValue({
      isLifetime: true,
      prices: [
        {
          priceId: 'price-lifetime',
          zpayAmount: 99,
        },
      ],
    });

    const provider = new ZpayProvider();

    await expect(
      (provider as any).processLifetimePurchase(
        {
          id: 'payment-1',
          priceId: 'price-lifetime',
          userId: 'user-1',
        },
        '9.90'
      )
    ).rejects.toThrow('Lifetime payment amount mismatch');
  });

  it('retries referral reward when payment was already marked paid', async () => {
    mocks.websiteConfig.referral.enable = true;
    const paymentRecord = {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      paid: true,
      scene: PaymentScenes.CREDIT,
      priceId: 'price-basic',
      userId: 'user-1',
    };
    const db = createDbMock(paymentRecord);
    mocks.getDb.mockResolvedValue(db);

    const provider = new ZpayProvider();

    await expect(
      provider.handleWebhookEvent(createSignedPayload(provider), '')
    ).resolves.toBeUndefined();

    expect(mocks.completeReferral).toHaveBeenCalledWith('user-1');
    expect(db.update).not.toHaveBeenCalled();
  });
});
