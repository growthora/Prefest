import { useState, useEffect } from 'react';
import { eventRequestService, type EventRequest } from '@/services/event-request.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Trash2, Mail, Phone, MapPin, User } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirm } from '@/contexts/ConfirmContext';

export default function AdminRequests() {
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { confirm } = useConfirm();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const data = await eventRequestService.getAllRequests();
      setEventRequests(data);
    } catch (error) {
      toast.error('Erro ao carregar solicitações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, status: EventRequest['status']) => {
    try {
      await eventRequestService.updateRequestStatus(requestId, status);
      toast.success('Status atualizado!');
      loadRequests();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!await confirm({
      title: 'Excluir Solicitação',
      description: 'Deseja realmente excluir esta solicitação? Esta ação não pode ser desfeita.',
      variant: 'destructive',
      confirmText: 'Excluir',
    })) return;

    try {
      await eventRequestService.deleteRequest(requestId);
      toast.success('Solicitação excluída!');
      loadRequests();
    } catch (error) {
      toast.error('Erro ao excluir solicitação');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
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
          <h1 className="text-3xl font-bold tracking-tight">Solicitações de Eventos</h1>
          <p className="text-muted-foreground">
            Gerencie as solicitações de criação de eventos enviadas pelos usuários
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading && eventRequests.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando solicitações...</p>
          </div>
        ) : eventRequests.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma solicitação pendente</h3>
            <p className="text-muted-foreground">
              Novas solicitações aparecerão aqui.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {eventRequests.map((request) => (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div>
                      <CardTitle className="text-xl">{request.event_name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        Solicitado em {new Date(request.created_at).toLocaleDateString('pt-BR')}
                      </CardDescription>
                    </div>
                    <Badge 
                      className="ml-2"
                      variant={
                        request.status === 'pending' ? 'default' :
                        request.status === 'contacted' ? 'secondary' :
                        request.status === 'approved' ? 'outline' : 'destructive'
                      }
                    >
                      {request.status === 'pending' ? 'Pendente' :
                       request.status === 'contacted' ? 'Contatado' :
                       request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                      <div className="space-y-1">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          Solicitante
                        </p>
                        <p className="text-sm">{request.user_name}</p>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          Email
                        </p>
                        <p className="text-sm">{request.email}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          Telefone
                        </p>
                        <p className="text-sm">{request.phone}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          Cidade
                        </p>
                        <p className="text-sm">{request.city}</p>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          Local do Evento
                        </p>
                        <p className="text-sm">{request.event_location}</p>
                      </div>

                      {request.notes && (
                        <div className="col-span-full bg-muted/30 p-4 rounded-md">
                          <p className="text-sm font-medium mb-1">Observações</p>
                          <p className="text-sm text-muted-foreground">{request.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                      <div className="flex-1">
                        <Select
                          value={request.status}
                          onValueChange={(value) => handleUpdateStatus(request.id, value as EventRequest['status'])}
                        >
                          <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Alterar status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="contacted">Contatado</SelectItem>
                            <SelectItem value="approved">Aprovado</SelectItem>
                            <SelectItem value="rejected">Rejeitado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteRequest(request.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
