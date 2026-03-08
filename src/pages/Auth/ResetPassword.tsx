import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authService } from '@/services/auth.service';
import { ROUTE_PATHS } from '@/lib/index';
import { Lock, Mail, KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { translateAuthError } from '@/utils/authErrors';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isRecoveryMode, signOut, user } = useAuth();
  
  // State
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check for token in URL params (Manual flow pre-fill)
  const urlToken = searchParams.get('token');

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
    }
  }, [urlToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      setIsLoading(false);
      return;
    }

    if (!user && !email) {
      setError('O email é obrigatório');
      setIsLoading(false);
      return;
    }

    if (!user && !token) {
      setError('O código de verificação é obrigatório');
      setIsLoading(false);
      return;
    }

    try {
      // If not logged in, we need to verify OTP first (Manual Flow)
      if (!user) {
        // Step 1: Verify OTP
        // This will log the user in if successful and set the session
        await authService.verifyOtp(email, token);
      }

      // Step 2: Update Password 
      // Works because we are now logged in (either via session/link or verifyOtp)
      try {
        await authService.updatePassword(password);
      } catch (updateError: any) {
        // If update fails and we were in manual mode (just logged in via OTP), 
        // we must sign out to prevent access without password reset
        if (!isRecoveryMode) {
           await signOut();
        }
        throw updateError;
      }

      // Step 3: Success handling
      setSuccess(true);
      
      // Step 4: Sign out and redirect to login
      // User must re-login with new password as per security requirements
      setTimeout(async () => {
        await signOut();
        navigate(ROUTE_PATHS.LOGIN);
            }, 3000);

          } catch (err: any) {
            // console.error('Reset password error:', err);
            const message = err.message || 'Erro ao redefinir senha. Tente novamente.';
            setError(translateAuthError(message));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-green-100 rounded-full">
                <Lock className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-green-700">Senha Atualizada!</CardTitle>
            <CardDescription>
              Sua senha foi redefinida com sucesso. Você será redirecionado para o login em instantes.
            </CardDescription>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 mt-4"
              onClick={async () => {
                await signOut();
                navigate(ROUTE_PATHS.LOGIN);
              }}
            >
              Ir para Login agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2 justify-center">
            <div className="p-3 bg-pink-100 rounded-full">
              <Lock className="h-6 w-6 text-pink-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Definir Nova Senha</CardTitle>
          <CardDescription className="text-center">
            {user 
              ? 'Digite sua nova senha abaixo.' 
              : 'Insira o código recebido por email e sua nova senha.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!user && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="pl-9"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {!urlToken && (
                  <div className="space-y-2">
                    <Label htmlFor="token">Código de Verificação (Token)</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="token"
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="123456"
                        className="pl-9"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pl-9"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="pl-9"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700" disabled={isLoading}>
              {isLoading ? 'Redefinindo...' : 'Criar Nova Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

