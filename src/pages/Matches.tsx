import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTE_PATHS, Event } from '@/lib/index';
import { eventService } from '@/services/event.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Heart, 
  MessageCircle, 
  Calendar, 
  Settings, 
  Flame, 
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

import { matchService, Match as ServiceMatch } from '@/services/match.service';
import { chatService } from '@/services/chat.service';

export default function Matches() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('chats');
  const [matches, setMatches] = useState<ServiceMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Match Settings State
  const [matchEnabled, setMatchEnabled] = useState(false);
  const [matchIntention, setMatchIntention] = useState<'paquera' | 'amizade'>('paquera');
  const [genderPreference, setGenderPreference] = useState<'homens' | 'mulheres' | 'todos'>('todos');
  const [myEvents, setMyEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (profile) {
      setMatchEnabled(profile.match_enabled || false);
      setMatchIntention(profile.match_intention || 'paquera');
      setGenderPreference(profile.match_gender_preference || 'todos');
    }
  }, [profile]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const userMatches = await matchService.getUserMatches();
        setMatches(userMatches);

        // Load events (mock for now or real service if available)
        try {
           const events = await eventService.getEvents();
           setMyEvents(events.slice(0, 3));
        } catch (e) {
           console.log('Erro ao carregar eventos', e);
        }
      } catch (error) {
        console.error("Error loading match data", error);
        toast.error('Erro ao carregar matches');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const handleSaveSettings = async () => {
    try {
      await updateProfile({
        match_enabled: matchEnabled,
        match_intention: matchIntention,
        match_gender_preference: genderPreference,
      });
      setIsSettingsOpen(false);
      toast.success('Preferências de Match atualizadas!');
    } catch (error) {
      toast.error('Erro ao salvar preferências');
    }
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="container max-w-md mx-auto px-4 py-6 mb-20">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Match <Flame className="w-6 h-6 text-primary fill-primary" />
            </h1>
            <p className="text-sm text-muted-foreground">Conexões e encontros</p>
          </div>
          
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <Settings className="w-6 h-6 text-gray-600" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm rounded-2xl">
              <DialogHeader>
                <DialogTitle>Preferências de Match</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Ativar Match</Label>
                    <p className="text-xs text-muted-foreground">Ficar visível para outros participantes</p>
                  </div>
                  <Switch checked={matchEnabled} onCheckedChange={setMatchEnabled} />
                </div>

                <div className="space-y-2">
                  <Label>O que você busca?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant={matchIntention === 'paquera' ? 'default' : 'outline'}
                      onClick={() => setMatchIntention('paquera')}
                      className="w-full justify-start gap-2"
                    >
                      <Heart className="w-4 h-4" /> Paquera
                    </Button>
                    <Button 
                      variant={matchIntention === 'amizade' ? 'default' : 'outline'}
                      onClick={() => setMatchIntention('amizade')}
                      className="w-full justify-start gap-2"
                    >
                      <Users className="w-4 h-4" /> Amizade
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tenho interesse em</Label>
                  <Select value={genderPreference} onValueChange={(v: any) => setGenderPreference(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homens">Homens</SelectItem>
                      <SelectItem value="mulheres">Mulheres</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSaveSettings} className="w-full">
                  Salvar Preferências
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <Tabs defaultValue="chats" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="chats">Conversas</TabsTrigger>
            <TabsTrigger value="events">Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="chats" className="space-y-4">
            {!matchEnabled && (
              <Card className="bg-muted/50 border-none mb-6">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <Flame className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Match está desativado</h3>
                    <p className="text-sm text-muted-foreground mt-1">Ative para ver suas conexões e conversar.</p>
                  </div>
                  <Button onClick={() => { setMatchEnabled(true); handleSaveSettings(); }}>
                    Ativar Match
                  </Button>
                </CardContent>
              </Card>
            )}

            {matchEnabled && (
              <div className="space-y-2">
                {matches.length === 0 ? (
                   <div className="text-center py-10 text-muted-foreground">
                     <p>Nenhum match ainda. Continue curtindo!</p>
                   </div>
                ) : (
                  matches.map(match => (
                    <div 
                      key={match.match_id} 
                      onClick={() => navigate(`/chat/${match.match_id}`)}
                      className="flex items-center gap-4 p-3 bg-card rounded-xl border border-border/50 hover:bg-accent/50 transition-colors cursor-pointer active:scale-98"
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 border border-border">
                          <AvatarImage src={match.partner_avatar} />
                          <AvatarFallback>{match.partner_name?.[0]}</AvatarFallback>
                        </Avatar>
                        {/* Indicador de não lido poderia ser implementado verificando mensagens não lidas */}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-sm truncate">{match.partner_name}</h4>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(match.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 font-medium">
                          Toque para conversar
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div className="flex items-center gap-2 mb-4 px-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium">Eventos disponíveis para Match</h3>
            </div>
            
            <div className="grid gap-3">
              {myEvents.map(event => (
                <Card 
                  key={event.id} 
                  className="overflow-hidden border-border/50 cursor-pointer hover:border-primary/50 transition-all active:scale-98"
                  onClick={() => navigate(`/match/${event.id}`)}
                >
                  <div className="flex h-24">
                    <div className="w-24 relative">
                      <img 
                        src={event.image} 
                        alt={event.title} 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
                    </div>
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div>
                        <h4 className="font-semibold text-sm line-clamp-1">{event.title}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" /> {event.date}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-gray-200" />
                          ))}
                          <div className="w-6 h-6 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                            +120
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border-none">
                          Entrar no Match
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
