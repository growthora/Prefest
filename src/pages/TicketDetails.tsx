import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { eventService } from '@/services/event.service';
import TicketQRCode from '@/components/TicketQRCode';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { GlobalLoader } from '@/components/GlobalLoader';

export default function TicketDetails() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ticketId && user) loadTicket();
  }, [ticketId, user]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      if (!user) return;
      // Reutilizando getUserTickets para garantir consistência e segurança via RLS
      const tickets = await eventService.getUserTickets(user.id);
      const found = tickets.find(t => t.id === ticketId);
      
      if (found) {
        setTicket(found);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <GlobalLoader />;
  
  if (!ticket) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-semibold mb-2">Ingresso não encontrado</h2>
        <p className="text-muted-foreground mb-4">
          Não conseguimos encontrar este ingresso. Verifique se você está logado na conta correta.
        </p>
        <Button onClick={() => navigate('/meus-eventos')}>
          Ver meus eventos
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="pl-0 hover:bg-transparent">
          <ArrowLeft className="mr-2 h-5 w-5" />
          <span className="text-lg">Voltar</span>
        </Button>
      </div>
      
      <h1 className="text-2xl font-bold mb-6 px-1">Seu Ingresso</h1>
      
      <div className="max-w-md mx-auto">
        <TicketQRCode
          ticketId={ticket.id}
          eventId={ticket.event.id}
          ticketToken={ticket.security_token || ''}
          ticketCode={ticket.ticket_code}
          status={ticket.status || 'valid'}
          checkInAt={ticket.check_in_at}
          eventTitle={ticket.event.title}
          eventDate={ticket.event.event_date}
          eventLocation={ticket.event.location}
          isEventRealized={ticket.event.status === 'realizado'}
        />
      </div>
    </div>
  );
}
