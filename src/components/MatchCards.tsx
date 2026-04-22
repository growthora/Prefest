import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Heart, X, Info, Sparkles, MapPin, Zap, Clock, Loader2 } from 'lucide-react';
import { User } from '@/lib/index';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProfileModal } from '@/components/ProfileModal';
import { springPresets } from '@/lib/motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getGenderIdentityLabel,
  getMatchIntentionLabel,
  getSexualityLabel,
} from '@/constants/profile-options';
import { hasValidMatchPhoto } from '@/utils/matchPhoto';

interface MatchCardProps {
  user: User;
  onLike: () => void;
  onSkip: () => void;
  onDetails: () => void;
  isTop?: boolean;
}

export function MatchCard({ user, onLike, onSkip, onDetails, isTop = false }: MatchCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const skipOpacity = useTransform(x, [-150, -50], [1, 0]);
  const isDragging = React.useRef(false);
  const [hasError, setHasError] = useState(false);

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    setTimeout(() => {
      isDragging.current = false;
    }, 100);

    if (info.offset.x > 100) {
      onLike();
    } else if (info.offset.x < -100) {
      onSkip();
    }
  };

  const handleDragStart = () => {
    isDragging.current = true;
  };

  const displayName = user.showInitialsOnly ? `${user.name.charAt(0)}.` : user.name;

  const intentionEmoji: Record<string, string> = {
    paquera: '💕',
    amizade: '🤝',
  };

  return (
    <motion.div
      style={{ x, rotate, opacity, zIndex: isTop ? 10 : 0 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      transition={springPresets.gentle}
    >
      <Card
        className="relative h-full w-full cursor-pointer overflow-hidden rounded-3xl border-none bg-zinc-900 shadow-2xl"
        onClick={() => {
          if (isTop && !isDragging.current) {
            onDetails();
          }
        }}
      >
        <div className="absolute inset-0 bg-zinc-800">
          {user.photo && !hasError && user.photo.trim() !== '' && user.photo !== 'undefined' && user.photo !== 'null' ? (
            <img
              src={user.photo}
              alt={displayName}
              onError={() => setHasError(true)}
              className="h-full w-full object-cover saturate-[0.8] brightness-[0.7] transition-transform duration-700 hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-end bg-gradient-to-b from-zinc-800 to-zinc-950 p-8">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">Foto indisponivel</p>
                <p className="text-xs text-zinc-400">
                  Este perfil foi removido da fila para manter a qualidade do match.
                </p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-10 left-10 z-20 rotate-[-15deg] rounded-xl border-4 border-primary px-6 py-2"
        >
          <span className="text-4xl font-black uppercase tracking-widest text-primary">MATCH</span>
        </motion.div>

        <motion.div
          style={{ opacity: skipOpacity }}
          className="absolute top-10 right-10 z-20 rotate-[15deg] rounded-xl border-4 border-white/50 px-6 py-2"
        >
          <span className="text-4xl font-black uppercase tracking-widest text-white/50">SKIP</span>
        </motion.div>

        <div className="absolute top-4 left-4 z-30">
          {user.isOnline ? (
            <Badge className="flex gap-1.5 border-none bg-green-500/80 py-1 pl-1.5 pr-2.5 text-white shadow-lg backdrop-blur-md hover:bg-green-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Online
            </Badge>
          ) : user.lastSeen ? (
            <Badge className="flex gap-1.5 border-white/10 bg-black/40 py-1 pl-1.5 pr-2.5 text-white/90 shadow-lg backdrop-blur-md hover:bg-black/60">
              <Clock className="h-3 w-3 text-orange-400" />
              {formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true, locale: ptBR })}
            </Badge>
          ) : null}
        </div>

        <div className="absolute bottom-0 left-0 right-0 space-y-4 p-8">
          <div className="flex items-end justify-between">
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-3xl font-bold text-white">
                  {displayName}
                  {user.age && `, ${user.age}`}
                </h3>

                {user.genderIdentity && (
                  <Badge className="flex items-center gap-1 border-white/20 bg-white/10 text-white">
                    {getGenderIdentityLabel(user.genderIdentity)}
                  </Badge>
                )}

                {user.likedYou && (
                  <Badge className="flex items-center gap-1 border-rose-300/30 bg-rose-500/20 text-white">
                    <Heart size={12} className="fill-current" />
                    Curtiu voce
                  </Badge>
                )}

                {user.sexuality && (
                  <Badge className="flex items-center gap-1 border-purple-400/30 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white">
                    {getSexualityLabel(user.sexuality)}
                  </Badge>
                )}

                {user.matchIntention && (
                  <Badge className="flex items-center gap-1 border-primary/30 bg-primary/20 text-primary">
                    {intentionEmoji[user.matchIntention] || '✨'} {getMatchIntentionLabel(user.matchIntention)}
                  </Badge>
                )}

                {user.compatibilityScore && user.compatibilityScore > 90 && (
                  <Badge className="flex items-center gap-1 border-yellow-400/30 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300">
                    <Zap size={12} fill="currentColor" />
                    {user.compatibilityScore}%
                  </Badge>
                )}
              </div>
              <p className="max-w-[90%] line-clamp-2 text-sm text-zinc-300">{user.bio}</p>
            </div>

            <Button
              size="icon"
              variant="secondary"
              className="shrink-0 rounded-full border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                onDetails();
              }}
            >
              <Info size={20} className="text-white" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {user.vibes && user.vibes.length > 0 && user.vibes.map((vibe) => (
              <Badge
                key={vibe}
                variant="outline"
                className="border-white/10 bg-black/40 font-medium text-white/80 backdrop-blur-sm"
              >
                {vibe}
              </Badge>
            ))}
          </div>

          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white/60">
            {user.badges && user.badges.length > 0 && user.badges.map((badge) => (
              <span
                key={badge}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter text-primary"
              >
                <Sparkles size={10} />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

interface MatchInterfaceProps {
  queue: User[];
  onLike: (userId: string) => void;
  onSkip: (userId: string) => void;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
}

export function MatchInterface({
  queue,
  onLike,
  onSkip,
  onRefresh,
  isRefreshing = false,
}: MatchInterfaceProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleLike = (userId: string) => {
    onLike(userId);
  };

  const handleSkip = (userId: string) => {
    onSkip(userId);
  };

  const currentQueue = queue.filter((user) => hasValidMatchPhoto(user.photo)).slice(0, 3);

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-md">
      <AnimatePresence>
        {currentQueue.length > 0 ? (
          <div className="relative h-full w-full">
            {currentQueue.map((user, idx) => (
              <MatchCard
                key={user.id}
                user={user}
                isTop={idx === 0}
                onLike={() => handleLike(user.id)}
                onSkip={() => handleSkip(user.id)}
                onDetails={() => setSelectedUser(user)}
              />
            )).reverse()}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex h-full w-full flex-col items-center justify-center space-y-6 rounded-3xl border border-border/40 bg-card text-center"
          >
            <div className="rounded-full bg-primary/10 p-6">
              <MapPin size={48} className="animate-pulse text-primary" />
            </div>
            <div className="space-y-2 px-8">
              <h4 className="text-xl font-bold text-foreground">Fim da fila</h4>
              <p className="text-sm text-foreground/75">
                {isRefreshing
                  ? 'Buscando novos perfis para reiniciar sua fila...'
                  : 'Voce ja viu os perfis disponiveis neste momento. Fique de olho, novas pessoas podem entrar a qualquer momento.'}
              </p>
            </div>
            <Button
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10"
              onClick={onRefresh}
              disabled={isRefreshing || !onRefresh}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando novos perfis...
                </>
              ) : (
                'Recarregar perfis'
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {currentQueue.length > 0 && (
        <div className="absolute -bottom-20 left-0 right-0 flex justify-center gap-8">
          <Button
            onClick={() => handleSkip(currentQueue[0].id)}
            size="icon"
            className="h-20 w-20 rounded-full border-2 border-white/20 bg-zinc-900 text-white shadow-2xl transition-all hover:scale-110 hover:border-white/40 hover:bg-zinc-800"
          >
            <X size={32} strokeWidth={3} />
          </Button>
          <Button
            onClick={() => handleLike(currentQueue[0].id)}
            size="icon"
            className="h-20 w-20 rounded-full bg-primary text-white shadow-[0_0_30px_rgba(255,0,127,0.6)] transition-all hover:scale-110 hover:shadow-[0_0_40px_rgba(255,0,127,0.8)]"
          >
            <Heart size={32} fill="currentColor" strokeWidth={0} />
          </Button>
        </div>
      )}

      <ProfileModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        user={selectedUser || undefined}
        onLike={(id) => {
          handleLike(id);
          setSelectedUser(null);
        }}
        onSkip={(id) => {
          handleSkip(id);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
