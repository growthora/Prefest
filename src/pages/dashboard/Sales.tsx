import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Clock3, TrendingUp, Receipt, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService, type OrganizerFinancialTransaction } from '@/services/dashboard.service';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';
import { Button } from '@/components/ui/button';

type SalesStats = {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalPlatformFees: number;
  availableBalance: number;
  pendingBalance: number;
};

const PAGE_SIZE = 8;
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatPaymentMethod(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'credit_card') return 'Cartao de credito';
  if (normalized === 'debit_card') return 'Cartao de debito';
  if (normalized === 'boleto') return 'Boleto';
  if (normalized === 'pix') return 'Pix';
  return value;
}

function formatStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'paid' || normalized === 'received' || normalized === 'confirmed') return 'Recebido';
  if (normalized === 'pending') return 'Pendente';
  if (normalized === 'overdue') return 'Vencido';
  if (normalized === 'refunded') return 'Estornado';
  return value;
}

export function Sales() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [transactions, setTransactions] = useState<OrganizerFinancialTransaction[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadSales() {
      if (!user) return;
      try {
        setLoading(true);
        const [dashboardStats, financialTransactions] = await Promise.all([
          dashboardService.getStats(user.id),
          dashboardService.getFinancialTransactions(user.id),
        ]);

        setStats({
          totalGrossRevenue: dashboardStats.totalGrossRevenue,
          totalNetRevenue: dashboardStats.totalNetRevenue,
          totalPlatformFees: dashboardStats.totalPlatformFees,
          availableBalance: dashboardStats.availableBalance,
          pendingBalance: dashboardStats.pendingBalance,
        });
        setTransactions(financialTransactions);
      } finally {
        setLoading(false);
      }
    }

    loadSales();
  }, [user]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return transactions.slice(start, start + PAGE_SIZE);
  }, [page, transactions]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (loading) return <DashboardLoader />;
  if (!stats) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Painel financeiro compatível com o split atual do Asaas. O repasse do organizador continua sendo calculado
          a partir do split registrado no pagamento. Nao foi implementado saque porque o modelo atual nao garante
          transferencia segura para todas as carteiras vinculadas sem revisar a integracao de contas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo disponivel</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(stats.availableBalance)}</div>
            <p className="text-xs text-muted-foreground">
              Baseado nos pagamentos confirmados e no split aplicado ao organizador.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo pendente</CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(stats.pendingBalance)}</div>
            <p className="text-xs text-muted-foreground">
              Valor previsto para pagamentos ainda pendentes no fluxo atual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total vendido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(stats.totalGrossRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Valor bruto pago pelos clientes, incluindo taxa da plataforma.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxas aplicadas</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(stats.totalPlatformFees)}</div>
            <p className="text-xs text-muted-foreground">
              Taxa fixa da plataforma conforme split atual, sem alterar checkout ou webhook.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historico de transacoes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Lista interna conciliada com pagamentos e splits ja registrados no sistema.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {transactions.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma transacao financeira encontrada para este organizador.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data</th>
                      <th className="px-4 py-3 font-medium">Evento</th>
                      <th className="px-4 py-3 font-medium">Comprador</th>
                      <th className="px-4 py-3 font-medium">Metodo</th>
                      <th className="px-4 py-3 font-medium">Bruto</th>
                      <th className="px-4 py-3 font-medium">Taxa</th>
                      <th className="px-4 py-3 font-medium">Liquido</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-t">
                        <td className="px-4 py-3">{formatDate(transaction.date)}</td>
                        <td className="px-4 py-3">{transaction.eventName}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{transaction.buyerName}</div>
                          <div className="text-xs text-muted-foreground">{transaction.buyerEmail}</div>
                        </td>
                        <td className="px-4 py-3">{formatPaymentMethod(transaction.paymentMethod)}</td>
                        <td className="px-4 py-3">{currencyFormatter.format(transaction.grossAmount)}</td>
                        <td className="px-4 py-3">{currencyFormatter.format(transaction.platformFee)}</td>
                        <td className="px-4 py-3 font-medium">{currencyFormatter.format(transaction.netAmount)}</td>
                        <td className="px-4 py-3">{formatStatus(transaction.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Pagina {page} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                    Proxima
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Sales;