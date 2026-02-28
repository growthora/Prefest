import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Search, MessageSquare, Clock, CheckCircle2, AlertCircle, User, Send, Filter, MoreVertical, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Mock support tickets
const MOCK_TICKETS = [
  { id: 'TKT-1023', user: 'Carlos Silva', subject: 'Problema no pagamento', status: 'open', priority: 'high', date: '2024-02-28T10:30:00', messages: 3 },
  { id: 'TKT-1022', user: 'Mariana Costa', subject: 'Dúvida sobre ingressos', status: 'in_progress', priority: 'medium', date: '2024-02-28T09:15:00', messages: 5 },
  { id: 'TKT-1021', user: 'Roberto Santos', subject: 'Erro ao criar evento', status: 'closed', priority: 'low', date: '2024-02-27T16:45:00', messages: 8 },
  { id: 'TKT-1020', user: 'Ana Paula', subject: 'Solicitação de reembolso', status: 'open', priority: 'high', date: '2024-02-27T14:20:00', messages: 2 },
  { id: 'TKT-1019', user: 'Lucas Oliveira', subject: 'Alteração de dados cadastrais', status: 'in_progress', priority: 'low', date: '2024-02-26T11:10:00', messages: 4 },
];

export default function AdminSupport() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');

  const filteredTickets = MOCK_TICKETS.filter(ticket => {
    const matchesSearch = ticket.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = activeStatus === 'all' || ticket.status === activeStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setReplyText('');
      toast.success('Resposta enviada com sucesso!');
    }, 1000);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">Aberto</Badge>;
      case 'in_progress': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Em Atendimento</Badge>;
      case 'closed': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Fechado</Badge>;
      default: return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="h-5 text-[10px] uppercase tracking-wider">Alta</Badge>;
      case 'medium': return <Badge variant="secondary" className="h-5 text-[10px] uppercase tracking-wider">Média</Badge>;
      case 'low': return <Badge variant="outline" className="h-5 text-[10px] uppercase tracking-wider">Baixa</Badge>;
      default: return null;
    }
  };

  return (
    <motion.div 
      className="space-y-8 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            Suporte e Atendimento
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie tickets de suporte e dúvidas dos usuários
          </p>
        </div>
        <div className="flex gap-2">
          <Card className="flex items-center gap-4 px-4 py-2">
            <div className="flex flex-col items-center border-r pr-4">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Abertos</span>
              <span className="text-xl font-bold text-red-500">12</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Média Resposta</span>
              <span className="text-xl font-bold text-primary">15m</span>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
          <Card className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tickets..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Tabs defaultValue="all" value={activeStatus} onValueChange={setActiveStatus}>
              <TabsList className="grid w-full grid-cols-4 h-9">
                <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
                <TabsTrigger value="open" className="text-xs">Abertos</TabsTrigger>
                <TabsTrigger value="in_progress" className="text-xs">Andam.</TabsTrigger>
                <TabsTrigger value="closed" className="text-xs">Fechados</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {filteredTickets.map((ticket) => (
                  <motion.div
                    key={ticket.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all hover:shadow-md ${
                      selectedTicket?.id === ticket.id 
                        ? 'bg-primary/5 border-primary ring-1 ring-primary/20 shadow-primary/5' 
                        : 'bg-card hover:bg-accent/30 border-transparent hover:border-accent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono font-semibold text-muted-foreground">{ticket.id}</span>
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1 mb-1">{ticket.subject}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">{ticket.user}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      {getStatusBadge(ticket.status)}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(ticket.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredTickets.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum ticket encontrado</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          {selectedTicket ? (
            <Card className="h-full flex flex-col border-primary/10">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{selectedTicket.user}</CardTitle>
                        <Badge variant="outline" className="text-[10px] py-0">{selectedTicket.id}</Badge>
                      </div>
                      <CardDescription>{selectedTicket.subject}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[500px] custom-scrollbar">
                {/* Chat simulation */}
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="bg-muted p-4 rounded-2xl rounded-tl-none space-y-2">
                      <p className="text-sm">Olá, estou tendo problemas para finalizar o pagamento do meu ingresso para o Festival de Verão. O sistema diz que houve um erro inesperado.</p>
                      <span className="text-[10px] text-muted-foreground block">10:30 AM</span>
                    </div>
                  </div>

                  <div className="flex gap-3 max-w-[80%] self-end flex-row-reverse">
                    <div className="h-8 w-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="bg-primary text-primary-foreground p-4 rounded-2xl rounded-tr-none space-y-2">
                      <p className="text-sm">Olá Carlos! Verifiquei no sistema e parece que houve uma pequena instabilidade com o gateway de pagamento. Você poderia tentar novamente? Já normalizamos o serviço.</p>
                      <span className="text-[10px] opacity-70 block">10:35 AM</span>
                    </div>
                  </div>

                  <div className="flex gap-3 max-w-[80%]">
                    <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="bg-muted p-4 rounded-2xl rounded-tl-none space-y-2">
                      <p className="text-sm">Tentei agora e continuou dando o mesmo erro. Segue o print da tela com o código de erro: ERR_PAY_99.</p>
                      <div className="p-2 border rounded bg-background/50 flex items-center gap-2">
                        <Paperclip className="h-3 w-3" />
                        <span className="text-xs">screenshot_error.png</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground block">10:42 AM</span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t p-4 bg-muted/10">
                <form onSubmit={handleSendReply} className="flex gap-2 w-full">
                  <div className="flex-1 relative">
                    <Textarea 
                      placeholder="Digite sua resposta..." 
                      className="min-h-[80px] pr-10 resize-none py-3"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 bottom-2 text-muted-foreground hover:text-primary"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button type="submit" disabled={isLoading || !replyText.trim()} className="h-auto px-6">
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </form>
              </CardFooter>
            </Card>
          ) : (
            <Card className="h-full flex flex-col items-center justify-center p-12 text-center border-dashed">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Selecione um Ticket</h2>
              <p className="text-muted-foreground max-w-sm">
                Escolha um atendimento na lista lateral para visualizar o histórico de mensagens e responder ao usuário.
              </p>
            </Card>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
