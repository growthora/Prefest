import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_CONFIG, User } from '@/lib';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { eventMatchService, type EventReceivedLike } from '@/services/event-match.service';
import type { LikeResult } from '@/services/like.service';
import type { Match } from '@/services/match.service';

interface LikeActionResponse {
  result: LikeResult;
  targetUser?: User;
}

/**
 * Fonte única de verdade para o Match por evento.
 * Centraliza fila, curtidas recebidas, matches e assinaturas realtime.
 */
export function useMatch(eventId?: string) {
  const { user, profile } = useAuth();

  const [matches, setMatches] = useState<Match[]>([]);
  const [currentQueue, setCurrentQueue] = useState<User[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<EventReceivedLike[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingReceivedLikes, setLoadingReceivedLikes] = useState(false);

  const refreshTimeoutRef = useRef<number | null>(null);

  const isSingleMode = profile?.match_enabled || false;

  const loadMatches = useCallback(async () => {
    if (!user || !eventId) {
      setMatches([]);
      return;
    }

    setLoadingMatches(true);
    try {
      const eventMatches = await eventMatchService.getEventMatches(eventId);
      setMatches(eventMatches);
    } catch {
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  }, [eventId, user]);

  const loadReceivedLikes = useCallback(async () => {
    if (!user || !eventId) {
      setReceivedLikes([]);
      return;
    }

    setLoadingReceivedLikes(true);
    try {
      const likes = await eventMatchService.getReceivedLikes(eventId);
      setReceivedLikes(likes);
    } catch {
      setReceivedLikes([]);
    } finally {
      setLoadingReceivedLikes(false);
    }
  }, [eventId, user]);

  const loadQueue = useCallback(async () => {
    if (!user || !eventId || !isSingleMode) {
      setCurrentQueue([]);
      return;
    }

    setLoadingQueue(true);
    try {
      const candidates = await eventMatchService.getCandidates(eventId, user.id);
      setCurrentQueue(candidates);
    } catch {
      setCurrentQueue([]);
      toast.error('Erro ao carregar participantes do Match');
    } finally {
      setLoadingQueue(false);
    }
  }, [eventId, isSingleMode, user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMatches(), loadReceivedLikes(), loadQueue()]);
  }, [loadMatches, loadQueue, loadReceivedLikes]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!user || !eventId) return;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshAll();
      }, 200);
    };

    const channel = eventMatchService.subscribeToEvent(eventId, user.id, scheduleRefresh);

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      channel.unsubscribe();
    };
  }, [eventId, refreshAll, user]);

  const likeUser = useCallback(async (targetUserId: string): Promise<LikeActionResponse | null> => {
    if (!user || !eventId) return null;

    const targetUser = currentQueue.find((candidate) => candidate.id === targetUserId);
    const previousQueue = currentQueue;

    setCurrentQueue((prev) => prev.filter((candidate) => candidate.id !== targetUserId));

    try {
      const result = await eventMatchService.likeUser(eventId, targetUserId);

      if (result.status === 'match') {
        loadMatches();
        loadReceivedLikes();
      }

      return { result, targetUser };
    } catch (error) {
      setCurrentQueue(previousQueue);
      throw error;
    }
  }, [currentQueue, eventId, loadMatches, loadReceivedLikes, user]);

  const likeBack = useCallback(async (targetUserId: string, likeId: string): Promise<LikeActionResponse | null> => {
    if (!user || !eventId) return null;

    const previousLikes = receivedLikes;
    setReceivedLikes((prev) => prev.filter((like) => like.like_id !== likeId));

    try {
      const result = await eventMatchService.likeUser(eventId, targetUserId);

      if (result.status === 'match') {
        await Promise.all([loadMatches(), loadQueue()]);
      }

      return {
        result,
        targetUser: currentQueue.find((candidate) => candidate.id === targetUserId),
      };
    } catch (error) {
      setReceivedLikes(previousLikes);
      throw error;
    }
  }, [currentQueue, eventId, loadMatches, loadQueue, receivedLikes, user]);

  const skipUser = useCallback(async (targetUserId: string) => {
    if (!eventId) return;

    const previousQueue = currentQueue;
    setCurrentQueue((prev) => prev.filter((candidate) => candidate.id !== targetUserId));

    try {
      const persisted = await eventMatchService.skipUser(eventId, targetUserId);

      if (!persisted) {
        toast.info('Perfil ocultado nesta sessão. A persistência será aplicada após atualizar o banco.');
      }
    } catch (error) {
      setCurrentQueue(previousQueue);
      toast.error('Erro ao ocultar esse perfil');
    }
  }, [currentQueue, eventId]);

  const ignoreLike = useCallback(async (targetUserId: string, likeId: string) => {
    const previousLikes = receivedLikes;
    setReceivedLikes((prev) => prev.filter((like) => like.like_id !== likeId));

    try {
      if (eventId) {
        await eventMatchService.skipUser(eventId, targetUserId);
      }
    } catch (error) {
      setReceivedLikes(previousLikes);
      throw error;
    }
  }, [eventId, receivedLikes]);

  const stats = useMemo(() => {
    const priorityQueueCount = currentQueue.filter((candidate) => candidate.likedYou).length;

    return {
      totalMatches: matches.length,
      activeQueueCount: currentQueue.length,
      receivedLikesCount: receivedLikes.length,
      priorityQueueCount,
      hasPendingActions: currentQueue.length > 0 || receivedLikes.length > 0,
    };
  }, [currentQueue, matches.length, receivedLikes.length]);

  return {
    isSingleMode,
    currentQueue,
    receivedLikes,
    matches,
    likeUser,
    likeBack,
    skipUser,
    ignoreLike,
    refreshAll,
    stats,
    loading: loadingQueue,
    loadingMatches,
    loadingReceivedLikes,
    primaryColor: APP_CONFIG.primaryColor,
  };
}
