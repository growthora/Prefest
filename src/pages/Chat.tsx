import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  ArrowLeft, 
  MoreVertical, 
  Sparkles, 
  Clock, 
  ShieldCheck,
  Music,
  Check,
  CheckCheck,
  Trash2,
  Ticket,
  Search,
  MessageCircle,
  Calendar,
  MapPin,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { ROUTE_PATHS } from '@/lib';
import { chatService, ChatMessage } from '@/services/chat.service';
import { matchService, Match } from '@/services/match.service';
import { eventService } from '@/services/event.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const ICEBREAKERS = [
  "Qual música você está mais ansioso para ouvir hoje? 🎶",
  "Primeira vez nesse evento ou já é veterano?",
  "O que você achou do line-up deste ano? 🔥",
  "Qual sua 'vibe' preferida para eventos assim?"
];

interface UserEvent {
  id: string;
  slug?: string;
  title: string;
  event_date: string;
  location: string;
  image_url: string | null;
  current_participants: number;
}

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerActive, setPartnerActive] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // List View State
  const [matches, setMatches] = useState<Match[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'events' | 'matches'>('events');
  const [userEvents, setUserEvents] = useState<UserEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Load matches list if no matchId
  useEffect(() => {
    if (!user || matchId) return;
    
    const loadMatches = async () => {
      try {
        setLoading(true);
        const data = await matchService.getUserMatches();
        setMatches(data);
      } catch (error) {
        console.error('Error loading matches:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMatches();

    // Subscribe to changes
    const subscription = supabase
      .channel('public:matches_list_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadMatches())
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, matchId]);

  useEffect(() => {
    if (!user || matchId) return;
    const loadEvents = async () => {
      try {
        setEventsLoading(true);
        const events = await eventService.getUserEvents(user.id);
        setUserEvents(events as unknown as UserEvent[]);
      } catch (error) {
        console.error('Erro ao carregar eventos do usuário:', error);
      } finally {
        setEventsLoading(false);
      }
    };
    loadEvents();
  }, [user, matchId]);

  // Carregar dados do match e chat
  useEffect(() => {
    const loadData = async () => {
      if (!matchId || !user) return;
      
      try {
        setLoading(true);
        
        // 1. Buscar detalhes do match diretamente pelo ID
        const currentMatch = await matchService.getMatchDetails(matchId);
        
        if (!currentMatch || currentMatch.status !== 'active') {
          console.error('Match not found or inactive:', matchId);
          toast.error('Match não encontrado ou inativo');
          navigate(ROUTE_PATHS.MY_EVENTS);
          return;
        }
        setMatch(currentMatch);

        // 2. Obter ou criar chat
        const cid = await chatService.getOrCreateChat(matchId);
        setChatId(cid);

        // 3. Carregar mensagens
        const msgs = await chatService.getMessages(cid);
        setMessages(msgs);

        // Mark as read immediately
        chatService.markMessagesAsRead(cid);

      } catch (error) {
        console.error('Erro ao carregar chat:', error);
        toast.error('Erro ao carregar conversa');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [matchId, user, navigate]);

  // Realtime Subscription & Presence
  useEffect(() => {
    if (!chatId) return;

    // 1. Update my presence
    chatService.updatePresence(chatId);

    // 2. Subscribe to Chat Messages
    const channel = chatService.subscribeToChat(
        chatId,
        (newMsg) => {
            setMessages(prev => {
                // Deduplicate logic
                const exists = prev.some(m => m.id === newMsg.id);
                if (exists) {
                    return prev.map(m => m.id === newMsg.id ? { ...m, ...newMsg } : m);
                }
                setPartnerTyping(false); // Clear typing
                return [...prev, newMsg];
            });

            // Mark as read immediately if message is not mine and has INSERT event (implied by service logic)
            if (newMsg.sender_id !== user?.id && (!newMsg.status || newMsg.status === 'sent')) {
                chatService.markMessagesAsRead(chatId);
            }
        },
        (payload) => {
             // Handle typing event
             if (payload.userId !== user?.id) {
                 setPartnerTyping(payload.isTyping);
                 
                 // Clear typing indicator after 3 seconds if no more events
                 if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                 if (payload.isTyping) {
                     typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
                 }
             }
        }
    );

    channelRef.current = channel;

    // 3. Subscribe to Partner Presence
    if (match?.partner_id) {
        // Initial fetch
        chatService.getPresence(match.partner_id).then(activeChatId => {
             setPartnerActive(activeChatId === chatId);
        });

        const presenceChannel = chatService.subscribeToPartnerPresence(match.partner_id, (activeChatId) => {
            setPartnerActive(activeChatId === chatId);
        });
        presenceChannelRef.current = presenceChannel;
    }

    // 4. Subscribe to Match Status (Unmatch)
    const matchSub = supabase
      .channel(`match_status:${matchId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'matches', 
        filter: `id=eq.${matchId}` 
      }, (payload) => {
        if (payload.new.status === 'inactive') {
          toast.info('O match foi desfeito.');
          navigate(ROUTE_PATHS.MY_EVENTS);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      matchSub.unsubscribe();
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
      channelRef.current = null;
      presenceChannelRef.current = null;
      
      // Clear presence on unmount/change
      chatService.updatePresence(null);
    };
  }, [chatId, user, match, matchId, navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!matchId) {
    const filteredMatches = matches.filter(m => 
      m.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.event_title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <Layout>
        <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] md:h-[calc(100vh-12rem)] flex flex-col bg-card/30 border border-border/40 rounded-2xl overflow-hidden backdrop-blur-sm mt-4 md:mt-0">
          <div className="p-4 border-b border-border/40">
            <h2 className="text-xl font-semibold mb-4">Conexões</h2>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'events' | 'matches')} className="mt-2">
              <TabsList className="grid grid-cols-2 w-full max-w-sm">
                <TabsTrigger value="events">Meus Eventos</TabsTrigger>
                <TabsTrigger value="matches">Meus Matchs</TabsTrigger>
              </TabsList>
            </Tabs>
            {activeTab === 'matches' && (
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar conversas..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>
            )}
          </div>
          
          <ScrollArea className="flex-1">
            <Tabs value={activeTab} className="h-full">
              <TabsContent value="events" className="h-full m-0">
                {eventsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Calendar className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-medium text-lg mb-2">Carregando seus eventos</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Buscando os eventos em que você já garantiu ingresso.
                    </p>
                  </div>
                ) : userEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Ticket className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-medium text-lg mb-2">Nenhum evento encontrado</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mb-4">
                      Garanta ingresso em um evento para liberar o Match da galera.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                    {userEvents
                      .slice()
                      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
                      .map((event) => (
                        <button
                          key={event.id}
                          onClick={() => navigate(`/eventos/${event.slug || event.id}?tab=match`)}
                          className="text-left rounded-xl border border-border/40 bg-background/40 hover:bg-background/70 transition-colors overflow-hidden"
                        >
                          <div className="relative h-32">
                            <img
                              src={event.image_url || ''}
                              alt={event.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/40">
                                <Calendar className="w-3 h-3" />
                                {new Date(event.event_date).toLocaleDateString('pt-BR')}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/40">
                                <Users className="w-3 h-3" />
                                {event.current_participants} pessoas
                              </span>
                            </div>
                          </div>
                          <div className="p-4 space-y-2">
                            <h3 className="font-semibold text-sm line-clamp-2">{event.title}</h3>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{event.location}</span>
                            </div>
                            <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary font-medium">
                              <Sparkles className="w-3 h-3" />
                              Ver Match da galera
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="matches" className="h-full m-0">
                {filteredMatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <MessageCircle className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-medium text-lg mb-2">Nenhuma conversa ainda</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Dê like em pessoas nos eventos para começar novas conversas!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {filteredMatches.map((m) => (
                      <button
                        key={m.match_id}
                        onClick={() => navigate(`/chat/${m.match_id}`)}
                        className="flex items-center gap-3 p-4 hover:bg-white/5 transition-colors border-b border-border/40 text-left"
                      >
                        <div className="relative">
                          <Avatar className="w-12 h-12 border border-primary/20">
                            <AvatarImage src={m.partner_avatar} className="object-cover" />
                            <AvatarFallback>{m.partner_name[0]}</AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium truncate">{m.partner_name}</h3>
                            {m.last_message_time && (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                {format(new Date(m.last_message_time), 'HH:mm', { locale: ptBR })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs truncate ${m.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              {m.last_message || 'Inicie a conversa...'}
                            </p>
                            {m.unread_count > 0 && (
                              <Badge variant="default" className="h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center text-[10px]">
                                {m.unread_count}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1.5">
                            <Ticket className="w-3 h-3" />
                            <span className="truncate">{m.event_title}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </div>
      </Layout>
    );
  }

  if (!match) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      
      if (chatId && channelRef.current) {
          const now = Date.now();
          if (now - lastTypingSentRef.current > 2000) {
              chatService.sendTyping(channelRef.current, true);
              lastTypingSentRef.current = now;
          }
      }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !chatId) return;

    const content = inputValue;
    setInputValue(''); // Limpar input imediatamente (optimistic UI)
    
    // Stop typing
    if (channelRef.current) {
        chatService.sendTyping(channelRef.current, false);
    }

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
        id: tempId,
        chat_id: chatId,
        sender_id: user?.id || '',
        content: content,
        created_at: new Date().toISOString(),
        status: 'sent',
        sender: {
            id: user?.id || '',
            full_name: user?.user_metadata?.full_name || 'Eu',
            avatar_url: user?.user_metadata?.avatar_url || '' 
        }
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // Note: same assumption as FloatingChat - if sendMessage returns data, update optimistic.
      const sentMsg = await chatService.sendMessage(chatId, content);
      
      // Replace optimistic message
      if (sentMsg) {
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? (sentMsg as unknown as ChatMessage) : msg
          ));
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
      // Remove optimistic message and restore input
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setInputValue(content);
    }
  };

  const handleDeleteChat = async () => {
    if (!match?.match_id) return;

    try {
      await chatService.unmatchUser(match.match_id);
      toast.success('Match desfeito e conversa encerrada');
      navigate(ROUTE_PATHS.MY_EVENTS);
    } catch (error) {
      toast.error('Erro ao desfazer match');
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status?: 'sent' | 'delivered' | 'seen') => {
      if (status === 'seen') return <CheckCheck className="w-3 h-3 text-blue-500" />;
      if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      return <Check className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-card/30 border border-border/40 rounded-2xl overflow-hidden backdrop-blur-sm">
        {/* Chat Header */}
        <header className="p-4 border-b border-border/40 flex items-center justify-between bg-background/40">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-white/5" 
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border border-primary/20">
                <AvatarImage src={match.partner_avatar} className="object-cover" />
                <AvatarFallback className="bg-secondary text-secondary-foreground font-mono">
                  {match.partner_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-sm leading-tight flex items-center gap-2">
                  {match.partner_name}
                </h3>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                   <Ticket className="w-3 h-3" />
                   <span className="truncate max-w-[200px]">{match.event_title}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                  {partnerTyping ? (
                      <span className="text-primary animate-pulse font-bold">digitando...</span>
                  ) : partnerActive ? (
                      <span className="flex items-center gap-1 text-green-500 font-medium normal-case tracking-normal">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
                          Online
                      </span>
                  ) : (
                      <>
                        <Clock className="w-3 h-3 text-primary" />
                        <span>Disponível até 5 dias após o evento</span>
                      </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <MoreVertical className="w-5 h-5 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                        onClick={() => setIsDeleteDialogOpen(true)}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir conversa
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-6">
          <div className="flex flex-col gap-4 min-h-full">
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h4 className="text-sm font-medium">Início da conexão no evento</h4>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                As mensagens são privadas, seguras e ficam disponíveis até 5 dias após o evento.
              </p>
            </div>

            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        isMe 
                          ? 'bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/20' 
                          : 'bg-secondary text-foreground rounded-tl-none'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[10px] opacity-60 ${
                            isMe ? 'text-primary-foreground/80' : 'text-muted-foreground'
                        }`}>
                            {formatTime(msg.created_at)}
                        </span>
                        {isMe && (
                            <span className="opacity-80">
                                {getStatusIcon(msg.status)}
                            </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Icebreakers */}
        {messages.length < 2 && (
          <div className="px-6 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2">
            {ICEBREAKERS.map((text, idx) => (
              <button
                key={idx}
                onClick={() => setInputValue(text)}
                className="text-[11px] bg-white/5 border border-white/10 hover:border-primary/50 transition-colors px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground"
              >
                {text}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <footer className="p-4 bg-background/60 backdrop-blur-md">
          <form 
            onSubmit={handleSendMessage}
            className="flex items-center gap-3 bg-secondary/50 rounded-full pl-5 pr-1 py-1 border border-border/40 focus-within:border-primary/50 transition-all"
          >
            <Input 
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Escreva algo interessante..."
              className="bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-10 text-sm"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!inputValue.trim()}
              className="rounded-full w-10 h-10 bg-primary hover:bg-primary/90 transition-transform active:scale-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </footer>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer match?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso encerrará a conversa e desfará o match para ambos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChat} className="bg-red-600 hover:bg-red-700 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
