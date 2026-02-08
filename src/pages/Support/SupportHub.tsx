import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  BookOpen, 
  MessageCircle, 
  HelpCircle, 
  User, 
  Ticket 
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SupportHub() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    // Simulação de busca
    setTimeout(() => setIsSearching(false), 1000);
  };

  const supportOptions = [
    {
      title: 'Central de Ajuda',
      description: 'Guias detalhados e artigos explicativos',
      icon: BookOpen,
      path: ROUTE_PATHS.HELP_CENTER,
      color: 'text-blue-500',
    },
    {
      title: 'Perguntas Frequentes',
      description: 'Respostas rápidas para dúvidas comuns',
      icon: HelpCircle,
      path: ROUTE_PATHS.FAQ,
      color: 'text-purple-500',
    },
    {
      title: 'Fale Conosco',
      description: 'Entre em contato com nosso time',
      icon: MessageCircle,
      path: ROUTE_PATHS.CONTACT_US,
      color: 'text-green-500',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-muted/30 py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Como podemos te ajudar?
          </h1>
          <p className="text-xl text-muted-foreground">
            Encontre respostas, guias e suporte para aproveitar ao máximo a PREFEST.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              type="text" 
              placeholder="Busque por dúvidas, artigos ou tópicos..." 
              className="pl-12 h-14 text-lg rounded-full shadow-lg border-primary/20 focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Navigation Cards */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {supportOptions.map((option) => (
              <Link key={option.path} to={option.path} className="group">
                <Card className="h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 ${option.color} group-hover:scale-110 transition-transform`}>
                      <option.icon size={24} />
                    </div>
                    <CardTitle className="text-xl">{option.title}</CardTitle>
                    <CardDescription className="text-base">{option.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Links by Profile */}
      <section className="py-16 px-6 bg-muted/20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-12">Selecione seu perfil</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-card rounded-2xl p-8 border border-border/50 hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User size={20} />
                </div>
                <h3 className="text-xl font-bold">Sou Participante</h3>
              </div>
              <ul className="space-y-3">
                <li>
                  <Link to={ROUTE_PATHS.HELP_CENTER} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                    Onde estão meus ingressos?
                  </Link>
                </li>
                <li>
                  <Link to={ROUTE_PATHS.HELP_CENTER} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                    Como pedir reembolso
                  </Link>
                </li>
                <li>
                  <Link to={ROUTE_PATHS.HELP_CENTER} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                    Alterar dados da conta
                  </Link>
                </li>
              </ul>
            </div>

            <div className="bg-card rounded-2xl p-8 border border-border/50 hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Ticket size={20} />
                </div>
                <h3 className="text-xl font-bold">Sou Organizador</h3>
              </div>
              <ul className="space-y-3">
                <li>
                  <Link to={ROUTE_PATHS.HELP_CENTER} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                    Como criar um evento
                  </Link>
                </li>
                <li>
                  <Link to={ROUTE_PATHS.HELP_CENTER} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                    Taxas e recebimentos
                  </Link>
                </li>
                <li>
                  <Link to={ROUTE_PATHS.HELP_CENTER} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                    Validar ingressos (Check-in)
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
