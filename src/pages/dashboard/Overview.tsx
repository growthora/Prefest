import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { eventService, type Event } from '@/services/event.service';
import { dashboardService, type SalesChartData } from '@/services/dashboard.service';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Ticket, Users, Calendar, QrCode, TrendingUp, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';
import { ROUTE_PATHS } from '@/lib/index';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasEvents, setHasEvents] = useState(false);
  const [stats, setStats] = useState<{
    totalEvents: number;
    totalTicketsSold: number;
    totalRevenue: number;
    activeEvents: number;
  } | null>(null);
  const [salesData, setSalesData] = useState<SalesChartData[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);

  useEffect(() => {
    async function loadOverview() {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // 1. Carregar estatísticas gerais
        const dashboardStats = await dashboardService.getStats(user.id);
        
        if (dashboardStats.totalEvents > 0) {
          setHasEvents(true);
          setStats({
            totalEvents: dashboardStats.totalEvents,
            activeEvents: dashboardStats.activeEvents,
            totalTicketsSold: dashboardStats.totalTicketsSold,
            totalRevenue: dashboardStats.totalRevenue,
          });

          // 2. Carregar gráfico de vendas (últimos 7 dias)
          const chartData = await dashboardService.getSalesChart(user.id, 'week');
          setSalesData(chartData);

          // 3. Carregar próximos eventos
          const events = await eventService.getEventsByCreator(user.id);
          const upcoming = events
            .filter(e => new Date(e.event_date) > new Date())
            .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
            .slice(0, 5);
          setUpcomingEvents(upcoming);

        } else {
          setHasEvents(false);
        }
      } catch (error) {
        console.error('Failed to load dashboard overview', error);
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, [user]);

  if (loading) {
    return <DashboardLoader />;
  }

  if (!hasEvents || !stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full">
        <DashboardEmptyState 
          title="Comece sua jornada como organizador"
          description="Você ainda não criou nenhum evento. Crie seu primeiro evento agora e comece a vender ingressos."
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground mt-1">Acompanhe o desempenho dos seus eventos em tempo real.</p>
        </div>
        <Button onClick={() => navigate(ROUTE_PATHS.ORGANIZER_SCANNER)} className="w-full sm:w-auto shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
          <QrCode className="mr-2 h-4 w-4" />
          Scanner de Ingressos
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Total
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+12.5%</span>
              <span className="ml-1">vs. mês passado</span>
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ingressos Vendidos
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Ticket className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTicketsSold}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+8.2%</span>
              <span className="ml-1">vs. mês passado</span>
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eventos Ativos
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
               <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalEvents} eventos criados no total
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Participantes
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTicketsSold}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+24%</span>
              <span className="ml-1">novos usuários</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
        {/* Sales Chart */}
        <Card className="col-span-1 lg:col-span-4 hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Vendas Recentes</CardTitle>
                <CardDescription>Receita dos últimos 7 dias</CardDescription>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            {salesData.length > 0 && salesData.some(d => d.amount > 0) ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      dy={10}
                    />
                    <YAxis 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `R$${value}`} 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-lg ring-1 ring-black/5">
                              <div className="grid gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground font-semibold">
                                    Receita do Dia
                                  </span>
                                  <span className="font-bold text-lg text-primary">
                                    R$ {Number(payload[0].value).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/30">
                <TrendingUp className="h-10 w-10 mb-2 opacity-20" />
                <p>Nenhuma venda registrada nos últimos 7 dias</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Upcoming Events */}
        <Card className="col-span-1 lg:col-span-3 hover:shadow-md transition-shadow duration-200 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Próximos Eventos</CardTitle>
                <CardDescription>Eventos agendados futuramente</CardDescription>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="flex-1">
             <div className="space-y-4">
               {upcomingEvents.length > 0 ? (
                 upcomingEvents.map(event => (
                   <div key={event.id} className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(ROUTE_PATHS.ORGANIZER_EVENTS)}>
                     <div className="flex items-center gap-4">
                       <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                         {event.banner_url ? (
                           <img src={event.banner_url} alt={event.title} className="h-full w-full object-cover" />
                         ) : (
                           <Calendar className="h-6 w-6 text-muted-foreground" />
                         )}
                       </div>
                       <div className="flex flex-col">
                         <span className="font-semibold truncate max-w-[150px] group-hover:text-primary transition-colors">{event.title}</span>
                         <span className="text-xs text-muted-foreground flex items-center gap-1">
                           <Clock className="h-3 w-3" />
                           {new Date(event.event_date).toLocaleDateString()}
                         </span>
                       </div>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                       <Badge variant="secondary" className="text-xs font-normal">
                         {event.current_participants} confirmados
                       </Badge>
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="h-full flex flex-col items-center justify-center py-8 text-center space-y-3">
                   <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                     <Calendar className="h-6 w-6 text-muted-foreground" />
                   </div>
                   <div className="space-y-1">
                     <p className="font-medium">Nenhum evento próximo</p>
                     <p className="text-sm text-muted-foreground">Crie um novo evento para começar.</p>
                   </div>
                   <Button variant="outline" size="sm" onClick={() => navigate(ROUTE_PATHS.CREATE_EVENT)}>
                     Criar Evento
                   </Button>
                 </div>
               )}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Overview;
