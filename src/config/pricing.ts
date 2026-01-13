import type { CreditPackage } from '@/credits/types';
import type { PricePlan } from '@/payment/types';
import { PaymentTypes } from '@/payment/types';

const getZpayPrice = (envKey: string): number | undefined => {
  const value = process.env[envKey];
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const pricePlans: Record<string, PricePlan> = {
  free: {
    id: 'free',
    prices: [],
    isFree: true,
    isLifetime: false,
    credits: {
      enable: true,
      amount: 50,
      expireDays: 30,
    },
  },
  lifetime: {
    id: 'lifetime',
    disabled: true,
    prices: [
      {
        type: PaymentTypes.ONE_TIME,
        priceId: 'zpay_lifetime',
        amount: 19900,
        currency: 'CNY',
        allowPromotionCode: true,
        zpayAmount: getZpayPrice('ZPAY_PRICE_LIFETIME'),
      },
    ],
    isFree: false,
    isLifetime: true,
    credits: {
      enable: true,
      amount: 1000,
      expireDays: 0,
    },
  },
};

export const creditPackages: Record<string, CreditPackage> = {
  basic_month: {
    id: 'basic_month',
    tier: 'basic',
    interval: 'month',
    popular: false,
    amount: 30,
    expireDays: 30,
    price: {
      priceId: 'zpay_basic_month',
      amount: 2900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_BASIC_MONTH') ?? 29,
    },
  },
  basic_quarter: {
    id: 'basic_quarter',
    tier: 'basic',
    interval: 'quarter',
    popular: false,
    amount: 100,
    expireDays: 90,
    savings: 9,
    price: {
      priceId: 'zpay_basic_quarter',
      amount: 7900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_BASIC_QUARTER') ?? 79,
    },
  },
  basic_year: {
    id: 'basic_year',
    tier: 'basic',
    interval: 'year',
    popular: false,
    amount: 400,
    expireDays: 365,
    savings: 23,
    price: {
      priceId: 'zpay_basic_year',
      amount: 26900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_BASIC_YEAR') ?? 269,
    },
  },
  standard_month: {
    id: 'standard_month',
    tier: 'standard',
    interval: 'month',
    popular: false,
    amount: 100,
    expireDays: 30,
    price: {
      priceId: 'zpay_standard_month',
      amount: 7900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_STANDARD_MONTH') ?? 79,
    },
  },
  standard_quarter: {
    id: 'standard_quarter',
    tier: 'standard',
    interval: 'quarter',
    popular: true,
    amount: 350,
    expireDays: 90,
    savings: 8,
    price: {
      priceId: 'zpay_standard_quarter',
      amount: 21900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_STANDARD_QUARTER') ?? 219,
    },
  },
  standard_year: {
    id: 'standard_year',
    tier: 'standard',
    interval: 'year',
    popular: false,
    amount: 1500,
    expireDays: 365,
    savings: 33,
    price: {
      priceId: 'zpay_standard_year',
      amount: 79900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_STANDARD_YEAR') ?? 799,
    },
  },
  pro_month: {
    id: 'pro_month',
    tier: 'pro',
    interval: 'month',
    popular: false,
    amount: 300,
    expireDays: 30,
    price: {
      priceId: 'zpay_pro_month',
      amount: 19900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_PRO_MONTH') ?? 199,
    },
  },
  pro_quarter: {
    id: 'pro_quarter',
    tier: 'pro',
    interval: 'quarter',
    popular: false,
    amount: 1000,
    expireDays: 90,
    savings: 8,
    price: {
      priceId: 'zpay_pro_quarter',
      amount: 54900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_PRO_QUARTER') ?? 549,
    },
  },
  pro_year: {
    id: 'pro_year',
    tier: 'pro',
    interval: 'year',
    popular: false,
    amount: 5000,
    expireDays: 365,
    savings: 33,
    price: {
      priceId: 'zpay_pro_year',
      amount: 199900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_PRO_YEAR') ?? 1999,
    },
  },
};
