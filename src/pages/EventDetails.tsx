import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, ChevronLeft, Share2, Heart, Sparkles, UserPlus, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { TicketPurchase } from '@/components/TicketPurchase';
import { Event, ROUTE_PATHS } from '@/lib/index';
import { eventService, type Event as SupabaseEvent } from '@/services/event.service';
import { IMAGES } from '@/assets/images';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function EventDetails() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [isParticipating, setIsParticipating] = useState(false);
  const [participants, setParticipants] = useState<{ id: string; avatar_url: string; name: string }[]>([]);
  
  // New state for Conheça a Galera
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  
  // Like state
  const [isLiked, setIsLiked] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [slug]);

  // Check like status when event and user are loaded
  useEffect(() => {
    if (user && event?.id) {
      checkLikeStatus();
    }
  }, [user, event?.id]);

  const checkLikeStatus = async () => {
    if (!event?.id || !user) return;
    try {
      if (event.id.length === 36) {
        const liked = await eventService.hasUserLiked(event.id, user.id);
        setIsLiked(liked);
      }
    } catch (error) {
      console.warn("Could not check like status", error);
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.error("Faça login para curtir este evento! ❤️");
      return;
    }
    
    if (!event?.id) return;

    if (event.id.length !== 36) {
      toast.error("Este evento é demonstrativo e não pode ser curtido.");
      return;
    }

    const previousState = isLiked;
    setIsLiked(!previousState);

    try {
      setIsLoadingLike(true);
      const newStatus = await eventService.toggleLike(event.id, user.id);
      setIsLiked(newStatus);
      toast.success(newStatus ? "Evento favoritado! ❤️" : "Removido dos favoritos");
    } catch (error) {
      setIsLiked(previousState);
      toast.error("Erro ao atualizar favorito");
    } finally {
      setIsLoadingLike(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    const shareUrl = `${window.location.origin}/evento/${event.slug || event.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado! 📎");
    } catch (err) {
      toast.error("Erro ao copiar link");
    }
  };

  // Fetch attendees when tab is active
  useEffect(() => {
    if (activeTab === 'attendees' && event?.id) {
      fetchAttendees();
    }
  }, [activeTab, event?.id]);

  const fetchAttendees = async () => {
    if (!event?.id) return;
    try {
      setLoadingAttendees(true);
      const data = await eventService.getEventAttendees(event.id);
      setAttendees(data);
    } catch (error) {
      console.error('Error fetching attendees:', error);
      toast.error('Erro ao carregar lista de participantes');
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleToggleMeetAttendees = async () => {
    if (!user || !profile) {
      toast.error('Você precisa estar logado para ativar essa função');
      return;
    }
    
    try {
      const newValue = !profile.meet_attendees;
      await updateProfile({ meet_attendees: newValue });
      toast.success(newValue ? 'Você agora aparece na lista!' : 'Você agora está anônimo na lista.');
      fetchAttendees(); // Refresh list to reflect changes
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const loadEvent = async () => {
    if (!slug) return;
    
    try {
      setLoading(true);
      let supabaseEvent: SupabaseEvent;

      // Check if slug is UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

      if (isUUID) {
        supabaseEvent = await eventService.getEventById(slug);
        // If we found the event and it has a slug, redirect to the slug URL
        if (supabaseEvent && supabaseEvent.slug) {
           navigate(ROUTE_PATHS.EVENT_DETAILS.replace(':slug', supabaseEvent.slug), { replace: true });
           return;
        }
      } else {
        supabaseEvent = await eventService.getEventBySlug(slug);
      }
      
      if (supabaseEvent) {
        // SEO Updates
        document.title = `${supabaseEvent.title} | PreFest`;
        
        // Montar endereço completo
        const locationParts = [];
        if (supabaseEvent.city) locationParts.push(supabaseEvent.city);
        if (supabaseEvent.state) locationParts.push(supabaseEvent.state);
        const fullLocation = locationParts.length > 0 ? locationParts.join(' - ') : supabaseEvent.location;
        
        // Criar Date object tratando o fuso horário
        const eventDate = new Date(supabaseEvent.event_date);
        
        // Formatar data e hora no fuso horário local do usuário
        const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        
        const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        // Converter para formato frontend
        const convertedEvent: Event = {
          id: supabaseEvent.id,
          slug: supabaseEvent.slug,
          title: supabaseEvent.title,
          date: dateFormatter.format(eventDate),
          time: timeFormatter.format(eventDate),
          location: fullLocation,
          address: supabaseEvent.location,
          city: supabaseEvent.city,
          event_type: supabaseEvent.event_type,
          price: supabaseEvent.price,
          image: supabaseEvent.image_url || IMAGES.EVENTS_1,
          description: supabaseEvent.description || '',
          category: supabaseEvent.category || 'Geral',
          attendeesCount: supabaseEvent.current_participants,
          tags: supabaseEvent.category ? [supabaseEvent.category] : [],
        };
        setEvent(convertedEvent);
        
        // Fetch real participants (header summary)
        const parts = await eventService.getEventParticipants(supabaseEvent.id);
        setParticipants(parts);

        // Verificar se usuário já está inscrito
        if (user) {
          const participating = await eventService.isUserParticipating(supabaseEvent.id, user.id);
          setIsParticipating(participating);
        }
      } else {
        toast.error('Evento não encontrado');
        navigate(ROUTE_PATHS.HOME);
      }
    } catch (err) {
      console.error('Erro ao carregar evento:', err);
      toast.error('Erro ao carregar evento');
      navigate(ROUTE_PATHS.HOME);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (singleMode: boolean, ticketTypeId?: string, totalPaid?: number) => {
    if (!user || !event) {
      toast.error('Você precisa estar logado para comprar ingressos');
      navigate('/login');
      return;
    }

    if (isParticipating) {
      toast.info('Você já está inscrito neste evento!');
      return;
    }

    try {
      await eventService.joinEvent(event.id, user.id, 1, ticketTypeId, totalPaid);
      
        toast.success(
          singleMode
          ? 'Ingresso reservado! Ative "Conheça a Galera" para ver quem vai!'
          : 'Ingresso reservado com sucesso!'
        );
      
      // Recarregar evento para atualizar contagem
      setIsParticipating(true);
      await loadEvent();
      
      if (singleMode) {
        // Suggest activating meet_attendees if they bought in single mode
        if (!profile?.meet_attendees) {
            await updateProfile({ meet_attendees: true });
            toast.success('Conheça a Galera ativado automaticamente!');
        }
        setActiveTab('attendees');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao comprar ingresso');
    }
  };

  if (loading || !event) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar para eventos
          </Button>
        </motion.div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-card/50 border border-border/40">
            <TabsTrigger value="details" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              Detalhes do Evento
            </TabsTrigger>
            <TabsTrigger 
              value="attendees" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              {event?.event_type === 'formal' ? (
                <>
                  <Sparkles size={16} />
                  Networking
                </>
              ) : (
                <>
                  <Users size={16} className="fill-current" />
                  Conheça a Galera
                </>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Main Content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-8"
              >
            {/* Hero Image Section */}
            <div className="relative aspect-video rounded-2xl overflow-hidden mb-8 group">
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale-[40%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
              
              <div className="absolute top-4 right-4 flex gap-2">
                <Button 
                  size="icon" 
                  variant="secondary" 
                  onClick={handleShare}
                  className="bg-background/40 backdrop-blur-md border-none hover:bg-background/60 transition-all hover:scale-105"
                  title="Compartilhar"
                >
                  <Share2 className="w-4 h-4 text-white" />
                </Button>
                <Button 
                  size="icon" 
                  variant="secondary" 
                  onClick={handleLike}
                  className={cn(
                    "backdrop-blur-md border-none transition-all hover:scale-105",
                    isLiked 
                      ? "bg-red-500/20 hover:bg-red-500/30 text-red-500" 
                      : "bg-background/40 hover:bg-background/60 text-white"
                  )}
                  title={isLiked ? "Remover dos favoritos" : "Favoritar"}
                >
                  <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 uppercase tracking-wider text-[10px]">
                  {event.category}
                </Badge>
                {event.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-secondary/50 text-muted-foreground text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>

              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                {event.title}
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-card/40 border border-border/40">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Data</p>
                    <p className="text-sm font-medium">{event.date}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-card/40 border border-border/40">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Horário</p>
                    <p className="text-sm font-medium">Portões abrem às {event.time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-card/40 border border-border/40 md:col-span-2">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Local</p>
                    <p className="text-sm font-medium">{event.location}</p>
                    <p className="text-xs text-muted-foreground">{event.address}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-xl font-semibold mb-4">Sobre o evento</h3>
                <p className="text-muted-foreground leading-relaxed text-base">
                  {event.description}
                </p>
              </div>

              <Separator className="bg-border/40" />

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{event.attendeesCount}</strong> confirmados
                  </span>
                </div>
                {participants.length > 0 ? (
                  <div className="flex -space-x-3 overflow-hidden">
                    {participants.map((p, i) => (
                      <div
                        key={p.id}
                        className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-secondary flex items-center justify-center text-[10px] font-bold overflow-hidden"
                      >
                        <img 
                          src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}`} 
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {event.attendeesCount > participants.length && (
                      <div className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        +{event.attendeesCount - participants.length}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Seja o primeiro a confirmar!</span>
                )}
              </div>
            </div>
            </motion.div>

            {/* Sidebar / Ticket Purchase */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-4"
            >
              <div className="sticky top-24">
                <TicketPurchase 
                  event={event} 
                  onPurchase={handlePurchase} 
                />
              </div>
            </motion.div>
          </div>
          </TabsContent>

          <TabsContent value="attendees" className="mt-0 min-h-[50vh]">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header and Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/30 p-6 rounded-xl border border-border/40">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    Quem vai
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    {attendees.length} pessoas na lista • {attendees.filter(a => a.is_visible).length} visíveis
                  </p>
                </div>

                {user && (
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-medium">
                        {profile?.meet_attendees ? 'Você está visível' : 'Você está invisível'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.meet_attendees ? 'Outros podem ver seu perfil' : 'Aparece como "Participante"'}
                      </p>
                    </div>
                    <Button 
                      variant={profile?.meet_attendees ? "outline" : "default"}
                      onClick={handleToggleMeetAttendees}
                      className="gap-2"
                    >
                      {profile?.meet_attendees ? (
                        <>
                          <EyeOff size={16} />
                          Ficar Invisível
                        </>
                      ) : (
                        <>
                          <Eye size={16} />
                          Ficar Visível
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {!user && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">Faça login para ver quem vai!</h4>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Entre na sua conta para interagir com outros participantes e aparecer na lista.
                  </p>
                  <Button onClick={() => navigate('/login')}>Fazer Login</Button>
                </div>
              )}

              {/* List */}
              {loadingAttendees ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : attendees.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {attendees.map((participant) => (
                    <motion.div
                      key={participant.user_id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`relative group overflow-hidden rounded-xl border transition-all hover:shadow-md ${
                        participant.is_visible 
                          ? 'bg-card border-border/50' 
                          : 'bg-muted/30 border-transparent'
                      }`}
                    >
                      <div className="p-4 flex flex-col items-center text-center h-full">
                        <Avatar className={`w-20 h-20 mb-3 ${!participant.is_visible && 'opacity-50'}`}>
                          <AvatarImage src={participant.avatar_url} />
                          <AvatarFallback>
                            {participant.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 w-full">
                          <h4 className="font-medium truncate w-full" title={participant.name}>
                            {participant.name}
                          </h4>
                          {participant.is_visible && participant.bio && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {participant.bio}
                            </p>
                          )}
                          {!participant.is_visible && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Perfil oculto
                            </p>
                          )}
                        </div>

                        {participant.is_visible && user && participant.user_id !== user.id && (
                          <div className="mt-3 w-full pt-3 border-t border-border/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="w-full text-xs h-7">
                              Ver Perfil
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Ninguém confirmou presença publicamente ainda.</p>
                  <p className="text-sm">Seja o primeiro a aparecer na lista!</p>
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
