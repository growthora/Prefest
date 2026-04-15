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

  async getEventMatches(eventId: string): Promise<Match[]> {
    const { data, error } = await supabase.rpc('list_event_matches', {
      p_event_id: eventId,
    });

    if (!error) {
      return data || [];
    }

    if (error.code !== '42883') {
      throw error;
    }

    const matches = await this.getUserMatches();
    return matches.filter((match) => match.event_id === eventId);
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
