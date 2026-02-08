import React from 'react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { 
  Search, 
  Ticket, 
  QrCode, 
  PartyPopper, 
  CalendarPlus, 
  Settings, 
  BarChart3, 
  DollarSign,
  ArrowRight
} from 'lucide-react';

const HowItWorks = () => {
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
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background z-0" />
        <div className="container relative z-10 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6">
              Eventos simples para quem participa.
              <br />
              <span className="text-primary">Vendas poderosas</span> para quem organiza.
            </h1>
            <p className="max-w-2xl mx-auto text-muted-foreground text-lg md:text-xl mb-10">
              A PreFest conecta pessoas a experiências incríveis e fornece ferramentas profissionais para organizadores de sucesso.
            </p>
          </motion.div>
        </div>
      </section>

      {/* For Participants */}
      <section className="py-16 bg-muted/20">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Para quem participa</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Sua jornada do sofá até a pista nunca foi tão fácil.
            </p>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {[
              {
                icon: Search,
                title: "1. Descubra",
                desc: "Explore eventos baseados nos seus interesses e encontre sua próxima experiência favorita."
              },
              {
                icon: Ticket,
                title: "2. Garanta",
                desc: "Compre ingressos de forma segura e rápida, com diversas opções de pagamento."
              },
              {
                icon: QrCode,
                title: "3. Receba",
                desc: "Seu ingresso digital fica salvo no app. Sem papel, sem preocupações."
              },
              {
                icon: PartyPopper,
                title: "4. Curta",
                desc: "Apresente o QR Code na entrada e aproveite o evento. Simples assim."
              }
            ].map((step, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="h-full border-none bg-background/50 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-all">
                  <CardContent className="pt-6 flex flex-col items-center text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
                      <step.icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-12 text-center">
            <Button size="lg" asChild className="h-12 px-8">
              <Link to={ROUTE_PATHS.EXPLORE}>
                Explorar Eventos <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* For Organizers */}
      <section className="py-16">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Para quem organiza</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Controle total do seu evento, do cadastro ao pós-venda.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              {[
                {
                  icon: CalendarPlus,
                  title: "Crie seu evento em minutos",
                  desc: "Configure data, local, descrição e imagens em uma interface intuitiva."
                },
                {
                  icon: Settings,
                  title: "Gestão flexível de ingressos",
                  desc: "Crie lotes, defina preços, quantidade e regras de venda personalizadas."
                },
                {
                  icon: BarChart3,
                  title: "Acompanhe resultados",
                  desc: "Dashboard em tempo real com vendas, check-ins e métricas de desempenho."
                },
                {
                  icon: DollarSign,
                  title: "Receba com segurança",
                  desc: "Repasses automáticos e transparentes diretamente para sua conta."
                }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <item.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
              
              <div className="pt-4">
                <Button size="lg" variant="outline" asChild className="h-12 px-8">
                  <Link to={ROUTE_PATHS.SELL_TICKETS}>
                    Começar a vender <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-3xl blur-3xl" />
              <div className="relative bg-card border border-border/50 rounded-3xl p-8 shadow-2xl">
                {/* Mock UI for Dashboard */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border/50 pb-4">
                    <div className="space-y-1">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-8 w-48 bg-foreground/10 rounded" />
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-4 rounded-xl space-y-2">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <div className="h-6 w-24 bg-primary/40 rounded" />
                    </div>
                    <div className="bg-muted/30 p-4 rounded-xl space-y-2">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <div className="h-6 w-24 bg-green-500/40 rounded" />
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted" />
                          <div className="space-y-1">
                            <div className="h-3 w-24 bg-muted rounded" />
                            <div className="h-2 w-16 bg-muted/50 rounded" />
                          </div>
                        </div>
                        <div className="h-4 w-12 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default HowItWorks;
