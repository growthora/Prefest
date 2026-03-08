import { supabase } from '../lib/supabase';

export interface Match {
  match_id: string;
  event_id: string;
  event_title: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string;
  created_at: string;
  chat_id: string;
  match_seen: boolean;
  chat_opened: boolean;
  status: 'active' | 'inactive';
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

class MatchService {
  // Listar matches do usuário
  async getUserMatches(): Promise<Match[]> {
    const { data, error } = await supabase.rpc('list_matches');

    if (error) throw error;
    return data || [];
  }

  async getMatchDetails(matchId: string): Promise<Match | null> {
    const { data, error } = await supabase.rpc('get_match_details', { p_match_id: matchId });
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  // Listar matches de um evento específico
  async getEventMatches(eventId: string): Promise<Match[]> {
    // Como a RPC list_matches não filtra por evento, vamos fazer uma query direta na view ou tabela se possível
    // Ou filtrar o resultado da RPC se ela retornar event_id
    const { data, error } = await supabase.rpc('list_matches');
    if (error) throw error;
    return (data || []).filter((m: Match) => m.event_id === eventId);
  }

  async markMatchSeen(matchId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_match_seen', { p_match_id: matchId });
    if (error) throw error;
  }

  async markChatOpened(matchId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_chat_opened', { p_match_id: matchId });
    if (error) throw error;
  }
}

export const matchService = new MatchService();

