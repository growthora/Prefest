import React, { useEffect, useMemo, useState } from 'react';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { eventService, type Event, type TicketTypeDB } from '@/services/event.service';
import { Loader2, AlertTriangle, CheckCircle2, Eye, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

type DashboardEvent = Event & {
  revenue?: number;
  ticketsSold?: number;
  totalTicketsConfigured?: number;
};

type ModalMode = 'view' | 'edit';
type UiStatus = 'ativo' | 'esgotado' | 'realizado';
type SaveState = 'idle' | 'loading' | 'success' | 'error';

const formSchema = z
  .object({
    title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres.'),
    description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
    event_date: z.string().min(1, 'A data de início é obrigatória.'),
    end_at: z.string().optional(),
    location: z.string().min(3, 'O local é obrigatório.'),
    city: z.string().optional(),
    state: z.string().optional(),
    image_url: z.string().min(1, 'A imagem de capa é obrigatória.'),
    price: z.coerce.number().min(0, 'O preço não pode ser negativo.'),
    max_participants: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
    ui_status: z.enum(['ativo', 'esgotado', 'realizado']),
    sales_enabled: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.end_at && value.event_date) {
      const start = new Date(value.event_date);
      const end = new Date(value.end_at);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['end_at'],
          message: 'A data de término deve ser maior que a data de início.',
        });
      }
    }
  });

type FormState = z.infer<typeof formSchema>;

function toInputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromEventToUiStatus(event: DashboardEvent): UiStatus {
  if (event.status === 'realizado') return 'realizado';
  if (event.is_paid_event && !event.sales_enabled) return 'esgotado';
  return 'ativo';
}

function buildFormState(event: DashboardEvent): FormState {
  return {
    title: event.title || '',
    description: event.description || '',
    event_date: toInputDate(event.event_date),
    end_at: toInputDate(event.end_at),
    location: event.location || '',
    city: event.city || '',
    state: event.state || '',
    image_url: event.image_url || '',
    price: Number(event.price) || 0,
    max_participants: event.max_participants ?? '',
    ui_status: fromEventToUiStatus(event),
    sales_enabled: !!event.sales_enabled,
  };
}

interface EventDetailsEditorModalProps {
  event: DashboardEvent | null;
  isOpen: boolean;
  mode: ModalMode;
  asaasStatus: 'pending' | 'approved' | 'rejected' | 'not_connected';
  onClose: () => void;
  onUpdated: (event: DashboardEvent) => void;
}

