import { supabase } from '@/lib/supabase';

export interface UserLike {
  id: string;
  from_user_id: string;
  to_user_id: string;
  event_id: string;
  created_at: string;
  is_match: boolean;
  from_user?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

class LikeService {
  // Dar like em um usuário
  async likeUser(toUserId: string, eventId: string): Promise<UserLike> {
    console.log('👍 [LikeService] Dando like:', { toUserId, eventId });
    
    const { data, error } = await supabase
      .from('user_likes')
      .insert({
        to_user_id: toUserId,
        event_id: eventId,
        // from_user_id será preenchido automaticamente pelo trigger
      })
      .select(`
        *,
        from_user:from_user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('❌ [LikeService] Erro ao dar like:', error);
      throw error;
    }

    console.log('✅ [LikeService] Like registrado:', data);
    return data;
  }

  // Buscar likes recebidos
  async getReceivedLikes(userId: string): Promise<UserLike[]> {
    console.log('🔍 [LikeService] Buscando likes recebidos para:', userId);
    
    const { data, error } = await supabase
      .from('user_likes')
      .select(`
        *,
        from_user:from_user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [LikeService] Erro ao buscar likes:', error);
      throw error;
    }

    console.log('✅ [LikeService] Likes recebidos:', data?.length || 0);
    return data || [];
  }

  // Buscar likes não lidos
  async getUnreadLikes(userId: string): Promise<UserLike[]> {
    const { data, error } = await supabase
      .from('user_likes')
      .select(`
        *,
        from_user:from_user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('to_user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [LikeService] Erro ao buscar likes não lidos:', error);
      throw error;
    }

    return data || [];
  }

  // Marcar like como lido
  async markAsRead(likeId: string): Promise<void> {
    const { error } = await supabase
      .from('user_likes')
      .update({ read: true })
      .eq('id', likeId);

    if (error) throw error;
  }

  // Marcar todos os likes como lidos
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_likes')
      .update({ read: true })
      .eq('to_user_id', userId)
      .eq('read', false);

    if (error) throw error;
  }

  // Buscar matches (likes mútuos)
  async getMatches(userId: string): Promise<UserLike[]> {
    console.log('💕 [LikeService] Buscando matches para:', userId);
    
    const { data, error } = await supabase
      .from('user_likes')
      .select(`
        *,
        from_user:from_user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('to_user_id', userId)
      .eq('is_match', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [LikeService] Erro ao buscar matches:', error);
      throw error;
    }

    console.log('✅ [LikeService] Matches encontrados:', data?.length || 0);
    return data || [];
  }

  // Verificar se já deu like
  async hasLiked(fromUserId: string, toUserId: string, eventId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_likes')
      .select('id')
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .eq('event_id', eventId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado
      console.error('❌ [LikeService] Erro ao verificar like:', error);
      throw error;
    }

    return !!data;
  }

  // Verificar se há match
  async isMatch(userId1: string, userId2: string, eventId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_likes')
      .select('is_match')
      .or(`and(from_user_id.eq.${userId1},to_user_id.eq.${userId2}),and(from_user_id.eq.${userId2},to_user_id.eq.${userId1})`)
      .eq('event_id', eventId)
      .eq('is_match', true)
      .limit(1);

    if (error) {
      console.error('❌ [LikeService] Erro ao verificar match:', error);
      throw error;
    }

    return (data?.length || 0) > 0;
  }

  // Buscar usuários para dar match (fila)
  async getPotentialMatches(eventId: string, currentUserId: string): Promise<any[]> {
    console.log('🔍 [LikeService] Buscando candidatos para match:', { eventId, currentUserId });
    
    try {
      // 1. Buscar IDs já avaliados (likes ou skips)
      const { data: evaluatedData, error: evaluatedError } = await supabase
          .from('user_likes')
          .select('to_user_id')
          .eq('from_user_id', currentUserId)
          .eq('event_id', eventId);
          
      if (evaluatedError) throw evaluatedError;
      
      const evaluatedIds = (evaluatedData || []).map(l => l.to_user_id);
      evaluatedIds.push(currentUserId); // Excluir o próprio usuário

      // 2. Buscar participantes elegíveis
      // Precisamos fazer query na tabela de participantes e join com profiles
      // Como o filtro 'not in' pode ser complexo com array vazio, vamos buscar e filtrar
      
      const { data, error } = await supabase
        .from('event_participants')
        .select(`
          user:profiles!event_participants_user_id_fkey (
            id,
            full_name,
            avatar_url,
            bio,
            birth_date,
            single_mode,
            show_initials_only,
            match_intention,
            match_gender_preference,
            sexuality,
            vibes
          )
        `)
        .eq('event_id', eventId)
        .neq('status', 'canceled'); // Ignorar cancelados

      if (error) throw error;

      // 3. Filtrar resultados no cliente (mais seguro e flexível para regras complexas)
      const candidates = (data || [])
        .map((item: any) => item.user)
        .filter((user: any) => {
          if (!user) return false;
          if (!user.single_mode) return false; // Deve estar no modo single
          if (evaluatedIds.includes(user.id)) return false; // Não pode ter sido avaliado
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
