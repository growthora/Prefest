import { supabase } from '../lib/supabase';
import { storageService } from './storage.service';
import type { TicketType } from '@/components/CreateEventForm';
import { generateSlug } from '@/utils/slugify';
import { differenceInYears } from 'date-fns';

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
  creator_id: string;
  created_at: string;
  updated_at: string;
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
  // 1. Filter visible tickets (valid for display)
  // Ignorar: is_test, is_internal, is_hidden, !is_active
  const visibleTickets = tickets.filter(t => 
    t.is_active && 
    !t.is_test && 
    !t.is_internal && 
    !t.is_hidden
  );

  // 2. Filter paid tickets (price > 0)
  const paidTickets = visibleTickets.filter(t => Number(t.price) > 0);

  let display_price_label = '';
  let display_price_value: number | undefined = undefined;
  let is_free_event = false;

  if (paidTickets.length > 0) {
    // 3. Exist paid tickets -> Show "From R$ XX"
    const minPrice = Math.min(...paidTickets.map(t => Number(t.price)));
    
    // Format currency
    const formattedPrice = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(minPrice);

    display_price_label = `Ingressos a partir de ${formattedPrice}`;
    display_price_value = minPrice;
    is_free_event = false;
  } else {
    // 4. No paid tickets
    // Check if ALL visible tickets are free
    if (visibleTickets.length > 0 && visibleTickets.every(t => Number(t.price) === 0)) {
      display_price_label = 'Grátis';
      display_price_value = 0;
      is_free_event = true;
    } else {
      // Fallback: No visible tickets or unknown state
      // Use "Consultar" or empty, or fallback to event.price if needed (but user said avoid it)
      // Leaving empty allows frontend to handle or show nothing
      display_price_label = '';
      display_price_value = undefined;
    }
  }

  return { display_price_label, display_price_value, is_free_event };
};

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  ticket_quantity: number;
  ticket_type_id: string | null;
  total_paid: number | null;
  joined_at: string;
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
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  // Criar novo evento
  async createEvent(eventData: CreateEventData, creatorId: string): Promise<Event> {
    
    // Converter event_date para manter o horário local correto
    let eventDateToSave = eventData.event_date;
    
    if (eventData.event_date && !eventData.event_date.includes('Z') && !eventData.event_date.includes('+')) {
      const date = new Date(eventData.event_date);
      const offset = -date.getTimezoneOffset(); // em minutos
      const offsetHours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
      const offsetMins = (Math.abs(offset) % 60).toString().padStart(2, '0');
      const offsetSign = offset >= 0 ? '+' : '-';
      eventDateToSave = `${eventData.event_date}:00${offsetSign}${offsetHours}:${offsetMins}`;
    }

    let endAtToSave = eventData.end_at;
    if (eventData.end_at && !eventData.end_at.includes('Z') && !eventData.end_at.includes('+')) {
      const date = new Date(eventData.end_at);
      const offset = -date.getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
      const offsetMins = (Math.abs(offset) % 60).toString().padStart(2, '0');
      const offsetSign = offset >= 0 ? '+' : '-';
      endAtToSave = `${eventData.end_at}:00${offsetSign}${offsetHours}:${offsetMins}`;
    }

    // Gerar slug único
    let slug = generateSlug(eventData.title);
    // Verificar se slug já existe e adicionar sufixo se necessário
    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);
      
    if (count && count > 0) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    }
    
    // Sanitize data before insert
    const eventToInsert = {
      ...eventData,
      status: eventData.status || 'draft', // Explicitly set status, default to draft
      slug,
      event_date: eventDateToSave,
      end_at: endAtToSave,
      creator_id: creatorId,
      category_id: eventData.category_id || null, // Convert empty string to null for UUID
      category: eventData.category || null,
      image_url: eventData.image_url || null,
      max_participants: eventData.max_participants || null,
      is_paid_event: eventData.is_paid_event ?? false,
      sales_enabled: eventData.sales_enabled ?? false,
      asaas_required: eventData.asaas_required ?? true,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('events')
      .insert(eventToInsert)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // Criar tipos de ingressos para um evento
  async createTicketTypes(eventId: string, ticketTypes: TicketType[]): Promise<TicketTypeDB[]> {
    
    const ticketsToInsert = ticketTypes.map(ticket => ({
      event_id: eventId,
      name: ticket.name,
      description: ticket.description || null,
      price: ticket.price,
      quantity_available: ticket.quantity_available,
      sale_start_date: ticket.sale_start_date || null,
      sale_end_date: ticket.sale_end_date || null,
    }));

    const { data, error } = await supabase
      .from('ticket_types')
      .insert(ticketsToInsert)
      .select();

    if (error) {
      throw error;
    }
    
    return data;
  }

  // Buscar tipos de ingressos disponíveis para um evento
  async getEventTicketTypes(eventId: string): Promise<TicketTypeDB[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .or(`sale_start_date.is.null,sale_start_date.lte.${now}`)
      .or(`sale_end_date.is.null,sale_end_date.gte.${now}`)
      .order('price', { ascending: true });

    if (error) throw error;
    
    // Filtrar ingressos que ainda têm quantidade disponível
    return (data || []).filter(ticket => 
      ticket.quantity_sold < ticket.quantity_available
    );
  }

  // Buscar todos os tipos de ingressos de um evento (painel organizador/admin)
  async getEventTicketTypesForOrganizer(eventId: string): Promise<TicketTypeDB[]> {
    const { data, error } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Criar um tipo de ingresso (lote) para um evento
  async createTicketType(eventId: string, payload: TicketTypeCreateData): Promise<TicketTypeDB> {
    const dataToInsert = {
      event_id: eventId,
      name: payload.name,
      description: payload.description ?? null,
      price: Number(payload.price) || 0,
      quantity_available: Number(payload.quantity_available) || 0,
      sale_start_date: payload.sale_start_date ?? null,
      sale_end_date: payload.sale_end_date ?? null,
      is_active: payload.is_active ?? true,
    };

    const { data, error } = await supabase
      .from('ticket_types')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Atualizar um tipo de ingresso (lote)
  async updateTicketType(ticketTypeId: string, payload: TicketTypeUpdateData): Promise<TicketTypeDB> {
    const { data: existing, error: existingError } = await supabase
      .from('ticket_types')
      .select('id, quantity_sold')
      .eq('id', ticketTypeId)
      .single();

    if (existingError) throw existingError;

    if (
      typeof payload.quantity_available === 'number' &&
      payload.quantity_available < Number(existing.quantity_sold || 0)
    ) {
      throw new Error('A quantidade do lote nao pode ser menor que o total vendido.');
    }

    const { data, error } = await supabase
      .from('ticket_types')
      .update(payload as any)
      .eq('id', ticketTypeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Excluir um tipo de ingresso (lote)
  async deleteTicketType(ticketTypeId: string): Promise<void> {
    const { data: existing, error: existingError } = await supabase
      .from('ticket_types')
      .select('id, quantity_sold')
      .eq('id', ticketTypeId)
      .single();

    if (existingError) throw existingError;

    if (Number(existing.quantity_sold || 0) > 0) {
      throw new Error('Nao e possivel excluir lote com ingressos vendidos.');
    }

    const { error } = await supabase
      .from('ticket_types')
      .delete()
      .eq('id', ticketTypeId);

    if (error) throw error;
  }

  // Listar todos os eventos
  async getAllEvents(retries = 3, includeDrafts = false): Promise<Event[]> {
    
    for (let i = 0; i < retries; i++) {
      try {
        let query = supabase
          .from('events')
          .select('*, ticket_types(*)')
          .order('event_date', { ascending: true });

        if (!includeDrafts) {
          query = query.eq('status', 'published');
          query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        // Mapear eventos para incluir campos calculados de preço
        const eventsWithPrice = (data || []).map((event: any) => {
          const tickets = event.ticket_types as TicketTypeDB[] || [];
          const priceInfo = calculateEventDisplayPrice(tickets);
          
          return {
            ...event,
            ...priceInfo
          };
        });

        return eventsWithPrice;
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
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_types(*)')
      .eq('status', 'published') // Apenas eventos publicados
      .eq('is_active', true)
      .gte('event_date', now)
      .order('event_date', { ascending: true });

    if (error) throw error;
    
    // Mapear eventos com preço calculado
    const eventsWithPrice = (data || []).map((event: any) => {
      const tickets = event.ticket_types as TicketTypeDB[] || [];
      const priceInfo = calculateEventDisplayPrice(tickets);
      return { ...event, ...priceInfo };
    });
    
    // Filtrar eventos não lotados
    return eventsWithPrice.filter(event => 
      !event.max_participants || event.current_participants < event.max_participants
    );
  }

  // Buscar evento por Slug
  async getEventBySlug(slug: string): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_types(*)')
      .eq('slug', slug)
      .eq('status', 'published')
      .eq('is_active', true)
      .single();

    if (error) throw error;
    
    const tickets = (data as any).ticket_types as TicketTypeDB[] || [];
    const priceInfo = calculateEventDisplayPrice(tickets);
    return { ...data, ...priceInfo };
  }

  // Buscar evento por ID
  async getEventById(id: string): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_types(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    const tickets = (data as any).ticket_types as TicketTypeDB[] || [];
    const priceInfo = calculateEventDisplayPrice(tickets);
    return { ...data, ...priceInfo };
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
    const { data, error } = await supabase
      .from('event_images')
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return (data || []) as EventImage[];
  }

  async setEventImages(eventId: string, images: Array<{ image_url: string; is_cover?: boolean }>): Promise<EventImage[]> {
    const normalized = this.normalizeEventImages(images);
    const cover = normalized.find((img) => img.is_cover) || normalized[0];

    const { error: deleteError } = await supabase
      .from('event_images')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) throw deleteError;

    const { data: inserted, error: insertError } = await supabase
      .from('event_images')
      .insert(
        normalized.map((img) => ({
          event_id: eventId,
          image_url: img.image_url,
          is_cover: img.is_cover,
          display_order: img.display_order,
        }))
      )
      .select('*')
      .order('display_order', { ascending: true });

    if (insertError) throw insertError;

    const { error: eventUpdateError } = await supabase
      .from('events')
      .update({ image_url: cover.image_url } as any)
      .eq('id', eventId);

    if (eventUpdateError) throw eventUpdateError;

    return (inserted || []) as EventImage[];
  }
  // Buscar eventos criados por um organizador específico (com estatísticas básicas)
  async getEventsByCreator(creatorId: string): Promise<(Event & { revenue?: number; ticketsSold?: number; totalTicketsConfigured?: number })[]> {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!events || events.length === 0) return [];

    // Buscar receita e capacidade total configurada
    const eventIds = events.map(e => e.id);
    
    // 1. Receita (Sales)
    const { data: participants, error: partError } = await supabase
      .from('event_participants')
      .select('event_id, ticket_quantity, total_paid, ticket:ticket_id(unit_price, quantity, discount_amount)')
      .in('event_id', eventIds)
      .in('status', ['valid', 'used', 'paid', 'confirmed']);

    if (partError) {
      // Erro silencioso
    }

    // 2. Capacidade Total (Ticket Types)
    const { data: ticketTypes, error: ticketError } = await supabase
      .from('ticket_types')
      .select('event_id, quantity_available, quantity_sold')
      .in('event_id', eventIds);

    if (ticketError) {
      // Erro silencioso
    }

    // Mapear dados
    const revenueMap = new Map<string, number>();
    const ticketsMap = new Map<string, number>();
    const capacityMap = new Map<string, number>();
    
    participants?.forEach((p: any) => {
      const ticket = p.ticket as { unit_price?: number | null; quantity?: number | null; discount_amount?: number | null } | null;

      let organizerAmount = 0;
      if (ticket && typeof ticket.unit_price === 'number') {
        const qty = Number(p.ticket_quantity) || Number(ticket.quantity) || 1;
        const discount = Number(ticket.discount_amount) || 0;
        const gross = Math.max(0, Number((Number(ticket.unit_price) * qty - discount).toFixed(2)));
        organizerAmount = Number((gross * 0.9).toFixed(2));
      } else {
        // Legacy fallback without linked ticket: assume total_paid includes +10% fee.
        const paid = Number(p.total_paid) || 0;
        const gross = paid > 0 ? Number((paid / 1.1).toFixed(2)) : 0;
        organizerAmount = gross > 0 ? Number((gross * 0.9).toFixed(2)) : 0;
      }

      const currentRev = revenueMap.get(p.event_id) || 0;
      revenueMap.set(p.event_id, currentRev + organizerAmount);

      const currentTickets = ticketsMap.get(p.event_id) || 0;
      ticketsMap.set(p.event_id, currentTickets + (Number(p.ticket_quantity) || 0));
    });

    ticketTypes?.forEach(t => {
      const currentCap = capacityMap.get(t.event_id) || 0;
      // Total configured = Sum of quantity_available (quantity_available is the total, not remaining)
      const totalForType = t.quantity_available || 0;
      capacityMap.set(t.event_id, currentCap + totalForType);
    });

    return events.map(event => ({
      ...event,
      revenue: revenueMap.get(event.id) || 0,
      ticketsSold: ticketsMap.get(event.id) || 0,
      totalTicketsConfigured: capacityMap.get(event.id) || 0
    }));
  }

  // Buscar participantes do evento (para substituir mocks)
  async getEventParticipants(eventId: string, limit = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        id,
        status,
        user_id,
        user:profiles!event_participants_user_id_fkey!inner(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('event_id', eventId)
      .limit(limit);

    if (error) {
      return [];
    }

    return data.map((p: any) => ({
      id: p.id, // Usando ID do ingresso para garantir unicidade
      userId: p.user.id,
      name: p.user.full_name || 'Usuário',
      avatar_url: p.user.avatar_url,
      status: p.status
    }));
  }

  // Listar eventos que o usuário participa
  async getEventsByParticipant(userId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('event_participants')
      .select('event_id, events(*)')
      .eq('user_id', userId);

    if (error) throw error;

    const rows = (data ?? []) as { events: Event | null }[];
    return rows
      .map(row => row.events)
      .filter((event): event is Event => Boolean(event));
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
    
    const { data, error } = await supabase
      .from('events')
      .update(updatesToSave as any)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Deletar evento
  async deleteEvent(eventId: string): Promise<void> {
    // Buscar o evento para obter a URL da imagem
    const event = await this.getEventById(eventId);
    const galleryImages = await this.getEventImages(eventId).catch(() => [] as EventImage[]);
    const galleryImageUrls = galleryImages.map((img) => img.image_url).filter(Boolean);

    // ADMIN: permitir exclusão apenas se não houver ingressos vendidos.
    // Se existirem tickets pendentes/reservados, removemos em cadeia para evitar bloqueio de FK.
    const { data: ticketRows, error: ticketRowsError } = await supabase
      .from('tickets')
      .select('id, status')
      .eq('event_id', eventId);

    if (ticketRowsError) throw ticketRowsError;
    const soldStatuses = new Set(this.SOLD_TICKET_STATUSES.map((status) => status.toLowerCase()));
    const soldTicketsCount = (ticketRows || []).filter((ticket: any) =>
      soldStatuses.has(String(ticket?.status || '').toLowerCase())
    ).length;
    if (soldTicketsCount > 0) {
      throw new Error(
        'Não é possível excluir este evento porque já houve ingressos vendidos. ' +
          'Use desativar para deixar o evento totalmente offline.'
      );
    }

    const ticketIds = (ticketRows || []).map((t: any) => t.id);
    if (ticketIds.length > 0) {
      const { data: paymentRowsByTicket, error: paymentRowsByTicketError } = await supabase
        .from('payments')
        .select('id')
        .in('ticket_id', ticketIds as any);

      if (paymentRowsByTicketError) throw paymentRowsByTicketError;

      const paymentIds = Array.from(
        new Set((paymentRowsByTicket || []).map((p: any) => p.id))
      );
      if (paymentIds.length > 0) {
        const { error: splitDeleteError } = await supabase
          .from('payment_splits')
          .delete()
          .in('payment_id', paymentIds as any);
        if (splitDeleteError) throw splitDeleteError;

        const { error: paymentsDeleteError } = await supabase
          .from('payments')
          .delete()
          .in('id', paymentIds as any);
        if (paymentsDeleteError) throw paymentsDeleteError;
      }

      const { error: ticketsDeleteError } = await supabase
        .from('tickets')
        .delete()
        .eq('event_id', eventId);
      if (ticketsDeleteError) throw ticketsDeleteError;
    }

    const { error: participantsDeleteError } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId);
    if (participantsDeleteError) throw participantsDeleteError;

    const { error: checkinDeleteError } = await supabase
      .from('check_in_logs')
      .delete()
      .eq('event_id', eventId);
    if (checkinDeleteError) throw checkinDeleteError;

    const { error: ticketTypesDeleteError } = await supabase
      .from('ticket_types')
      .delete()
      .eq('event_id', eventId);
    if (ticketTypesDeleteError) throw ticketTypesDeleteError;
    
    // Deletar o evento do banco
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      if ((error as any).code === '23503' && String((error as any).message || '').includes('tickets_event_id_fkey')) {
        throw new Error(
          'Não é possível excluir este evento porque já existem ingressos vinculados. ' +
          'Desative o evento para deixá-lo totalmente offline (sem visualização pública e sem compras).'
        );
      }
      throw error;
    }
    
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
    const { data, error } = await supabase
      .from('events')
      .update({
        is_active: false,
        sales_enabled: false,
        status: 'draft',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async reactivateEvent(eventId: string): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .update({
        is_active: true,
        status: 'published',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Inscrever usuário em evento
  async joinEvent(
    eventId: string, 
    userId: string, 
    ticketQuantity: number = 1, 
    ticketTypeId?: string,
    totalPaid?: number
  ): Promise<EventParticipant> {
    // Verificar se já está inscrito
    const { data: existing } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return existing;
    }

    // Verificar se o evento está disponível
    const event = await this.getEventById(eventId);
    
    if (event.max_participants && 
        event.current_participants + ticketQuantity > event.max_participants) {
      throw new Error('Evento lotado');
    }

    // Verificar disponibilidade do tipo de ingresso, se especificado
    if (ticketTypeId) {
      const { data: ticketType, error: ticketError } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('id', ticketTypeId)
        .single();

      if (ticketError) throw ticketError;

      const availableQuantity = ticketType.quantity_available - ticketType.quantity_sold;
      if (availableQuantity < ticketQuantity) {
        throw new Error('Quantidade de ingressos indisponível para este tipo');
      }
    }

    const finalTotalPaid = totalPaid ?? (event.price * ticketQuantity);

    const { data, error } = await supabase
      .from('event_participants')
      .insert({
        event_id: eventId,
        user_id: userId,
        ticket_quantity: ticketQuantity,
        ticket_type_id: ticketTypeId || null,
        total_paid: finalTotalPaid,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Cancelar participação em evento
  async leaveEvent(eventId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // Verificar se usuário está inscrito no evento
  async isUserParticipating(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('event_participants')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  }



  // Buscar eventos por categoria
  async getEventsByCategory(category: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('category', category)
      .order('event_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Buscar eventos por localização
  async getEventsByLocation(location: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .ilike('location', `%${location}%`)
      .order('event_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getTrendingEvents(limit = 20): Promise<Event[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_types(*)')
      .eq('status', 'published')
      .eq('is_active', true)
      .gte('event_date', now);

    if (error) throw error;

    const events = (data || []) as (Event & { tickets_sold?: number | null; views?: number | null; ticket_types?: TicketTypeDB[] })[];

    const scored = events
      .map(event => {
        const tickets = typeof event.tickets_sold === 'number' ? event.tickets_sold : 0;
        const views = typeof event.views === 'number' ? event.views : 0;
        const score = tickets * 0.6 + views * 0.4;
        
        // Calcular display price
        const priceInfo = calculateEventDisplayPrice(event.ticket_types || []);
        
        return { 
          event: { ...event, ...priceInfo }, 
          score 
        };
      })
      .sort((a, b) => b.score - a.score)
      .map(item => item.event);

    return scored.slice(0, limit);
  }

  async getNewEvents(): Promise<Event[]> {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_types(*)')
      .eq('status', 'published')
      .eq('is_active', true)
      .gte('event_date', now.toISOString())
      .gte('created_at', fourteenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Mapear com preço calculado
    return (data || []).map((event: any) => {
      const priceInfo = calculateEventDisplayPrice(event.ticket_types || []);
      return { ...event, ...priceInfo };
    });
  }

  async getCategoriesWithUpcomingEvents(): Promise<(Category & { upcoming_events_count: number })[]> {
    const now = new Date().toISOString();

    const [{ data: categories, error: categoriesError }, { data: events, error: eventsError }] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('events')
        .select('id, category_id, event_date, status')
        .eq('status', 'published')
        .gte('event_date', now),
    ]);

    if (categoriesError) throw categoriesError;
    if (eventsError) throw eventsError;

    const countByCategory = new Map<string, number>();

    (events || []).forEach(row => {
      const categoryId = (row as any).category_id as string | null;
      if (!categoryId) return;
      const current = countByCategory.get(categoryId) || 0;
      countByCategory.set(categoryId, current + 1);
    });

    return (categories || []).map(category => ({
      ...category,
      upcoming_events_count: countByCategory.get(category.id) || 0,
    }));
  }

  // Buscar eventos do usuário (eventos em que está inscrito)
  async getUserEvents(userId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('event_participants')
      .select('event_id, events(*)')
      .eq('user_id', userId);

    if (error) throw error;
    
    // Extrair os eventos do resultado
    const events = data?.map((item: any) => item.events).filter(Boolean) || [];
    return events;
  }

  // Buscar participantes de um evento que estão com single_mode/match_enabled ativo
  async getEventSingles(eventId: string): Promise<any[]> {
    // console.log('?? [EventService] Buscando participantes com match ativo para evento:', eventId);
    
    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        user_id,
        profiles:profiles!event_participants_user_id_fkey (
          id,
          full_name,
          bio,
          avatar_url,
          single_mode,
          match_enabled,
          show_initials_only,
          match_intention,
          match_gender_preference,
          sexuality,
          looking_for,
          height,
          relationship_status
        )
      `)
      .eq('event_id', eventId);

    if (error) {
      // console.error('? [EventService] Erro ao buscar participantes:', error);
      throw error;
    }

    // Mapear participantes respeitando privacidade
    const singles = data
      ?.map((item: any) => {
        const profile = item.profiles;
        if (!profile) return null;

        // Se match ativo, retorna perfil completo
        if (profile.match_enabled || profile.single_mode) {
          return profile;
        }

        // Se match inativo, retorna versão anônima
        return {
          id: profile.id,
          full_name: 'Participante',
          avatar_url: null, // Frontend usará avatar genérico
          match_enabled: false,
          bio: null,
          // Limpar dados sensíveis
          match_intention: null,
          match_gender_preference: null,
          sexuality: null,
          looking_for: null,
          height: null,
          relationship_status: null
        };
      })
      .filter(Boolean) || [];

    // console.log('? [EventService] Participantes processados:', singles.length);
    return singles;
  }

  // Buscar candidatos de match de forma segura via RPC
  async getMatchCandidates(eventId: string): Promise<MatchCandidate[]> {
    // console.log('?? [EventService] Buscando candidatos de match via RPC para evento:', eventId);
    
    const { data, error } = await supabase.rpc('get_match_candidates', {
      event_uuid: eventId
    });

    if (error) {
      // console.error('? [EventService] Erro ao buscar candidatos:', error);
      throw error;
    }

    // console.log('? [EventService] Candidatos encontrados:', data?.length || 0);
    return data || [];
  }

  async getEventAttendees(eventId: string): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_event_attendees', {
      event_uuid: eventId
    });

    if (error) {
      // console.error('Error fetching event attendees:', error);
      throw error;
    }

    return data;
  }

  // Buscar ingressos do usuário com detalhes do evento e token
  async getUserTickets(userId: string): Promise<(EventParticipant & { event: Event })[]> {
    const { data, error } = await supabase
      .from('event_participants')
      .select('*, event:events(*)')
      .eq('user_id', userId)
      // Removido filtro de status para mostrar histórico completo
      .order('joined_at', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as (EventParticipant & { event: Event })[];
    return rows;
  }

  // Obter detalhes do ingresso para exibição (incluindo token QR)
  async getTicketDetails(ticketId: string): Promise<EventParticipant> {
    const { data, error } = await supabase
      .from('event_participants')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error) throw error;
    return data;
  }

  // Validar ingresso (Scanner)
  async validateTicket(ticketId: string, eventId: string, token: string, validatorId: string): Promise<any> {
    const { data, error } = await supabase.rpc('validate_ticket', {
      p_ticket_id: ticketId,
      p_event_id: eventId,
      p_security_token: token,
      p_validated_by: validatorId
    });

    if (error) throw error;
    return data;
  }

  // Validar ingresso via Scanner (Novo Formato Simples)
  async validateTicketScan(code: string, eventId: string, validatorId: string): Promise<any> {
    const { data, error } = await supabase.rpc('validate_ticket_scan', {
      p_code: code,
      p_event_id: eventId,
      p_validated_by: validatorId
    });

    if (error) throw error;
    return data;
  }

  // Buscar eventos criados pelo organizador (para o Scanner)
  async getOrganizerEvents(organizerId: string): Promise<Event[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('creator_id', organizerId)
      .gte('event_date', today) // Events from today onwards
      .order('event_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Validar ingresso manualmente (Código)
  async validateTicketManual(code: string, eventId: string, validatorId: string): Promise<any> {
    const { data, error } = await supabase.rpc('validate_ticket_manual', {
      p_code: code,
      p_event_id: eventId,
      p_validated_by: validatorId
    });

    if (error) throw error;
    return data;
  }

  // Buscar perfil público de um usuário (com filtro de privacidade)
  async getPublicProfile(userId: string): Promise<any> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        bio,
        avatar_url,
        meet_attendees,
        match_enabled,
        single_mode,
        show_initials_only,
        match_intention,
        match_gender_preference,
        sexuality,
        looking_for,
        height,
        relationship_status,
        birth_date,
        vibes,
        last_seen
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!profile) return null;

    // Se o perfil não estiver configurado para aparecer na lista ("meet_attendees"),
    // ou se não tiver permissão explícita, tratar como privado.
    // NOTA: A lógica exata de "privacidade" depende dos requisitos.
    // Aqui assumimos que se meet_attendees for false, é privado.
    const isVisible = profile.meet_attendees || profile.match_enabled || profile.single_mode;

    if (!isVisible) {
      return {
        id: profile.id,
        name: profile.full_name,
        photo: profile.avatar_url,
        is_visible: false
      };
    }

    // Calcular idade se birth_date existir
    let age = null;
    if (profile.birth_date) {
        age = differenceInYears(new Date(), new Date(profile.birth_date));
    }

    // Calcular is_online baseado no last_seen (ex: < 5 minutos)
    let isOnline = false;
    if (profile.last_seen) {
        const lastSeenDate = new Date(profile.last_seen);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        isOnline = lastSeenDate > fiveMinutesAgo;
    }

    // Retornar perfil completo se visível
    return {
      id: profile.id,
      name: profile.full_name,
      photo: profile.avatar_url,
      bio: profile.bio,
      age: age,
      height: profile.height,
      relationshipStatus: profile.relationship_status,
      matchIntention: profile.match_intention,
      sexuality: profile.sexuality,
      genderPreference: profile.match_gender_preference,
      vibes: profile.vibes || [],
      lookingFor: profile.looking_for || [],
      lastSeen: profile.last_seen,
      isOnline: isOnline,
      is_visible: true
    };
  }

  // --- Sistema de Likes / Favoritos ---

  // Alternar like (curtir/descurtir)
  async toggleLike(eventId: string, userId: string): Promise<boolean> {
    // Verificar se já curtiu
    const hasLiked = await this.hasUserLiked(eventId, userId);

    if (hasLiked) {
      // Remover like
      const { error } = await supabase
        .from('event_likes')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);
      
      if (error) throw error;
      return false; // Agora não está curtido
    } else {
      // Adicionar like
      const { error } = await supabase
        .from('event_likes')
        .insert({
          event_id: eventId,
          user_id: userId
        });
      
      if (error) throw error;
      return true; // Agora está curtido
    }
  }

  // Verificar se usuário curtiu evento
  async hasUserLiked(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('event_likes')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      // console.error('Erro ao verificar like:', error);
    }

    return !!data;
  }

  // Obter eventos curtidos pelo usuário
  async getUserLikedEvents(userId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('event_likes')
      .select('event_id, events(*, ticket_types(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as { events: any }[];
    
    return rows
      .map(row => {
        const event = row.events;
        if (!event) return null;

        const tickets = event.ticket_types as TicketTypeDB[] || [];
        const priceInfo = calculateEventDisplayPrice(tickets);

        return {
          ...event,
          ...priceInfo
        };
      })
      .filter((event): event is Event => Boolean(event));
  }
}

export const eventService = new EventService();










