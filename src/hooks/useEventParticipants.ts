/**
 * useEventParticipants
 *
 * Single Source of Truth for confirmed participants of an event.
 *
 * Feeds BOTH the header avatar strip AND the "Quem vai" tab list from
 * the exact same data set, so the counter always matches what is shown.
 */

import { useState, useEffect, useCallback } from 'react';
import { eventService } from '@/services/event.service';

export interface EventParticipantItem {
  user_id: string;
  name: string;
  avatar_url: string | null;
  city?: string;
  is_online?: boolean;
  last_seen?: string;
  match_enabled?: boolean;
  username?: string;
}

interface UseEventParticipantsReturn {
  /** Full list of confirmed participants (single source of truth) */
  confirmedParticipants: EventParticipantItem[];
  /** Derived count – always === confirmedParticipants.length */
  confirmedCount: number;
  isLoading: boolean;
  error: string | null;
  /** Call this to manually refresh (e.g. after a purchase) */
  refresh: () => Promise<void>;
}

export function useEventParticipants(
  eventId: string | undefined | null
): UseEventParticipantsReturn {
  const [confirmedParticipants, setConfirmedParticipants] = useState<EventParticipantItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipants = useCallback(async () => {
    if (!eventId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data: any[] = await eventService.getEventAttendees(eventId);

      console.log('[useEventParticipants] participants fetched:', data?.length ?? 0, data);

      const mapped: EventParticipantItem[] = (data ?? []).map((p: any) => ({
        user_id: p.user_id ?? p.id ?? '',
        name: p.name ?? p.full_name ?? 'Usuário',
        avatar_url: p.avatar_url ?? null,
        city: p.city ?? p.location ?? undefined,
        is_online: p.is_online ?? false,
        last_seen: p.last_seen ?? undefined,
        match_enabled: p.match_enabled ?? false,
        username: p.username ?? undefined,
      }));

      console.log('[useEventParticipants] confirmedParticipants mapped:', mapped.length);
      setConfirmedParticipants(mapped);
    } catch (err: any) {
      console.error('[useEventParticipants] Error:', err);
      setError('Erro ao carregar participantes confirmados');
      setConfirmedParticipants([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  return {
    confirmedParticipants,
    confirmedCount: confirmedParticipants.length,
    isLoading,
    error,
    refresh: fetchParticipants,
  };
}
