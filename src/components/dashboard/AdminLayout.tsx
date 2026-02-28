import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { adminNavItems } from './admin-nav-items';

export function AdminLayout() {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(isMobile);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <DashboardSidebar 
        isCollapsed={isCollapsed} 
        toggleSidebar={toggleSidebar} 
        navItems={adminNavItems}
        headerTitle="Administração"
      />

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader 
          navItems={adminNavItems}
          headerTitle="Administração"
        />
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 md:p-8">
          <div className="mx-auto max-w-7xl w-full h-full flex flex-col">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
