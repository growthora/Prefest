import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { userService } from '@/services/user.service';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  X, 
  ArrowLeft, 
  MapPin, 
  Ruler, 
  Sparkles, 
  Users, 
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { GlobalLoader } from '@/components/GlobalLoader';
import { likeService } from '@/services/like.service';
import { supabase } from '@/lib/supabase';

interface PublicUser {
  id: string;
  name: string;
  photo: string | null;
  bio: string | null;
  city: string | null;
  age: number | null;
  height: number | null;
  relationship_status: string | null;
  match_intention: string | null;
  sexuality: string | null;
  gender_preference: string | null;
  vibes: string[] | null;
  looking_for: string[] | null;
  is_online: boolean;
  last_seen: string | null;
  match_enabled: boolean;
  show_initials_only: boolean;
  allow_profile_view: boolean;
  privacy_settings?: {
    show_age: boolean;
    show_height: boolean;
    show_instagram: boolean;
    show_relationship: boolean;
  };
}

export default function PublicProfile() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventContext, setEventContext] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    // Check for event context from navigation state
    if (location.state?.eventId && location.state?.eventTitle) {
      setEventContext({
        id: location.state.eventId,
        title: location.state.eventTitle
      });
    }
  }, [location.state]);

  useEffect(() => {
    if (slug) {
      loadProfile(slug);
    }
  }, [slug, eventContext]); // Re-run if eventContext changes (though usually set once)

  const validateEventAttendance = async (eventId: string, targetUserId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('event_participants')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', targetUserId)
        .in('status', ['confirmed', 'paid', 'valid', 'used']) // Only valid tickets (including used)
        .single();

      if (error || !data) {
        console.warn('User not found in event participants or invalid status', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error validating event attendance:', err);
      return false;
    }
  };

  const loadProfile = async (slugOrId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      let userData = null;
      
      // Try to fetch by slug first
      userData = await userService.getUserByUsername(slugOrId);
      
      // Fallback: try to fetch by ID if it looks like a UUID (for backward compatibility)
      if (!userData && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)) {
        userData = await userService.getUserById(slugOrId);
      }
      
      if (!userData) {
        setError('Perfil não encontrado');
        return;
      }

      // Check if profile allows view
      if (userData.allow_profile_view === false) {
        setError('Este perfil não está público');
        return;
      }
      
      // If we have an event context, validate that the user is actually attending that event
      if (eventContext) {
        const isAttending = await validateEventAttendance(eventContext.id, userData.id);
        if (!isAttending) {
          setError('Participante não encontrado neste evento');
          return;
        }
      }

      setProfile({
        id: userData.id,
        name: userData.full_name || 'Usuário',
        photo: userData.avatar_url,
        bio: userData.bio,
        city: userData.city,
        // ... map other fields from userData to PublicUser interface
        age: calculateAge(userData.birth_date),
        height: userData.height || null,
        relationship_status: userData.relationship_status || null,
        match_intention: userData.match_intention,
        sexuality: userData.sexuality || null,
        gender_preference: userData.match_gender_preference,
        vibes: null, // Assuming vibes are stored somewhere else or not available in Profile type yet
        looking_for: userData.looking_for || null,
        is_online: false, // Need to implement presence check if needed
        last_seen: userData.last_seen || null,
        match_enabled: userData.match_enabled ?? true,
        show_initials_only: userData.show_initials_only ?? false,
        allow_profile_view: userData.allow_profile_view ?? true,
        privacy_settings: userData.privacy_settings
      });

    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleGoBack = () => {
    // If we have history, go back
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      // Fallback to home or events
      navigate('/');
    }
  };

  const handleLike = async () => {
    if (!profile || !currentUser) return;
    
    if (!eventContext) {
      toast.error('É necessário acessar através de um evento para dar match');
      return;
    }

    try {
      await likeService.likeUser(eventContext.id, profile.id);
      toast.success(`Você curtiu ${profile.name}!`);
      // Optional: Add visual feedback or disable button
    } catch (error) {
      console.error('Error liking user:', error);
      toast.error('Erro ao curtir usuário');
    }
  };

  const handleSkip = () => {
    navigate(-1);
  };

  if (loading) return <GlobalLoader />;

  if (error || !profile) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold mb-2">Perfil Indisponível</h1>
          <p className="text-muted-foreground mb-6">{error || 'Não foi possível carregar este perfil.'}</p>
          <Button onClick={handleGoBack} variant="outline">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  // 3. Privacy Logic: Display Filters
  const displayName = profile.show_initials_only 
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile.name;
    
  // If show_initials_only is true, we might want to blur or use placeholder?
  // User prompt: "Campos ocultos NÃO deixam espaço em branco."
  // Usually initials only implies hiding identity, but photo might still be there.
  // We'll show photo if available.
  const displayPhoto = profile.photo;

  const showAge = profile.privacy_settings?.show_age !== false && profile.age !== null;
  const showHeight = profile.privacy_settings?.show_height !== false && profile.height !== null;
  const showRelationship = profile.privacy_settings?.show_relationship !== false && profile.relationship_status !== null;

  return (
    <Layout>
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Navigation Header */}
        <div className="fixed top-0 left-0 right-0 z-50 p-4 md:static md:p-0 md:pt-8 md:container md:max-w-4xl md:mx-auto pointer-events-none">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-background/50 backdrop-blur-md md:bg-transparent md:hover:bg-muted pointer-events-auto shadow-sm md:shadow-none"
            onClick={handleGoBack}
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        </div>

        <div className="container max-w-2xl mx-auto px-0 md:px-4 mt-[-60px] md:mt-0">
          {/* Main Card */}
          <div className="bg-card md:rounded-3xl overflow-hidden shadow-sm border-0 md:border border-border/50">
            {/* Image Header */}
            <div className="relative h-[50vh] md:h-[500px] w-full bg-muted">
              <img 
                src={displayPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random`} 
                alt={displayName} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background md:to-card" />
              
              {eventContext && (
                <div className="absolute top-20 left-4 right-4 flex justify-center pointer-events-none">
                  <Badge variant="secondary" className="bg-black/40 text-white backdrop-blur-md border-0 px-3 py-1 text-xs font-normal">
                    Participante em {eventContext.title}
                  </Badge>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="px-6 py-6 relative -mt-12 space-y-8">
              {/* Header Info */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                      {displayName}
                      {showAge && <span className="text-2xl font-normal text-muted-foreground">, {profile.age}</span>}
                    </h1>
                    {profile.city && (
                      <div className="flex items-center text-muted-foreground mt-1">
                        <MapPin className="w-4 h-4 mr-1" />
                        {profile.city}
                      </div>
                    )}
                  </div>
                  {profile.is_online && (
                    <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                      Online
                    </Badge>
                  )}
                </div>

                {/* Badges Row */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {showHeight && (
                    <Badge variant="outline" className="bg-muted/50">
                      <Ruler className="w-3 h-3 mr-1" />
                      {profile.height}m
                    </Badge>
                  )}
                  {showRelationship && (
                    <Badge variant="outline" className="bg-muted/50">
                      <Heart className="w-3 h-3 mr-1" />
                      {profile.relationship_status}
                    </Badge>
                  )}
                  {profile.match_intention && (
                    <Badge variant="outline" className="bg-muted/50">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {profile.match_intention}
                    </Badge>
                  )}
                  {profile.sexuality && (
                    <Badge variant="outline" className="bg-muted/50">
                      🏳️‍🌈 {profile.sexuality}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sobre</h3>
                  <p className="text-base leading-relaxed text-foreground/90">
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Looking For */}
              {profile.looking_for && profile.looking_for.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Procurando por</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.looking_for.map((item, index) => (
                      <Badge key={index} variant="secondary" className="bg-primary/5 hover:bg-primary/10 text-primary border-primary/10">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Vibes */}
              {profile.vibes && profile.vibes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Vibe</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.vibes.map((vibe, index) => (
                      <Badge key={index} variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                        {vibe}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer - Floating on Mobile */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border/50 md:static md:bg-transparent md:border-0 md:p-0 md:pt-8 z-40">
                <div className="container max-w-md mx-auto flex gap-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12 rounded-full text-lg border-muted-foreground/20 hover:bg-muted"
                    onClick={handleSkip}
                  >
                    <X className="w-5 h-5 mr-2" />
                    Pular
                  </Button>
                  
                  {profile.match_enabled && eventContext && (
                    <Button 
                      className="flex-1 h-12 rounded-full text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                      onClick={handleLike}
                    >
                      <Heart className="w-5 h-5 mr-2 fill-current" />
                      Curtir
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}