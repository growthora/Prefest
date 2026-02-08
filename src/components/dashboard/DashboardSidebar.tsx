import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  TrendingUp, 
  Users, 
  Wallet, 
  Settings, 
  Home, 
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ROUTE_PATHS } from '@/lib/index';
import { useAuth } from '@/hooks/useAuth';

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
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
          "hover:bg-accent hover:text-accent-foreground",
          isActive 
            ? "bg-primary/10 text-primary font-medium" 
            : "text-muted-foreground",
          isCollapsed ? "justify-center" : "justify-start"
        )
      }
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0", isCollapsed ? "w-6 h-6" : "")} />
      
      {!isCollapsed && (
        <span className="truncate">{label}</span>
      )}

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
          {label}
        </div>
      )}
    </NavLink>
  );
};

interface DashboardSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export function DashboardSidebar({ isCollapsed, toggleSidebar }: DashboardSidebarProps) {
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
        "bg-card border-r border-border h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out z-30",
        isCollapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Header / Toggle */}
      <div className="h-16 flex items-center px-4 border-b border-border justify-between">
        {!isCollapsed && (
          <span className="font-bold text-lg text-primary truncate">
            Painel Organizador
          </span>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className={cn("ml-auto", isCollapsed && "mx-auto")}
          aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2 p-3 overflow-y-auto scrollbar-thin">
        <SidebarItem 
          icon={LayoutDashboard} 
          label="Visão Geral" 
          to={ROUTE_PATHS.ORGANIZER_DASHBOARD} 
          isCollapsed={isCollapsed} 
        />
        <SidebarItem 
          icon={Calendar} 
          label="Meus Eventos" 
          to={ROUTE_PATHS.ORGANIZER_EVENTS} 
          isCollapsed={isCollapsed} 
        />
        <SidebarItem 
          icon={TrendingUp} 
          label="Vendas" 
          to={ROUTE_PATHS.ORGANIZER_SALES} 
          isCollapsed={isCollapsed} 
        />
        <SidebarItem 
          icon={Users} 
          label="Participantes" 
          to={ROUTE_PATHS.ORGANIZER_PARTICIPANTS} 
          isCollapsed={isCollapsed} 
        />
        <SidebarItem 
          icon={Wallet} 
          label="Meus Pagamentos" 
          to={ROUTE_PATHS.ORGANIZER_PAYMENTS} 
          isCollapsed={isCollapsed} 
        />
        <SidebarItem 
          icon={Settings} 
          label="Configurações" 
          to={ROUTE_PATHS.ORGANIZER_SETTINGS} 
          isCollapsed={isCollapsed} 
        />
      </nav>

      {/* Footer Actions */}
      <div className="p-3 mt-auto space-y-2">
        <Separator className="mb-2" />
        
        <NavLink
          to={ROUTE_PATHS.HOME}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-muted-foreground hover:bg-accent hover:text-accent-foreground group relative",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          <Home className={cn("w-5 h-5 flex-shrink-0", isCollapsed ? "w-6 h-6" : "")} />
          {!isCollapsed && <span>Voltar para Início</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              Voltar para Início
            </div>
          )}
        </NavLink>

        {/* Optional Logout for easy access */}
        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 group relative",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          <LogOut className={cn("w-5 h-5 flex-shrink-0", isCollapsed ? "w-6 h-6" : "")} />
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
