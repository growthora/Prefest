import React, { useEffect, useState, useMemo } from 'react';
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
  HeartHandshake,
  Ban,
  Camera,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { TicketPurchase } from '@/components/TicketPurchase';
import { MatchInterface } from '@/components/MatchCards';
import { AttendeesList } from '@/components/AttendeesList';
import { Event, ROUTE_PATHS } from '@/lib/index';
import { eventService, type Event as SupabaseEvent, type EventParticipant } from '@/services/event.service';
import { eventMatchService } from '@/services/event-match.service';
import { matchService } from '@/services/match.service';
import { IMAGES } from '@/assets/images';
import { useAuth } from '@/hooks/useAuth';
import { useMatch } from '@/hooks/useMatch';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useEventParticipants } from '@/hooks/useEventParticipants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { differenceInYears, parseISO } from 'date-fns';
import { toUserFriendlyErrorMessage } from '@/lib/appErrors';

import { goToPublicProfile } from '@/utils/navigation';
import { getMatchEventSummary } from '@/utils/matchEvents';
import { hasValidMatchPhoto, MATCH_PHOTO_REQUIRED_MESSAGE } from '@/utils/matchPhoto';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { MatchGuidelinesModal } from '@/components/MatchGuidelinesModal';

export default function EventDetails() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { checkAccess } = useFeatureAccess();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'details');
  const [isParticipating, setIsParticipating] = useState(false);
  const [participation, setParticipation] = useState<EventParticipant | null>(null);

  // ── Single Source of Truth for confirmed participants ──────────────────────
  // confirmedParticipants feeds BOTH the header avatar strip AND the Quem vai
  // tab, guaranteeing the counter always matches the displayed list.
  const {
    confirmedParticipants,
    confirmedCount,
    isLoading: isLoadingParticipants,
    refresh: refreshParticipants,
  } = useEventParticipants(event?.id);
  // ──────────────────────────────────────────────────────────────────────────

  // Like state
  const [isLiked, setIsLiked] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  // Match Interface State
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [lastMatchedUser, setLastMatchedUser] = useState<string | null>(null);
  const [lastMatchedUserName, setLastMatchedUserName] = useState<string>('');
  const [lastMatchedUserPhoto, setLastMatchedUserPhoto] = useState<string>('');
  const [lastMatchedMatchId, setLastMatchedMatchId] = useState<string | null>(null);
  const {
    likeUser: likeMatchUser,
    likeBack,
    skipUser,
    ignoreLike,
    currentQueue,
    matches: eventMatches,
    receivedLikes,
    stats: matchStats,
    loading: loadingMatchQueue,
    isReloadingQueue,
    loadingMatches,
    loadingReceivedLikes,
    refreshAll: refreshMatchData,
    reloadQueue,
    hasOwnValidPhoto,
    isCheckingOwnPhoto,
    hasEvaluatedOwnPhoto,
  } = useMatch(event?.id, { matchEnabled: participation?.match_enabled });
  const [showSocialOnboarding, setShowSocialOnboarding] = useState(false);
  const [showMatchGuidelines, setShowMatchGuidelines] = useState(false);

  const isUnderage = useMemo(() => {
    if (!profile?.birth_date) return false;
    return differenceInYears(new Date(), parseISO(profile.birth_date)) < 18;
  }, [profile]);

  const isOwnPhotoValidationPending = Boolean(user && profile && (!hasEvaluatedOwnPhoto || isCheckingOwnPhoto));
  const isMatchPhotoMissing = Boolean(user && profile && hasEvaluatedOwnPhoto && !isCheckingOwnPhoto && !hasOwnValidPhoto);
  const isEventMatchEnabled = participation?.match_enabled ?? false;

  const openMatchProfileSetup = () => {
    navigate(ROUTE_PATHS.PROFILE, { state: { activeTab: 'profile', startEditing: true } });
  };

  const redirectToMatchProfileSetup = () => {
    setActiveTab('details');
    toast.info(MATCH_PHOTO_REQUIRED_MESSAGE);
    openMatchProfileSetup();
  };

  const handleTabChange = (nextTab: string) => {
    const isMatchAreaTab = nextTab === 'match' || nextTab === 'likes';

    if (isMatchAreaTab && user && profile) {
      if (isOwnPhotoValidationPending) {
        toast.info('Validando sua foto de perfil...');
        return;
      }

      if (isMatchPhotoMissing) {
        redirectToMatchProfileSetup();
        return;
      }
    }

    setActiveTab(nextTab);
  };

  useEffect(() => {
    loadEvent();
  }, [slug]);

  useEffect(() => {
    if ((activeTab === 'match' || activeTab === 'likes') && isMatchPhotoMissing) {
      redirectToMatchProfileSetup();
    }
  }, [activeTab, isMatchPhotoMissing]);

  const renderMatchPhotoRequiredState = (description: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-center bg-card/30 rounded-xl border border-border/40 p-8">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <Camera className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-2xl font-bold mb-3">Adicione uma foto para começar a dar match</h3>
      <p className="text-muted-foreground max-w-md mb-8 text-lg">
        {description}
      </p>
      <Button size="lg" className="gap-2 text-lg px-8 py-6 rounded-xl" onClick={openMatchProfileSetup}>
        <Camera size={20} />
        Adicionar foto
      </Button>
      <p className="text-xs text-muted-foreground mt-4">
        Assim que sua foto principal estiver válida, o evento libera o match automaticamente.
      </p>
    </div>
  );

  const renderMatchPhotoValidationState = () => (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );



  const handleLikeBack = async (likeId: string, userId: string) => {
    if (isOwnPhotoValidationPending) {
      toast.info('Validando sua foto de perfil...');
      return;
    }

    if (isMatchPhotoMissing) {
      redirectToMatchProfileSetup();
      return;
    }

    if (!event?.id) return;
    try {
      if (!isEventMatchEnabled) {
        await toggleMatchStatus(true);
      }

      const action = await likeBack(userId, likeId);
      if (!action) return;

      const result = action.result;

      if (result.status === 'error') {
        toast.error(result.message || 'Não foi possível curtir de volta agora.');
        return;
      }

      if (result.status === 'match') {
        toast.success("It's a Match! ??");

        // Play sound
        const audio = new Audio('/sounds/match.mp3');
        audio.play().catch(() => {});

        // Confetti
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });

        setLastMatchedUser(userId);
        setLastMatchedUserName(action.targetUser?.name || 'Alguém');
        setLastMatchedUserPhoto(action.targetUser?.photo || '');
        setLastMatchedMatchId(result.match_id || null);
        setShowMatchOverlay(true);

      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao curtir de volta');
    }
  };

  const handleIgnoreLike = async (likeId: string, userId: string) => {
    try {
      await ignoreLike(userId, likeId);
      toast.info('Curtida ignorada');
    } catch (error) {
      toast.error('Erro ao ignorar');
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
      // Ignore error
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.error("Faça login para curtir este evento! ??");
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
      toast.success(newStatus ? "Evento favoritado! ??" : "Removido dos favoritos");
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
      toast.success("Link copiado! ??");
    } catch (err) {
      toast.error("Erro ao copiar link");
    }
  };

  // NOTE: Attendees are now fetched via useEventParticipants hook above.

  const handleSelectAttendee = (attendeeOrId: string | any) => {
    // Helper handles both ID string and user object
    goToPublicProfile(navigate, attendeeOrId, {
      eventId: event?.id,
      eventTitle: event?.title
    });
  };

  const loadParticipationState = async (eventId: string, userId: string) => {
    try {
      const nextParticipation = await eventService.getUserParticipation(eventId, userId);
      setParticipation(nextParticipation);
      setIsParticipating(Boolean(nextParticipation));
      return nextParticipation;
    } catch {
      setParticipation(null);
      setIsParticipating(false);
      return null;
    }
  };

  const handleToggleMeetAttendees = async () => {
  if (!checkAccess('aparecer na lista de participantes')) return;

  if (!user || !profile) {
    toast.error('Você precisa estar logado para ativar essa função');
    return;
  }

  if (!isParticipating) {
    toast.info('Garanta seu ingresso para liberar o Match deste evento.');
    document.getElementById('ticket-purchase')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (!isEventMatchEnabled && isOwnPhotoValidationPending) {
    toast.info('Validando sua foto de perfil...');
    return;
  }

  if (!isEventMatchEnabled && isMatchPhotoMissing) {
    redirectToMatchProfileSetup();
    return;
  }

  if (!isEventMatchEnabled) {
    setShowMatchGuidelines(true);
    return;
  }

  await toggleMatchStatus(false);
};

const toggleMatchStatus = async (enable: boolean) => {
  if (!profile || !user || !event?.id) return;

  try {
    if (enable && isOwnPhotoValidationPending) {
      toast.info('Validando sua foto de perfil...');
      return;
    }

    if (enable && isMatchPhotoMissing) {
      redirectToMatchProfileSetup();
      return;
    }

    const result = await eventMatchService.setMatchOptIn(event.id, enable);

    await Promise.all([
      loadParticipationState(event.id, user.id),
      refreshMatchData(),
      refreshParticipants(),
    ]);

    if (!enable) {
      const removedLikes = Number(result.removed_likes || 0);
      toast.success(
        removedLikes > 0
          ? 'Voce saiu do Match deste evento e limpamos as curtidas pendentes.'
          : 'Voce saiu do Match deste evento.'
      );
      return;
    }
    toast.success('Voce entrou no Match deste evento!');
  } catch (error) {
    toast.error(toUserFriendlyErrorMessage(error));
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
        supabaseEvent = await eventService.getPublicEventById(slug);
        if (supabaseEvent && (supabaseEvent as any).is_active === false) {
          throw new Error('EVENT_OFFLINE');
        }
        // If we found the event and it has a slug, redirect to the slug URL
        if (supabaseEvent && supabaseEvent.slug) {
           const currentSearch = searchParams.toString();
           const targetUrl = `${ROUTE_PATHS.EVENT_DETAILS.replace(':slug', supabaseEvent.slug)}${currentSearch ? `?${currentSearch}` : ''}`;
           navigate(targetUrl, { replace: true });
           return;
        }
      } else {
        supabaseEvent = await eventService.getPublicEventBySlug(slug);
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

        const galleryRows = await eventService.getPublicEventImages(supabaseEvent.id).catch((): any[] => []);
        const orderedGallery = galleryRows
          .slice()
          .sort((a, b) => Number(a.display_order) - Number(b.display_order));

        const coverFromGallery = orderedGallery.find((img) => img.is_cover)?.image_url;
        const primaryImage = coverFromGallery || supabaseEvent.image_url || IMAGES.EVENTS_1;
        const imagesFromGallery = orderedGallery.map((img) => img.image_url).filter(Boolean);
        const images = imagesFromGallery.length > 0
          ? [primaryImage, ...imagesFromGallery.filter((url) => url !== primaryImage)]
          : [primaryImage];

        // Converter para formato frontend
        const convertedEvent: Event = {
          id: supabaseEvent.id,
          slug: supabaseEvent.slug,
          title: supabaseEvent.title,
          date: dateFormatter.format(eventDate),
          time: timeFormatter.format(eventDate),
          event_start_at: supabaseEvent.event_date,
          event_end_at: supabaseEvent.end_at || supabaseEvent.event_date,
          end_at: supabaseEvent.end_at || null,
          location: fullLocation,
          address: supabaseEvent.location,
          city: supabaseEvent.city,
          event_type: supabaseEvent.event_type,
          price: supabaseEvent.price,
          image: primaryImage,
          images,
          description: supabaseEvent.description || '',
          category: supabaseEvent.category || 'Geral',
          attendeesCount: supabaseEvent.current_participants,
          tags: supabaseEvent.category ? [supabaseEvent.category] : [],
          status: supabaseEvent.status, // Add status mapping
          sales_enabled: supabaseEvent.sales_enabled ?? true,
        };
        setEvent(convertedEvent);

        // Participants are fetched reactively by useEventParticipants hook.

        // Verificar se usuário já está inscrito
        if (user) {
          await loadParticipationState(supabaseEvent.id, user.id);
        } else {
          setParticipation(null);
          setIsParticipating(false);
        }
      } else {
        toast.error('Evento não encontrado');
        navigate(ROUTE_PATHS.HOME);
      }
    } catch (err: any) {
      if (err?.message === 'EVENT_OFFLINE') {
        toast.error('Este evento está desativado e offline.');
      } else {
        toast.error('Erro ao carregar evento');
      }
      navigate(ROUTE_PATHS.HOME);
    } finally {
      setLoading(false);
    }
  };

  const handleLikeMatch = async (userId: string) => {
  if (isOwnPhotoValidationPending) {
    toast.info('Validando sua foto de perfil...');
    return;
  }

  if (isMatchPhotoMissing) {
    redirectToMatchProfileSetup();
    return;
  }

  if (!event?.id || !user?.id) {
    toast.error('Erro ao processar like');
    return;
  }

  try {
    const action = await likeMatchUser(userId);
    if (!action) return;

    const likeResult = action.result;
    const likedUser = action.targetUser;

    if (likeResult.status === 'error') {
      toast.error(likeResult.message || 'Não foi possível processar sua curtida agora.');
      return;
    }

    if (likeResult.status === 'already_liked') {
      toast.info('Você já curtiu esta pessoa');
      return;
    }

    if (likeResult.status === 'match') {
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
      setLastMatchedUserPhoto(likedUser?.photo || '');
      setLastMatchedMatchId(likeResult.match_id || null);
      setShowMatchOverlay(true);
      toast.success('É um Match! 🎉');

      const audio = new Audio('/sounds/match.mp3');
      audio.play().catch(() => {});

      if (likeResult.match_id && event?.id) {
        matchService.markMatchSeen(likeResult.match_id, event.id).catch(() => {});
      }
    } else {
      toast.success('Like enviado! ??');
    }
  } catch (error: any) {
    if (error.code === '23505') {
      toast.info('Você já curtiu esta pessoa');
    } else {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar like');
    }
  }
};

