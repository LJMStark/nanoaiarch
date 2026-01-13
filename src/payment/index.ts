import { ZpayProvider } from './provider/zpay';
import type {
  CheckoutResult,
  CreateCheckoutParams,
  CreateCreditCheckoutParams,
  PaymentProvider,
} from './types';

/**
 * Global payment provider instance (Zpay only)
 */
let paymentProvider: PaymentProvider | null = null;

/**
 * Get the payment provider
 * @returns current payment provider instance
 */
export const getPaymentProvider = (): PaymentProvider => {
  if (!paymentProvider) {
    return initializePaymentProvider();
  }
  return paymentProvider;
};

/**
 * Initialize the payment provider (Zpay only)
 * @returns initialized payment provider
 */
export const initializePaymentProvider = (): PaymentProvider => {
  if (!paymentProvider) {
    paymentProvider = new ZpayProvider();
  }
  return paymentProvider;
};

/**
 * Create a checkout session for a plan
 * @param params Parameters for creating the checkout session
 * @returns Checkout result
 */
export const createCheckout = async (
  params: CreateCheckoutParams
): Promise<CheckoutResult> => {
  const provider = getPaymentProvider();
  return provider.createCheckout(params);
};

/**
 * Create a checkout session for a credit package
 * @param params Parameters for creating the checkout session
 * @returns Checkout result
 */
export const createCreditCheckout = async (
  params: CreateCreditCheckoutParams
): Promise<CheckoutResult> => {
  const provider = getPaymentProvider();
  return provider.createCreditCheckout(params);
};

/**
 * Handle webhook event
 * @param payload Raw webhook payload
 * @param signature Webhook signature
 */
export const handleWebhookEvent = async (
  payload: string,
  signature: string
): Promise<void> => {
  const provider = getPaymentProvider();
  await provider.handleWebhookEvent(payload, signature);
};
