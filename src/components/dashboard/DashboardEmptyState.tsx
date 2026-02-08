import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateEventModal } from '@/components/CreateEventModal';

interface DashboardEmptyStateProps {
  title?: string;
  description?: string;
  showCreateButton?: boolean;
}

export function DashboardEmptyState({ 
  title = "Comece sua jornada como organizador", 
  description = "Você ainda não criou nenhum evento. Crie seu primeiro evento agora e comece a vender ingressos.",
  showCreateButton = true
}: DashboardEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 p-4 animate-in fade-in zoom-in duration-300">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center ring-8 ring-primary/5">
        <Calendar className="w-12 h-12 text-primary" />
      </div>
      
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-lg leading-relaxed">
          {description}
        </p>
      </div>

      {showCreateButton && (
        <CreateEventModal 
          trigger={
            <Button size="lg" className="gap-2 h-12 px-8 text-base shadow-lg hover:shadow-primary/25 transition-all">
              <Plus className="w-5 h-5" />
              Criar meu primeiro evento
            </Button>
          }
        />
      )}
    </div>
  );
}
