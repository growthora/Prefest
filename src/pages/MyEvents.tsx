import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { eventService, EventParticipant, Event } from '@/services/event.service';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Ticket, Heart, Clock, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GlobalLoader } from '@/components/GlobalLoader';

type TicketWithEvent = EventParticipant & { event: Event };

const EventCard = ({ ticket, isPast = false, navigate }: { ticket: TicketWithEvent, isPast?: boolean, navigate: (path: string) => void }) => {
  const event = ticket.event;
  
  return (
      <Card className={`overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md ${isPast ? 'opacity-90' : ''}`}>
          <div className="h-32 bg-muted relative">
              {event.image_url ? (
                  <img src={event.image_url} alt={event.title} className={`w-full h-full object-cover ${isPast ? 'grayscale' : ''}`} />
              ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Ticket className="h-10 w-10 text-secondary-foreground/20" />
                  </div>
              )}
              
              {isPast && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                      <Badge variant="secondary" className="text-sm font-medium px-3 py-1 shadow-sm">
                        Evento Realizado
                      </Badge>
                  </div>
              )}
              
              {!isPast && (
                <div className="absolute top-2 right-2">
                    <Badge className="bg-green-500/90 hover:bg-green-500 text-white border-none shadow-sm">
                        Confirmado
                    </Badge>
                </div>
              )}
          </div>
          
          <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-3 line-clamp-1">{event.title}</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="capitalize">
                        {format(new Date(event.event_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </span>
                  </div>
                  <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>
                        {format(new Date(event.event_date), "HH:mm", { locale: ptBR })}
                      </span>
                  </div>
                  <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="line-clamp-1">{event.location}</span>
                  </div>
              </div>
          </CardContent>
          
          <CardFooter className="p-4 pt-0 grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full hover:bg-secondary/50" 
                onClick={() => navigate(`/ingressos/${ticket.id}`)}
              >
                  <Ticket className="mr-2 h-4 w-4" />
                  Ver Ingresso
              </Button>
              <Button 
                className="w-full bg-primary hover:bg-primary/90" 
                onClick={() => navigate(`/eventos/${event.id}/matchs`)}
              >
                  <Heart className="mr-2 h-4 w-4 fill-current" />
                  Ver Matchs
              </Button>
          </CardFooter>
      </Card>
  );
};

export default function MyEvents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!user) return;
      const data = await eventService.getUserTickets(user.id);
      // Ordenar: Futuros primeiro, depois realizados (mais recentes primeiro)
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.event.event_date).getTime();
        const dateB = new Date(b.event.event_date).getTime();
        return dateB - dateA; // Decrescente
      });
      setTickets(sorted);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar por evento para exibir um card por evento
  const uniqueEventsMap = new Map();
  tickets.forEach(t => {
      if (!uniqueEventsMap.has(t.event.id)) {
          uniqueEventsMap.set(t.event.id, t);
      }
  });
  
  const uniqueTickets = Array.from(uniqueEventsMap.values());
  
  const upcomingEvents = uniqueTickets.filter(t => t.event.status !== 'realizado');
  const pastEvents = uniqueTickets.filter(t => t.event.status === 'realizado');

  if (loading) return <GlobalLoader />;

  return (
    <div className="container max-w-md mx-auto p-4 pb-24 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 px-1">Meus Eventos</h1>
      
      {uniqueTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted p-4 rounded-full mb-4">
              <Ticket className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">Nenhum evento encontrado</h3>
            <p className="text-muted-foreground mt-2 mb-6 max-w-xs">
              Você ainda não comprou ingressos para nenhum evento.
            </p>
            <Button onClick={() => navigate('/explorar-eventos')}>
              Explorar Eventos
            </Button>
        </div>
      ) : (
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="upcoming">Próximos</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((ticket) => (
                <EventCard key={ticket.id} ticket={ticket} navigate={navigate} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum evento próximo.</p>
                <Button variant="link" onClick={() => navigate('/explorar-eventos')}>
                  Explorar novos eventos
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {pastEvents.length > 0 ? (
              pastEvents.map((ticket) => (
                <EventCard key={ticket.id} ticket={ticket} isPast={true} navigate={navigate} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum evento realizado.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
