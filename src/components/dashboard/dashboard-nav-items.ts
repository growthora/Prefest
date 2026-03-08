import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  Users,
  Wallet,
  Settings,
  QrCode,
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';

export const organizerDashboardNavItems = [
  {
    title: 'Visao Geral',
    href: ROUTE_PATHS.ORGANIZER_DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    title: 'Meus Eventos',
    href: ROUTE_PATHS.ORGANIZER_EVENTS,
    icon: Calendar,
  },
  {
    title: 'Vendas',
    href: ROUTE_PATHS.ORGANIZER_SALES,
    icon: TrendingUp,
  },
  {
    title: 'Participantes',
    href: ROUTE_PATHS.ORGANIZER_PARTICIPANTS,
    icon: Users,
  },
  {
    title: 'Scanner',
    href: ROUTE_PATHS.ORGANIZER_SCANNER,
    icon: QrCode,
  },
  {
    title: 'Equipe',
    href: ROUTE_PATHS.ORGANIZER_TEAM,
    icon: Users,
  },
  {
    title: 'Meus Pagamentos',
    href: ROUTE_PATHS.ORGANIZER_PAYMENTS,
    icon: Wallet,
  },
  {
    title: 'Configuracoes',
    href: ROUTE_PATHS.ORGANIZER_SETTINGS,
    icon: Settings,
  },
];

export const equipeDashboardNavItems = [
  {
    title: 'Painel da Equipe',
    href: ROUTE_PATHS.ORGANIZER_DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    title: 'Scanner',
    href: ROUTE_PATHS.ORGANIZER_SCANNER,
    icon: QrCode,
  },
];

export const dashboardNavItems = organizerDashboardNavItems;

