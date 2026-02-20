import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useNavigate } from 'react-router-dom';
import { couponService, type Coupon } from '@/services/coupon.service';
import { eventService, type Event } from '@/services/event.service';
import { userService, type UserWithStats, type CreateUserData, type UpdateUserData } from '@/services/user.service';
import { storageService } from '@/services/storage.service';
import { eventRequestService, type EventRequest } from '@/services/event-request.service';
import type { Profile } from '@/services/auth.service';
import { ImageCropUploader } from '@/components/ImageCropUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Trash2, Calendar, Users, TrendingUp, DollarSign, Percent, Upload, Plus } from 'lucide-react';
import { toast } from 'sonner';

export const AdminPanel = () => {
  const { isAdmin, isAuthenticated, user } = useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [pendingOrganizers, setPendingOrganizers] = useState<Profile[]>([]);
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_date: '',
    location: '',
    state: '',
    city: '',
    event_type: 'festive' as 'festive' | 'formal',
    image_url: '',
    category: '',
    price: 0,
    max_participants: undefined as number | undefined,
  });
  
  const [ticketTypes, setTicketTypes] = useState<Array<{
    name: string;
    description: string;
    price: number;
    quantity_available: number;
    sale_start_date?: string;
    sale_end_date?: string;
  }>>([
    {
      name: '1º Lote',
      description: 'Ingresso promocional do primeiro lote',
      price: 0,
      quantity_available: 100,
    }
  ]);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    max_uses: undefined as number | undefined,
    valid_until: '',
  });

  const [newUser, setNewUser] = useState<CreateUserData>({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
  });

  const [userUpdate, setUserUpdate] = useState<UpdateUserData>({});
  // Image handling is now done via ImageCropUploader which returns the URL directly

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (!isAdmin) {
      navigate('/');
      return;
    }

    loadData();
  }, [isAuthenticated, isAdmin]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Carregando dados do admin...');
      
      // Carregar cada recurso individualmente para melhor debugging
      console.log('📋 Carregando cupons...');
      const couponsData = await couponService.getAllCoupons();
      console.log('✅ Cupons carregados:', couponsData.length, couponsData);
      
      console.log('📅 Carregando eventos...');
      const eventsData = await eventService.getAllEvents();
      console.log('✅ Eventos carregados:', eventsData.length);
      
      console.log('👥 Carregando usuários...');
      const usersData = await userService.getUsersWithStats();
      console.log('✅ Usuários carregados:', usersData.length);
      
      console.log('👔 Carregando organizadores pendentes...');
      const pendingOrganizersData = await userService.getPendingOrganizers();
      console.log('✅ Organizadores pendentes:', pendingOrganizersData.length);

      console.log('📊 Carregando estatísticas...');
      const statsData = await userService.getStatistics();
      console.log('✅ Estatísticas carregadas:', statsData);
      
      console.log('📨 Carregando solicitações de eventos...');
      const requestsData = await eventRequestService.getAllRequests();
      console.log('✅ Solicitações carregadas:', requestsData.length);
      
      console.log('📦 Dados carregados:', {
        cupons: couponsData.length,
        eventos: eventsData.length,
        usuarios: usersData.length,
        solicitacoes: requestsData.length,
        estatisticas: statsData
      });
      console.log('📊 Detalhes das estatísticas:', {
        totalRevenue: statsData?.totalRevenue,
        profit: statsData?.profit,
        profitMargin: statsData?.profitMargin,
        totalEvents: statsData?.totalEvents,
        totalUsers: statsData?.totalUsers,
        eventStats: statsData?.eventStats
      });
      console.log('🎫 Detalhes dos cupons:', couponsData);
      setCoupons(couponsData);
      setEvents(eventsData);
      setUsers(usersData);
      setPendingOrganizers(pendingOrganizersData);
      setEventRequests(requestsData);
      setStatistics(statsData);
    } catch (err) {
      console.error('❌ Erro ao carregar dados:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);
      
      await couponService.createCoupon({
        code: newCoupon.code.toUpperCase(),
        description: newCoupon.description,
        discount_type: newCoupon.discount_type,
        discount_value: newCoupon.discount_value,
        max_uses: newCoupon.max_uses,
        valid_until: newCoupon.valid_until || undefined,
      }, user.id);

      // Resetar formulário
      setNewCoupon({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 0,
        max_uses: undefined,
        valid_until: '',
      });

      await loadData();
      toast.success('Cupom criado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar cupom');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCoupon = async (couponId: string, currentStatus: boolean) => {
    try {
      setIsLoading(true);
      await couponService.toggleCouponStatus(couponId, !currentStatus);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar cupom');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!await confirm({
      title: 'Deletar Cupom',
      description: 'Tem certeza que deseja deletar este cupom? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      confirmText: 'Deletar',
    })) return;

    try {
      setIsLoading(true);
      await couponService.deleteCoupon(couponId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar cupom');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsEditDialogOpen(true);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      setIsLoading(true);
      
      await eventService.updateEvent(editingEvent.id, {
        title: editingEvent.title,
        description: editingEvent.description,
        event_date: editingEvent.event_date,
        location: editingEvent.location,
        image_url: editingEvent.image_url,
        category: editingEvent.category,
        price: editingEvent.price,
        max_participants: editingEvent.max_participants,
      });
      
      toast.success('Evento atualizado com sucesso!');
      setIsEditDialogOpen(false);
      setEditingEvent(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar evento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!await confirm({
      title: 'Deletar Evento',
      description: 'Tem certeza que deseja deletar este evento? Esta ação não pode ser desfeita e a imagem será removida.',
      variant: 'destructive',
      confirmText: 'Deletar',
    })) return;

    try {
      setIsLoading(true);
      await eventService.deleteEvent(eventId);
      toast.success('Evento deletado com sucesso! Imagem também foi removida.');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar evento');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== FUNÇÕES DE GERENCIAMENTO DE USUÁRIOS ==========

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      await userService.createUser(newUser);
      toast.success('Usuário criado com sucesso!');
      setIsCreateUserDialogOpen(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
      });
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsLoading(true);
      await userService.updateUser(editingUser.id, userUpdate);
      toast.success('Usuário atualizado com sucesso!');
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      setUserUpdate({});
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!await confirm({
      title: 'Deletar Usuário',
      description: 'Tem certeza que deseja deletar este usuário? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      confirmText: 'Deletar',
    })) return;

    try {
      setIsLoading(true);
      await userService.deleteUser(userId);
      toast.success('Usuário deletado com sucesso!');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveOrganizer = async (userId: string) => {
    try {
      setIsLoading(true);
      await userService.updateOrganizerStatus(userId, 'APPROVED');
      toast.success('Organizador aprovado com sucesso!');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar organizador');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectOrganizer = async (userId: string) => {
    if (!await confirm({
      title: 'Rejeitar Organizador',
      description: 'Tem certeza que deseja rejeitar este organizador?',
      variant: 'destructive',
      confirmText: 'Rejeitar',
    })) return;

    try {
      setIsLoading(true);
      await userService.updateOrganizerStatus(userId, 'REJECTED');
      toast.success('Organizador rejeitado com sucesso!');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar organizador');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditUserDialog = (user: Profile) => {
    setEditingUser(user);
    setUserUpdate({
      full_name: user.full_name || '',
      bio: user.bio || '',
      avatar_url: user.avatar_url || '',
      role: user.role,
      single_mode: user.single_mode,
      show_initials_only: user.show_initials_only,
    });
    setIsEditUserDialogOpen(true);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validar tipos de ingressos
    if (ticketTypes.length === 0) {
      toast.error('Adicione pelo menos um tipo de ingresso');
      return;
    }

    for (const ticket of ticketTypes) {
      if (!ticket.name || ticket.price < 0 || ticket.quantity_available <= 0) {
        toast.error('Todos os tipos de ingressos devem ter nome, preço válido e quantidade disponível');
        return;
      }
    }

    try {
      setIsLoading(true);

      const event = await eventService.createEvent({
        title: newEvent.title,
        description: newEvent.description,
        event_date: newEvent.event_date,
        location: newEvent.location,
        state: newEvent.state,
        city: newEvent.city,
        image_url: newEvent.image_url,
        category: newEvent.category,
        price: newEvent.price,
        max_participants: newEvent.max_participants,
      }, user.id);
      
      // Criar tipos de ingressos
      await eventService.createTicketTypes(event.id, ticketTypes);
      
      toast.success('Evento criado com sucesso!');
      setIsCreateDialogOpen(false);
      setNewEvent({
        title: '',
        description: '',
        event_date: '',
        location: '',
        state: '',
        city: '',
        image_url: '',
        category: '',
        price: 0,
        max_participants: undefined,
      });
      setTicketTypes([
        {
          name: '1º Lote',
          description: 'Ingresso promocional do primeiro lote',
          price: 0,
          quantity_available: 100,
        }
      ]);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar evento');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie eventos, cupons e mais</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          className="gap-2"
        >
          ← Voltar para o Site
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="coupons" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="coupons">Cupons</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="organizers">Organizadores</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        {/* Tab de Cupons */}
        <TabsContent value="coupons" className="space-y-6">
          {/* Criar Novo Cupom */}
          <Card>
            <CardHeader>
              <CardTitle>Criar Novo Cupom</CardTitle>
              <CardDescription>Adicione cupons de desconto para os eventos</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código *</Label>
                    <Input
                      id="code"
                      value={newCoupon.code}
                      onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                      placeholder="DESCONTO10"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_type">Tipo de Desconto *</Label>
                    <Select
                      value={newCoupon.discount_type}
                      onValueChange={(value: 'percentage' | 'fixed') => 
                        setNewCoupon({ ...newCoupon, discount_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_value">Valor do Desconto *</Label>
                    <Input
                      id="discount_value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newCoupon.discount_value}
                      onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: parseFloat(e.target.value) })}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_uses">Máximo de Usos</Label>
                    <Input
                      id="max_uses"
                      type="number"
                      min="1"
                      value={newCoupon.max_uses || ''}
                      onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Ilimitado"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valid_until">Válido Até</Label>
                    <Input
                      id="valid_until"
                      type="datetime-local"
                      value={newCoupon.valid_until}
                      onChange={(e) => setNewCoupon({ ...newCoupon, valid_until: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={newCoupon.description}
                      onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                      placeholder="Descrição do cupom"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Criando...' : 'Criar Cupom'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de Cupons */}
          <Card>
            <CardHeader>
              <CardTitle>Cupons Cadastrados ({coupons.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Carregando cupons...</p>
                </div>
              ) : coupons.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum cupom cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-4">
                  {coupons.map((coupon) => (
                  <div key={coupon.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">{coupon.code}</p>
                        <Badge variant={coupon.active ? 'default' : 'secondary'}>
                          {coupon.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {coupon.discount_type === 'percentage' 
                          ? `${coupon.discount_value}% de desconto` 
                          : `R$ ${coupon.discount_value.toFixed(2)} de desconto`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Usos: {coupon.current_uses} {coupon.max_uses ? `/ ${coupon.max_uses}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleCoupon(coupon.id, coupon.active)}
                        disabled={isLoading}
                      >
                        {coupon.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        disabled={isLoading}
                      >
                        Deletar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Eventos */}
        <TabsContent value="events" className="space-y-6">
          {/* Formulário de Criação */}
          <Card>
            <CardHeader>
              <CardTitle>Criar Novo Evento</CardTitle>
              <CardDescription>Adicione um novo evento ao sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-title">Título *</Label>
                    <Input
                      id="new-title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      required
                      disabled={isLoading}
                      placeholder="Nome do evento"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-category">Categoria</Label>
                    <Input
                      id="new-category"
                      value={newEvent.category}
                      onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                      placeholder="Ex: Show, Festa, Workshop"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-description">Descrição</Label>
                  <Textarea
                    id="new-description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    rows={3}
                    disabled={isLoading}
                    placeholder="Descreva o evento..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-date">Data e Hora *</Label>
                  <Input
                    id="new-date"
                    type="datetime-local"
                    value={newEvent.event_date}
                    onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-state">Estado (UF) *</Label>
                    <Input
                      id="new-state"
                      value={newEvent.state}
                      onChange={(e) => setNewEvent({ ...newEvent, state: e.target.value.toUpperCase() })}
                      placeholder="Ex: SP"
                      maxLength={2}
                      required
                      disabled={isLoading}
                      className="uppercase"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-city">Cidade *</Label>
                    <Input
                      id="new-city"
                      value={newEvent.city}
                      onChange={(e) => setNewEvent({ ...newEvent, city: e.target.value })}
                      placeholder="Ex: São Paulo"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-location">Local Específico *</Label>
                    <Input
                      id="new-location"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      required
                      disabled={isLoading}
                      placeholder="Ex: Rua, Número"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-event-type">Tipo de Evento *</Label>
                  <Select
                    value={newEvent.event_type}
                    onValueChange={(value: 'festive' | 'formal') => 
                      setNewEvent({ ...newEvent, event_type: value })
                    }
                  >
                    <SelectTrigger id="new-event-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="festive">
                        🎉 Festivo - Match para amizade/paquera
                      </SelectItem>
                      <SelectItem value="formal">
                        💼 Formal - Networking profissional
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {newEvent.event_type === 'festive' 
                      ? 'Pessoas darão likes para fazer amigos ou paquerar' 
                      : 'Pessoas trocarão contatos para networking profissional'}
                  </p>
                </div>

                <div className="space-y-2">
                  <ImageCropUploader
                    type="event"
                    label="Imagem do Evento"
                    value={newEvent.image_url}
                    onChange={(url) => setNewEvent({ ...newEvent, image_url: url })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-price">Preço (R$) *</Label>
                    <Input
                      id="new-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newEvent.price}
                      onChange={(e) => setNewEvent({ ...newEvent, price: parseFloat(e.target.value) || 0 })}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-max">Máximo de Participantes</Label>
                    <Input
                      id="new-max"
                      type="number"
                      min="1"
                      value={newEvent.max_participants || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, max_participants: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Ilimitado"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="border-t pt-6 mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Tipos de Ingressos</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure diferentes lotes, meias-entradas e opções especiais
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTicketTypes([...ticketTypes, {
                        name: '',
                        description: '',
                        price: 0,
                        quantity_available: 100,
                      }])}
                      disabled={isLoading}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Tipo
                    </Button>
                  </div>

                  {ticketTypes.map((ticket, index) => (
                    <Card key={index} className="relative">
                      <CardContent className="pt-6 space-y-4">
                        {ticketTypes.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => setTicketTypes(ticketTypes.filter((_, i) => i !== index))}
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`ticket-name-${index}`}>
                              Nome do Ingresso *
                            </Label>
                            <Input
                              id={`ticket-name-${index}`}
                              value={ticket.name}
                              onChange={(e) => {
                                const newTickets = [...ticketTypes];
                                newTickets[index].name = e.target.value;
                                setTicketTypes(newTickets);
                              }}
                              placeholder="Ex: 1º Lote, Meia-Entrada, VIP"
                              required
                              disabled={isLoading}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`ticket-price-${index}`}>Preço (R$) *</Label>
                            <Input
                              id={`ticket-price-${index}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={ticket.price}
                              onChange={(e) => {
                                const newTickets = [...ticketTypes];
                                newTickets[index].price = parseFloat(e.target.value) || 0;
                                setTicketTypes(newTickets);
                              }}
                              required
                              disabled={isLoading}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`ticket-description-${index}`}>Descrição</Label>
                          <Textarea
                            id={`ticket-description-${index}`}
                            value={ticket.description}
                            onChange={(e) => {
                              const newTickets = [...ticketTypes];
                              newTickets[index].description = e.target.value;
                              setTicketTypes(newTickets);
                            }}
                            placeholder="Ex: Válido para estudantes com carteirinha"
                            rows={2}
                            disabled={isLoading}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`ticket-quantity-${index}`}>Quantidade Disponível *</Label>
                            <Input
                              id={`ticket-quantity-${index}`}
                              type="number"
                              min="1"
                              value={ticket.quantity_available}
                              onChange={(e) => {
                                const newTickets = [...ticketTypes];
                                newTickets[index].quantity_available = parseInt(e.target.value) || 0;
                                setTicketTypes(newTickets);
                              }}
                              required
                              disabled={isLoading}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`ticket-start-${index}`}>Início das Vendas</Label>
                            <Input
                              id={`ticket-start-${index}`}
                              type="datetime-local"
                              value={ticket.sale_start_date || ''}
                              onChange={(e) => {
                                const newTickets = [...ticketTypes];
                                newTickets[index].sale_start_date = e.target.value;
                                setTicketTypes(newTickets);
                              }}
                              disabled={isLoading}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`ticket-end-${index}`}>Fim das Vendas</Label>
                            <Input
                              id={`ticket-end-${index}`}
                              type="datetime-local"
                              value={ticket.sale_end_date || ''}
                              onChange={(e) => {
                                const newTickets = [...ticketTypes];
                                newTickets[index].sale_end_date = e.target.value;
                                setTicketTypes(newTickets);
                              }}
                              disabled={isLoading}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Criando...' : 'Criar Evento'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de Eventos */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Todos os Eventos ({events.length})</CardTitle>
                  <CardDescription>Visualize e edite todos os eventos cadastrados</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum evento cadastrado</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex gap-4">
                        {event.image_url && (
                          <img 
                            src={event.image_url} 
                            alt={event.title}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-bold text-lg">{event.title}</h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                <Calendar className="w-4 h-4" />
                                {new Intl.DateTimeFormat('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                }).format(new Date(event.event_date))}
                              </p>
                            </div>
                            <Badge>{event.category || 'Sem categoria'}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {event.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="text-sm space-x-4">
                              <span>📍 {event.location}</span>
                              <span>💰 R$ {event.price.toFixed(2)}</span>
                              <span>👥 {event.current_participants}
                                {event.max_participants && ` / ${event.max_participants}`}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditEvent(event)}
                                disabled={isLoading}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteEvent(event.id)}
                                disabled={isLoading}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Modal de Edição */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Evento</DialogTitle>
                <DialogDescription>
                  Atualize as informações do evento
                </DialogDescription>
              </DialogHeader>
              
              {editingEvent && (
                <form onSubmit={handleUpdateEvent} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Título *</Label>
                    <Input
                      id="edit-title"
                      value={editingEvent.title}
                      onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Descrição</Label>
                    <Textarea
                      id="edit-description"
                      value={editingEvent.description || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                      rows={4}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-date">Data e Hora *</Label>
                      <Input
                        id="edit-date"
                        type="datetime-local"
                        value={editingEvent.event_date ? new Date(editingEvent.event_date).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Categoria</Label>
                      <Input
                        id="edit-category"
                        value={editingEvent.category || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value })}
                        placeholder="Ex: Show, Festa, Workshop"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-location">Localização *</Label>
                    <Input
                      id="edit-location"
                      value={editingEvent.location}
                      onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <ImageCropUploader
                      type="event"
                      label="Upload de Imagem"
                      value={editingEvent.image_url}
                      onChange={(url) => setEditingEvent({ ...editingEvent, image_url: url })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-price">Preço (R$) *</Label>
                      <Input
                        id="edit-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingEvent.price}
                        onChange={(e) => setEditingEvent({ ...editingEvent, price: parseFloat(e.target.value) })}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-max">Máximo de Participantes</Label>
                      <Input
                        id="edit-max"
                        type="number"
                        min="1"
                        value={editingEvent.max_participants || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, max_participants: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Ilimitado"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditDialogOpen(false)}
                      disabled={isLoading}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Tab de Solicitações de Eventos */}
        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Solicitações de Eventos
              </CardTitle>
              <CardDescription>
                Gerencie as solicitações de criação de eventos enviadas pelos usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação pendente
                </div>
              ) : (
                <div className="space-y-4">
                  {eventRequests.map((request) => (
                    <Card key={request.id} className="border-2">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-lg">{request.event_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Solicitado em {new Date(request.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <Badge 
                            variant={
                              request.status === 'pending' ? 'default' :
                              request.status === 'contacted' ? 'secondary' :
                              request.status === 'approved' ? 'outline' : 'destructive'
                            }
                          >
                            {request.status === 'pending' ? 'Pendente' :
                             request.status === 'contacted' ? 'Contatado' :
                             request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium">Solicitante</p>
                            <p className="text-sm text-muted-foreground">{request.user_name}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className="text-sm text-muted-foreground">{request.email}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Telefone</p>
                            <p className="text-sm text-muted-foreground">{request.phone}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Cidade</p>
                            <p className="text-sm text-muted-foreground">{request.city}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm font-medium">Local do Evento</p>
                            <p className="text-sm text-muted-foreground">{request.event_location}</p>
                          </div>
                          {request.notes && (
                            <div className="col-span-2">
                              <p className="text-sm font-medium">Observações</p>
                              <p className="text-sm text-muted-foreground">{request.notes}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Select
                            value={request.status}
                            onValueChange={async (value) => {
                              try {
                                await eventRequestService.updateRequestStatus(
                                  request.id,
                                  value as EventRequest['status']
                                );
                                toast.success('Status atualizado!');
                                loadData();
                              } catch (error) {
                                toast.error('Erro ao atualizar status');
                              }
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Alterar status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="contacted">Contatado</SelectItem>
                              <SelectItem value="approved">Aprovado</SelectItem>
                              <SelectItem value="rejected">Rejeitado</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              if (confirm('Deseja realmente excluir esta solicitação?')) {
                                try {
                                  await eventRequestService.deleteRequest(request.id);
                                  toast.success('Solicitação excluída!');
                                  loadData();
                                } catch (error) {
                                  toast.error('Erro ao excluir solicitação');
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Usuários */}
          <TabsContent value="organizers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organizadores Pendentes</CardTitle>
              <CardDescription>Aprove ou rejeite solicitações de novos organizadores</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOrganizers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação pendente no momento.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingOrganizers.map((organizer) => (
                    <div key={organizer.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {organizer.avatar_url ? (
                            <img src={organizer.avatar_url} alt={organizer.full_name || ''} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <Users className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{organizer.full_name || 'Usuário sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{organizer.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">CPF: {organizer.cpf || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleRejectOrganizer(organizer.id)}
                        >
                          Rejeitar
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveOrganizer(organizer.id)}
                        >
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {/* Criar Novo Usuário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Criar Novo Usuário
              </CardTitle>
              <CardDescription>Adicione um novo usuário ao sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Adicionar Usuário</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                    <DialogDescription>Preencha os dados do novo usuário</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-user-email">Email *</Label>
                      <Input
                        id="new-user-email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-password">Senha *</Label>
                      <Input
                        id="new-user-password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-name">Nome Completo *</Label>
                      <Input
                        id="new-user-name"
                        value={newUser.full_name}
                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-role">Função</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: 'user' | 'admin' | 'equipe') =>
                          setNewUser({ ...newUser, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="equipe">Equipe</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Criando...' : 'Criar Usuário'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Lista de Usuários */}
          <Card>
            <CardHeader>
              <CardTitle>Usuários Cadastrados</CardTitle>
              <CardDescription>{users.length} usuários no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{user.full_name || 'Sem nome'}</h3>
                        <Badge variant={user.role === 'admin' ? 'default' : user.role === 'equipe' ? 'secondary' : 'outline'}>
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{user.total_events} eventos</span>
                        <span>R$ {user.total_spent.toFixed(2)} gastos</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEditUserDialog(user)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dialog de Edição de Usuário */}
          <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Usuário</DialogTitle>
                <DialogDescription>Atualize os dados do usuário</DialogDescription>
              </DialogHeader>
              {editingUser && (
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email (não editável)</Label>
                    <Input value={editingUser.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-name">Nome Completo</Label>
                    <Input
                      id="edit-user-name"
                      value={userUpdate.full_name || ''}
                      onChange={(e) => setUserUpdate({ ...userUpdate, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-bio">Bio</Label>
                    <Textarea
                      id="edit-user-bio"
                      value={userUpdate.bio || ''}
                      onChange={(e) => setUserUpdate({ ...userUpdate, bio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-role">Função</Label>
                    <Select
                      value={userUpdate.role}
                      onValueChange={(value: 'user' | 'admin' | 'equipe') =>
                        setUserUpdate({ ...userUpdate, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="equipe">Equipe</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Atualizando...' : 'Atualizar'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Tab de Estatísticas */}
        <TabsContent value="stats" className="space-y-6">
          {/* Filtro por Evento */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedEventFilter} onValueChange={setSelectedEventFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Cards de Estatísticas Gerais */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando estatísticas...</p>
            </div>
          ) : !statistics ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma estatística disponível</p>
            </div>
          ) : selectedEventFilter === 'all' ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ {statistics.totalRevenue?.toFixed(2) || '0.00'}</div>
                  <p className="text-xs text-muted-foreground">
                    De {statistics.totalUsers || 0} usuários
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lucro Estimado</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">R$ {statistics.profit?.toFixed(2) || '0.00'}</div>
                  <p className="text-xs text-muted-foreground">
                    Custos: R$ {statistics.estimatedCosts?.toFixed(2) || '0.00'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statistics.profitMargin?.toFixed(1) || '0.0'}%</div>
                  <p className="text-xs text-muted-foreground">
                    Sobre o faturamento
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statistics.totalEvents || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Eventos cadastrados
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Estatísticas por Evento */}
          {statistics && statistics.eventStats && (
            <Card>
              <CardHeader>
                <CardTitle>Faturamento por Evento</CardTitle>
                <CardDescription>Detalhamento de vendas e receita</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statistics.eventStats
                    .filter((stat: any) => selectedEventFilter === 'all' || stat.event_id === selectedEventFilter)
                    .map((stat: any) => (
                      <div key={stat.event_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-semibold">{stat.event_title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {stat.tickets_sold} ingressos vendidos
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            R$ {stat.revenue.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Preço: R$ {stat.event_price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cards de Resumo Antigos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Total de Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{users.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cupons Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {coupons.filter(c => c.active).length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total de Cupons</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{coupons.length}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
