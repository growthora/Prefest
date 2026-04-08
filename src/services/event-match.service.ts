import { User } from '@/lib';
import { supabase } from '@/lib/supabase';
import { eventService } from '@/services/event.service';
import { likeService, type LikeResult } from '@/services/like.service';
import { matchService, type Match } from '@/services/match.service';

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

const DEFAULT_AGE = 25;

class EventMatchService {
  private resolveAvatarUrl(avatarUrl: string | null | undefined, fallbackName: string, seed: string): string {
    if (!avatarUrl || avatarUrl === 'undefined' || avatarUrl === 'null') {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || 'User')}&background=random`;
    }

    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }

    const { data } = supabase.storage.from('profiles').getPublicUrl(avatarUrl);
    return data.publicUrl;
  }

  private mapCandidate(row: EventMatchCandidateRow | Record<string, any>): User {
    const id = String(row.id);
    const name = row.full_name || 'Usuário';

    return {
      id,
      name,
      age: row.age ?? DEFAULT_AGE,
      bio: row.bio || '',
      photo: this.resolveAvatarUrl(row.avatar_url, name, id),
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

  async getCandidates(eventId: string, currentUserId: string): Promise<User[]> {
    const { data, error } = await supabase.rpc('get_event_match_candidates_v2', {
      p_event_id: eventId,
    });

    if (!error) {
      return (data || []).map((row: EventMatchCandidateRow) => this.mapCandidate(row));
    }

    try {
      const legacyCandidates = await eventService.getMatchCandidates(eventId);

      return legacyCandidates
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
          })
        );
    } catch {
      const fallbackCandidates = await likeService.getPotentialMatches(eventId, currentUserId);
      return fallbackCandidates.map((candidate: Record<string, any>) => this.mapCandidate(candidate));
    }
  }

  async getReceivedLikes(eventId: string): Promise<EventReceivedLike[]> {
    const { data, error } = await supabase.rpc('get_event_received_likes_v2', {
      p_event_id: eventId,
    });

    if (!error) {
      return (data || []) as EventReceivedLike[];
    }

    return likeService.getReceivedLikes(eventId);
  }

  async getEventMatches(eventId: string): Promise<Match[]> {
    return matchService.getEventMatches(eventId);
  }

  async likeUser(eventId: string, targetUserId: string): Promise<LikeResult> {
    return likeService.likeUser(targetUserId, eventId);
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

  subscribeToEvent(eventId: string, userId: string, onChange: () => void) {
    const scheduleRefresh = () => onChange();

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
            scheduleRefresh();
          }
        }
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
            scheduleRefresh();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_participants',
          filter: `event_id=eq.${eventId}`,
        },
        scheduleRefresh
      )
      .subscribe();
  }
}

export const eventMatchService = new EventMatchService();
