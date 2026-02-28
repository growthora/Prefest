import { useState, useEffect } from 'react';
import { userService } from '@/services/user.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { eventService, type Event } from '@/services/event.service';
import { DollarSign, TrendingUp, Percent, Calendar, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';

export default function AdminStats() {
  const [statistics, setStatistics] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [statsData, eventsData] = await Promise.all([
        userService.getStatistics(),
        eventService.getAllEvents(),
      ]);

      setStatistics(statsData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  // Prepare chart data
  const revenueData = statistics?.eventStats
    ?.map((stat: any) => ({
      name: stat.event_title.length > 15 ? stat.event_title.substring(0, 15) + '...' : stat.event_title,
      value: stat.revenue,
      fullTitle: stat.event_title
    }))
    .filter((d: any) => d.value > 0)
    .sort((a: any, b: any) => b.value - a.value) || [];

  const ticketsData = statistics?.eventStats
    ?.map((stat: any) => ({
      name: stat.event_title.length > 15 ? stat.event_title.substring(0, 15) + '...' : stat.event_title,
      tickets: stat.tickets_sold,
      fullTitle: stat.event_title
    }))
    .sort((a: any, b: any) => b.tickets - a.tickets) || [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estatísticas Detalhadas</h1>
          <p className="text-muted-foreground mt-1">
            Análise detalhada do desempenho da plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Select value={selectedEventFilter} onValueChange={setSelectedEventFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {statistics?.totalRevenue?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground">
                Receita bruta
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Estimado</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">R$ {statistics?.profit?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground">
                Após dedução de custos
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.profitMargin?.toFixed(1) || '0.0'}%</div>
              <p className="text-xs text-muted-foreground">
                Rentabilidade média
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.totalEvents || 0}</div>
              <p className="text-xs text-muted-foreground">
                Cadastrados na plataforma
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Share Chart */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Distribuição de Receita</CardTitle>
                  <CardDescription>Participação de cada evento no faturamento</CardDescription>
                </div>
                <PieChartIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {revenueData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Sem dados de receita
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tickets Sold Chart */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Venda de Ingressos</CardTitle>
                  <CardDescription>Quantidade de ingressos por evento</CardDescription>
                </div>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {ticketsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ticketsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="tickets" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20}>
                        {ticketsData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Sem dados de ingressos
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {statistics?.eventStats && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Performance por Evento</CardTitle>
              <CardDescription>Análise detalhada de cada evento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statistics.eventStats
                  .filter((stat: any) => selectedEventFilter === 'all' || stat.event_id === selectedEventFilter)
                  .map((stat: any) => (
                    <div key={stat.event_id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{stat.event_title}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                           <div>
                              <p className="text-xs text-muted-foreground">Ingressos Vendidos</p>
                              <p className="font-medium">{stat.tickets_sold}</p>
                           </div>
                           <div>
                              <p className="text-xs text-muted-foreground">Preço do Ingresso</p>
                              <p className="font-medium">R$ {stat.event_price.toFixed(2)}</p>
                           </div>
                           <div>
                              <p className="text-xs text-muted-foreground">Receita Bruta</p>
                              <p className="font-medium text-green-600">R$ {stat.revenue.toFixed(2)}</p>
                           </div>
                           <div>
                              <p className="text-xs text-muted-foreground">Taxa de Ocupação</p>
                              <p className="font-medium">
                                {stat.max_participants ? `${Math.round((stat.tickets_sold / stat.max_participants) * 100)}%` : 'N/A'}
                              </p>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
