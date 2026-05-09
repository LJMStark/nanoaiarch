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

// 会员套餐定价
//
// 命名约定：tier 字段保持 basic/standard/pro 作为内部稳定标识符（后端、
// idempotency key、analytics 都依赖它）；UI 文案通过 i18n 渲染为
// 黄金会员/铂金会员/钻石会员，对用户呈现为按月/按年订阅。
//
// 后端实现说明：zpay 仅支持一次性付款，目前每次"订阅"实际是用户手动重购。
// 后续切到支持订阅的支付通道时，priceId 与 idempotency key 模型保留兼容。
export const creditPackages: Record<string, CreditPackage> = {
  // 黄金会员 (Gold)
  basic_month: {
    id: 'basic_month',
    tier: 'basic',
    interval: 'month',
    popular: false,
    amount: 500,
    expireDays: 30,
    monthlyImageEstimate: 300,
    price: {
      priceId: 'zpay_basic_month',
      amount: 5900,
      originalPrice: 6900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_BASIC_MONTH') ?? 59,
    },
  },
  basic_year: {
    id: 'basic_year',
    tier: 'basic',
    interval: 'year',
    popular: false,
    amount: 6000,
    expireDays: 365,
    monthlyImageEstimate: 300,
    savings: 50,
    price: {
      priceId: 'zpay_basic_year',
      amount: 9900,
      originalPrice: 19900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_BASIC_YEAR') ?? 99,
    },
  },
  // 铂金会员 (Platinum) — popular tier
  standard_month: {
    id: 'standard_month',
    tier: 'standard',
    interval: 'month',
    popular: true,
    amount: 1280,
    expireDays: 30,
    monthlyImageEstimate: 1200,
    price: {
      priceId: 'zpay_standard_month',
      amount: 8900,
      originalPrice: 12800,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_STANDARD_MONTH') ?? 89,
    },
  },
  standard_year: {
    id: 'standard_year',
    tier: 'standard',
    interval: 'year',
    popular: true,
    amount: 15360,
    expireDays: 365,
    monthlyImageEstimate: 1200,
    savings: 64,
    price: {
      priceId: 'zpay_standard_year',
      amount: 22900,
      originalPrice: 62800,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_STANDARD_YEAR') ?? 229,
    },
  },
  // 钻石会员 (Diamond)
  pro_month: {
    id: 'pro_month',
    tier: 'pro',
    interval: 'month',
    popular: false,
    amount: 3000,
    expireDays: 30,
    monthlyImageEstimate: 3500,
    price: {
      priceId: 'zpay_pro_month',
      amount: 12900,
      originalPrice: 30000,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_PRO_MONTH') ?? 129,
    },
  },
  pro_year: {
    id: 'pro_year',
    tier: 'pro',
    interval: 'year',
    popular: false,
    amount: 36000,
    expireDays: 365,
    monthlyImageEstimate: 3500,
    savings: 71,
    price: {
      priceId: 'zpay_pro_year',
      amount: 49900,
      originalPrice: 169900,
      currency: 'CNY',
      allowPromotionCode: true,
      zpayAmount: getZpayPrice('ZPAY_PRICE_PRO_YEAR') ?? 499,
    },
  },
};
