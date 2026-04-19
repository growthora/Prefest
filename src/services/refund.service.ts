import { invokeEdgeRoute } from '@/services/apiClient';

export interface RefundRequestRecord {
  id: string;
  user_id: string;
  ticket_id: string;
  payment_id: string | null;
  reason: string | null;
  status: 'requested' | 'approved' | 'rejected' | 'processing' | 'refunded' | 'failed';
  provider_refund_id: string | null;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  requested_at: string;
  created_at: string;
  updated_at: string;
}

export interface RefundEligibleTicket {
  id: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    slug: string;
    event_date?: string | null;
    end_at?: string | null;
    status?: string | null;
  } | null;
  ticket_type: {
    id: string;
    name: string;
  } | null;
  payment: {
    id: string;
    status: string;
    value: number;
    payment_method: string;
    external_payment_id?: string | null;
    created_at?: string;
  } | null;
  refund_request: RefundRequestRecord | null;
  can_request_refund: boolean;
}

export interface AdminRefundRequest extends RefundRequestRecord {
  user: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  reviewed_by_profile: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  payment: {
    id: string;
    status: string;
    value: number;
    payment_method: string;
    external_payment_id: string | null;
  } | null;
  ticket: {
    id: string;
    event_id: string;
    ticket_type_id: string;
    quantity: number;
    total_price: number;
    status: string;
    event: {
      id: string;
      title: string;
      slug: string;
      event_date?: string | null;
      end_at?: string | null;
      status?: string | null;
    } | null;
    ticket_type: {
      id: string;
      name: string;
    } | null;
  } | null;
}

class RefundService {
  async getMyRefundData(): Promise<{ requests: RefundRequestRecord[]; eligibleTickets: RefundEligibleTicket[] }> {
    const { data, error } = await invokeEdgeRoute('financial-api/refunds', {
      method: 'GET',
    });

    if (error) throw error;

    return {
      requests: data?.requests || [],
      eligibleTickets: data?.eligibleTickets || [],
    };
  }

  async createRefundRequest(ticketId: string, reason: string): Promise<void> {
    const { data, error } = await invokeEdgeRoute('financial-api/refunds', {
      method: 'POST',
      body: { ticketId, reason },
    });

    if (error) throw error;
    if (data?.ok !== true) throw new Error(data?.error || 'Falha ao solicitar reembolso');
  }

  async getAdminRefundRequests(): Promise<AdminRefundRequest[]> {
    const { data, error } = await invokeEdgeRoute('financial-api/admin/refunds', {
      method: 'GET',
    });

    if (error) throw error;
    return data?.requests || [];
  }

  async updateRefundRequest(requestId: string, action: 'approve' | 'reject' | 'process', notes?: string): Promise<void> {
    const { data, error } = await invokeEdgeRoute('financial-api/refunds', {
      method: 'PATCH',
      body: { requestId, action, notes },
    });

    if (error) throw error;
    if (data?.ok !== true) throw new Error(data?.error || 'Falha ao atualizar solicitação de reembolso');
  }
}

export const refundService = new RefundService();
