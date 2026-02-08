import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read: boolean;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface ChatMatch {
  id: string;
  user_id: string;
  matched_user_id: string;
  event_id: string;
  created_at: string;
  last_message?: ChatMessage;
  unread_count: number;
  matched_user?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

class ChatService {
  // Buscar todos os matches do usuário
  async getMatches(userId: string): Promise<ChatMatch[]> {
    console.log('💬 [ChatService] Buscando matches para:', userId);

    // Buscar likes mútuos onde is_match = true
    const { data: likes, error } = await supabase
      .from('user_likes')
      .select(`
        *,
        from_user:from_user_id (
          id,
          full_name,
          avatar_url
        ),
        to_user:to_user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .eq('is_match', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [ChatService] Erro ao buscar matches:', error);
      throw error;
    }

    // Transformar em formato de ChatMatch
    const matches: ChatMatch[] = likes.map(like => {
      const isFromUser = like.from_user_id === userId;
      const matchedUser = isFromUser ? like.to_user : like.from_user;
      
      return {
        id: like.id,
        user_id: userId,
        matched_user_id: isFromUser ? like.to_user_id : like.from_user_id,
        event_id: like.event_id,
        created_at: like.created_at,
        unread_count: 0,
        matched_user: matchedUser
      };
    });

    console.log('✅ [ChatService] Matches encontrados:', matches.length);
    return matches;
  }

  // Buscar mensagens de um match específico
  async getMessages(matchId: string): Promise<ChatMessage[]> {
    console.log('💬 [ChatService] Buscando mensagens do match:', matchId);

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:sender_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ [ChatService] Erro ao buscar mensagens:', error);
      throw error;
    }

    console.log('✅ [ChatService] Mensagens encontradas:', data?.length || 0);
    return data || [];
  }

  // Enviar mensagem
  async sendMessage(matchId: string, message: string): Promise<ChatMessage> {
    console.log('📤 [ChatService] Enviando mensagem:', { matchId, message });

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        match_id: matchId,
        message: message,
        read: false
        // sender_id será preenchido automaticamente pelo trigger
      })
      .select(`
        *,
        sender:sender_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('❌ [ChatService] Erro ao enviar mensagem:', error);
      throw error;
    }

    console.log('✅ [ChatService] Mensagem enviada:', data);
    return data;
  }

  // Marcar mensagens como lidas
  async markAsRead(matchId: string, userId: string): Promise<void> {
    console.log('👁️ [ChatService] Marcando mensagens como lidas:', { matchId, userId });

    const { error } = await supabase
      .from('chat_messages')
      .update({ read: true })
      .eq('match_id', matchId)
      .neq('sender_id', userId)
      .eq('read', false);

    if (error) {
      console.error('❌ [ChatService] Erro ao marcar como lidas:', error);
      throw error;
    }

    console.log('✅ [ChatService] Mensagens marcadas como lidas');
  }

  // Contar mensagens não lidas
  async getUnreadCount(userId: string): Promise<number> {
    console.log('🔔 [ChatService] Contando mensagens não lidas para:', userId);

    // Buscar IDs dos matches do usuário
    const { data: likes, error: likesError } = await supabase
      .from('user_likes')
      .select('id')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .eq('is_match', true);

    if (likesError) {
      console.error('❌ [ChatService] Erro ao buscar matches:', likesError);
      return 0;
    }

    const matchIds = likes.map(like => like.id);

    if (matchIds.length === 0) {
      return 0;
    }

    // Contar mensagens não lidas desses matches
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .in('match_id', matchIds)
      .neq('sender_id', userId)
      .eq('read', false);

    if (error) {
      console.error('❌ [ChatService] Erro ao contar não lidas:', error);
      return 0;
    }

    console.log('✅ [ChatService] Mensagens não lidas:', count);
    return count || 0;
  }

  // Subscribe para novas mensagens em tempo real
  subscribeToMessages(matchId: string, callback: (message: ChatMessage) => void) {
    console.log('🔄 [ChatService] Inscrevendo-se em mensagens do match:', matchId);

    const subscription = supabase
      .channel(`chat:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `match_id=eq.${matchId}`
        },
        async (payload) => {
          console.log('📨 [ChatService] Nova mensagem recebida:', payload);
          
          // Buscar dados completos da mensagem com o perfil do sender
          const { data, error } = await supabase
            .from('chat_messages')
            .select(`
              *,
              sender:sender_id (
                id,
                full_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && data) {
            callback(data);
          }
        }
      )
      .subscribe();

    return subscription;
  }
}

export const chatService = new ChatService();
