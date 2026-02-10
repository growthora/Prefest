import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string;
  status: 'sent' | 'delivered' | 'seen';
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

class ChatService {
  // Atualiza a presença do usuário atual (qual chat está aberto)
  async updatePresence(chatId: string | null) {
    console.log('🔔 [ChatService] Atualizando presença:', chatId);
    const { error } = await supabase.rpc('update_presence', {
        p_chat_id: chatId
    });
    
    if (error) {
        console.error('❌ [ChatService] Erro ao atualizar presença:', error);
    }
  }

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
    
    // Note: We don't mark as delivered here anymore because the backend trigger handles 'seen' 
    // if the user is active. 'Delivered' logic could be added if needed but 'seen' is priority.

    return data || [];
  }

  async getOrCreateChat(matchId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_chat', { p_match_id: matchId });
    if (error) throw error;
    return data;
  }

  // Enviar mensagem
  async sendMessage(chatId: string, content: string): Promise<ChatMessage> {
    // console.log('📤 [ChatService] Enviando mensagem:', chatId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content: content,
        status: 'sent' // Initial status, trigger might update to 'seen' immediately
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

  // Subscribe para novas mensagens e typing em tempo real
  subscribeToChat(
      chatId: string, 
      onMessage: (message: any, eventType: 'INSERT' | 'UPDATE') => void,
      onTyping?: (payload: { isTyping: boolean, userId: string }) => void
  ) {
    console.log('🔄 [ChatService] Inscrevendo-se no chat:', chatId);

    const channel = supabase.channel(`chat:${chatId}`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT and UPDATE
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
           console.log('📨 [ChatService] Evento realtime recebido:', payload.eventType, payload.new);
           if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
               onMessage(payload.new, payload.eventType);
           }
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
          if (onTyping) onTyping(payload.payload);
      })
      .subscribe((status) => {
          console.log(`📡 [ChatService] Status da conexão realtime para chat ${chatId}:`, status);
      });

    return channel;
  }
  
  // Obter presença atual de um usuário
  async getPresence(userId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('user_presence')
        .select('active_chat_id')
        .eq('user_id', userId)
        .single();
    
    if (error) {
        // console.warn('⚠️ [ChatService] Could not fetch presence (maybe empty):', error.message);
        return null;
    }
    return data?.active_chat_id || null;
  }

  // Subscribe to partner presence
  subscribeToPartnerPresence(partnerId: string, onPresenceChange: (activeChatId: string | null) => void) {
        console.log(`🔌 [ChatService] Subscribing to presence for partner: ${partnerId}`);
        const channel = supabase.channel(`presence:${partnerId}`);
        
        channel
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'user_presence',
                    filter: `user_id=eq.${partnerId}`
                },
                (payload) => {
                    console.log('🟢 [ChatService] Presence UPDATE received:', payload.new);
                    onPresenceChange(payload.new.active_chat_id);
                }
            )
            .subscribe((status) => {
                console.log(`🔌 [ChatService] Presence channel status for ${partnerId}:`, status);
            });
            
        return channel;
    }

  async sendTyping(channel: any, isTyping: boolean) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { isTyping, userId: user.id }
      });
  }

  async markMessagesAsRead(chatId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // We only update if status is NOT seen yet.
    // The trigger handles new messages, but for existing unread messages when opening chat:
    const { error } = await supabase
      .from('messages')
      .update({ 
          read_at: new Date().toISOString(),
          status: 'seen'
      })
      .eq('chat_id', chatId)
      .neq('sender_id', user.id)
      .neq('status', 'seen'); // Optimization

    if (error) {
      console.error('Error marking messages as read:', error);
      // throw error; // Don't block UI
    }
  }
}

export const chatService = new ChatService();
