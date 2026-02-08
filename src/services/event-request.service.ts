import { supabase } from '@/lib/supabase';

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
    console.log('📤 Enviando solicitação:', data);
    
    const { data: request, error } = await supabase
      .from('event_requests')
      .insert([data])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar solicitação:', error);
      console.error('Detalhes do erro:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Falha ao enviar solicitação: ${error.message}`);
    }

    console.log('✅ Solicitação criada:', request);
    return request;
  }

  async getAllRequests(): Promise<EventRequest[]> {
    const { data, error } = await supabase
      .from('event_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar solicitações:', error);
      throw new Error('Falha ao buscar solicitações');
    }

    return data || [];
  }

  async updateRequestStatus(
    id: string,
    status: EventRequest['status'],
    notes?: string
  ): Promise<void> {
    const updateData: any = { status };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { error } = await supabase
      .from('event_requests')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar status:', error);
      throw new Error('Falha ao atualizar status da solicitação');
    }
  }

  async deleteRequest(id: string): Promise<void> {
    const { error } = await supabase
      .from('event_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar solicitação:', error);
      throw new Error('Falha ao deletar solicitação');
    }
  }
}

export const eventRequestService = new EventRequestService();
