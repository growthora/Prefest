import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
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
import { Button } from '@/components/ui/button';

export function FAQ() {
  const [searchTerm, setSearchTerm] = useState('');

  const faqCategories = [
    {
      title: 'Compras e Ingressos',
      items: [
        {
          question: 'Como faço para comprar um ingresso?',
          answer: 'Para comprar um ingresso, navegue até a página do evento desejado, clique no botão "Comprar Ingresso", selecione o tipo e quantidade, e siga as instruções de pagamento.'
        },
        {
          question: 'Onde encontro meus ingressos após a compra?',
          answer: 'Seus ingressos ficam disponíveis na seção "Meus Eventos" no menu principal e também são enviados para o e-mail cadastrado.'
        },
        {
          question: 'Posso transferir meu ingresso para outra pessoa?',
          answer: 'Sim! Acesse o ingresso em "Meus Eventos", clique em "Opções" e selecione "Transferir". Você precisará do e-mail da pessoa que receberá o ingresso.'
        }
      ]
    },
    {
      title: 'Pagamentos e Reembolsos',
      items: [
        {
          question: 'Quais formas de pagamento são aceitas?',
          answer: 'Aceitamos cartões de crédito (Visa, Mastercard, Elo), Pix e boleto bancário.'
        },
        {
          question: 'Como solicito o reembolso de um ingresso?',
          answer: 'Você pode solicitar reembolso até 7 dias após a compra, desde que seja até 48h antes do evento. Acesse "Meus Eventos", selecione o ingresso e clique em "Solicitar Reembolso".'
        }
      ]
    },
    {
      title: 'Para Organizadores',
      items: [
        {
          question: 'Como crio um evento na plataforma?',
          answer: 'Clique no botão "Crie seu Evento" no menu principal, preencha as informações básicas e siga o passo a passo para configurar ingressos e detalhes.'
        },
        {
          question: 'Quando recebo o valor das vendas?',
          answer: 'O repasse é feito automaticamente para a conta bancária cadastrada em até 2 dias úteis após o término do evento.'
        }
      ]
    }
  ];

  const filteredCategories = faqCategories.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="container mx-auto max-w-4xl space-y-8">
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
                <BreadcrumbPage>Perguntas Frequentes</BreadcrumbPage>
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
            <h1 className="text-3xl font-bold tracking-tight">Perguntas Frequentes</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Confira as respostas para as dúvidas mais comuns dos nossos usuários.
          </p>

          {/* Search */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Buscar por palavra-chave..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* FAQ List */}
        <div className="space-y-8">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((category, index) => (
              <div key={index} className="space-y-4">
                <h2 className="text-xl font-bold text-primary">{category.title}</h2>
                <div className="space-y-3">
                  {category.items.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="rounded-lg border border-border/60 bg-card/60 p-4"
                    >
                      <p className="font-medium">{item.question}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Nenhum resultado encontrado para "{searchTerm}"
              </p>
              <Button variant="outline" onClick={() => setSearchTerm('')}>
                Limpar busca
              </Button>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-12 p-8 bg-muted/30 rounded-2xl text-center border border-border/50">
          <h3 className="text-xl font-bold mb-2">Não encontrou sua resposta?</h3>
          <p className="text-muted-foreground mb-6">Nossa equipe está pronta para te ajudar com qualquer dúvida.</p>
          <Link to={ROUTE_PATHS.CONTACT_US}>
            <Button>Fale Conosco</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default FAQ;
