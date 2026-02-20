import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Ticket, ShoppingCart } from 'lucide-react';
import { eventService, type TicketTypeDB } from '@/services/event.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface TicketSelectorProps {
  eventId: string;
  onSelect: (ticketTypeId: string, ticketType: TicketTypeDB) => void;
  selectedTicketTypeId?: string;
  onLoaded?: (ticketTypes: TicketTypeDB[]) => void;
}

export function TicketSelector({ eventId, onSelect, selectedTicketTypeId, onLoaded }: TicketSelectorProps) {
  const [ticketTypes, setTicketTypes] = useState<TicketTypeDB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTicketTypes();
  }, [eventId]);

  const loadTicketTypes = async () => {
    try {
      setLoading(true);
      const types = await eventService.getEventTicketTypes(eventId);
      setTicketTypes(types);
      if (onLoaded) {
        onLoaded(types);
      }
      
      // Auto-selecionar se houver apenas um tipo
      if (types.length === 1 && !selectedTicketTypeId) {
        onSelect(types[0].id, types[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de ingressos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityText = (ticket: TicketTypeDB) => {
    const available = ticket.quantity_available - ticket.quantity_sold;
    const percentage = (available / ticket.quantity_available) * 100;
    
    if (percentage <= 10) {
      return { text: `Últimas ${available} unidades!`, color: 'text-red-500', urgent: true };
    } else if (percentage <= 30) {
      return { text: `${available} disponíveis`, color: 'text-orange-500', urgent: false };
    }
    return { text: `${available} disponíveis`, color: 'text-muted-foreground', urgent: false };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5" />
            Carregando opções...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (ticketTypes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5" />
            Nenhum ingresso disponível
          </CardTitle>
          <CardDescription>
            Os ingressos para este evento esgotaram ou ainda não estão disponíveis.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Selecione seu Ingresso
        </CardTitle>
        <CardDescription>
          Escolha o tipo de ingresso que deseja adquirir
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup 
          value={selectedTicketTypeId} 
          onValueChange={(value) => {
            const ticket = ticketTypes.find(t => t.id === value);
            if (ticket) onSelect(value, ticket);
          }}
          className="space-y-3"
        >
          {ticketTypes.map((ticket) => {
            const availability = getAvailabilityText(ticket);
            const isSelected = selectedTicketTypeId === ticket.id;
            
            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Label
                  htmlFor={ticket.id}
                  className={cn(
                    "flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md",
                    isSelected 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={ticket.id} id={ticket.id} className="mt-1" />
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-semibold text-lg flex items-center gap-2">
                          {ticket.name}
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        {ticket.description && (
                          <p className="text-sm text-muted-foreground">
                            {ticket.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold text-primary">
                          R$ {ticket.price.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between text-sm">
                      <span className={cn("font-medium", availability.color)}>
                        {availability.urgent && "🔥 "}
                        {availability.text}
                      </span>
                      
                      {availability.urgent && (
                        <Badge variant="destructive" className="animate-pulse">
                          Últimas unidades
                        </Badge>
                      )}
                    </div>
                  </div>
                </Label>
              </motion.div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
