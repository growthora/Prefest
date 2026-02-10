import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

class ChatService {
  // Buscar mensagens de um chat
  async getMessages(chatId: string): Promise<ChatMessage[]> {
    console.log('💬 [ChatService] Buscando mensagens do chat:', chatId);

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ [ChatService] Erro ao buscar mensagens:', error);
      throw error;
    }

    return data || [];
  }

  async getOrCreateChat(matchId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_chat', { p_match_id: matchId });
    if (error) throw error;
    return data;
  }

  // Enviar mensagem
  async sendMessage(chatId: string, content: string): Promise<ChatMessage> {
    console.log('📤 [ChatService] Enviando mensagem:', chatId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content: content
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

    return data;
  }

  // Subscribe para novas mensagens em tempo real
  subscribeToMessages(chatId: string, callback: (message: ChatMessage) => void) {
    console.log('🔄 [ChatService] Inscrevendo-se em mensagens do chat:', chatId);

    const subscription = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
          console.log('📨 [ChatService] Nova mensagem recebida:', payload);
          
          // Buscar dados completos da mensagem com o perfil do sender
          const { data } = await supabase
            .from('messages')
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

          if (data) {
            callback(data as ChatMessage);
          }
        }
      )
      .subscribe();

    return subscription;
  }
}

export const chatService = new ChatService();
