import { useState } from 'react';
import { eventService, type CreateEventData } from '@/services/event.service';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizerStatus } from '@/hooks/useOrganizerStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { Plus, Trash2, Calendar, MapPin, Image as ImageIcon, Ticket, Info, CheckCircle2, ChevronLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

import { CategorySelect } from './create-event/CategorySelect';
import { LocationSelect } from './create-event/LocationSelect';
import { EventGalleryManager, type EventGalleryImage } from '@/components/event/EventGalleryManager';
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
  const MIN_PAID_TICKET_PRICE = 10;
  const { user } = useAuth();
  const { asaasStatus } = useOrganizerStatus();
  const navigate = useNavigate();
  const { toast } = useToast();
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
    status: 'published',
    price: 0,
    max_participants: undefined,
  });

  const [galleryImages, setGalleryImages] = useState<EventGalleryImage[]>([]);

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([
    {
      name: 'Entrada Gratuita',
      description: 'Ingresso padrão',
      price: 0,
      quantity_available: 100,
    }
  ]);

  const validateForm = (isPublishing: boolean) => {
    if (!formData.title) return 'O título do evento é obrigatório.';
    if (!formData.event_date) return 'A data de início é obrigatória.';
    if (!formData.location) return 'O local específico é obrigatório.';
    if (!formData.state || !formData.city) return 'Estado e cidade são obrigatórios.';

    if (isPublishing) {
      if (!formData.description) return 'Adicione uma descrição para publicar.';
      if (galleryImages.length === 0) return 'Adicione entre 1 e 5 imagens para publicar.';
      if (!formData.category_id) return 'Selecione uma categoria para publicar.';

      // Validar ingressos
      if (ticketTypes.length === 0) return 'Adicione pelo menos um tipo de ingresso.';
      for (const ticket of ticketTypes) {
        if (!ticket.name || ticket.quantity_available <= 0) {
          return 'Todos os ingressos devem ter nome e quantidade válida.';
        }
        if (ticket.price > 0 && ticket.price < MIN_PAID_TICKET_PRICE) {
          return `Ingressos pagos devem ter valor mínimo de R$ ${MIN_PAID_TICKET_PRICE.toFixed(2).replace('.', ',')}.`;
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const status: 'published' = 'published';

    if (!user?.id) {
      setError('Faça login para criar um evento.');
      return;
    }

    const validationError = validateForm(status === 'published');
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const isPaid = ticketTypes.some((t) => t.price > 0);
      const coverImage = galleryImages.find((img) => img.is_cover)?.image_url || galleryImages[0]?.image_url || '';
      const dataToSubmit = {
        ...formData,
        image_url: coverImage,
        status,
        is_paid_event: isPaid,
        sales_enabled: status === 'published',
        asaas_required: true,
      };

      const event = await eventService.createEvent(dataToSubmit, user.id);

      if (ticketTypes.length > 0) {
        await eventService.createTicketTypes(event.id, ticketTypes);
      }

      await eventService.setEventImages(event.id, galleryImages);

      toast({
        title: "Evento publicado!",
        description: "Seu evento já está visível para todos.",
      });

      navigate(ROUTE_PATHS.ORGANIZER_EVENTS);
    } catch (err) {
      // console.error('? [CreateEvent] Erro ao criar evento:', err);
      const rawMessage = err instanceof Error ? err.message : (err as any)?.message || 'Erro desconhecido ao criar evento';
      const isAsaasBlockingError =
        rawMessage.includes('ORGANIZER_ASAAS_REQUIRED') ||
        rawMessage.includes('ORGANIZER_ASAAS_NOT_APPROVED') ||
        rawMessage.includes('ORGANIZER_ASAAS_INVALID_WALLET') ||
        rawMessage.includes('ORGANIZER_ASAAS_MISSING_DESTINATION_WALLET');
      const errorMessage = isAsaasBlockingError
        ? 'Para criar eventos, conecte uma subconta Asaas válida e aprovada (diferente da wallet da plataforma).'
        : rawMessage;
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Erro ao criar evento",
        description: errorMessage,
      });
      if (isAsaasBlockingError) {
        navigate(ROUTE_PATHS.ORGANIZER_PAYMENTS);
      }
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

        <div className="flex items-center">
          <Button
            variant="ghost"
            onClick={() => navigate(ROUTE_PATHS.HOME)}
            className="flex items-center gap-2 px-0 text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar para a página inicial
          </Button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Criar Novo Evento</h1>
            <p className="text-muted-foreground mt-1">Preencha os dados abaixo para divulgar seu evento.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 md:flex-none"
            >
              {isLoading ? <span className="animate-spin mr-2">?</span> : <CheckCircle2 className="w-4 h-4 mr-2" />}
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
                          <p className="text-xs text-muted-foreground">
                            Gratuito (R$ 0,00) ou mínimo R$ {MIN_PAID_TICKET_PRICE.toFixed(2).replace('.', ',')}
                          </p>
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

            {/* 3. Galeria de Imagens */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Galeria de Imagens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EventGalleryManager
                  images={galleryImages}
                  onChange={(next) => {
                    setGalleryImages(next);
                    const cover = next.find((img) => img.is_cover)?.image_url || next[0]?.image_url || '';
                    handleChange('image_url', cover);
                  }}
                  label="Galeria do evento"
                  maxImages={5}
                  uploadFolder="events"
                />
                {galleryImages.length === 0 && error && (
                  <p className="text-sm text-red-500 mt-2">Adicione pelo menos 1 imagem.</p>
                )}
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













