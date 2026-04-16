import type { Match, MatchEventLink } from '@/services/match.service';

type MatchLike = Pick<Match, 'events' | 'event_titles' | 'event_title'>;

export const getMatchEvents = (match: MatchLike): MatchEventLink[] => {
  if (Array.isArray(match.events) && match.events.length > 0) {
    return match.events;
  }

  if (Array.isArray(match.event_titles) && match.event_titles.length > 0) {
    return match.event_titles.map((eventTitle, index) => ({
      event_id: String(index),
      event_title: eventTitle,
    }));
  }

  if (match.event_title) {
    return [{ event_id: '0', event_title: match.event_title }];
  }

  return [];
};

export const getMatchEventTitles = (match: MatchLike): string[] =>
  getMatchEvents(match)
    .map((event) => event.event_title)
    .filter(Boolean);

export const getPrimaryMatchEventTitle = (match: MatchLike): string =>
  getMatchEventTitles(match)[0] || 'Evento';

export const getMatchEventSummary = (match: MatchLike, maxVisible = 2): string => {
  const eventTitles = getMatchEventTitles(match);

  if (eventTitles.length === 0) {
    return 'Evento';
  }

  if (eventTitles.length <= maxVisible) {
    return eventTitles.join(' • ');
  }

  const visible = eventTitles.slice(0, maxVisible).join(' • ');
  return `${visible} +${eventTitles.length - maxVisible}`;
};

export const matchIncludesEvent = (match: MatchLike, eventTitle: string) =>
  getMatchEventTitles(match).some((title) => title.toLowerCase().includes(eventTitle.toLowerCase()));
