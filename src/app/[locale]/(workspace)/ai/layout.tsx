import type { PropsWithChildren } from 'react';

export default function AILayout({ children }: PropsWithChildren) {
  // AI image page uses its own full-screen layout
  return <>{children}</>;
}
