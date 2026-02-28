import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { eventService, type Event } from '@/services/event.service';
import { ImageCropUploader } from '@/components/ImageCropUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Trash2, Calendar, Plus, Search, MapPin, DollarSign, Users } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1
  }
};

export default function AdminEvents() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

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

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const data = await eventService.getAllEvents();
      setEvents(data);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Erro ao carregar eventos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
        event_type: 'festive',
      });
      setTicketTypes([{
        name: '1º Lote',
        description: 'Ingresso promocional do primeiro lote',
        price: 0,
        quantity_available: 100,
      }]);
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar evento');
    } finally {
      setIsLoading(false);
    }
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
      await loadEvents();
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
      toast.success('Evento deletado com sucesso!');
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar evento');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.category && event.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <motion.div 
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Eventos</h1>
          <p className="text-muted-foreground mt-1">
            Visualize, crie e gerencie todos os eventos da plataforma.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground ml-2" />
        <Input
          placeholder="Buscar eventos por nome, local ou categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhum evento encontrado</h3>
          <p className="text-muted-foreground mt-2">
            {searchTerm ? 'Tente buscar com outros termos.' : 'Comece criando seu primeiro evento.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredEvents.map((event) => (
              <motion.div key={event.id} variants={itemVariants} layout>
                <Card className="h-full flex flex-col overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50">
                  <div className="relative h-48 w-full bg-muted overflow-hidden group">
                    {event.image_url ? (
                      <img 
                        src={event.image_url} 
                        alt={event.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary">
                        <Calendar className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
                        onClick={() => {
                          setEditingEvent(event);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Badge className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-foreground hover:bg-background/90">
                      {event.category || 'Geral'}
                    </Badge>
                  </div>
                  
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="line-clamp-1 text-lg">{event.title}</CardTitle>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(event.event_date))}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 pb-4">
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                      {event.description}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span>{event.price > 0 ? `R$ ${event.price.toFixed(2)}` : 'Grátis'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span>
                          {event.current_participants || 0} confirmados
                          {event.max_participants ? ` / ${event.max_participants}` : ''}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Dialog Criar Evento */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Evento</DialogTitle>
            <DialogDescription>Preencha os detalhes para criar um novo evento na plataforma.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateEvent} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-title">Título *</Label>
                <Input
                  id="new-title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  required
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
                placeholder="Descreva o evento..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-date">Data e Hora *</Label>
                <Input
                  id="new-date"
                  type="datetime-local"
                  value={newEvent.event_date}
                  onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                  required
                />
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
                    <SelectItem value="festive">🎉 Festivo</SelectItem>
                    <SelectItem value="formal">💼 Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-location">Endereço *</Label>
                <Input
                  id="new-location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  required
                  placeholder="Rua, Número"
                />
              </div>
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
                <Label htmlFor="new-price">Preço Inicial (R$) *</Label>
                <Input
                  id="new-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newEvent.price}
                  onChange={(e) => setNewEvent({ ...newEvent, price: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-max">Capacidade Máxima</Label>
                <Input
                  id="new-max"
                  type="number"
                  min="1"
                  value={newEvent.max_participants || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, max_participants: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Ilimitado"
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Tipos de Ingressos</h3>
                  <p className="text-sm text-muted-foreground">Gerencie os lotes e categorias de ingresso</p>
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
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-4">
                {ticketTypes.map((ticket, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-muted/30 relative">
                    {ticketTypes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-destructive hover:text-destructive"
                        onClick={() => setTicketTypes(ticketTypes.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={ticket.name}
                          onChange={(e) => {
                            const newTickets = [...ticketTypes];
                            newTickets[index].name = e.target.value;
                            setTicketTypes(newTickets);
                          }}
                          placeholder="Ex: 1º Lote"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Preço (R$)</Label>
                        <Input
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          min="1"
                          value={ticket.quantity_available}
                          onChange={(e) => {
                            const newTickets = [...ticketTypes];
                            newTickets[index].quantity_available = parseInt(e.target.value) || 0;
                            setTicketTypes(newTickets);
                          }}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input
                          value={ticket.description}
                          onChange={(e) => {
                            const newTickets = [...ticketTypes];
                            newTickets[index].description = e.target.value;
                            setTicketTypes(newTickets);
                          }}
                          placeholder="Detalhes do ingresso"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Criando...' : 'Criar Evento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Evento */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
            <DialogDescription>Atualize as informações do evento.</DialogDescription>
          </DialogHeader>
          
          {editingEvent && (
            <form onSubmit={handleUpdateEvent} className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título *</Label>
                <Input
                  id="edit-title"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea
                  id="edit-description"
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Data e Hora *</Label>
                  <Input
                    id="edit-date"
                    type="datetime-local"
                    value={editingEvent.event_date ? new Date(editingEvent.event_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, event_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-category">Categoria</Label>
                  <Input
                    id="edit-category"
                    value={editingEvent.category || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value })}
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
                />
              </div>

              <div className="space-y-2">
                <ImageCropUploader
                  type="event"
                  label="Imagem do Evento"
                  value={editingEvent.image_url}
                  onChange={(url) => setEditingEvent({ ...editingEvent, image_url: url })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-max">Capacidade Máxima</Label>
                  <Input
                    id="edit-max"
                    type="number"
                    min="1"
                    value={editingEvent.max_participants || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, max_participants: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Ilimitado"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
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
    </motion.div>
  );
}
