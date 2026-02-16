import { useEffect, useState } from 'react';
import { eventService, type Event } from '@/services/event.service';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export const EventList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const data = await eventService.getAvailableEvents();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar eventos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinEvent = async (eventId: string) => {
    if (!user) {
      setError('Você precisa estar logado para participar de eventos');
      return;
    }

    try {
      setJoiningEventId(eventId);
      setError(null);
      await eventService.joinEvent(eventId, user.id);
      
      // Recarregar eventos para atualizar a contagem
      await loadEvents();
      
      toast.success('Inscrição realizada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao participar do evento');
    } finally {
      setJoiningEventId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Eventos Disponíveis</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Eventos Disponíveis</h1>
        <Button onClick={() => navigate(ROUTE_PATHS.CREATE_EVENT)}>
          Criar Evento
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nenhum evento disponível no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Card key={event.id} className="flex flex-col">
              {event.image_url && (
                <div className="w-full h-48 overflow-hidden rounded-t-lg">
                  <img 
                    src={event.image_url} 
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2">{event.title}</CardTitle>
                  {event.category && (
                    <Badge variant="secondary">{event.category}</Badge>
                  )}
                </div>
                <CardDescription>{formatDate(event.event_date)}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {event.description || 'Sem descrição'}
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">📍</span>
                    <span>
                      {event.city && event.state 
                        ? `${event.city} - ${event.state}` 
                        : event.location}
                    </span>
                  </div>
                  
                  {event.location && event.city && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                      <span>{event.location}</span>
                    </div>
                  )}
                  
                  {event.price > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">💰</span>
                      <span>A partir de R$ {event.price.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {(typeof event.confirmed_users_count === 'number' ||
                    typeof event.current_participants === 'number') && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">🔥</span>
                      <span>
                        {event.confirmed_users_count ?? event.current_participants} pessoas confirmadas
                      </span>
                    </div>
                  )}

                  {typeof event.available_for_match_count === 'number' && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">💞</span>
                      <span>
                        {event.available_for_match_count} disponíveis para match
                      </span>
                    </div>
                  )}

                  {event.max_participants && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">👥</span>
                      <span>
                        {event.current_participants} / {event.max_participants} inscritos
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleJoinEvent(event.id)}
                  disabled={joiningEventId === event.id || !user}
                >
                  {joiningEventId === event.id ? 'Inscrevendo...' : 'Quero ir'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
