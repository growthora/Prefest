import { invokeEdgeFunction } from '@/services/apiClient';

export interface EventRequest {
  id: string;
  user_name: string;
  event_name: string;
  email: string;
  phone: string;
  city: string;
  event_location: string;
  status: 'pending' | 'approved' | 'rejected' | 'contacted';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEventRequestData {
  user_name: string;
  event_name: string;
  email: string;
  phone: string;
  city: string;
  event_location: string;
}

class EventRequestService {
  async createRequest(data: CreateEventRequestData): Promise<EventRequest> {
    // console.log('📤 Enviando solicitação:', data);

    const { data: result, error } = await invokeEdgeFunction<{ request: EventRequest }>('events-api', {
      body: { op: 'eventRequests.create', params: { data } },
      requiresAuth: false,
    });

    if (error) {
      // console.error('❌ Erro ao criar solicitação:', error);
      // console.error('Detalhes do erro:', {
      //   message: error.message,
      //   details: error.details,
      //   hint: error.hint,
      //   code: error.code
      // });
      throw new Error(`Falha ao enviar solicitação: ${error.message}`);
    }

    // console.log('✅ Solicitação criada:', request);
    if (!result?.request) throw new Error('Falha ao enviar solicitação');
    return result.request;
  }

  async getAllRequests(): Promise<EventRequest[]> {
    const { data, error } = await invokeEdgeFunction<{ requests: EventRequest[] }>('events-api', {
      body: { op: 'eventRequests.listAll' },
    });

    if (error) {
      // console.error('Erro ao buscar solicitações:', error);
      throw new Error('Falha ao buscar solicitações');
    }

    return data?.requests || [];
  }

  async updateRequestStatus(
    id: string,
    status: EventRequest['status'],
    notes?: string
  ): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'eventRequests.updateStatus', params: { id, status, notes } },
    });

    if (error) {
      // console.error('Erro ao atualizar status:', error);
      throw new Error('Falha ao atualizar status da solicitação');
    }
  }

  async deleteRequest(id: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'eventRequests.delete', params: { id } },
    });

    if (error) {
      // console.error('Erro ao deletar solicitação:', error);
      throw new Error('Falha ao deletar solicitação');
    }
  }
}

export const eventRequestService = new EventRequestService();


