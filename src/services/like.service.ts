import { logMatchDebug } from '@/utils/matchDebug';
import { hasValidMatchPhoto } from '@/utils/matchPhoto';
import { invokeEdgeRoute } from '@/services/apiClient';

export interface LikeResult {
  status: 'liked' | 'match' | 'already_liked' | 'error';
  like_id?: string;
  match_id?: string;
  chat_id?: string;
  is_new_match?: boolean;
  match_reactivated?: boolean;
  message?: string;
}

class LikeService {
  async likeUser(toUserId: string, eventId: string): Promise<LikeResult> {
    logMatchDebug('LIKE ENVIADO', {
      eventId,
      toUserId,
    });

    const { data, error } = await invokeEdgeRoute<LikeResult>('match-api/like', {
      method: 'POST',
      body: { eventId, toUserId },
    });

    if (error) {
      logMatchDebug('LIKE ERRO', {
        eventId,
        toUserId,
        message: error.message,
      });
      throw error;
    }

    const result = (data || { status: 'error' }) as LikeResult;

    logMatchDebug('LIKE RESULTADO', {
      eventId,
      toUserId,
      status: result?.status,
      matchId: result?.match_id,
      reciprocalLike: result?.status === 'match',
      reactivated: result?.match_reactivated ?? false,
    });

    if (result.status === 'error') {
      throw new Error(result.message || 'Nao foi possivel processar essa curtida');
    }

    return result;
  }

  async getLikesSummary(): Promise<{ total_likes: number; recent_likes: any[] }> {
    const { data, error } = await invokeEdgeRoute<{ total_likes: number; recent_likes: any[] }>('match-api/likes/summary', {
      method: 'GET',
    });

    if (error) throw error;
    return data || { total_likes: 0, recent_likes: [] };
  }

  async getReceivedLikes(eventId: string): Promise<any[]> {
    const { data, error } = await invokeEdgeRoute<{ likes: any[] }>(`match-api/likes/received?eventId=${encodeURIComponent(eventId)}`, {
      method: 'GET',
    });

    if (error) throw error;
    return data?.likes || [];
  }

  private getReadLikeIds(): string[] {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem('prefest_read_likes');
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveReadLikeIds(ids: string[]): void {
    if (typeof window === 'undefined') return;
    const uniqueIds = Array.from(new Set(ids));
    window.localStorage.setItem('prefest_read_likes', JSON.stringify(uniqueIds));
  }

  async markAsRead(likeId: string): Promise<void> {
    const current = this.getReadLikeIds();
    if (current.includes(likeId)) return;
    this.saveReadLikeIds([...current, likeId]);
  }

  async ignoreLike(likeId: string, eventId?: string): Promise<void> {
    const { error } = await invokeEdgeRoute('match-api/dislike', {
      method: 'POST',
      body: { likeId, eventId },
    });

    if (error) throw error;
  }

  async getUnreadLikes(_userId: string, eventId?: string): Promise<any[]> {
    try {
      const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
      const { data, error } = await invokeEdgeRoute<{ likes: any[] }>(`match-api/likes/unread${query}`, {
        method: 'GET',
      });

      if (error) throw error;

      const mapped = (data?.likes || []).map((like) => ({
        ...like,
        is_match: like.status === 'matched',
      }));

      const readIds = this.getReadLikeIds();
      return mapped.filter((like) => !readIds.includes(like.id));
    } catch {
      return [];
    }
  }

  async getPotentialMatches(eventId: string, currentUserId: string): Promise<any[]> {
    void currentUserId;
    const { data, error } = await invokeEdgeRoute<{ candidates: any[] }>(`match-api/potential?eventId=${encodeURIComponent(eventId)}`, {
      method: 'GET',
    });

    if (error) throw error;

    return (data?.candidates || []).filter((user: any) => {
      if (!user) return false;

      const isMatchEnabled = user.event_match_enabled;
      const isProfileViewAllowed = user.allow_profile_view;
      const hasProfilePhoto = hasValidMatchPhoto(user.avatar_url);

      if (!isMatchEnabled) return false;
      if (!isProfileViewAllowed) return false;
      if (!hasProfilePhoto) return false;

      return true;
    });
  }
}

export const likeService = new LikeService();
