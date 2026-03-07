import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { uptimeRobotService, type UptimeRobotMonitor } from '@/services/uptimerobot.service';

const isUp = (status: number) => status === 2;
const isDown = (status: number) => status === 8 || status === 9;

const getStatusLabel = (status: number) => {
  if (status === 2) return 'Operacional';
  if (status === 8) return 'Instavel';
  if (status === 9) return 'Indisponivel';
  if (status === 0) return 'Pausado';
  if (status === 1) return 'Verificando';
  return 'Desconhecido';
};

const getStatusBadgeVariant = (status: number): 'default' | 'destructive' | 'secondary' | 'outline' => {
  if (status === 2) return 'default';
  if (status === 9) return 'destructive';
  if (status === 8) return 'secondary';
  return 'outline';
};

export default function StatusPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['uptimerobot-status'],
    queryFn: () => uptimeRobotService.getStatus('main'),
    refetchInterval: 60000,
  });

  const monitors = data?.monitors ?? [];

  const summary = useMemo(() => {
    const total = monitors.length;
    const online = monitors.filter((monitor) => isUp(monitor.status)).length;
    const offline = monitors.filter((monitor) => isDown(monitor.status)).length;
    return { total, online, offline };
  }, [monitors]);

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Status do Sistema</h1>
            <p className="text-muted-foreground">Acompanhe em tempo real o que esta funcionando e o que esta indisponivel.</p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" className="gap-2 w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Servicos Operacionais</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-2xl font-bold text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {summary.online}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Com Problema</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-2xl font-bold text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              {summary.offline}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Monitorado</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-2xl font-bold">
              <Activity className="h-5 w-5" />
              {summary.total}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Servicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando status...</p>}

            {error && (
              <p className="text-sm text-rose-600">
                Nao foi possivel carregar os status agora. Tente novamente em instantes.
              </p>
            )}

            {!isLoading && !error && monitors.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum monitor encontrado no UptimeRobot.</p>
            )}

            {monitors.map((monitor: UptimeRobotMonitor) => {
              const uptime = Number(monitor.all_time_uptime_ratio || monitor.uptime_ratio || 0);
              return (
                <div
                  key={monitor.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words">{monitor.friendly_name}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Uptime: {uptime.toFixed(2)}%</span>
                    <Badge variant={getStatusBadgeVariant(monitor.status)}>{getStatusLabel(monitor.status)}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}




