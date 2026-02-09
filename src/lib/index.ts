export const ROUTE_PATHS = {
  HOME: '/',
  LOGIN: '/login',
  MY_EVENTS: '/meus-eventos',
  EVENTS: '/eventos',
  EVENT_DETAILS: '/eventos/:slug',
  CREATE_EVENT: '/eventos/criar',
  MATCHES: '/matches',
  MATCH_EVENT: '/match/:id',
  PROFILE: '/perfil',
  CHAT: '/chat/:matchId',
  EXPLORE: '/explorar-eventos',
  COLLECTION: '/colecao/:slug',
  HOW_IT_WORKS: '/como-funciona',
  SELL_TICKETS: '/venda-seus-ingressos',
  PRIVACY: '/privacidade',
  TERMS: '/termos-de-uso',
  SUPPORT: '/suporte',
  HELP_CENTER: '/central-de-ajuda',
  CONTACT_US: '/fale-conosco',
  FAQ: '/perguntas-frequentes',
  FORGOT_PASSWORD: '/esqueci-minha-senha',
  UPDATE_PASSWORD: '/atualizar-senha',
  ORGANIZER_DASHBOARD: '/dashboard/organizador',
  ORGANIZER_EVENTS: '/dashboard/organizador/eventos',
  ORGANIZER_SALES: '/dashboard/organizador/vendas',
  ORGANIZER_PARTICIPANTS: '/dashboard/organizador/participantes',
  ORGANIZER_PAYMENTS: '/dashboard/organizador/pagamentos',
  ORGANIZER_SETTINGS: '/dashboard/organizador/configuracoes',
  ORGANIZER_SCANNER: '/dashboard/organizador/scanner',
  TICKET_SCANNER: '/scanner',
} as const;

export type VibeType = 
  | 'curtir' 
  | 'dançar' 
  | 'conhecer pessoas' 
  | 'networking' 
  | 'romance' 
  | 'amizade' 
  | 'diversão';

export interface User {
  id: string;
  name: string;
  age: number | null;
  bio: string;
  photo: string;
  vibes?: VibeType[];
  isSingleMode: boolean;
  showInitialsOnly: boolean;
  matchIntention?: 'paquera' | 'amizade';
  genderPreference?: 'homens' | 'mulheres' | 'todos';
  sexuality?: string;
  lookingFor?: string[];
  badges?: string[];
  compatibilityScore?: number;
  height?: number | null;
  relationshipStatus?: string | null;
  isOnline?: boolean;
  lastSeen?: string | null;
  location?: {
    lat: number;
    lng: number;
    isAnonymous: boolean;
  };
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  date: string;
  time: string;
  location: string;
  address: string;
  city?: string | null;
  state?: string | null;
  event_type?: 'festive' | 'formal';
  price: number;
  image: string;
  description: string;
  category: string;
  attendeesCount: number;
  tags: string[];
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
}

export interface Match {
  id: string;
  eventId: string;
  userIds: [string, string];
  status: 'pending' | 'active' | 'expired';
  createdAt: string;
  expiresAt: string;
  lastMessage?: Message;
}

export interface AppConfig {
  appName: string;
  primaryColor: string;
  theme: 'dark';
  currentYear: number;
}

export const APP_CONFIG: AppConfig = {
  appName: 'Spark Events',
  primaryColor: '#FF007F',
  theme: 'dark',
  currentYear: 2026,
};