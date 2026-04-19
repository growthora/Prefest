import { invokeEdgeFunction } from './apiClient';

export interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalSales: number;
  totalTicketsSold: number;
  totalRevenue: number; // Backward compatibility: now represents gross revenue
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalPlatformFees: number;
  availableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
  monthlyComparison: {
    currentMonthRevenue: number;
    previousMonthRevenue: number;
    currentMonthTickets: number;
    previousMonthTickets: number;
    currentMonthParticipants: number;
    previousMonthParticipants: number;
  };
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

export interface OrganizerFinancialTransaction {
  id: string;
  date: string;
  eventName: string;
  buyerName: string;
  buyerEmail: string;
  paymentMethod: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  status: string;
}

export const dashboardService = {
  async getSales(organizerId: string): Promise<Sale[]> {
    const { data, error } = await invokeEdgeFunction<{ sales: Sale[] }>('events-api', {
      body: { op: 'dashboard.getSales', params: { organizerId } },
    });

    if (error) throw error;
    return data?.sales || [];
  },

  async getStats(organizerId: string): Promise<DashboardStats> {
    const { data, error } = await invokeEdgeFunction<DashboardStats>('events-api', {
      body: { op: 'dashboard.getStats', params: { organizerId } },
    });

    if (error) throw error;
    return data as DashboardStats;
  },

  async getFinancialTransactions(organizerId: string): Promise<OrganizerFinancialTransaction[]> {
    const { data, error } = await invokeEdgeFunction<{ transactions: OrganizerFinancialTransaction[] }>('events-api', {
      body: { op: 'dashboard.getFinancialTransactions', params: { organizerId } },
    });

    if (error) throw error;
    return data?.transactions || [];
  },
  async getSalesChart(organizerId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<SalesChartData[]> {
    const { data, error } = await invokeEdgeFunction<{ chart: SalesChartData[] }>('events-api', {
      body: { op: 'dashboard.getSalesChart', params: { organizerId, period } },
    });

    if (error) throw error;
    return data?.chart || [];
  },
};
