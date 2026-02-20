import React, { useEffect, useState } from 'react';
import { Wallet, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { eventService } from '@/services/event.service';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';

export function Payments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    async function loadBalance() {
      if (!user) return;
      try {
        setLoading(true);
        const events = await eventService.getEventsByCreator(user.id);
        const totalRevenue = events.reduce((acc, curr) => acc + (curr.revenue || 0), 0);
        setBalance(totalRevenue);
      } catch (error) {
        console.error('Failed to load balance', error);
      } finally {
        setLoading(false);
      }
    }
    loadBalance();
  }, [user]);

  if (loading) return <DashboardLoader />;
  if (balance === null) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Meus Pagamentos</h1>
        <Button 
          disabled 
          title="Funcionalidade em breve"
          className="self-start md:self-auto"
        >
          Solicitar Saque
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Disponível para saque
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <History className="w-5 h-5" />
             Histórico de Transações
           </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhum histórico de transação (saque) registrado.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Payments;
