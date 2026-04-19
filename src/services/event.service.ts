import { storageService } from './storage.service';
import { invokeEdgeFunction } from './apiClient';
import type { TicketType } from '@/components/CreateEventForm';
import { generateSlug } from '@/utils/slugify';
import { differenceInYears } from 'date-fns';
import { validateEventSchedule, validateTicketSaleWindow } from '@/utils/eventDateValidation';

function toOffsetDateTime(value?: string | null) {
  if (!value) {
    return value;
  }

  if (value.includes('Z') || /[+-]\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
  const offsetMins = (Math.abs(offset) % 60).toString().padStart(2, '0');
  const offsetSign = offset >= 0 ? '+' : '-';

  return `${value}:00${offsetSign}${offsetHours}:${offsetMins}`;
}

async function getEventScheduleById(eventId: string) {
  const { data, error } = await invokeEdgeFunction<{ event: Pick<Event, 'id' | 'event_date' | 'end_at'> }>('events-api', {
    body: { op: 'events.getById', params: { id: eventId } },
  });

  if (error) throw error;
  if (!data?.event) throw new Error('Evento não encontrado');

  return {
    id: data.event.id,
    event_date: data.event.event_date,
    end_at: data.event.end_at,
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  is_active: boolean;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_date: string;
  end_at: string | null;
  location: string;
  state: string | null;
  city: string | null;
  event_type: 'festive' | 'formal';
  image_url: string | null;
  gallery_images?: string[] | null;
  category: string | null;
  category_id: string | null;
  status: 'draft' | 'published' | 'realizado';
  price: number;
  max_participants: number | null;
  current_participants: number;
  confirmed_users_count?: number | null;
  available_for_match_count?: number | null;
  creator_id?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  tickets_sold?: number | null;
  views?: number | null;
  is_published?: boolean;
  is_paid_event?: boolean;
  sales_enabled?: boolean;
  asaas_required?: boolean;
  // Display fields calculated from ticket types
  display_price_label?: string;
  display_price_value?: number;
  is_free_event?: boolean;
}

export interface EventImage {
  id: string;
  event_id: string;
  image_url: string;
  is_cover: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventScanLog {
  id: string;
  event_id?: string;
  ticket_id?: string;
  participant_id?: string;
  scanner_user_id?: string;
  scan_status?: string;
  scanned_at?: string;
  created_at?: string;
  [key: string]: any;
}

export interface TicketTypeDB {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  quantity_available: number;
  quantity_sold: number;
  is_active: boolean;
  is_test?: boolean;
  is_internal?: boolean;
  is_hidden?: boolean;
  sale_start_date: string | null;
  sale_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketTypeUpdateData {
  name?: string;
  description?: string | null;
  price?: number;
  quantity_available?: number;
  sale_start_date?: string | null;
  sale_end_date?: string | null;
  is_active?: boolean;
}

export interface TicketTypeCreateData {
  name: string;
  description?: string | null;
  price: number;
  quantity_available: number;
  sale_start_date?: string | null;
  sale_end_date?: string | null;
  is_active?: boolean;
}

// Helper to calculate display price
export const calculateEventDisplayPrice = (tickets: TicketTypeDB[]) => {
  const now = new Date();

  // Lotes ativos para exibicao publica:
  // - ativo
  // - visivel (nao interno/teste/oculto)
  // - dentro da janela de venda
  // - com disponibilidade
  const activeTickets = tickets.filter((ticket) => {
    const isVisible =
      (ticket.is_active ?? true) &&
      !ticket.is_test &&
      !ticket.is_internal &&
      !ticket.is_hidden;

    const hasInventory =
      Number(ticket.quantity_available || 0) > Number(ticket.quantity_sold || 0);

    const saleStarted = !ticket.sale_start_date || new Date(ticket.sale_start_date) <= now;
    const saleNotEnded = !ticket.sale_end_date || new Date(ticket.sale_end_date) >= now;

    return isVisible && hasInventory && saleStarted && saleNotEnded;
  });

  if (activeTickets.length === 0) {
    return {
      display_price_label: '',
      display_price_value: undefined,
      is_free_event: false,
    };
  }

  const minPrice = Math.min(...activeTickets.map((ticket) => Number(ticket.price) || 0));

  if (minPrice > 0) {
    const formattedPrice = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(minPrice);

    return {
      display_price_label: `Ingressos a partir de ${formattedPrice}`,
      display_price_value: minPrice,
      is_free_event: false,
    };
  }

  return {
    display_price_label: 'Evento gratuito',
    display_price_value: 0,
    is_free_event: true,
  };
};

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  ticket_quantity: number;
  ticket_type_id: string | null;
  total_paid: number | null;
  joined_at: string;
  match_enabled?: boolean;
  status?: string;
  check_in_at?: string;
  security_token?: string;
  ticket_code?: string;
  qr_code_data?: string | null;
}

export interface MatchCandidate {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  age: number | null;
  height: number | null;
  relationship_status: string | null;
  match_intention: string | null;
  match_gender_preference?: string[] | null;
  gender_identity?: string | null;
  sexuality?: string | null;
  vibes: string[] | null;
  last_seen: string | null;
  is_online: boolean;
  username?: string; // Added username
}

export interface CreateEventData {
  title: string;
  description: string;
  event_date: string;
  end_at?: string;
  location: string;
  state?: string;
  city?: string;
  event_type: 'festive' | 'formal';
  image_url?: string;
  category?: string;
  category_id?: string;
  status?: 'draft' | 'published';
  price: number;
  max_participants?: number;
  is_paid_event?: boolean;
  sales_enabled?: boolean;
  asaas_required?: boolean;
}

export class EventService {
  private readonly SOLD_TICKET_STATUSES = ['paid', 'issued', 'used', 'valid', 'confirmed', 'received'];
  // Buscar todas as categorias
  async getCategories(): Promise<Category[]> {
    const { data, error } = await invokeEdgeFunction<{ categories: Category[] }>('events-api', {
      body: { op: 'categories.list' },
    });

    if (error) throw error;
    return data?.categories || [];
  }

  // Criar novo evento
  async createEvent(eventData: CreateEventData, creatorId: string): Promise<Event> {
    const scheduleError = validateEventSchedule(eventData.event_date, eventData.end_at);
    if (scheduleError) {
      throw new Error(scheduleError);
    }

    const eventDateToSave = toOffsetDateTime(eventData.event_date);
    const endAtToSave = toOffsetDateTime(eventData.end_at);
    const eventToInsert = {
      ...eventData,
      status: eventData.status || 'draft',
      event_date: eventDateToSave,
      end_at: endAtToSave,
      category_id: eventData.category_id || null,
      category: eventData.category || null,
      image_url: eventData.image_url || null,
      max_participants: eventData.max_participants || null,
      is_paid_event: eventData.is_paid_event ?? false,
      sales_enabled: eventData.sales_enabled ?? false,
      asaas_required: eventData.asaas_required ?? true,
      is_active: true,
    };

    const { data, error } = await invokeEdgeFunction<{ event: Event }>('events-api', {
      body: { op: 'events.create', params: { eventData: eventToInsert } },
    });

    if (error) throw error;
    if (!data?.event) throw new Error('Falha ao criar evento');
    return data.event;
  }

  // Criar tipos de ingressos para um evento
  async createTicketTypes(eventId: string, ticketTypes: TicketType[]): Promise<TicketTypeDB[]> {
    const eventSchedule = await getEventScheduleById(eventId);

    const ticketsToInsert = ticketTypes.map(ticket => {
      const saleWindowError = validateTicketSaleWindow(
        ticket.sale_start_date,
        ticket.sale_end_date,
        eventSchedule.event_date,
        eventSchedule.end_at,
        { requireFutureStart: true },
      );
      if (saleWindowError) {
        throw new Error(`${ticket.name || 'Lote'}: ${saleWindowError}`);
      }

      return {
      event_id: eventId,
      name: ticket.name,
      description: ticket.description || null,
      price: ticket.price,
      quantity_available: ticket.quantity_available,
      sale_start_date: toOffsetDateTime(ticket.sale_start_date) || null,
      sale_end_date: toOffsetDateTime(ticket.sale_end_date) || null,
      };
    });
    const { data, error } = await invokeEdgeFunction<{ ticket_types: TicketTypeDB[] }>('events-api', {
      body: { op: 'ticketTypes.createMany', params: { eventId, ticketTypes: ticketsToInsert } },
    });

    if (error) throw error;
    return data?.ticket_types || [];
  }

  // Buscar tipos de ingressos disponíveis para um evento
  async getEventTicketTypes(eventId: string): Promise<TicketTypeDB[]> {
    const { data, error } = await invokeEdgeFunction<{ ticket_types: TicketTypeDB[] }>('events-api', {
      body: { op: 'ticketTypes.listForEventPublic', params: { eventId } },
      requiresAuth: false,
    });

    if (error) throw error;
    return data?.ticket_types || [];
  }

  // Buscar todos os tipos de ingressos de um evento (painel organizador/admin)
  async getEventTicketTypesForOrganizer(eventId: string): Promise<TicketTypeDB[]> {
    const { data, error } = await invokeEdgeFunction<{ ticket_types: TicketTypeDB[] }>('events-api', {
      body: { op: 'ticketTypes.listForOrganizer', params: { eventId } },
    });

    if (error) throw error;
    return data?.ticket_types || [];
  }

  // Criar um tipo de ingresso (lote) para um evento
  async createTicketType(eventId: string, payload: TicketTypeCreateData): Promise<TicketTypeDB> {
    const eventSchedule = await getEventScheduleById(eventId);
    const saleWindowError = validateTicketSaleWindow(
      payload.sale_start_date,
      payload.sale_end_date,
      eventSchedule.event_date,
      eventSchedule.end_at,
      { requireFutureStart: true },
    );
    if (saleWindowError) {
      throw new Error(saleWindowError);
    }

    const dataToInsert = {
      name: payload.name,
      description: payload.description ?? null,
      price: Number(payload.price) || 0,
      quantity_available: Number(payload.quantity_available) || 0,
      sale_start_date: toOffsetDateTime(payload.sale_start_date) ?? null,
      sale_end_date: toOffsetDateTime(payload.sale_end_date) ?? null,
      is_active: payload.is_active ?? true,
    };

    const { data, error } = await invokeEdgeFunction<{ ticket_type: TicketTypeDB }>('events-api', {
      body: { op: 'ticketTypes.create', params: { eventId, payload: dataToInsert } },
    });

    if (error) throw error;
    if (!data?.ticket_type) throw new Error('Falha ao criar lote');
    return data.ticket_type;
  }

  // Atualizar um tipo de ingresso (lote)
  async updateTicketType(ticketTypeId: string, payload: TicketTypeUpdateData): Promise<TicketTypeDB> {
    const { data: existingResult, error: existingError } = await invokeEdgeFunction<{
      ticket_type: { id: string; event_id: string; quantity_sold: number | null; sale_start_date: string | null; sale_end_date: string | null };
    }>('events-api', {
      body: { op: 'ticketTypes.get', params: { ticketTypeId } },
    });

    if (existingError) throw existingError;
    if (!existingResult?.ticket_type) throw new Error('Lote não encontrado');
    const existing = existingResult.ticket_type;

    if (
      typeof payload.quantity_available === 'number' &&
      payload.quantity_available < Number(existing.quantity_sold || 0)
    ) {
      throw new Error('A quantidade do lote nao pode ser menor que o total vendido.');
    }

    const eventSchedule = await getEventScheduleById(existing.event_id);
    const nextSaleStart = payload.sale_start_date ?? existing.sale_start_date;
    const nextSaleEnd = payload.sale_end_date ?? existing.sale_end_date;
    const saleWindowError = validateTicketSaleWindow(
      nextSaleStart,
      nextSaleEnd,
      eventSchedule.event_date,
      eventSchedule.end_at,
    );
    if (saleWindowError) {
      throw new Error(saleWindowError);
    }

    const { data, error } = await invokeEdgeFunction<{ ticket_type: TicketTypeDB }>('events-api', {
      body: {
        op: 'ticketTypes.update',
        params: {
          ticketTypeId,
          payload: {
            ...payload,
            sale_start_date: payload.sale_start_date === undefined ? undefined : toOffsetDateTime(payload.sale_start_date) ?? null,
            sale_end_date: payload.sale_end_date === undefined ? undefined : toOffsetDateTime(payload.sale_end_date) ?? null,
          },
        },
      },
    });

    if (error) throw error;
    if (!data?.ticket_type) throw new Error('Falha ao atualizar lote');
    return data.ticket_type;
  }

  // Excluir um tipo de ingresso (lote)
  async deleteTicketType(ticketTypeId: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'ticketTypes.delete', params: { ticketTypeId } },
    });

    if (error) throw error;
  }

  // Listar todos os eventos
  async getAllEvents(retries = 3, includeDrafts = false): Promise<Event[]> {

    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await (includeDrafts
          ? invokeEdgeFunction<{ events: Event[] }>('events-api', {
              body: {
                op: 'events.listAll',
                params: { includeDrafts, includeInactive: includeDrafts },
              },
            })
          : invokeEdgeFunction<{ events: Event[] }>('events-api', {
              body: { op: 'events.listPublic' },
              requiresAuth: false,
            }));

        if (error) throw error;
        return data?.events || [];
      } catch (err) {
        if (i === retries - 1) {
          throw err;
        }
        // Esperar antes de tentar novamente (backoff exponencial: 1s, 2s, 3s...)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    return [];
  }

  // Listar eventos disponíveis (não lotados e futuros)
  async getAvailableEvents(): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'events.listPublic' },
      requiresAuth: false,
    });

    if (error) throw error;

    const events = data?.events || [];
    return events.filter((event) =>
      !event.max_participants || event.current_participants < event.max_participants
    );
  }

  async getPublicEventBySlug(slug: string): Promise<Event> {
    const { data, error } = await invokeEdgeFunction<{ event: Event }>('events-api', {
      body: { op: 'events.getBySlugPublic', params: { slug } },
      requiresAuth: false,
    });

    if (error) throw error;
    if (!data?.event) throw new Error('Evento não encontrado');
    return data.event;
  }

  async getPublicEventById(id: string): Promise<Event> {
    const { data, error } = await invokeEdgeFunction<{ event: Event }>('events-api', {
      body: { op: 'events.getByIdPublic', params: { id } },
      requiresAuth: false,
    });

    if (error) throw error;
    if (!data?.event) throw new Error('Evento não encontrado');
    return data.event;
  }

  // Buscar evento por Slug
  async getEventBySlug(slug: string): Promise<Event> {
    const { data, error } = await invokeEdgeFunction<{ event: Event }>('events-api', {
      body: { op: 'events.getBySlug', params: { slug } },
    });

    if (error) throw error;
    if (!data?.event) throw new Error('Evento não encontrado');
    return data.event;
  }

  // Buscar evento por ID
  async getEventById(id: string): Promise<Event> {
    const { data, error } = await invokeEdgeFunction<{ event: Event }>('events-api', {
      body: { op: 'events.getById', params: { id } },
    });

    if (error) throw error;
    if (!data?.event) throw new Error('Evento não encontrado');
    return data.event;
  }

  private normalizeEventImages(images: Array<{ image_url: string; is_cover?: boolean }>): Array<{ image_url: string; is_cover: boolean; display_order: number }> {
    const deduped = images
      .filter((img) => typeof img.image_url === 'string' && img.image_url.trim().length > 0)
      .reduce<Array<{ image_url: string; is_cover: boolean }>>((acc, img) => {
        const image_url = img.image_url.trim();
        if (acc.some((item) => item.image_url === image_url)) return acc;
        acc.push({ image_url, is_cover: !!img.is_cover });
        return acc;
      }, [])
      .slice(0, 5);

    if (deduped.length === 0) {
      throw new Error('Adicione pelo menos 1 imagem para o evento.');
    }

    const coverIndex = deduped.findIndex((img) => img.is_cover);

    return deduped.map((img, index) => ({
      image_url: img.image_url,
      is_cover: coverIndex >= 0 ? index === coverIndex : index === 0,
      display_order: index,
    }));
  }

  async getEventImages(eventId: string): Promise<EventImage[]> {
    const { data, error } = await invokeEdgeFunction<{ images: EventImage[] }>('events-api', {
      body: { op: 'eventImages.list', params: { eventId } },
    });

    if (error) throw error;
    return data?.images || [];
  }

  async getPublicEventImages(eventId: string): Promise<EventImage[]> {
    const { data, error } = await invokeEdgeFunction<{ images: EventImage[] }>('events-api', {
      body: { op: 'eventImages.listPublic', params: { eventId } },
      requiresAuth: false,
    });

    if (error) throw error;
    return data?.images || [];
  }

  async setEventImages(eventId: string, images: Array<{ image_url: string; is_cover?: boolean }>): Promise<EventImage[]> {
    const normalized = this.normalizeEventImages(images);
    const cover = normalized.find((img) => img.is_cover) || normalized[0];
    const payload = normalized
      .map((img) => ({
        event_id: eventId,
        image_url: img.image_url,
        is_cover: img.is_cover,
        display_order: img.display_order,
      }))
      // Keep exactly one cover and insert it first to avoid trigger race with unique cover constraint.
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover));
    const { data, error } = await invokeEdgeFunction<{ images: EventImage[] }>('events-api', {
      body: { op: 'eventImages.set', params: { eventId, images: payload } },
    });

    if (error) throw error;
    return data?.images || [];
  }
  async getManagedOrganizerId(userId: string): Promise<string> {
    const { data, error } = await invokeEdgeFunction<{ organizerId: string }>('events-api', {
      body: { op: 'organizer.getManagedOrganizerId' },
    });

    if (error) throw error;
    return data?.organizerId || userId;
  }

  async getManagedEventsByUser(userId: string): Promise<(Event & { revenue?: number; ticketsSold?: number; totalTicketsConfigured?: number })[]> {
    const organizerId = await this.getManagedOrganizerId(userId);
    return this.getEventsByCreator(organizerId);
  }

  // Buscar eventos criados por um organizador específico (com estatísticas básicas)
  async getEventsByCreator(creatorId: string): Promise<(Event & { revenue?: number; ticketsSold?: number; totalTicketsConfigured?: number })[]> {
    const { data, error } = await invokeEdgeFunction<{
      events: (Event & { revenue?: number; ticketsSold?: number; totalTicketsConfigured?: number })[];
    }>('events-api', {
      body: { op: 'organizer.eventsByCreator', params: { creatorId } },
    });

    if (error) throw error;
    return data?.events || [];
  }

  // Buscar participantes do evento (para substituir mocks)
  async getEventParticipants(eventId: string, limit = 100): Promise<any[]> {
    const { data, error } = await invokeEdgeFunction<{ participants: any[] }>('events-api', {
      body: { op: 'participants.list', params: { eventId, limit } },
    });

    if (error || !data?.participants) {
      return [];
    }

    return data.participants;
  }

  // Listar eventos que o usuário participa
  async getEventsByParticipant(userId: string): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'events.byParticipant', params: { userId } },
    });

    if (error) throw error;
    return data?.events || [];
  }

  // Atualizar evento
  async updateEvent(eventId: string, updates: Partial<Event>): Promise<Event> {
    // Processar event_date se presente
    const updatesToSave = { ...updates };

    if (updates.event_date && !updates.event_date.includes('Z') && !updates.event_date.includes('+')) {
      // Adicionar offset do timezone local
      const date = new Date(updates.event_date);
      const offset = -date.getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
      const offsetMins = (Math.abs(offset) % 60).toString().padStart(2, '0');
      const offsetSign = offset >= 0 ? '+' : '-';
      updatesToSave.event_date = `${updates.event_date}:00${offsetSign}${offsetHours}:${offsetMins}`;
    }

    const { data, error } = await invokeEdgeFunction<{ event: Event }>('events-api', {
      body: { op: 'events.update', params: { eventId, updates: updatesToSave } },
    });

    if (error) throw error;
    if (!data?.event) throw new Error('Falha ao atualizar evento');
    return data.event;
  }

  // Deletar evento
  async deleteEvent(eventId: string): Promise<void> {
    // Buscar o evento para obter a URL da imagem
    const event = await this.getEventById(eventId);
    const galleryImages = await this.getEventImages(eventId).catch(() => [] as EventImage[]);
    const galleryImageUrls = galleryImages.map((img) => img.image_url).filter(Boolean);

    const { error } = await invokeEdgeFunction('delete-event-safely', {
      body: { eventId },
    });

    if (error) throw error;

    // Limpar imagens do storage (capa + galeria), sem bloquear exclusão do evento.
    const allImageUrls = Array.from(
      new Set([event.image_url, ...galleryImageUrls].filter((url): url is string => !!url))
    );

    for (const imageUrl of allImageUrls) {
      if (!imageUrl.includes('supabase')) continue;
      try {
        await storageService.deleteImage(imageUrl);
      } catch {
        // Não falha a operação se alguma imagem não puder ser deletada
      }
    }
  }

  async deactivateEvent(eventId: string): Promise<Event> {
    const { data, error } = await invokeEdgeFunction<{ event: Event }>('events-api', {
      body: { op: 'events.deactivate', params: { eventId } },
    });

    if (error) throw error;
    if (!data?.event) throw new Error('Falha ao desativar evento');
    return data.event;
  }

  async reactivateEvent(eventId: string): Promise<Event> {
    const { data, error } = await invokeEdgeFunction<{ event: Event }>('events-api', {
      body: { op: 'events.reactivate', params: { eventId } },
    });

    if (error) throw error;
    if (!data?.event) throw new Error('Falha ao reativar evento');
    return data.event;
  }

  // Inscrever usuário em evento
  async joinEvent(
    eventId: string,
    userId: string,
    ticketQuantity: number = 1,
    ticketTypeId?: string,
    totalPaid?: number
  ): Promise<EventParticipant> {
    const { data, error } = await invokeEdgeFunction<{ participant: EventParticipant }>('events-api', {
      body: { op: 'participants.join', params: { eventId, ticketQuantity, ticketTypeId, totalPaid } },
    });

    if (error) throw error;
    if (!data?.participant) throw new Error('Falha ao inscrever no evento');
    return data.participant;
  }

  // Cancelar participação em evento
  async leaveEvent(eventId: string, userId: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'participants.leave', params: { eventId } },
    });

    if (error) throw error;
  }

  // Verificar se usuário está inscrito no evento
  async getUserParticipation(eventId: string, userId: string): Promise<EventParticipant | null> {
    const { data, error } = await invokeEdgeFunction<{ participation: EventParticipant | null }>('events-api', {
      body: { op: 'participants.get', params: { eventId, userId } },
    });

    if (error) throw error;
    return data?.participation ?? null;
  }

  async isUserParticipating(eventId: string, userId: string): Promise<boolean> {
    const participation = await this.getUserParticipation(eventId, userId).catch(() => null);
    return !!participation;
  }



  // Buscar eventos por categoria
  async getEventsByCategory(category: string): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'events.byCategory', params: { category } },
    });

    if (error) throw error;
    return data?.events || [];
  }

  // Buscar eventos por localização
  async getEventsByLocation(location: string): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'events.byLocation', params: { location } },
    });

    if (error) throw error;
    return data?.events || [];
  }

  async getTrendingEvents(limit = 20): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'events.trendingPublic', params: { limit } },
      requiresAuth: false,
    });

    if (error) throw error;
    return data?.events || [];
  }

  async getNewEvents(): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'events.listNewPublic' },
      requiresAuth: false,
    });

    if (error) throw error;
    return data?.events || [];
  }

  async getCategoriesWithUpcomingEvents(): Promise<(Category & { upcoming_events_count: number })[]> {
    const { data, error } = await invokeEdgeFunction<{ categories: (Category & { upcoming_events_count: number })[] }>('events-api', {
      body: { op: 'categories.withUpcomingCountsPublic' },
      requiresAuth: false,
    });

    if (error) throw error;
    return data?.categories || [];
  }

  // Buscar eventos do usuário (eventos em que está inscrito)
  async getUserEvents(userId: string): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'events.byParticipant', params: { userId } },
    });

    if (error) throw error;
    return data?.events || [];
  }

  // Buscar participantes de um evento que estão com single_mode/match_enabled ativo
  async getEventSingles(eventId: string): Promise<any[]> {
    const { data, error } = await invokeEdgeFunction<{ singles: any[] }>('events-api', {
      body: { op: 'singles.listForEvent', params: { eventId } },
    });

    if (error) throw error;
    return data?.singles || [];
  }

  // Buscar candidatos de match de forma segura via RPC
  async getMatchCandidates(eventId: string): Promise<MatchCandidate[]> {
    const { data, error } = await invokeEdgeFunction<{ candidates: MatchCandidate[] }>('events-api', {
      body: { op: 'matchCandidates.listForEvent', params: { eventId } },
    });

    if (error) throw error;
    return data?.candidates || [];
  }

  async getEventAttendees(eventId: string): Promise<any[]> {
    const { data, error } = await invokeEdgeFunction<{ attendees: any[] }>('events-api', {
      body: { op: 'attendees.listForEvent', params: { eventId } },
    });

    if (error) throw error;
    return data?.attendees || [];
  }

  // Buscar ingressos do usuário com detalhes do evento e token
  async getUserTickets(userId: string): Promise<(EventParticipant & { event: Event })[]> {
    const { data, error } = await invokeEdgeFunction<{ tickets: (EventParticipant & { event: Event })[] }>('events-api', {
      body: { op: 'tickets.listByUser', params: { userId } },
    });

    if (error) throw error;
    return data?.tickets || [];
  }

  // Obter detalhes do ingresso para exibição (incluindo token QR)
  async getTicketDetails(ticketId: string): Promise<EventParticipant> {
    const { data, error } = await invokeEdgeFunction<{ ticket: EventParticipant }>('events-api', {
      body: { op: 'tickets.getDetails', params: { ticketId } },
    });

    if (error) throw error;
    if (!data?.ticket) throw new Error('Ingresso não encontrado');
    return data.ticket;
  }

  // Validar ingresso (Scanner)
  async validateTicket(ticketId: string, eventId: string, token: string, validatorId: string): Promise<any> {
    const { data, error } = await invokeEdgeFunction<{ result: any }>('events-api', {
      body: { op: 'tickets.validate', params: { ticketId, eventId, token, validatorId } },
    });

    if (error) throw error;
    return data?.result;
  }

  // Validar ingresso via Scanner (Novo Formato Simples)
  async validateTicketScan(code: string, eventId: string, validatorId: string): Promise<any> {
    const { data, error } = await invokeEdgeFunction<{ result: any }>('events-api', {
      body: { op: 'tickets.validateScan', params: { code, eventId, validatorId } },
    });

    if (error) throw error;
    return data?.result;
  }

  // Buscar eventos criados pelo organizador (para o Scanner)
  async getOrganizerEvents(organizerId: string): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'events.organizerUpcoming', params: { organizerId } },
    });

    if (error) throw error;
    return data?.events || [];
  }

  async getScannerEvents(userId: string): Promise<Event[]> {
    const organizerId = await this.getManagedOrganizerId(userId);
    return this.getOrganizerEvents(organizerId);
  }

  async getEventScanLogs(eventId: string, limit = 50): Promise<EventScanLog[]> {
    const { data, error } = await invokeEdgeFunction<{ logs: EventScanLog[] }>('events-api', {
      body: { op: 'scanLogs.list', params: { eventId, limit } },
    });

    if (error) throw error;
    return data?.logs || [];
  }

  // Validar ingresso manualmente (Código)
  async validateTicketManual(code: string, eventId: string, validatorId: string): Promise<any> {
    const { data, error } = await invokeEdgeFunction<{ result: any }>('events-api', {
      body: { op: 'tickets.validateManual', params: { code, eventId, validatorId } },
    });

    if (error) throw error;
    return data?.result;
  }

  // Buscar perfil público de um usuário (com filtro de privacidade)
  async getPublicProfile(userId: string): Promise<any> {
    const { data, error } = await invokeEdgeFunction<{ profile: any }>('events-api', {
      body: { op: 'profiles.getPublicProfile', params: { userId } },
    });

    if (error) throw error;
    return data?.profile ?? null;
  }

  // --- Sistema de Likes / Favoritos ---

  // Alternar like (curtir/descurtir)
  async toggleLike(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await invokeEdgeFunction<{ liked: boolean }>('events-api', {
      body: { op: 'likes.toggle', params: { eventId } },
    });

    if (error) throw error;
    return Boolean(data?.liked);
  }

  // Verificar se usuário curtiu evento
  async hasUserLiked(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await invokeEdgeFunction<{ hasLiked: boolean }>('events-api', {
      body: { op: 'likes.has', params: { eventId } },
    });

    if (error) throw error;
    return Boolean(data?.hasLiked);
  }

  // Obter eventos curtidos pelo usuário
  async getUserLikedEvents(userId: string): Promise<Event[]> {
    const { data, error } = await invokeEdgeFunction<{ events: Event[] }>('events-api', {
      body: { op: 'likes.listByUser', params: { userId } },
    });

    if (error) throw error;
    return data?.events || [];
  }
}

export const eventService = new EventService();
