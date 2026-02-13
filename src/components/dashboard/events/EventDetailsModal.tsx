import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar, MapPin, Users, DollarSign, Tag, Clock } from 'lucide-react';
import type { Event } from '@/services/event.service';

interface EventDetailsModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EventDetailsModal({ event, isOpen, onClose }: EventDetailsModalProps) {
  if (!event) return null;

  const isActive = new Date(event.event_date) > new Date();
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-bold truncate pr-8">
              {event.title}
            </DialogTitle>
            <Badge variant={isActive ? "default" : "secondary"} className="shrink-0">
              {isActive ? "Ativo" : "Realizado"}
            </Badge>
          </div>
          <DialogDescription>
            ID: {event.id}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-2">
          <div className="space-y-6 pb-6">
            {/* Image Banner */}
            {event.image_url && (
              <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
                <img 
                  src={event.image_url} 
                  alt={event.title} 
                  className="object-cover w-full h-full"
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Sobre o evento</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {event.description || "Sem descrição disponível."}
              </p>
            </div>

            <Separator />

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Data e Hora</span>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(event.event_date)}
                  </p>
                  {event.end_at && (
                    <p className="text-xs text-muted-foreground">
                      Até {formatDate(event.end_at)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Localização</span>
                  <p className="text-sm text-muted-foreground">
                    {event.location}
                  </p>
                  {event.city && event.state && (
                    <p className="text-xs text-muted-foreground">
                      {event.city} - {event.state}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Participantes</span>
                  <p className="text-sm text-muted-foreground">
                    {event.current_participants} / {event.max_participants || 'Ilimitado'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Preço</span>
                  <p className="text-sm text-muted-foreground">
                    {event.price > 0 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.price)
                      : 'Gratuito'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Categoria</span>
                  <p className="text-sm text-muted-foreground capitalize">
                    {event.category || event.event_type}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                 <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                 <div className="space-y-1">
                   <span className="text-sm font-medium">Status</span>
                   <p className="text-sm text-muted-foreground capitalize">
                     {event.status === 'published' ? 'Publicado' : 'Rascunho'}
                   </p>
                 </div>
               </div>
            </div>
            
            <Separator />
            
            {/* Timestamps */}
            <div className="flex flex-col sm:flex-row gap-4 text-xs text-muted-foreground">
              <span>Criado em: {new Date(event.created_at).toLocaleDateString()}</span>
              <span>Atualizado em: {new Date(event.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-2 border-t">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
