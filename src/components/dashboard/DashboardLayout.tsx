import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(isMobile);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar - Occupies its own space in flex flow */}
      <DashboardSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader />
        
        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 md:p-8">
          <div className="mx-auto max-w-7xl w-full h-full flex flex-col">
            {/* The Outlet will render the current dashboard page */}
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
