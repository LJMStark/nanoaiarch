import { logger } from '@/lib/logger';

/**
 * Send a message to Feishu when a user makes a purchase
 * @param sessionId The Stripe checkout session ID
 * @param customerId The Stripe customer ID
 * @param userName The username of the customer
 * @param amount The purchase amount in the currency's main unit (e.g., dollars, not cents)
 */
export async function sendMessageToFeishu(
  sessionId: string,
  customerId: string,
  userName: string,
  amount: number
): Promise<void> {
  try {
    const webhookUrl = process.env.FEISHU_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.general.warn(
        'FEISHU_WEBHOOK_URL is not set, skipping Feishu notification'
      );
      return;
    }

    // Format the message
    const message = {
      msg_type: 'text',
      content: {
        text: `🎉 New Purchase\nUsername: ${userName}\nAmount: $${amount.toFixed(2)}\nCustomer ID: ${customerId}\nSession ID: ${sessionId}`,
      },
    };

    // Send the webhook request
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      logger.general.error(
        'Failed to send Feishu notification',
        new Error(`Response not ok for user ${userName}`),
        { status: response.status, userName }
      );
    } else {
      logger.general.info('Successfully sent Feishu notification', {
        userName,
      });
    }
  } catch (error) {
    logger.general.error('Failed to send Feishu notification', error);
    // Don't rethrow the error to avoid interrupting the payment flow
  }
}
