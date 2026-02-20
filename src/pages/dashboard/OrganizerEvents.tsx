import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { eventService, type Event } from '@/services/event.service';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { DashboardLoader } from '@/components/dashboard/DashboardLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Edit, Eye, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateEventModal } from '@/components/CreateEventModal';
import { EventDetailsModal } from '@/components/dashboard/events/EventDetailsModal';
import { EditEventModal } from '@/components/dashboard/events/EditEventModal';
import { DeleteEventDialog } from '@/components/dashboard/events/DeleteEventDialog';

export function OrganizerEvents() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // CRUD State
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [user]);

  const loadEvents = async () => {
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
  };

  const handleAction = (event: Event, action: 'view' | 'edit' | 'delete') => {
    setSelectedEvent(event);
    if (action === 'view') setIsViewOpen(true);
    if (action === 'edit') setIsEditOpen(true);
    if (action === 'delete') setIsDeleteOpen(true);
  };

  const handleSuccess = () => {
    loadEvents();
    // Close all modals
    setIsViewOpen(false);
    setIsEditOpen(false);
    setIsDeleteOpen(false);
    setSelectedEvent(null);
  };

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <DashboardLoader />;

  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full">
        <DashboardEmptyState />
        
        {/* Modals for initial empty state if needed, though usually not accessible */}
        <CreateEventModal 
          trigger={
            <Button className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Criar Primeiro Evento
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Eventos</h1>
          <p className="text-muted-foreground">Gerencie seus eventos criados</p>
        </div>
        <CreateEventModal 
          trigger={
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Evento
            </Button>
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar eventos..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vendas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{event.title}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {event.location}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(event.event_date).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant={new Date(event.event_date) > new Date() ? "default" : "secondary"}>
                    {new Date(event.event_date) > new Date() ? "Ativo" : "Realizado"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {event.current_participants} / {event.max_participants || '∞'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleAction(event, 'view')}>
                        <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAction(event, 'edit')}>
                        <Edit className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={() => handleAction(event, 'delete')}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* CRUD Modals */}
      <EventDetailsModal
        event={selectedEvent}
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
      />

      <EditEventModal
        event={selectedEvent}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={handleSuccess}
      />

      <DeleteEventDialog
        event={selectedEvent}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default OrganizerEvents;
