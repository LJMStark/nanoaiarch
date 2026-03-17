import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import type { ReactNode } from 'react';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar scroll={true} />
      <main id="main-content" className="relative z-10 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
