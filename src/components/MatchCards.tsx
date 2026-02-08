import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Heart, X, Info, Sparkles, MapPin, Zap } from 'lucide-react';
import { User, VibeType } from '@/lib/index';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { springPresets } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  user: User;
  onLike: () => void;
  onSkip: () => void;
  isTop?: boolean;
}

export function MatchCard({ user, onLike, onSkip, isTop = false }: MatchCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const skipOpacity = useTransform(x, [-150, -50], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      onLike();
    } else if (info.offset.x < -100) {
      onSkip();
    }
  };

  const displayName = user.showInitialsOnly 
    ? `${user.name.charAt(0)}.` 
    : user.name;

  // Mapear sexualidade para emoji
  const sexualityEmoji: Record<string, string> = {
    'heterossexual': '🌈',
    'homossexual': '🏳️‍🌈',
    'bissexual': '💜',
    'pansexual': '💗',
    'outro': '✨'
  };

  // Mapear intenção para emoji
  const intentionEmoji: Record<string, string> = {
    'paquera': '💕',
    'amizade': '🤝'
  };

  const intentionText: Record<string, string> = {
    'paquera': 'Paquera',
    'amizade': 'Amizade'
  };

  return (
    <motion.div
      style={{ x, rotate, opacity, zIndex: isTop ? 10 : 0 }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      transition={springPresets.gentle}
    >
      <Card className="relative w-full h-full overflow-hidden border-none bg-zinc-900 shadow-2xl rounded-3xl">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img 
            src={user.photo} 
            alt={displayName} 
            className="w-full h-full object-cover saturate-[0.8] brightness-[0.7] transition-transform duration-700 hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>

        {/* Interaction Indicators */}
        <motion.div 
          style={{ opacity: likeOpacity }}
          className="absolute top-10 left-10 border-4 border-primary px-6 py-2 rounded-xl rotate-[-15deg] z-20"
        >
          <span className="text-primary text-4xl font-black uppercase tracking-widest">MATCH</span>
        </motion.div>

        <motion.div 
          style={{ opacity: skipOpacity }}
          className="absolute top-10 right-10 border-4 border-white/50 px-6 py-2 rounded-xl rotate-[15deg] z-20"
        >
          <span className="text-white/50 text-4xl font-black uppercase tracking-widest">SKIP</span>
        </motion.div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
          <div className="flex items-end justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-3xl font-bold text-white">{displayName}, {user.age}</h3>
                
                {/* Badge de Sexualidade */}
                {user.sexuality && (
                  <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border-purple-400/30 flex gap-1 items-center">
                    {user.sexuality.charAt(0).toUpperCase() + user.sexuality.slice(1)}
                  </Badge>
                )}
                
                {/* Badge de Intenção */}
                {user.matchIntention && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 flex gap-1 items-center">
                    {intentionEmoji[user.matchIntention]} {intentionText[user.matchIntention]}
                  </Badge>
                )}
                
                {user.compatibilityScore && user.compatibilityScore > 90 && (
                  <Badge className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border-yellow-400/30 flex gap-1 items-center">
                    <Zap size={12} fill="currentColor" />
                    {user.compatibilityScore}%
                  </Badge>
                )}
              </div>
              <p className="text-zinc-300 text-sm line-clamp-2 max-w-[90%]">{user.bio}</p>
            </div>
            <Button size="icon" variant="secondary" className="rounded-full bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 shrink-0">
              <Info size={20} className="text-white" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {user.vibes && user.vibes.length > 0 && user.vibes.map((vibe) => (
              <Badge 
                key={vibe} 
                variant="outline" 
                className="bg-black/40 backdrop-blur-sm border-white/10 text-white/80 font-medium"
              >
                {vibe}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-white/60 uppercase font-mono tracking-wider mb-2">
            {user.badges && user.badges.length > 0 && user.badges.map((badge) => (
              <span key={badge} className="text-[10px] uppercase tracking-tighter text-primary font-bold flex items-center gap-1">
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
}

export function MatchInterface({ queue, onLike, onSkip }: MatchInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleLike = (userId: string) => {
    onLike(userId);
    setCurrentIndex(prev => prev + 1);
  };

  const handleSkip = (userId: string) => {
    onSkip(userId);
    setCurrentIndex(prev => prev + 1);
  };

  const currentQueue = queue.slice(currentIndex, currentIndex + 3);

  return (
    <div className="relative w-full max-w-md aspect-[3/4] mx-auto">
      <AnimatePresence>
        {currentQueue.length > 0 ? (
          <div className="relative w-full h-full">
            {currentQueue.map((user, idx) => (
              <MatchCard
                key={user.id}
                user={user}
                isTop={idx === 0}
                onLike={() => handleLike(user.id)}
                onSkip={() => handleSkip(user.id)}
              />
            )).reverse()}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full flex flex-col items-center justify-center text-center space-y-6 bg-zinc-900/50 rounded-3xl border border-white/5 backdrop-blur-sm"
          >
            <div className="p-6 rounded-full bg-primary/10">
              <MapPin size={48} className="text-primary animate-pulse" />
            </div>
            <div className="space-y-2 px-8">
              <h4 className="text-xl font-bold text-white">Fim da Fila</h4>
              <p className="text-zinc-400 text-sm">
                Você já viu todos os solteiros deste evento. Fique de olho, novas pessoas podem entrar a qualquer momento!
              </p>
            </div>
            <Button 
              variant="outline" 
              className="border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => window.location.reload()}
            >
              Recarregar Perfis
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {currentQueue.length > 0 && (
        <div className="absolute -bottom-20 left-0 right-0 flex justify-center gap-8">
          <Button
            onClick={() => handleSkip(currentQueue[0].id)}
            size="icon"
            className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-white/20 text-white hover:bg-zinc-800 hover:scale-110 transition-all shadow-2xl hover:border-white/40"
          >
            <X size={32} strokeWidth={3} />
          </Button>
          <Button
            onClick={() => handleLike(currentQueue[0].id)}
            size="icon"
            className="w-20 h-20 rounded-full bg-primary text-white hover:scale-110 transition-all shadow-[0_0_30px_rgba(255,0,127,0.6)] hover:shadow-[0_0_40px_rgba(255,0,127,0.8)]"
          >
            <Heart size={32} fill="currentColor" strokeWidth={0} />
          </Button>
        </div>
      )}
    </div>
  );
}
