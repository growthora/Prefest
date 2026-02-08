import { supabase } from '../lib/supabase';

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  event_id: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}
class MatchService {
  // Criar novo match
  async createMatch(user1Id: string, user2Id: string, eventId?: string): Promise<Match> {
    const { data, error } = await supabase
      .from('matches')
      .insert({
        user1_id: user1Id,
        user2_id: user2Id,
        event_id: eventId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Listar matches do usuário
  async getUserMatches(userId: string): Promise<Match[]> {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Aceitar match
  async acceptMatch(matchId: string): Promise<Match> {
    const { data, error } = await supabase
      .from('matches')
      .update({ status: 'accepted' } as any)
      .eq('id', matchId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Rejeitar match
  async rejectMatch(matchId: string): Promise<Match> {
    const { data, error } = await supabase
      .from('matches')
      .update({ status: 'rejected' } as any)
      .eq('id', matchId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Enviar mensagem
  async sendMessage(matchId: string, senderId: string, content: string): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        match_id: matchId,
        sender_id: senderId,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Listar mensagens de um match
  async getMatchMessages(matchId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Marcar mensagens como lidas
  async markMessagesAsRead(matchId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() } as any)
      .eq('match_id', matchId)
      .neq('sender_id', userId)
      .is('read_at', null);

    if (error) throw error;
  }

  // Inscrever-se em novas mensagens
  subscribeToMessages(matchId: string, callback: (message: Message) => void) {
    return supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .subscribe();
  }
}

export const matchService = new MatchService();
