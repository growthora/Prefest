import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { matchService, Match } from '@/services/match.service';
import { eventService } from '@/services/event.service';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, Heart, Lock } from 'lucide-react';
import { GlobalLoader } from '@/components/GlobalLoader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { getMatchEventTitles } from '@/utils/matchEvents';

export default function EventMatches() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasTicket, setHasTicket] = useState<boolean | null>(null);
  const [isMatchEnabled, setIsMatchEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (eventId && user) {
      loadMatches();
      return;
    }

    setLoading(false);
  }, [eventId, user]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      if (!user || !eventId) return;

      // Verificar se o usuário tem ingresso para este evento
      const participation = await eventService.getUserParticipation(eventId, user.id);
      const hasAccess = Boolean(participation);
      setHasTicket(hasAccess);
      setIsMatchEnabled(participation?.match_enabled ?? false);

      if (!hasAccess || !participation?.match_enabled) {
        setLoading(false);
        return;
      }

      const data = await matchService.getEventMatches(eventId);
            setMatches(data);
          } catch (error) {
            // console.error('Error loading matches:', error);
          } finally {
            setLoading(false);
    }
  };

  if (loading) return <GlobalLoader />;

  if (hasTicket === false) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground mb-6 max-w-xs">
          Você precisa ter um ingresso confirmado neste evento para ver os matches.
        </p>
        <Button onClick={() => navigate('/meus-eventos')}>
          Ver meus eventos
        </Button>
      </div>
    );
  }

  if (isMatchEnabled === false) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Ative o Match deste evento</h2>
        <p className="text-muted-foreground mb-6 max-w-xs">
          VocÃª precisa entrar no Match para ver curtidas, filas e conversas deste evento.
        </p>
        <Button onClick={() => navigate(`/evento/${eventId}?tab=match`)}>
          Entrar no Match
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} size="icon" className="hover:bg-transparent -ml-2">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">Matches do Evento</h1>
      </div>

      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Nenhum match ainda</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mb-6">
            Você ainda não tem matches confirmados neste evento.
          </p>
          {/* Se o evento já passou, talvez não dê para dar match, mas deixamos o botão por enquanto */}
          <Button onClick={() => navigate(`/evento/${eventId}?tab=match`)}>
            Conhecer Galera
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {matches.map((match) => (
            <Card key={match.match_id} className="p-4 flex items-center justify-between bg-card border-border/50">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage src={match.partner_avatar} />
                  <AvatarFallback>{match.partner_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{match.partner_name}</h3>
                  <p className="text-xs text-muted-foreground">Match global ativo</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Vocês se encontraram em:
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {getMatchEventTitles(match).map((eventTitle) => (
                      <span
                        key={`${match.match_id}-${eventTitle}`}
                        className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                      >
                        {eventTitle}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="bg-primary/10 hover:bg-primary/20 text-primary rounded-full h-10 w-10"
                onClick={() => navigate(`/chat/${match.match_id}`)}
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
