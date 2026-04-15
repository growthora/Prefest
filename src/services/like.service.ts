import { supabase } from '@/lib/supabase';
import { logMatchDebug } from '@/utils/matchDebug';
import { hasValidMatchPhoto } from '@/utils/matchPhoto';

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

    const { data, error } = await supabase.rpc('like_user', {
      p_event_id: eventId,
      p_to_user_id: toUserId,
    });

    if (error) {
      logMatchDebug('LIKE ERRO', {
        eventId,
        toUserId,
        code: error.code,
        message: error.message,
      });

      if (error.code === '23505') {
        return { status: 'already_liked' };
      }

      throw error;
    }

    const result = data as LikeResult;

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
    const { data, error } = await supabase.rpc('list_likes_summary');
    if (error) throw error;
    return data;
  }

  async getReceivedLikes(eventId: string): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_received_likes', { p_event_id: eventId });
    if (error) throw error;
    return data || [];
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

  async ignoreLike(likeId: string): Promise<void> {
    const { error } = await supabase.rpc('ignore_like', { p_like_id: likeId });
    if (error) throw error;
  }

  async getUnreadLikes(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select(`
          id,
          created_at,
          event_id,
          from_user_id,
          status,
          from_user:profiles!likes_from_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const mapped = (data || []).map((like) => ({
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
    const { data: evaluatedData, error: evaluatedError } = await supabase
      .from('likes')
      .select('to_user_id')
      .eq('from_user_id', currentUserId)
      .eq('event_id', eventId);

    if (evaluatedError) throw evaluatedError;

    const evaluatedIds = (evaluatedData || []).map((like) => like.to_user_id);
    evaluatedIds.push(currentUserId);

    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        user:profiles!event_participants_user_id_fkey (
          id,
          full_name,
          avatar_url,
          bio,
          birth_date,
          match_enabled,
          allow_profile_view,
          gender_identity,
          match_intention,
          match_gender_preference,
          sexuality,
          height,
          relationship_status
        )
      `)
      .eq('event_id', eventId)
      .neq('status', 'canceled');

    if (error) throw error;

    return (data || [])
      .map((item: any) => item.user)
      .filter((user: any) => {
        if (!user) return false;

        const isEvaluated = evaluatedIds.includes(user.id);
        const isMatchEnabled = user.match_enabled;
        const isProfileViewAllowed = user.allow_profile_view;
        const hasProfilePhoto = hasValidMatchPhoto(user.avatar_url);

        if (isEvaluated) return false;
        if (!isMatchEnabled) return false;
        if (!isProfileViewAllowed) return false;
        if (!hasProfilePhoto) return false;

        return true;
      });
  }
}

export const likeService = new LikeService();
