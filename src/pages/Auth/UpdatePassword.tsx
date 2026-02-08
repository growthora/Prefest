import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authService } from '@/services/auth.service';
import { ROUTE_PATHS } from '@/lib/index';
import { Lock } from 'lucide-react';

export const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se o usuário está autenticado (o link de email faz o login automaticamente)
    const checkSession = async () => {
      const session = await authService.getSession();
      if (!session) {
        // Se não houver sessão, redirecionar para login ou mostrar erro
        // Em fluxo de recuperação, o Supabase loga o usuário via hash na URL
        // Mas se o link for inválido, não haverá sessão.
        // O hash é processado pelo supabase-js client automaticamente.
        // Vamos dar um pequeno delay para o client processar.
        setTimeout(async () => {
             const sessionRetry = await authService.getSession();
             if (!sessionRetry) {
                 setError('Link de recuperação inválido ou expirado. Tente solicitar novamente.');
             }
        }, 1000);
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    try {
      await authService.updatePassword(password);
      // Sucesso, redirecionar para login ou home
      navigate(ROUTE_PATHS.HOME);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar senha');
    } finally {
      setIsLoading(false);
    }
  };

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
            Crie uma nova senha segura para sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Repita a senha"
              />
            </div>
            <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700" disabled={isLoading}>
              {isLoading ? 'Atualizando...' : 'Atualizar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
