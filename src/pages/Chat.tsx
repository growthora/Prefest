import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  ArrowLeft, 
  Info, 
  Sparkles, 
  Clock, 
  ShieldCheck,
  Music,
  Check,
  CheckCheck
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { chatService, ChatMessage } from '@/services/chat.service';
import { matchService, Match } from '@/services/match.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const ICEBREAKERS = [
  "Qual música você está mais ansioso para ouvir hoje? 🎶",
  "Primeira vez nesse evento ou já é veterano?",
  "O que você achou do line-up deste ano? 🔥",
  "Qual sua 'vibe' preferida para eventos assim?"
];

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

  // Carregar dados do match e chat
  useEffect(() => {
    const loadData = async () => {
      if (!matchId || !user) return;
      
      try {
        setLoading(true);
        
        // 1. Buscar detalhes do match (usando listMatches por enquanto)
        const matches = await matchService.getUserMatches();
        const currentMatch = matches.find(m => m.match_id === matchId);
        
        if (!currentMatch) {
          toast.error('Match não encontrado');
          navigate('/matches');
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

    return () => {
      channel.unsubscribe();
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
      channelRef.current = null;
      presenceChannelRef.current = null;
      
      // Clear presence on unmount/change
      chatService.updatePresence(null);
    };
  }, [chatId, user, match]);

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
      const sentMsg = await chatService.sendMessage(chatId, content);
      
      // Replace optimistic message
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? sentMsg : msg
      ));
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
      // Remove optimistic message and restore input
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
              onClick={() => navigate('/matches')}
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
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest">
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
                        <span>Expira em breve</span>
                      </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Info className="w-5 h-5 text-muted-foreground" />
            </Button>
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
                As mensagens são privadas e seguras.
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
    </Layout>
  );
}
