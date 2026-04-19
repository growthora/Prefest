import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Wallet, CreditCard, Download, Search, Calendar, Filter, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { toUserFriendlyErrorMessage } from '@/lib/appErrors';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from '@/utils/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { invokeEdgeRoute } from '@/services/apiClient';

interface FinancialOverview {
  total_gross_sales: number;
  total_service_fees: number;
  platform_profit: number;
  platform_margin_percent?: number;
  organizer_revenue: number;
  organizer_splits: number;
  pending_balance: number;
  total_refunded: number;
  daily_sales: { date: string; total: number }[];
  top_organizers: { name: string; sales_count: number; total_value: number }[];
}

interface Payment {
  id: string;
  external_payment_id: string;
  value: number;
  status: string;
  created_at: string;
  payment_method: string;
  buyer_name: string;
  buyer_email: string;
  organizer_name: string;
  event_title: string;
}

export default function AdminFinancial() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<FinancialOverview | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [reconcileId, setReconcileId] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // Basic frontend role check (backend is the real gatekeeper)
      if (!isAdmin) {
          toast.error('Acesso não autorizado');
          return;
      }
      loadData();
    }
  }, [user, isAdmin, authLoading, activeTab, page, statusFilter, dateStart, dateEnd]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const queryParams = new URLSearchParams();
      if (dateStart) queryParams.append('dateStart', dateStart);
      if (dateEnd) queryParams.append('dateEnd', dateEnd);

      if (activeTab === 'overview') {
        const { data, error } = await invokeEdgeRoute(`financial-api/admin/overview?${queryParams.toString()}`, {
          method: 'GET',
        });
        if (error) throw error;
        
        // Map backend response to frontend interface
        setOverview({
          total_gross_sales: data.total_gross_sales ?? data.total_sales ?? data.total_revenue ?? 0,
          total_service_fees: data.total_service_fees ?? data.platform_fees ?? 0,
          platform_profit: data.platform_profit ?? 0,
          platform_margin_percent: data.platform_margin_percent ?? ((data.total_gross_sales ?? data.total_sales ?? data.total_revenue ?? 0) > 0 ? (((data.total_service_fees ?? data.platform_fees ?? 0) / (data.total_gross_sales ?? data.total_sales ?? data.total_revenue ?? 0)) * 100) : 0),
          organizer_revenue: data.organizer_revenue ?? data.organizer_splits ?? 0,
          organizer_splits: data.organizer_splits ?? data.organizer_revenue ?? 0,
          pending_balance: data.pending_balance ?? 0,
          total_refunded: data.total_refunded ?? 0,
          daily_sales: data.daily_sales ?? data.daily_revenue ?? [], 
          top_organizers: data.top_organizers ?? []
        });
      } else if (activeTab === 'transactions') {
        queryParams.append('page', page.toString());
        queryParams.append('pageSize', '20');
        if (statusFilter !== 'all') queryParams.append('status', statusFilter);

        const { data, error } = await invokeEdgeRoute(`financial-api/admin/transactions?${queryParams.toString()}`, {
          method: 'GET',
        });
        if (error) throw error;
        
        // Map backend response to frontend interface
        const paymentData = Array.isArray(data) ? data : (data.data || []);
        const totalCount = (Array.isArray(data) ? 0 : data.total) || 0; // Fallback 0 if unknown

        const mappedPayments = paymentData.map((p: any) => ({
          id: p.id,
          external_payment_id: p.external_id || p.external_payment_id,
          value: p.amount ?? p.value ?? 0,
          status: p.status,
          created_at: p.created_at,
          payment_method: p.method || p.payment_method,
          buyer_name: p.customer_name,
          buyer_email: p.customer_email,
          organizer_name: p.organizer_name || 'N/A',
          event_title: p.event_title || 'N/A'
        }));

        setPayments(mappedPayments);
        // If total is unknown, we can't calculate pages accurately. 
        // If we received full page (20), assume there might be more.
        const estimatedTotal = totalCount > 0 ? totalCount : (mappedPayments.length === 20 ? (page + 1) * 20 : page * 20);
        setTotalPages(Math.ceil(estimatedTotal / 20));
      }

    } catch (error: any) {
      // console.error('Erro detalhado ao carregar dados financeiros:', error);
      toast.error(toUserFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconcile = async (paymentId: string) => {
    if (!paymentId) return;
    try {
        toast.loading('Conciliando pagamento...', { id: 'reconcile' });
        const { data, error } = await invokeEdgeRoute(`financial-api/admin/reconcile/${paymentId}`, {
          method: 'POST',
        });
        if (error) throw error;
        
        toast.dismiss('reconcile');
        if (data?.reconciled || data?.success) {
            const statusInfo = data?.newStatus || data?.status || '-';
            toast.success(`Pagamento conciliado! Status: ${statusInfo}`);
            loadData(); // Refresh list
        } else {
            toast.error('Erro na conciliação');
        }
    } catch (err: any) {
        toast.dismiss('reconcile');
        toast.error('Falha ao conciliar: ' + err.message);
    }
  };

  const handleReconcileAll = async () => {
    try {
      toast.loading('Conciliando pagamentos em lote...', { id: 'reconcile-all' });
      const { data, error } = await invokeEdgeRoute('financial-api/admin/reconcile-all?limit=500', {
        method: 'POST',
      });
      if (error) throw error;

      toast.dismiss('reconcile-all');
      toast.success(
        `Lote concluído: ${data?.updated ?? 0} atualizados, ${data?.failed ?? 0} falhas (de ${data?.scanned ?? 0}).`
      );
      loadData();
    } catch (err: any) {
      toast.dismiss('reconcile-all');
      toast.error('Falha na conciliação em lote: ' + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'RECEIVED': 'bg-green-100 text-green-800',
      'CONFIRMED': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'overdue': 'bg-red-100 text-red-800',
      'refunded': 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={statusMap[status] || 'bg-gray-100 text-gray-800'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (!user) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <motion.div 
      className="space-y-8 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral de receitas, repasses e transações do sistema.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 items-end md:items-center">
            <div className="flex items-center gap-2">
                <Input 
                    type="date" 
                    value={dateStart} 
                    onChange={(e) => setDateStart(e.target.value)} 
                    className="w-40"
                    placeholder="Data Início"
                />
                <span className="text-muted-foreground">-</span>
                <Input 
                    type="date" 
                    value={dateEnd} 
                    onChange={(e) => setDateEnd(e.target.value)} 
                    className="w-40"
                    placeholder="Data Fim"
                />
            </div>
          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <Calendar className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button disabled>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="reconciliation">Conciliação</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {overview ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">GMV Total</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(overview.total_gross_sales)}</div>
                      <p className="text-xs text-muted-foreground">Total pago pelos clientes</p>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Receita Prefest</CardTitle>
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(overview.total_service_fees)}</div>
                      <p className="text-xs text-muted-foreground">Soma das taxas da plataforma</p>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Repasse Líquido Organizadores</CardTitle>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-600">{formatCurrency(overview.organizer_revenue)}</div>
                      <p className="text-xs text-muted-foreground">Total líquido devido aos organizadores</p>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Margem Prefest</CardTitle>
                      <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{(overview.platform_margin_percent ?? 0).toFixed(2) + "%"}</div>
                      <p className="text-xs text-muted-foreground">Receita Prefest / GMV</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                  <CardHeader>
                    <CardTitle>Vendas nos últimos 30 dias</CardTitle>
                  </CardHeader>
                  <CardContent className="pl-2">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={overview.daily_sales}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            tickFormatter={(value) => `R$ ${value}`}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(label) => format(new Date(label), 'dd ' + 'MMMM', { locale: ptBR })}
                          />
                          <Area type="monotone" dataKey="total" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card className="col-span-3">
                  <CardHeader>
                    <CardTitle>Top Organizadores (Repasse)</CardTitle>
                    <CardDescription>
                      Maiores volumes de repasse no período
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {overview.top_organizers.map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <span className="text-xs font-bold">{i + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium leading-none">{item.name}</p>
                            </div>
                          </div>
                          <div className="font-bold text-sm text-muted-foreground">
                            {formatCurrency(item.total_value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
             <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por ID, e-mail..." className="pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="RECEIVED">Recebido</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="refunded">Estornado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>ID Externo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Organizador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     <TableRow>
                       <TableCell colSpan={7} className="h-24 text-center">Carregando...</TableCell>
                     </TableRow>
                  ) : payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">Nenhuma transação encontrada.</TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell className="font-mono text-xs">{payment.external_payment_id || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{payment.buyer_name || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground">{payment.buyer_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{payment.organizer_name || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground">{payment.event_title || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(payment.value)}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPayment(payment)}
                            >
                              Detalhes
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleReconcile(payment.id)}
                            >
                              Conciliar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
            >
              Próxima
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader>
              <CardTitle>Conciliação Bancária</CardTitle>
              <CardDescription>
                Ferramenta para verificação manual de divergências com o gateway de pagamento (Asaas).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-yellow-800">Atenção</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Esta ação consome recursos da API do Asaas. Utilize apenas quando necessário para investigar transações específicas.
                    O sistema utiliza o banco de dados local como fonte de verdade.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <Input 
                  placeholder="ID do Pagamento (Asaas ou Interno)" 
                  className="max-w-md" 
                  value={reconcileId}
                  onChange={(e) => setReconcileId(e.target.value)}
                />
                <Button onClick={() => handleReconcile(reconcileId)} disabled={!reconcileId}>
                  <Search className="mr-2 h-4 w-4" />
                  Investigar e Conciliar
                </Button>
                <Button variant="outline" onClick={handleReconcileAll}>
                  Conciliar em Lote
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedPayment)} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Transação</DialogTitle>
            <DialogDescription>Informações completas do pagamento selecionado.</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-2 text-sm">
              <p><strong>ID interno:</strong> {selectedPayment.id}</p>
              <p><strong>ID externo:</strong> {selectedPayment.external_payment_id || '-'}</p>
              <p><strong>Data:</strong> {format(new Date(selectedPayment.created_at), 'dd/MM/yyyy HH:mm')}</p>
              <p><strong>Cliente:</strong> {selectedPayment.buyer_name || 'N/A'} ({selectedPayment.buyer_email || '-'})</p>
              <p><strong>Organizador:</strong> {selectedPayment.organizer_name || 'N/A'}</p>
              <p><strong>Evento:</strong> {selectedPayment.event_title || 'N/A'}</p>
              <p><strong>Método:</strong> {selectedPayment.payment_method || '-'}</p>
              <p><strong>Status:</strong> {selectedPayment.status}</p>
              <p><strong>Valor:</strong> {formatCurrency(selectedPayment.value)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}




