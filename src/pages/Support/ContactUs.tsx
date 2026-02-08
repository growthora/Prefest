import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { ROUTE_PATHS } from '@/lib';
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ContactUs() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    userType: '',
    category: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    // Simulação de envio
    setTimeout(() => {
      // 90% de chance de sucesso para teste
      if (Math.random() > 0.1) {
        setStatus('success');
        setFormData({ name: '', email: '', userType: '', category: '', message: '' });
      } else {
        setStatus('error');
      }
    }, 1500);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="container mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={ROUTE_PATHS.HOME}>Início</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={ROUTE_PATHS.SUPPORT}>Suporte</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Fale Conosco</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-4">
            <Link 
              to={ROUTE_PATHS.SUPPORT} 
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Fale Conosco</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Não encontrou o que precisava na nossa Central de Ajuda? Preencha o formulário abaixo e nossa equipe entrará em contato.
          </p>
        </div>

        {/* Feedback Messages */}
        {status === 'success' && (
          <Alert className="border-green-500/50 bg-green-500/10 text-green-500">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Mensagem enviada com sucesso!</AlertTitle>
            <AlertDescription>
              Recebemos sua solicitação e entraremos em contato pelo e-mail informado em breve.
            </AlertDescription>
          </Alert>
        )}

        {status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao enviar</AlertTitle>
            <AlertDescription>
              Ocorreu um problema ao enviar sua mensagem. Por favor, tente novamente mais tarde.
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-2xl border border-border/50 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input 
                id="name" 
                placeholder="Seu nome" 
                required 
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com" 
                required 
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="userType">Você é...</Label>
              <Select 
                value={formData.userType} 
                onValueChange={(value) => handleChange('userType', value)}
                required
              >
                <SelectTrigger id="userType">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant">Participante</SelectItem>
                  <SelectItem value="organizer">Organizador</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Assunto</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => handleChange('category', value)}
                required
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tickets">Ingressos / Compras</SelectItem>
                  <SelectItem value="financial">Pagamentos / Reembolsos</SelectItem>
                  <SelectItem value="account">Acesso à conta</SelectItem>
                  <SelectItem value="event_creation">Criação de eventos</SelectItem>
                  <SelectItem value="bug">Relatar um erro</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea 
              id="message" 
              placeholder="Descreva seu problema ou dúvida com detalhes..." 
              className="min-h-[150px]"
              required
              value={formData.message}
              onChange={(e) => handleChange('message', e.target.value)}
            />
          </div>

          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full md:w-auto" 
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <>Enviando...</>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar mensagem
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
