import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { eventService, type Event } from '@/services/event.service';
import { DateTimePicker } from '../../create-event/DateTimePicker';
import { ImageUploader } from '../../create-event/ImageUploader';
import { Loader2 } from 'lucide-react';

const eventSchema = z.object({
  title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres'),
  event_date: z.string().min(1, 'A data de início é obrigatória'),
  end_at: z.string().optional(),
  location: z.string().min(3, 'O local é obrigatório'),
  city: z.string().optional(),
  state: z.string().optional(),
  price: z.coerce.number().min(0, 'O preço não pode ser negativo'),
  image_url: z.string().min(1, 'A imagem de capa é obrigatória'),
  max_participants: z.coerce.number().min(0).optional().nullable(),
});

type EventFormValues = z.infer<typeof eventSchema>;

interface EditEventModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

import { useOrganizerStatus } from '@/hooks/useOrganizerStatus';
import { ROUTE_PATHS } from '@/lib/index';
import { useNavigate } from 'react-router-dom';

export function EditEventModal({ event, isOpen, onClose, onSuccess }: EditEventModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const { asaasStatus } = useOrganizerStatus();
  const navigate = useNavigate();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      event_date: '',
      end_at: '',
      location: '',
      city: '',
      state: '',
      price: 0,
      image_url: '',
      max_participants: null,
    },
  });

  useEffect(() => {
    if (event && isOpen) {
      // Format dates for datetime-local input (YYYY-MM-DDThh:mm)
      const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        // Adjust for timezone offset to show correct local time in input
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
      };

      form.reset({
        title: event.title,
        description: event.description || '',
        event_date: formatDate(event.event_date),
        end_at: event.end_at ? formatDate(event.end_at) : '',
        location: event.location,
        city: event.city || '',
        state: event.state || '',
        price: event.price,
        image_url: event.image_url || '',
        max_participants: event.max_participants,
      });
    }
  }, [event, isOpen, form]);

  const onSubmit = async (data: EventFormValues) => {
    if (!event) return;

    if (data.price > 0 && asaasStatus !== 'approved') {
      toast({
        title: "Conta Asaas necessária",
        description: "Para definir um preço para o evento, você precisa conectar e aprovar sua conta Asaas.",
        variant: "destructive",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white text-destructive hover:bg-gray-100 border-none"
            onClick={() => {
              onClose();
              navigate(ROUTE_PATHS.ORGANIZER_PAYMENTS);
            }}
          >
            Conectar
          </Button>
        ),
      });
      return;
    }

    try {
      setIsLoading(true);
      const isPaid = data.price > 0;
      
      await eventService.updateEvent(event.id, {
        ...data,
        end_at: data.end_at || null,
        // Convert max_participants to number or null explicitly
        max_participants: data.max_participants ? Number(data.max_participants) : null,
        is_paid_event: isPaid,
        // If it was free and now is paid, we might want to enable sales if approved? 
        // Or just let the user toggle it. 
        // But we must ensure if it is paid, asaas is approved (checked above).
        // If it becomes free, sales_enabled is irrelevant or should be false?
        sales_enabled: isPaid ? event.sales_enabled : false 
      });

      toast({
        title: "Evento atualizado",
        description: "As alterações foram salvas com sucesso.",
        variant: "default",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update event:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Editar Evento</DialogTitle>
          <DialogDescription>
            Faça alterações nos detalhes do evento. Clique em salvar quando terminar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-2">
          <Form {...form}>
            <form id="edit-event-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">
              
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ImageUploader 
                        value={field.value} 
                        onChange={field.onChange}
                        error={form.formState.errors.image_url?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título do Evento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Festa de Verão" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva os detalhes do seu evento..." 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="event_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DateTimePicker
                          label="Início"
                          value={field.value}
                          onChange={field.onChange}
                          error={form.formState.errors.event_date?.message}
                          required
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DateTimePicker
                          label="Término (Opcional)"
                          value={field.value || ''}
                          onChange={field.onChange}
                          error={form.formState.errors.end_at?.message}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local (Nome do estabelecimento/endereço)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Clube Central" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input placeholder="UF" maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço Base (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_participants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lotação Máx.</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="Ilimitado" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="p-6 pt-2 border-t flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-event-form" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
