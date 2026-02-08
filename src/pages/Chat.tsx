import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  ArrowLeft, 
  Info, 
  Sparkles, 
  Clock, 
  ShieldCheck,
  Music
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useMatch } from '@/hooks/useMatch';
import { ROUTE_PATHS, Message } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ICEBREAKERS = [
  "Qual música você está mais ansioso para ouvir hoje? 🎶",
  "Primeira vez nesse evento ou já é veterano?",
  "O que você achou do line-up deste ano? 🔥",
  "Qual sua 'vibe' preferida para eventos assim?"
];

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { getMatchById, getPartnerProfile, sendMessage } = useMatch();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const match = matchId ? getMatchById(matchId) : null;
  const partner = match ? getPartnerProfile(match) : null;

  // Simulação de histórico de mensagens locais para a demo
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (match?.lastMessage && messages.length === 0) {
      setMessages([match.lastMessage]);
    }
  }, [match, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!match || !partner) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <h2 className="text-2xl font-bold mb-4">Match não encontrado</h2>
          <p className="text-muted-foreground mb-8">Esta conexão pode ter expirado ou o link é inválido.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !matchId) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);
    sendMessage(matchId, inputValue);
    setInputValue('');
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDisplayName = () => {
    if (partner.showInitialsOnly) {
      return partner.name.split(' ').map(n => n[0]).join('.');
    }
    return partner.name;
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
                <AvatarImage src={partner.photo} className="object-cover grayscale hover:grayscale-0 transition-all" />
                <AvatarFallback className="bg-secondary text-secondary-foreground font-mono">
                  {partner.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-sm leading-tight flex items-center gap-2">
                  {getDisplayName()}
                  {partner.showInitialsOnly && (
                    <span title="Anonimato Ativo" className="inline-flex">
                      <ShieldCheck className="w-3 h-3 text-primary/60" />
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest">
                  <Clock className="w-3 h-3 text-primary" />
                  <span>Expira em 22h</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] hidden sm:flex">
              {partner.compatibilityScore}% Compatível
            </Badge>
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
                As mensagens expiram automaticamente após o fim do evento. Divirtam-se com segurança.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {partner.vibes.slice(0, 2).map(vibe => (
                  <Badge key={vibe} variant="secondary" className="text-[10px] bg-white/5 border-none">
                    <Music className="w-3 h-3 mr-1" /> {vibe}
                  </Badge>
                ))}
              </div>
            </div>

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.senderId === 'me' 
                        ? 'bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/20' 
                        : 'bg-secondary text-foreground rounded-tl-none'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <span className={`text-[10px] mt-1 block opacity-60 ${
                      msg.senderId === 'me' ? 'text-right' : 'text-left'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </motion.div>
              ))}
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
              onChange={(e) => setInputValue(e.target.value)}
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
