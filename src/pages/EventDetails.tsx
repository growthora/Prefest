import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ChevronLeft,
  Share2,
  Heart,
  Sparkles,
  UserPlus,
  Eye,
  EyeOff,
  Flame,
  MessageCircle,
  Ticket,
  HeartHandshake
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { TicketPurchase } from '@/components/TicketPurchase';
import { MatchInterface } from '@/components/MatchCards';
import { AttendeesList, Attendee } from '@/components/AttendeesList';
import { Event, ROUTE_PATHS } from '@/lib/index';
import { eventService, type Event as SupabaseEvent, MatchCandidate } from '@/services/event.service';
import { likeService } from '@/services/like.service';
import { matchService } from '@/services/match.service';
import { chatService } from '@/services/chat.service';
import { supabase } from '@/lib/supabase';
import { IMAGES } from '@/assets/images';
import { useAuth } from '@/hooks/useAuth';
import { useMatch } from '@/hooks/useMatch';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

import { goToPublicProfile } from '@/utils/navigation';

export default function EventDetails() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, updateProfile } = useAuth();
  const { checkAccess } = useFeatureAccess();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'details');
  const [isParticipating, setIsParticipating] = useState(false);
  const [participants, setParticipants] = useState<{ id: string; avatar_url: string; name: string }[]>([]);
  
  // New state for Conheça a Galera
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  
  // Like state
  const [isLiked, setIsLiked] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  // Received Likes State
  const [receivedLikes, setReceivedLikes] = useState<any[]>([]);
  const [loadingReceivedLikes, setLoadingReceivedLikes] = useState(false);

  // Match Interface State
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [lastMatchedUser, setLastMatchedUser] = useState<string | null>(null);
  const [lastMatchedUserName, setLastMatchedUserName] = useState<string>('');
  const [lastMatchedUserPhoto, setLastMatchedUserPhoto] = useState<string>('');
  const [lastMatchChatId, setLastMatchChatId] = useState<string | null>(null);
  const { likeUser, skipUser, currentQueue, loading: loadingMatchQueue } = useMatch(event?.id);

  // Match Queue State (local to avoid conflicts with hook's auto-removal)
  const [matchQueue, setMatchQueue] = useState<any[]>([]);
  const [loadingMatchCandidates, setLoadingMatchCandidates] = useState(false);
  const [showSocialOnboarding, setShowSocialOnboarding] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'match' && event?.id && profile?.match_enabled) {
      loadMatchCandidates();
    }
  }, [activeTab, event?.id, profile?.match_enabled]);

  useEffect(() => {
    if (activeTab === 'likes' && event?.id) {
      loadReceivedLikes();

      // Subscribe to new likes in realtime
      const subscription = supabase
        .channel(`likes:${event.id}:${user?.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'likes',
            filter: `to_user_id=eq.${user?.id}`
          },
          (payload) => {
             console.log('❤️ New like received!', payload);
             if (payload.new.event_id === event.id) {
                loadReceivedLikes();
                toast.info('Você recebeu uma nova curtida! ❤️');
             }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [activeTab, event?.id, user?.id]);

  const loadReceivedLikes = async () => {
    if (!event?.id) return;
    setLoadingReceivedLikes(true);
    try {
      const likes = await likeService.getReceivedLikes(event.id);
      setReceivedLikes(likes);
    } catch (error) {
      console.error('Error loading received likes:', error);
    } finally {
      setLoadingReceivedLikes(false);
    }
  };

  const handleLikeBack = async (likeId: string, userId: string) => {
    if (!event?.id) return;
    try {
      const result = await likeService.likeUser(userId, event.id);
      setReceivedLikes(prev => prev.filter(l => l.like_id !== likeId));
      
      if (result.status === 'match') {
        toast.success("It's a Match! 🎉");
        
        // Play sound
        const audio = new Audio('/sounds/match.mp3');
        audio.play().catch(e => console.log('Audio play failed', e));

        // Confetti
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });

        // Fetch user details to show in overlay
        try {
            const profile = await eventService.getPublicProfile(userId);
            if (profile) {
                setLastMatchedUser(userId);
                setLastMatchedUserName(profile.full_name || 'Alguém');
                setLastMatchedUserPhoto(profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`);
                setLastMatchChatId(result.match_id || null);
                setShowMatchOverlay(true);
            }
        } catch (e) {
            console.error('Error fetching matched profile', e);
        }
      }
    } catch (error) {
      toast.error('Erro ao curtir de volta');
    }
  };

  const handleIgnoreLike = async (likeId: string) => {
    try {
      await likeService.ignoreLike(likeId);
      setReceivedLikes(prev => prev.filter(l => l.like_id !== likeId));
      toast.info('Curtida ignorada');
    } catch (error) {
      toast.error('Erro ao ignorar');
    }
  };

  const loadMatchCandidates = async () => {
    if (!event?.id || !user) return;
    try {
      setLoadingMatchCandidates(true);
      // Try to get match candidates, fallback to attendees if method fails
      let candidates = [];
      try {
        candidates = await eventService.getMatchCandidates(event.id);
      } catch (e) {
        console.warn('getMatchCandidates failed, using getEventAttendees', e);
        candidates = await eventService.getEventAttendees(event.id);
      }

      // Filter current user and map to User interface
      const mapped = candidates
        .filter((c: any) => {
          // Basic self-filter
          if (c.id === user.id || c.user_id === user.id) return false;
          
          // Privacy filter: Must have match_enabled explicit or implicit via endpoint context
          // If coming from getMatchCandidates (RPC), it's already filtered.
          // If coming from fallback getEventAttendees, we must check match_enabled if available
          if (c.match_enabled === false) return false;
          
          return true;
        })
        .map((c: any) => ({
          id: c.id || c.user_id,
          name: c.full_name || c.name || 'Usuário',
          photo: c.avatar_url || c.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.id || c.user_id}`,
          age: c.age || 25,
          bio: c.bio || '',
          vibes: c.vibes || [],
          isSingleMode: c.single_mode || false,
          showInitialsOnly: c.show_initials_only || false,
          matchIntention: c.match_intention || 'amizade',
          genderPreference: c.match_gender_preference,
          sexuality: c.sexuality,
          username: c.username // Added username
        }));
      
      setMatchQueue(mapped);
    } catch (error) {
      console.error('Error loading match candidates:', error);
    } finally {
      setLoadingMatchCandidates(false);
    }
  };

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

  const handleSelectAttendee = (attendeeOrId: string | any) => {
    // Helper handles both ID string and user object
    goToPublicProfile(navigate, attendeeOrId, {
      eventId: event?.id,
      eventTitle: event?.title
    });
  };

  const handleToggleMeetAttendees = async () => {
    if (!checkAccess('aparecer na lista de participantes')) return;

    if (!user || !profile) {
      toast.error('Você precisa estar logado para ativar essa função');
      return;
    }
    
    try {
      // Toggle based on match_enabled as it is the primary flag for Match System
      const isEnabled = profile.match_enabled;
      const newValue = !isEnabled;
      
      const updates: any = { 
          match_enabled: newValue,
          meet_attendees: newValue, // Sync both for consistency
          allow_profile_view: newValue // Ensure profile is visible if matching
      };

      await updateProfile(updates);
      toast.success(newValue ? 'Você entrou no Match! 🔥' : 'Você ficou invisível. 👻');
      
      // Se ativou, recarrega candidatos
      if (newValue) {
        loadMatchCandidates();
      }
      
      fetchAttendees(); 
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

  const handleLikeMatch = async (userId: string) => {
    if (!event?.id || !user?.id) {
      toast.error('Erro ao processar like');
      return;
    }

    try {
      console.log('👍 Dando like em:', userId);
      
      // Registrar o like no banco de dados
      const likeResult = await likeService.likeUser(userId, event.id);
      
      // Encontrar o usuário que recebeu o like para pegar o nome e foto
      const likedUser = matchQueue.find(p => p.id === userId); 
      
      if (likeResult.status === 'already_liked') {
        toast.info('Você já curtiu esta pessoa');
        return;
      }

      if (likeResult.status === 'match' || likeResult.is_match) {
        // É um match!
        console.log('💕 É um match!');
        
        // Disparar confetes
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#ff0000', '#ff69b4', '#ffff00']
          });
          confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#ff0000', '#ff69b4', '#ffff00']
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();

        setLastMatchedUser(userId);
        setLastMatchedUserName(likedUser?.name || 'Alguém');
        setLastMatchedUserPhoto(likedUser?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`);
        
        setLastMatchChatId(likeResult.match_id || null);

        setShowMatchOverlay(true);
        toast.success('É um Match! 💕');
        
        // Tocar som de match se existir
        const audio = new Audio('/sounds/match.mp3');
        audio.play().catch(e => console.log('Audio play failed', e));

        // Marcar match como visto imediatamente (UI feedback loop)
        if (likeResult.match_id) {
          matchService.markMatchSeen(likeResult.match_id).catch(err => 
            console.error('Erro ao marcar match como visto:', err)
          );
        }
        
      } else {
        console.log('✅ Like enviado');
        toast.success('Like enviado! ❤️');
      }
      
      // Removed likeUser(userId) to prevent queue from shifting and double-skipping
      // The MatchInterface handles navigation internally
    } catch (error: any) {
      console.error('❌ Erro ao dar like:', error);
      
      if (error.code === '23505') {
        toast.info('Você já curtiu esta pessoa');
      } else {
        toast.error('Erro ao processar like');
      }
    }
  };

  const handleSkipMatch = (userId: string) => {
    skipUser(userId);
  };

  const shouldShowSocialOnboarding = () => {
    if (!profile) return false;
    const isBioEmpty = !profile.bio;
    const isAvatarEmpty = !profile.avatar_url;
    const isObjectiveEmpty = !profile.match_intention;
    const hasLookingFor = Array.isArray(profile.looking_for) && profile.looking_for.length > 0;
    const isPreferenceEmpty = !profile.match_gender_preference && !hasLookingFor;
    return isBioEmpty && isAvatarEmpty && isObjectiveEmpty && isPreferenceEmpty;
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

      if (shouldShowSocialOnboarding()) {
        setShowSocialOnboarding(true);
      }
      
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

  const scrollToTicketSection = () => {
    const el = document.getElementById('ticket-purchase');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-12 pb-24 lg:pb-12">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4 lg:mb-6"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground -ml-2 text-xs lg:text-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1 lg:mr-2" />
            Voltar para eventos
          </Button>
        </motion.div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 lg:mb-8 bg-card/50 border border-border/40 h-auto p-1">
            <TabsTrigger 
              value="details" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white py-2 lg:py-1.5 text-xs lg:text-sm"
            >
              Detalhes
            </TabsTrigger>
            <TabsTrigger 
              value="attendees" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 py-2 lg:py-1.5 text-xs lg:text-sm"
            >
              <Users size={14} className="fill-current lg:w-4 lg:h-4" />
              Galera
            </TabsTrigger>
            <TabsTrigger 
              value="likes" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 py-2 lg:py-1.5 text-xs lg:text-sm"
            >
              <Heart size={14} className="lg:w-4 lg:h-4" />
              Curtidas
            </TabsTrigger>
            <TabsTrigger 
              value="match" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 py-2 lg:py-1.5 text-xs lg:text-sm"
            >
              <HeartHandshake size={14} className="lg:w-4 lg:h-4" />
              Match
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

              <h1 className="text-2xl md:text-3xl lg:text-5xl font-bold tracking-tight text-foreground">
                {event.title}
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                <div className="flex items-center gap-3 p-3 lg:p-4 rounded-xl bg-card/40 border border-border/40">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] lg:text-xs text-muted-foreground uppercase tracking-wide">Data</p>
                    <p className="text-sm font-medium">{event.date}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 lg:p-4 rounded-xl bg-card/40 border border-border/40">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Clock className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] lg:text-xs text-muted-foreground uppercase tracking-wide">Horário</p>
                    <p className="text-sm font-medium">Portões abrem às {event.time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 lg:p-4 rounded-xl bg-card/40 border border-border/40 md:col-span-2">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <MapPin className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] lg:text-xs text-muted-foreground uppercase tracking-wide">Local</p>
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
                  <div className="relative">
                    <div
                      className={cn(
                        'flex -space-x-3 overflow-hidden transition-all',
                        !isParticipating && 'blur-sm'
                      )}
                    >
                      {participants.map((p) => (
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
                    {!isParticipating && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="px-3 py-1 rounded-full bg-background/80 border border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Compre o ingresso para desbloquear quem vai
                        </span>
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
              <div id="ticket-purchase" className="sticky top-24">
                <TicketPurchase 
                  event={event} 
                  onPurchase={handlePurchase}
                  isParticipating={isParticipating}
                />
              </div>
            </motion.div>
          </div>
          </TabsContent>

          <TabsContent value="likes" className="mt-0 min-h-[50vh]">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/30 p-6 rounded-xl border border-border/40">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Heart className="w-6 h-6 text-primary" />
                    Curtidas Recebidas
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    Veja quem curtiu você neste evento!
                  </p>
                </div>
              </div>

              {loadingReceivedLikes ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : receivedLikes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="mb-2">Nenhuma curtida nova por enquanto.</p>
                  <p className="text-sm mb-6">Participe do Match para ser visto e encontrar pessoas!</p>
                  
                  {user && (
                    <Button 
                      onClick={() => {
                        setActiveTab('match');
                        // If not enabled, the match tab will show the big CTA
                      }}
                      variant="outline"
                      className="gap-2 border-primary/50 text-primary hover:bg-primary/5"
                    >
                      <HeartHandshake size={16} />
                      Ir para o Match
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {receivedLikes.map((like) => (
                    <div key={like.like_id} className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group">
                      <div className="relative">
                        <Avatar className="h-16 w-16 border-2 border-primary/20">
                          <AvatarImage src={like.from_user_photo} />
                          <AvatarFallback>{like.from_user_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </div>
                      
                      <div className="flex-1 min-w-0 z-10">
                        <h4 className="font-semibold text-sm mb-1">{like.from_user_name}, {like.from_user_age}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">{like.from_user_bio || 'Sem bio'}</p>
                        
                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            className="h-8 flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0"
                            onClick={() => handleLikeBack(like.like_id, like.from_user_id)}
                          >
                            <Heart className="w-3 h-3 mr-1.5 fill-current" />
                            Curtir
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 px-3"
                            onClick={() => handleIgnoreLike(like.like_id)}
                          >
                            <span className="sr-only">Ignorar</span>
                            <span className="text-xs">Ignorar</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="attendees" className="mt-0 min-h-[50vh]">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/30 p-6 rounded-xl border border-border/40">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    Quem vai
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    {attendees.length} pessoas confirmadas
                  </p>
                </div>
              </div>

              <AttendeesList 
                attendees={attendees}
                loading={loadingAttendees}
                onSelectAttendee={handleSelectAttendee}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="match" className="mt-0 min-h-[50vh]">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/30 p-6 rounded-xl border border-border/40">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <HeartHandshake className="w-6 h-6 text-primary" />
                    Match
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    Encontre sua companhia para o evento
                  </p>
                </div>

                {user && (
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-medium">
                        {profile?.match_enabled ? 'Você está visível' : 'Você está invisível'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.match_enabled ? 'Outros podem ver seu perfil' : 'Ative para participar do Match'}
                      </p>
                    </div>
                    <Button 
                      variant={profile?.match_enabled ? "outline" : "default"}
                      onClick={handleToggleMeetAttendees}
                      className="gap-2"
                    >
                      {profile?.match_enabled ? (
                        <>
                          <EyeOff size={16} />
                          Sair do Match
                        </>
                      ) : (
                        <>
                          <Eye size={16} />
                          Entrar no Match
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {!user ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <UserPlus className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="font-semibold text-xl mb-2">Faça login para dar Match!</h4>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Entre na sua conta para interagir com outros participantes.
                  </p>
                  <Button onClick={() => navigate('/login')} size="lg" className="px-8">Fazer Login</Button>
                </div>
              ) : !profile?.match_enabled ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-card/30 rounded-xl border border-border/40 p-8">
                   <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 relative">
                     <Flame className="w-10 h-10 text-primary animate-pulse" />
                     <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-bounce" />
                   </div>
                   <h3 className="text-2xl font-bold mb-3">Participe do Match!</h3>
                   <p className="text-muted-foreground max-w-md mb-8 text-lg">
                     Ative o modo Match para encontrar pessoas com interesses em comum que também vão ao evento.
                   </p>
                   <Button 
                     size="lg" 
                     className="gap-2 text-lg px-8 py-6 rounded-xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105"
                     onClick={handleToggleMeetAttendees}
                   >
                     <HeartHandshake size={20} />
                     Entrar no Match Agora
                   </Button>
                   <p className="text-xs text-muted-foreground mt-4">
                     Ao ativar, seu perfil ficará visível para outros participantes na aba de Match.
                   </p>
                </div>
              ) : (
                <div className="py-4">
                   {loadingMatchCandidates ? (
                     <div className="flex justify-center py-20">
                       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                     </div>
                   ) : (
                     <MatchInterface 
                       queue={matchQueue}
                       onLike={handleLikeMatch}
                       onSkip={handleSkipMatch}
                     />
                   )}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Match Overlay */}
        <AnimatePresence>
          {showMatchOverlay && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl p-8 text-center overflow-hidden"
            >
              {/* Efeito de confete/brilho de fundo */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,105,180,0.1),transparent_50%)]" />
              
              {/* Fotos dos usuários lado a lado */}
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative flex items-center justify-center mb-8 z-10"
              >
                {/* Foto do usuário atual (você) */}
                <div className="relative">
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -inset-3 bg-gradient-to-br from-primary/40 to-pink-500/40 blur-xl rounded-full"
                  />
                  <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-primary shadow-2xl">
                    <img 
                      src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
                      alt="Você"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Ícone de chama no meio */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                  className="relative mx-[-15px] z-20"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shadow-2xl border-4 border-background">
                    <Flame className="w-8 h-8 text-white fill-white" />
                  </div>
                </motion.div>

                {/* Foto do usuário que deu match */}
                <div className="relative">
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                    className="absolute -inset-3 bg-gradient-to-br from-pink-500/40 to-primary/40 blur-xl rounded-full"
                  />
                  <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-pink-500 shadow-2xl">
                    <img 
                      src={lastMatchedUserPhoto}
                      alt={lastMatchedUserName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </motion.div>
              
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-primary mb-2 tracking-tighter italic relative z-10"
              >
                IT'S A MATCH!
              </motion.h2>
              
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-muted-foreground mb-8 text-lg relative z-10"
              >
                Você e <span className="text-foreground font-bold">{lastMatchedUserName}</span> curtiram um ao outro! 💕
              </motion.p>

              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col w-full max-w-sm gap-3 relative z-10"
              >
                <Button 
                  onClick={() => {
                    setShowMatchOverlay(false);
                    if (lastMatchChatId) {
                        // Marcar interação iniciada antes de navegar
                        // matchService.markChatOpened(lastMatchChatId).catch(console.error); // Optional: if needed
                        navigate(`/chat/${lastMatchChatId}`);
                    } else {
                       toast.error('Erro ao redirecionar para o chat');
                    }
                  }}
                  className="bg-gradient-to-r from-pink-500 to-primary hover:from-pink-600 hover:to-primary/90 text-white py-6 rounded-xl font-bold text-lg shadow-xl"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Conversar
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setShowMatchOverlay(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Continuar Swiping
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showSocialOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-xl px-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-card border border-border/60 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center">
                  <Ticket className="w-7 h-7 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Ingresso confirmado!</h2>
                <p className="text-sm text-muted-foreground">
                  Agora é a hora de criar seu perfil social para que outros participantes possam te conhecer antes da festa.
                </p>
              </div>

              <div className="space-y-2 text-left text-sm bg-muted/40 border border-dashed border-border/70 rounded-2xl p-4">
                <p className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">
                  Seu perfil social
                </p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                  <li>Foto de perfil para aparecer na galeria do evento</li>
                  <li>Bio curta contando quem é você</li>
                  <li>Seu objetivo (paquera, amizade...)</li>
                  <li>Preferências de quem você quer conhecer</li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full h-11 rounded-2xl font-semibold"
                  onClick={() => {
                    setShowSocialOnboarding(false);
                    navigate(ROUTE_PATHS.PROFILE, { state: { activeTab: 'profile', startEditing: true } });
                  }}
                >
                  Criar meu perfil social
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-10 text-xs text-muted-foreground"
                  onClick={() => setShowSocialOnboarding(false)}
                >
                  Agora não
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {!isParticipating && (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-6xl px-4 pb-4">
            <div className="bg-background/95 border border-border/60 rounded-2xl shadow-lg shadow-primary/20 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-primary flex items-center gap-1">
                  <Flame className="w-4 h-4" />
                  Comprar ingresso e desbloquear matches
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Garanta seu ingresso para ver quem vai e liberar os matches deste evento.
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 rounded-full px-4 h-9 text-xs font-bold"
                onClick={scrollToTicketSection}
              >
                Comprar ingresso e desbloquear matches
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
