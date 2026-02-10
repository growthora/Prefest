import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { MatchInterface } from '@/components/MatchCards';
import { useMatch } from '@/hooks/useMatch';
import { useAuth } from '@/hooks/useAuth';
import { eventService, MatchCandidate } from '@/services/event.service';
import { likeService } from '@/services/like.service';
import { toast } from 'sonner';
import { ROUTE_PATHS, APP_CONFIG, User } from '@/lib/index';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  MapPin, 
  Filter, 
  MessageCircle, 
  ArrowLeft, 
  Flame,
  ShieldCheck,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Página exclusiva do Match do Evento
 * Oferece uma experiência imersiva estilo Tinder para solteiros confirmados no evento
 */
const MatchEvent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { 
    isSingleMode, 
    currentQueue, 
    likeUser, 
    skipUser, 
    matches, 
    stats 
  } = useMatch(id);

  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [lastMatchedUser, setLastMatchedUser] = useState<string | null>(null);
  const [lastMatchedUserName, setLastMatchedUserName] = useState<string>('');
  const [lastMatchedUserPhoto, setLastMatchedUserPhoto] = useState<string>('');
  const [lastMatchChatId, setLastMatchChatId] = useState<string | null>(null);
  const [eventParticipants, setEventParticipants] = useState<MatchCandidate[]>([]);
  const [eventType, setEventType] = useState<'festive' | 'formal'>('festive');

  // Audio ref for match sound
  const matchAudioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    matchAudioRef.current = new Audio('/sounds/match.mp3');
  }, []);
  const [loading, setLoading] = useState(true);

  // Carregar participantes do evento com single_mode ativo
  useEffect(() => {
    const loadEventParticipants = async () => {
      if (!id || !user) return;
      
      try {
        setLoading(true);
        console.log('🔄 Carregando participantes do evento:', id);
        
        // Carregar evento para pegar o tipo
        const event = await eventService.getEventById(id);
        if (event?.event_type) {
          setEventType(event.event_type);
          console.log('🎯 Tipo do evento:', event.event_type);
        }
        
        const participants = await eventService.getMatchCandidates(id);
        
        // Filtrar o próprio usuário da lista
        const filtered = participants.filter((p) => p.id !== user.id);
        setEventParticipants(filtered);
        console.log('✅ Participantes carregados:', filtered.length);
      } catch (error) {
        console.error('❌ Erro ao carregar participantes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEventParticipants();
  }, [id, user]);

  const handleLike = async (userId: string) => {
    if (!id || !user?.id) {
      toast.error('Erro ao processar like');
      return;
    }

    try {
      console.log('👍 Dando like em:', userId);
      
      // Registrar o like no banco de dados
      const likeResult = await likeService.likeUser(userId, id);
      
      // Encontrar o usuário que recebeu o like para pegar o nome e foto
      const likedUser = eventParticipants.find(p => p.id === userId);
      
      if (likeResult.status === 'match') {
        // É um match!
        console.log('💕 É um match!');
        setLastMatchedUser(userId);
        setLastMatchedUserName(likedUser?.full_name || 'Alguém');
        setLastMatchedUserPhoto(likedUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`);
        // Usar match_id para navegação consistente com Chat.tsx
        setLastMatchChatId(likeResult.match_id || null);
        
        setShowMatchOverlay(true);
        toast.success('É um Match! 💕');
        
        // Play sound
        if (matchAudioRef.current) {
            matchAudioRef.current.play().catch(e => console.log('Audio play failed', e));
        }

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
      
      // Também chamar o hook de match local para atualizar a UI
      likeUser(userId);
    } catch (error: any) {
      console.error('❌ Erro ao dar like:', error);
      
      // Se o erro for de like duplicado, apenas ignorar silenciosamente
      if (error.code === '23505') {
        console.log('⚠️ Like já existe');
        toast.info('Você já curtiu esta pessoa');
      } else {
        toast.error('Erro ao processar like');
      }
    }
  };

  const handleSkip = (userId: string) => {
    skipUser(userId);
  };

  // Textos e ícones dinâmicos baseados no tipo de evento
  const isFormal = eventType === 'formal';
  const featureTitle = isFormal ? 'Trocar Networking' : 'Conheça a Galera!!';
  const featureName = isFormal ? 'Networking' : 'Conheça a Galera!!';
  const badgeText = isFormal ? 'Networking do Evento' : 'Match do Evento';
  const FeatureIcon = isFormal ? Sparkles : Flame;

  // Se o Conheça a Galera!! não estiver ativo, redirecionamos ou mostramos um aviso elegante
  if (!profile?.match_enabled) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <FeatureIcon className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold mb-4">{featureTitle} Desativado</h1>
          <p className="text-muted-foreground max-w-md mb-8">
            Ative o {featureName} nas configurações de compra ou no seu perfil para {isFormal ? 'trocar contatos profissionais' : 'ver quem mais está na mesma vibe que você'} neste evento.
          </p>
          <Button 
            onClick={() => navigate(ROUTE_PATHS.PROFILE)}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-6 rounded-full text-lg shadow-lg shadow-primary/20 transition-all"
          >
            Ativar no Perfil
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        {/* Header da Página de Match */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex flex-col items-center">
            <Badge className="bg-primary/20 text-primary border-none mb-1 px-3 py-0.5 flex items-center gap-1.5">
              <FeatureIcon className="w-3 h-3 fill-current" />
              {badgeText}
            </Badge>
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
              {id?.substring(0, 8) || 'SPARK'}-SYNC
            </span>
          </div>

          <div className="relative">
            <button 
              onClick={() => navigate(ROUTE_PATHS.PROFILE)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <Filter className="w-6 h-6 text-muted-foreground" />
            </button>
            {stats.totalMatches > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-primary text-[10px] flex items-center justify-center rounded-full text-white font-bold">
                {stats.totalMatches}
              </span>
            )}
          </div>
        </div>

        {/* Interface de Match Estilo Tinder */}
        <div className="relative h-[600px] sm:h-[650px] w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
                <FeatureIcon className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground">Carregando participantes...</p>
            </div>
          ) : eventParticipants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Sparkles className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-xl font-bold mb-2">Nenhum participante encontrado</h3>
              <p className="text-muted-foreground text-sm">
                Ainda não há outros participantes com "{featureName}" ativo neste evento.
              </p>
              <Button 
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Voltar
              </Button>
            </div>
          ) : (
            <MatchInterface 
              queue={eventParticipants.map(p => ({
                id: p.id,
                name: p.full_name || 'Usuário',
                photo: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`,
                age: p.age,
                bio: p.bio || 'Olá! Estou ansioso para esse evento! 🎉',
                location: undefined,
                vibes: (p.vibes || []).map(v => v as any),
                interests: [],
                badges: [],
                isSingleMode: true,
                showInitialsOnly: false,
                matchIntention: (p.match_intention as any) || 'paquera',
                genderPreference: 'todos',
                sexuality: 'heterossexual',
                height: p.height,
                relationshipStatus: p.relationship_status,
                isOnline: p.is_online,
                lastSeen: p.last_seen
              }))} 
              onLike={handleLike} 
              onSkip={handleSkip} 
            />
          )}
          {/* Overlay de Match (Sucesso) */}
          <AnimatePresence>
            {showMatchOverlay && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 via-background/95 to-primary/20 backdrop-blur-xl rounded-3xl border border-primary/30 p-8 text-center overflow-hidden"
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
                    <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-primary shadow-2xl">
                      <img 
                        src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
                        alt="Você"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Ícone de coração no meio */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                    className="relative mx-4 z-20"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shadow-2xl">
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
                    <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-pink-500 shadow-2xl">
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
                  className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-primary mb-2 tracking-tighter italic"
                >
                  IT'S A MATCH!
                </motion.h2>
                
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-muted-foreground mb-8 text-lg"
                >
                  Você e <span className="text-white font-semibold">{lastMatchedUserName}</span> curtiram um ao outro! 💕
                </motion.p>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex flex-col w-full gap-3"
                >
                  <Button 
                    onClick={() => {
                      setShowMatchOverlay(false);
                      if (lastMatchChatId) {
                        // Marcar interação iniciada antes de navegar
                        matchService.markChatOpened(lastMatchChatId).catch(console.error);
                        navigate(`/chat/${lastMatchChatId}`);
                      } else {
                        toast.error('Erro ao redirecionar para o chat');
                      }
                    }}
                    className="bg-gradient-to-r from-pink-500 to-primary hover:from-pink-600 hover:to-primary/90 text-white py-6 rounded-xl font-bold text-lg shadow-xl"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Enviar Mensagem
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => setShowMatchOverlay(false)}
                    className="text-muted-foreground hover:text-white"
                  >
                    Continuar Swiping
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Rodapé Social e Info */}
        <div className="mt-12 grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center text-center group hover:border-primary/30 transition-all">
            <MapPin className="w-6 h-6 text-primary mb-2 opacity-70 group-hover:opacity-100" />
            <span className="text-sm font-semibold">Mapa Social</span>
            <span className="text-[10px] text-muted-foreground uppercase mt-1">Visualização Anônima</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center text-center group hover:border-primary/30 transition-all">
            <ShieldCheck className="w-6 h-6 text-primary mb-2 opacity-70 group-hover:opacity-100" />
            <span className="text-sm font-semibold">Privacidade</span>
            <span className="text-[10px] text-muted-foreground uppercase mt-1">Iniciais Ocultas</span>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-primary">Participantes Reais:</strong> Você está vendo apenas pessoas que estão inscritas neste evento e que ativaram "{featureName}".
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MatchEvent;