import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft,
  CreditCard, 
  Ticket, 
  User, 
  Calendar, 
  BarChart 
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib';
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function HelpCenter() {
  const categories = [
    {
      id: 'tickets',
      title: 'Compras de Ingressos',
      icon: Ticket,
      articles: [
        'Como comprar ingressos',
        'Onde encontro meus ingressos?',
        'Transferência de titularidade',
        'Política de cancelamento'
      ]
    },
    {
      id: 'payments',
      title: 'Pagamentos e Reembolsos',
      icon: CreditCard,
      articles: [
        'Formas de pagamento aceitas',
        'Status do pagamento',
        'Solicitar reembolso',
        'Estorno no cartão de crédito'
      ]
    },
    {
      id: 'account',
      title: 'Conta e Cadastro',
      icon: User,
      articles: [
        'Como criar uma conta',
        'Recuperar senha',
        'Alterar e-mail',
        'Excluir conta'
      ]
    },
    {
      id: 'events',
      title: 'Criação de Eventos',
      icon: Calendar,
      articles: [
        'Como criar meu primeiro evento',
        'Configurar tipos de ingressos',
        'Personalizar página do evento',
        'Adicionar co-produtores'
      ]
    },
    {
      id: 'sales',
      title: 'Vendas e Relatórios',
      icon: BarChart,
      articles: [
        'Acompanhar vendas em tempo real',
        'Exportar lista de participantes',
        'Check-in no dia do evento',
        'Recebimento das vendas'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="container mx-auto max-w-5xl space-y-8">
        {/* Header with Breadcrumb */}
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
                <BreadcrumbPage>Central de Ajuda</BreadcrumbPage>
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
            <h1 className="text-3xl font-bold tracking-tight">Central de Ajuda</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Navegue pelos tópicos abaixo para encontrar guias detalhados sobre como usar a plataforma.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow border-border/60">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                  <category.icon size={20} />
                </div>
                <CardTitle className="text-lg">{category.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {category.articles.map((article, index) => (
                    <li key={index}>
                      <button 
                        type="button"
                        className="w-full text-left text-sm text-muted-foreground hover:text-primary hover:underline transition-all py-1"
                      >
                        {article}
                      </button>
                    </li>
                  ))}
                  <li className="pt-2">
                    <Link
                      to={ROUTE_PATHS.FAQ}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Ver todos os artigos &rarr;
                    </Link>
                  </li>
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HelpCenter;