export function EventDetailsEditorModal({
  event,
  isOpen,
  mode,
  asaasStatus,
  onClose,
  onUpdated,
}: EventDetailsEditorModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('informacoes');
  const [currentMode, setCurrentMode] = useState<ModalMode>('view');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState | null>(null);
  const [tickets, setTickets] = useState<TicketTypeDB[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    if (!event || !isOpen) return;
    setCurrentMode(mode);
    setForm(buildFormState(event));
    setFieldErrors({});
    setSaveError(null);
    setSaveState('idle');
    setActiveTab('informacoes');
  }, [event, isOpen, mode]);

  useEffect(() => {
    const loadTickets = async () => {
      if (!event || !isOpen) return;
      try {
        setLoadingTickets(true);
        const data = await eventService.getEventTicketTypesForOrganizer(event.id);
        setTickets(data);
      } catch {
        setTickets([]);
      } finally {
        setLoadingTickets(false);
      }
    };
    loadTickets();
  }, [event, isOpen]);

  const metrics = useMemo(() => {
    if (!event) return { sold: 0, capacity: 0, available: 0, revenue: 0 };
    const sold = Number(event.ticketsSold ?? event.current_participants ?? 0);
    const capacity = Number(event.totalTicketsConfigured ?? event.max_participants ?? 0);
    const available = capacity > 0 ? Math.max(0, capacity - sold) : 0;
    const revenue = Number(event.revenue ?? 0);
    return { sold, capacity, available, revenue };
  }, [event]);

  if (!event || !form) return null;

  const readOnly = currentMode === 'view' || saveState === 'loading';

  const onFieldChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const validateForm = () => {
    setFieldErrors({});
    setSaveError(null);

    if (form.price > 0 && asaasStatus !== 'approved') {
      setSaveError('Para evento pago, a conta Asaas do organizador precisa estar aprovada.');
      return false;
    }

    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(issue => {
        const path = String(issue.path[0] || '');
        if (path && !errs[path]) errs[path] = issue.message;
      });
      setFieldErrors(errs);
      setSaveError('Corrija os campos destacados antes de salvar.');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setSaveState('error');
      return;
    }

    try {
      setSaveState('loading');
      setSaveError(null);

      const isPaid = Number(form.price) > 0;
      const mappedStatus: Event['status'] = form.ui_status === 'realizado' ? 'realizado' : 'published';
      const mappedSalesEnabled = form.ui_status === 'ativo' && isPaid && form.sales_enabled;

      const payload: Partial<Event> = {
        title: form.title,
        description: form.description,
        event_date: form.event_date,
        end_at: form.end_at || null,
        location: form.location,
        city: form.city || null,
        state: form.state || null,
        image_url: form.image_url,
        price: Number(form.price),
        max_participants: form.max_participants === '' ? null : Number(form.max_participants),
        status: mappedStatus,
        is_paid_event: isPaid,
        sales_enabled: isPaid ? mappedSalesEnabled : false,
      };

      await eventService.updateEvent(event.id, payload);

      const optimistic: DashboardEvent = {
        ...event,
        ...payload,
        updated_at: new Date().toISOString(),
      };

      onUpdated(optimistic);
      setSaveState('idle');
      toast({
        title: 'Evento atualizado',
        description: 'As alterações foram salvas com sucesso.',
      });
      onClose();
    } catch {
      setSaveState('error');
      setSaveError('Não foi possível salvar as alterações. Tente novamente.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-[1000px] h-[90dvh] p-0 gap-0 overflow-hidden"
        aria-describedby="event-editor-description"
      >
        <DialogHeader className="px-4 py-3 md:px-6 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="truncate">{event.title}</DialogTitle>
              <DialogDescription id="event-editor-description">
                {currentMode === 'view' ? 'Visualização do evento' : 'Edição do evento'} • ID: {event.id}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={currentMode === 'view' ? 'secondary' : 'default'}>
                {currentMode === 'view' ? <Eye className="h-3 w-3 mr-1" /> : <Pencil className="h-3 w-3 mr-1" />}
                {currentMode === 'view' ? 'Visualizar' : 'Editar'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="px-4 py-3 md:px-6 border-b">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="informacoes">Informações</TabsTrigger>
              <TabsTrigger value="ingressos">Ingressos</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              <TabsTrigger value="datas_status">Datas & Status</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6">
            {!!saveError && (
              <Alert className="mb-4 border-red-300 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Falha de validação</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            {saveState === 'success' && (
              <Alert className="mb-4 border-green-300 text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Salvo</AlertTitle>
                <AlertDescription>Evento atualizado com sucesso.</AlertDescription>
              </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="informacoes" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="event-title">Título</Label>
                    <Input
                      id="event-title"
                      aria-invalid={!!fieldErrors.title}
                      value={form.title}
                      onChange={(e) => onFieldChange('title', e.target.value)}
                      readOnly={readOnly}
                      autoFocus={currentMode === 'edit'}
                    />
                    {fieldErrors.title && <p className="text-xs text-red-600 mt-1">{fieldErrors.title}</p>}
                  </div>

                  <div>
                    <Label htmlFor="event-description">Descrição</Label>
                    <Textarea
                      id="event-description"
                      aria-invalid={!!fieldErrors.description}
                      className="min-h-[120px]"
                      value={form.description}
                      onChange={(e) => onFieldChange('description', e.target.value)}
                      readOnly={readOnly}
                    />
                    {fieldErrors.description && <p className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>}
                  </div>

                  <div>
                    <Label htmlFor="event-image">Imagem (URL)</Label>
                    <Input
                      id="event-image"
                      aria-invalid={!!fieldErrors.image_url}
                      value={form.image_url}
                      onChange={(e) => onFieldChange('image_url', e.target.value)}
                      readOnly={readOnly}
                    />
                    {fieldErrors.image_url && <p className="text-xs text-red-600 mt-1">{fieldErrors.image_url}</p>}
                  </div>

                  <div>
                    <Label htmlFor="event-location">Local</Label>
                    <Input
                      id="event-location"
                      aria-invalid={!!fieldErrors.location}
                      value={form.location}
                      onChange={(e) => onFieldChange('location', e.target.value)}
                      readOnly={readOnly}
                    />
                    {fieldErrors.location && <p className="text-xs text-red-600 mt-1">{fieldErrors.location}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="event-city">Cidade</Label>
                      <Input
                        id="event-city"
                        value={form.city || ''}
                        onChange={(e) => onFieldChange('city', e.target.value)}
                        readOnly={readOnly}
                      />
                    </div>
                    <div>
                      <Label htmlFor="event-state">Estado</Label>
                      <Input
                        id="event-state"
                        value={form.state || ''}
                        onChange={(e) => onFieldChange('state', e.target.value)}
                        readOnly={readOnly}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ingressos" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Vendidos</p>
                    <p className="text-lg font-semibold">{metrics.sold}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Capacidade</p>
                    <p className="text-lg font-semibold">{metrics.capacity || 'Ilimitado'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Disponíveis</p>
                    <p className="text-lg font-semibold">{metrics.capacity ? metrics.available : '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Tipos</p>
                    <p className="text-lg font-semibold">{tickets.length}</p>
                  </div>
                </div>

                <Separator />

                {loadingTickets ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando ingressos...
                  </div>
                ) : tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum tipo de ingresso encontrado para este evento.</p>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{ticket.name}</p>
                          <Badge variant={ticket.is_active ? 'default' : 'secondary'}>
                            {ticket.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Preço: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(ticket.price) || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vendidos: {ticket.quantity_sold} / {ticket.quantity_available}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="financeiro" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-price">Preço base (R$)</Label>
                    <Input
                      id="event-price"
                      type="number"
                      step="0.01"
                      min="0"
                      aria-invalid={!!fieldErrors.price}
                      value={form.price}
                      onChange={(e) => onFieldChange('price', Number(e.target.value))}
                      readOnly={readOnly}
                    />
                    {fieldErrors.price && <p className="text-xs text-red-600 mt-1">{fieldErrors.price}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Organizadores visualizam somente o valor base do ingresso.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="event-max">Capacidade máxima</Label>
                    <Input
                      id="event-max"
                      type="number"
                      min="0"
                      aria-invalid={!!fieldErrors.max_participants}
                      value={form.max_participants}
                      onChange={(e) => onFieldChange('max_participants', e.target.value)}
                      readOnly={readOnly}
                    />
                    {fieldErrors.max_participants && <p className="text-xs text-red-600 mt-1">{fieldErrors.max_participants}</p>}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Receita atual do organizador</p>
                  <p className="text-xl font-semibold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.revenue)}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="datas_status" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-start">Início</Label>
                    <Input
                      id="event-start"
                      type="datetime-local"
                      aria-invalid={!!fieldErrors.event_date}
                      value={form.event_date}
                      onChange={(e) => onFieldChange('event_date', e.target.value)}
                      readOnly={readOnly}
                    />
                    {fieldErrors.event_date && <p className="text-xs text-red-600 mt-1">{fieldErrors.event_date}</p>}
                  </div>

                  <div>
                    <Label htmlFor="event-end">Término</Label>
                    <Input
                      id="event-end"
                      type="datetime-local"
                      aria-invalid={!!fieldErrors.end_at}
                      value={form.end_at || ''}
                      onChange={(e) => onFieldChange('end_at', e.target.value)}
                      readOnly={readOnly}
                    />
                    {fieldErrors.end_at && <p className="text-xs text-red-600 mt-1">{fieldErrors.end_at}</p>}
                  </div>
                </div>

                <div>
                  <Label>Status do evento</Label>
                  <Select
                    value={form.ui_status}
                    onValueChange={(v: UiStatus) => {
                      onFieldChange('ui_status', v);
                      if (v === 'ativo') {
                        onFieldChange('sales_enabled', true);
                      } else {
                        onFieldChange('sales_enabled', false);
                      }
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger aria-label="Selecionar status do evento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="esgotado">Esgotado</SelectItem>
                      <SelectItem value="realizado">Realizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Vendas habilitadas</p>
                    <p className="text-xs text-muted-foreground">Controle rápido para eventos pagos.</p>
                  </div>
                  <Switch
                    checked={form.sales_enabled}
                    onCheckedChange={(checked) => {
                      onFieldChange('sales_enabled', checked);
                      if (form.ui_status !== 'realizado') {
                        onFieldChange('ui_status', checked ? 'ativo' : 'esgotado');
                      }
                    }}
                    disabled={readOnly || Number(form.price) <= 0}
                    aria-label="Alternar vendas habilitadas"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="px-4 py-3 md:px-6 border-t flex-row justify-between">
          <div className="flex items-center gap-2">
            {currentMode === 'view' ? (
              <Button variant="outline" onClick={() => setCurrentMode('edit')}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setCurrentMode('view')} disabled={saveState === 'loading'}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saveState === 'loading'}>
              Fechar
            </Button>
            {currentMode === 'edit' && (
              <Button onClick={handleSave} disabled={saveState === 'loading'}>
                {saveState === 'loading' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
