import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Ticket, 
  Heart, 
  User as UserIcon, 
  HelpCircle, 
  LayoutDashboard, 
  LogOut,
  Lock,
  ChevronRight,
  Shield
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/user.service';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ROUTE_PATHS } from '@/lib';

export const ProfileMenu = () => {
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showOrganizerModal, setShowOrganizerModal] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  if (!profile) return null;

  const isOrganizer = profile.roles.includes('ORGANIZER');
  const isPending = profile.organizer_status === 'PENDING';
  const isApproved = profile.organizer_status === 'APPROVED';

  // Determine header role text
  let roleText = 'Comprador';
  if (isApproved) {
    roleText = 'Organizador • Comprador';
  } else if (isPending) {
    roleText = 'Organizador (em análise)';
  }

  const handleLogout = async () => {
    try {
      await signOut();
      navigate(ROUTE_PATHS.LOGIN);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const handleRequestOrganizer = async () => {
    if (!user) return;
    
    setIsRequesting(true);
    try {
      await userService.requestOrganizerAccess(user.id);
      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação para se tornar organizador foi enviada com sucesso e está em análise.",
      });
      setShowOrganizerModal(false);
      // O profile deve atualizar automaticamente via AuthContext/subscription ou refresh
      window.location.reload(); // Fallback simples para atualizar estado
    } catch (error) {
      console.error('Erro ao solicitar acesso:', error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar solicitação",
        description: "Ocorreu um erro ao processar sua solicitação. Tente novamente.",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-10 h-10 rounded-full border border-border/50 overflow-hidden hover:border-primary/50 transition-colors bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.full_name || 'Profile'} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-medium">
                {profile.full_name?.charAt(0).toUpperCase() || <UserIcon className="w-5 h-5" />}
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{profile.full_name}</p>
              <p className="text-xs leading-none text-muted-foreground flex items-center gap-1.5 mt-1.5">
                {isApproved && <LayoutDashboard className="w-3 h-3 text-primary" />}
                {roleText}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to={ROUTE_PATHS.MY_EVENTS} className="cursor-pointer">
                <Ticket className="mr-2 h-4 w-4" />
                <span>Ingressos</span>
              </Link>
            </DropdownMenuItem>
            {/* Matches link removed */}
            <DropdownMenuItem asChild>
              <Link to={ROUTE_PATHS.PROFILE} state={{ activeTab: 'favorites' }} className="cursor-pointer">
                <Heart className="mr-2 h-4 w-4" />
                <span>Favoritos</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={ROUTE_PATHS.PROFILE} className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Minha conta</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={ROUTE_PATHS.HELP_CENTER} className="cursor-pointer">
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Central de ajuda</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            {isApproved ? (
              <DropdownMenuItem asChild>
                <Link to={ROUTE_PATHS.ORGANIZER_DASHBOARD} className="cursor-pointer font-medium text-primary">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Dashboard do Organizador</span>
                </Link>
              </DropdownMenuItem>
            ) : isPending ? (
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <DropdownMenuItem disabled className="cursor-not-allowed opacity-70">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard (em análise)</span>
                        <Lock className="ml-auto h-3 w-3" />
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Sua solicitação está em análise pelo administrador.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <DropdownMenuItem 
                onClick={() => setShowOrganizerModal(true)}
                className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard do Organizador</span>
                <Lock className="ml-auto h-3 w-3" />
              </DropdownMenuItem>
            )}
            
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/admin" className="cursor-pointer font-medium text-red-600">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Dashboard Admin</span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
            <LogOut className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Sair</span>
              <span className="text-[10px] text-muted-foreground font-normal">Não é você? Sair agora</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showOrganizerModal} onOpenChange={setShowOrganizerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Torne-se um Organizador</DialogTitle>
            <DialogDescription>
              Para acessar o dashboard de organizador e criar seus próprios eventos, é necessário solicitar aprovação da nossa equipe.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Gerencie seus eventos</p>
                <p className="text-muted-foreground">Tenha acesso a ferramentas completas para criar e gerenciar vendas.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrganizerModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRequestOrganizer} disabled={isRequesting}>
              {isRequesting ? "Enviando..." : "Solicitar acesso como organizador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
