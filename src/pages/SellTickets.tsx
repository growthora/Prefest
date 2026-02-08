import React from 'react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { CheckCircle2, TrendingUp, ShieldCheck, Users, Zap, PieChart } from 'lucide-react';

const SellTickets = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-background">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        </div>

        <div className="container relative z-10 px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Plataforma #1 para organizadores modernos
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight">
                Venda ingressos online <span className="text-primary">sem complicação</span>.
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed max-w-lg">
                Gerencie seus eventos com a plataforma mais completa do mercado. Taxas justas, pagamentos seguros e controle total na sua mão.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="h-14 px-8 text-lg font-semibold shadow-[0_0_20px_rgba(255,0,127,0.3)]">
                  Criar meu evento agora
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold">
                  Falar com especialista
                </Button>
              </div>
              
              <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Setup em 2 minutos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Sem mensalidade</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-30" />
              <div className="relative bg-card border border-border/50 rounded-2xl p-6 shadow-2xl">
                {/* Dashboard Preview Mock */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">Dashboard de Vendas</h3>
                    <div className="text-sm text-muted-foreground">Últimos 7 dias</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                      <div className="text-sm text-muted-foreground mb-1">Receita Total</div>
                      <div className="text-2xl font-bold text-primary">R$ 12.450</div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Ingressos</div>
                      <div className="text-2xl font-bold">342</div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                      <div className="text-sm text-muted-foreground mb-1">Visitas</div>
                      <div className="text-2xl font-bold">1.2k</div>
                    </div>
                  </div>

                  <div className="h-40 bg-muted/20 rounded-xl flex items-end justify-between p-4 gap-2">
                    {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                      <div key={i} className="w-full bg-primary/20 rounded-t-sm relative group">
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-sm transition-all duration-1000"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-muted/10">
        <div className="container px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Tudo o que você precisa para crescer</h2>
            <p className="text-muted-foreground text-lg">
              Ferramentas desenvolvidas para potencializar suas vendas e simplificar a gestão do seu evento.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingUp,
                title: "Vendas em Tempo Real",
                desc: "Acompanhe cada venda no momento em que ela acontece. Dados precisos para tomada de decisão rápida."
              },
              {
                icon: ShieldCheck,
                title: "Pagamentos Seguros",
                desc: "Sistema antifraude integrado e processamento seguro. Receba seus valores sem dor de cabeça."
              },
              {
                icon: Users,
                title: "Gestão de Participantes",
                desc: "Check-in digital via QR Code, lista de convidados e controle de acesso eficiente."
              },
              {
                icon: PieChart,
                title: "Relatórios Detalhados",
                desc: "Entenda seu público com análises demográficas e de comportamento de compra."
              },
              {
                icon: Zap,
                title: "Marketing Integrado",
                desc: "Ferramentas de divulgação, códigos promocionais e links de rastreamento."
              },
              {
                icon: CheckCircle2,
                title: "Suporte Dedicado",
                desc: "Nossa equipe está pronta para ajudar você em todas as etapas do seu evento."
              }
            ].map((feature, idx) => (
              <Card key={idx} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>


      {/* Testimonials section removed to ensure no mock data */}


      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/10" />
        <div className="container relative z-10 px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Pronto para começar?</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Junte-se a milhares de organizadores e leve seu evento para o próximo nível hoje mesmo.
          </p>
          <Button size="lg" className="h-16 px-10 text-xl font-bold shadow-xl hover:scale-105 transition-transform">
            Criar meu evento gratuitamente
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Sem cartão de crédito necessário para começar.
          </p>
        </div>
      </section>
    </Layout>
  );
};

export default SellTickets;
