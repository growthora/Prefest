import React from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Shield, 
  Heart, 
  Zap, 
  Edit3, 
  Settings, 
  Camera, 
  CheckCircle2, 
  Flame
} from 'lucide-react';
import { User, VibeType } from '@/lib';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MatchGuidelinesModal } from '@/components/MatchGuidelinesModal';
import { useState } from 'react';
import { toast } from 'sonner';

interface ProfileBadgesProps {
  badges: string[];
  isSingleMode?: boolean;
}

export function ProfileBadges({ badges, isSingleMode }: ProfileBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {isSingleMode && (
        <Badge 
          variant="outline" 
          className="bg-primary/10 border-primary text-primary flex items-center gap-1.5 px-3 py-1 font-semibold animate-pulse"
        >
          <Flame size={14} className="fill-primary" />
          Solteiro Ativo
        </Badge>
      )}
      {badges.map((badge, index) => (
        <Badge 
          key={index} 
          variant="secondary" 
          className="bg-zinc-800 text-zinc-300 border-zinc-700 font-medium px-3 py-1"
        >
          {badge === 'High Compatibility' && <Zap size={14} className="mr-1.5 text-yellow-500 fill-yellow-500" />}
          {badge === 'Pioneer' && <CheckCircle2 size={14} className="mr-1.5 text-primary" />}
          {badge}
        </Badge>
      ))}
    </div>
  );
}

interface UserProfileProps {
  user: User;
  isEditable?: boolean;
}

export function UserProfile({ user, isEditable = false }: UserProfileProps) {
  const { updateProfile } = useAuth();
  const [showMatchGuidelines, setShowMatchGuidelines] = useState(false);

  const handleToggleSingleMode = async (checked: boolean) => {
    if (!isEditable) return;
    
    if (checked) {
      setShowMatchGuidelines(true);
      return;
    }

    try {
      await updateProfile({ match_enabled: false });
      toast.success("Modo Match desativado");
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const confirmMatchEnabled = async () => {
    try {
      setShowMatchGuidelines(false);
      await updateProfile({ match_enabled: true });
      toast.success("Modo Match ativado!");
    } catch (error) {
      toast.error("Erro ao ativar match");
    }
  };

  const getDisplayName = () => {
    if (!isEditable && user.showInitialsOnly) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('.');
    }
    return user.name;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {/* Header / Avatar Section */}
      <div className="relative">
        <div className="h-48 w-full bg-gradient-to-b from-zinc-800 to-background rounded-t-3xl border-x border-t border-zinc-800/50" />
        <div className="absolute -bottom-16 left-8 flex items-end gap-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-background shadow-2xl">
              <img 
                src={user.photo} 
                alt={user.name} 
                className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-500"
              />
            </div>
            {isEditable && (
              <button className="absolute bottom-2 right-2 p-2 bg-primary rounded-lg text-white shadow-lg hover:scale-105 transition-transform">
                <Camera size={16} />
              </button>
            )}
          </div>
          <div className="mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {getDisplayName()}, <span className="text-zinc-500">{user.age}</span>
              </h1>
              {user.compatibilityScore && (
                <div className="flex items-center gap-1 text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded">
                  <Zap size={14} className="fill-primary" />
                  {user.compatibilityScore}%
                </div>
              )}
            </div>
            <div className="flex items-center text-zinc-500 mt-1">
              <MapPin size={14} className="mr-1.5" />
              <span className="text-sm">São Paulo, SP</span>
            </div>
          </div>
        </div>
        {isEditable && (
          <div className="absolute top-52 right-8 flex gap-3">
            <Button variant="outline" size="sm" className="rounded-full bg-zinc-900 border-zinc-800 hover:bg-zinc-800">
              <Edit3 size={16} className="mr-2" /> Editar
            </Button>
            <Button variant="outline" size="icon" className="rounded-full bg-zinc-900 border-zinc-800 hover:bg-zinc-800">
              <Settings size={18} />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-20 px-8 space-y-10">
        {/* Badges Section */}
        <section className="space-y-4">
          <ProfileBadges badges={user.badges} isSingleMode={user.isSingleMode} />
        </section>

        {/* Bio Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Sobre</h3>
          <p className="text-lg text-zinc-300 leading-relaxed font-light">
            {user.bio}
          </p>
        </section>

        {/* Vibes Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Vibe do Evento</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {user.vibes.map((vibe, index) => (
              <div 
                key={index} 
                className="bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-xl flex items-center gap-3 group hover:border-primary/30 transition-colors cursor-default"
              >
                <div className="w-2 h-2 rounded-full bg-primary group-hover:shadow-[0_0_8px_var(--primary)] transition-all" />
                <span className="text-sm font-medium capitalize text-zinc-300">{vibe}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy & Social Controls (Only if Editable) */}
        {isEditable && (
          <section className="space-y-6">
            <Separator className="bg-zinc-800" />
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Privacidade & Social</h3>
            
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Flame size={18} className="text-primary" />
                      <p className="font-medium text-foreground">Conheça a Galera!!</p>
                    </div>
                    <p className="text-sm text-zinc-500">Fique visível para outros solteiros e libere o Match do Evento.</p>
                  </div>
                  <Switch 
                    checked={user.isSingleMode} 
                    onCheckedChange={handleToggleSingleMode} 
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Shield size={18} className="text-zinc-400" />
                      <p className="font-medium text-foreground">Anonimato Inteligente</p>
                    </div>
                    <p className="text-sm text-zinc-500">Mostrar apenas iniciais até que um match aconteça.</p>
                  </div>
                  <Switch 
                    checked={user.showInitialsOnly} 
                    onCheckedChange={(val) => updateProfile({ show_initials_only: val })}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </CardContent>
            </Card>
            <MatchGuidelinesModal 
              isOpen={showMatchGuidelines} 
              onClose={() => setShowMatchGuidelines(false)} 
              onAccept={confirmMatchEnabled} 
            />
          </section>
        )}

        {/* Call to Action for non-editable profile */}
        {!isEditable && user.isSingleMode && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center pt-8"
          >
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-12 py-6 text-lg font-bold shadow-[0_0_20px_rgba(255,0,127,0.3)] transition-all hover:scale-105 active:scale-95">
              <Heart size={20} className="mr-2 fill-current" /> Enviar Interesse
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
