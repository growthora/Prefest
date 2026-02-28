import { 
  LayoutDashboard, 
  Calendar, 
  TrendingUp, 
  Users, 
  Wallet, 
  Settings, 
  QrCode 
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';

export const dashboardNavItems = [
  {
    title: "Visão Geral",
    href: ROUTE_PATHS.ORGANIZER_DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    title: "Meus Eventos",
    href: ROUTE_PATHS.ORGANIZER_EVENTS,
    icon: Calendar,
  },
  {
    title: "Vendas",
    href: ROUTE_PATHS.ORGANIZER_SALES,
    icon: TrendingUp,
  },
  {
    title: "Participantes",
    href: ROUTE_PATHS.ORGANIZER_PARTICIPANTS,
    icon: Users,
  },
  {
    title: "Scanner",
    href: ROUTE_PATHS.ORGANIZER_SCANNER,
    icon: QrCode,
  },
  {
    title: "Meus Pagamentos",
    href: ROUTE_PATHS.ORGANIZER_PAYMENTS,
    icon: Wallet,
  },
  {
    title: "Configurações",
    href: ROUTE_PATHS.ORGANIZER_SETTINGS,
    icon: Settings,
  },
];
