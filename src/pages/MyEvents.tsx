import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, Heart, Ticket, Filter, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { ROUTE_PATHS } from '@/lib/index';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { eventService, EventParticipant, Event } from '@/services/event.service';
import { IMAGES } from '@/assets/images';
import { toast } from 'sonner';
import TicketQRCode from '@/components/TicketQRCode';

interface UserEvent {
  id: string;
  slug?: string;
  title: string;
  event_date: string;
  location: string;
  image_url: string | null;
  current_participants: number;
  price: number;
  category: string | null;
  event_type?: 'festive' | 'formal';
}

type TicketWithEvent = EventParticipant & { event: Event };

export default function MyEvents() {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState('all');
  const [userEvents, setUserEvents] = useState<UserEvent[]>([]);
  const [userTickets, setUserTickets] = useState<TicketWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tickets');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) {
      console.log('⚠️ Sem usuário logado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Carregando dados do usuário:', user.id);
      
      // Load events for "Match do Evento"
      const events = await eventService.getUserEvents(user.id);
      setUserEvents(events);

      // Load tickets for "Meus Ingressos"
      const tickets = await eventService.getUserTickets(user.id);
      setUserTickets(tickets);

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast.error('Erro ao carregar seus dados');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = userEvents
    .filter(event => {
      const eventDate = new Date(event.event_date);
      const now = new Date();
      
      if (filter === 'upcoming') return eventDate >= now;
      if (filter === 'past') return eventDate < now;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.event_date).getTime();
      const dateB = new Date(b.event_date).getTime();
      return dateA - dateB;
    });

  const filteredTickets = userTickets
    .filter(ticket => {
      if (!ticket.event) return false;
      const eventDate = new Date(ticket.event.event_date);
      const now = new Date();
      
      if (filter === 'upcoming') return eventDate >= now;
      if (filter === 'past') return eventDate < now;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.event!.event_date).getTime();
      const dateB = new Date(b.event!.event_date).getTime();
      return dateA - dateB;
    });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 lg:mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-6 mb-6 lg:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-2">Meus Eventos</h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                Gerencie seus ingressos e conecte-se com outros participantes
              </p>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar eventos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  <SelectItem value="upcoming">Próximos</SelectItem>
                  <SelectItem value="past">Passados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {profile?.single_mode && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-primary fill-current" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">Conhecer a galera ativo 🔥</h3>
                  <p className="text-sm text-muted-foreground">
                    Você pode acessar a aba de solteiros em qualquer evento que participar
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="events">Match do Evento</TabsTrigger>
              <TabsTrigger value="tickets">Meus Ingressos</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {activeTab === 'tickets' ? (
          loading ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Ticket className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Carregando seus ingressos...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                <Ticket className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhum ingresso encontrado</h3>
              <p className="text-muted-foreground mb-6">
                Você ainda não tem ingressos para eventos.
              </p>
              <Button asChild>
                <Link to={ROUTE_PATHS.HOME}>
                  Explorar Eventos
                </Link>
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTickets.map((ticket, index) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <TicketQRCode 
                    ticketId={ticket.id}
                    eventId={ticket.event_id}
                    ticketToken={ticket.ticket_token || ''}
                    ticketCode={ticket.ticket_code}
                    status={ticket.status || 'valid'}
                    checkInAt={ticket.check_in_at}
                    eventTitle={ticket.event?.title || 'Evento'}
                    eventDate={ticket.event ? new Date(ticket.event.event_date).toLocaleDateString('pt-BR') : ''}
                    eventLocation={ticket.event?.location || ''}
                  />
                </motion.div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Ticket className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Carregando seus eventos...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Ticket className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum evento encontrado</h3>
            <p className="text-muted-foreground mb-6">
              Participe de eventos para encontrar pessoas.
            </p>
            <Button asChild>
              <Link to={ROUTE_PATHS.HOME}>
                Explorar Eventos
              </Link>
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden border-none shadow-lg h-full hover:shadow-xl transition-shadow">
                  <div className="relative h-48">
                    <img
                      src={event.image_url || IMAGES.EVENT_PLACEHOLDER}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-white/90 text-primary backdrop-blur-sm">
                        {new Date(event.event_date).toLocaleDateString('pt-BR')}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-xl mb-2">{event.title}</h3>
                    <div className="space-y-2 text-muted-foreground text-sm mb-6">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{event.current_participants} participantes</span>
                      </div>
                    </div>
                    <Button className="w-full gap-2" asChild>
                      <Link to={`/eventos/${event.id}`}>
                        <Sparkles className="w-4 h-4" />
                        Ver Match da Galera
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
