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
    console.log('👍 [LikeService] Dando like:', { toUserId, eventId });
    
    const { data, error } = await supabase.rpc('like_user', {
      p_event_id: eventId,
      p_to_user_id: toUserId
    });

    if (error) {
      // Handle duplicate like gracefully if it's a unique constraint violation
      if (error.code === '23505') {
        console.log('⚠️ [LikeService] Usuário já curtido (catch via code 23505)');
        return { status: 'already_liked' };
      }
      
      console.error('❌ [LikeService] Erro ao dar like:', error);
      throw error;
    }

    console.log('✅ [LikeService] Resultado:', data);
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

  async ignoreLike(likeId: string): Promise<void> {
    const { error } = await supabase.rpc('ignore_like', { p_like_id: likeId });
    if (error) throw error;
  }

  // Buscar usuários para dar match (fila)
  async getPotentialMatches(eventId: string, currentUserId: string) {
    console.log('🔍 [LikeService] Buscando candidatos para match:', { eventId, currentUserId });
    
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
          
          // Logs detalhados para debug
          const isEvaluated = evaluatedIds.includes(user.id);
          const isMatchEnabled = user.match_enabled;
          const isProfileViewAllowed = user.allow_profile_view;

          if (isEvaluated) {
             console.log(`🚫 [LikeService] Usuário ${user.full_name} filtrado: Já avaliado`);
             return false;
          }
          if (!isMatchEnabled) {
             console.log(`🚫 [LikeService] Usuário ${user.full_name} filtrado: Match desabilitado`);
             return false;
          }
          if (!isProfileViewAllowed) {
             console.log(`🚫 [LikeService] Usuário ${user.full_name} filtrado: Visualização privada`);
             return false;
          }

          return true;
        });

      console.log(`✅ [LikeService] ${candidates.length} candidatos encontrados`);
      return candidates;
    } catch (error) {
      console.error('❌ [LikeService] Erro ao buscar candidatos:', error);
      throw error;
    }
  }
}

export const likeService = new LikeService();
