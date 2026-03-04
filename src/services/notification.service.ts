import { supabase } from '@/lib/supabase';

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
    const { data, error } = await supabase.rpc('list_notifications');

    if (error) {
      // console.error('âŒ [NotificationService] Erro ao buscar notificações:', error);
      throw error;
    }
    
    return data || [];
  },

  async getUnread(userId: string): Promise<Notification[]> {
    return this.listNotifications();
  },

  async dismissNotification(id: string) {
    const { error } = await supabase.rpc('dismiss_notification', {
      p_notification_id: id
    });

    if (error) throw error;
  },

  async markAsRead(id: string) {
    await this.dismissNotification(id);
  },
  
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();
  }
};

