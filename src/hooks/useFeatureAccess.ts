import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const useFeatureAccess = () => {
  const { isAuthenticated, isEmailConfirmed } = useAuth();

  const checkAccess = (actionName: string = 'realizar esta ação') => {
    if (!isAuthenticated) {
      toast.error(`Você precisa estar logado para ${actionName}`);
      return false;
    }
    
    // Se o email não estiver confirmado, bloqueia
    if (!isEmailConfirmed) {
      toast.error(`Confirme seu e-mail para ${actionName}`, {
        description: 'Verifique sua caixa de entrada ou use o banner no topo para reenviar.',
        duration: 5000,
        action: {
          label: 'Entendi',
          onClick: () => {}
        }
      });
      return false;
    }
    
    return true;
  };

  return { checkAccess };
};
