import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Globe, Mail, Save, CreditCard, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { invokeEdgeFunction } from '@/services/apiClient';

// Types
interface SystemSettings {
  id?: string;
  theme_mode: 'system' | 'light' | 'dark';
  primary_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  password_policy: 'weak' | 'medium' | 'strong';
  require_2fa_admin: boolean;
  login_monitoring: boolean;
}

interface NotificationSettings {
  id?: string;
  notify_new_sales: boolean;
  notify_new_users: boolean;
  notify_system_errors: boolean;
  email_enabled: boolean;
}

interface SmtpSettings {
  id?: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password_encrypted?: string;
  from_email: string;
}

interface Integration {
  id?: string;
  provider: string;
  is_enabled: boolean;
  public_key?: string;
  secret_key_encrypted?: string;
  webhook_token_encrypted?: string;
  environment?: 'sandbox' | 'production';
  wallet_id?: string;
  split_enabled?: boolean;
  platform_fee_type?: 'percentage' | 'fixed';
  platform_fee_value?: number;
}

export default function AdminSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('notifications');

  // State for settings
  const [system, setSystem] = useState<SystemSettings>({
    theme_mode: 'system',
    primary_color: '#000000',
    logo_url: null,
    favicon_url: null,
    password_policy: 'medium',
    require_2fa_admin: false,
    login_monitoring: true
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    notify_new_sales: true,
    notify_new_users: true,
    notify_system_errors: true,
    email_enabled: true
  });

  const [smtp, setSmtp] = useState<SmtpSettings>({
    host: '',
    port: 587,
    secure: true,
    username: '',
    from_email: ''
  });
  const [smtpPassword, setSmtpPassword] = useState('');

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  
  // Asaas States
  // Loading data
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      // Fetch System Settings
      const { data: sysData } = await supabase.from('system_settings').select('*').single();
      if (sysData) setSystem(sysData);

      // Fetch Notification Settings
      const { data: notifData } = await supabase.from('notification_settings').select('*').single();
      if (notifData) setNotifications(notifData);

      // Fetch SMTP Settings
      const { data: smtpData } = await supabase.from('smtp_settings').select('*').single();
      if (smtpData) setSmtp(smtpData);

      // Fetch Integrations
      const { data: intData } = await supabase.from('integrations').select('*');
      if (intData) {
          // Check if asaas exists, if not add it (frontend only state until saved)
          const asaas = intData.find(i => i.provider === 'asaas');
          if (!asaas) {
              setIntegrations([...intData, { provider: 'asaas', is_enabled: false, environment: 'sandbox' }]);
          } else {
              setIntegrations(intData);
          }
      } else {
                setIntegrations([{ provider: 'asaas', is_enabled: false, environment: 'sandbox' }]);
            }

          } catch (error) {
            // console.error('Error fetching settings:', error);
            toast.error('Erro ao carregar configuracoes');
          } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Prepare payload
      const payload: any = {
        system,
        notifications,
        smtp: { ...smtp, ...(smtpPassword ? { pass: smtpPassword } : {}) },
        // Asaas integration is locked and managed directly in the database.
        integrations: integrations.filter(int => int.provider !== 'asaas')
      };

      // Using RPC directly to avoid Edge Function auth issues
      const { error } = await supabase.rpc('save_admin_settings', {
        p_system: payload.system,
        p_notifications: payload.notifications,
        p_smtp: payload.smtp,
        p_integrations: payload.integrations
      });

      if (error) throw error;
      // if (data?.error) throw new Error(data.error);

      toast.success('Configuracoes salvas com sucesso!');
      fetchSettings(); 
      setSmtpPassword('');

    } catch (error: any) {
    // console.error('Error saving settings:', error);
    toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };



  // Test SMTP
  const handleTestSmtp = async () => {
    try {
      toast.loading('Testando conexao SMTP...');
      const { data, error } = await invokeEdgeFunction('test-smtp-connection', {
        body: { 
            host: smtp.host, 
            port: smtp.port, 
            user: smtp.username, 
            pass: smtpPassword || 'stored_password', 
            secure: smtp.secure
        }
      });
      
      toast.dismiss();
      if (error || data?.error) {
        toast.error(`Falha na conexao: ${error?.message || data?.error}`);
      } else {
        toast.success('Conexao SMTP estabelecida com sucesso!');
      }
    } catch (error) {
        toast.dismiss();
        toast.error('Erro ao testar SMTP');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  if (isLoading) {
      return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <motion.div 
      className="space-y-8 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Configuracoes
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as preferencias e configuracoes globais do sistema
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 shadow-lg">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Salvando...' : 'Salvar Alteracoes'}
        </Button>
      </div>

      <Tabs defaultValue="notifications" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-2 h-auto p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="notifications" className="flex flex-col gap-2 py-3">
            <Bell className="w-5 h-5" />
            <span className="text-xs font-medium">Notificacoes</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex flex-col gap-2 py-3">
            <Globe className="w-5 h-5" />
            <span className="text-xs font-medium">Integracoes</span>
          </TabsTrigger>
        </TabsList>

        <motion.div variants={itemVariants} key={activeTab}>
          






          <TabsContent value="notifications" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Preferncias de Notificao</CardTitle>
                <CardDescription>Gerencie como o sistema envia alertas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Notificacoes por Email</h3>
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-sales" className="flex-1">Novas Vendas</Label>
                      <Switch 
                        id="notify-sales" 
                        checked={notifications.notify_new_sales}
                        onCheckedChange={(c) => setNotifications({...notifications, notify_new_sales: c})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-users" className="flex-1">Novos Cadastros</Label>
                      <Switch 
                        id="notify-users" 
                        checked={notifications.notify_new_users}
                        onCheckedChange={(c) => setNotifications({...notifications, notify_new_users: c})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-errors" className="flex-1">Erros do Sistema</Label>
                      <Switch 
                        id="notify-errors" 
                        checked={notifications.notify_system_errors}
                        onCheckedChange={(c) => setNotifications({...notifications, notify_system_errors: c})}
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <h3 className="text-sm font-medium">Configurao de SMTP</h3>
                     <Button variant="outline" size="sm" onClick={handleTestSmtp}>Testar Conexao</Button>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Servidor SMTP</Label>
                      <Input 
                        placeholder="smtp.exemplo.com" 
                        value={smtp.host || ''}
                        onChange={(e) => setSmtp({...smtp, host: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Porta</Label>
                      <Input 
                        placeholder="587" 
                        type="number"
                        value={smtp.port || ''}
                        onChange={(e) => setSmtp({...smtp, port: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Usuario</Label>
                      <Input 
                        placeholder="user@exemplo.com" 
                        value={smtp.username || ''}
                        onChange={(e) => setSmtp({...smtp, username: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha</Label>
                      <Input 
                        type="password" 
                        placeholder={smtp.password_encrypted ? "********" : "Digite a senha"} 
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Email de Envio (From)</Label>
                      <Input 
                        placeholder="no-reply@prefest.com.br" 
                        value={smtp.from_email || ''}
                        onChange={(e) => setSmtp({...smtp, from_email: e.target.value})}
                      />
                    </div>
                     <div className="flex items-center gap-2">
                        <Switch 
                            checked={smtp.secure}
                            onCheckedChange={(c) => setSmtp({...smtp, secure: c})}
                        />
                        <Label>Usar SSL/TLS (Secure)</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Integracoes Externas</CardTitle>
                <CardDescription>Conecte o sistema a servicos de terceiros.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {integrations.map((integration) => (
                    integration.provider === 'asaas' && (
                        <div key={integration.id || 'asaas'} className="space-y-4 border p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <CreditCard className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                    <p className="font-medium">Asaas / Pagamentos</p>
                                    <p className="text-sm text-muted-foreground">Gateway de pagamentos (PIX, Boleto, Carto)</p>
                                    </div>
                                </div>
                                <Switch 
                                    checked={integration.is_enabled}
                                    disabled
                                />
                            </div>
                            
                            <div className="grid gap-4 mt-4 p-4 bg-muted/30 rounded-md">
                                <div className="space-y-2">
                                    <Label>Ambiente</Label>
                                    <Select 
                                        value={integration.environment} 
                                        disabled
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                                            <SelectItem value="production">Producao</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>API Key</Label>
                                    <Input type="password" value="********" disabled readOnly />
                                    <p className="text-xs text-muted-foreground">Gerenciado pelo sistema e bloqueado para alteracoes no painel admin.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Webhook Token</Label>
                                    <Input type="password" value="********" disabled readOnly />
                                    <p className="text-xs text-muted-foreground">Gerenciado pelo sistema e bloqueado para alteracoes no painel admin.</p>
                                    <p className="text-xs text-muted-foreground">O token  usado para validar as notificacoes recebidas do Asaas.</p>
                                    <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono break-all">
                                        <span className="font-bold block mb-1">URL para Webhook (Asaas):</span>
                                        {import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook-handler
                                    </div>
                                </div>
                                
                                <Separator className="my-2" />
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Habilitar Split Automatico</Label>
                                            <p className="text-xs text-muted-foreground">Dividir pagamentos automaticamente entre plataforma e organizador</p>
                                        </div>
                                        <Switch 
                                            checked={integration.split_enabled || false}
                                            disabled
                                        />
                                    </div>

                                    {integration.split_enabled && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="space-y-4 pt-2 border-t"
                                        >
                                            <div className="space-y-2">
                                                <Label>Wallet ID da Plataforma (Opcional)</Label>
                                                <Input 
                                                    value={integration.wallet_id || ''}
                                                    disabled
                                                    placeholder="Cole aqui o Wallet ID (opcional)"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    ID da carteira Asaas que recebera a taxa da plataforma. Se vazio, o sistema usara a carteira padrao da conta principal.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Label>Tipo de Taxa</Label>
                                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground font-medium uppercase tracking-wider">Fixo no Sistema</span>
                                                    </div>
                                                    <Select 
                                                        disabled={true}
                                                        value="percentage"
                                                    >
                                                        <SelectTrigger className="bg-muted/50 cursor-not-allowed opacity-70">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                                                            <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Label>Valor da Taxa</Label>
                                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground font-medium uppercase tracking-wider">Somente Leitura</span>
                                                    </div>
                                                    <div className="relative">
                                                        <Input 
                                                            disabled={true}
                                                            type="number"
                                                            className="pl-8 bg-muted/50 cursor-not-allowed opacity-70 font-medium text-foreground"
                                                            value={10}
                                                            placeholder="10.00"
                                                        />
                                                        <span className="absolute left-3 top-2.5 text-muted-foreground text-sm opacity-70">
                                                            %
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        A taxa est configurada fixamente em 10% no cdigo para garantir estabilidade.
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                ))}
                
                {/* Placeholders for other integrations */}
                <div className="flex items-center justify-between border p-4 rounded-lg opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Mail className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Mailchimp</p>
                      <p className="text-sm text-muted-foreground">Em breve</p>
                    </div>
                  </div>
                  <Button variant="outline" disabled>Conectar</Button>
                </div>

                <div className="flex items-center justify-between border p-4 rounded-lg opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Globe className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium">Google Analytics</p>
                      <p className="text-sm text-muted-foreground">Em breve</p>
                    </div>
                  </div>
                  <Button variant="outline" disabled>Conectar</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </motion.div>
      </Tabs>
    </motion.div>
  );
}

