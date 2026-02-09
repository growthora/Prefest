import { useState, useEffect } from 'react';
import { eventService, type CreateEventData } from '@/services/event.service';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { Plus, Trash2, Calendar, MapPin, Image as ImageIcon, Ticket, Info, CheckCircle2, Save } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

import { CategorySelect } from './create-event/CategorySelect';
import { LocationSelect } from './create-event/LocationSelect';
import { ImageUploader } from './create-event/ImageUploader';
import { DateTimePicker } from './create-event/DateTimePicker';

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
    end_at: '',
    location: '',
    state: '',
    city: '',
    event_type: 'festive',
    image_url: '',
    category: '',
    category_id: '',
    status: 'draft',
    price: 0,
    max_participants: undefined,
  });
  
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([
    {
      name: 'Entrada Gratuita',
      description: 'Ingresso padrão',
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

  const validateForm = (isPublishing: boolean) => {
    if (!formData.title) return 'O título do evento é obrigatório.';
    if (!formData.event_date) return 'A data de início é obrigatória.';
    if (!formData.location) return 'O local específico é obrigatório.';
    if (!formData.state || !formData.city) return 'Estado e cidade são obrigatórios.';
    
    if (isPublishing) {
      if (!formData.description) return 'Adicione uma descrição para publicar.';
      if (!formData.image_url) return 'Uma imagem de capa é necessária para publicar.';
      if (!formData.category_id) return 'Selecione uma categoria para publicar.';
      
      // Validar ingressos
      if (ticketTypes.length === 0) return 'Adicione pelo menos um tipo de ingresso.';
      for (const ticket of ticketTypes) {
        if (!ticket.name || ticket.quantity_available <= 0) {
          return 'Todos os ingressos devem ter nome e quantidade válida.';
        }
      }
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'published' = 'published') => {
    e.preventDefault();
    
    const validationError = validateForm(status === 'published');
    if (validationError) {
      setError(validationError);
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!user) {
      localStorage.setItem('prefest_event_draft', JSON.stringify({ formData, ticketTypes }));
      navigate(ROUTE_PATHS.LOGIN, { state: { returnTo: ROUTE_PATHS.CREATE_EVENT, tab: 'signup' } });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const dataToSubmit = { ...formData, status };
      const event = await eventService.createEvent(dataToSubmit, user.id);
      
      // Criar tipos de ingressos
      if (ticketTypes.length > 0) {
        await eventService.createTicketTypes(event.id, ticketTypes);
      }
      
      localStorage.removeItem('prefest_event_draft');

      if (status === 'published') {
        navigate('/my-events'); // Ou para a página do evento criado
      } else {
        // Se for rascunho, talvez apenas mostrar toast
        navigate('/my-events');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar evento');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CreateEventData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    if (ticketTypes.length > 0) {
      setTicketTypes(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10">
      <div className="container max-w-4xl mx-auto space-y-8 px-4">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Criar Novo Evento</h1>
            <p className="text-muted-foreground mt-1">Preencha os dados abaixo para divulgar seu evento.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button 
              variant="outline" 
              onClick={(e) => handleSubmit(e, 'draft')}
              disabled={isLoading}
              className="flex-1 md:flex-none"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Rascunho
            </Button>
            <Button 
              onClick={(e) => handleSubmit(e, 'published')}
              disabled={isLoading}
              className="flex-1 md:flex-none"
            >
              {isLoading ? <span className="animate-spin mr-2">⏳</span> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Publicar Evento
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Coluna Principal (Esquerda) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Informações Básicas */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Info className="w-5 h-5 text-primary" />
                  Informações Básicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Nome do Evento *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="Ex: Festival de Jazz 2024"
                    className="text-lg font-medium"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <CategorySelect
                    value={formData.category_id || ''}
                    onChange={(id, name) => {
                      handleChange('category_id', id);
                      handleChange('category', name);
                    }}
                    error={!formData.category_id && error ? 'Selecione uma categoria' : undefined}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição do Evento</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Conte todos os detalhes do seu evento..."
                    rows={6}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 2. Ingressos */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Ticket className="w-5 h-5 text-primary" />
                  Ingressos
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addTicketType}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {ticketTypes.map((ticket, index) => (
                  <div key={index} className="relative bg-gray-50 p-4 rounded-lg border border-gray-100 group">
                     {ticketTypes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                        onClick={() => removeTicketType(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label>Nome do Ingresso</Label>
                        <Input
                          value={ticket.name}
                          onChange={(e) => handleTicketChange(index, 'name', e.target.value)}
                          placeholder="Ex: Pista, VIP"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <div className="space-y-2">
                          <Label>Preço (R$)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ticket.price}
                            onChange={(e) => handleTicketChange(index, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Qtd.</Label>
                          <Input
                            type="number"
                            min="1"
                            value={ticket.quantity_available}
                            onChange={(e) => handleTicketChange(index, 'quantity_available', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>

          {/* Coluna Lateral (Direita) */}
          <div className="space-y-6">
            
            {/* 3. Imagem de Capa */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Imagem de Capa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ImageUploader 
                  value={formData.image_url} 
                  onChange={(url) => handleChange('image_url', url)}
                  error={!formData.image_url && error ? 'Imagem obrigatória' : undefined}
                />
              </CardContent>
            </Card>

            {/* 4. Data e Hora */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                  Data e Hora
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DateTimePicker
                  label="Início"
                  value={formData.event_date}
                  onChange={(val) => handleChange('event_date', val)}
                  required
                />
                <DateTimePicker
                  label="Término"
                  value={formData.end_at || ''}
                  onChange={(val) => handleChange('end_at', val)}
                />
              </CardContent>
            </Card>

            {/* 5. Localização */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5 text-primary" />
                  Localização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <LocationSelect
                  state={formData.state || ''}
                  city={formData.city || ''}
                  onStateChange={(val) => handleChange('state', val)}
                  onCityChange={(val) => handleChange('city', val)}
                />
                
                <div className="space-y-2">
                  <Label>Local Específico / Endereço</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    placeholder="Nome do local, Rua, Nº"
                  />
                </div>
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
    </div>
  );
};
