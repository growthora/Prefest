import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, CheckCheck, Clock, Search, Send, Sparkles, Ticket } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { matchService, Match } from '@/services/match.service';
import { chatService, ChatMessage } from '@/services/chat.service';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ChatMobileLayoutProps {
  children: React.ReactNode;
}

function ChatMobileLayout({ children }: ChatMobileLayoutProps) {
  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {children}
    </div>
  );
}

export default function ChatMobile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { matchId } = useParams<{ matchId: string }>();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <ChatMobileLayout>
      {matchId ? <ChatConversationMobile matchId={matchId} /> : <ChatListMobile />}
    </ChatMobileLayout>
  );
}

function ChatListMobile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    const loadMatches = async () => {
      try {
        setLoading(true);
        const data = await matchService.getUserMatches();
        setMatches(data);
      } catch (error) {
        console.error('Error loading matches:', error);
        toast.error('Erro ao carregar conversas');
      } finally {
        setLoading(false);
      }
    };

    loadMatches();

    const subscription = supabase
      .channel('public:matches_list_mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadMatches())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadMatches())
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const filteredMatches = matches.filter(m => {
    const term = searchTerm.toLowerCase();
    return (
      m.partner_name.toLowerCase().includes(term) ||
      m.event_title.toLowerCase().includes(term)
    );
  });

  return (
    <>
      <header className="px-4 pt-3 pb-2 border-b border-border/40 bg-background/95 backdrop-blur flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col flex-1">
          <h1 className="text-base font-semibold leading-tight">Meus Matchs</h1>
          <p className="text-[11px] text-muted-foreground">Converse em tela cheia, estilo WhatsApp.</p>
        </div>
      </header>

      <div className="px-4 py-2 border-b border-border/40 bg-background">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 rounded-full bg-muted/60 border-none text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Carregando conversas...
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-sm font-semibold mb-1">Nenhuma conversa ainda</h2>
            <p className="text-xs text-muted-foreground">
              Dê like na galera dos eventos para desbloquear suas primeiras conversas.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredMatches
              .slice()
              .sort((a, b) => {
                const aTime = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
                const bTime = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
                return bTime - aTime;
              })
              .map((m) => (
                <button
                  key={m.match_id}
                  onClick={() => navigate(`/m/chat/${m.match_id}`)}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-background hover:bg-muted/60 active:bg-muted/80 transition-colors text-left"
                >
                  <div className="relative">
                    <Avatar className="w-11 h-11 border border-primary/20">
                      <AvatarImage src={m.partner_avatar} className="object-cover" />
                      <AvatarFallback>{m.partner_name[0]}</AvatarFallback>
                    </Avatar>
                    {m.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-sm truncate">{m.partner_name}</span>
                      {m.last_message_time && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {new Date(m.last_message_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[11px] truncate ${m.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {m.last_message || 'Inicie a conversa...'}
                      </p>
                      {m.unread_count > 0 && (
                        <Badge className="h-4 min-w-4 px-1 rounded-full flex items-center justify-center text-[9px]">
                          {m.unread_count}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                      <Ticket className="w-3 h-3" />
                      <span className="truncate">{m.event_title}</span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

interface ChatConversationMobileProps {
  matchId: string;
}

function ChatConversationMobile({ matchId }: ChatConversationMobileProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerActive, setPartnerActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastTypingSentRef = useRef<number>(0);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        const currentMatch = await matchService.getMatchDetails(matchId);

        if (!currentMatch || currentMatch.status !== 'active') {
          toast.error('Match não encontrado ou inativo');
          navigate('/m/chat', { replace: true });
          return;
        }

        setMatch(currentMatch);

        const cid = await chatService.getOrCreateChat(matchId);
        setChatId(cid);

        const msgs = await chatService.getMessages(cid);
        setMessages(msgs);

        chatService.markMessagesAsRead(cid);
      } catch (error: any) {
        if (error?.status === 403) {
          toast.error('Você não tem acesso a esta conversa');
        } else {
          toast.error('Erro ao carregar conversa');
        }
        navigate('/m/chat', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [matchId, user, navigate]);

  useEffect(() => {
    if (!chatId) return;

    chatService.updatePresence(chatId);

    const channel = chatService.subscribeToChat(
      chatId,
      (newMsg) => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMsg.id);
          if (exists) {
            return prev.map(m => (m.id === newMsg.id ? { ...m, ...newMsg } : m));
          }
          setPartnerTyping(false);
          return [...prev, newMsg];
        });

        if (newMsg.sender_id !== user?.id && (!newMsg.status || newMsg.status === 'sent')) {
          chatService.markMessagesAsRead(chatId);
        }
      },
      (payload) => {
        if (payload.userId !== user?.id) {
          setPartnerTyping(payload.isTyping);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (payload.isTyping) {
            typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
          }
        }
      }
    );

    channelRef.current = channel;

    if (match?.partner_id) {
      chatService.getPresence(match.partner_id).then(activeChatId => {
        setPartnerActive(activeChatId === chatId);
      });

      const presenceChannel = chatService.subscribeToPartnerPresence(match.partner_id, (activeChatId) => {
        setPartnerActive(activeChatId === chatId);
      });
      presenceChannelRef.current = presenceChannel;
    }

    const matchSub = supabase
      .channel(`match_status_mobile:${matchId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`,
      }, (payload) => {
        if (payload.new.status === 'inactive') {
          toast.info('O match foi desfeito.');
          navigate('/m/chat', { replace: true });
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      matchSub.unsubscribe();
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
      channelRef.current = null;
      presenceChannelRef.current = null;
      chatService.updatePresence(null);
    };
  }, [chatId, user, match, matchId, navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
    setInputValue('');

    if (channelRef.current) {
      chatService.sendTyping(channelRef.current, false);
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      chat_id: chatId,
      sender_id: user?.id || '',
      content,
      created_at: new Date().toISOString(),
      status: 'sent',
      sender: {
        id: user?.id || '',
        full_name: user?.user_metadata?.full_name || 'Eu',
        avatar_url: user?.user_metadata?.avatar_url || '',
      },
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const sentMsg = await chatService.sendMessage(chatId, content);
      if (sentMsg) {
        setMessages(prev =>
          prev.map(msg => (msg.id === tempId ? (sentMsg as unknown as ChatMessage) : msg))
        );
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setInputValue(content);
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

  if (loading || !match) {
    return (
      <>
        <header className="px-4 pt-3 pb-2 border-b border-border/40 bg-background/95 backdrop-blur flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate('/m/chat', { replace: true })}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col flex-1">
            <div className="h-4 w-32 bg-muted rounded-md mb-1" />
            <div className="h-3 w-40 bg-muted rounded-md" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Carregando conversa...
        </div>
      </>
    );
  }

  return (
    <>
      <header className="px-4 pt-3 pb-2 border-b border-border/40 bg-background/95 backdrop-blur flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => navigate('/m/chat', { replace: true })}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="w-10 h-10 border border-primary/20">
            <AvatarImage src={match.partner_avatar} className="object-cover" />
            <AvatarFallback>{match.partner_name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">{match.partner_name}</span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
              <Ticket className="w-3 h-3" />
              <span className="truncate max-w-[180px]">{match.event_title}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
              {partnerTyping ? (
                <span className="text-primary animate-pulse font-semibold">digitando...</span>
              ) : partnerActive ? (
                <span className="flex items-center gap-1 text-green-500 font-medium">
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
      </header>

      <div className="flex-1 flex flex-col bg-background">
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center py-4 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-xs font-medium">Início da conexão no evento</h4>
              <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                As mensagens são privadas, seguras e ficam disponíveis até 5 dias após o evento.
              </p>
            </div>

            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] ${
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-muted text-foreground rounded-tl-none'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span
                          className={`text-[10px] opacity-70 ${
                            isMe ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          }`}
                        >
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

        <div className="px-3 pb-3 pt-2 border-t border-border/40 bg-background/95 backdrop-blur">
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 bg-muted/80 rounded-full pl-4 pr-1 py-1 border border-border/40 focus-within:border-primary/60 transition-all"
          >
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Escreva uma mensagem..."
              className="bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-9 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim()}
              className="rounded-full w-9 h-9 bg-primary hover:bg-primary/90 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
