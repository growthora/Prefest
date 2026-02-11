import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { matchService, Match } from '@/services/match.service';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export function MatchPersistentToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unseenMatches, setUnseenMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (user) {
      loadUnseenMatches();

      // Realtime subscription for new matches
      const subscription = supabase
        .channel('public:matches_toast')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, (payload) => {
          console.log('🔥 New match detected via realtime!', payload);
          // Check if current user is involved
          if (payload.new.user_a_id === user.id || payload.new.user_b_id === user.id) {
             loadUnseenMatches();
          }
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const loadUnseenMatches = async () => {
    try {
      const matches = await matchService.getUserMatches();
      // Filter for matches that haven't been seen yet
      const unseen = matches.filter(m => !m.match_seen);
      setUnseenMatches(unseen);
      if (unseen.length > 0) {
        setCurrentMatch(unseen[0]);
      }
    } catch (error) {
      console.error('Error loading unseen matches', error);
    }
  };

  const handleDismiss = async () => {
    if (!currentMatch) return;
    try {
      await matchService.markMatchSeen(currentMatch.match_id);
      
      // Move to next unseen match if any
      const remaining = unseenMatches.filter(m => m.match_id !== currentMatch.match_id);
      setUnseenMatches(remaining);
      setCurrentMatch(remaining.length > 0 ? remaining[0] : null);
    } catch (error) {
      console.error('Error dismissing match toast', error);
    }
  };

  const handleChat = async () => {
    if (!currentMatch) return;
    try {
      await matchService.markMatchSeen(currentMatch.match_id);
      
      // Navigate directly to chat page
      navigate(`/chat/${currentMatch.match_id}`);
      
      // Move to next unseen match if any
      const remaining = unseenMatches.filter(m => m.match_id !== currentMatch.match_id);
      setUnseenMatches(remaining);
      setCurrentMatch(remaining.length > 0 ? remaining[0] : null);
    } catch (error) {
      console.error('Error handling chat action', error);
    }
  };

  if (!currentMatch) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md pointer-events-auto"
      >
        <div className="bg-gradient-to-r from-pink-600 to-rose-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-black/10 rounded-full blur-xl" />

            <div className="relative">
                <Avatar className="h-14 w-14 border-2 border-white/40 shadow-md">
                    <AvatarImage src={currentMatch.partner_avatar} />
                    <AvatarFallback>{currentMatch.partner_name[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                    <Heart className="w-3 h-3 text-rose-500 fill-current" />
                </div>
            </div>

            <div className="flex-1 min-w-0 z-10">
                <h4 className="font-bold text-lg leading-tight">It's a Match! 🔥</h4>
                <p className="text-sm text-white/90 truncate">
                    Você e {currentMatch.partner_name} se curtiram.
                </p>
                <div className="flex gap-2 mt-3">
                    <Button 
                        size="sm" 
                        variant="secondary"
                        className="h-8 px-4 text-rose-600 hover:text-rose-700 font-semibold shadow-sm"
                        onClick={() => {
                            // Redirecionamento direto para o chat
                            navigate(`/chat/${currentMatch.match_id}`);
                            handleDismiss();
                        }}
                    >
                        <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                        Conversar
                    </Button>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 px-3 text-white/80 hover:text-white hover:bg-white/10"
                        onClick={handleDismiss}
                    >
                        Depois
                    </Button>
                </div>
            </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
