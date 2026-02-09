import { supabase } from '@/lib/supabase';

export interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
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
  buyerEmail: string; // Nota: profiles pode não ter email dependendo da privacidade, mas vamos tentar
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

export const dashboardService = {
  async getSales(organizerId: string): Promise<Sale[]> {
    // Buscar eventos do organizador primeiro para filtrar
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
        event:events(title),
        user:profiles!event_participants_user_id_fkey(full_name, email),
        ticket_type:ticket_types(name)
      `)
      .in('event_id', eventIds)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar vendas:', error);
      throw error;
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      date: item.joined_at,
      eventName: item.event?.title || 'Evento desconhecido',
      ticketType: item.ticket_type?.name || 'Ingresso padrão',
      amount: Number(item.total_paid) || 0,
      status: item.status || 'pending',
      buyerName: item.user?.full_name || 'Usuário',
      buyerEmail: item.user?.email || '-'
    }));
  },

  async getStats(organizerId: string): Promise<DashboardStats> {
    try {
      // 1. Buscar todos os eventos do organizador
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, event_date')
        .eq('creator_id', organizerId);

      if (eventsError) throw eventsError;

      const totalEvents = events?.length || 0;
      const now = new Date().toISOString();
      const activeEvents = events?.filter(e => e.event_date > now).length || 0;

      const eventIds = events?.map(e => e.id) || [];
      
      let totalTicketsSold = 0;
      let totalRevenue = 0;

      if (eventIds.length > 0) {
        // 2. Buscar vendas (participantes)
        const { data: participants, error: partError } = await supabase
          .from('event_participants')
          .select('ticket_quantity, total_paid')
          .in('event_id', eventIds)
          .eq('status', 'valid');

        if (partError) throw partError;

        if (participants) {
          totalTicketsSold = participants.reduce((sum, p) => sum + (p.ticket_quantity || 0), 0);
          totalRevenue = participants.reduce((sum, p) => sum + (Number(p.total_paid) || 0), 0);
        }
      }

      // Dados financeiros reais baseados nas vendas
      // Futuramente: subtrair taxas da plataforma e saques realizados
      const platformFee = 0.10; // 10%
      const netRevenue = totalRevenue * (1 - platformFee);
      
      // TODO: Implementar tabela de saques no banco de dados
      // Por enquanto retorna 0 pois a funcionalidade de saques ainda não existe
      const totalWithdrawn = 0; 
      const availableBalance = netRevenue - totalWithdrawn;
      const pendingBalance = 0; // TODO: Implementar lógica de retenção (d+30 etc)

      return {
        totalEvents,
        activeEvents,
        totalTicketsSold,
        totalRevenue, // Bruto
        availableBalance,
        pendingBalance,
        totalWithdrawn
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas do dashboard:', error);
      throw error;
    }
  },

  async getSalesChart(organizerId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<SalesChartData[]> {
    try {
      // 1. Buscar eventos do organizador
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('creator_id', organizerId);

      if (!events || events.length === 0) return [];

      const eventIds = events.map(e => e.id);
      
      // 2. Definir range de datas
      const now = new Date();
      const startDate = new Date();
      const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
      startDate.setDate(now.getDate() - days);

      // 3. Buscar vendas no período
      const { data: sales, error } = await supabase
        .from('event_participants')
        .select('joined_at, total_paid')
        .in('event_id', eventIds)
        .gte('joined_at', startDate.toISOString())
        .eq('status', 'valid');

      if (error) throw error;

      // 4. Agrupar por data
      const salesMap = new Map<string, { amount: number; count: number }>();
      
      // Inicializar mapa com datas vazias para garantir continuidade no gráfico
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        salesMap.set(key, { amount: 0, count: 0 });
      }

      sales?.forEach(sale => {
        const date = new Date(sale.joined_at);
        const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        if (salesMap.has(key)) {
          const current = salesMap.get(key)!;
          salesMap.set(key, {
            amount: current.amount + (Number(sale.total_paid) || 0),
            count: current.count + 1
          });
        }
      });

      // 5. Converter para array ordenado
      const result: SalesChartData[] = Array.from(salesMap.entries())
        .map(([date, data]) => ({
          date,
          amount: data.amount,
          count: data.count
        }))
        .reverse(); // Reverter para ficar cronológico (antigo -> novo)

      return result;
    } catch (error) {
      console.error('Erro ao gerar gráfico de vendas:', error);
      return [];
    }
  }
};
