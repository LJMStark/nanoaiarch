'use client';

import { SidebarMain } from '@/components/dashboard/sidebar-main';
import { SidebarUser } from '@/components/dashboard/sidebar-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useSidebarLinks } from '@/config/sidebar-config';
import { LocaleLink } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { Routes } from '@/routes';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Logo } from '../layout/logo';
import { UpgradeCard } from './upgrade-card';

/**
 * Dashboard sidebar
 */
export function DashboardSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations();
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;
  const { state } = useSidebar();
  // console.log('sidebar currentUser:', currentUser);

  const sidebarLinks = useSidebarLinks();
  const filteredSidebarLinks = sidebarLinks.filter((link) => {
    if (link.authorizeOnly) {
      return link.authorizeOnly.includes(currentUser?.role || '');
    }
    return true;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Sidebar collapsible="icon" className="pt-2 md:pt-3" {...props}>
      <SidebarHeader className="px-3 pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!gap-3 data-[slot=sidebar-menu-button]:!px-3 data-[slot=sidebar-menu-button]:!py-3"
            >
              <LocaleLink href={Routes.Root}>
                <Logo className="size-5" />
                <span className="font-bricolage-grotesque truncate text-lg font-semibold tracking-[-0.04em]">
                  {t('Metadata.name')}
                </span>
              </LocaleLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {!isPending && mounted && <SidebarMain items={filteredSidebarLinks} />}
      </SidebarContent>

      <SidebarFooter className="flex flex-col gap-4 px-3 pb-3">
        {/* Only show UI components when not in loading state */}
        {!isPending && mounted && (
          <>
            {/* show upgrade card if user is not a member, and sidebar is not collapsed */}
            {currentUser && state !== 'collapsed' && <UpgradeCard />}

            {/* show user profile if user is logged in */}
            {currentUser && <SidebarUser user={currentUser} />}
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
