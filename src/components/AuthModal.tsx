import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { ROUTE_PATHS } from '@/lib';

interface AuthModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AuthModal({ trigger, open, onOpenChange }: AuthModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isControlled = open !== undefined;
  const show = isControlled ? open : internalOpen;
  const setShow = isControlled ? onOpenChange : setInternalOpen;

  const handleLogin = () => {
    if (setShow) setShow(false);
    navigate('/login', { state: { returnTo: location.pathname } });
  };
  
  const handleSignup = () => {
    if (setShow) setShow(false);
    navigate('/login', { state: { returnTo: location.pathname, tab: 'signup' } });
  };

  return (
    <Dialog open={show} onOpenChange={setShow}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">Que bom ter você aqui!</DialogTitle>
          <DialogDescription className="text-center">
            Entre para aproveitar o melhor da PREFEST
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Button 
            onClick={handleLogin} 
            className="w-full h-12 text-lg font-medium gap-2" 
            size="lg"
          >
            <Mail className="w-5 h-5" />
            Continuar com e-mail e senha
          </Button>
          
          <div className="text-xs text-muted-foreground px-4 leading-relaxed">
            Ao entrar, concordo com os{' '}
            <Link to={ROUTE_PATHS.TERMS} className="underline hover:text-primary" onClick={() => setShow && setShow(false)}>
              Termos de Uso
            </Link>
            {' '}e{' '}
            <Link to={ROUTE_PATHS.PRIVACY} className="underline hover:text-primary" onClick={() => setShow && setShow(false)}>
              Política de Privacidade
            </Link>
            {' '}da PREFEST
          </div>
        </div>

        <div className="border-t pt-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Não possui uma conta?{' '}
              <button 
                onClick={handleSignup}
                className="font-medium text-primary hover:underline"
              >
                Cadastre-se
              </button>
            </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
