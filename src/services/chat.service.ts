import { invokeEdgeRoute } from '@/services/apiClient';

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
    // console.log('🔔 [ChatService] Atualizando presença:', chatId);
    const { error } = await invokeEdgeRoute('chat-api/presence', {
      method: 'POST',
      body: { chatId },
    });
    
    if (error) {
        // console.error('❌ [ChatService] Erro ao atualizar presença:', error);
    }
  }

  // Buscar mensagens de um chat
  async getMessages(chatId: string): Promise<ChatMessage[]> {
    // console.log('💬 [ChatService] Buscando mensagens do chat:', chatId);

    const { data, error } = await invokeEdgeRoute<{ messages: ChatMessage[] }>(`chat-api/messages?chatId=${encodeURIComponent(chatId)}`, {
      method: 'GET',
    });

    if (error) {
      // console.error('❌ [ChatService] Erro ao buscar mensagens:', error);
      throw error;
    }
    
    // Note: We don't mark as delivered here anymore because the backend trigger handles 'seen' 
    // if the user is active. 'Delivered' logic could be added if needed but 'seen' is priority.

    return data?.messages || [];
  }

  async getOrCreateChat(matchId: string): Promise<string> {
    const { data, error } = await invokeEdgeRoute<{ chatId: string }>(`chat-api/match/${matchId}`, {
      method: 'POST',
    });
    if (error) throw error;
    if (!data?.chatId) throw new Error('Falha ao obter chat');
    return data.chatId;
  }

  async unmatchUser(matchId: string) {
    const { error } = await invokeEdgeRoute(`chat-api/match/${matchId}`, {
      method: 'DELETE',
    });

    if (error) {
      // console.error('❌ [ChatService] Erro ao desfazer match:', error);
      throw error;
    }
  }

  // Enviar mensagem
  async sendMessage(chatId: string, content: string): Promise<ChatMessage> {
    // console.log('📤 [ChatService] Enviando mensagem:', chatId);

    const { data, error } = await invokeEdgeRoute<{ message: ChatMessage }>('chat-api/send', {
      method: 'POST',
      body: { chatId, content },
    });

    if (error) {
      // console.error('❌ [ChatService] Erro ao enviar mensagem:', error);
      throw error;
    }

    if (!data?.message) throw new Error('Falha ao enviar mensagem');
    return data.message;
  }

  // Subscribe para novas mensagens e typing em tempo real
  subscribeToChat(
      chatId: string, 
      onMessage: (message: any, eventType: 'INSERT' | 'UPDATE') => void,
      onTyping?: (payload: { isTyping: boolean, userId: string }) => void
  ) {
    const pollIntervalMs = 2000;
    let stopped = false;
    let lastById = new Map<string, ChatMessage>();
    let timer: ReturnType<typeof setInterval> | null = null;

    const hasMeaningfulChange = (prev: ChatMessage, next: ChatMessage) => {
      return (
        prev.content !== next.content ||
        prev.status !== next.status ||
        prev.read_at !== next.read_at ||
        prev.created_at !== next.created_at
      );
    };

    const poll = async () => {
      if (stopped) return;

      try {
        const messages = await this.getMessages(chatId);
        const nextById = new Map<string, ChatMessage>();
        for (const message of messages) {
          nextById.set(message.id, message);
        }

        for (const [id, next] of nextById.entries()) {
          const prev = lastById.get(id);
          if (!prev) {
            onMessage(next, 'INSERT');
            continue;
          }
          if (hasMeaningfulChange(prev, next)) {
            onMessage(next, 'UPDATE');
          }
        }

        lastById = nextById;
      } catch {
      }
    };

    void poll();
    timer = setInterval(poll, pollIntervalMs);

    if (onTyping) {
      void onTyping({ isTyping: false, userId: '' });
    }

    return {
      unsubscribe() {
        stopped = true;
        if (timer) clearInterval(timer);
        timer = null;
      },
      async send() {
        return;
      },
    };
  }
  
  // Obter presença atual de um usuário
  async getPresence(userId: string): Promise<string | null> {
    const { data, error } = await invokeEdgeRoute<{ active_chat_id: string | null }>(`chat-api/presence/${userId}`, {
      method: 'GET',
    });
    
    if (error) {
        // console.warn('⚠️ [ChatService] Could not fetch presence (maybe empty):', error.message);
        return null;
    }
    return data?.active_chat_id || null;
  }

  // Subscribe to partner presence
  subscribeToPartnerPresence(partnerId: string, onPresenceChange: (activeChatId: string | null) => void) {
    const pollIntervalMs = 3000;
    let stopped = false;
    let lastValue: string | null | undefined = undefined;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (stopped) return;
      try {
        const activeChatId = await this.getPresence(partnerId);
        if (lastValue === undefined || activeChatId !== lastValue) {
          lastValue = activeChatId;
          onPresenceChange(activeChatId);
        }
      } catch {
      }
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

  async sendTyping(channel: any, isTyping: boolean) {
      void channel;
      void isTyping;
      return;
  }

  async markMessagesAsRead(chatId: string): Promise<void> {
    const { error } = await invokeEdgeRoute('chat-api/read', {
      method: 'POST',
      body: { chatId },
    });

    if (error) {
      // console.error('Error marking messages as read:', error);
      // throw error; // Don't block UI
    }
  }
}

export const chatService = new ChatService();



