import React, { useState, useEffect } from 'react';
import { Bell, Heart, Calendar, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/services/notification.service';
import { likeService } from '@/services/like.service';
import { eventService } from '@/services/event.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ROUTE_PATHS } from '@/lib/index';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface UINotification {
  id: string;
  type: 'like' | 'event';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  data?: any;
  actionId: string;
}

export function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UINotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadNotifications = async () => {
    if (!user?.id) return;

    try {
      // 1. Fetch Likes (Legacy)
      const likes = await likeService.getUnreadLikes(user.id);
      const likeNotifications: UINotification[] = likes.map(like => ({
        id: `like-${like.id}`,
        type: 'like',
        title: like.is_match ? '💕 É um Match!' : '❤️ Alguém curtiu você',
        description: like.is_match 
          ? `Você e ${like.from_user?.full_name || 'alguém'} curtiram um ao outro!`
          : `${like.from_user?.full_name || 'Alguém'} te curtiu em um evento!`,
        timestamp: like.created_at,
        read: false,
        data: { 
          likeId: like.id,
          userId: like.from_user_id,
          eventId: like.event_id,
          isMatch: like.is_match
        },
        actionId: like.id
      }));

      // 2. Fetch Global Notifications (New DB Table)
      const globalNotifs = await notificationService.getUnread(user.id);
      const eventNotifications: UINotification[] = globalNotifs.map(n => ({
        id: n.id, // user_notifications id
        type: 'event',
        title: n.notification.title,
        description: n.notification.message,
        timestamp: n.notification.created_at,
        read: n.read,
        data: { 
            eventId: n.notification.reference_id 
        },
        actionId: n.id
      }));

      // Merge and Sort
      const allNotifications = [...likeNotifications, ...eventNotifications]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setNotifications(allNotifications);
      setUnreadCount(allNotifications.length);
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      loadNotifications();
    }
  }, [isOpen, user]);

  const handleMarkAsRead = async (notification: UINotification, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      if (notification.type === 'like') {
        await likeService.markAsRead(notification.actionId);
      } else {
        await notificationService.markAsRead(notification.actionId);
      }
      
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read', error);
    }
  };

  const handleNotificationClick = async (notification: UINotification) => {
    await handleMarkAsRead(notification);

    if (notification.type === 'like') {
        if (notification.data.isMatch) {
            // Navigate to chat with the match ID (which corresponds to the user_like ID)
            navigate(ROUTE_PATHS.CHAT.replace(':matchId', notification.actionId));
        } else {
             // Navigate to the Match Event page
             navigate(ROUTE_PATHS.MATCH_EVENT.replace(':id', notification.data.eventId));
        }
    } else if (notification.type === 'event') {
        try {
            // Fetch event to get slug
            const event = await eventService.getEventById(notification.data.eventId);
            if (event?.slug) {
                navigate(ROUTE_PATHS.EVENT_DETAILS.replace(':slug', event.slug));
            } else {
                 navigate(ROUTE_PATHS.EVENT_DETAILS.replace(':slug', notification.data.eventId));
            }
        } catch (e) {
            console.error('Failed to navigate to event', e);
        }
    }
    
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px]" 
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-auto py-1 px-2"
              onClick={async () => {
                 const promises = notifications.map(n => {
                    if (n.type === 'like') return likeService.markAsRead(n.actionId);
                    return notificationService.markAsRead(n.actionId);
                 });
                 await Promise.all(promises);
                 setNotifications([]);
                 setUnreadCount(0);
              }}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma notificação nova</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors relative group",
                    !notification.read && "bg-muted/20"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={cn(
                    "mt-1 rounded-full p-2",
                    notification.type === 'like' ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"
                  )}>
                    {notification.type === 'like' ? <Heart className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{notification.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.timestamp).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
                    onClick={(e) => handleMarkAsRead(notification, e)}
                    title="Marcar como lida"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
