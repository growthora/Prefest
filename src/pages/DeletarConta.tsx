
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { invokeEdgeFunction } from '@/services/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';

export default function DeletarConta() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  const isOrganizer = profile?.roles?.includes('ORGANIZER') || false;
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirmationText !== 'EXCLUIR MINHA CONTA') {
      toast.error('Texto de confirmação incorreto.');
      return;
    }
    if (!isConfirmed) {
      toast.error('Você deve confirmar que entende as consequências.');
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);

      const { data, error: functionError } = await invokeEdgeFunction('delete-user-account', {
        body: { confirmationText }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Erro ao comunicar com servidor.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Sua conta foi excluída com sucesso. Você será desconectado.');
      
      // Logout and redirect
      await signOut();
      navigate('/');
      
    } catch (err: any) {
      console.error('Erro ao excluir conta:', err);
      const errorMessage = err.message || 'Ocorreu um erro ao tentar excluir sua conta.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-6">Deletar Conta</h1>
      
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Zona de Perigo: Excluir Conta
          </CardTitle>
          <CardDescription>
            Esta ação é permanente e não pode ser desfeita.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-700">Zona de Perigo: Exclusão de Conta</AlertTitle>
              <AlertDescription className="text-red-800">
                Esta ação é permanente. Todos os seus dados, eventos e recebimentos serão removidos.
              </AlertDescription>
            </Alert>

            {isOrganizer && (
              <Alert className="bg-orange-50 border-orange-200 text-orange-900">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-700">Atenção Organizador</AlertTitle>
                <AlertDescription className="text-orange-800">
                  Sua conta de recebimento (ASAAS) será encerrada ou desativada. Certifique-se de não ter saldo pendente.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="confirm-delete" 
                checked={isConfirmed}
                onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="confirm-delete"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Entendo que esta ação é irreversível
                </Label>
                <p className="text-sm text-muted-foreground">
                  Seus dados não poderão ser recuperados.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmation-text">
                Digite <span className="font-bold text-destructive">EXCLUIR MINHA CONTA</span> para confirmar
              </Label>
              <Input
                id="confirmation-text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="EXCLUIR MINHA CONTA"
                className="border-destructive/30 focus-visible:ring-destructive"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between border-t bg-muted/50 px-6 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDeleteAccount}
            disabled={!isConfirmed || confirmationText !== 'EXCLUIR MINHA CONTA' || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir conta definitivamente'
            )}
          </Button>
        </CardFooter>
      </Card>
      </div>
    </Layout>
  );
}
