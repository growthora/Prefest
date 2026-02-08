import { useState, useEffect } from 'react';
import { eventService, type CreateEventData } from '@/services/event.service';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export type TicketType = {
  id?: string;
  name: string;
  description: string;
  price: number;
  quantity_available: number;
  sale_start_date?: string;
  sale_end_date?: string;
};

export const CreateEventForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateEventData>({
    title: '',
    description: '',
    event_date: '',
    location: '',
    state: '',
    city: '',
    event_type: 'festive',
    image_url: '',
    category: '',
    price: 0,
    max_participants: undefined,
  });
  
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([
    {
      name: '1º Lote',
      description: 'Ingresso promocional do primeiro lote',
      price: 0,
      quantity_available: 100,
    }
  ]);

  // Carregar rascunho do localStorage ao montar
  useEffect(() => {
    const draft = localStorage.getItem('prefest_event_draft');
    if (draft) {
       try {
         const parsed = JSON.parse(draft);
         // Só carrega se houver dados válidos e o formulário estiver "vazio" (ou recém montado)
         if (parsed.formData) {
            setFormData(prev => ({ ...prev, ...parsed.formData }));
         }
         if (parsed.ticketTypes) {
            setTicketTypes(parsed.ticketTypes);
         }
       } catch (e) {
         console.error('Erro ao carregar rascunho', e);
       }
    }
  }, []);

  // Salvar rascunho automaticamente
  useEffect(() => {
    const draft = { formData, ticketTypes };
    localStorage.setItem('prefest_event_draft', JSON.stringify(draft));
  }, [formData, ticketTypes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      // Salvar rascunho e redirecionar para cadastro/login
      localStorage.setItem('prefest_event_draft', JSON.stringify({ formData, ticketTypes }));
      navigate(ROUTE_PATHS.LOGIN, { state: { returnTo: ROUTE_PATHS.CREATE_EVENT, tab: 'signup' } });
      return;
    }

    if (ticketTypes.length === 0) {
      setError('Adicione pelo menos um tipo de ingresso');
      return;
    }

    // Validar tipos de ingressos
    for (const ticket of ticketTypes) {
      if (!ticket.name || ticket.price < 0 || ticket.quantity_available <= 0) {
        setError('Todos os tipos de ingressos devem ter nome, preço válido e quantidade disponível');
        return;
      }
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const event = await eventService.createEvent(formData, user.id);
      
      // Criar tipos de ingressos
      await eventService.createTicketTypes(event.id, ticketTypes);
      
      // Limpar rascunho
      localStorage.removeItem('prefest_event_draft');

      // Redirecionar
      if (location.state?.returnTo) {
        navigate(location.state.returnTo);
      } else {
        navigate('/my-events');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar evento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : undefined) : value
    }));
  };

  const handleTicketChange = (index: number, field: keyof TicketType, value: string | number) => {
    setTicketTypes(prev => prev.map((ticket, i) => 
      i === index ? { ...ticket, [field]: value } : ticket
    ));
  };

  const addTicketType = () => {
    setTicketTypes(prev => [...prev, {
      name: '',
      description: '',
      price: 0,
      quantity_available: 100,
    }]);
  };

  const removeTicketType = (index: number) => {
    if (ticketTypes.length > 1) {
      setTicketTypes(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Evento</CardTitle>
          <CardDescription>
            Preencha os detalhes do seu evento
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Título do Evento *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                disabled={isLoading}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_date">Data e Hora *</Label>
              <Input
                id="event_date"
                name="event_date"
                type="datetime-local"
                value={formData.event_date}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">Estado (UF) *</Label>
                <Input
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Ex: SP"
                  maxLength={2}
                  required
                  disabled={isLoading}
                  className="uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Ex: São Paulo"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Local Específico *</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Ex: Rua, Número"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type">Tipo de Evento *</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value: 'festive' | 'formal') => 
                  setFormData(prev => ({ ...prev, event_type: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
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
                {formData.event_type === 'festive' 
                  ? 'Pessoas darão likes para fazer amigos ou paquerar' 
                  : 'Pessoas trocarão contatos para networking profissional'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">URL da Imagem</Label>
              <Input
                id="image_url"
                name="image_url"
                type="url"
                value={formData.image_url}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_participants">Máx. Participantes</Label>
                <Input
                  id="max_participants"
                  name="max_participants"
                  type="number"
                  min="1"
                  value={formData.max_participants || ''}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
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
                  onClick={addTicketType}
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
                        onClick={() => removeTicketType(index)}
                        disabled={isLoading}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`ticket-name-${index}`}>
                          Nome do Ingresso *
                          <span className="text-xs text-muted-foreground ml-2">
                            (ex: 1º Lote, Meia-Entrada, VIP, Camarote)
                          </span>
                        </Label>
                        <Input
                          id={`ticket-name-${index}`}
                          value={ticket.name}
                          onChange={(e) => handleTicketChange(index, 'name', e.target.value)}
                          placeholder="Ex: 1º Lote - Promocional"
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
                          onChange={(e) => handleTicketChange(index, 'price', parseFloat(e.target.value) || 0)}
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
                        onChange={(e) => handleTicketChange(index, 'description', e.target.value)}
                        placeholder="Ex: Ingresso válido para estudantes com carteirinha, Acesso VIP com open bar, etc."
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
                          onChange={(e) => handleTicketChange(index, 'quantity_available', parseInt(e.target.value) || 0)}
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
                          onChange={(e) => handleTicketChange(index, 'sale_start_date', e.target.value)}
                          disabled={isLoading}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`ticket-end-${index}`}>Fim das Vendas</Label>
                        <Input
                          id={`ticket-end-${index}`}
                          type="datetime-local"
                          value={ticket.sale_end_date || ''}
                          onChange={(e) => handleTicketChange(index, 'sale_end_date', e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>

          <CardFooter className="flex gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate(-1)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Criando...' : 'Criar Evento'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
