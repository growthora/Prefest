import React, { useEffect, useState } from 'react';
import { Wallet, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { invokeEdgeFunction } from '@/services/apiClient';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';
import { AsaasConnect } from '@/components/dashboard/organizer/AsaasConnect';
import { useToast } from '@/components/ui/use-toast';

export function Payments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [hasAsaasAccount, setHasAsaasAccount] = useState(true);
  const [showBalanceCard, setShowBalanceCard] = useState(true);

  useEffect(() => {
    async function loadBalance() {
      if (!user) return;

      try {
        setLoading(true);

        const { data, error } = await invokeEdgeFunction<{ balance?: number }>('asaas-get-organizer-balance', {
          method: 'POST',
        });

        if (!error && data && typeof data.balance === 'number') {
          setHasAsaasAccount(true);
          setShowBalanceCard(true);
          setBalance(data.balance);
          return;
        }

        const errorMessage = String((error as any)?.message || '');
        if (errorMessage.includes('Asaas account not found for this organizer')) {
          setHasAsaasAccount(false);
          setShowBalanceCard(false);
          setBalance(0);
          return;
        }

        if (errorMessage.includes('ORGANIZER_WALLET_CONFLICT')) {
          setHasAsaasAccount(true);
          setShowBalanceCard(false);
          setBalance(0);
          toast({
            variant: 'destructive',
            title: 'Conta Asaas invalida',
            description:
              'Sua conta esta vinculada ao wallet da plataforma. Reconecte a subconta Asaas correta para receber repasses.',
          });
          return;
        }

        if (errorMessage.includes('ORGANIZER_MISSING_DESTINATION_WALLET')) {
          setHasAsaasAccount(true);
          setShowBalanceCard(false);
          setBalance(0);
          toast({
            variant: 'destructive',
            title: 'Metodo de recebimento nao configurado',
            description: 'Configure seu metodo de recebimento Asaas para consultar o saldo da sua wallet.',
          });
          return;
        }

        if (errorMessage.includes('EXTERNAL_WALLET_BALANCE_UNAVAILABLE')) {
          setHasAsaasAccount(true);
          setShowBalanceCard(false);
          setBalance(0);
          toast({
            variant: 'destructive',
            title: 'Saldo externo indisponivel',
            description:
              'Nao foi possivel consultar o saldo real da wallet externa com a chave da plataforma.',
          });
          return;
        }

        setHasAsaasAccount(true);
        setShowBalanceCard(false);
        setBalance(0);
        toast({
          variant: 'destructive',
          title: 'Nao foi possivel carregar o saldo',
          description: 'O saldo do organizador deve vir exclusivamente da wallet Asaas vinculada.',
        });
      } catch (_error) {
        setHasAsaasAccount(true);
        setShowBalanceCard(false);
        setBalance(0);
        toast({
          variant: 'destructive',
          title: 'Erro ao consultar saldo',
          description: 'Falha na consulta da wallet Asaas do organizador.',
        });
      } finally {
        setLoading(false);
      }
    }

    loadBalance();
  }, [user, toast]);

  if (loading) return <DashboardLoader />;
  if (balance === null) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Meus Pagamentos</h1>
      </div>

      <AsaasConnect />

      {hasAsaasAccount && showBalanceCard && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Disponivel</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance)}
              </div>
              <p className="text-xs text-muted-foreground">Disponivel para saque</p>
            </CardContent>
          </Card>
        </div>
      )}

      {hasAsaasAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historico de Transacoes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">Nenhum historico de transacao (saque) registrado.</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Payments;
