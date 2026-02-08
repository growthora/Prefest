import React from 'react';
import { Bell, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Notifications } from '@/components/Notifications';

export function DashboardHeader() {
  const { user, profile } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 px-6 flex items-center justify-between gap-4">
      {/* Search (Optional - Placeholder) */}
      <div className="flex-1 max-w-md hidden md:flex items-center relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar eventos, participantes..."
          className="pl-9 w-full bg-muted/50 focus:bg-background transition-colors"
        />
      </div>
      <div className="flex-1 md:hidden" />

      {/* Right Side Actions */}
      <div className="flex items-center gap-4">
        <Notifications />

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-medium leading-none">
              {profile?.full_name || user?.email || 'Organizador'}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                Organizador
              </Badge>
            </div>
          </div>
          
          <Avatar className="h-9 w-9 border border-border cursor-pointer transition-opacity hover:opacity-80">
            <AvatarImage src={profile?.avatar_url || user?.photo || ''} alt={profile?.full_name || 'Avatar'} />
            <AvatarFallback>{getInitials(profile?.full_name || user?.name || 'O')}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
