export const ROUTE_PATHS = {
  HOME: '/',
  LOGIN: '/login',
  MY_EVENTS: '/meus-eventos',
  DELETE_ACCOUNT: '/deletar-conta',
  EVENTS: '/eventos',
  EVENT_DETAILS: '/eventos/:slug',
  EVENT_MATCHES: '/eventos/:eventId/matchs',
  TICKET_DETAILS: '/ingressos/:ticketId',
  CREATE_EVENT: '/eventos/criar',
  // MATCHES route removed - matches are now handled via chat direct access
  PROFILE: '/perfil',
  COMPLETE_PROFILE: '/perfil/completar-cadastro',
  PUBLIC_PROFILE: '/perfil-publico/:slug',
  CHAT_LIST: '/chat',
  CHAT: '/chat/:matchId',
  MOBILE_CHAT_LIST: '/m/chat',
  MOBILE_CHAT: '/m/chat/:matchId',
  EXPLORE: '/explorar-eventos',
  EM_ALTA: '/em-alta',
  CATEGORIES: '/categorias',
  NEWS: '/novidades',
  COLLECTION: '/colecao/:slug',
  HOW_IT_WORKS: '/como-funciona',
  SELL_TICKETS: '/venda-seus-ingressos',
  PRIVACY: '/privacidade',
  TERMS: '/termos-de-uso',
  SUPPORT: '/suporte',
  HELP_CENTER: '/central-de-ajuda',
  CONTACT_US: '/fale-conosco',
  FAQ: '/perguntas-frequentes',
  REFUND_REQUESTS: '/reembolsos',
  STATUS: '/status',
  FORGOT_PASSWORD: '/esqueci-minha-senha',
  UPDATE_PASSWORD: '/reset-password',
  AUTH_ERROR: '/auth/error',
  DEBUG_AUTH: '/debug-auth',
  ORGANIZER_DASHBOARD: '/dashboard/organizador',
  ORGANIZER_EVENTS: '/dashboard/organizador/eventos',
  ORGANIZER_SALES: '/dashboard/organizador/vendas',
  ORGANIZER_PARTICIPANTS: '/dashboard/organizador/participantes',
  ORGANIZER_PAYMENTS: '/dashboard/organizador/pagamentos',
  ORGANIZER_SETTINGS: '/dashboard/organizador/configuracoes',
  ORGANIZER_TEAM: '/dashboard/organizador/equipe',
  ORGANIZER_SCANNER: '/dashboard/organizador/scanner',
  TICKET_SCANNER: '/scanner',
  ADMIN_DASHBOARD: '/admin',
  ADMIN_EVENTS: '/admin/eventos',
  ADMIN_COUPONS: '/admin/cupons',
  ADMIN_REQUESTS: '/admin/solicitacoes',
  ADMIN_ORGANIZERS: '/admin/organizadores',
  ADMIN_USERS: '/admin/usuarios',
  ADMIN_STATS: '/admin/estatisticas',
  ADMIN_FINANCIAL: '/admin/financeiro',
  ADMIN_SETTINGS: '/admin/configuracoes',
  ADMIN_SUPPORT: '/admin/suporte',
  ADMIN_REFUNDS: '/admin/reembolsos',
} as const;

export function buildEventDetailsPath(slugOrId: string) {
  return ROUTE_PATHS.EVENT_DETAILS.replace(':slug', slugOrId);
}

export function buildCollectionPath(slug: string) {
  return ROUTE_PATHS.COLLECTION.replace(':slug', slug);
}

export type VibeType = 
  | 'curtir' 
  | 'dancar' 
  | 'conhecer pessoas' 
  | 'networking' 
  | 'romance' 
  | 'amizade' 
  | 'diversao';

export type MatchGenderPreferenceValue = 'todos' | string;

export interface User {
  id: string;
  name: string;
  age: number | null;
  bio: string;
  photo: string;
  vibes?: VibeType[];
  isSingleMode: boolean;
  showInitialsOnly: boolean;
  matchIntention?: 'paquera' | 'amizade' | 'networking' | 'casual' | 'serio' | null;
  genderPreference?: MatchGenderPreferenceValue[] | null;
  genderIdentity?: string | null;
  sexuality?: string;
  lookingFor?: string[];
  badges?: string[];
  compatibilityScore?: number;
  height?: number | null;
  relationshipStatus?: string | null;
  isOnline?: boolean;
  lastSeen?: string | null;
  likedYou?: boolean;
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
  event_start_at?: string | null;
  event_end_at?: string | null;
  end_at?: string | null;
  location: string;
  address: string;
  city?: string | null;
  state?: string | null;
  image: string;
  images?: string[];
  category: string;
  tags?: string[];
  event_type?: 'festive' | 'formal';
  price?: string | number;
  display_price_label?: string;
  display_price_value?: number;
  is_free_event?: boolean;
  organizer?: {
    id: string;
    name: string;
    avatar: string;
  };
  description: string;
  attendeesCount: number;
  status?: 'draft' | 'published' | 'realizado';
  sales_enabled?: boolean;
  isLiked?: boolean;
}

export interface Match {
  id: string;
  eventId: string;
  userIds: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  expiresAt: string;
  partner: {
    id: string;
    name: string;
    photo: string;
  };
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export const APP_CONFIG = {
  primaryColor: '#FF007F', // Social Spark Pink
};

// // Configuracao global de provedor de email para autenticacao
// // SUPABASE: Usa o servico nativo do Supabase Auth (RECOMENDADO/OBRIGATORIO)
// CUSTOM: Usa SMTP do banco via Edge Functions (PROIBIDO para Auth)
export const AUTH_EMAIL_PROVIDER: 'SUPABASE' | 'CUSTOM' = 'SUPABASE';

// Contexto de envio de email
export enum EMAIL_CONTEXT {
  AUTH = 'AUTH',   // signup, reset password, magic link, change email, reauthentication
    CUSTOM = 'CUSTOM' // notificacoes, marketing, eventos, admin
}

// Regra: SMTP do banco permitido SOMENTE em CUSTOM
export const ALLOWED_SMTP_CONTEXTS = [EMAIL_CONTEXT.CUSTOM];






