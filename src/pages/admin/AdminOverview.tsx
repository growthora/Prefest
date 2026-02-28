import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService, type UserWithStats } from '@/services/user.service';
import { eventService, type Event } from '@/services/event.service';
import { couponService } from '@/services/coupon.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Users, 
  BarChart3, 
  ArrowUpRight, 
  UserPlus,
  Plus,
  Ticket,
  Activity,
  AlertCircle,
  CheckCircle2,
  Settings
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Area, AreaChart } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';

export default function AdminOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [counts, setCounts] = useState({
    users: 0,
    coupons: 0,
    activeCoupons: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [statsData, eventsData, usersData, couponsData] = await Promise.all([
        userService.getStatistics(),
        eventService.getAllEvents(),
        userService.getUsersWithStats(),
        couponService.getAllCoupons()
      ]);

      setStatistics(statsData);
      setEvents(eventsData);
      setUsers(usersData);
      setCounts({
        users: usersData.length,
        coupons: couponsData.length,
        activeCoupons: couponsData.filter(c => c.active).length
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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
  const chartData = statistics?.eventStats
    ?.map((stat: any) => ({
      name: stat.event_title.length > 15 ? stat.event_title.substring(0, 15) + '...' : stat.event_title,
      revenue: stat.revenue,
      tickets: stat.tickets_sold,
      fullTitle: stat.event_title
    }))
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 5) || [];

  // Mock trend data for area chart
  const trendData = [
    { name: 'Jan', value: 4000 },
    { name: 'Fev', value: 3000 },
    { name: 'Mar', value: 2000 },
    { name: 'Abr', value: 2780 },
    { name: 'Mai', value: 1890 },
    { name: 'Jun', value: 2390 },
    { name: 'Jul', value: 3490 },
  ];

  const recentUsers = users.slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-8 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-xl border border-primary/10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Visão Geral
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo de volta, {user?.user_metadata?.full_name?.split(' ')[0]}. Aqui está o resumo da sua plataforma hoje.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border text-xs font-medium text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            Sistema Operacional
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "d 'de' MMMM, yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          onClick={() => navigate(ROUTE_PATHS.ADMIN_EVENTS)}
        >
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">Novo Evento</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          onClick={() => navigate(ROUTE_PATHS.ADMIN_USERS)}
        >
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserPlus className="h-4 w-4 text-blue-500" />
          </div>
          <span className="font-medium">Adicionar Usuário</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          onClick={() => navigate(ROUTE_PATHS.ADMIN_COUPONS)}
        >
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Ticket className="h-4 w-4 text-green-500" />
          </div>
          <span className="font-medium">Criar Cupom</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          onClick={() => navigate(ROUTE_PATHS.ADMIN_SETTINGS)}
        >
          <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Settings className="h-4 w-4 text-orange-500" />
          </div>
          <span className="font-medium">Configurações</span>
        </Button>
      </motion.div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 bg-gradient-to-br from-background to-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Total</CardTitle>
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center shadow-sm">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {statistics?.totalRevenue?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">+15%</span>
                <span className="ml-1">vs. mês passado</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 bg-gradient-to-br from-background to-blue-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lucro Estimado</CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shadow-sm">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">R$ {statistics?.profit?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Custos: R$ {statistics?.estimatedCosts?.toFixed(2) || '0.00'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 bg-gradient-to-br from-background to-purple-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Usuários</CardTitle>
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center shadow-sm">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.users}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                <UserPlus className="h-3 w-3 text-purple-500 mr-1" />
                <span className="text-purple-500 font-medium">+12</span>
                <span className="ml-1">novos esta semana</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 bg-gradient-to-br from-background to-orange-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Eventos Ativos</CardTitle>
              <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center shadow-sm">
                <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.totalEvents || 0}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs font-normal border-orange-200 text-orange-700 bg-orange-50">
                  {events.length} Total
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Revenue Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-4">
          <Card className="h-full border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Receita vs. Metas</CardTitle>
                  <CardDescription>Acompanhamento mensal de faturamento</CardDescription>
                </div>
                <Select value={selectedEventFilter} onValueChange={setSelectedEventFilter}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Filtrar por evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os eventos</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title.substring(0, 20)}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-3 shadow-lg ring-1 ring-black/5">
                                <p className="font-semibold mb-1 text-sm">{payload[0].payload.fullTitle}</p>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground flex justify-between gap-4">
                                    Receita: <span className="text-primary font-bold">R$ {Number(payload[0].value).toFixed(2)}</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground flex justify-between gap-4">
                                    Ingressos: <span className="font-medium">{payload[0].payload.tickets}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={24}>
                        {chartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={`hsl(var(--primary))`} fillOpacity={0.7 + (index * 0.05)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
                    <p>Sem dados suficientes para o gráfico</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Users & Activity */}
        <motion.div variants={itemVariants} className="lg:col-span-3 space-y-6">
          <Card className="h-full border-border/50 shadow-sm flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Novos Usuários</CardTitle>
                  <CardDescription>Últimos cadastros na plataforma</CardDescription>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="space-y-4">
                {recentUsers.map((user, i) => (
                  <div key={user.id || i} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border ring-2 ring-background group-hover:ring-primary/20 transition-all">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || 'User'} />
                        <AvatarFallback className="bg-primary/10 text-primary">{user.full_name?.substring(0, 2).toUpperCase() || 'US'}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-none">{user.full_name || 'Usuário sem nome'}</span>
                        <span className="text-xs text-muted-foreground mt-1">{user.email}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                      {user.created_at ? format(new Date(user.created_at), "d MMM", { locale: ptBR }) : '-'}
                    </div>
                  </div>
                ))}
                {recentUsers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    Nenhum usuário encontrado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Stats Table */}
      {statistics?.eventStats && (
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle>Performance Detalhada</CardTitle>
              <CardDescription>Métricas principais por evento</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 transition-colors hover:bg-muted/70">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Evento</th>
                      <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Status</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Ingressos</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Receita</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Conversão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statistics.eventStats
                      .filter((stat: any) => selectedEventFilter === 'all' || stat.event_id === selectedEventFilter)
                      .slice(0, 10)
                      .map((stat: any) => (
                        <tr key={stat.event_id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                          <td className="p-4 align-middle font-medium">{stat.event_title}</td>
                          <td className="p-4 align-middle text-center">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ativo</Badge>
                          </td>
                          <td className="p-4 align-middle text-right text-muted-foreground">{stat.tickets_sold}</td>
                          <td className="p-4 align-middle text-right font-semibold text-green-600">R$ {stat.revenue.toFixed(2)}</td>
                          <td className="p-4 align-middle text-right text-muted-foreground">
                            {stat.max_participants ? `${Math.round((stat.tickets_sold / stat.max_participants) * 100)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
