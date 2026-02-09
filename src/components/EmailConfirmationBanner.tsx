import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function EmailConfirmationBanner() {
  const { user, isAuthenticated, isEmailConfirmed, resendConfirmation } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  if (!isAuthenticated || isEmailConfirmed) {
    return null;
  }

  const handleResend = async () => {
    try {
      setIsResending(true);
      await resendConfirmation();
      toast.success('E-mail de confirmação reenviado! Verifique sua caixa de entrada.');
    } catch (error) {
      toast.error('Erro ao reenviar e-mail. Tente novamente mais tarde.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      setIsChecking(true);
      // Force refresh session
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) throw error;

      if (session?.user?.email_confirmed_at) {
        toast.success('E-mail confirmado com sucesso!');
        // Reload to ensure all states are updated
        window.location.reload();
      } else {
        toast.info('E-mail ainda não confirmado. Verifique sua caixa de entrada.');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Erro ao verificar status.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-sm sticky top-0 z-50 w-full">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-amber-500">
          <div className="p-2 bg-amber-500/20 rounded-full">
            <Mail size={20} />
          </div>
          <div>
            <p className="font-medium text-sm sm:text-base">Confirme seu e-mail para continuar</p>
            <p className="text-xs text-amber-500/80 hidden sm:block">
              Algumas funcionalidades estão bloqueadas até a confirmação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleResend}
            disabled={isResending}
            className="flex-1 sm:flex-none text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
          >
            {isResending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            Reenviar E-mail
          </Button>
          
          <Button 
            size="sm" 
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-white border-none"
          >
            {isChecking ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Já confirmei
          </Button>
        </div>
      </div>
    </div>
  );
}
