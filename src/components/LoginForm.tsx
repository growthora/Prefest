import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { validateCPF, formatCPF, formatDate, validateBirthDate } from '@/utils/validators';
import { ROUTE_PATHS } from '@/lib/index';
import { Info } from 'lucide-react';
import { IMAGES } from '@/assets/images';
import { authService } from '@/services/auth.service';

export const LoginForm = () => {
  const { signIn, signUp, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: '',
    cpf: '',
    birthDate: '',
  });
  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    try {
      await signIn(formData.email, formData.password);
      navigate(location.state?.returnTo || '/');
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Erro ao fazer login';
      
      if (message.toLowerCase().includes('email not confirmed')) {
        message = 'Seu e-mail ainda não foi confirmado.';
        setShowResend(true);
      }
      
      setLocalError(message);
    }
  };

  const handleResendEmail = async () => {
    if (!formData.email) return;
    
    try {
      setResendLoading(true);
      // Note: authService is not imported directly here but was used in the original code? 
      // Wait, looking at the original code, authService was used in handleResendEmail but I don't see the import in the Read output.
      // Ah, I missed checking the imports carefully. 
      // Let me check if authService is available or if I need to import it.
      // In the original file snippet:
      // 65: await authService.resendConfirmationEmail(formData.email);
      // But I don't see `import { authService } ...` in the top lines I read (1-15).
      // I should double check imports.
      // Assuming it needs to be imported from services/auth.service
      
      // Let's comment this out for a second and check if I need to add the import.
      // I'll add the import to be safe.
      await authService.resendConfirmationEmail(formData.email);
      setLocalError(null);
      setSuccessMessage('E-mail de confirmação reenviado! Verifique sua caixa de entrada e spam.');
      setShowResend(false);
    } catch (err) {
      setLocalError('Erro ao reenviar e-mail. Tente novamente.');
      setSuccessMessage(null);
    } finally {
      setResendLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!formData.fullName) {
      setLocalError('Nome completo é obrigatório');
      return;
    }

    if (!validateCPF(formData.cpf)) {
      setLocalError('CPF inválido');
      return;
    }

    if (!validateBirthDate(formData.birthDate)) {
      setLocalError('Data de nascimento inválida');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      setLocalError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      // Converte DD/MM/YYYY para YYYY-MM-DD para salvar no banco
      const [day, month, year] = formData.birthDate.split('/');
      const formattedBirthDate = `${year}-${month}-${day}`;
      
      try {
        const checkResult = await authService.checkRegistrationData(formData.email, formData.cpf);
        
        if (checkResult.email_exists) {
          setLocalError('Este e-mail já está cadastrado. Tente fazer login.');
          return;
        }
        
        if (checkResult.cpf_exists) {
          setLocalError('Este CPF já está cadastrado. Entre em contato com o suporte se acredita ser um erro.');
          return;
        }
      } catch (checkErr) {
        console.warn('Erro ao verificar disponibilidade de dados:', checkErr);
      }

      await signUp(formData.email, formData.password, formData.fullName, formData.cpf, formattedBirthDate, isOrganizer);
      setSuccessMessage('Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.');
      setActiveTab('login');
      setLocalError(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro ao criar conta');
      setSuccessMessage(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    if (e.target.name === 'cpf') {
      value = formatCPF(value);
    } else if (e.target.name === 'birthDate') {
      value = formatDate(value);
    }

    setFormData(prev => ({
      ...prev,
      [e.target.name]: value
    }));
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Left Side - Data/Form */}
      <div className="flex w-full flex-col justify-center px-4 py-12 lg:w-1/2 lg:px-12 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-primary mb-2">Bem-vindo ao PreFest! 🎉</h1>
            <p className="text-muted-foreground">
              Entre ou crie sua conta para começar a curtir os melhores eventos.
            </p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                {successMessage && (
                  <Alert className="bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                    <AlertDescription>{successMessage}</AlertDescription>
                  </Alert>
                )}

                {(error || localError) && (
                  <Alert variant="destructive" className="flex flex-col gap-2">
                    <AlertDescription>{error || localError}</AlertDescription>
                    {showResend && (
                      <div className="flex flex-col gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleResendEmail}
                          disabled={resendLoading}
                          className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                        >
                          {resendLoading ? 'Enviando...' : 'Reenviar e-mail de confirmação'}
                        </Button>
                      </div>
                    )}
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Senha</Label>
                    <Link 
                      to={ROUTE_PATHS.FORGOT_PASSWORD} 
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder="••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                {(error || localError) && (
                  <Alert variant="destructive">
                    <AlertDescription>{error || localError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="signup-fullName">Nome Completo</Label>
                  <Input
                    id="signup-fullName"
                    name="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-cpf">CPF</Label>
                    <Input
                      id="signup-cpf"
                      name="cpf"
                      type="text"
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-birthDate">Data de Nasc.</Label>
                    <Input
                      id="signup-birthDate"
                      name="birthDate"
                      type="text"
                      placeholder="DD/MM/AAAA"
                      value={formData.birthDate}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirmPassword">Confirmar Senha</Label>
                  <Input
                    id="signup-confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Digite a senha novamente"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <Label className="text-base font-semibold">Como você pretende usar a PREFEST?</Label>
                  
                  <div className="flex items-start space-x-2 border p-3 rounded-lg bg-muted/20">
                    <Checkbox 
                      id="buyer-mode" 
                      checked={true} 
                      disabled={true} 
                      className="mt-1"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="buyer-mode"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Quero comprar ingressos
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Acesso imediato a todos os eventos e compras.
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-start space-x-2 border p-3 rounded-lg transition-colors ${isOrganizer ? 'bg-primary/5 border-primary/50' : 'bg-muted/20'}`}>
                    <Checkbox 
                      id="organizer-mode" 
                      checked={isOrganizer}
                      onCheckedChange={(checked) => setIsOrganizer(checked as boolean)}
                      className="mt-1"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="organizer-mode"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Quero organizar eventos
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Para produtores e organizadores de festas.
                      </p>
                    </div>
                  </div>

                  {isOrganizer && (
                    <Alert className="bg-yellow-50 text-yellow-800 border-yellow-200">
                      <Info className="h-4 w-4 text-yellow-800" />
                      <AlertDescription className="text-xs">
                        Para organizar eventos, seu cadastro passará por uma validação antes da liberação. Você poderá acessar como comprador imediatamente.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Criando conta...' : 'Criar Conta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img
          src={IMAGES.EVENTS_1}
          alt="PreFest Events"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute bottom-10 left-10 right-10 text-white p-6 bg-black/40 backdrop-blur-sm rounded-xl border border-white/10">
          <h2 className="text-2xl font-bold mb-2">Viva momentos inesquecíveis</h2>
          <p className="text-white/90">
            Descubra os melhores eventos, conecte-se com pessoas e crie memórias que duram para sempre.
          </p>
        </div>
      </div>
    </div>
  );
};
