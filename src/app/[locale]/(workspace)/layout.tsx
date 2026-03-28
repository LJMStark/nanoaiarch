import type { ReactNode } from 'react';

/**
 * Workspace layout: no global Navbar/Footer.
 * Full-screen layouts like the AI Image workbench live here
 * so they are not constrained by marketing layout stacking context.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
