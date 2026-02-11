import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, Camera, Key, FileText, AlertTriangle, LayoutDashboard, Ticket, User as UserIcon, Heart } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { supabase } from "@/lib/supabase";
import { storageService } from "@/services/storage.service";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageCropUploader } from "@/components/ImageCropUploader";
import { eventService } from "@/services/event.service";
import { Event, ROUTE_PATHS } from "@/lib/index";
import { toast } from "sonner";

export default function Profile() {
  const { profile, isAuthenticated, isAdmin, updateProfile, user, isEmailConfirmed } = useAuth();
  const { checkAccess } = useFeatureAccess();
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
    username: '', // Added username
    bio: '',
    city: '',
    avatar_url: '',
    birth_date: '',
    sexuality: '',
    height: '',
    relationship_status: '',
    match_intention: '',
    match_gender_preference: '',
  });

  // Privacy States
  const [showInitialsOnly, setShowInitialsOnly] = useState(false);
  const [matchEnabled, setMatchEnabled] = useState(false);
  
  // Image Upload State - Removed manual file state as ImageCropUploader handles it
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
        username: profile.username || '',
        bio: profile.bio || '',
        city: profile.city || '',
        avatar_url: profile.avatar_url || '',
        birth_date: profile.birth_date || '',
        sexuality: profile.sexuality || '',
        height: profile.height ? profile.height.toString() : '',
        relationship_status: profile.relationship_status || '',
        match_intention: profile.match_intention || '',
        match_gender_preference: profile.match_gender_preference || '',
      });
      
      setShowInitialsOnly(profile.show_initials_only || false);
      setMatchEnabled(profile.match_enabled || false);
    }
  }, [profile]);

  if (!isAuthenticated || !profile) {
    return null;
  }

  const handleSave = async () => {
    if (!checkAccess('salvar alterações do perfil')) return;

    try {
      setIsUploading(true);
      
      const updates = {
        ...formData,
        username: formData.username.toLowerCase().trim(),
        birth_date: formData.birth_date === '' ? null : formData.birth_date,
        show_initials_only: showInitialsOnly,
        height: formData.height ? parseFloat(formData.height) : null,
      };

      await updateProfile(updates);
      toast.success('Perfil atualizado com sucesso!');
      setIsEditing(false);
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      
      // Tratamento específico para erro de unicidade de username
      if (err?.code === '23505' || err?.message?.includes('profiles_username_key')) {
        toast.error('Este nome de usuário já está em uso. Por favor, escolha outro.');
      } else {
        toast.error('Erro ao atualizar perfil');
      }
    } finally {
      setIsUploading(false);
    }
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
  const handleToggleMatchEnabled = async (checked: boolean) => {
    try {
      setMatchEnabled(checked);
      await updateProfile({ match_enabled: checked });
      toast.success(checked ? 'Você agora participa do sistema de Matches!' : 'Participação em Matches desativada.');
    } catch (err) {
      setMatchEnabled(!checked);
      toast.error('Erro ao atualizar status de match');
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
      <div className="container max-w-4xl mx-auto px-4 py-8 md:py-12 pb-24 md:pb-12">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 md:gap-0">
          <h1 className="text-3xl md:text-4xl font-bold">Meu Perfil</h1>
          <div className="flex flex-wrap justify-center gap-2">
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
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative group flex justify-center">
                  {isEditing ? (
                    <ImageCropUploader
                      type="profile"
                      value={formData.avatar_url}
                      onChange={(url) => setFormData(prev => ({ ...prev, avatar_url: url }))}
                      className="cursor-pointer"
                    >
                      <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                        <AvatarImage src={formData.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="text-4xl">
                          {getInitials(formData.full_name)}
                        </AvatarFallback>
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                           <Camera className="text-white w-8 h-8" />
                        </div>
                      </Avatar>
                    </ImageCropUploader>
                  ) : (
                    <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                      <AvatarImage src={formData.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback className="text-4xl">
                        {getInitials(formData.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                
                <div className="space-y-2 w-full">
                  <CardTitle className="flex flex-col md:flex-row items-center justify-center gap-2 text-2xl md:text-3xl text-center px-2">
                    <span className="break-words max-w-full">{formData.full_name || 'Usuário'}</span>
                    {isAdmin && (
                      <Badge variant="destructive" className="shrink-0 mt-1 md:mt-0">Admin</Badge>
                    )}
                  </CardTitle>
                  
                  <div className="flex flex-wrap items-center justify-center gap-2 text-muted-foreground">
                     <span>{profile.email}</span>
                     {isEmailConfirmed ? (
                       <Badge variant="outline" className="text-xs font-normal bg-green-500/10 text-green-500 border-green-500/20">Verificado</Badge>
                     ) : (
                       <Badge variant="outline" className="text-xs font-normal bg-amber-500/10 text-amber-500 border-amber-500/20">Pendente</Badge>
                     )}
                  </div>
                </div>

                <Button 
                  variant={isEditing ? "default" : "outline"}
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={isUploading}
                  className="min-w-[200px]"
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
                    <Label htmlFor="username">Nome de Usuário (Slug)</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => {
                        // Enforce lowercase and allowed characters immediately if desired, 
                        // or just let user type and validate on save. 
                        // Let's allow typing but show error if invalid on save.
                        // Or better: normalize as they type to prevent invalid chars
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                        setFormData({ ...formData, username: val });
                      }}
                      placeholder="nome-de-usuario"
                    />
                    <p className="text-xs text-muted-foreground">
                      Usado na sua URL de perfil público. Apenas letras minúsculas, números e hífens.
                    </p>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="height">Altura (m)</Label>
                      <Input
                        id="height"
                        type="number"
                        step="0.01"
                        value={formData.height}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        placeholder="Ex: 1.75"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sexuality">Sexualidade</Label>
                      <Select 
                        value={formData.sexuality} 
                        onValueChange={(value) => setFormData({ ...formData, sexuality: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="heterossexual">Heterossexual</SelectItem>
                          <SelectItem value="gay">Gay</SelectItem>
                          <SelectItem value="lesbica">Lésbica</SelectItem>
                          <SelectItem value="bissexual">Bissexual</SelectItem>
                          <SelectItem value="pansexual">Pansexual</SelectItem>
                          <SelectItem value="assexual">Assexual</SelectItem>
                          <SelectItem value="queer">Queer</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="relationship_status">Status de Relacionamento</Label>
                      <Select 
                        value={formData.relationship_status} 
                        onValueChange={(value) => setFormData({ ...formData, relationship_status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="namorando">Namorando</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                          <SelectItem value="enrolado">Enrolado(a)</SelectItem>
                          <SelectItem value="relacionamento_aberto">Relacionamento Aberto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="match_intention">Intenção no App</Label>
                      <Select 
                        value={formData.match_intention} 
                        onValueChange={(value) => setFormData({ ...formData, match_intention: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paquera">Paquera / Date</SelectItem>
                          <SelectItem value="amizade">Amizade</SelectItem>
                          <SelectItem value="networking">Networking</SelectItem>
                          <SelectItem value="casual">Algo Casual</SelectItem>
                          <SelectItem value="serio">Relacionamento Sério</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="match_gender_preference">Interesse em</Label>
                      <Select 
                        value={formData.match_gender_preference} 
                        onValueChange={(value) => setFormData({ ...formData, match_gender_preference: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="homens">Homens</SelectItem>
                          <SelectItem value="mulheres">Mulheres</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Sobre</h3>
                    <p className="text-base leading-relaxed break-words">
                      {formData.bio || 'Nenhuma biografia adicionada ainda.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {formData.height && (
                      <div className="space-y-1">
                        <h3 className="font-semibold text-xs text-muted-foreground uppercase">Altura</h3>
                        <p>{formData.height}m</p>
                      </div>
                    )}
                    {formData.sexuality && (
                      <div className="space-y-1">
                        <h3 className="font-semibold text-xs text-muted-foreground uppercase">Sexualidade</h3>
                        <p className="capitalize">{formData.sexuality}</p>
                      </div>
                    )}
                    {formData.relationship_status && (
                      <div className="space-y-1">
                        <h3 className="font-semibold text-xs text-muted-foreground uppercase">Status</h3>
                        <p className="capitalize">{formData.relationship_status.replace('_', ' ')}</p>
                      </div>
                    )}
                    {formData.match_intention && (
                      <div className="space-y-1">
                        <h3 className="font-semibold text-xs text-muted-foreground uppercase">Intenção</h3>
                        <p className="capitalize">{formData.match_intention}</p>
                      </div>
                    )}
                     {formData.match_gender_preference && (
                      <div className="space-y-1">
                        <h3 className="font-semibold text-xs text-muted-foreground uppercase">Interesse em</h3>
                        <p className="capitalize">{formData.match_gender_preference}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>



          {/* Match Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Configurações de Match
              </CardTitle>
              <CardDescription>Gerencie sua visibilidade e participação no sistema de matches</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="match-enabled" className="text-base font-medium">Participar de Matches</Label>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Ative para aparecer na fila de matches dos eventos e conhecer novas pessoas.
                    Ao desativar, você não será visto por ninguém.
                  </p>
                </div>
                <Switch 
                  id="match-enabled"
                  checked={matchEnabled}
                  onCheckedChange={handleToggleMatchEnabled}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="anonymous" className="text-base font-medium">Anonimato Total</Label>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Ocultar meu nome completo mesmo com Match ativo (usar apenas iniciais)
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
