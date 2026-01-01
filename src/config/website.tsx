import { PaymentTypes, PlanIntervals } from '@/payment/types';
import type { WebsiteConfig } from '@/types';

/**
 * Helper function to parse zpay price from environment variable
 * Returns undefined if not set, allowing ZpayProvider to use fallback
 */
const getZpayPrice = (envKey: string): number | undefined => {
  const value = process.env[envKey];
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * website config, without translations
 *
 * docs:
 * https://mksaas.com/docs/config/website
 */
export const websiteConfig: WebsiteConfig = {
  ui: {
    theme: {
      defaultTheme: 'default',
      enableSwitch: true,
    },
    mode: {
      defaultMode: 'dark',
      enableSwitch: true,
    },
  },
  metadata: {
    images: {
      ogImage: '/og.png',
      logoLight: '/logo.png',
      logoDark: '/logo-dark.png',
    },
    social: {
      github: '',
      twitter: '',
      blueSky: '',
      discord: '',
      mastodon: '',
      linkedin: '',
      youtube: '',
    },
  },
  features: {
    enableUpgradeCard: true,
    enableUpdateAvatar: true,
    enableAffonsoAffiliate: false,
    enablePromotekitAffiliate: false,
    enableDatafastRevenueTrack: false,
    enableCrispChat: process.env.NEXT_PUBLIC_DEMO_WEBSITE === 'true',
    enableTurnstileCaptcha: process.env.NEXT_PUBLIC_DEMO_WEBSITE === 'true',
  },
  routes: {
    defaultLoginRedirect: '/dashboard',
  },
  analytics: {
    enableVercelAnalytics: false,
    enableSpeedInsights: false,
  },
  auth: {
    enableGoogleLogin: false,
    enableGithubLogin: false,
    enableCredentialLogin: true,
  },
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: {
        flag: '🇺🇸',
        name: 'English',
        hreflang: 'en',
      },
      zh: {
        flag: '🇨🇳',
        name: '中文',
        hreflang: 'zh-CN',
      },
    },
  },
  blog: {
    enable: true,
    paginationSize: 6,
    relatedPostsSize: 3,
  },
  docs: {
    enable: true,
  },
  mail: {
    provider: 'resend',
    fromEmail: 'Nano AI <noreply@nanoaiarch.com>',
    supportEmail: 'Nano AI <support@nanoaiarch.com>',
  },
  newsletter: {
    enable: true,
    provider: 'resend',
    autoSubscribeAfterSignUp: true,
  },
  storage: {
    enable: true,
    provider: 's3',
  },
  payment: {
    provider: 'zpay',
  },
  price: {
    plans: {
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
      pro: {
        id: 'pro',
        disabled: true, // zpay 不支持订阅，隐藏此计划
        prices: [
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY!,
            amount: 990,
            currency: 'USD',
            interval: PlanIntervals.MONTH,
          },
          {
            type: PaymentTypes.SUBSCRIPTION,
            priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY!,
            amount: 9900,
            currency: 'USD',
            interval: PlanIntervals.YEAR,
          },
        ],
        isFree: false,
        isLifetime: false,
        popular: true,
        credits: {
          enable: true,
          amount: 500,
          expireDays: 30,
        },
      },
      lifetime: {
        id: 'lifetime',
        disabled: true, // 隐藏终身版
        prices: [
          {
            type: PaymentTypes.ONE_TIME,
            priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME!,
            amount: 19900,
            currency: 'USD',
            allowPromotionCode: true,
            zpayAmount: getZpayPrice('ZPAY_PRICE_LIFETIME'), // CNY price for zpay
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
    },
  },
  credits: {
    enableCredits: true,
    enablePackagesForFreePlan: false,
    registerGiftCredits: {
      enable: true,
      amount: 50,
      expireDays: 30,
    },
    packages: {
      // === 基础版 (Basic Tier) ===
      basic_month: {
        id: 'basic_month',
        tier: 'basic',
        interval: 'month',
        popular: false,
        amount: 30, // 约 30 张图片
        expireDays: 30,
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTH!,
          amount: 2900, // ¥29
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
        amount: 100, // 约 100 张图片
        expireDays: 90,
        savings: 9, // ~9% off vs monthly
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_QUARTER!,
          amount: 7900, // ¥79
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
        amount: 400, // 约 400 张图片
        expireDays: 365,
        savings: 23, // ~23% off vs monthly
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_YEAR!,
          amount: 26900, // ¥269
          currency: 'CNY',
          allowPromotionCode: true,
          zpayAmount: getZpayPrice('ZPAY_PRICE_BASIC_YEAR') ?? 269,
        },
      },
      // === 标准版 (Standard Tier) - 推荐 ===
      standard_month: {
        id: 'standard_month',
        tier: 'standard',
        interval: 'month',
        popular: false,
        amount: 100, // 约 100 张图片
        expireDays: 30,
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD_MONTH!,
          amount: 7900, // ¥79
          currency: 'CNY',
          allowPromotionCode: true,
          zpayAmount: getZpayPrice('ZPAY_PRICE_STANDARD_MONTH') ?? 79,
        },
      },
      standard_quarter: {
        id: 'standard_quarter',
        tier: 'standard',
        interval: 'quarter',
        popular: true, // 推荐套餐
        amount: 350, // 约 350 张图片
        expireDays: 90,
        savings: 8, // ~8% off vs monthly
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD_QUARTER!,
          amount: 21900, // ¥219
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
        amount: 1500, // 约 1500 张图片
        expireDays: 365,
        savings: 33, // ~33% off vs monthly
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD_YEAR!,
          amount: 79900, // ¥799
          currency: 'CNY',
          allowPromotionCode: true,
          zpayAmount: getZpayPrice('ZPAY_PRICE_STANDARD_YEAR') ?? 799,
        },
      },
      // === 专业版 (Pro Tier) ===
      pro_month: {
        id: 'pro_month',
        tier: 'pro',
        interval: 'month',
        popular: false,
        amount: 300, // 约 300 张图片
        expireDays: 30,
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTH!,
          amount: 19900, // ¥199
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
        amount: 1000, // 约 1000 张图片
        expireDays: 90,
        savings: 8, // ~8% off vs monthly
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_QUARTER!,
          amount: 54900, // ¥549
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
        amount: 5000, // 约 5000 张图片
        expireDays: 365,
        savings: 33, // ~33% off vs monthly
        price: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEAR!,
          amount: 199900, // ¥1999
          currency: 'CNY',
          allowPromotionCode: true,
          zpayAmount: getZpayPrice('ZPAY_PRICE_PRO_YEAR') ?? 1999,
        },
      },
    },
  },
  referral: {
    enable: true,
    // Bonus for new users who register via referral link
    signupBonus: {
      enable: true,
      amount: 20,
      expireDays: 30,
    },
    // Commission for referrers when referred user makes first payment
    commission: {
      enable: true,
      amount: 50,
      expireDays: 0, // Never expire
    },
  },
};
