import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { matchService, Match } from '@/services/match.service';
import { chatService } from '@/services/chat.service';
import { useAuth } from '@/hooks/useAuth';
import { getMatchEventSummary } from '@/utils/matchEvents';

export function MatchPersistentToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unseenMatches, setUnseenMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);

  const applyUnseenMatches = useCallback((nextMatches: Match[]) => {
    setUnseenMatches(nextMatches);
    setCurrentMatch((previousMatch) => {
      if (!previousMatch) {
        return nextMatches[0] ?? null;
      }

      return nextMatches.find((match) => match.match_id === previousMatch.match_id) ?? nextMatches[0] ?? null;
    });
  }, []);

  const loadUnseenMatches = useCallback(async () => {
    try {
      const matches = await matchService.getUserMatches();
      const unseen = matches.filter((match) => !match.match_seen);
      applyUnseenMatches(unseen);
    } catch {
      applyUnseenMatches([]);
    }
  }, [applyUnseenMatches]);

  useEffect(() => {
    if (!user) {
      applyUnseenMatches([]);
      return;
    }

    void loadUnseenMatches();

    const subscription = chatService.subscribeToMatchList(() => {
      void loadUnseenMatches();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [applyUnseenMatches, loadUnseenMatches, user]);

  const moveToNextMatch = useCallback((matchId: string) => {
    setUnseenMatches((previousMatches) => {
      const nextMatches = previousMatches.filter((match) => match.match_id !== matchId);
      setCurrentMatch((previousMatch) => {
        if (!previousMatch || previousMatch.match_id === matchId) {
          return nextMatches[0] ?? null;
        }

        return nextMatches.find((match) => match.match_id === previousMatch.match_id) ?? nextMatches[0] ?? null;
      });
      return nextMatches;
    });
  }, []);

  const handleDismiss = useCallback(async () => {
    if (!currentMatch) return;

    try {
      await matchService.markMatchSeen(currentMatch.match_id, currentMatch.event_id || undefined);
      moveToNextMatch(currentMatch.match_id);
    } catch {
      void loadUnseenMatches();
    }
  }, [currentMatch, loadUnseenMatches, moveToNextMatch]);

  const handleChat = useCallback(async () => {
    if (!currentMatch) return;

    try {
      await matchService.markMatchSeen(currentMatch.match_id, currentMatch.event_id || undefined);
    } finally {
      navigate(`/chat/${currentMatch.match_id}`);
      moveToNextMatch(currentMatch.match_id);
    }
  }, [currentMatch, moveToNextMatch, navigate]);

  if (!currentMatch) return null;

  const avatarSrc =
    currentMatch.partner_avatar &&
    currentMatch.partner_avatar.trim() !== '' &&
    currentMatch.partner_avatar !== 'undefined' &&
    currentMatch.partner_avatar !== 'null'
      ? currentMatch.partner_avatar
      : undefined;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed bottom-24 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 pointer-events-auto"
      >
        <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 p-4 text-white shadow-2xl">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-black/10 blur-xl" />

          <div className="relative">
            <Avatar className="h-14 w-14 border-2 border-white/40 shadow-md">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback>{currentMatch.partner_name[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1 shadow-sm">
              <Heart className="h-3 w-3 fill-current text-rose-500" />
            </div>
          </div>

          <div className="z-10 min-w-0 flex-1">
            <h4 className="text-lg font-bold leading-tight">It&apos;s a Match!</h4>
            <p className="truncate text-sm text-white/90">
              Voce e {currentMatch.partner_name} se curtiram.
            </p>
            <p className="truncate text-xs text-white/80">
              Eventos em comum: {getMatchEventSummary(currentMatch)}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 px-4 font-semibold text-rose-600 shadow-sm hover:text-rose-700"
                onClick={handleChat}
              >
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                Conversar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-white/80 hover:bg-white/10 hover:text-white"
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
