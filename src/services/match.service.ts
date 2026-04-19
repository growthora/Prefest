import { invokeEdgeFunction } from '@/services/apiClient';

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
  async getUserMatches(eventId?: string): Promise<Match[]> {
    const { data, error } = await invokeEdgeFunction<{ matches: any[] }>('events-api', {
      body: { op: 'matches.list', params: { eventId } },
    });

    if (error) throw error;
    return (data?.matches || []).map(normalizeMatch);
  }

  async getMatchDetails(matchId: string): Promise<Match | null> {
    const { data, error } = await invokeEdgeFunction<{ match: any | null }>('events-api', {
      body: { op: 'matches.getDetails', params: { matchId } },
    });

    if (error) throw error;
    if (!data?.match) return null;
    return normalizeMatch(data.match);
  }

  async getEventMatches(eventId: string): Promise<Match[]> {
    const { data, error } = await invokeEdgeFunction<{ matches: any[] }>('events-api', {
      body: { op: 'matches.listForEvent', params: { eventId } },
    });

    if (error) throw error;
    return (data?.matches || []).map(normalizeMatch);
  }

  async markMatchSeen(matchId: string, eventId?: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'matches.markSeen', params: { matchId, eventId } },
    });

    if (error) throw error;
  }

  async markChatOpened(matchId: string, eventId?: string): Promise<void> {
    const { error } = await invokeEdgeFunction('events-api', {
      body: { op: 'matches.markChatOpened', params: { matchId, eventId } },
    });

    if (error) throw error;
  }
}

export const matchService = new MatchService();
