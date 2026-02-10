import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, ChevronLeft, MoreVertical, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { matchService, Match } from '@/services/match.service';
import { chatService, ChatMessage } from '@/services/chat.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function FloatingChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load matches
  useEffect(() => {
    if (user && isOpen && !activeChat) {
      loadMatches();
    }
  }, [user, isOpen, activeChat]);

  // Listen for global open-chat event
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent<{ match: Match }>) => {
      setIsOpen(true);
      setActiveChat(event.detail.match);
    };

    window.addEventListener('open-chat', handleOpenChat as EventListener);
    
    return () => {
      window.removeEventListener('open-chat', handleOpenChat as EventListener);
    };
  }, []);

  // Realtime subscription for matches list
  useEffect(() => {
    if (!user) return;

    // Subscribe to new matches or messages to update the list order/badges
    const subscription = supabase
      .channel('public:matches_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadMatches();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadMatches();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Load messages when chat is active
  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.chat_id);
      
      // Mark as opened
      if (!activeChat.chat_opened) {
        matchService.markChatOpened(activeChat.match_id);
      }

      // Realtime messages
      const subscription = chatService.subscribeToMessages(activeChat.chat_id, (newMsg) => {
        setMessages(prev => [...prev, newMsg]);
        // Scroll to bottom
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [activeChat]);

  // Scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadMatches = async () => {
    try {
      const data = await matchService.getUserMatches();
      setMatches(data);
    } catch (error) {
      console.error('Error loading matches', error);
    }
  };

  const loadMessages = async (chatId: string) => {
    setLoading(true);
    try {
      const msgs = await chatService.getMessages(chatId);
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !activeChat) return;

    const content = inputValue;
    setInputValue('');

    try {
      await chatService.sendMessage(activeChat.chat_id, content);
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
      setInputValue(content);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'HH:mm');
    }
    return format(date, 'dd/MM');
  };

  const filteredMatches = matches.filter(m => 
    m.partner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnread = matches.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-background">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] h-[600px] max-h-[80vh] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between shadow-md z-10">
              {activeChat ? (
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setActiveChat(null)}
                    className="h-8 w-8 text-primary-foreground hover:bg-white/20 rounded-full -ml-2"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="h-9 w-9 border-2 border-white/20">
                    <AvatarImage src={activeChat.partner_avatar} />
                    <AvatarFallback>{activeChat.partner_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm leading-none">{activeChat.partner_name}</span>
                    <span className="text-[10px] opacity-80 mt-1">Online</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  <span className="font-semibold">Mensagens</span>
                </div>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-white/20 rounded-full">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-secondary/10 flex flex-col relative">
              {activeChat ? (
                /* Active Chat View */
                <>
                  <div 
                    className="flex-1 overflow-y-auto p-4 space-y-4"
                    style={{ 
                        backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                        backgroundBlendMode: 'soft-light',
                        backgroundColor: 'rgba(var(--background), 0.9)'
                    }}
                  >
                    {loading ? (
                      <div className="flex justify-center pt-8">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm pt-8">
                        Comece a conversa com {activeChat.partner_name}! 👋
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.sender_id === user.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                isMe
                                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                                  : 'bg-white dark:bg-zinc-800 text-foreground rounded-tl-none'
                              }`}
                            >
                              <p>{msg.content}</p>
                              <span className={`text-[10px] mt-1 block opacity-60 ${
                                isMe ? 'text-primary-foreground/80 text-right' : 'text-muted-foreground text-left'
                              }`}>
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={scrollRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-3 bg-background border-t border-border">
                    <form 
                      onSubmit={handleSendMessage}
                      className="flex items-center gap-2 bg-secondary/50 rounded-full px-4 py-2 border border-border/50 focus-within:border-primary/50 transition-colors"
                    >
                      <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Digite uma mensagem..."
                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                      />
                      <button 
                        type="submit" 
                        disabled={!inputValue.trim()}
                        className="text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                /* Matches List View */
                <div className="h-full flex flex-col">
                    <div className="p-3 bg-background border-b border-border/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar conversas..." 
                                className="pl-9 h-9 bg-secondary/50 border-transparent focus:bg-background"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                  <ScrollArea className="flex-1">
                    {filteredMatches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                            <span className="text-4xl mb-2">😴</span>
                            <p className="text-sm font-medium">Nenhuma conversa ainda</p>
                            <p className="text-xs text-muted-foreground mt-1">Dê match em eventos para começar a conversar!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                        {filteredMatches.map((match) => (
                            <button
                            key={match.match_id}
                            onClick={() => setActiveChat(match)}
                            className="w-full p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left"
                            >
                            <div className="relative">
                                <Avatar className="h-12 w-12 border border-border">
                                <AvatarImage src={match.partner_avatar} />
                                <AvatarFallback>{match.partner_name[0]}</AvatarFallback>
                                </Avatar>
                                {(match.unread_count || 0) > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center border-2 border-background">
                                        {match.unread_count}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                <span className="font-medium text-sm truncate">{match.partner_name}</span>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                    {formatTime(match.last_message_time || match.created_at)}
                                </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                {match.last_message || 'Nova conexão! Diga oi 👋'}
                                </p>
                            </div>
                            </button>
                        ))}
                        </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
