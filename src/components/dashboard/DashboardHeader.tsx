import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, Search, Menu, LogOut, Home } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Notifications } from '@/components/Notifications';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { dashboardNavItems } from './dashboard-nav-items';
import { cn } from '@/lib/utils';
import { ROUTE_PATHS } from '@/lib/index';
import { Separator } from '@/components/ui/separator';

interface DashboardHeaderProps {
  navItems?: typeof dashboardNavItems;
  headerTitle?: string;
}

export function DashboardHeader({ 
  navItems = dashboardNavItems,
  headerTitle = "Gestão"
}: DashboardHeaderProps) {
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate(ROUTE_PATHS.LOGIN);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Mobile Menu Trigger */}
      <div className="flex items-center gap-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 flex flex-col h-full">
            <SheetHeader className="h-16 flex items-center justify-start px-6 border-b shrink-0">
               <img 
                 src="/favicon.png" 
                 alt="Logo Prefest" 
                 className="h-12 w-auto object-contain"
               />
            </SheetHeader>
            <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
              <div className="px-3 mb-1 mt-2 text-xs font-semibold text-muted-foreground/70 tracking-wider uppercase">
                {headerTitle}
              </div>
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  end={item.href === ROUTE_PATHS.ORGANIZER_DASHBOARD || item.href === ROUTE_PATHS.ADMIN_DASHBOARD}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive 
                        ? "bg-primary/10 text-primary font-medium shadow-sm" 
                        : "text-muted-foreground"
                    )
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-3 mt-auto space-y-2 border-t">
               <NavLink
                  to={ROUTE_PATHS.HOME}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Home className="w-5 h-5 flex-shrink-0" />
                  <span>Voltar para Início</span>
                </NavLink>
                <button
                  onClick={() => {
                    setOpen(false);
                    handleSignOut();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span>Sair</span>
                </button>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Centered Logo for Mobile */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden">
           <img 
            src="/favicon.png" 
            alt="Logo Prefest" 
            className="h-10 w-auto object-contain"
          />
        </div>
      </div>

      {/* Search (Desktop) */}
      <div className="flex-1 max-w-md hidden md:flex items-center relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar eventos, participantes..."
          className="pl-9 w-full bg-muted/50 focus:bg-background transition-colors focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Search Toggle (Mobile) - Optional, simpler to just hide for now or use a modal */}
        <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground">
          <Search className="h-5 w-5" />
        </Button>

        <Notifications />

        <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-border ml-2">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-medium leading-none">
              {profile?.full_name || user?.email || 'Organizador'}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {isAdmin ? 'Administrador' : 'Organizador'}
              </Badge>
            </div>
          </div>
          
          <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-border cursor-pointer transition-opacity hover:opacity-80">
            <AvatarImage src={profile?.avatar_url || user?.photo || ''} alt={profile?.full_name || 'Avatar'} />
            <AvatarFallback>{getInitials(profile?.full_name || user?.name || 'O')}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
