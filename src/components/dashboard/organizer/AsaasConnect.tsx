
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface AsaasAccount {
  id: string;
  asaas_account_id: string;
  kyc_status: 'pending' | 'approved' | 'rejected' | 'awaiting_approval';
  is_active: boolean;
}

export function AsaasConnect() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<AsaasAccount | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    mobilePhone: '',
    address: '',
    addressNumber: '',
    complement: '',
    province: '',
    postalCode: '',
    birthDate: '',
    incomeValue: ''
  });

  const [activeTab, setActiveTab] = useState<'create' | 'link'>('create');
  const [linkData, setLinkData] = useState({
    asaas_account_id: '',
    token: ''
  });
  const [verificationStep, setVerificationStep] = useState<'start' | 'verify'>('start');
  const [verificationInstructions, setVerificationInstructions] = useState('');

  useEffect(() => {
    if (user) {
      loadAccount();
      // Pre-fill form with user data if available
      setFormData(prev => ({
        ...prev,
        name: user.user_metadata?.full_name || '',
        email: user.email || ''
      }));
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
        console.error('Error loading Asaas account:', error);
      }
      
      if (data) {
        setAccount(data);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRelink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-start-relink-existing', {
        body: { asaas_account_id: linkData.asaas_account_id }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (data.message) {
         // Já vinculado
         toast.success(data.message);
         loadAccount();
         return;
      }

      setLinkData(prev => ({ ...prev, token: data.token }));
      setVerificationInstructions(data.instructions);
      setVerificationStep('verify');
      toast.info('Siga as instruções para verificar a conta.');

    } catch (error: any) {
      console.error('Relink error:', error);
      toast.error(error.message || 'Erro ao iniciar verificação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRelink = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-confirm-relink', {
        body: { 
            token: linkData.token,
            asaas_account_id: linkData.asaas_account_id
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Conta verificada e conectada com sucesso!');
      loadAccount();
    } catch (error: any) {
      console.error('Confirm error:', error);
      toast.error(error.message || 'Erro ao confirmar verificação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Get session directly to ensure valid token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Sessão expirada ou inválida. Por favor, faça login novamente.');
      }

      const { data, error } = await supabase.functions.invoke('asaas-connect-organizer-v2', {
        body: formData
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      toast.success('Conta Asaas conectada com sucesso!');
      if (data.account) {
        setAccount(data.account);
      } else {
        loadAccount();
      }
    } catch (error: any) {
      console.error('Connection error:', error);
      
      const errorMessage = error.message || 'Erro desconhecido';
      
      if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('uso')) {
          toast.error('Este e-mail já está cadastrado no Asaas. Por favor, use outro e-mail ou entre em contato com o suporte.');
      } else {
          toast.error(errorMessage);
      }
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
      if (data.error) throw new Error(data.error);

      toast.success('Status atualizado!');
      if (data.account) {
        setAccount(data.account);
      }
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast.error('Erro ao atualizar status: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'APPROVED':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1"/> Aprovado</Badge>;
      case 'pending':
      case 'PENDING':
      case 'awaiting_approval':
      case 'AWAITING_APPROVAL':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> Em Análise</Badge>;
      case 'rejected':
      case 'REJECTED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1"/> Rejeitado</Badge>;
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
            ID da Conta: {account.asaas_account_id}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {account.kyc_status !== 'approved' && (
            <Alert className="mb-4 bg-yellow-50 text-yellow-800 border-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Verificação Pendente</AlertTitle>
              <AlertDescription>
                Sua conta está em análise pelo Asaas. Você poderá receber pagamentos assim que for aprovada.
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle>Conectar Conta Asaas</CardTitle>
            <div className="flex gap-2 text-sm">
                <Button 
                    variant={activeTab === 'create' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setActiveTab('create')}
                >
                    Nova Conta
                </Button>
                <Button 
                    variant={activeTab === 'link' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setActiveTab('link')}
                >
                    Já Tenho Conta
                </Button>
            </div>
        </div>
        <CardDescription>
            {activeTab === 'create' 
                ? 'Crie uma nova subconta Asaas para receber pagamentos.' 
                : 'Conecte uma subconta Asaas existente mediante verificação.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activeTab === 'create' ? (
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo / Razão Social</Label>
              <Input 
                id="name" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
              <Input 
                id="cpfCnpj" 
                required 
                value={formData.cpfCnpj}
                onChange={e => setFormData({...formData, cpfCnpj: e.target.value})}
                placeholder="Apenas números"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Data de Nascimento</Label>
              <Input 
                id="birthDate" 
                type="date"
                required 
                value={formData.birthDate}
                onChange={e => setFormData({...formData, birthDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incomeValue">Renda Mensal Estimada (R$)</Label>
              <Input 
                id="incomeValue" 
                type="number"
                min="0"
                step="0.01"
                required 
                value={formData.incomeValue}
                onChange={e => setFormData({...formData, incomeValue: e.target.value})}
                placeholder="Ex: 5000.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobilePhone">Celular</Label>
              <Input 
                id="mobilePhone" 
                required 
                value={formData.mobilePhone}
                onChange={e => setFormData({...formData, mobilePhone: e.target.value})}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Endereço Completo</Label>
              <Input 
                id="address" 
                required 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                placeholder="Rua, Avenida..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressNumber">Número</Label>
              <Input 
                id="addressNumber" 
                required 
                value={formData.addressNumber}
                onChange={e => setFormData({...formData, addressNumber: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complement">Complemento</Label>
              <Input 
                id="complement" 
                value={formData.complement}
                onChange={e => setFormData({...formData, complement: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Bairro</Label>
              <Input 
                id="province" 
                required 
                value={formData.province}
                onChange={e => setFormData({...formData, province: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">CEP</Label>
              <Input 
                id="postalCode" 
                required 
                value={formData.postalCode}
                onChange={e => setFormData({...formData, postalCode: e.target.value})}
                placeholder="00000-000"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar Conta de Recebimento
          </Button>
        </form>
        ) : (
            <div className="space-y-6">
                {verificationStep === 'start' ? (
                    <div className="space-y-4">
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Atenção</AlertTitle>
                            <AlertDescription>
                                Para conectar uma conta existente, você precisará provar que é o proprietário dela.
                            </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                            <Label htmlFor="asaasAccountId">ID da Conta Asaas (cus_...)</Label>
                            <Input 
                                id="asaasAccountId" 
                                value={linkData.asaas_account_id}
                                onChange={e => setLinkData({...linkData, asaas_account_id: e.target.value})}
                                placeholder="cus_000005112006"
                            />
                            <p className="text-xs text-muted-foreground">Você encontra este ID no painel da sua conta Asaas ou na URL.</p>
                        </div>
                        <Button onClick={handleStartRelink} className="w-full" disabled={submitting || !linkData.asaas_account_id}>
                             {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                             Iniciar Verificação
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                         <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertTitle>Instruções de Verificação</AlertTitle>
                            <AlertDescription className="mt-2 font-medium">
                                {verificationInstructions}
                            </AlertDescription>
                        </Alert>

                        <div className="space-y-2">
                            <Label>Código de Verificação (Token)</Label>
                            <div className="p-4 bg-muted rounded-md text-center text-2xl font-mono tracking-widest select-all cursor-pointer" onClick={() => {navigator.clipboard.writeText(linkData.token); toast.success("Token copiado!")}}>
                                {linkData.token}
                            </div>
                            <p className="text-xs text-muted-foreground text-center">Inclua este código EXATAMENTE como está na descrição do Pix.</p>
                        </div>

                        <div className="pt-4 flex gap-2">
                            <Button variant="outline" className="w-full" onClick={() => setVerificationStep('start')}>
                                Voltar
                            </Button>
                            <Button className="w-full" onClick={handleConfirmRelink} disabled={submitting}>
                                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Já fiz o Pix, Confirmar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
