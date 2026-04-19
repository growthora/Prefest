import { invokeEdgeRoute } from './apiClient';

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
    const { data, error } = await invokeEdgeRoute<{ sales: Sale[] }>(`financial-api/sales?organizerId=${encodeURIComponent(organizerId)}`, {
      method: 'GET',
    });

    if (error) throw error;
    return data?.sales || [];
  },

  async getStats(organizerId: string): Promise<DashboardStats> {
    const { data, error } = await invokeEdgeRoute<DashboardStats>(`financial-api/overview?organizerId=${encodeURIComponent(organizerId)}`, {
      method: 'GET',
    });

    if (error) throw error;
    return data as DashboardStats;
  },

  async getFinancialTransactions(organizerId: string): Promise<OrganizerFinancialTransaction[]> {
    const { data, error } = await invokeEdgeRoute<{ transactions: OrganizerFinancialTransaction[] }>(`financial-api/transactions?organizerId=${encodeURIComponent(organizerId)}`, {
      method: 'GET',
    });

    if (error) throw error;
    return data?.transactions || [];
  },
  async getSalesChart(organizerId: string, period: 'day' | 'week' | 'month' = 'week'): Promise<SalesChartData[]> {
    const { data, error } = await invokeEdgeRoute<{ chart: SalesChartData[] }>(`financial-api/chart?organizerId=${encodeURIComponent(organizerId)}&period=${encodeURIComponent(period)}`, {
      method: 'GET',
    });

    if (error) throw error;
    return data?.chart || [];
  },
};
