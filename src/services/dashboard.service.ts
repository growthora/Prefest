import { supabase } from '@/lib/supabase';

export interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalSales: number;
  totalTicketsSold: number;
  totalRevenue: number;
  availableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
}

export interface SalesChartData {
  date: string;
  amount: number;
  count: number;
}

export interface Sale {
  id: string;
  date: string;
  eventName: string;
  ticketType: string;
  amount: number;
  status: string;
  buyerName: string;
  buyerEmail: string;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  eventName: string;
  ticketType: string;
  purchaseDate: string;
  checkIn: boolean;
}

type SaleTicket = {
  unit_price?: number | null;
  quantity?: number | null;
  discount_amount?: number | null;
};

function getOrganizerAmount(totalPaid: number | null | undefined, ticket?: SaleTicket | null): number {
  if (ticket && typeof ticket.unit_price === 'number') {
    const quantity = Number(ticket.quantity) || 1;
    const unitPrice = Number(ticket.unit_price) || 0;
    const discount = Number(ticket.discount_amount) || 0;
    return Math.max(0, Number((unitPrice * quantity - discount).toFixed(2)));
  }

  const paid = Number(totalPaid) || 0;
  if (paid <= 0) return 0;

  // Legacy fallback (without linked ticket): remove fixed 10% service fee.
  return Number((paid / 1.1).toFixed(2));
}

export const dashboardService = {
  async getSales(organizerId: string): Promise<Sale[]> {
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('creator_id', organizerId);

    if (!events || events.length === 0) return [];

    const eventIds = events.map(e => e.id);

    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        id,
        joined_at,
        total_paid,
        status,
        ticket:ticket_id(unit_price, quantity, discount_amount),
        event:events(title),
        user:profiles!event_participants_user_id_fkey(full_name, email),
        ticket_type:ticket_types(name)
      `)
      .in('event_id', eventIds)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      date: item.joined_at,
      eventName: item.event?.title || 'Unknown event',
      ticketType: item.ticket_type?.name || 'Default ticket',
      amount: getOrganizerAmount(item.total_paid, item.ticket),
      status: item.status || 'pending',
      buyerName: item.user?.full_name || 'User',
      buyerEmail: item.user?.email || '-'
    }));
  },

  async getStats(organizerId: string): Promise<DashboardStats> {
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, event_date')
      .eq('creator_id', organizerId);

    if (eventsError) throw eventsError;

    const totalEvents = events?.length || 0;
    const now = new Date().toISOString();
    const activeEvents = events?.filter(e => e.event_date > now).length || 0;

    const eventIds = events?.map(e => e.id) || [];

    let totalSales = 0;
    let totalTicketsSold = 0;
    let totalRevenue = 0;

    if (eventIds.length > 0) {
      const { data: participants, error: partError } = await supabase
        .from('event_participants')
        .select('ticket_quantity, total_paid, ticket:ticket_id(unit_price, quantity, discount_amount)')
        .in('event_id', eventIds)
        .eq('status', 'valid');

      if (partError) throw partError;

      if (participants) {
        totalSales = participants.length;
        totalTicketsSold = participants.reduce((sum: number, p: any) => sum + (Number(p.ticket_quantity) || 0), 0);
        totalRevenue = participants.reduce((sum: number, p: any) => sum + getOrganizerAmount(p.total_paid, p.ticket), 0);
      }
    }

    const totalWithdrawn = 0;
    const availableBalance = totalRevenue - totalWithdrawn;
    const pendingBalance = 0;

    return {
      totalEvents,
      activeEvents,
      totalSales,
      totalTicketsSold,
      totalRevenue,
      availableBalance,
      pendingBalance,
      totalWithdrawn,
    };
  },

  async getSalesChart(organizerId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<SalesChartData[]> {
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('creator_id', organizerId);

    if (!events || events.length === 0) return [];

    const eventIds = events.map(e => e.id);

    const now = new Date();
    const startDate = new Date();
    const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
    startDate.setDate(now.getDate() - days);

    const { data: sales, error } = await supabase
      .from('event_participants')
      .select('joined_at, total_paid, ticket:ticket_id(unit_price, quantity, discount_amount)')
      .in('event_id', eventIds)
      .gte('joined_at', startDate.toISOString())
      .eq('status', 'valid');

    if (error) throw error;

    const salesMap = new Map<string, { amount: number; count: number }>();

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      salesMap.set(key, { amount: 0, count: 0 });
    }

    sales?.forEach((sale: any) => {
      const date = new Date(sale.joined_at);
      const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      if (salesMap.has(key)) {
        const current = salesMap.get(key)!;
        salesMap.set(key, {
          amount: current.amount + getOrganizerAmount(sale.total_paid, sale.ticket),
          count: current.count + 1,
        });
      }
    });

    return Array.from(salesMap.entries())
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        count: data.count,
      }))
      .reverse();
  },
};
