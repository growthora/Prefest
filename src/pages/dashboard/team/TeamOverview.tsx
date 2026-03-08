import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { eventService, type Event } from '@/services/event.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROUTE_PATHS } from '@/lib';
import { QrCode, CalendarDays, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ScanLog {
  id: string;
  ticket_ref: string;
  status: string;
  scanned_at: string;
}

function normalizeScanStatus(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'valid';
  if (value.includes('already') || value.includes('used') || value.includes('ja')) return 'already_used';
  if (value.includes('valid') || value.includes('ok') || value.includes('success')) return 'valid';
  return value;
}

export default function TeamOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const teamEvents = await eventService.getScannerEvents(user.id);
        setEvents(teamEvents);
        const firstEventId = teamEvents[0]?.id || '';
        setSelectedEventId(firstEventId);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  useEffect(() => {
    const loadLogs = async () => {
      if (!selectedEventId) {
        setScanLogs([]);
        return;
      }

      try {
        const rows = await eventService.getEventScanLogs(selectedEventId, 50);
        const mapped = rows.map((row: any, index: number) => ({
          id: String(row.id || `${index}`),
          ticket_ref: String(row.ticket_id || row.participant_id || row.event_participant_id || row.ticket_code || 'N/A'),
          status: normalizeScanStatus(row.scan_status || row.status),
          scanned_at: String(row.scanned_at || row.created_at || row.check_in_at || ''),
        }));

        mapped.sort((a, b) => {
          const aTime = a.scanned_at ? new Date(a.scanned_at).getTime() : 0;
          const bTime = b.scanned_at ? new Date(b.scanned_at).getTime() : 0;
          return bTime - aTime;
        });

        setScanLogs(mapped.slice(0, 20));
      } catch {
        setScanLogs([]);
      }
    };

    loadLogs();
  }, [selectedEventId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel da Equipe</h1>
        <p className="text-muted-foreground">Acesso operacional para leitura de ingressos.</p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Evento</CardTitle>
          <CardDescription>Selecione o evento para operar no scanner.</CardDescription>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? 'Carregando eventos...' : 'Selecione um evento'} />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedEvent ? (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
              <div className="font-medium">{selectedEvent.title}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {new Date(selectedEvent.event_date).toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {selectedEvent.location}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum evento disponível para sua equipe.</p>
          )}

          <Button
            onClick={() => navigate(ROUTE_PATHS.ORGANIZER_SCANNER)}
            disabled={!selectedEventId}
            className="w-full"
          >
            <QrCode className="mr-2 h-4 w-4" />
            Abrir Scanner
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos scans</CardTitle>
          <CardDescription>Ingressos escaneados no evento selecionado.</CardDescription>
        </CardHeader>
        <CardContent>
          {scanLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum scan registrado.</p>
          ) : (
            <div className="space-y-2">
              {scanLogs.map((log) => (
                <div key={log.id} className="rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Ingresso: {log.ticket_ref}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.scanned_at ? new Date(log.scanned_at).toLocaleString('pt-BR') : 'Sem data'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium">
                    {log.status === 'already_used' ? (
                      <>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Já utilizado
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Válido
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
