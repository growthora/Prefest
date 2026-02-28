import { useState, useEffect } from 'react';
import { userService } from '@/services/user.service';
import { type Profile } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/contexts/ConfirmContext';
import { Users, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminOrganizers() {
  const [pendingOrganizers, setPendingOrganizers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { confirm } = useConfirm();

  useEffect(() => {
    loadPendingOrganizers();
  }, []);

  const loadPendingOrganizers = async () => {
    try {
      setIsLoading(true);
      const data = await userService.getPendingOrganizers();
      setPendingOrganizers(data);
    } catch (error) {
      toast.error('Erro ao carregar organizadores pendentes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveOrganizer = async (userId: string) => {
    try {
      setIsLoading(true);
      await userService.updateOrganizerStatus(userId, 'APPROVED');
      toast.success('Organizador aprovado com sucesso!');
      await loadPendingOrganizers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar organizador');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectOrganizer = async (userId: string) => {
    if (!await confirm({
      title: 'Rejeitar Organizador',
      description: 'Tem certeza que deseja rejeitar este organizador?',
      variant: 'destructive',
      confirmText: 'Rejeitar',
    })) return;

    try {
      setIsLoading(true);
      await userService.updateOrganizerStatus(userId, 'REJECTED');
      toast.success('Organizador rejeitado com sucesso!');
      await loadPendingOrganizers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar organizador');
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizadores</h1>
          <p className="text-muted-foreground">
            Aprove ou rejeite solicitações de novos organizadores
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Solicitações Pendentes ({pendingOrganizers.length})
          </CardTitle>
          <CardDescription>
            Usuários aguardando aprovação para se tornarem organizadores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && pendingOrganizers.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando solicitações...</p>
            </div>
          ) : pendingOrganizers.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Tudo limpo!</h3>
              <p className="text-muted-foreground">
                Nenhuma solicitação pendente no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {pendingOrganizers.map((organizer) => (
                  <motion.div
                    key={organizer.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg gap-4"
                  >
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {organizer.avatar_url ? (
                          <img src={organizer.avatar_url} alt={organizer.full_name || ''} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{organizer.full_name || 'Usuário sem nome'}</p>
                        <p className="text-sm text-muted-foreground">{organizer.email}</p>
                        <p className="text-xs text-muted-foreground mt-1 bg-muted px-2 py-0.5 rounded-full inline-block">
                          CPF: {organizer.cpf || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button 
                        variant="outline" 
                        className="flex-1 sm:flex-none border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        onClick={() => handleRejectOrganizer(organizer.id)}
                        disabled={isLoading}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rejeitar
                      </Button>
                      <Button 
                        className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                        onClick={() => handleApproveOrganizer(organizer.id)}
                        disabled={isLoading}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Aprovar
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
