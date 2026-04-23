import { supabase } from '@/lib/supabase';
import { invokeEdgeRoute } from '@/services/apiClient';

export interface Notification {
  id: string;
  type: 'like' | 'match' | 'system';
  event_id: string;
  reference_id: string | null;
  payload: any;
  read_at: string | null;
  created_at: string;
}

interface NotificationSubscription {
  unsubscribe: () => void;
}

export const notificationService = {
  async listNotifications(): Promise<Notification[]> {
    const { data, error } = await invokeEdgeRoute<{ notifications: Notification[] }>('match-api/notifications', {
      method: 'GET',
    });

    if (error) throw error;
    return data?.notifications || [];
  },

  async getUnread(_userId: string): Promise<Notification[]> {
    return this.listNotifications();
  },

  async dismissNotification(id: string) {
    const { error } = await invokeEdgeRoute(`match-api/notifications/${id}`, {
      method: 'DELETE',
    });

    if (error) throw error;
  },

  async markAsRead(id: string) {
    await this.dismissNotification(id);
  },
  
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    void userId;
    const channel = supabase
      .channel(`notifications:insert:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      );

    void channel.subscribe();

    return {
      unsubscribe() {
        void channel.unsubscribe();
      },
    };
  },

  subscribeToNotificationFeed(userId: string, onChange: () => void): NotificationSubscription {
    void userId;
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
      .channel(`notifications:feed:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
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
};


