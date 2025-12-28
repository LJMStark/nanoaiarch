import type { PropsWithChildren } from 'react';

export default function PageLayout({ children }: PropsWithChildren) {
  // AI image page uses its own full-screen layout
  return <>{children}</>;
}
