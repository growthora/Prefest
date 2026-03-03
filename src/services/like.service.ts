import { supabase } from '@/lib/supabase';

export interface LikeResult {
  status: 'liked' | 'match' | 'already_liked' | 'error';
  match_id?: string;
  chat_id?: string;
  message?: string;
}

class LikeService {
  // Dar like em um usuário via RPC
  async likeUser(toUserId: string, eventId: string): Promise<LikeResult> {
    
    const { data, error } = await supabase.rpc('like_user', {
      p_event_id: eventId,
      p_to_user_id: toUserId
    });

    if (error) {
      // Handle duplicate like gracefully if it's a unique constraint violation
      if (error.code === '23505') {
        return { status: 'already_liked' };
      }
      
      throw error;
    }

    return data as LikeResult;
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
      // Busca os últimos 20 likes recebidos pelo usuário
      // Ordenados por data de criação (mais recentes primeiro)
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
      
      const mapped = (data || []).map(like => ({
        ...like,
        is_match: like.status === 'matched'
      }));

      const readIds = this.getReadLikeIds();
      return mapped.filter(like => !readIds.includes(like.id));
    } catch (error) {
      return [];
    }
  }

  // Buscar usuários para dar match (fila)
  async getPotentialMatches(eventId: string, currentUserId: string): Promise<any[]> {
    
    try {
      // 1. Buscar IDs já avaliados (likes)
      const { data: evaluatedData, error: evaluatedError } = await supabase
          .from('likes')
          .select('to_user_id')
          .eq('from_user_id', currentUserId)
          .eq('event_id', eventId);
          
      if (evaluatedError) throw evaluatedError;
      
      const evaluatedIds = (evaluatedData || []).map(l => l.to_user_id);
      evaluatedIds.push(currentUserId); // Excluir o próprio usuário

      // 2. Buscar participantes elegíveis
      // Precisamos fazer query na tabela de participantes e join com profiles
      
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
            match_intention,
            match_gender_preference
          )
        `)
        .eq('event_id', eventId)
        .neq('status', 'canceled'); // Ignorar cancelados

      if (error) throw error;

      // 3. Filtrar resultados no cliente
      const candidates = (data || [])
        .map((item: any) => item.user)
        .filter((user: any) => {
          if (!user) return false;
          
          const isEvaluated = evaluatedIds.includes(user.id);
          const isMatchEnabled = user.match_enabled;
          const isProfileViewAllowed = user.allow_profile_view;

          if (isEvaluated) {
             return false;
          }
          if (!isMatchEnabled) {
             return false;
          }
          if (!isProfileViewAllowed) {
             return false;
          }

          return true;
        });

      return candidates;
    } catch (error) {
      throw error;
    }
  }
}

export const likeService = new LikeService();
