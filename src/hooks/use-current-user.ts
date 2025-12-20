import { authClient } from '@/lib/auth-client';

export const useCurrentUser = () => {
  const { data: session, error } = authClient.useSession();

  // 只在 error 有实际内容时记录（空对象 {} 表示未登录，不是错误）
  if (error && Object.keys(error).length > 0) {
    console.error('useCurrentUser, error:', error);
  }

  return session?.user ?? null;
};
