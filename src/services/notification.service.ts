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
    const pollIntervalMs = 4000;
    let stopped = false;
    let knownIds = new Set<string>();
    let hydratedInitial = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (stopped) return;
      try {
        const notifications = await this.listNotifications();
        const ids = new Set<string>();
        for (const notification of notifications) {
          ids.add(notification.id);
          if (hydratedInitial && !knownIds.has(notification.id)) {
            callback(notification);
          }
        }
        knownIds = ids;
        hydratedInitial = true;
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
};


