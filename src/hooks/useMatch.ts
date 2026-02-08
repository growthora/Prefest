import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Match, Message, APP_CONFIG } from '@/lib/index';
import { useAuth } from '@/contexts/AuthContext';
import { likeService } from '@/services/like.service';
import { toast } from 'sonner';

/**
 * Hook para gerenciar o sistema de matchmaking e o Conheça a Galera!!
 */
export function useMatch(eventId?: string) {
  const { user, profile, updateProfile } = useAuth();
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentQueue, setCurrentQueue] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Mapear single_mode do profile
  const isSingleMode = profile?.single_mode || false;

  // Carregar matches existentes
  useEffect(() => {
    if (user) {
      loadMatches();
    }
  }, [user]);

  const loadMatches = async () => {
    if (!user) return;
    try {
      const userMatches = await likeService.getMatches(user.id);
      // Converter UserLike[] para Match[]
      const mappedMatches: Match[] = userMatches.map(m => ({
        id: m.id,
        eventId: m.event_id,
        userIds: [m.from_user_id, m.to_user_id],
        status: 'active',
        createdAt: m.created_at,
        expiresAt: new Date(new Date(m.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        // TODO: Buscar última mensagem real
      }));
      setMatches(mappedMatches);
    } catch (error) {
      console.error('Erro ao carregar matches:', error);
    }
  };

  // Carregar fila de candidatos
  useEffect(() => {
    if (eventId && user && isSingleMode) {
      loadQueue();
    }
  }, [eventId, user, isSingleMode]);

  const loadQueue = async () => {
    if (!eventId || !user) return;
    setLoading(true);
    try {
      const candidates = await likeService.getPotentialMatches(eventId, user.id);
      
      // Mapear profile do backend para interface User do frontend
      const mappedUsers: User[] = candidates.map(c => ({
        id: c.id,
        name: c.full_name || 'Usuário',
        age: c.birth_date ? new Date().getFullYear() - new Date(c.birth_date).getFullYear() : 25,
        bio: c.bio || '',
        photo: c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name || 'User')}`,
        vibes: c.vibes || [],
        isSingleMode: c.single_mode,
        showInitialsOnly: c.show_initials_only,
        matchIntention: c.match_intention,
        genderPreference: c.match_gender_preference,
        sexuality: c.sexuality,
        // compatibilityScore removido temporariamente até termos o algoritmo real
      }));
      
      setCurrentQueue(mappedUsers);
    } catch (error) {
      console.error('Erro ao carregar fila:', error);
      toast.error('Erro ao carregar participantes');
    } finally {
      setLoading(false);
    }
  };

  const toggleSingleMode = useCallback(async () => {
    if (!user) return;
    try {
      await updateProfile({ single_mode: !isSingleMode });
      toast.success(isSingleMode ? 'Modo solteiro desativado' : 'Modo solteiro ativado!');
    } catch (error) {
      console.error('Erro ao atualizar modo solteiro:', error);
      toast.error('Erro ao atualizar status');
    }
  }, [user, isSingleMode, updateProfile]);

  const likeUser = useCallback(async (targetUserId: string) => {
    if (!user || !eventId) return false;
    
    // Remover da fila localmente para feedback instantâneo
    setCurrentQueue(prev => prev.filter(u => u.id !== targetUserId));

    try {
      const result = await likeService.likeUser(targetUserId, eventId);
      
      if (result.is_match) {
        toast.success('Deu Match! 🎉');
        loadMatches(); // Recarregar matches
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao dar like:', error);
      toast.error('Erro ao processar like');
      return false;
    }
  }, [eventId, user]);

  const skipUser = useCallback((targetUserId: string) => {
    // Apenas remove da fila localmente
    // Idealmente, persistir "skip" no banco para não mostrar novamente
    setCurrentQueue(prev => prev.filter(u => u.id !== targetUserId));
  }, []);

  const getMatchById = useCallback((matchId: string) => {
    return matches.find(m => m.id === matchId);
  }, [matches]);

  const getPartnerProfile = useCallback((match: Match) => {
    if (!user) return undefined;
    const partnerId = match.userIds.find(id => id !== user.id);
    // Aqui precisaríamos ter o perfil do parceiro carregado
    // Por enquanto, vamos tentar achar nos matches carregados se trouxemos dados populados
    // O likeService.getMatches traz 'from_user'. Se eu fui quem deu o like, 'to_user' é o parceiro.
    // Isso requer ajuste no mapping.
    return undefined; // Placeholder
  }, [user]);

  // Envio de mensagem (ainda simulado ou placeholder)
  const sendMessage = useCallback((matchId: string, content: string) => {
    console.log('TODO: Implementar envio real de mensagem', { matchId, content });
    // TODO: Usar service de mensagens real
  }, []);

  const stats = useMemo(() => ({
    totalMatches: matches.length,
    activeQueueCount: currentQueue.length,
    hasPendingActions: currentQueue.length > 0,
  }), [matches.length, currentQueue.length]);

  return {
    isSingleMode,
    toggleSingleMode,
    currentQueue,
    likeUser,
    skipUser,
    matches,
    getMatchById,
    getPartnerProfile,
    sendMessage,
    stats,
    primaryColor: APP_CONFIG.primaryColor,
    loading
  };
}
