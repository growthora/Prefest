import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { EventGrid } from '@/components/EventCards';
import { eventService, type Event as SupabaseEvent } from '@/services/event.service';
import { type Event as FrontendEvent } from '@/lib/index';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CollectionConfig {
  title: string;
  description: string;
  fetch: () => Promise<SupabaseEvent[]>;
}

const Collection = () => {
  const { slug } = useParams<{ slug: string }>();
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<CollectionConfig | null>(null);

  const COLLECTIONS: Record<string, CollectionConfig> = {
    'destaques': {
      title: 'Eventos em Destaque',
      description: 'Confira a seleção dos eventos mais bombados do momento, escolhidos especialmente para você curtir ao máximo.',
      fetch: async () => {
        const allEvents = await eventService.getAllEvents();
        // Simula destaques ordenando por participantes (decrescente) e pegando top 20
        return allEvents
          .sort((a, b) => b.current_participants - a.current_participants)
          .slice(0, 20);
      }
    },
    'proximos-eventos': {
      title: 'Próximos Eventos',
      description: 'Fique por dentro de tudo que vai rolar nos próximos dias. Garanta seu ingresso antecipado!',
      fetch: async () => {
        return await eventService.getAvailableEvents();
      }
    },
    'festas-e-shows': {
      title: 'Festas e Shows',
      description: 'As melhores festas, shows e baladas para você curtir a noite.',
      fetch: async () => {
        const allEvents = await eventService.getAllEvents();
        return allEvents.filter(e => 
          e.category === 'Festas e shows' || 
          e.event_type === 'festive'
        );
      }
    },
    'carnaval': {
      title: 'Carnaval 2026',
      description: 'A maior festa do ano chegou! Confira os blocos, camarotes e festas de carnaval.',
      fetch: async () => {
        const allEvents = await eventService.getAllEvents();
        return allEvents.filter(e => 
          e.title.toLowerCase().includes('carnaval') || 
          e.description?.toLowerCase().includes('carnaval') ||
          e.category?.toLowerCase().includes('carnaval')
        );
      }
    },
    'teatros-e-espetaculos': {
      title: 'Teatros e Espetáculos',
      description: 'Peças de teatro, musicais, dança e apresentações culturais imperdíveis.',
      fetch: async () => {
        const allEvents = await eventService.getAllEvents();
        return allEvents.filter(e => 
          e.category === 'Teatros e espetáculos' || 
          e.category === 'Teatro'
        );
      }
    },
    'stand-up-comedy': {
      title: 'Stand Up Comedy',
      description: 'Prepare-se para dar muitas risadas com os melhores comediantes do Brasil.',
      fetch: async () => {
        const allEvents = await eventService.getAllEvents();
        return allEvents.filter(e => 
          e.category === 'Stand Up' || 
          e.title.toLowerCase().includes('stand up') ||
          e.title.toLowerCase().includes('comedy')
        );
      }
    },
    'descontos-exclusivos': {
      title: 'Descontos Exclusivos',
      description: 'Eventos com preços especiais e descontos que você só encontra aqui.',
      fetch: async () => {
        const allEvents = await eventService.getAllEvents();
        // Simulação: eventos com preço abaixo de 50 ou com alguma flag
        return allEvents.filter(e => e.price > 0 && e.price < 50);
      }
    },
    'eventos-corporativos': {
      title: 'Eventos Corporativos',
      description: 'Networking, palestras, workshops e congressos para impulsionar sua carreira.',
      fetch: async () => {
        const allEvents = await eventService.getAllEvents();
        return allEvents.filter(e => 
          e.category === 'Congressos e palestras' || 
          e.category === 'Corporativo' ||
          e.event_type === 'formal'
        );
      }
    }
  };

  useEffect(() => {
    loadCollection();
  }, [slug]);

  const loadCollection = async () => {
    if (!slug || !COLLECTIONS[slug]) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const currentConfig = COLLECTIONS[slug];
      setConfig(currentConfig);

      const data = await currentConfig.fetch();
      
      const convertedEvents: FrontendEvent[] = data.map((event: SupabaseEvent) => {
        let imageUrl = 'https://placehold.co/600x400/1a1a1a/ffffff?text=Evento';
        if (event.image_url) imageUrl = event.image_url;
        
        return {
          id: event.id,
          slug: event.slug,
          title: event.title,
          date: new Date(event.event_date).toLocaleDateString('pt-BR'),
          time: new Date(event.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          location: event.location,
          address: event.location,
          city: event.city,
          event_type: event.event_type,
          price: event.price,
          image: imageUrl,
          description: event.description || '',
          category: event.category || 'Geral',
          attendeesCount: event.current_participants,
          tags: event.category ? [event.category] : [],
        };
      });
      
      setEvents(convertedEvents);
    } catch (err) {
      console.error('❌ Erro ao carregar coleção:', err);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!slug || (!isLoading && !config)) {
    return (
      <Layout>
        <div className="container max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Coleção não encontrada</h1>
          <p className="text-gray-600 mb-8">A coleção que você está procurando não existe ou foi removida.</p>
          <Button asChild>
            <Link to="/">Voltar para Home</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-gray-50/50 min-h-screen pb-20">
        {/* Header da Coleção */}
        <div className="bg-white border-b border-gray-100 py-12 mb-8">
          <div className="container max-w-7xl mx-auto px-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <Link to="/" className="hover:text-primary flex items-center gap-1 transition-colors">
                <Home size={14} />
                Home
              </Link>
              <ChevronRight size={14} />
              <span className="text-gray-900 font-medium">Coleções</span>
              <ChevronRight size={14} />
              <span className="text-primary font-medium capitalize">{config?.title}</span>
            </div>

            <div className="max-w-3xl">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-3/4" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                <>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
                    {config?.title}
                  </h1>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    {config?.description}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Eventos */}
        <div className="container max-w-7xl mx-auto px-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-[300px] w-full rounded-2xl" />
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              ))}
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  <strong>{events.length}</strong> eventos encontrados
                </p>
              </div>
              <EventGrid events={events} />
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum evento encontrado</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                No momento não temos eventos nesta coleção. Volte mais tarde para conferir as novidades!
              </p>
              <Button asChild variant="outline">
                <Link to="/">Explorar outros eventos</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Collection;