const handleSkipMatch = async (userId: string) => {
  await skipUser(userId);
};

const shouldShowSocialOnboarding = () => {
    if (!profile) return false;
    const isBioEmpty = !profile.bio;
    const isAvatarEmpty = !hasValidMatchPhoto(profile.avatar_url);
    const isObjectiveEmpty = !profile.match_intention;
    const hasLookingFor = Array.isArray(profile.looking_for) && profile.looking_for.length > 0;
    const hasGenderPreference =
      Array.isArray(profile.match_gender_preference) && profile.match_gender_preference.length > 0;
    const isPreferenceEmpty = !hasGenderPreference && !hasLookingFor;
    return isBioEmpty && isAvatarEmpty && isObjectiveEmpty && isPreferenceEmpty;
  };

  const handlePurchase = async (singleMode: boolean, ticketTypeId?: string, totalPaid?: number) => {
    if (!user || !event) {
      toast.error('Você precisa estar logado para comprar ingressos');
      // Save current location for post-login redirect
      const currentPath = window.location.pathname + window.location.search;
      sessionStorage.setItem('postLoginRedirect', currentPath);
      navigate('/login');
      return;
    }

    // Force disable singleMode if underage
    if (isUnderage && singleMode) {
      singleMode = false;
      toast.error("Funcionalidade de Match restrita para menores de 18 anos.");
    }

    if (isParticipating) {
      toast.info('Você já está inscrito neste evento!');
      return;
    }

    const eventEndTimestamp = new Date((event.event_end_at || event.end_at || event.event_start_at || '') as string).getTime();
    const isSalesClosedByDate = !Number.isNaN(eventEndTimestamp) && Date.now() >= eventEndTimestamp;
    const normalizedStatus = String((event as any).status || '').toLowerCase();
    const isEventCanceled = normalizedStatus === 'cancelado' || normalizedStatus === 'canceled' || normalizedStatus === 'cancelled';

    if (isEventCanceled) {
      toast.error('Evento cancelado.');
      return;
    }

    if (isSalesClosedByDate) {
      toast.error('Venda de ingressos encerrada');
      return;
    }

    if (event.sales_enabled === false) {
      toast.error('As vendas para este evento foram desativadas pelo organizador.');
      return;
    }

    try {
      await eventService.joinEvent(event.id, user.id, 1, ticketTypeId, totalPaid);

        toast.success(
          singleMode
          ? 'Ingresso reservado! Ative "Conheça a Galera" para ver quem vai!'
          : 'Ingresso reservado com sucesso!'
        );

      // Recarregar evento e participantes para atualizar contagem
      setIsParticipating(true);
      await loadEvent();
      await refreshParticipants();

      if (shouldShowSocialOnboarding() || !hasOwnValidPhoto) {
        setShowSocialOnboarding(true);
      }

      if (singleMode) {
        // Só ativa o match automaticamente quando a foto já estiver pronta.
        if (hasOwnValidPhoto) {
          try {
          await eventMatchService.setMatchOptIn(event.id, true);
          await loadParticipationState(event.id, user.id);
          await refreshMatchData();
          toast.success('Conheça a Galera ativado automaticamente!');
          } catch (matchError) {
            toast.info(toUserFriendlyErrorMessage(matchError));
          }
        } else if (!hasOwnValidPhoto) {
          toast.info(MATCH_PHOTO_REQUIRED_MESSAGE);
        }
        setActiveTab('attendees');
      }
    } catch (err) {
      toast.error(toUserFriendlyErrorMessage(err));
    }
  };

  const scrollToTicketSection = () => {
    const el = document.getElementById('ticket-purchase');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const [showMatchUnlockPopup, setShowMatchUnlockPopup] = useState(() => {
    return !localStorage.getItem('hasSeenMatchUnlockPopup');
  });

  if (loading || !event) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const eventEndTimestamp = new Date((event.event_end_at || event.end_at || event.event_start_at || '') as string).getTime();
  const isSalesClosedByDate = !Number.isNaN(eventEndTimestamp) && Date.now() >= eventEndTimestamp;
  const normalizedStatus = String((event as any).status || '').toLowerCase();
  const isEventCanceled = normalizedStatus === 'cancelado' || normalizedStatus === 'canceled' || normalizedStatus === 'cancelled';

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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
              {matchStats.receivedLikesCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                  {matchStats.receivedLikesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="match"
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 py-2 lg:py-1.5 text-xs lg:text-sm"
            >
              <HeartHandshake size={14} className="lg:w-4 lg:h-4" />
              Match
              {matchStats.totalMatches > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                  {matchStats.totalMatches}
                </Badge>
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

            {/* Sales Status Banner */}
            {(isEventCanceled || isSalesClosedByDate || event.sales_enabled === false) && (
              <div className="mb-6 p-4 rounded-xl bg-muted/50 border border-muted flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Venda de ingressos encerrada</h3>
                  <p className="text-sm text-muted-foreground">
                    {isEventCanceled
                      ? "Este evento foi cancelado."
                      : isSalesClosedByDate
                        ? "A venda foi encerrada ao atingir a data de término do evento."
                        : "As vendas foram desativadas pelo organizador."}
                  </p>
                </div>
              </div>
            )}


            {/* Hero Image Section */}
            <div className="relative mb-8">
              {event.images && event.images.length > 1 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {event.images.map((imageUrl, index, all) => (
                      <CarouselItem key={`${imageUrl}-${index}`}>
                        <div className="relative aspect-video rounded-2xl overflow-hidden group">
                          <img
                            src={imageUrl}
                            alt={event.title}
                            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105 grayscale-[40%]"
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

                          <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-background/70 text-xs font-medium text-foreground">
                            {index + 1} / {all.length}
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>

                  <CarouselPrevious className="left-4 top-1/2 -translate-y-1/2 h-10 w-10 border-none bg-background/80 text-foreground shadow-lg hover:bg-background" />
                  <CarouselNext className="right-4 top-1/2 -translate-y-1/2 h-10 w-10 border-none bg-background/80 text-foreground shadow-lg hover:bg-background" />
                </Carousel>
              ) : (
                <div className="relative aspect-video rounded-2xl overflow-hidden group">
                  <img
                    src={(event.images && event.images[0]) || event.image}
                    alt={event.title}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105 grayscale-[40%]"
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
                        isLiked ? "bg-red-500/20 hover:bg-red-500/30 text-red-500" : "bg-background/40 hover:bg-background/60 text-white"
                      )}
                      title={isLiked ? "Remover dos favoritos" : "Favoritar"}
                    >
                      <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
                    </Button>
                  </div>
                </div>
              )}
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

              {/* ── Confirmed counter + avatar strip (single source of truth) ───── */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {isLoadingParticipants ? (
                      <span className="inline-block w-16 h-4 bg-muted animate-pulse rounded" />
                    ) : (
                      <>
                        <strong className="text-foreground">{confirmedCount}</strong> confirmados
                      </>
                    )}
                  </span>
                </div>
                {confirmedParticipants.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className={cn(
                        'flex -space-x-3 overflow-hidden transition-all',
                        !isParticipating && 'blur-sm'
                      )}
                    >
                      {confirmedParticipants.slice(0, 5).map((p) => (
                        <div
                          key={p.user_id}
                          className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-secondary flex items-center justify-center text-[10px] font-bold overflow-hidden"
                        >
                          <img
                            src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}`}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {confirmedCount > 5 && (
                        <div className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          +{confirmedCount - 5}
                        </div>
                      )}
                    </div>
                    {!isParticipating && (
                      <span className="px-4 py-1 rounded-full bg-background/80 border border-border text-[10px] font-semibold uppercase tracking-wider leading-snug text-muted-foreground">
                        Compre o ingresso para desbloquear quem vai
                      </span>
                    )}
                  </div>
                ) : isLoadingParticipants ? null : (
                  <span className="text-xs text-muted-foreground">Seja o primeiro a confirmar!</span>
                )}
              </div>
              {/* ──────────────────────────────────────────────────────────────── */}
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

              {!user ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <UserPlus className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="font-semibold text-xl mb-2">Faça login para ver suas curtidas</h4>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Entre na sua conta para acompanhar quem se interessou por você neste evento.
                  </p>
                  <Button onClick={() => navigate('/login')} size="lg" className="px-8">Fazer Login</Button>
                </div>
              ) : isUnderage ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-destructive/5 rounded-xl border border-destructive/20 p-8">
                  <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                    <Ban className="w-10 h-10 text-destructive" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-destructive">Acesso Restrito</h3>
                  <p className="text-muted-foreground max-w-md text-lg">
                    A funcionalidade de Match é exclusiva para maiores de 18 anos.
                  </p>
                </div>
              ) : isOwnPhotoValidationPending ? (
                renderMatchPhotoValidationState()
              ) : isMatchPhotoMissing ? (
                renderMatchPhotoRequiredState('As curtidas e o swipe só ficam disponíveis quando sua foto principal está válida e pronta para aparecer para outras pessoas.')
              ) : !isParticipating ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-card/30 rounded-xl border border-border/40 p-8">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <Ticket className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">As curtidas ficam disponíveis após a compra</h3>
                  <p className="text-muted-foreground max-w-md mb-8 text-lg">
                    Garanta seu ingresso para liberar o Match e acompanhar suas conexões neste evento.
                  </p>
                  <Button
                    size="lg"
                    className="gap-2 text-lg px-8 py-6 rounded-xl"
                    onClick={() => document.getElementById('ticket-purchase')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    <Ticket size={20} />
                    Garantir ingresso
                  </Button>
                </div>
              ) : loadingReceivedLikes ? (
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
                        handleTabChange('match');
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
                            onClick={() => handleIgnoreLike(like.like_id, like.from_user_id)}
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
              {/* Header – count comes from the SAME array passed to the list */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/30 p-6 rounded-xl border border-border/40">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    Quem vai
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    {isLoadingParticipants ? (
                      <span className="inline-block w-32 h-4 bg-muted animate-pulse rounded" />
                    ) : confirmedCount === 0 ? (
                      'Ninguém confirmado ainda'
                    ) : (
                      `${confirmedCount} ${confirmedCount === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}`
                    )}
                  </p>
                </div>
              </div>

              <AttendeesList
                attendees={confirmedParticipants}
                loading={isLoadingParticipants}
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
                        {isOwnPhotoValidationPending
                          ? 'Validando sua foto'
                          : isMatchPhotoMissing
                            ? 'Foto obrigatória para o Match'
                            : isEventMatchEnabled
                              ? 'Você está visível'
                              : 'Você está invisível'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isOwnPhotoValidationPending
                          ? 'Estamos conferindo se sua foto está pronta para aparecer no swipe.'
                          : isMatchPhotoMissing
                            ? 'Adicione uma foto válida para aparecer, curtir e receber curtidas.'
                            : isEventMatchEnabled
                              ? 'Outros podem ver seu perfil'
                              : 'Ative para participar do Match'}
                      </p>
                    </div>
                    <Button
                      variant={isMatchPhotoMissing ? "default" : isEventMatchEnabled ? "outline" : "default"}
                      onClick={isMatchPhotoMissing ? openMatchProfileSetup : handleToggleMeetAttendees}
                      disabled={isOwnPhotoValidationPending}
                      className="gap-2"
                    >
                      {isOwnPhotoValidationPending ? (
                        <>
                          <Camera size={16} />
                          Validando foto...
                        </>
                      ) : isMatchPhotoMissing ? (
                        <>
                          <Camera size={16} />
                          Adicionar foto
                        </>
                      ) : isEventMatchEnabled ? (
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
              ) : isUnderage ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-destructive/5 rounded-xl border border-destructive/20 p-8">
                  <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                    <Ban className="w-10 h-10 text-destructive" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-destructive">Acesso Restrito</h3>
                  <p className="text-muted-foreground max-w-md mb-8 text-lg">
                    A funcionalidade de Match é exclusiva para maiores de 18 anos, conforme nossos termos de uso e legislação vigente.
                  </p>
                </div>
              ) : isOwnPhotoValidationPending ? (
                renderMatchPhotoValidationState()
              ) : isMatchPhotoMissing ? (
                renderMatchPhotoRequiredState('Seu perfil só entra no swipe, recebe curtidas e gera match quando a foto principal estiver válida e visível para outras pessoas.')
              ) : !isParticipating ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-card/30 rounded-xl border border-border/40 p-8">
                   <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                     <Ticket className="w-10 h-10 text-primary" />
                   </div>
                   <h3 className="text-2xl font-bold mb-3">Desbloqueie o Match do Evento</h3>
                   <p className="text-muted-foreground max-w-md mb-8 text-lg">
                     O Match deste evento é exclusivo para quem já garantiu ingresso confirmado.
                   </p>
                   <Button
                     size="lg"
                     className="gap-2 text-lg px-8 py-6 rounded-xl"
                     onClick={() => document.getElementById('ticket-purchase')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                   >
                     <Ticket size={20} />
                     Garantir ingresso
                   </Button>
                </div>
              ) : !isEventMatchEnabled ? (
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
                   {loadingMatchQueue && currentQueue.length === 0 && !isReloadingQueue ? (
                     <div className="flex justify-center py-20">
                       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                     </div>
                   ) : (
                      <MatchInterface
                       queue={currentQueue}
                       onLike={handleLikeMatch}
                       onSkip={handleSkipMatch}
                       onRefresh={reloadQueue}
                       isRefreshing={isReloadingQueue}
                     />
                   )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-40">
                <div className="rounded-xl border border-border/40 bg-card/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Fila do evento</p>
                  <p className="text-3xl font-bold mt-2">{matchStats.activeQueueCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">Pessoas disponíveis para conhecer agora.</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Curtiram você</p>
                  <p className="text-3xl font-bold mt-2">{matchStats.receivedLikesCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {matchStats.priorityQueueCount > 0
                      ? `${matchStats.priorityQueueCount} pessoa(s) da fila já demonstraram interesse.`
                      : 'Veja e responda as curtidas deste evento.'}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Seus matches</p>
                  <p className="text-3xl font-bold mt-2">{matchStats.totalMatches}</p>
                  <p className="text-sm text-muted-foreground mt-1">Conexões confirmadas dentro deste evento.</p>
                </div>
              </div>

              {loadingMatches ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : eventMatches.length > 0 ? (
                <div className="space-y-4 rounded-xl border border-border/40 bg-card/20 p-6 mt-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-semibold">Matches deste evento</h4>
                      <p className="text-sm text-muted-foreground">
                        Entre na conversa sem sair do contexto do evento.
                      </p>
                    </div>
                    <Button variant="outline" className="gap-2" onClick={() => navigate(ROUTE_PATHS.CHAT_LIST)}>
                      <MessageCircle size={16} />
                      Ver conversas
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {eventMatches.slice(0, 3).map((match) => (
                      <button
                        key={match.match_id}
                        onClick={() => navigate(`/chat/${match.match_id}`)}
                        className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-4 text-left transition-colors hover:bg-background/70"
                      >
                        <Avatar className="h-12 w-12 border border-primary/20">
                          <AvatarImage src={match.partner_avatar} />
                          <AvatarFallback>{match.partner_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{match.partner_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {match.last_message || 'Abrir conversa do match'}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-1">
                            {getMatchEventSummary(match, 3)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
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
                      src={profile?.avatar_url ?? undefined}
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
                      src={lastMatchedUserPhoto || undefined}
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
                Você e <span className="text-foreground font-bold">{lastMatchedUserName}</span> curtiram um ao outro! ??
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
                    if (lastMatchedMatchId) {
                        // Marcar interação iniciada antes de navegar
                        // matchService.markChatOpened(lastMatchedMatchId).catch(console.error); // Optional: if needed
                        navigate(`/chat/${lastMatchedMatchId}`);
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
      {!isParticipating && showMatchUnlockPopup && (
        <div className="fixed inset-x-0 bottom-[90px] md:bottom-0 z-40">
          <div className="mx-auto max-w-6xl px-4 pb-4">
            <div className="relative bg-background/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-lg shadow-primary/20 px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <button
                onClick={() => {
                  setShowMatchUnlockPopup(false);
                  localStorage.setItem('hasSeenMatchUnlockPopup', 'true');
                }}
                className="absolute -top-2 -right-2 bg-background border border-border shadow-sm rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors md:top-2 md:right-2 md:bg-transparent md:border-none md:shadow-none"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex-1 text-center md:text-left space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center justify-center md:justify-start gap-2">
                  <Flame className="w-4 h-4" />
                  Desbloqueie os Matches
                </p>
                <p className="text-xs text-muted-foreground">
                  Garanta seu ingresso para ver quem vai e conectar-se com a galera!
                </p>
              </div>
              <Button
                size="sm"
                className="w-full md:w-auto h-auto py-3 px-6 rounded-full text-xs font-bold shadow-md hover:shadow-lg transition-all whitespace-normal"
                onClick={() => {
                  setShowMatchUnlockPopup(false);
                  localStorage.setItem('hasSeenMatchUnlockPopup', 'true');
                  scrollToTicketSection();
                }}
              >
                Comprar ingresso e desbloquear matches
              </Button>
            </div>
          </div>
        </div>
      )}
      <MatchGuidelinesModal
        isOpen={showMatchGuidelines}
        onClose={() => setShowMatchGuidelines(false)}
        onAccept={() => {
          setShowMatchGuidelines(false);
          toggleMatchStatus(true);
        }}
      />
    </Layout>
  );
}
