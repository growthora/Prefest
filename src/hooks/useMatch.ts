import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_CONFIG, User } from '@/lib';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { eventMatchService, type EventReceivedLike } from '@/services/event-match.service';
import type { LikeResult } from '@/services/like.service';
import type { Match } from '@/services/match.service';
import { logMatchDebug } from '@/utils/matchDebug';
import {
  hasRenderableMatchPhoto,
  hasValidMatchPhoto,
  MATCH_PHOTO_REQUIRED_MESSAGE,
} from '@/utils/matchPhoto';

interface LikeActionResponse {
  result: LikeResult;
  targetUser?: User;
}

type MatchSyncScope = 'queue' | 'likes' | 'matches';

interface UseMatchOptions {
  matchEnabled?: boolean;
}

/**
 * Fonte unica de verdade para o Match por evento.
 * Centraliza fila, curtidas recebidas, matches e assinaturas realtime.
 */
export function useMatch(eventId?: string, options?: UseMatchOptions) {
  const { user, profile } = useAuth();

  const [matches, setMatches] = useState<Match[]>([]);
  const [currentQueue, setCurrentQueue] = useState<User[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<EventReceivedLike[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingReceivedLikes, setLoadingReceivedLikes] = useState(false);
  const [isReloadingQueue, setIsReloadingQueue] = useState(false);
  const [hasOwnValidPhoto, setHasOwnValidPhoto] = useState(false);
  const [isCheckingOwnPhoto, setIsCheckingOwnPhoto] = useState(false);
  const [hasEvaluatedOwnPhoto, setHasEvaluatedOwnPhoto] = useState(false);

  const refreshTimeoutRef = useRef<number | null>(null);
  const scheduledScopesRef = useRef<Set<MatchSyncScope>>(new Set());
  const queueRequestIdRef = useRef(0);
  const isQueueFetchInFlightRef = useRef(false);

  const isSingleMode = Boolean(options?.matchEnabled);

  useEffect(() => {
    let isMounted = true;

    setHasEvaluatedOwnPhoto(false);

    if (!user || !profile) {
      setHasOwnValidPhoto(false);
      setIsCheckingOwnPhoto(false);
      return () => {
        isMounted = false;
      };
    }

    if (!profile.avatar_url || !hasValidMatchPhoto(profile.avatar_url)) {
      setHasOwnValidPhoto(false);
      setIsCheckingOwnPhoto(false);
      setHasEvaluatedOwnPhoto(true);
      return () => {
        isMounted = false;
      };
    }

    setIsCheckingOwnPhoto(true);

    void hasRenderableMatchPhoto(profile.avatar_url)
      .then((result) => {
        if (!isMounted) return;
        setHasOwnValidPhoto(result);
      })
      .catch(() => {
        if (!isMounted) return;
        setHasOwnValidPhoto(false);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsCheckingOwnPhoto(false);
        setHasEvaluatedOwnPhoto(true);
      });

    return () => {
      isMounted = false;
    };
  }, [profile?.avatar_url, user]);

  const loadMatches = useCallback(async () => {
    if (!user || !eventId || !isSingleMode || !hasOwnValidPhoto) {
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
  }, [eventId, hasOwnValidPhoto, isSingleMode, user]);

  const loadReceivedLikes = useCallback(async () => {
    if (!user || !eventId || !isSingleMode || !hasOwnValidPhoto) {
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
  }, [eventId, hasOwnValidPhoto, isSingleMode, user]);

  const fetchQueue = useCallback(async ({ resetState = false } = {}): Promise<User[]> => {
    if (!user || !eventId || !isSingleMode || !hasOwnValidPhoto) {
      setCurrentQueue([]);
      return [];
    }

    if (isQueueFetchInFlightRef.current) {
      return [];
    }

    const requestId = ++queueRequestIdRef.current;
    isQueueFetchInFlightRef.current = true;

    if (resetState) {
      setCurrentQueue([]);
    }

    setLoadingQueue(true);

    try {
      const candidates = await eventMatchService.getCandidates(eventId, user.id);

      if (requestId === queueRequestIdRef.current) {
        setCurrentQueue(candidates);
      }

      return candidates;
    } catch {
      if (requestId === queueRequestIdRef.current) {
        setCurrentQueue([]);
        toast.error('Erro ao carregar participantes do Match');
      }

      return [];
    } finally {
      if (requestId === queueRequestIdRef.current) {
        setLoadingQueue(false);
      }

      isQueueFetchInFlightRef.current = false;
    }
  }, [eventId, hasOwnValidPhoto, isSingleMode, user]);

  const loadQueue = useCallback(async () => {
    await fetchQueue();
  }, [fetchQueue]);

  const flushScheduledSync = useCallback(async () => {
    const scopes = Array.from(scheduledScopesRef.current);
    scheduledScopesRef.current.clear();

    if (scopes.length === 0) {
      return;
    }

    const tasks: Promise<unknown>[] = [];

    if (scopes.includes('matches')) {
      tasks.push(loadMatches());
    }

    if (scopes.includes('likes')) {
      tasks.push(loadReceivedLikes());
    }

    if (scopes.includes('queue')) {
      tasks.push(loadQueue());
    }

    await Promise.all(tasks);
  }, [loadMatches, loadQueue, loadReceivedLikes]);

  const scheduleSync = useCallback((...scopes: MatchSyncScope[]) => {
    scopes.forEach((scope) => scheduledScopesRef.current.add(scope));

    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      void flushScheduledSync();
    }, 160);
  }, [flushScheduledSync]);

  const reloadQueue = useCallback(async () => {
    if (!user || !eventId || !isSingleMode || !hasOwnValidPhoto) {
      setCurrentQueue([]);
      return;
    }

    if (isQueueFetchInFlightRef.current) {
      return;
    }

    setCurrentQueue([]);
    setIsReloadingQueue(true);

    try {
      const resetResult = await eventMatchService.resetQueue(eventId);
      const candidates = await fetchQueue({ resetState: true });

      if (resetResult === null) {
        toast.info('A recarga completa da fila sera aplicada apos atualizar o banco.');
      } else if (candidates.length === 0) {
        toast.info('Nenhum perfil novo disponivel no momento.');
      }
    } catch {
      toast.error('Erro ao recarregar perfis');
    } finally {
      setIsReloadingQueue(false);
    }
  }, [eventId, fetchQueue, hasOwnValidPhoto, isSingleMode, user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMatches(), loadReceivedLikes(), loadQueue()]);
  }, [loadMatches, loadQueue, loadReceivedLikes]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!user || !eventId) return;

    const channel = eventMatchService.subscribeToEvent(eventId, user.id, {
      onQueueChanged: () => {
        scheduleSync('queue');
      },
      onLikesChanged: () => {
        scheduleSync('likes', 'queue');
      },
      onMatchesChanged: () => {
        scheduleSync('matches', 'likes', 'queue');
      },
    });

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      scheduledScopesRef.current.clear();
      channel.unsubscribe();
    };
  }, [eventId, scheduleSync, user]);

  const likeUser = useCallback(async (targetUserId: string): Promise<LikeActionResponse | null> => {
    if (!user || !eventId) return null;

    if (!isSingleMode) {
      toast.info('Ative o Match deste evento para curtir perfis.');
      return null;
    }

    if (!hasOwnValidPhoto) {
      toast.info(MATCH_PHOTO_REQUIRED_MESSAGE);
      return null;
    }

    const targetUser = currentQueue.find((candidate) => candidate.id === targetUserId);
    const previousQueue = currentQueue;

    setCurrentQueue((prev) => prev.filter((candidate) => candidate.id !== targetUserId));

    try {
      const result = await eventMatchService.likeUser(eventId, targetUserId);

      logMatchDebug('RECIPROCIDADE', {
        eventId,
        targetUserId,
        reciprocalLike: result.status === 'match',
        matchId: result.match_id,
        reactivated: result.match_reactivated ?? false,
      });

      if (result.status === 'match') {
        await Promise.all([loadMatches(), loadReceivedLikes(), loadQueue()]);
      } else if (previousQueue.length <= 1) {
        void loadQueue();
      }

      return { result, targetUser };
    } catch (error) {
      setCurrentQueue(previousQueue);
      throw error;
    }
  }, [currentQueue, eventId, hasOwnValidPhoto, isSingleMode, loadMatches, loadQueue, loadReceivedLikes, user]);

  const likeBack = useCallback(async (targetUserId: string, likeId: string): Promise<LikeActionResponse | null> => {
    if (!user || !eventId) return null;

    if (!isSingleMode) {
      toast.info('Ative o Match deste evento para responder curtidas.');
      return null;
    }

    if (!hasOwnValidPhoto) {
      toast.info(MATCH_PHOTO_REQUIRED_MESSAGE);
      return null;
    }

    const receivedLike = receivedLikes.find((like) => like.like_id === likeId);
    const previousLikes = receivedLikes;
    setReceivedLikes((prev) => prev.filter((like) => like.like_id !== likeId));

    try {
      const result = await eventMatchService.likeUser(eventId, targetUserId);

      logMatchDebug('LIKE BACK RESULTADO', {
        eventId,
        targetUserId,
        matchId: result.match_id,
        status: result.status,
        reactivated: result.match_reactivated ?? false,
      });

      if (result.status === 'match') {
        await Promise.all([loadMatches(), loadReceivedLikes(), loadQueue()]);
      } else {
        void loadReceivedLikes();
      }

      return {
        result,
        targetUser:
          currentQueue.find((candidate) => candidate.id === targetUserId) ||
          (receivedLike
            ? {
                id: receivedLike.from_user_id,
                name: receivedLike.from_user_name,
                age: receivedLike.from_user_age,
                bio: receivedLike.from_user_bio || '',
                photo: receivedLike.from_user_photo || '',
                vibes: [],
                isSingleMode: true,
                showInitialsOnly: false,
                likedYou: true,
              }
            : undefined),
      };
    } catch (error) {
      setReceivedLikes(previousLikes);
      throw error;
    }
  }, [currentQueue, eventId, hasOwnValidPhoto, isSingleMode, loadMatches, loadQueue, loadReceivedLikes, receivedLikes, user]);

  const skipUser = useCallback(async (targetUserId: string) => {
    if (!eventId) return;

    if (!isSingleMode) {
      toast.info('Ative o Match deste evento para navegar na fila.');
      return;
    }

    const previousQueue = currentQueue;
    setCurrentQueue((prev) => prev.filter((candidate) => candidate.id !== targetUserId));

    try {
      const persisted = await eventMatchService.skipUser(eventId, targetUserId);

      if (!persisted) {
        toast.info('Perfil ocultado nesta sessao. A persistencia sera aplicada apos atualizar o banco.');
      } else if (previousQueue.length <= 1) {
        void loadQueue();
      }
    } catch {
      setCurrentQueue(previousQueue);
      toast.error('Erro ao ocultar esse perfil');
    }
  }, [currentQueue, eventId, isSingleMode, loadQueue]);

  const ignoreLike = useCallback(async (targetUserId: string, likeId: string) => {
    if (!isSingleMode) {
      toast.info('Ative o Match deste evento para responder curtidas.');
      return;
    }
    if (!eventId) return;

    const previousLikes = receivedLikes;
    setReceivedLikes((prev) => prev.filter((like) => like.like_id !== likeId));

    try {
      await eventMatchService.ignoreLike(eventId, likeId, targetUserId);
    } catch (error) {
      setReceivedLikes(previousLikes);
      throw error;
    }
  }, [eventId, isSingleMode, receivedLikes]);

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
    hasOwnValidPhoto,
    isCheckingOwnPhoto,
    hasEvaluatedOwnPhoto,
    currentQueue,
    receivedLikes,
    matches,
    likeUser,
    likeBack,
    skipUser,
    ignoreLike,
    refreshAll,
    reloadQueue,
    stats,
    loading: loadingQueue,
    isReloadingQueue,
    loadingMatches,
    loadingReceivedLikes,
    isMatchEnabled: isSingleMode,
    primaryColor: APP_CONFIG.primaryColor,
  };
}
