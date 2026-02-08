import { supabase } from '@/lib/supabase';

export interface Notification {
  id: string; // user_notifications id
  read: boolean;
  read_at: string | null;
  notification: {
    id: string;
    type: string;
    reference_id: string;
    title: string;
    message: string;
    created_at: string;
  };
}

export const notificationService = {
  async getUnread(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('user_notifications')
      .select(`
        id,
        read,
        read_at,
        notification:notifications (
          id,
          type,
          reference_id,
          title,
          message,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    
    // Supabase returns nested object. Sort by created_at desc in JS.
    const notifications = (data as any[]).map(item => ({
      id: item.id,
      read: item.read,
      read_at: item.read_at,
      notification: item.notification
    }));

    return notifications.sort((a, b) => 
      new Date(b.notification.created_at).getTime() - new Date(a.notification.created_at).getTime()
    );
  },

  async markAsRead(id: string) {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },
  
  async markAllAsRead(userId: string) {
      const { error } = await supabase
      .from('user_notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
      
      if (error) throw error;
  }
};
