import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { PlusCircle, UserPlus, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CreateEventModalProps {
  trigger?: React.ReactNode;
}

export function CreateEventModal({ trigger }: CreateEventModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleCreateAccount = () => {
    setIsOpen(false);
    navigate(ROUTE_PATHS.LOGIN, { state: { returnTo: ROUTE_PATHS.CREATE_EVENT, tab: 'signup' } });
  };

  const handleCreateNow = () => {
    setIsOpen(false);
    navigate(ROUTE_PATHS.CREATE_EVENT);
  };
  
  const handleLogin = () => {
    setIsOpen(false);
    navigate(ROUTE_PATHS.LOGIN, { state: { returnTo: ROUTE_PATHS.CREATE_EVENT } });
  };

  const isOrganizer = profile?.roles?.includes('ORGANIZER') || profile?.role === 'admin';
  const organizerStatus = profile?.organizer_status || 'NONE';

  const renderContent = () => {
    if (!user) {
      return (
        <>
          <Button onClick={handleCreateAccount} className="w-full gap-2 h-11 text-base shadow-sm" size="lg">
            <UserPlus className="w-4 h-4" />
            Criar conta e continuar
          </Button>
          
          <div className="text-center text-sm text-muted-foreground mt-2">
            Já tem uma conta?{' '}
            <button 
              onClick={handleLogin} 
              className="text-primary hover:underline font-medium focus:outline-none"
            >
              Entrar
            </button>
          </div>
        </>
      );
    }

    // Se é admin ou organizador aprovado
    if (profile?.role === 'admin' || (isOrganizer && organizerStatus === 'APPROVED')) {
      return (
        <Button onClick={handleCreateNow} className="w-full gap-2 h-11 text-base shadow-sm" size="lg">
          <PlusCircle className="w-4 h-4" />
          Criar evento agora
        </Button>
      );
    }

    // Se é organizador pendente
    if (isOrganizer && organizerStatus === 'PENDING') {
      return (
        <div className="space-y-4">
          <Alert className="bg-yellow-50 border-yellow-200">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800 font-semibold">Cadastro em análise</AlertTitle>
            <AlertDescription className="text-yellow-700 text-sm mt-1">
              Seu perfil de organizador está sendo analisado pela nossa equipe. Em breve você poderá criar eventos!
            </AlertDescription>
          </Alert>
          <Button disabled className="w-full gap-2 h-11" variant="outline">
            Aguardando aprovação
          </Button>
        </div>
      );
    }

    // Se é organizador rejeitado
    if (isOrganizer && organizerStatus === 'REJECTED') {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Solicitação não aprovada</AlertTitle>
            <AlertDescription className="text-sm mt-1">
              Infelizmente sua solicitação para ser organizador não foi aprovada neste momento.
            </AlertDescription>
          </Alert>
          <Button disabled className="w-full gap-2 h-11" variant="outline">
            Acesso restrito a compradores
          </Button>
        </div>
      );
    }

    // Se é apenas comprador (não tem role ORGANIZER)
    return (
      <div className="space-y-4">
        <Alert className="bg-blue-50 border-blue-200">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 font-semibold">Perfil de Comprador</AlertTitle>
          <AlertDescription className="text-blue-700 text-sm mt-1">
            Você está cadastrado como comprador. Para criar eventos, é necessário solicitar acesso de organizador.
          </AlertDescription>
        </Alert>
        <Button disabled className="w-full gap-2 h-11" variant="outline">
          Apenas organizadores podem criar eventos
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="default" 
            className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Crie seu Evento</span>
            <span className="sm:hidden">Criar</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Crie seu evento na PREFEST</DialogTitle>
          <DialogDescription className="text-center pt-2 text-muted-foreground">
            {user ? 
              "Comece a organizar seu próximo evento de sucesso agora mesmo." : 
              "Para publicar e vender ingressos, é necessário ter uma conta. O cadastro é rápido e gratuito."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
