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
      
      // Verificar se e-mail ou CPF já existem antes de tentar criar a conta
      // Isso evita o erro genérico "Database error saving new user"
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
        // Continua o fluxo normal se a verificação falhar (fallback)
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Bem-vindo ao PreFest! 🎉</CardTitle>
          <CardDescription>
            Entre ou crie sua conta para começar
          </CardDescription>
        </CardHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                {successMessage && (
                  <Alert className="mb-4 bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
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
                        <p className="text-xs text-muted-foreground text-center opacity-80">
                          Não esqueça de verificar também a pasta de SPAM.
                        </p>
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
                      className="text-xs text-pink-600 hover:underline"
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
              </CardContent>

              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp}>
              <CardContent className="space-y-4">
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
              </CardContent>

              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Criando conta...' : 'Criar Conta'}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
