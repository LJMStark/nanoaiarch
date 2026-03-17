import { PendingReferralRecovery } from '@/components/auth/pending-referral-recovery';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import { OnboardingProvider } from '@/components/onboarding';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { routing } from '@/i18n/routing';
import { getSession } from '@/lib/server';
import { Routes } from '@/routes';
import type { Locale } from 'next-intl';
import { redirect } from 'next/navigation';
import type { PropsWithChildren } from 'react';

interface DashboardLayoutProps extends PropsWithChildren {
  params: Promise<{ locale: Locale }>;
}

function getLocaleHref(locale: Locale, route: string): string {
  return locale === routing.defaultLocale ? route : `/${locale}${route}`;
}

/**
 * inspired by dashboard-01
 * https://ui.shadcn.com/blocks
 */
export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect(getLocaleHref(locale, Routes.Login));
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <DashboardSidebar variant="inset" />

      <SidebarInset id="main-content" className="overflow-hidden">
        <PendingReferralRecovery />
        {children}
      </SidebarInset>

      <OnboardingProvider>{null}</OnboardingProvider>
    </SidebarProvider>
  );
}
