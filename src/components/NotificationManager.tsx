import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { notificationService, Notification } from '@/services/notification.service';
import { toast } from 'sonner';
import { Heart, Flame, MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { RealtimeChannel } from '@supabase/supabase-js';

export const NotificationManager: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) {
        if (channelRef.current) {
            channelRef.current.unsubscribe();
            channelRef.current = null;
        }
        return;
    }

    // Load initial unread notifications
    const loadUnreadNotifications = async () => {
        try {
            const notifications = await notificationService.listNotifications();
            notifications.forEach(handleNotification);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    };

    loadUnreadNotifications();

    // Subscribe to new notifications
    const channel = notificationService.subscribeToNotifications(user.id, (notification) => {
        handleNotification(notification);
    });
    channelRef.current = channel;

    return () => {
        if (channelRef.current) {
            channelRef.current.unsubscribe();
        }
    };
  }, [user]);

  const handleNotification = (notification: Notification) => {
      // If notification is already read/dismissed (shouldn't happen for realtime, but good for initial load check if logic changes)
      // Actually listNotifications returns unread ones.
      
      if (notification.type === 'like') {
          toast.custom((id) => (
              <div className="bg-white dark:bg-zinc-900 border border-pink-200 dark:border-pink-900/30 rounded-xl shadow-2xl p-4 w-full max-w-sm flex items-start gap-4 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-500 to-purple-500" />
                  
                  <div className="bg-pink-100 dark:bg-pink-900/20 p-2 rounded-full shrink-0">
                      <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                  </div>
                  
                  <div className="flex-1">
                      <h4 className="font-bold text-sm text-foreground mb-1">Nova Curtida!</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                          {notification.payload.message || 'Alguém curtiu você!'}
                      </p>
                      
                      <div className="flex gap-2">
                          <button 
                              onClick={() => {
                                  toast.dismiss(id);
                                  notificationService.dismissNotification(notification.id);
                              }}
                              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                          >
                              Dispensar
                          </button>
                          <button 
                              onClick={() => {
                                  toast.dismiss(id);
                                  // Navigate to match page if event_id is present
                                  if (notification.event_id) {
                                      navigate(`/eventos/${notification.event_id}/match`);
                                  }
                              }}
                              className="text-xs font-bold text-pink-500 hover:text-pink-600 bg-pink-50 dark:bg-pink-900/20 px-3 py-1 rounded-md transition-colors"
                          >
                              Ver Agora
                          </button>
                      </div>
                  </div>
              </div>
          ), {
              duration: Infinity, // Persistent until dismissed
              id: notification.id, // Prevent duplicates
          });
      }
  };

  return null; // Headless component
};
