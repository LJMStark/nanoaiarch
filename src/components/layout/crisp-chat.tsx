'use client';

import { websiteConfig } from '@/config/website';
import { Crisp } from 'crisp-sdk-web';
import { useEffect } from 'react';

/**
 * Crisp chat component
 * https://crisp.chat/en/
 * https://help.crisp.chat/en/article/how-do-i-install-crisp-live-chat-on-nextjs-xh9yse/
 */
const CrispChat = () => {
  useEffect(() => {
    if (!websiteConfig.features.enableCrispChat) {
      return;
    }

    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!websiteId) {
      return;
    }

    try {
      Crisp.configure(websiteId);
    } catch {
      // Crisp initialization failed silently
    }
  }, []);

  return null;
};

export default CrispChat;
