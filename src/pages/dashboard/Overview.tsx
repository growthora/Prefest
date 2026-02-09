import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { eventService, type Event } from '@/services/event.service';
import { dashboardService, type SalesChartData } from '@/services/dashboard.service';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Ticket, Users, Calendar, QrCode } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ROUTE_PATHS } from '@/lib/index';

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        <Button onClick={() => navigate(ROUTE_PATHS.ORGANIZER_SCANNER)}>
          <QrCode className="mr-2 h-4 w-4" />
          Scanner
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Receita Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Receita bruta acumulada
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingressos Vendidos
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTicketsSold}</div>
            <p className="text-xs text-muted-foreground">
              Total de vendas confirmadas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Eventos Ativos
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeEvents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalEvents} eventos criados no total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Participantes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTicketsSold}</div>
            <p className="text-xs text-muted-foreground">
              Total de participantes
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Vendas Recentes (Últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {salesData.length > 0 && salesData.some(d => d.amount > 0) ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `R$${value}`} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    Receita
                                  </span>
                                  <span className="font-bold text-muted-foreground">
                                    R$ {payload[0].value}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="currentColor" 
                      radius={[4, 4, 0, 0]} 
                      className="fill-primary" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-md bg-muted/50">
                Nenhuma venda nos últimos 7 dias
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Próximos Eventos</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {upcomingEvents.length > 0 ? (
                 upcomingEvents.map(event => (
                   <div key={event.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                     <div className="flex flex-col">
                       <span className="font-medium truncate max-w-[150px]">{event.title}</span>
                       <span className="text-xs text-muted-foreground">
                         {new Date(event.event_date).toLocaleDateString()}
                       </span>
                     </div>
                     <div className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                       {event.current_participants} confirmados
                     </div>
                   </div>
                 ))
               ) : (
                 <p className="text-sm text-muted-foreground py-4 text-center">
                   Nenhum evento agendado futuramente.
                 </p>
               )}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
