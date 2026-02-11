import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, ChevronLeft, MoreVertical, Search, Check, CheckCheck, Trash2, Ticket } from 'lucide-react';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function FloatingChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<Match | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerActive, setPartnerActive] = useState(false); // New state for presence
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null); // New ref for presence channel
  const lastTypingSentRef = useRef<number>(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Keep ref in sync
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Load matches
  useEffect(() => {
    if (user && isOpen && !activeChat) {
      loadMatches();
    }
  }, [user, isOpen, activeChat]);

  // Realtime subscription for matches list
  useEffect(() => {
    if (!user) return;

    // Subscribe to new matches or messages to update the list order/badges
    const subscription = supabase
      .channel('public:matches_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadMatches();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
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
      
      // Update Presence: I am now in this chat
      chatService.updatePresence(activeChat.chat_id);
      
      // Mark as opened
      if (!activeChat.chat_opened) {
        matchService.markChatOpened(activeChat.match_id);
      }

      // Mark messages as read immediately on open (for existing messages)
      chatService.markMessagesAsRead(activeChat.chat_id);
      
      // Optimistic: Clear unread count locally
      setMatches(prev => prev.map(m => 
        m.match_id === activeChat.match_id 
          ? { ...m, unread_count: 0 } 
          : m
      ));

      // Realtime messages & typing
      const channel = chatService.subscribeToChat(
          activeChat.chat_id, 
          (payload, eventType) => {
            // Handle INSERT and UPDATE
            if (eventType === 'INSERT') {
                const newMsg = payload;
                setMessages(prev => {
                    // Deduplicate logic
                    const exists = prev.some(m => m.id === newMsg.id);
                    if (exists) return prev;
                    
                    setPartnerTyping(false); // Clear typing

                    // If message is from partner, we need to add sender info locally
                    // because payload doesn't have relations
                    let msgWithSender = { ...newMsg };
                    if (newMsg.sender_id === activeChat.partner_id) {
                         msgWithSender.sender = {
                             id: activeChat.partner_id,
                             full_name: activeChat.partner_name,
                             avatar_url: activeChat.partner_avatar
                         };
                    } else if (newMsg.sender_id === user?.id) {
                         msgWithSender.sender = {
                             id: user.id,
                             full_name: user.user_metadata?.full_name || 'Eu',
                             avatar_url: user.user_metadata?.avatar_url || ''
                         };
                    }

                    return [...prev, msgWithSender];
                });

                // Scroll to bottom
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 100);
            } else if (eventType === 'UPDATE') {
                const updatedMsg = payload;
                setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
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
      
      // Subscribe to Partner Presence
      if (activeChat.partner_id) {
          // Initial fetch
          chatService.getPresence(activeChat.partner_id).then(activeChatId => {
               setPartnerActive(activeChatId === activeChat.chat_id);
          });

          const presenceChannel = chatService.subscribeToPartnerPresence(activeChat.partner_id, (activeChatId) => {
              // Strictly check if they are in THIS chat
              setPartnerActive(activeChatId === activeChat.chat_id);
          });
          presenceChannelRef.current = presenceChannel;
      }

      return () => {
        channel.unsubscribe();
        if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
        channelRef.current = null;
        presenceChannelRef.current = null;
        // Update Presence: I left the chat
        chatService.updatePresence(null);
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
      
      // Check if active chat still exists (handled unmatch)
      const currentActive = activeChatRef.current;
      if (currentActive) {
          const stillExists = data.find(m => m.match_id === currentActive.match_id);
          if (!stillExists) {
              setActiveChat(null);
              // Only show toast if it wasn't me who deleted (we can check unmatched_by if available, but simplest is just show info)
              // But if I just deleted it via handleDeleteChat, I already showed success toast.
              // We can rely on handleDeleteChat to close it, but if it comes from Realtime (other user), we need this.
          } else {
              // Enforce unread_count 0 for active chat
              setMatches(data.map(m => 
                  m.match_id === currentActive.match_id ? { ...m, unread_count: 0 } : m
              ));
              return;
          }
      }
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

  const getStatusIcon = (status?: 'sent' | 'delivered' | 'seen') => {
    if (status === 'seen') return <CheckCheck className="w-3 h-3 text-blue-500" />;
    if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    return <Check className="w-3 h-3 text-muted-foreground" />;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      
      if (activeChat && channelRef.current) {
          const now = Date.now();
          if (now - lastTypingSentRef.current > 2000) {
              chatService.sendTyping(channelRef.current, true);
              lastTypingSentRef.current = now;
          }
      }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !activeChat || !user) return;

    const content = inputValue;
    setInputValue('');
    
    // Stop typing indicator
    if (channelRef.current) {
        chatService.sendTyping(channelRef.current, false);
    }

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
        id: tempId,
        chat_id: activeChat.chat_id,
        sender_id: user.id,
        content: content,
        created_at: new Date().toISOString(),
        status: 'sent',
        sender: {
            id: user.id,
            full_name: 'Eu', // Placeholder
            avatar_url: '' 
        }
    };

    setMessages(prev => [...prev, optimisticMsg]);
    
    // Force scroll
    setTimeout(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, 10);

    try {
      // NOTE: We assume sendMessage returns void now, but if it returns data we can use it.
      // Ideally chatService.sendMessage should return the message data.
      // For now, let's rely on realtime for the "real" message or a fetch if needed, 
      // BUT if the service returns data, we update the optimistic one.
      // Checked service: it returns 'data' (the message object).
      const sentMsg = await chatService.sendMessage(activeChat.chat_id, content);
      
      // Replace optimistic message with real one
      // If sentMsg is void (due to type change assumption), we keep optimistic until realtime arrives?
      // Actually, my previous thought on void was cautious. The code I read showed it returns data.
      // I'll assume it returns 'any' or 'ChatMessage' for now to avoid TS error if I cast it.
      if (sentMsg) {
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? (sentMsg as unknown as ChatMessage) : msg
          ));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Erro ao enviar mensagem');
      // Remove optimistic message and restore input
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setInputValue(content);
    }
  };

  const handleDeleteChat = async () => {
    if (!activeChat) return;

    try {
      await chatService.unmatchUser(activeChat.match_id);
      
      // Optimistic update
      setMatches(prev => prev.filter(m => m.match_id !== activeChat.match_id));
      setActiveChat(null);
      setIsOpen(false); // Close chat
      toast.success('Match desfeito e conversa encerrada');
    } catch (error) {
      toast.error('Erro ao desfazer match');
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const handleMatchClick = async (match: Match) => {
    try {
      if (location.pathname.startsWith('/chat')) {
         navigate(`/chat/${match.match_id}`);
         setIsOpen(false);
      } else {
         setActiveChat(match);
      }
    } catch (error) {
      console.error('Error opening chat:', error);
      toast.error('Erro ao abrir conversa');
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

  // Se estivermos na página de chat dedicada, não mostrar o botão flutuante para evitar duplicidade
  if (location.pathname.startsWith('/chat')) return null;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hidden md:flex items-center justify-center hover:bg-primary/90 transition-colors"
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
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setActiveChat(null)}
                    className="h-8 w-8 text-primary-foreground hover:bg-white/20 rounded-full -ml-2 shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="h-9 w-9 border-2 border-white/20 shrink-0">
                    <AvatarImage src={activeChat.partner_avatar} />
                    <AvatarFallback>{activeChat.partner_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm leading-none truncate">{activeChat.partner_name}</span>
                    <div className="flex items-center gap-1 text-[10px] text-primary-foreground/80 mt-1">
                        <Ticket className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[150px]">{activeChat.event_title}</span>
                    </div>
                    <span className="text-[10px] opacity-80 mt-0.5">
                        {partnerTyping ? (
                            <span className="text-white animate-pulse font-medium">digitando...</span>
                        ) : partnerActive ? (
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                                Online
                            </span>
                        ) : (
                            'Offline'
                        )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  <span className="font-semibold">Mensagens</span>
                </div>
              )}
              
              {activeChat && (
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-white/20 rounded-full shrink-0">
                            <MoreVertical className="w-4 h-4" />
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
              )}
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
                          </div>
                        );
                      })
                    )}
                    <div ref={scrollRef} />
                  </div>

                  {/* Input Area */}
                  <form onSubmit={handleSendMessage} className="p-3 bg-background border-t flex gap-2">
                    <Input
                      value={inputValue}
                      onChange={handleInputChange}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 rounded-full bg-secondary/20 border-0 focus-visible:ring-1"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={!inputValue.trim()}
                      className="rounded-full w-10 h-10 shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </>
              ) : (
                /* Matches List */
                <>
                  <div className="p-3 bg-background border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar conversas..." 
                        className="pl-9 h-9 bg-secondary/20 border-0"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    {matches.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        Nenhuma conversa ainda.
                        <br />
                        Dê match em eventos para começar!
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {filteredMatches.map((match) => (
                          <button
                            key={match.match_id}
                            onClick={() => handleMatchClick(match)}
                            className="w-full p-4 flex items-center gap-3 hover:bg-secondary/10 transition-colors text-left"
                          >
                            <div className="relative">
                                <Avatar className="h-12 w-12 border border-border">
                                    <AvatarImage src={match.partner_avatar} />
                                    <AvatarFallback>{match.partner_name[0]}</AvatarFallback>
                                </Avatar>
                                {match.unread_count > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center border-2 border-background">
                                        {match.unread_count}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline mb-1">
                                <span className="font-semibold text-sm truncate">{match.partner_name}</span>
                                {match.last_message_at && (
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                    {formatTime(match.last_message_at)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <p className={`text-xs truncate max-w-[180px] ${match.unread_count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                    {match.last_message || 'Inicie a conversa'}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </>
  );
}
