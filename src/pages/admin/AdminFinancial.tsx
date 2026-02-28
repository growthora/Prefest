import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Wallet, CreditCard, Download, Search, Calendar, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { userService } from '@/services/user.service';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Mock transaction data
const MOCK_TRANSACTIONS = [
  { id: 'TRX-9823', date: '2024-02-28', description: 'Venda de Ingressos - Festival de Verão', amount: 1250.00, type: 'credit', status: 'completed' },
  { id: 'TRX-9822', date: '2024-02-27', description: 'Saque para Conta Bancária', amount: -500.00, type: 'debit', status: 'processing' },
  { id: 'TRX-9821', date: '2024-02-26', description: 'Venda de Ingressos - Show de Rock', amount: 340.50, type: 'credit', status: 'completed' },
  { id: 'TRX-9820', date: '2024-02-25', description: 'Taxa de Serviço - Plataforma', amount: -45.00, type: 'debit', status: 'completed' },
  { id: 'TRX-9819', date: '2024-02-24', description: 'Venda de Ingressos - Teatro Municipal', amount: 890.00, type: 'credit', status: 'completed' },
  { id: 'TRX-9818', date: '2024-02-23', description: 'Estorno - Compra #8823', amount: -120.00, type: 'debit', status: 'completed' },
  { id: 'TRX-9817', date: '2024-02-22', description: 'Venda de Ingressos - Stand-up Comedy', amount: 2100.00, type: 'credit', status: 'completed' },
];

const CHART_DATA = [
  { name: 'Seg', income: 4000, expense: 2400 },
  { name: 'Ter', income: 3000, expense: 1398 },
  { name: 'Qua', income: 2000, expense: 9800 },
  { name: 'Qui', income: 2780, expense: 3908 },
  { name: 'Sex', income: 1890, expense: 4800 },
  { name: 'Sab', income: 2390, expense: 3800 },
  { name: 'Dom', income: 3490, expense: 4300 },
];

export default function AdminFinancial() {
  const [isLoading, setIsLoading] = useState(false);
  const [financialStats, setFinancialStats] = useState<any>(null);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      setIsLoading(true);
      // In a real app, this would be a dedicated financial service
      // reusing userService stats for now to get some real numbers if available
      const stats = await userService.getStatistics();
      setFinancialStats(stats);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros', error);
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsWithdrawDialogOpen(false);
      setWithdrawAmount('');
      toast.success('Solicitação de saque realizada com sucesso!');
    }, 1500);
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
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  return (
    <motion.div 
      className="space-y-8 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">
            Financeiro
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de saldo, saques e transações
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
          <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-green-600/20 transition-all">
                <Wallet className="w-4 h-4 mr-2" />
                Solicitar Saque
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar Saque</DialogTitle>
                <DialogDescription>
                  Transfira seu saldo disponível para sua conta bancária cadastrada.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleWithdraw} className="space-y-4 pt-4">
                <div className="p-4 bg-muted/50 rounded-lg flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Saldo Disponível</span>
                  <span className="text-lg font-bold text-green-600">
                    R$ {financialStats?.totalRevenue ? (financialStats.totalRevenue * 0.85).toFixed(2) : '12,450.00'}
                  </span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount">Valor do Saque</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      placeholder="0,00"
                      className="pl-9"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      required
                      min="10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Valor mínimo: R$ 10,00</p>
                </div>
                <div className="space-y-2">
                  <Label>Conta de Destino</Label>
                  <div className="flex items-center gap-3 p-3 border rounded-md">
                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Nubank **** 8829</p>
                      <p className="text-xs text-muted-foreground">Conta Corrente</p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsWithdrawDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Processando...' : 'Confirmar Saque'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {financialStats?.totalRevenue?.toFixed(2) || '15,230.50'}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                +20.1% em relação ao mês anterior
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponível para Saque</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {financialStats?.totalRevenue ? (financialStats.totalRevenue * 0.85).toFixed(2) : '12,450.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Livre para transferência imediata
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">A Receber</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {financialStats?.totalRevenue ? (financialStats.totalRevenue * 0.15).toFixed(2) : '2,780.50'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Liberação prevista em 15 dias
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sacado</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 45,200.00</div>
              <p className="text-xs text-muted-foreground mt-1">
                Acumulado do ano
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Fluxo Financeiro</CardTitle>
              <CardDescription>Entradas e saídas dos últimos 7 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CHART_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" name="Entradas" />
                    <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" name="Saídas" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Cartões Cadastrados</CardTitle>
              <CardDescription>Gerencie seus métodos de recebimento</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="p-4 border rounded-lg bg-gradient-to-br from-purple-900 to-indigo-900 text-white relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-30 transition-opacity">
                  <Wallet className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                    <CreditCard className="w-8 h-8" />
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none">Principal</Badge>
                  </div>
                  <div className="mb-2">
                    <p className="text-xs opacity-70">Saldo Atual</p>
                    <p className="text-xl font-bold">R$ 12,450.00</p>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-sm font-mono tracking-wider">**** **** **** 8829</p>
                    <p className="text-xs opacity-70">Nubank</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer border-dashed flex flex-col items-center justify-center text-center py-8 gap-2">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">Adicionar nova conta</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Transações Recentes</CardTitle>
              <CardDescription>Histórico de movimentações financeiras</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar transação..." className="pl-9 w-[200px]" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_TRANSACTIONS.map((trx) => (
                <div key={trx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent/30 transition-colors gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      trx.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {trx.type === 'credit' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium">{trx.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{trx.id}</span>
                        <span>•</span>
                        <span>{new Date(trx.date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pl-14 sm:pl-0">
                    <div className="text-right">
                      <p className={`font-bold ${trx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {trx.type === 'credit' ? '+' : ''} R$ {Math.abs(trx.amount).toFixed(2)}
                      </p>
                      <Badge variant={trx.status === 'completed' ? 'outline' : 'secondary'} className="text-xs">
                        {trx.status === 'completed' ? 'Concluído' : 'Processando'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
