import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Shield, Bell, Globe, Mail, Lock, CreditCard, Save, Upload, User, Palette } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const handleSave = (section: string) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast.success(`Configurações de ${section} salvas com sucesso!`);
    }, 1000);
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
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as preferências e configurações globais do sistema
          </p>
        </div>
        <Button onClick={() => handleSave('Geral')} disabled={isLoading} className="bg-primary hover:bg-primary/90 shadow-lg">
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="general" className="flex flex-col gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Settings className="w-5 h-5" />
            <span className="text-xs font-medium">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex flex-col gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Palette className="w-5 h-5" />
            <span className="text-xs font-medium">Aparência</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex flex-col gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-medium">Segurança</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex flex-col gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Bell className="w-5 h-5" />
            <span className="text-xs font-medium">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex flex-col gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Globe className="w-5 h-5" />
            <span className="text-xs font-medium">Integrações</span>
          </TabsTrigger>
        </TabsList>

        <motion.div variants={itemVariants} key={activeTab}>
          <TabsContent value="general" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Plataforma</CardTitle>
                <CardDescription>Configure os detalhes básicos do seu sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="site-name">Nome do Sistema</Label>
                    <Input id="site-name" defaultValue="Prefest" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-url">URL do Sistema</Label>
                    <Input id="site-url" defaultValue="https://prefest.com.br" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-desc">Descrição do Sistema</Label>
                  <Textarea id="site-desc" defaultValue="Plataforma de gestão de eventos e venda de ingressos." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email de Contato</Label>
                  <Input id="contact-email" type="email" defaultValue="contato@prefest.com.br" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Personalização Visual</CardTitle>
                <CardDescription>Altere a aparência e identidade visual do painel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tema Padrão</Label>
                    <Select defaultValue="system">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Escuro</SelectItem>
                        <SelectItem value="system">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary cursor-pointer ring-2 ring-offset-2 ring-primary"></div>
                      <div className="w-8 h-8 rounded-full bg-blue-600 cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-blue-600 transition-all"></div>
                      <div className="w-8 h-8 rounded-full bg-green-600 cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-green-600 transition-all"></div>
                      <div className="w-8 h-8 rounded-full bg-purple-600 cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-purple-600 transition-all"></div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <Label>Logotipo e Favicon</Label>
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs text-muted-foreground">Logo Principal</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:bg-accent/50 transition-colors cursor-pointer h-[150px]">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Arraste ou clique para enviar</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label className="text-xs text-muted-foreground">Favicon</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:bg-accent/50 transition-colors cursor-pointer h-[150px]">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Arraste ou clique para enviar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Segurança e Acesso</CardTitle>
                <CardDescription>Configurações de segurança para administradores e usuários.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Autenticação de Dois Fatores (2FA)</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir 2FA para todos os administradores
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Monitoramento de Login</Label>
                    <p className="text-sm text-muted-foreground">
                      Alertar sobre logins suspeitos
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2 pt-4">
                  <Label>Política de Senha</Label>
                  <Select defaultValue="strong">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medium">Média (Min 8 caracteres)</SelectItem>
                      <SelectItem value="strong">Forte (Min 12 caracteres + símbolos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>Gerencie como o sistema envia alertas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Notificações por Email</h3>
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-sales" className="flex-1">Novas Vendas</Label>
                      <Switch id="notify-sales" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-users" className="flex-1">Novos Cadastros</Label>
                      <Switch id="notify-users" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-errors" className="flex-1">Erros do Sistema</Label>
                      <Switch id="notify-errors" defaultChecked />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Configuração de SMTP</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Servidor SMTP</Label>
                      <Input placeholder="smtp.exemplo.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Porta</Label>
                      <Input placeholder="587" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Integrações Externas</CardTitle>
                <CardDescription>Conecte o sistema a serviços de terceiros.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Stripe / Pagamento</p>
                      <p className="text-sm text-muted-foreground">Processamento de pagamentos</p>
                    </div>
                  </div>
                  <Button variant="outline">Configurar</Button>
                </div>
                
                <div className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Mail className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Mailchimp</p>
                      <p className="text-sm text-muted-foreground">Marketing e Newsletter</p>
                    </div>
                  </div>
                  <Button variant="outline">Conectar</Button>
                </div>

                <div className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Globe className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium">Google Analytics</p>
                      <p className="text-sm text-muted-foreground">Monitoramento de tráfego</p>
                    </div>
                  </div>
                  <Button variant="outline">Conectar</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </motion.div>
      </Tabs>
    </motion.div>
  );
}
