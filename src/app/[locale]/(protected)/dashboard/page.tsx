import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentGenerations } from '@/components/dashboard/recent-generations';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { useTranslations } from 'next-intl';

/**
 * Dashboard page
 *
 * Shows user's generation statistics, quick actions, and recent generations
 */
export default function DashboardPage() {
  const t = useTranslations();

  const breadcrumbs = [
    {
      label: t('Dashboard.dashboard.title'),
      isCurrentPage: true,
    },
  ];

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />

      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-6">
          <div className="flex flex-col gap-6 py-4 md:py-6">
            {/* Stats Cards */}
            <StatsCards />

            {/* Quick Actions */}
            <QuickActions />

            {/* Recent Generations */}
            <RecentGenerations />
          </div>
        </div>
      </div>
    </>
  );
}
