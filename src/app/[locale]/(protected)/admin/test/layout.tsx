import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { isDemoWebsite } from '@/lib/demo';
import { getSession } from '@/lib/server';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

interface AdminTestLayoutProps {
  children: ReactNode;
}

export default async function AdminTestLayout({
  children,
}: AdminTestLayoutProps) {
  const isDemo = isDemoWebsite();
  const session = await getSession();

  if (!session || (session.user.role !== 'admin' && !isDemo)) {
    notFound();
  }

  const t = await getTranslations('Dashboard.admin');

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          {
            label: t('title'),
            isCurrentPage: false,
          },
          {
            label: t('test.title'),
            isCurrentPage: true,
          },
        ]}
      />

      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
