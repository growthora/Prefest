import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, Camera, Lock, User as UserIcon, Heart, Ruler, Users, Key, FileText, AlertTriangle, LayoutDashboard, Ticket } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { storageService } from "@/services/storage.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventGrid } from "@/components/EventCards";
import { eventService } from "@/services/event.service";
import { Event, ROUTE_PATHS } from "@/lib/index";
import { toast } from "sonner";

export default function Profile() {
  const { profile, isAuthenticated, isAdmin, updateProfile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  
  // Favorites State
  const [activeTab, setActiveTab] = useState("profile");
  const [likedEvents, setLikedEvents] = useState<Event[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // Basic Form Data
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    city: '',
    avatar_url: '',
    birth_date: '',
  });

  // Match/Privacy States
  const [matchEnabled, setMatchEnabled] = useState(false);
  const [meetAttendees, setMeetAttendees] = useState(false);
  const [showInitialsOnly, setShowInitialsOnly] = useState(false);
  
  // Match Specific Fields
  const [matchIntention, setMatchIntention] = useState<'paquera' | 'amizade'>('paquera');
  const [genderPreference, setGenderPreference] = useState<'homens' | 'mulheres' | 'todos'>('todos');
  const [sexuality, setSexuality] = useState<string>('heterossexual');
  const [relationshipStatus, setRelationshipStatus] = useState<string>('solteiro');
  const [height, setHeight] = useState<string>('');
  const [lookingFor, setLookingFor] = useState<string[]>([]);

  // Image Upload State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleLikeToggle = (eventId: string, isLiked: boolean) => {
    if (!isLiked) {
      setLikedEvents(current => current.filter(event => event.id !== eventId));
    }
  };

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Limpar o state para não persistir em reloads se não for desejado, 
      // ou manter. Para navegação via link, geralmente é bom resetar 
      // ou apenas deixar o browser lidar com history.
      // Se quisermos limpar: navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    if (activeTab === 'favorites' && user) {
      loadFavorites();
    }
  }, [activeTab, user]);

  const loadFavorites = async () => {
    if (!user) return;
    try {
      setLoadingFavorites(true);
      const events = await eventService.getUserLikedEvents(user.id);
      
      const formattedEvents: Event[] = events.map((ev: any) => ({
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        date: new Date(ev.event_date).toLocaleDateString('pt-BR'),
        time: new Date(ev.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        location: ev.location,
        address: ev.location,
        city: ev.city,
        event_type: ev.event_type,
        price: ev.price,
        image: ev.image_url || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80',
        description: ev.description,
        category: ev.category || 'Geral',
        attendeesCount: ev.current_participants || 0,
        tags: ev.category ? [ev.category] : [],
      }));

      setLikedEvents(formattedEvents);
    } catch (error) {
      console.error("Error loading favorites", error);
      toast.error("Erro ao carregar favoritos");
    } finally {
      setLoadingFavorites(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        city: profile.city || '',
        avatar_url: profile.avatar_url || '',
        birth_date: profile.birth_date || '',
      });
      
      setMatchEnabled(profile.match_enabled || false);
      setMeetAttendees(profile.meet_attendees || false);
      setShowInitialsOnly(profile.show_initials_only || false);
      
      setMatchIntention(profile.match_intention || 'paquera');
      setGenderPreference(profile.match_gender_preference || 'todos');
      setSexuality(profile.sexuality || 'heterossexual');
      setRelationshipStatus(profile.relationship_status || 'solteiro');
      setHeight(profile.height ? profile.height.toString() : '');
      setLookingFor(profile.looking_for || []);
    }
  }, [profile]);

  if (!isAuthenticated || !profile) {
    return null;
  }

  const handleSave = async () => {
    try {
      setIsUploading(true);
      let avatarUrl = formData.avatar_url;

      // Upload Image
      if (avatarFile) {
        try {
          // Upload to 'profiles' folder
          avatarUrl = await storageService.uploadImage(avatarFile, 'profiles');
          
          // Delete old image if it exists and is different (and matches our storage pattern)
          if (formData.avatar_url && formData.avatar_url !== avatarUrl && formData.avatar_url.includes('supabase')) {
            try {
              // Extract path from URL if needed, or pass URL if deleteImage handles it
              // storageService.deleteImage handles full URL logic usually
              await storageService.deleteImage(formData.avatar_url);
            } catch (deleteErr) {
              console.warn('Erro ao deletar imagem anterior:', deleteErr);
            }
          }
        } catch (uploadErr) {
          console.error('Erro ao fazer upload da imagem:', uploadErr);
          toast.error('Erro ao fazer upload da imagem');
          setIsUploading(false);
          return;
        }
      }

      const updates = {
        ...formData,
        avatar_url: avatarUrl,
        match_enabled: matchEnabled,
        meet_attendees: meetAttendees,
        show_initials_only: showInitialsOnly,
        // Match fields only if match is enabled (or we save them anyway but they are hidden)
        // Saving them anyway is better for UX if they toggle back
        match_intention: matchIntention,
        match_gender_preference: genderPreference,
        sexuality: sexuality,
        relationship_status: relationshipStatus,
        height: height ? parseFloat(height) : undefined,
        looking_for: lookingFor,
      };

      await updateProfile(updates);
      toast.success('Perfil atualizado com sucesso!');
      setIsEditing(false);
      setAvatarFile(null);
      setAvatarPreview('');
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setAvatarFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdatePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    try {
      setIsChangingPassword(true);
      
      // 1. Re-authenticate with current password to ensure ownership
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: passwordData.currentPassword,
      });

      if (signInError) {
        throw new Error("Senha atual incorreta");
      }

      // 2. Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) throw updateError;

      toast.success("Senha alterada com sucesso!");
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age.toString();
  };

  // Toggles
  const handleToggleMatch = async (checked: boolean) => {
    try {
      setMatchEnabled(checked);
      // Update immediately for better UX or wait for save?
      // User service implies immediate update for toggles in previous code
      await updateProfile({ match_enabled: checked });
      toast.success(checked ? 'Match ativado! 🔥' : 'Match desativado');
    } catch (err) {
      console.error('Erro ao atualizar Match:', err);
      toast.error('Erro ao atualizar status do Match');
      setMatchEnabled(!checked);
    }
  };

  const handleToggleInitialsOnly = async (checked: boolean) => {
    try {
      setShowInitialsOnly(checked);
      await updateProfile({ show_initials_only: checked });
      toast.success(checked ? 'Anonimato ativado' : 'Anonimato desativado');
    } catch (err) {
      setShowInitialsOnly(!checked);
    }
  };

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Meu Perfil</h1>
          <div className="flex gap-2">
            {(isAdmin || profile?.roles?.includes('ORGANIZER') || profile?.organizer_status === 'APPROVED') && (
              <Button 
                onClick={() => navigate('/dashboard/organizador')} 
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <LayoutDashboard className="w-4 h-4" />
                Painel do Organizador
              </Button>
            )}
            {isAdmin && (
              <Button onClick={() => navigate('/admin')} variant="outline" className="gap-2">
                <Shield className="w-4 h-4" />
                Admin
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="profile" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <UserIcon className="w-4 h-4" />
              Meu Perfil
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <Heart className="w-4 h-4" />
              Meus Favoritos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-0">
          {/* Card de Perfil */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                      <AvatarImage src={avatarPreview || formData.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback className="text-2xl">
                        {getInitials(formData.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <>
                        <input
                          type="file"
                          id="avatar-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                        <label
                          htmlFor="avatar-upload"
                          className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-white shadow-lg cursor-pointer hover:bg-primary/90 transition-transform hover:scale-105"
                        >
                          <Camera className="w-4 h-4" />
                        </label>
                      </>
                    )}
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      {formData.full_name || 'Usuário'}
                      {isAdmin && (
                        <Badge variant="destructive" className="ml-2">Admin</Badge>
                      )}
                    </CardTitle>
                    <div className="text-base text-muted-foreground flex items-center gap-2">
                       <span className="text-muted-foreground">{profile.email}</span>
                       <Badge variant="outline" className="text-xs font-normal">Verificado</Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant={isEditing ? "default" : "outline"}
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={isUploading}
                >
                  {isUploading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Editar Perfil'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing ? (
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        value={profile.email}
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                      <div className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        Para alterar o e-mail, entre em contato com o suporte.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Sua cidade"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Conte um pouco sobre você..."
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">Sobre</h3>
                  <p className="text-base leading-relaxed">
                    {formData.bio || 'Nenhuma biografia adicionada ainda.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurações de Privacidade e Match */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Match & Conheça a Galera
              </CardTitle>
              <CardDescription>
                Configure como você aparece para outras pessoas nos eventos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle Principal */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="match-mode" className="text-base font-semibold">Ativar Match / Conheça a Galera</Label>
                  <p className="text-sm text-muted-foreground">
                    Permite que outros participantes vejam seu perfil completo e intenções
                  </p>
                </div>
                <Switch 
                  id="match-mode" 
                  checked={matchEnabled}
                  onCheckedChange={handleToggleMatch}
                />
              </div>

              {matchEnabled ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                    <div className="flex gap-2 text-blue-700 dark:text-blue-300">
                      <Lock className="w-4 h-4 mt-0.5" />
                      <p className="text-sm">
                        Suas informações de Match só são visíveis para outros participantes que também ativaram o recurso nos eventos que você participa.
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Intenção */}
                    <div className="space-y-3">
                      <Label>O que você busca?</Label>
                      <ToggleGroup type="multiple" value={lookingFor} onValueChange={setLookingFor} className="justify-start flex-wrap">
                        <ToggleGroupItem value="amizade" variant="outline">🤝 Amizade</ToggleGroupItem>
                        <ToggleGroupItem value="paquera" variant="outline">💘 Paquera</ToggleGroupItem>
                        <ToggleGroupItem value="networking" variant="outline">💼 Networking</ToggleGroupItem>
                        <ToggleGroupItem value="festa" variant="outline">🎉 Festa</ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {/* Preferência */}
                    <div className="space-y-3">
                      <Label>Interesse em:</Label>
                      <RadioGroup value={genderPreference} onValueChange={(v: any) => setGenderPreference(v)}>
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="homens" id="pref-homens" />
                            <Label htmlFor="pref-homens">Homens</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mulheres" id="pref-mulheres" />
                            <Label htmlFor="pref-mulheres">Mulheres</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="todos" id="pref-todos" />
                            <Label htmlFor="pref-todos">Todos</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Altura */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Ruler className="w-4 h-4" /> Altura (m)
                      </Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Ex: 1.75" 
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                      />
                    </div>

                    {/* Idade (Calculada) */}
                    <div className="space-y-2">
                      <Label>Idade</Label>
                      <Input 
                        value={calculateAge(formData.birth_date) ? `${calculateAge(formData.birth_date)} anos` : 'Data de nascimento não informada'} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>

                    {/* Status de Relacionamento */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Users className="w-4 h-4" /> Status
                      </Label>
                      <Select value={relationshipStatus} onValueChange={setRelationshipStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="namorando">Namorando</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="enrolado">Enrolado(a)</SelectItem>
                          <SelectItem value="aberto">Relacionamento Aberto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sexualidade */}
                    <div className="space-y-2">
                      <Label>Sexualidade</Label>
                      <Select value={sexuality} onValueChange={setSexuality}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="heterossexual">Heterossexual</SelectItem>
                          <SelectItem value="homossexual">Homossexual</SelectItem>
                          <SelectItem value="bissexual">Bissexual</SelectItem>
                          <SelectItem value="pansexual">Pansexual</SelectItem>
                          <SelectItem value="assexual">Assexual</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Save Button for Match Fields if not in main edit mode */}
                  {!isEditing && (
                    <div className="flex justify-end pt-4">
                      <Button onClick={handleSave} disabled={isUploading}>
                        Salvar Preferências de Match
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  <p>Ative o Match para preencher seu perfil de conexão e ver quem vai aos eventos.</p>
                  <p className="text-sm mt-2">Quando desativado, você aparece como "Participante" (Anônimo).</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outras Configurações */}
          <Card>
            <CardHeader>
              <CardTitle>Outras Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="anonymous">Anonimato Total</Label>
                  <p className="text-sm text-muted-foreground">
                    Ocultar meu nome completo mesmo com Match ativo (usar iniciais)
                  </p>
                </div>
                <Switch 
                  id="anonymous"
                  checked={showInitialsOnly}
                  onCheckedChange={handleToggleInitialsOnly}
                />
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Segurança
              </CardTitle>
              <CardDescription>Gerencie sua senha e acesso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="current-password">Senha Atual</Label>
                   <Input 
                     id="current-password" 
                     type="password"
                     value={passwordData.currentPassword}
                     onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                     placeholder="Digite sua senha atual para confirmar"
                   />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="new-password">Nova Senha</Label>
                     <Input 
                       id="new-password" 
                       type="password"
                       value={passwordData.newPassword}
                       onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                       placeholder="Mínimo 6 caracteres"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                     <Input 
                       id="confirm-password" 
                       type="password"
                       value={passwordData.confirmPassword}
                       onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                       placeholder="Repita a nova senha"
                     />
                   </div>
                 </div>
                 <div className="flex justify-end">
                   <Button 
                     onClick={handleUpdatePassword} 
                     disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword}
                     variant="outline"
                   >
                     {isChangingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                   </Button>
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* Políticas e Termos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Políticas e Termos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button variant="ghost" className="justify-start h-auto py-3 px-4" onClick={() => navigate('/terms')}>
                  <div className="text-left">
                    <div className="font-semibold">Termos de Uso</div>
                    <div className="text-xs text-muted-foreground">Regras de utilização da plataforma</div>
                  </div>
                </Button>
                <Button variant="ghost" className="justify-start h-auto py-3 px-4" onClick={() => navigate('/privacy')}>
                  <div className="text-left">
                    <div className="font-semibold">Política de Privacidade</div>
                    <div className="text-xs text-muted-foreground">Como tratamos seus dados</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="favorites" className="mt-0">
            {loadingFavorites ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 {[1, 2, 3].map((i) => (
                   <div key={i} className="h-[400px] rounded-2xl bg-muted/20 animate-pulse" />
                 ))}
               </div>
            ) : likedEvents.length > 0 ? (
               <EventGrid events={likedEvents} onLikeToggle={handleLikeToggle} />
            ) : (
               <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed flex flex-col items-center">
                 <div className="bg-background p-4 rounded-full mb-4 shadow-sm">
                   <Heart className="w-8 h-8 text-primary fill-primary/20" />
                 </div>
                 <h3 className="text-xl font-semibold mb-2">Nenhum evento favorito</h3>
                 <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                   Você ainda não favoritou nenhum evento. Explore os eventos disponíveis e salve seus favoritos aqui ❤️
                 </p>
                 <Button onClick={() => navigate(ROUTE_PATHS.EXPLORE)} className="gap-2">
                   <Ticket className="w-4 h-4" />
                   Explorar Eventos
                 </Button>
               </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
