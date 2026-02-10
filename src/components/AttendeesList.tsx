import React from 'react';
import { motion } from 'framer-motion';
import { User, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Attendee {
  user_id: string;
  name: string;
  avatar_url: string | null;
  city?: string;
  is_online?: boolean;
  last_seen?: string;
  match_enabled?: boolean;
}

interface AttendeesListProps {
  attendees: Attendee[];
  onSelectAttendee: (attendee: Attendee) => void;
  loading: boolean;
}

export function AttendeesList({ attendees, onSelectAttendee, loading }: AttendeesListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="h-48 animate-pulse bg-muted/50 border-0" />
        ))}
      </div>
    );
  }

  if (attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center bg-card/30 rounded-xl border border-border/40 p-8">
        <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Ninguém por aqui ainda</h3>
        <p className="text-muted-foreground">
          Seja o primeiro a confirmar presença neste evento!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {attendees.map((attendee, index) => (
        <motion.div
          key={attendee.user_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card 
            className="group overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
            onClick={() => onSelectAttendee(attendee)}
          >
            <div className="p-4 flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <Avatar className="w-20 h-20 border-2 border-background shadow-sm group-hover:scale-105 transition-transform">
                  <AvatarImage src={attendee.avatar_url || undefined} alt={attendee.name} />
                  <AvatarFallback className="text-lg bg-primary/10 text-primary">
                    {attendee.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {attendee.is_online && (
                  <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" title="Online" />
                )}
              </div>
              
              <div className="space-y-1 w-full">
                <h4 className="font-semibold text-sm truncate w-full" title={attendee.name}>
                  {attendee.name}
                </h4>
                {attendee.city && (
                  <div className="flex items-center justify-center text-xs text-muted-foreground gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{attendee.city}</span>
                  </div>
                )}
              </div>

              {attendee.match_enabled && (
                <Badge variant="secondary" className="text-[10px] bg-pink-500/10 text-pink-500 border-0">
                  Match Ativo
                </Badge>
              )}
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
