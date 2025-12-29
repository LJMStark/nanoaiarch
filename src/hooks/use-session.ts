import { authClient } from '@/lib/auth-client';
import { logger } from '@/lib/logger';

export const useSession = () => {
  const { data: session, error } = authClient.useSession();
  if (error) {
    logger.auth.error('useSession, error:', error);
    return null;
  }
  return session;
};
