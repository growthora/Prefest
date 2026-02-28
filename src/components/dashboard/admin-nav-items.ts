import { 
  LayoutDashboard, 
  Calendar, 
  Ticket, 
  FileCheck, 
  Users, 
  UserCog, 
  BarChart3,
  DollarSign,
  Settings,
  HeadphonesIcon
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';

export const adminNavItems = [
  {
    title: "Visão Geral",
    href: ROUTE_PATHS.ADMIN_DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    title: "Eventos",
    href: ROUTE_PATHS.ADMIN_EVENTS,
    icon: Calendar,
  },
  {
    title: "Cupons",
    href: ROUTE_PATHS.ADMIN_COUPONS,
    icon: Ticket,
  },
  {
    title: "Solicitações",
    href: ROUTE_PATHS.ADMIN_REQUESTS,
    icon: FileCheck,
  },
  {
    title: "Organizadores",
    href: ROUTE_PATHS.ADMIN_ORGANIZERS,
    icon: UserCog,
  },
  {
    title: "Usuários",
    href: ROUTE_PATHS.ADMIN_USERS,
    icon: Users,
  },
  {
    title: "Estatísticas",
    href: ROUTE_PATHS.ADMIN_STATS,
    icon: BarChart3,
  },
  {
    title: "Financeiro",
    href: ROUTE_PATHS.ADMIN_FINANCIAL,
    icon: DollarSign,
  },
  {
    title: "Suporte",
    href: ROUTE_PATHS.ADMIN_SUPPORT,
    icon: HeadphonesIcon,
  },
  {
    title: "Configurações",
    href: ROUTE_PATHS.ADMIN_SETTINGS,
    icon: Settings,
  },
];
