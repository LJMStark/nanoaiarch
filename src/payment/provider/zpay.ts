import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { websiteConfig } from '@/config/website';
import { addCredits, addLifetimeMonthlyCredits } from '@/credits/credits';
import { completeReferral } from '@/credits/referral';
import { getCreditPackageById } from '@/credits/server';
import { CREDIT_TRANSACTION_TYPE } from '@/credits/types';
import { getDb } from '@/db';
import { payment, user } from '@/db/schema';
import type { Payment } from '@/db/types';
import { findPlanByPlanId } from '@/lib/price-plan';
import { sendNotification } from '@/notification/notification';
import { and, eq } from 'drizzle-orm';
import {
  type CheckoutResult,
  type CreateCheckoutParams,
  type CreateCreditCheckoutParams,
  type CreatePortalParams,
  type PaymentProvider,
  PaymentScenes,
  PaymentTypes,
  type PortalResult,
} from '../types';

/**
 * zpay payment provider implementation
 * Supports Alipay payments for China users
 *
 * API docs: https://z-pay.cn/doc.html
 */
export class ZpayProvider implements PaymentProvider {
  private pid: string;
  private key: string;
  private notifyUrl: string;
  private returnUrl: string;
  private apiUrl = 'https://zpayz.cn';

  constructor() {
    const pid = process.env.ZPAY_PID;
    const key = process.env.ZPAY_KEY;
    const notifyUrl = process.env.ZPAY_NOTIFY_URL;
    const returnUrl = process.env.ZPAY_RETURN_URL;

    // Validate required environment variables
    if (!pid || !key) {
      throw new Error(
        'ZPAY_PID and ZPAY_KEY environment variables are required'
      );
    }

    if (!notifyUrl || !returnUrl) {
      throw new Error(
        'ZPAY_NOTIFY_URL and ZPAY_RETURN_URL environment variables are required'
      );
    }

    // Validate URL format
    const isValidUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    };

    if (!isValidUrl(notifyUrl)) {
      throw new Error(
        `ZPAY_NOTIFY_URL must be a valid HTTP/HTTPS URL, got: ${notifyUrl}`
      );
    }

    if (!isValidUrl(returnUrl)) {
      throw new Error(
        `ZPAY_RETURN_URL must be a valid HTTP/HTTPS URL, got: ${returnUrl}`
      );
    }

