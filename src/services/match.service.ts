import { supabase } from '../lib/supabase';

export interface MatchEventLink {
  event_id: string;
  event_title: string;
}

export interface Match {
  match_id: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string;
  created_at: string;
  last_interaction_at?: string;
  chat_id: string | null;
  match_seen: boolean;
  chat_opened: boolean;
  status: 'active' | 'inactive';
  last_message?: string;
  last_message_time?: string;
  last_message_at?: string;
  unread_count?: number;
  event_id?: string | null;
  event_title: string;
  event_ids: string[];
  event_titles: string[];
  event_count: number;
  events: MatchEventLink[];
}

const normalizeMatchEvents = (row: any): MatchEventLink[] => {
  if (Array.isArray(row?.events)) {
    return row.events
      .map((event) => ({
        event_id: String(event?.event_id || ''),
        event_title: String(event?.event_title || ''),
      }))
      .filter((event) => event.event_id && event.event_title);
  }

  const eventIds = Array.isArray(row?.event_ids) ? row.event_ids : [];
  const eventTitles = Array.isArray(row?.event_titles) ? row.event_titles : [];

  return eventIds
    .map((eventId: unknown, index: number) => ({
      event_id: String(eventId || ''),
      event_title: String(eventTitles[index] || ''),
    }))
    .filter((event) => event.event_id && event.event_title);
};

const normalizeMatch = (row: any): Match => {
  const events = normalizeMatchEvents(row);
  const eventIds = events.map((event) => event.event_id);
  const eventTitles = events.map((event) => event.event_title);
  const primaryEvent = events[0];

  return {
    match_id: String(row?.match_id || ''),
    partner_id: String(row?.partner_id || ''),
    partner_name: String(row?.partner_name || 'Usuario'),
    partner_avatar: String(row?.partner_avatar || ''),
    created_at: String(row?.created_at || ''),
    last_interaction_at: row?.last_interaction_at ? String(row.last_interaction_at) : undefined,
    chat_id: row?.chat_id ? String(row.chat_id) : null,
    match_seen: Boolean(row?.match_seen),
    chat_opened: Boolean(row?.chat_opened),
    status: row?.status === 'inactive' ? 'inactive' : 'active',
    last_message: row?.last_message ? String(row.last_message) : undefined,
    last_message_time: row?.last_message_time ? String(row.last_message_time) : undefined,
    last_message_at: row?.last_message_time ? String(row.last_message_time) : undefined,
    unread_count: typeof row?.unread_count === 'number' ? row.unread_count : Number(row?.unread_count || 0),
    event_id: primaryEvent?.event_id || (row?.event_id ? String(row.event_id) : null),
    event_title:
      primaryEvent?.event_title ||
      String(row?.event_title || 'Evento'),
    event_ids: eventIds,
    event_titles: eventTitles,
    event_count: Number(row?.event_count || events.length || 0),
    events,
  };
};

class MatchService {
  async getUserMatches(): Promise<Match[]> {
    const { data, error } = await supabase.rpc('list_matches');

    if (error) throw error;
    return (data || []).map(normalizeMatch);
  }

  async getMatchDetails(matchId: string): Promise<Match | null> {
    const { data, error } = await supabase.rpc('get_match_details', { p_match_id: matchId });

    if (error) throw error;

    if (!data || data.length === 0) {
      return null;
    }

    return normalizeMatch(data[0]);
  }

  async getEventMatches(eventId: string): Promise<Match[]> {
    const { data, error } = await supabase.rpc('list_event_matches', {
      p_event_id: eventId,
    });

    if (!error) {
      return (data || []).map(normalizeMatch);
    }

    if (error.code !== '42883') {
      throw error;
    }

    const matches = await this.getUserMatches();
    return matches.filter((match) => match.event_ids.includes(eventId));
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
