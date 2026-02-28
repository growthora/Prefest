import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Home, 
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ROUTE_PATHS } from '@/lib/index';
import { useAuth } from '@/hooks/useAuth';
import { dashboardNavItems } from './dashboard-nav-items';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  isCollapsed: boolean;
}

const SidebarItem = ({ icon: Icon, label, to, isCollapsed }: SidebarItemProps) => {
  return (
    <NavLink
      to={to}
      end={to === ROUTE_PATHS.ORGANIZER_DASHBOARD} // Exact match for root dashboard route
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
          "hover:bg-accent hover:text-accent-foreground",
          isActive 
            ? "bg-primary/10 text-primary font-medium shadow-sm" 
            : "text-muted-foreground",
          isCollapsed ? "justify-center" : "justify-start"
        )
      }
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110", isCollapsed ? "w-6 h-6" : "")} />
      
      {!isCollapsed && (
        <span className="truncate">{label}</span>
      )}

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity animate-in fade-in zoom-in-95 duration-200">
          {label}
        </div>
      )}
    </NavLink>
  );
};

interface DashboardSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  className?: string;
  navItems?: typeof dashboardNavItems;
  headerTitle?: string;
}

export function DashboardSidebar({ 
  isCollapsed, 
  toggleSidebar, 
  className,
  navItems = dashboardNavItems,
  headerTitle = "Gestão"
}: DashboardSidebarProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate(ROUTE_PATHS.LOGIN);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside 
      className={cn(
        "bg-card border-r border-border h-screen sticky top-0 hidden md:flex flex-col transition-all duration-300 ease-in-out z-30 shadow-sm relative",
        isCollapsed ? "w-[80px]" : "w-[260px]",
        className
      )}
    >
      {/* Header / Logo */}
      <div className={cn("h-20 flex items-center shrink-0 relative border-b border-border/50", isCollapsed ? "justify-center" : "justify-start px-6")}>
         <img 
          src="/favicon.png" 
          alt="Logo Prefest" 
          className={cn("object-contain transition-all duration-300", isCollapsed ? "h-8 w-auto" : "h-14 w-auto")}
        />
      </div>

      {/* Toggle Button (Absolute on border) */}
      <Button 
        variant="outline" 
        size="icon" 
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 translate-y-[-50%] h-6 w-6 rounded-full border shadow-sm z-50 bg-background hover:bg-accent text-muted-foreground"
        aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-1">
        
        {!isCollapsed && (
          <div className="px-3 mb-1 mt-2 text-xs font-semibold text-muted-foreground/70 tracking-wider uppercase">
            {headerTitle}
          </div>
        )}

        {navItems.map((item) => (
          <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.title}
            to={item.href}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-3 mt-auto space-y-2 shrink-0">
        <Separator className="mb-2" />
        
        <NavLink
          to={ROUTE_PATHS.HOME}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-muted-foreground hover:bg-accent hover:text-accent-foreground group relative",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          <Home className={cn("w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110", isCollapsed ? "w-6 h-6" : "")} />
          {!isCollapsed && <span>Voltar para Início</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              Voltar para Início
            </div>
          )}
        </NavLink>

        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 group relative",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          <LogOut className={cn("w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110", isCollapsed ? "w-6 h-6" : "")} />
          {!isCollapsed && <span>Sair</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              Sair
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