    this.pid = pid;
    this.key = key;
    this.notifyUrl = notifyUrl;
    this.returnUrl = returnUrl;
  }

  /**
   * Generate MD5 signature according to zpay specification
   * Steps:
   * 1. Sort parameters by key name ASCII order
   * 2. Exclude sign, sign_type and empty values
   * 3. Concatenate as URL format: a=b&c=d&e=f
   * 4. Append merchant key and MD5 hash
   */
  private generateSign(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params)
      .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '')
      .sort();

    const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');

    return crypto
      .createHash('md5')
      .update(queryString + this.key)
      .digest('hex');
  }

  /**
   * Verify callback signature from zpay
   * Uses timing-safe comparison to prevent timing attacks
   */
  private verifySign(params: Record<string, string>): boolean {
    const receivedSign = params.sign;
    if (!receivedSign) {
      return false;
    }

    const calculatedSign = this.generateSign(params);

    // Signatures must be same length for timing-safe comparison
    if (receivedSign.length !== calculatedSign.length) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    const receivedBuffer = Buffer.from(receivedSign);
    const calculatedBuffer = Buffer.from(calculatedSign);

    return crypto.timingSafeEqual(receivedBuffer, calculatedBuffer);
  }

  /**
   * Generate 32-character order number (zpay max length is 32)
   */
  private generateOutTradeNo(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Create or get pseudo customer ID for zpay
   * zpay doesn't have a customer concept, so we use zpay_${userId}
   */
  private async createOrGetCustomerId(
    email: string,
    userId: string
  ): Promise<string> {
    const customerId = `zpay_${userId}`;

    const db = await getDb();
    await db
      .update(user)
      .set({ customerId, updatedAt: new Date() })
      .where(eq(user.email, email));

    return customerId;
  }

  /**
   * Get zpay price from environment variable
   */
  private getZpayPrice(priceKey: string): number {
    const envKey = `ZPAY_PRICE_${priceKey.toUpperCase()}`;
    const value = process.env[envKey];
    if (!value) {
      throw new Error(`Environment variable ${envKey} is not set`);
    }
    return Number.parseFloat(value);
  }

  /**
   * Create checkout session for plan purchase (lifetime only)
   * Note: zpay does not support subscriptions
   */
  public async createCheckout(
    params: CreateCheckoutParams
  ): Promise<CheckoutResult> {
    const { planId, priceId, customerEmail, successUrl, metadata } = params;

    // Find plan
    const plan = findPlanByPlanId(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found`);
    }

    // Find price in plan
    const price = plan.prices.find((p) => p.priceId === priceId);
    if (!price) {
      throw new Error(`Price ID ${priceId} not found in plan ${planId}`);
    }

    // zpay only supports one-time payments
    if (price.type === PaymentTypes.SUBSCRIPTION) {
      throw new Error(
        'zpay does not support subscription payments. Please use Stripe for subscriptions.'
      );
    }

    // Get zpay CNY price
    const zpayAmount = price.zpayAmount || this.getZpayPrice('LIFETIME');

    const userId = metadata?.userId;
    if (!userId) {
      throw new Error('userId is required in metadata');
    }

    // Create pseudo customer ID
    const customerId = await this.createOrGetCustomerId(customerEmail, userId);

    // Generate order number
    const outTradeNo = this.generateOutTradeNo();

    // Create payment record
    const db = await getDb();
    const paymentId = randomUUID();
    const currentDate = new Date();

    await db.insert(payment).values({
      id: paymentId,
      priceId,
      type: PaymentTypes.ONE_TIME,
      scene: PaymentScenes.LIFETIME,
      userId,
      customerId,
      sessionId: paymentId,
      invoiceId: outTradeNo, // Store out_trade_no in invoiceId field
      paid: false,
      status: 'processing',
      createdAt: currentDate,
      updatedAt: currentDate,
    });

    // Build payment parameters
    const payParams: Record<string, string> = {
      pid: this.pid,
      type: 'alipay',
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      return_url: successUrl || this.returnUrl,
      name: plan.name || `${planId} Plan`,
      money: zpayAmount.toFixed(2),
      sign_type: 'MD5',
    };

    // Generate signature
    payParams.sign = this.generateSign(payParams);

    // Build payment URL
    const queryString = Object.entries(payParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const paymentUrl = `${this.apiUrl}/submit.php?${queryString}`;

    return {
      url: paymentUrl,
      id: outTradeNo,
    };
  }

  /**
   * Create checkout session for credit package purchase
   */
  public async createCreditCheckout(
    params: CreateCreditCheckoutParams
  ): Promise<CheckoutResult> {
    const { packageId, priceId, customerEmail, successUrl, metadata } = params;

    // Get credit package
    const creditPackage = getCreditPackageById(packageId);
    if (!creditPackage) {
      throw new Error(`Credit package with ID ${packageId} not found`);
    }

    // Get zpay CNY price
    const zpayAmount =
      creditPackage.price.zpayAmount ||
      this.getZpayPrice(`CREDITS_${packageId.toUpperCase()}`);

    const userId = metadata?.userId;
    if (!userId) {
      throw new Error('userId is required in metadata');
    }

    // Create pseudo customer ID
    const customerId = await this.createOrGetCustomerId(customerEmail, userId);

    // Generate order number
    const outTradeNo = this.generateOutTradeNo();

    // Create payment record
    const db = await getDb();
    const paymentId = randomUUID();
    const currentDate = new Date();

    await db.insert(payment).values({
      id: paymentId,
      priceId,
      type: PaymentTypes.ONE_TIME,
      scene: PaymentScenes.CREDIT,
      userId,
      customerId,
      sessionId: paymentId,
      invoiceId: outTradeNo,
      paid: false,
      status: 'processing',
      createdAt: currentDate,
      updatedAt: currentDate,
    });

    // Build payment parameters with custom param for credits info
    const payParams: Record<string, string> = {
      pid: this.pid,
      type: 'alipay',
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      return_url: successUrl || this.returnUrl,
      name: creditPackage.name || `${creditPackage.amount} Credits`,
      money: zpayAmount.toFixed(2),
      sign_type: 'MD5',
      param: JSON.stringify({ packageId, credits: creditPackage.amount }),
    };

    // Generate signature
    payParams.sign = this.generateSign(payParams);

    // Build payment URL
    const queryString = Object.entries(payParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    return {
      url: `${this.apiUrl}/submit.php?${queryString}`,
      id: outTradeNo,
    };
  }

  /**
   * Customer portal - not supported by zpay
   */
  public async createCustomerPortal(
    _params: CreatePortalParams
  ): Promise<PortalResult> {
    throw new Error(
      'Customer portal is not supported by zpay. Please contact support for subscription management.'
    );
  }

  /**
   * Handle webhook callback from zpay
   */
  public async handleWebhookEvent(
    payload: string,
    _signature: string
  ): Promise<void> {
    console.log('>> zpay webhook received');

    // Parse callback parameters
    let params: Record<string, string>;
    try {
      params = JSON.parse(payload);
    } catch {
      throw new Error('Invalid webhook payload');
    }

    // Verify signature
    if (!this.verifySign(params)) {
      console.error('zpay webhook signature verification failed');
      throw new Error('Invalid signature');
    }

    // Check trade status
    if (params.trade_status !== 'TRADE_SUCCESS') {
      console.log(
        'zpay webhook: trade not success, status:',
        params.trade_status
      );
      return;
    }

    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;
    const money = params.money;

    console.log('zpay webhook: processing payment', outTradeNo, tradeNo, money);

    // Use atomic update to prevent race condition
    // Only update if payment exists AND is not already paid
    const db = await getDb();
    const updateResult = await db
      .update(payment)
      .set({
        paid: true,
        status: 'completed',
        subscriptionId: tradeNo, // Store zpay trade_no in subscriptionId field
        updatedAt: new Date(),
      })
      .where(and(eq(payment.invoiceId, outTradeNo), eq(payment.paid, false)))
      .returning();

    // If no rows updated, check if it's because payment doesn't exist or already processed
    if (updateResult.length === 0) {
      const existingPayment = await db
        .select()
        .from(payment)
        .where(eq(payment.invoiceId, outTradeNo))
        .limit(1);

      if (existingPayment.length > 0 && existingPayment[0].paid) {
        console.log('Payment already processed:', outTradeNo);
        return;
      }

      console.error('Payment record not found for out_trade_no:', outTradeNo);
      throw new Error('Payment record not found');
    }

    const paymentRecord = updateResult[0];

    // Process credits/benefits
    if (paymentRecord.scene === PaymentScenes.CREDIT) {
      await this.processCreditPurchase(paymentRecord, params);
    } else if (paymentRecord.scene === PaymentScenes.LIFETIME) {
      await this.processLifetimePurchase(paymentRecord, money);
    }

    // Process referral rewards
    if (websiteConfig.referral?.enable) {
      await completeReferral(paymentRecord.userId);
    }

    console.log('<< zpay webhook processed successfully');
  }

  /**
   * Process credit package purchase - add credits to user
   */
  private async processCreditPurchase(
    paymentRecord: Payment,
    params: Record<string, string>
  ): Promise<void> {
    console.log('>> Process credit purchase');

    // Get credits info from custom param
    let packageId: string | undefined;
    let credits: number | undefined;

    if (params.param) {
      try {
        const customParams = JSON.parse(params.param);
        packageId = customParams.packageId;
        credits = customParams.credits;
      } catch {
        console.warn('Failed to parse custom params');
      }
    }

    if (!packageId || !credits) {
      console.warn('Missing packageId or credits in webhook params');
      return;
    }

    const creditPackage = getCreditPackageById(packageId);
    if (!creditPackage) {
      console.warn('Credit package not found:', packageId);
      return;
    }

    await addCredits({
      userId: paymentRecord.userId,
      amount: credits,
      type: CREDIT_TRANSACTION_TYPE.PURCHASE_PACKAGE,
      description: `+${credits} credits for package ${packageId} (¥${params.money})`,
      paymentId: paymentRecord.invoiceId || undefined,
      expireDays: creditPackage.expireDays,
    });

    console.log('<< Process credit purchase success');
  }

  /**
   * Process lifetime plan purchase - add lifetime credits
   */
  private async processLifetimePurchase(
    paymentRecord: Payment,
    money: string
  ): Promise<void> {
    console.log('>> Process lifetime plan purchase');

    if (websiteConfig.credits?.enableCredits) {
      await addLifetimeMonthlyCredits(
        paymentRecord.userId,
        paymentRecord.priceId
      );
      console.log('Added lifetime credits for user:', paymentRecord.userId);
    }

    // Send notification
    await sendNotification(
      paymentRecord.sessionId || '',
      paymentRecord.customerId,
      '',
      Number.parseFloat(money) || 0
    );

    console.log('<< Process lifetime plan purchase success');
  }
}
