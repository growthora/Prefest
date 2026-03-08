import React, { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { equipeDashboardNavItems, organizerDashboardNavItems } from './dashboard-nav-items';

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(isMobile);

  const roles = useMemo(() => (profile?.roles || []).map((role) => String(role).toUpperCase()), [profile?.roles]);
  const isEquipeOnly = roles.includes('EQUIPE') && !roles.includes('ORGANIZER') && !roles.includes('ADMIN');

  const navItems = isEquipeOnly ? equipeDashboardNavItems : organizerDashboardNavItems;
  const headerTitle = isEquipeOnly ? 'Equipe' : 'Gestão';

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <DashboardSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} navItems={navItems} headerTitle={headerTitle} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader navItems={navItems} headerTitle={headerTitle} />

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 md:p-8">
          <div className="mx-auto max-w-7xl w-full h-full flex flex-col">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
