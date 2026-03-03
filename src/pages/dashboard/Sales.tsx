import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Ticket, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';

export function Sales() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalRevenue: number;
    totalTickets: number;
    averageTicketPrice: number;
  } | null>(null);

  useEffect(() => {
    async function loadSales() {
      if (!user) return;
      try {
        setLoading(true);

        const dashboardStats = await dashboardService.getStats(user.id);
        const totalRevenue = dashboardStats.totalRevenue;
        const totalTickets = dashboardStats.totalTicketsSold;
        const averageTicketPrice = totalTickets > 0 ? totalRevenue / totalTickets : 0;

        setStats({
          totalRevenue,
          totalTickets,
          averageTicketPrice,
        });
      } finally {
        setLoading(false);
      }
    }

    loadSales();
  }, [user]);

  if (loading) return <DashboardLoader />;
  if (!stats) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Organizador</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Soma apenas do valor do ingresso (sem taxa de servico)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingressos Vendidos</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTickets}</div>
            <p className="text-xs text-muted-foreground">
              Quantidade total de ingressos validos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Medio</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.averageTicketPrice)}
            </div>
            <p className="text-xs text-muted-foreground">
              Media liquida por ingresso vendido
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">
        {stats.totalTickets > 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <TrendingUp className="w-10 h-10 text-muted-foreground/50" />
            <p>Graficos detalhados de vendas serao disponibilizados em breve.</p>
          </div>
        ) : (
          <p>Nenhuma venda registrada ainda.</p>
        )}
      </div>
    </div>
  );
}

export default Sales;
