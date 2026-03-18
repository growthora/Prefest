import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, RefreshCcw, Ticket, Wallet } from 'lucide-react';
import { refundService, type RefundEligibleTicket, type RefundRequestRecord } from '@/services/refund.service';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/format';
import { Link } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib';

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

export default function RefundRequests() {
  const [requests, setRequests] = useState<RefundRequestRecord[]>([]);
  const [eligibleTickets, setEligibleTickets] = useState<RefundEligibleTicket[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await refundService.getMyRefundData();
      setRequests(data.requests);
      setEligibleTickets(data.eligibleTickets);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar solicitações de reembolso');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const availableTickets = useMemo(
    () => eligibleTickets.filter((ticket) => ticket.can_request_refund),
    [eligibleTickets],
  );

  const handleSubmit = async (ticketId: string) => {
    try {
      setSubmittingId(ticketId);
      await refundService.createRefundRequest(ticketId, reasons[ticketId] || '');
      toast.success('Solicitação de reembolso enviada com sucesso.');
      setReasons((prev) => ({ ...prev, [ticketId]: '' }));
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao solicitar reembolso');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Layout fullWidth>
      <div className="min-h-screen bg-background">
        <section className="container mx-auto max-w-6xl px-4 py-12 space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Solicitar Reembolso</h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Envie uma solicitação para ingressos pagos elegíveis. O reembolso é analisado antes do processamento final.
              </p>
            </div>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-900 space-y-1">
                <p>O pedido é registrado e pode passar por análise manual.</p>
                <p>Ingressos gratuitos, cancelados, usados ou já reembolsados não são elegíveis.</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Ingressos elegíveis</CardTitle>
                <CardDescription>Selecione um ingresso pago para solicitar reembolso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando ingressos...</p>
                ) : availableTickets.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
                    <p>Nenhum ingresso elegível encontrado no momento.</p>
                    <Link to={ROUTE_PATHS.MY_EVENTS} className="text-primary hover:underline">
                      Ver meus eventos
                    </Link>
                  </div>
                ) : (
                  availableTickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-xl border p-4 space-y-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-primary" />
                            <h3 className="font-semibold">{ticket.event?.title || 'Evento'}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{ticket.ticket_type?.name || 'Ingresso'}</p>
                          <p className="text-sm text-muted-foreground">Pagamento: {ticket.payment?.payment_method || 'Não informado'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Valor pago</p>
                          <p className="text-lg font-bold">{formatCurrency(Number(ticket.payment?.value || ticket.total_price || 0))}</p>
                        </div>
                      </div>

                      <Textarea
                        value={reasons[ticket.id] || ''}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                        placeholder="Informe o motivo do reembolso (opcional)"
                        className="min-h-[96px]"
                      />

                      <div className="flex justify-end">
                        <Button onClick={() => handleSubmit(ticket.id)} disabled={submittingId === ticket.id}>
                          <Wallet className="w-4 h-4 mr-2" />
                          {submittingId === ticket.id ? 'Enviando...' : 'Solicitar reembolso'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Minhas solicitações</CardTitle>
                <CardDescription>Acompanhe o status dos pedidos já enviados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
                ) : requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Você ainda não abriu nenhuma solicitação.</p>
                ) : (
                  requests.map((request) => {
                    const linkedTicket = eligibleTickets.find((ticket) => ticket.id === request.ticket_id);
                    return (
                      <div key={request.id} className="rounded-xl border p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{linkedTicket?.event?.title || 'Ingresso'}</p>
                            <p className="text-sm text-muted-foreground">{linkedTicket?.ticket_type?.name || 'Ingresso'}</p>
                          </div>
                          <Badge variant={statusVariants[request.status] || 'secondary'}>
                            {statusLabels[request.status] || request.status}
                          </Badge>
                        </div>
                        {request.reason && (
                          <p className="text-sm text-muted-foreground">Motivo: {request.reason}</p>
                        )}
                        {request.notes && (
                          <p className="text-sm text-muted-foreground">Observações: {request.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Solicitado em {new Date(request.requested_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </Layout>
  );
}
