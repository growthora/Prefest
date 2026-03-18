import { useEffect, useState } from 'react';
import { refundService, type AdminRefundRequest } from '@/services/refund.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { RefreshCcw, Wallet } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

const statusLabels: Record<string, string> = {
  requested: 'Solicitado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  processing: 'Processando',
  refunded: 'Reembolsado',
  failed: 'Falhou',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  requested: 'secondary',
  approved: 'outline',
  rejected: 'destructive',
  processing: 'default',
  refunded: 'outline',
  failed: 'destructive',
};

export default function AdminRefunds() {
  const [refundRequests, setRefundRequests] = useState<AdminRefundRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await refundService.getAdminRefundRequests();
      setRefundRequests(data);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar reembolsos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAction = async (requestId: string, action: 'approve' | 'reject' | 'process') => {
    try {
      setProcessingId(requestId);
      await refundService.updateRefundRequest(requestId, action, notes[requestId] || '');
      toast.success('Solicitação atualizada com sucesso.');
      await loadRequests();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar solicitação');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reembolsos</h1>
          <p className="text-muted-foreground">Acompanhe, aprove e processe solicitações de reembolso.</p>
        </div>
        <Button variant="outline" onClick={loadRequests} disabled={loading}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading && refundRequests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Carregando solicitações...</div>
        ) : refundRequests.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20 text-muted-foreground">
            Nenhuma solicitação de reembolso encontrada.
          </div>
        ) : (
          refundRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{request.ticket?.event?.title || 'Evento sem título'}</CardTitle>
                    <CardDescription>
                      {request.user?.full_name || 'Usuário'} · {request.user?.email || 'Sem email'}
                    </CardDescription>
                  </div>
                  <Badge variant={statusVariants[request.status] || 'secondary'}>
                    {statusLabels[request.status] || request.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
                  <div>
                    <p className="font-medium">Ingresso</p>
                    <p className="text-muted-foreground">{request.ticket?.ticket_type?.name || 'Ingresso'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Valor</p>
                    <p className="text-muted-foreground">{formatCurrency(Number(request.payment?.value || request.ticket?.total_price || 0))}</p>
                  </div>
                  <div>
                    <p className="font-medium">Pagamento</p>
                    <p className="text-muted-foreground">{request.payment?.payment_method || 'Não informado'} · {request.payment?.status || 'Sem status'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Solicitado em</p>
                    <p className="text-muted-foreground">{new Date(request.requested_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>

                {request.reason && (
                  <div className="rounded-lg bg-muted/40 p-3 text-sm">
                    <p className="font-medium mb-1">Motivo</p>
                    <p className="text-muted-foreground">{request.reason}</p>
                  </div>
                )}

                <Textarea
                  value={notes[request.id] ?? request.notes ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                  placeholder="Observações internas ou resposta ao cliente"
                  className="min-h-[88px]"
                />

                <div className="flex flex-wrap gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => handleAction(request.id, 'approve')}
                    disabled={processingId === request.id || ['approved', 'processing', 'refunded'].includes(request.status)}
                  >
                    Aprovar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleAction(request.id, 'reject')}
                    disabled={processingId === request.id || ['rejected', 'refunded'].includes(request.status)}
                  >
                    Rejeitar
                  </Button>
                  <Button
                    onClick={() => handleAction(request.id, 'process')}
                    disabled={processingId === request.id || !['approved', 'requested', 'failed', 'processing'].includes(request.status)}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {processingId === request.id ? 'Processando...' : 'Processar reembolso'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
