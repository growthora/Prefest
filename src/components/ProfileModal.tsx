import React from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Heart, Clock, Ruler, Sparkles, Users, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User } from '@/lib/index';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  getGenderIdentityLabel,
  getMatchGenderPreferenceLabel,
  getMatchIntentionLabel,
  getRelationshipStatusLabel,
  getSexualityLabel,
} from '@/constants/profile-options';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Partial<User> & { is_visible?: boolean }; // Allow partial user data
  onLike?: (userId: string) => void;
  onSkip?: (userId: string) => void;
}

export function ProfileModal({ isOpen, onClose, user, onLike, onSkip }: ProfileModalProps) {
  if (!user) return null;
  const isMobile = useIsMobile();

  // Determine if we should show details based on is_visible flag or privacy logic
  // If is_visible is explicitly false, or if critical data is missing implying privacy
  const isPrivate = user.is_visible === false;

  const body = (
    <div className="h-full overflow-y-auto">
      {/* Header Image */}
      <div className="relative h-56 sm:h-64 w-full bg-zinc-900">
        {user.photo ? (
          <img 
            src={user.photo}
            alt={user.name} 
            className={`w-full h-full object-cover object-center ${isPrivate ? 'blur-md brightness-50' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-950">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-sm font-semibold text-white">Foto indisponível</p>
              <p className="text-xs text-zinc-400">Este perfil precisa de uma foto válida para participar do match.</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-4 bg-black/20 backdrop-blur-md hover:bg-black/40 text-white rounded-full z-50"
          onClick={onClose}
        >
          <X size={20} />
        </Button>

        {isPrivate && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 z-20">
            <Lock className="w-12 h-12 mb-2 opacity-50" />
            <p className="font-medium text-lg">Perfil Privado</p>
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 -mt-12 relative z-10 space-y-5 sm:space-y-6 pb-20">
        {/* Title Section */}
        <div className="space-y-2">
          <div className="flex items-start gap-3 justify-between">
            <h2 className="text-2xl sm:text-3xl font-bold text-white min-w-0 break-words">
              {user.name}
              {!isPrivate && user.age && `, ${user.age}`}
            </h2>
            {user.isOnline && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Online
              </Badge>
            )}
          </div>
          
          {user.lastSeen && !user.isOnline && (
            <p className="text-zinc-400 text-sm flex items-center gap-1">
              <Clock size={12} />
              Visto por último {formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true, locale: ptBR })}
            </p>
          )}
        </div>

        {!isPrivate ? (
          <>
            {/* Bio Section */}
            {user.bio && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Sobre</h3>
                <p className="text-zinc-100 leading-relaxed">
                  {user.bio}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center space-y-2">
            <p className="text-zinc-400">Este usuário optou por manter os detalhes do perfil privados.</p>
          </div>
        )}

        {!isPrivate && (
          <div className="space-y-4 pt-2">
            {(user.height ||
              user.relationshipStatus ||
              user.genderIdentity ||
              user.matchIntention ||
              user.sexuality ||
              (user.genderPreference && getMatchGenderPreferenceLabel(user.genderPreference))) && (
              <div className="flex flex-wrap gap-2">
                {user.height && (
                  <Badge variant="secondary" className="bg-zinc-800/50 text-white">
                    <Ruler size={12} className="mr-1" />
                    {user.height}m
                  </Badge>
                )}
                {user.relationshipStatus && (
                  <Badge variant="secondary" className="bg-zinc-800/50 text-white">
                    <Heart size={12} className="mr-1" />
                    {getRelationshipStatusLabel(user.relationshipStatus)}
                  </Badge>
                )}
                {user.genderIdentity && (
                  <Badge variant="secondary" className="bg-zinc-800/50 text-white">
                    {getGenderIdentityLabel(user.genderIdentity)}
                  </Badge>
                )}
                {user.matchIntention && (
                  <Badge variant="secondary" className="bg-zinc-800/50 text-white">
                    <Sparkles size={12} className="mr-1" />
                    {getMatchIntentionLabel(user.matchIntention)}
                  </Badge>
                )}
                {user.sexuality && (
                  <Badge variant="secondary" className="bg-zinc-800/50 text-white">
                    {getSexualityLabel(user.sexuality)}
                  </Badge>
                )}
                {user.genderPreference && getMatchGenderPreferenceLabel(user.genderPreference) && (
                  <Badge variant="secondary" className="bg-zinc-800/50 text-white">
                    <Users size={12} className="mr-1" />
                    Busca: {getMatchGenderPreferenceLabel(user.genderPreference)}
                  </Badge>
                )}
              </div>
            )}

            {user.vibes && user.vibes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Vibe</h3>
                <div className="flex flex-wrap gap-2">
                  {user.vibes.map((vibe) => (
                    <Badge key={vibe} variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                      {vibe}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {user.lookingFor && user.lookingFor.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Procurando por</h3>
                <div className="flex flex-wrap gap-2">
                  {user.lookingFor.map((item) => (
                    <Badge key={item} variant="secondary" className="bg-zinc-800/80 text-white">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {(onLike || onSkip) && !isPrivate && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            {onSkip && (
              <Button 
                className="flex-1 h-14 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white border-2 border-transparent hover:border-zinc-600 transition-all text-base sm:text-lg font-medium"
                onClick={() => onSkip(user.id!)}
              >
                <X className="mr-2" />
                Pular
              </Button>
            )}
            {onLike && (
              <Button 
                className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 transition-all text-base sm:text-lg font-medium"
                onClick={() => onLike(user.id!)}
              >
                <Heart className="mr-2 fill-current" />
                Match
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[90vh] sm:h-[85vh] rounded-t-[2rem] border-t border-white/10 bg-zinc-950 p-0 overflow-hidden focus:outline-none [&>button]:hidden">
          <VisuallyHidden>
            <SheetTitle>Perfil de {user.name}</SheetTitle>
          </VisuallyHidden>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[82vh] w-[calc(100vw-2rem)] max-w-[30rem] p-0 border border-white/10 bg-zinc-950 overflow-hidden rounded-2xl focus:outline-none [&>button]:hidden">
        <VisuallyHidden>
          <DialogTitle>Perfil de {user.name}</DialogTitle>
        </VisuallyHidden>
        {body}
      </DialogContent>
    </Dialog>
  );
}
