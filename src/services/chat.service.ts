import { supabase } from '@/lib/supabase';
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

interface TypingPayload {
  isTyping: boolean;
  userId: string;
}

interface RealtimeMessageRow {
  id?: string;
  chat_id?: string;
  sender_id?: string;
  content?: string;
  created_at?: string;
  read_at?: string | null;
  status?: 'sent' | 'delivered' | 'seen' | null;
}

interface ChatSubscription {
  unsubscribe: () => void;
  sendTyping?: (isTyping: boolean) => Promise<void>;
}

interface MatchListSubscription {
  unsubscribe: () => void;
}

class ChatService {
  private createChannelName(prefix: string, id: string) {
    return `${prefix}:${id}:${Math.random().toString(36).slice(2, 10)}`;
  }

  private normalizeRealtimeMessage(row: RealtimeMessageRow): ChatMessage {
    return {
      id: String(row.id || ''),
      chat_id: String(row.chat_id || ''),
      sender_id: String(row.sender_id || ''),
      content: String(row.content || ''),
      created_at: String(row.created_at || new Date().toISOString()),
      read_at: row.read_at ?? undefined,
      status: row.status === 'seen' || row.status === 'delivered' ? row.status : 'sent',
    };
  }

  async updatePresence(chatId: string | null) {
    const { error } = await invokeEdgeRoute('chat-api/presence', {
      method: 'POST',
      body: { chatId },
    });

    if (error) {
      void error;
    }
  }

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    const { data, error } = await invokeEdgeRoute<{ messages: ChatMessage[] }>(
      `chat-api/messages?chatId=${encodeURIComponent(chatId)}`,
      {
        method: 'GET',
      }
    );

    if (error) {
      throw error;
    }

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
      throw error;
    }
  }

  async sendMessage(chatId: string, content: string): Promise<ChatMessage> {
    const { data, error } = await invokeEdgeRoute<{ message: ChatMessage }>('chat-api/send', {
      method: 'POST',
      body: { chatId, content },
    });

    if (error) {
      throw error;
    }

    if (!data?.message) throw new Error('Falha ao enviar mensagem');
    return data.message;
  }

  subscribeToChat(
    chatId: string,
    onMessage: (message: ChatMessage, eventType: 'INSERT' | 'UPDATE') => void,
    onTyping?: (payload: TypingPayload) => void
  ): ChatSubscription {
    const channel = supabase
      .channel(this.createChannelName('chat', chatId))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          onMessage(this.normalizeRealtimeMessage(payload.new as RealtimeMessageRow), 'INSERT');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          onMessage(this.normalizeRealtimeMessage(payload.new as RealtimeMessageRow), 'UPDATE');
        }
      );

    if (onTyping) {
      channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
        const typingPayload = payload as Partial<TypingPayload>;
        onTyping({
          isTyping: Boolean(typingPayload.isTyping),
          userId: String(typingPayload.userId || ''),
        });
      });
      void onTyping({ isTyping: false, userId: '' });
    }

    void channel.subscribe();

    return {
      unsubscribe() {
        void channel.unsubscribe();
      },
      async sendTyping(isTyping: boolean) {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;

        await channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            isTyping,
            userId,
          } satisfies TypingPayload,
        });
      },
    };
  }

  async getPresence(userId: string): Promise<string | null> {
    const { data, error } = await invokeEdgeRoute<{ active_chat_id: string | null }>(`chat-api/presence/${userId}`, {
      method: 'GET',
    });

    if (error) {
      return null;
    }
    return data?.active_chat_id || null;
  }

  subscribeToPartnerPresence(partnerId: string, onPresenceChange: (activeChatId: string | null) => void) {
    const channel = supabase
      .channel(this.createChannelName('presence', partnerId))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${partnerId}`,
        },
        (payload) => {
          const nextRow = (payload.new || payload.old || {}) as { active_chat_id?: string | null };
          onPresenceChange(nextRow.active_chat_id ?? null);
        }
      );

    void channel.subscribe();

    return {
      unsubscribe() {
        void channel.unsubscribe();
      },
    };
  }

  subscribeToMatchStatus(matchId: string, onInactive: () => void) {
    const channel = supabase
      .channel(this.createChannelName('match-status', matchId))
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const nextRow = payload.new as { status?: string | null };
          if (nextRow?.status === 'inactive') {
            onInactive();
          }
        }
      );

    void channel.subscribe();

    return {
      unsubscribe() {
        void channel.unsubscribe();
      },
    };
  }

  subscribeToMatchList(onChange: () => void): MatchListSubscription {
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    let isUnsubscribed = false;

    const scheduleRefresh = () => {
      if (isUnsubscribed) return;
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        refreshTimeout = null;
        if (!isUnsubscribed) {
          onChange();
        }
      }, 150);
    };

    const channel = supabase
      .channel(this.createChannelName('chat-list', 'global'))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
        },
        scheduleRefresh
      );

    void channel.subscribe();

    return {
      unsubscribe() {
        isUnsubscribed = true;
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        void channel.unsubscribe();
      },
    };
  }

  async sendTyping(channel: ChatSubscription | null | undefined, isTyping: boolean) {
    if (channel && typeof channel.sendTyping === 'function') {
      await channel.sendTyping(isTyping);
    }
  }

  async markMessagesAsRead(chatId: string): Promise<void> {
    const { error } = await invokeEdgeRoute('chat-api/read', {
      method: 'POST',
      body: { chatId },
    });

    if (error) {
      void error;
    }
  }
}

export const chatService = new ChatService();
