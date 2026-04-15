import { User } from '@/lib';
import { supabase } from '@/lib/supabase';
import { eventService } from '@/services/event.service';
import { likeService, type LikeResult } from '@/services/like.service';
import { matchService, type Match } from '@/services/match.service';
import {
  filterItemsWithRenderableMatchPhoto,
  hasValidMatchPhoto,
  normalizeMatchPhoto,
} from '@/utils/matchPhoto';

export interface EventReceivedLike {
  like_id: string;
  from_user_id: string;
  from_user_name: string;
  from_user_photo: string | null;
  from_user_bio: string | null;
  from_user_age: number | null;
  created_at?: string;
}

interface EventMatchCandidateRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  age: number | null;
  height: number | null;
  relationship_status: string | null;
  match_intention: User['matchIntention'];
  match_gender_preference: User['genderPreference'];
  gender_identity: string | null;
  sexuality: string | null;
  vibes: string[] | null;
  last_seen: string | null;
  is_online: boolean | null;
  show_initials_only: boolean | null;
  single_mode: boolean | null;
  liked_you: boolean | null;
}

export interface EventMatchRealtimeHandlers {
  onQueueChanged?: () => void;
  onLikesChanged?: () => void;
  onMatchesChanged?: () => void;
}

const DEFAULT_AGE = 25;

class EventMatchService {
  private resolveAvatarUrl(avatarUrl: string | null | undefined): string {
    const normalizedPhoto = normalizeMatchPhoto(avatarUrl);

    if (!hasValidMatchPhoto(normalizedPhoto)) {
      return '';
    }

    if (normalizedPhoto.toLowerCase().startsWith('http')) {
      return normalizedPhoto;
    }

    const { data } = supabase.storage.from('profiles').getPublicUrl(normalizedPhoto);
    return data.publicUrl;
  }

  private mapCandidate(row: EventMatchCandidateRow | Record<string, any>): User {
    return {
      id: String(row.id),
      name: row.full_name || 'Usuario',
      age: row.age ?? DEFAULT_AGE,
      bio: row.bio || '',
      photo: this.resolveAvatarUrl(row.avatar_url),
      vibes: Array.isArray(row.vibes) ? row.vibes : [],
      isSingleMode: Boolean(row.single_mode),
      showInitialsOnly: Boolean(row.show_initials_only),
      matchIntention: row.match_intention ?? null,
      genderPreference: row.match_gender_preference ?? null,
      genderIdentity: row.gender_identity ?? null,
      sexuality: row.sexuality ?? undefined,
      height: row.height ?? null,
      relationshipStatus: row.relationship_status ?? null,
      isOnline: Boolean(row.is_online),
      lastSeen: row.last_seen ?? null,
      likedYou: Boolean(row.liked_you),
    };
  }

  private mapReceivedLike(row: EventReceivedLike | Record<string, any>): EventReceivedLike {
    return {
      like_id: String(row.like_id),
      from_user_id: String(row.from_user_id),
      from_user_name: row.from_user_name || 'Usuario',
      from_user_photo: this.resolveAvatarUrl(row.from_user_photo),
      from_user_bio: row.from_user_bio || null,
      from_user_age: row.from_user_age ?? null,
      created_at: row.created_at ?? undefined,
    };
  }

  async getCandidates(eventId: string, currentUserId: string): Promise<User[]> {
    const { data, error } = await supabase.rpc('get_event_match_candidates_v2', {
      p_event_id: eventId,
    });

    if (!error) {
      const candidates = (data || []).map((row: EventMatchCandidateRow) => this.mapCandidate(row));
      return filterItemsWithRenderableMatchPhoto(candidates, (candidate) => candidate.photo);
    }

    try {
      const legacyCandidates = await eventService.getMatchCandidates(eventId);

      const mappedLegacyCandidates = legacyCandidates
        .filter((candidate: any) => candidate.id !== currentUserId && candidate.match_enabled !== false)
        .map((candidate: any) =>
          this.mapCandidate({
            ...candidate,
            id: candidate.id || candidate.user_id,
            full_name: candidate.full_name || candidate.name,
            avatar_url: candidate.avatar_url || candidate.photo || null,
            age: candidate.age ?? DEFAULT_AGE,
            single_mode: candidate.single_mode || candidate.match_enabled || false,
            show_initials_only: candidate.show_initials_only || false,
            liked_you: candidate.liked_you || false,
          }),
        );

      return filterItemsWithRenderableMatchPhoto(mappedLegacyCandidates, (candidate) => candidate.photo);
    } catch {
      const fallbackCandidates = await likeService.getPotentialMatches(eventId, currentUserId);
      const mappedFallbackCandidates = fallbackCandidates.map((candidate: Record<string, any>) => this.mapCandidate(candidate));
      return filterItemsWithRenderableMatchPhoto(mappedFallbackCandidates, (candidate) => candidate.photo);
    }
  }

  async getReceivedLikes(eventId: string): Promise<EventReceivedLike[]> {
    const { data, error } = await supabase.rpc('get_event_received_likes_v2', {
      p_event_id: eventId,
    });

    if (!error) {
      const likes = (data || []).map((row: EventReceivedLike) => this.mapReceivedLike(row));
      return filterItemsWithRenderableMatchPhoto(likes, (like) => like.from_user_photo);
    }

    const legacyLikes = await likeService.getReceivedLikes(eventId);
    const mappedLegacyLikes = legacyLikes.map((like: Record<string, any>) => this.mapReceivedLike(like));
    return filterItemsWithRenderableMatchPhoto(mappedLegacyLikes, (like) => like.from_user_photo);
  }

  async getEventMatches(eventId: string): Promise<Match[]> {
    return matchService.getEventMatches(eventId);
  }

  async likeUser(eventId: string, targetUserId: string): Promise<LikeResult> {
    return likeService.likeUser(targetUserId, eventId);
  }

  async resetQueue(eventId: string): Promise<number | null> {
    const { data, error } = await supabase.rpc('reset_match_queue', {
      p_event_id: eventId,
    });

    if (!error) {
      return Number(data || 0);
    }

    if (error.code === '42883') {
      return null;
    }

    throw error;
  }

  async skipUser(eventId: string, targetUserId: string): Promise<boolean> {
    const { error } = await supabase.rpc('skip_match_candidate', {
      p_event_id: eventId,
      p_to_user_id: targetUserId,
    });

    if (!error) {
      return true;
    }

    if (error.code === '42883') {
      return false;
    }

    throw error;
  }

  subscribeToEvent(eventId: string, userId: string, handlers: EventMatchRealtimeHandlers) {
    return supabase
      .channel(`event-match:${eventId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as Record<string, any> | null;
          if (!row) return;

          if (row.from_user_id === userId || row.to_user_id === userId) {
            handlers.onLikesChanged?.();
            handlers.onQueueChanged?.();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as Record<string, any> | null;
          if (!row) return;

          if (row.user_a_id === userId || row.user_b_id === userId) {
            handlers.onMatchesChanged?.();
            handlers.onLikesChanged?.();
            handlers.onQueueChanged?.();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_participants',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          handlers.onQueueChanged?.();
          handlers.onLikesChanged?.();
          handlers.onMatchesChanged?.();
        },
      )
      .subscribe();
  }
}

export const eventMatchService = new EventMatchService();
