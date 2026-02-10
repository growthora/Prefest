import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Match, Message, APP_CONFIG } from '@/lib/index';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { likeService } from '@/services/like.service';
import { matchService } from '@/services/match.service';
import { chatService } from '@/services/chat.service';
import { toast } from 'sonner';

/**
 * Hook para gerenciar o sistema de matchmaking e o Conheça a Galera!!
 */
export function useMatch(eventId?: string) {
  const { user, profile, updateProfile } = useAuth();
  const { checkAccess } = useFeatureAccess();
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentQueue, setCurrentQueue] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Mapear match_enabled do profile
  const isSingleMode = profile?.match_enabled || false;

  // Carregar matches existentes
  useEffect(() => {
    if (user) {
      loadMatches();
    }
  }, [user]);

  const loadMatches = async () => {
    if (!user) return;
    try {
      const userMatches = await matchService.getUserMatches();
      // Converter Match (do service) para Match (da UI)
      const mappedMatches: Match[] = userMatches.map(m => ({
        id: m.match_id,
        eventId: m.event_id,
        userIds: [user.id, m.partner_id],
        status: 'active',
        createdAt: m.created_at,
        expiresAt: new Date(new Date(m.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        partner: {
            id: m.partner_id,
            name: m.partner_name,
            photo: m.partner_avatar,
        }
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
      await updateProfile({ match_enabled: !isSingleMode });
      toast.success(isSingleMode ? 'Modo Match desativado' : 'Modo Match ativado!');
    } catch (error) {
      console.error('Erro ao atualizar modo Match:', error);
      toast.error('Erro ao atualizar status');
    }
  }, [user, isSingleMode, updateProfile]);

  const likeUser = useCallback(async (targetUserId: string) => {
    if (!checkAccess('dar like')) return false;

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
    return match.partner; 
  }, [user]);

  // Envio de mensagem
  const sendMessage = useCallback(async (matchId: string, content: string) => {
    if (!user) return;
    try {
        // Primeiro garante que o chat existe
        const chatId = await chatService.getOrCreateChat(matchId);
        if (chatId) {
            await chatService.sendMessage(chatId, user.id, content);
        }
    } catch (error) {
        console.error("Erro ao enviar mensagem", error);
        toast.error("Erro ao enviar mensagem");
    }
  }, [user]);

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
