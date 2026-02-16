import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { notificationService, Notification } from '@/services/notification.service';
import { toast } from 'sonner';
import { Heart, Calendar, PartyPopper } from 'lucide-react';
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
              {notification.payload?.message || 'Alguém curtiu você!'}
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
                  const eventSlugOrId = notification.payload?.event_slug || notification.event_id;
                  if (eventSlugOrId) {
                    navigate(`/eventos/${eventSlugOrId}?tab=match`);
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
        duration: Infinity,
        id: notification.id,
      });
      return;
    }

    if (notification.type === 'system' && notification.payload?.subtype === 'event_today') {
      toast.custom((id) => (
        <div className="bg-white dark:bg-zinc-900 border border-primary/20 dark:border-primary/30 rounded-xl shadow-2xl p-4 w-full max-w-sm flex items-start gap-4 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-amber-500" />
          <div className="bg-primary/10 text-primary p-2 rounded-full shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm text-foreground mb-1">
              Hoje é o dia do evento!
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              {notification.payload?.message || 'Seus matches também vão estar lá 👀🔥'}
            </p>
            {notification.payload?.event_title && (
              <p className="text-xs font-medium mb-3">
                {notification.payload.event_title}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  toast.dismiss(id);
                  notificationService.dismissNotification(notification.id);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                Depois
              </button>
              <button
                onClick={() => {
                  toast.dismiss(id);
                  notificationService.dismissNotification(notification.id);
                  const eventSlugOrId = notification.payload?.event_slug || notification.event_id;
                  if (eventSlugOrId) {
                    navigate(`/eventos/${eventSlugOrId}?tab=match`);
                  }
                }}
                className="text-xs font-bold text-white bg-primary hover:bg-primary/90 px-3 py-1 rounded-md transition-colors"
              >
                Ver Match do Evento
              </button>
            </div>
          </div>
        </div>
      ), {
        duration: 30000,
        id: notification.id,
      });
      return;
    }

    if (notification.type === 'system' && notification.payload?.subtype === 'post_event') {
      toast.custom((id) => (
        <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/40 rounded-xl shadow-2xl p-4 w-full max-w-sm flex items-start gap-4 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-sky-500" />
          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full shrink-0">
            <PartyPopper className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm text-foreground mb-1">
              Como foi o evento?
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              {notification.payload?.message || 'Continue a conexão e descubra próximos eventos que combinam com você.'}
            </p>
            {notification.payload?.event_title && (
              <p className="text-xs font-medium mb-3">
                {notification.payload.event_title}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  toast.dismiss(id);
                  notificationService.dismissNotification(notification.id);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  toast.dismiss(id);
                  notificationService.dismissNotification(notification.id);
                  navigate(ROUTE_PATHS.EXPLORE);
                }}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/40 px-3 py-1 rounded-md transition-colors"
              >
                Ver próximos eventos
              </button>
            </div>
          </div>
        </div>
      ), {
        duration: 30000,
        id: notification.id,
      });
    }
  };

  return null; // Headless component
};
