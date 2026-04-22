import { User } from '@/lib';
import { supabase } from '@/lib/supabase';
import { eventService } from '@/services/event.service';
import { likeService, type LikeResult } from '@/services/like.service';
import { matchService, type Match } from '@/services/match.service';
import { invokeEdgeRoute } from '@/services/apiClient';
import {
  filterItemsWithRenderableMatchPhoto,
  hasValidMatchPhoto,
  normalizeMatchPhoto,
} from '@/utils/matchPhoto';
import { matchesGenderPreference, type MatchGenderPreference } from '@/utils/matchPreference';

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

interface EventMatchOptInResult {
  status?: 'ok' | 'error';
  match_enabled?: boolean;
  removed_likes?: number;
  removed_passes?: number;
  message?: string;
}

const DEFAULT_AGE = 25;

class EventMatchService {
  private async getViewerGenderPreference(_userId: string): Promise<MatchGenderPreference> {
    const { data, error } = await invokeEdgeRoute<{ match_gender_preference: MatchGenderPreference }>('profile-api/me/match-gender-preference', {
      method: 'GET',
    });

    if (error) throw error;
    return (data?.match_gender_preference ?? null) as MatchGenderPreference;
  }

  private filterCandidatesByPreference(candidates: User[], preference: MatchGenderPreference): User[] {
    return candidates.filter((candidate) => matchesGenderPreference(preference, candidate.genderIdentity));
  }

  private resolveAvatarUrl(avatarUrl: string | null | undefined): string {
    const normalizedPhoto = normalizeMatchPhoto(avatarUrl);

    if (!hasValidMatchPhoto(normalizedPhoto)) {
      return '';
    }

    if (normalizedPhoto.toLowerCase().startsWith('http')) {
      return normalizedPhoto;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(normalizedPhoto);
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
    const viewerPreference = await this.getViewerGenderPreference(currentUserId);
    const { data, error } = await invokeEdgeRoute<{ candidates: EventMatchCandidateRow[] }>(`match-api/candidates?eventId=${encodeURIComponent(eventId)}`, {
      method: 'GET',
    });

    if (!error) {
      const candidates = (data?.candidates || []).map((row: EventMatchCandidateRow) => this.mapCandidate(row));
      return filterItemsWithRenderableMatchPhoto(
        this.filterCandidatesByPreference(candidates, viewerPreference),
        (candidate) => candidate.photo,
      );
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

      return filterItemsWithRenderableMatchPhoto(
        this.filterCandidatesByPreference(mappedLegacyCandidates, viewerPreference),
        (candidate) => candidate.photo,
      );
    } catch {
      const fallbackCandidates = await likeService.getPotentialMatches(eventId, currentUserId);
      const mappedFallbackCandidates = fallbackCandidates.map((candidate: Record<string, any>) => this.mapCandidate(candidate));
      return filterItemsWithRenderableMatchPhoto(
        this.filterCandidatesByPreference(mappedFallbackCandidates, viewerPreference),
        (candidate) => candidate.photo,
      );
    }
  }

  async getReceivedLikes(eventId: string): Promise<EventReceivedLike[]> {
    const { data, error } = await invokeEdgeRoute<{ likes: EventReceivedLike[] }>(`match-api/event-likes?eventId=${encodeURIComponent(eventId)}`, {
      method: 'GET',
    });

    if (!error) {
      const likes = (data?.likes || []).map((row: EventReceivedLike) => this.mapReceivedLike(row));
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

  async setMatchOptIn(eventId: string, enabled: boolean): Promise<EventMatchOptInResult> {
    const { data, error } = await invokeEdgeRoute<{ result: EventMatchOptInResult }>('match-api/opt-in', {
      method: 'POST',
      body: { eventId, enabled },
    });

    if (error) throw error;

    const result = (data?.result || {}) as EventMatchOptInResult;

    if (result.status === 'error') {
      throw new Error(result.message || 'Nao foi possivel atualizar o Match deste evento');
    }

    return result;
  }

  async resetQueue(eventId: string): Promise<number | null> {
    const { data, error } = await invokeEdgeRoute<{ value: number | null }>('match-api/reset-queue', {
      method: 'POST',
      body: { eventId },
    });

    if (error) throw error;
    return data?.value ?? null;
  }

  async skipUser(eventId: string, targetUserId: string): Promise<boolean> {
    const { data, error } = await invokeEdgeRoute<{ ok: boolean }>('match-api/skip', {
      method: 'POST',
      body: { eventId, toUserId: targetUserId },
    });

    if (error) throw error;
    return Boolean(data?.ok);
  }

  async ignoreLike(eventId: string, likeId: string, targetUserId: string): Promise<void> {
    await likeService.ignoreLike(likeId, eventId);

    try {
      await this.skipUser(eventId, targetUserId);
    } catch {
      // Ignore queue persistence failures after the like has already been hidden for this event.
    }
  }

  subscribeToEvent(eventId: string, userId: string, handlers: EventMatchRealtimeHandlers) {
    const pollIntervalMs = 5000;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (stopped) return;
      void eventId;
      void userId;
      handlers.onQueueChanged?.();
      handlers.onLikesChanged?.();
      handlers.onMatchesChanged?.();
    };

    void poll();
    timer = setInterval(poll, pollIntervalMs);

    return {
      unsubscribe() {
        stopped = true;
        if (timer) clearInterval(timer);
        timer = null;
      },
    };
  }
}

export const eventMatchService = new EventMatchService();
