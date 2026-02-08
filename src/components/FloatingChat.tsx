import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { chatService, ChatMatch, ChatMessage } from '@/services/chat.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function FloatingChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [matches, setMatches] = useState<ChatMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<ChatMatch | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar matches
  useEffect(() => {
    if (isOpen && user?.id) {
      loadMatches();
      loadUnreadCount();
    }
  }, [isOpen, user?.id]);

  // Carregar mensagens quando seleciona um match
  useEffect(() => {
    if (selectedMatch) {
      loadMessages(selectedMatch.id);
    }
  }, [selectedMatch]);

  // Auto scroll para última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe para novas mensagens em tempo real
  useEffect(() => {
    if (!selectedMatch) return;

    const subscription = chatService.subscribeToMessages(selectedMatch.id, (newMsg) => {
      setMessages(prev => [...prev, newMsg]);
      
      // Se a mensagem não é do usuário atual, marcar como lida
      if (newMsg.sender_id !== user?.id) {
        chatService.markAsRead(selectedMatch.id, user!.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedMatch, user?.id]);

  const loadMatches = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const data = await chatService.getMatches(user.id);
      setMatches(data);
    } catch (error) {
      console.error('Erro ao carregar matches:', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (matchId: string) => {
    try {
      const data = await chatService.getMessages(matchId);
      setMessages(data);
      
      // Marcar mensagens como lidas
      if (user?.id) {
        await chatService.markAsRead(matchId, user.id);
        loadUnreadCount();
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar mensagens');
    }
  };

  const loadUnreadCount = async () => {
    if (!user?.id) return;
    
    try {
      const count = await chatService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Erro ao carregar contagem:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedMatch) return;

    try {
      await chatService.sendMessage(selectedMatch.id, newMessage.trim());
      // Não adicionar manualmente - deixar o realtime adicionar
      setNewMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      {/* Botão Flutuante */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 relative"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </motion.div>

      {/* Painel de Chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-96 h-[600px] bg-background border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-card">
              {selectedMatch ? (
                <>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedMatch(null)}
                      className="h-8 w-8"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedMatch.matched_user?.avatar_url} />
                      <AvatarFallback>{getInitials(selectedMatch.matched_user?.full_name || 'U')}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-sm">{selectedMatch.matched_user?.full_name}</span>
                  </div>
                </>
              ) : (
                <h3 className="font-bold text-lg">Conversas</h3>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            {selectedMatch ? (
              // Tela de Mensagens
              <>
                <ScrollArea className="flex-1 p-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                      <MessageCircle className="w-12 h-12 mb-2 opacity-20" />
                      <p className="text-sm">Nenhuma mensagem ainda</p>
                      <p className="text-xs">Envie uma mensagem para começar!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => {
                        const isOwn = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
                              <div
                                className={`rounded-2xl px-4 py-2 ${
                                  isOwn
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground'
                                }`}
                              >
                                <p className="text-sm break-words">{msg.message}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-1 block">
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input de Mensagem */}
                <div className="p-4 border-t border-border bg-card">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Digite uma mensagem..."
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      size="icon"
                      className="shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              // Lista de Matches
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : matches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                    <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-semibold mb-2">Nenhum match ainda</p>
                    <p className="text-sm">Quando você der match com alguém, poderá conversar aqui!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {matches.map((match) => (
                      <button
                        key={match.id}
                        onClick={() => setSelectedMatch(match)}
                        className="w-full p-4 hover:bg-muted/50 transition-colors flex items-center gap-3 text-left"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={match.matched_user?.avatar_url} />
                          <AvatarFallback>{getInitials(match.matched_user?.full_name || 'U')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{match.matched_user?.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {match.last_message?.message || 'Iniciar conversa'}
                          </p>
                        </div>
                        {match.unread_count > 0 && (
                          <Badge className="bg-primary text-primary-foreground h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                            {match.unread_count}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
