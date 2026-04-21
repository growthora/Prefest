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
  isSalesClosedByDate?: boolean;
  isEventCanceled?: boolean;
  isSalesDisabled?: boolean;
}

export function TicketSelector({
  eventId,
  onSelect,
  selectedTicketTypeId,
  onLoaded,
  isSalesClosedByDate = false,
  isEventCanceled = false,
  isSalesDisabled = false
}: TicketSelectorProps) {
  const [ticketTypes, setTicketTypes] = useState<TicketTypeDB[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizeTicketText = (value?: string | null) => {
    if (!value) return '';

    try {
      return value
        .replace(/padrão/gi, 'padrão')
        .replace(/não/gi, 'não')
        .replace(/opção/gi, 'opção');
    } catch {
      return value;
    }
  };

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
      if (types.length === 1 && !selectedTicketTypeId && !isSalesClosedByDate && !isEventCanceled && !isSalesDisabled) {
        onSelect(types[0].id, types[0]);
      }
    } catch (error) {
      // console.error('Error loading ticket types:', error);
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

  if (isEventCanceled) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Ticket className="w-5 h-5" />
            Evento cancelado
          </CardTitle>
          <CardDescription className="text-red-600/80">
            Este evento foi cancelado e não aceita novas compras de ingressos.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isSalesClosedByDate) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <Ticket className="w-5 h-5" />
            Venda de ingressos encerrada
          </CardTitle>
          <CardDescription className="text-amber-700/90">
            Este evento atingiu a data de término e não aceita novas compras de ingressos.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isSalesDisabled) {
    return null;
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
                  
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold text-base md:text-lg flex flex-wrap items-center gap-2 leading-snug">
                        <span className="min-w-0 break-words">
                          {normalizeTicketText(ticket.name)}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="text-lg md:text-2xl font-bold text-primary leading-none">
                        R$ {ticket.price.toFixed(2)}
                      </div>
                      {ticket.description && (
                        <p className="text-sm text-muted-foreground">
                          {normalizeTicketText(ticket.description)}
                        </p>
                      )}
                    </div>

                    <Separator className="my-1.5" />

                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm">
                      <span className={cn("font-medium leading-snug", availability.color)}>
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
