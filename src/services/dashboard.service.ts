import { supabase } from '@/lib/supabase';

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

type SaleTicket = {
  unit_price?: number | null;
  quantity?: number | null;
  discount_amount?: number | null;
};

type FinancialBreakdown = {
  customerTotal: number;
  organizerRevenue: number;
  platformFee: number;
  quantity: number;
};

type PaymentSplitRow = {
  recipient_type?: string | null;
  fee_type?: string | null;
  fee_value?: number | null;
  value?: number | null;
  status?: string | null;
};

const PLATFORM_FEE_RATE = 0.1;
const CONFIRMED_PAYMENT_STATUSES = ['paid', 'received', 'confirmed'] as const;
const VALID_TICKET_STATUSES = ['valid', 'used'] as const;
const SHOULD_LOG_FINANCE =
  (typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV)) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FINANCE_DEBUG === 'true');

function getFinancialBreakdown(
  totalPaid: number | null | undefined,
  ticket?: SaleTicket | null,
  participantQuantity?: number | null,
  organizerSplit?: PaymentSplitRow | null,
  splitBaseValue?: number | null
): FinancialBreakdown {
  const paid = Number(totalPaid) || 0;
  const splitBase = Number(splitBaseValue) > 0 ? Number(splitBaseValue) : paid;

  // Primary source: split configuration recorded for organizer in checkout.
  if (organizerSplit && paid > 0) {
    const feeType = String(organizerSplit.fee_type || '').toLowerCase();
    const feeValue = Number(organizerSplit.fee_value) || 0;
    const splitValue = Number(organizerSplit.value) || 0;

    let organizerRevenue = 0;
    if (feeType === 'percentage' && feeValue > 0) {
      organizerRevenue = Number(((splitBase * feeValue) / 100).toFixed(2));
    } else if (splitValue > 0) {
      organizerRevenue = Number(splitValue.toFixed(2));
    }

    organizerRevenue = Math.min(Math.max(organizerRevenue, 0), paid);
    const platformFee = Number((paid - organizerRevenue).toFixed(2));
    return {
      customerTotal: Number(paid.toFixed(2)),
      organizerRevenue,
      platformFee: Math.max(0, platformFee),
      quantity: Number(participantQuantity) || Number(ticket?.quantity) || 1,
    };
  }

  if (ticket && typeof ticket.unit_price === 'number') {
    const quantity = Number(participantQuantity) || Number(ticket.quantity) || 1;
    const unitPrice = Number(ticket.unit_price) || 0;
    const discount = Number(ticket.discount_amount) || 0;
    const organizerRevenue = Math.max(0, Number((unitPrice * quantity - discount).toFixed(2)));
    const platformFee = Number((organizerRevenue * PLATFORM_FEE_RATE).toFixed(2));
    const customerTotal = Number((organizerRevenue + platformFee).toFixed(2));
    return { customerTotal, organizerRevenue, platformFee, quantity };
  }

  if (paid <= 0) {
    return {
      customerTotal: 0,
      organizerRevenue: 0,
      platformFee: 0,
      quantity: Number(participantQuantity) || 0,
    };
  }

  // Legacy fallback (without linked ticket): assume paid already represents customer total (GMV).
  const organizerRevenue = Number((paid / (1 + PLATFORM_FEE_RATE)).toFixed(2));
  const platformFee = Number((organizerRevenue * PLATFORM_FEE_RATE).toFixed(2));
  const customerTotal = Number((organizerRevenue + platformFee).toFixed(2));
  return { customerTotal, organizerRevenue, platformFee, quantity: Number(participantQuantity) || 1 };
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
        ticket_quantity,
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
      amount: getFinancialBreakdown(item.total_paid, item.ticket, item.ticket_quantity).organizerRevenue,
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
    const activeEvents = events?.filter((event) => event.event_date > now).length || 0;
    const eventIds = events?.map((event) => event.id) || [];

    let totalSales = 0;
    let totalTicketsSold = 0;
    let totalGross = 0;
    let totalPlatformFees = 0;
    let totalNet = 0;
    let pendingNet = 0;
    let currentMonthRevenue = 0;
    let previousMonthRevenue = 0;
    let currentMonthTickets = 0;
    let previousMonthTickets = 0;
    let currentMonthParticipants = 0;
    let previousMonthParticipants = 0;

    if (eventIds.length > 0) {
      const { data: validParticipants, error: participantsError } = await supabase
        .from('event_participants')
        .select('ticket_id, ticket_quantity, total_paid, joined_at, status')
        .in('event_id', eventIds)
        .in('status', [...VALID_TICKET_STATUSES]);

      if (participantsError) throw participantsError;

      const validTicketIds = new Set<string>();
      const participantByTicketId = new Map<
        string,
        { ticketQuantity: number; totalPaid: number; joinedAt: string | null }
      >();

      (validParticipants || []).forEach((participant: any) => {
        if (!participant.ticket_id) return;
        validTicketIds.add(participant.ticket_id);
        participantByTicketId.set(participant.ticket_id, {
          ticketQuantity: Number(participant.ticket_quantity) || 0,
          totalPaid: Number(participant.total_paid) || 0,
          joinedAt: participant.joined_at || null,
        });
      });

      const { data: organizerPayments, error: payError } = await supabase
        .from('payments')
        .select('id, status, value, asaas_net_value, created_at, ticket_id, ticket:ticket_id(event_id, unit_price, quantity, discount_amount)')
        .eq('organizer_user_id', organizerId)
        .in('status', [...CONFIRMED_PAYMENT_STATUSES, 'pending']);

      if (payError) throw payError;

      const paymentIds = (organizerPayments || []).map((payment: any) => payment.id).filter(Boolean);
      const splitByPaymentId = new Map<string, PaymentSplitRow>();

      if (paymentIds.length > 0) {
        const { data: splitRows, error: splitError } = await supabase
          .from('payment_splits')
          .select('payment_id, recipient_type, fee_type, fee_value, value, status')
          .in('payment_id', paymentIds)
          .eq('recipient_type', 'organizer');

        if (splitError) throw splitError;

        (splitRows || []).forEach((row: any) => {
          if (row?.payment_id && !splitByPaymentId.has(row.payment_id)) {
            splitByPaymentId.set(row.payment_id, row);
          }
        });
      }

      const nowDate = new Date();
      const startCurrentMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
      const startNextMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1);
      const startPreviousMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);

      let skippedPaymentsWithoutValidTicket = 0;

      (organizerPayments || []).forEach((payment: any) => {
        if (payment.ticket_id && validTicketIds.size > 0 && !validTicketIds.has(payment.ticket_id)) {
          skippedPaymentsWithoutValidTicket += 1;
          return;
        }

        const ticket = payment.ticket as SaleTicket & { event_id?: string } | null;
        if (ticket?.event_id && !eventIds.includes(ticket.event_id)) return;

        const participant = payment.ticket_id ? participantByTicketId.get(payment.ticket_id) : null;
        const breakdown = getFinancialBreakdown(
          payment.value,
          ticket,
          participant?.ticketQuantity ?? ticket?.quantity,
          splitByPaymentId.get(payment.id) || null,
          payment.asaas_net_value
        );

        if (breakdown.customerTotal <= 0) return;

        if (payment.status === 'pending') {
          pendingNet += breakdown.organizerRevenue;
          return;
        }

        totalSales += 1;
        totalTicketsSold += participant?.ticketQuantity ?? breakdown.quantity;
        totalGross += breakdown.customerTotal;
        totalPlatformFees += breakdown.platformFee;
        totalNet += breakdown.organizerRevenue;

        const referenceDate = participant?.joinedAt && participant.joinedAt.length > 0
          ? participant.joinedAt
          : payment.created_at;
        const paymentDate = referenceDate ? new Date(referenceDate) : null;
        if (!paymentDate) return;

        if (paymentDate >= startCurrentMonth && paymentDate < startNextMonth) {
          currentMonthRevenue += breakdown.customerTotal;
          currentMonthTickets += participant?.ticketQuantity ?? breakdown.quantity;
          currentMonthParticipants += participant?.ticketQuantity ?? breakdown.quantity;
        } else if (paymentDate >= startPreviousMonth && paymentDate < startCurrentMonth) {
          previousMonthRevenue += breakdown.customerTotal;
          previousMonthTickets += participant?.ticketQuantity ?? breakdown.quantity;
          previousMonthParticipants += participant?.ticketQuantity ?? breakdown.quantity;
        }
      });

      if (SHOULD_LOG_FINANCE) {
        const validTicketsCount = (validParticipants || []).reduce(
          (sum: number, participant: any) => sum + (Number(participant.ticket_quantity) || 0),
          0
        );

        console.info('[FinanceAudit][OrganizerDashboard][Reconciliation]', {
          organizerId,
          paidPaymentsCount: (organizerPayments || []).filter((payment: any) =>
            CONFIRMED_PAYMENT_STATUSES.includes(payment.status)
          ).length,
          skippedPaymentsWithoutValidTicket,
          validTicketsCount,
          grossTotal: Number(totalGross.toFixed(2)),
          netTotal: Number(totalNet.toFixed(2)),
          platformFeesTotal: Number(totalPlatformFees.toFixed(2)),
          pendingNet: Number(pendingNet.toFixed(2)),
        });
      }
    }

    const totalWithdrawn = 0;
    const availableBalance = totalNet - totalWithdrawn;
    const pendingBalance = Number(pendingNet.toFixed(2));

    if (SHOULD_LOG_FINANCE) {
      const ticketAverage = totalTicketsSold > 0 ? totalNet / totalTicketsSold : 0;
      console.info('[FinanceAudit][OrganizerDashboard]', {
        organizerId,
        totalSales,
        totalTicketsSold,
        totalGross: Number(totalGross.toFixed(2)),
        totalPlatformFees: Number(totalPlatformFees.toFixed(2)),
        totalOrganizerNet: Number(totalNet.toFixed(2)),
        averageTicketNet: Number(ticketAverage.toFixed(2)),
      });
    }

    return {
      totalEvents,
      activeEvents,
      totalSales,
      totalTicketsSold,
      totalRevenue: totalGross,
      totalGrossRevenue: totalGross,
      totalNetRevenue: totalNet,
      totalPlatformFees,
      availableBalance,
      pendingBalance,
      totalWithdrawn,
      monthlyComparison: {
        currentMonthRevenue: Number(currentMonthRevenue.toFixed(2)),
        previousMonthRevenue: Number(previousMonthRevenue.toFixed(2)),
        currentMonthTickets,
        previousMonthTickets,
        currentMonthParticipants,
        previousMonthParticipants,
      },
    };
  },

  async getFinancialTransactions(organizerId: string): Promise<OrganizerFinancialTransaction[]> {
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id')
      .eq('creator_id', organizerId);

    if (eventsError) throw eventsError;

    const eventIds = events?.map((event) => event.id) || [];
    if (eventIds.length === 0) return [];

    const { data: participants, error: participantsError } = await supabase
      .from('event_participants')
      .select('ticket_id, ticket_quantity, total_paid, joined_at, user:profiles!event_participants_user_id_fkey(full_name, email)')
      .in('event_id', eventIds);

    if (participantsError) throw participantsError;

    const participantByTicketId = new Map<string, {
      ticketQuantity: number;
      totalPaid: number;
      joinedAt: string | null;
      buyerName: string;
      buyerEmail: string;
    }>();

    (participants || []).forEach((participant: any) => {
      if (!participant?.ticket_id) return;
      participantByTicketId.set(participant.ticket_id, {
        ticketQuantity: Number(participant.ticket_quantity) || 0,
        totalPaid: Number(participant.total_paid) || 0,
        joinedAt: participant.joined_at || null,
        buyerName: participant.user?.full_name || 'Usuario',
        buyerEmail: participant.user?.email || '-',
      });
    });

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, status, value, created_at, payment_method, asaas_net_value, ticket_id, ticket:ticket_id(event_id, unit_price, quantity, discount_amount, event:events(title))')
      .eq('organizer_user_id', organizerId)
      .order('created_at', { ascending: false });

    if (paymentsError) throw paymentsError;

    const paymentIds = (payments || []).map((payment: any) => payment.id).filter(Boolean);
    const splitByPaymentId = new Map<string, PaymentSplitRow>();

    if (paymentIds.length > 0) {
      const { data: splitRows, error: splitError } = await supabase
        .from('payment_splits')
        .select('payment_id, recipient_type, fee_type, fee_value, value, status')
        .in('payment_id', paymentIds)
        .eq('recipient_type', 'organizer');

      if (splitError) throw splitError;

      (splitRows || []).forEach((row: any) => {
        if (row?.payment_id && !splitByPaymentId.has(row.payment_id)) {
          splitByPaymentId.set(row.payment_id, row);
        }
      });
    }

    return (payments || [])
      .map((payment: any) => {
        const ticket = payment.ticket as (SaleTicket & { event?: { title?: string | null } }) | null;
        const participant = payment.ticket_id ? participantByTicketId.get(payment.ticket_id) : null;
        const breakdown = getFinancialBreakdown(
          payment.value,
          ticket,
          participant?.ticketQuantity ?? ticket?.quantity,
          splitByPaymentId.get(payment.id) || null,
          payment.asaas_net_value
        );

        return {
          id: payment.id,
          date: participant?.joinedAt || payment.created_at,
          eventName: ticket?.event?.title || 'Evento',
          buyerName: participant?.buyerName || 'Usuario',
          buyerEmail: participant?.buyerEmail || '-',
          paymentMethod: String(payment.payment_method || 'unknown'),
          grossAmount: breakdown.customerTotal,
          platformFee: breakdown.platformFee,
          netAmount: breakdown.organizerRevenue,
          status: String(payment.status || 'pending'),
        };
      })
      .filter((payment) => payment.grossAmount > 0);
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
      .select('joined_at, ticket_quantity, total_paid, ticket:ticket_id(unit_price, quantity, discount_amount)')
      .in('event_id', eventIds)
      .gte('joined_at', startDate.toISOString())
      .in('status', ['valid', 'used']);

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
        const breakdown = getFinancialBreakdown(sale.total_paid, sale.ticket, sale.ticket_quantity);
        if (breakdown.customerTotal <= 0) return;
        salesMap.set(key, {
          amount: current.amount + breakdown.customerTotal,
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
