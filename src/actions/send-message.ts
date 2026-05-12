'use server';

import { websiteConfig } from '@/config/website';
import { logger } from '@/lib/logger';
import { actionClient } from '@/lib/safe-action';
import { sendEmail } from '@/mail';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';

/**
 * DOC: When using Zod for validation, how can I localize error messages?
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#server-actions
 */
// Contact form schema for validation
const contactFormSchema = z.object({
  name: z
    .string()
    .min(3, { error: '姓名至少 3 个字符' })
    .max(30, { error: '姓名最多 30 个字符' }),
  email: z.email({ error: '请输入有效的邮箱地址' }),
  message: z
    .string()
    .min(10, { error: '消息至少 10 个字符' })
    .max(500, { error: '消息最多 500 个字符' }),
});

// Create a safe action for contact form submission
export const sendMessageAction = actionClient
  .schema(contactFormSchema)
  .action(async ({ parsedInput }) => {
    // Do not check if the user is authenticated here
    try {
      const { name, email, message } = parsedInput;

      if (!websiteConfig.mail.supportEmail) {
        logger.actions.error('The mail receiver is not set');
        throw new Error('The mail receiver is not set');
      }

      const locale = await getLocale();

      // Send message as an email to admin
      const result = await sendEmail({
        to: websiteConfig.mail.supportEmail,
        template: 'contactMessage',
        context: {
          name,
          email,
          message,
        },
        locale,
      });

      if (!result) {
        logger.actions.error('send message error');
        return {
          success: false,
          error: '发送消息失败',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      logger.actions.error('send message error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
