import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { eventService, type Event } from '@/services/event.service';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Participants() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  useEffect(() => {
    async function loadEvents() {
      if (!user) return;
      try {
        setLoading(true);
        const data = await eventService.getEventsByCreator(user.id);
        setEvents(data);
      } catch (error) {
        console.error('Failed to load events', error);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [user]);

  useEffect(() => {
    async function loadParticipants() {
      if (!selectedEventId) return;
      try {
        setLoadingParticipants(true);
        const data = await eventService.getEventParticipants(selectedEventId, 100);
        setParticipants(data);
      } catch (error) {
        console.error('Failed to load participants', error);
      } finally {
        setLoadingParticipants(false);
      }
    }
    loadParticipants();
  }, [selectedEventId]);

  if (loading) return <DashboardLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Participantes</h1>
        
        <div className="w-full sm:w-[300px]">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed rounded-lg bg-muted/50">
          <Users className="w-10 h-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Lista de Participantes</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Selecione um evento acima para ver a lista de participantes.
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {events.find(e => e.id === selectedEventId)?.title} - Participantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingParticipants ? (
               <div className="flex justify-center p-8">
                 <DashboardLoader />
               </div>
            ) : participants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum participante encontrado para este evento.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Avatar</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={participant.avatar_url} />
                          <AvatarFallback>{participant.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{participant.name}</TableCell>
                      <TableCell>
                        {participant.status === 'valid' && (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-500 text-white hover:bg-green-600">
                            Confirmado
                          </span>
                        )}
                        {participant.status === 'used' && (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-blue-500 text-white hover:bg-blue-600">
                            Utilizado
                          </span>
                        )}
                        {participant.status === 'canceled' && (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-red-500 text-white hover:bg-red-600">
                            Cancelado
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Participants;
