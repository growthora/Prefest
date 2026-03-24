import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { toUserFriendlyErrorMessage } from '@/lib/appErrors';

interface AsaasAccount {
  id: string;
  asaas_account_id: string;
  asaas_wallet_id?: string | null;
  payment_method_type?: 'SUBACCOUNT' | 'EXTERNAL_WALLET';
  external_wallet_id?: string | null;
  kyc_status: 'pending' | 'approved' | 'rejected' | 'awaiting_approval';
  is_active: boolean;
}

export function AsaasConnect() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<AsaasAccount | null>(null);
  const [showWalletHelpModal, setShowWalletHelpModal] = useState(false);
  const [linkData, setLinkData] = useState({
    external_wallet_id: '',
    external_wallet_email: '',
  });

  useEffect(() => {
    if (user) {
      loadAccount();
    }
  }, [user]);

  const loadAccount = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizer_asaas_accounts')
        .select('*')
        .eq('organizer_user_id', user?.id)
        .maybeSingle();

      if (error) {
      }

      if (data) {
        setAccount(data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleConnectExternalWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const walletId = linkData.external_wallet_id.trim();
    const externalEmail = linkData.external_wallet_email.trim();
    const walletIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(walletId);

    if (!walletIsUuid) {
      toast.error('Wallet ID invalido. Informe um UUID valido do Asaas.');
      return;
    }

    if (!externalEmail) {
      toast.error('Informe o e-mail da conta Asaas externa.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('organizer_asaas_accounts')
        .upsert(
          {
            organizer_user_id: user.id,
            asaas_account_id: walletId,
            asaas_wallet_id: walletId,
            is_active: true,
            kyc_status: 'approved',
            payment_method_type: 'EXTERNAL_WALLET',
            external_wallet_id: walletId,
            external_wallet_email: externalEmail,
          } as any,
          { onConflict: 'organizer_user_id' }
        )
        .select('*')
        .single();

      if (error) throw error;

      setAccount(data);
      toast.success('Wallet externa conectada com sucesso!');
    } catch (error: any) {
      toast.error(toUserFriendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!account) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-refresh-organizer-kyc-status', {
        method: 'POST',
      });

      if (error) throw error;
      if (data.error) {
        const details = data.details ? ` (${typeof data.details === 'string' ? data.details : JSON.stringify(data.details)})` : '';
        throw new Error(`${data.error}${details}`);
      }

      toast.success('Status atualizado!');
      if (data.account) {
        setAccount(data.account);
      }
    } catch (error: any) {
      toast.error(toUserFriendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'APPROVED':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Aprovado</Badge>;
      case 'pending':
      case 'PENDING':
      case 'awaiting_approval':
      case 'AWAITING_APPROVAL':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Em Analise</Badge>;
      case 'rejected':
      case 'REJECTED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-4 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (account) {
    return (
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Conta Asaas Conectada</CardTitle>
            {getStatusBadge(account.kyc_status)}
          </div>
          <CardDescription>
            {account.payment_method_type === 'EXTERNAL_WALLET'
              ? `Wallet ID: ${account.external_wallet_id || account.asaas_account_id}`
              : `ID da Conta: ${account.asaas_account_id}`}
            {account.payment_method_type !== 'EXTERNAL_WALLET' && account.asaas_wallet_id ? ` | Wallet: ${account.asaas_wallet_id}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {account.kyc_status !== 'approved' && (
            <Alert className="mb-4 bg-yellow-50 text-yellow-800 border-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Verificacao Pendente</AlertTitle>
              <AlertDescription>
                Sua conta esta em analise pelo Asaas. Voce podera receber pagamentos assim que for aprovada.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshStatus} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar Status
            </Button>
            <Button variant="link" className="text-muted-foreground" asChild>
              <a href="https://www.asaas.com/" target="_blank" rel="noopener noreferrer">Acessar Painel Asaas</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Conectar Conta Asaas</CardTitle>
              <CardDescription>
                Configure sua conta Asaas externa informando o Wallet ID para receber pagamentos.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <Button type="button" size="sm">
                Configurar minha conta
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowWalletHelpModal(true)}>
                Nao tenho Wallet Externa
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleConnectExternalWallet} className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Conta Externa Asaas</AlertTitle>
              <AlertDescription>
                Informe o Wallet ID e o e-mail da sua conta Asaas para receber via split (90% organizador, 10% PreFest).
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="externalWalletId">Wallet ID do Asaas</Label>
              <Input
                id="externalWalletId"
                value={linkData.external_wallet_id}
                onChange={e => setLinkData({ ...linkData, external_wallet_id: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Use o Wallet ID da sua conta criada no proprio Asaas.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalWalletEmail">Email da conta Asaas</Label>
              <Input
                id="externalWalletEmail"
                type="email"
                value={linkData.external_wallet_email}
                onChange={e => setLinkData({ ...linkData, external_wallet_email: e.target.value })}
                placeholder="conta@asaas.com"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !linkData.external_wallet_id || !linkData.external_wallet_email}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Conectar Wallet Externa
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showWalletHelpModal} onOpenChange={setShowWalletHelpModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Como criar sua conta no Asaas</DialogTitle>
            <DialogDescription>
              Se voce ainda nao tem Wallet Externa, siga este passo a passo antes de configurar sua conta aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Acesse o site oficial do Asaas e crie sua conta com seus dados reais.</p>
            <p>2. Escolha o tipo de conta correto, como pessoa fisica ou pessoa juridica.</p>
            <p>3. Preencha as informacoes cadastrais com atencao, incluindo nome, documento, telefone e endereco.</p>
            <p>4. Envie os documentos solicitados pelo Asaas para validacao da conta.</p>
            <p>5. Aguarde a analise de cadastro e acompanhe o status diretamente no painel do Asaas.</p>
            <p>6. Depois da aprovacao, localize o Wallet ID da sua conta no painel.</p>
            <p>7. Volte para esta tela, informe o Wallet ID e o e-mail da conta Asaas, e conclua a configuracao.</p>
            <p>8. Se houver pendencia de documentos, finalize essa etapa no Asaas antes de tentar receber pagamentos.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWalletHelpModal(false)}>
              Fechar
            </Button>
            <Button asChild>
              <a href="https://www.asaas.com/" target="_blank" rel="noopener noreferrer">
                Criar conta no Asaas
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
