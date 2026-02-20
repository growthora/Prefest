import React, { useEffect, useState } from 'react';
import { Flame, Trophy, ChevronRight } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { EventGrid, EventCard } from '@/components/EventCards';
import { eventService, type Event as SupabaseEvent } from '@/services/event.service';
import { type Event as FrontendEvent, ROUTE_PATHS } from '@/lib/index';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const EmAlta = () => {
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const title = 'Eventos em alta perto de você | Pré-fest';
    const description =
      'Descubra os eventos com mais vendas e visualizações. Veja o ranking em alta e garanta seu ingresso antes que acabe.';

    document.title = title;

    const ensureMetaTag = (selector: string, attrs: Record<string, string>, content: string) => {
      let tag = document.querySelector<HTMLMetaElement>(selector);
      if (!tag) {
        tag = document.createElement('meta');
        Object.entries(attrs).forEach(([key, value]) => {
          tag?.setAttribute(key, value);
        });
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    ensureMetaTag('meta[name="description"]', { name: 'description' }, description);
    ensureMetaTag('meta[property="og:title"]', { property: 'og:title' }, title);
    ensureMetaTag('meta[property="og:description"]', { property: 'og:description' }, description);
    ensureMetaTag('meta[property="og:type"]', { property: 'og:type' }, 'website');
    ensureMetaTag('meta[property="og:url"]', { property: 'og:url' }, window.location.href);

    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      setLoadError(false);
      const data = await eventService.getTrendingEvents();

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
          state: event.state,
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
      console.error('Erro ao carregar eventos em alta', err);
      setLoadError(true);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const TopNavigation = () => {
    return (
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500 overflow-x-auto scrollbar-hide">
        <Link
          to={ROUTE_PATHS.EM_ALTA}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground font-medium whitespace-nowrap"
        >
          <Flame className="w-4 h-4" />
          Em alta
        </Link>
        <Link
          to={ROUTE_PATHS.CATEGORIES}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
        >
          Categorias
        </Link>
        <Link
          to={ROUTE_PATHS.NEWS}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
        >
          Novidades
        </Link>
      </div>
    );
  };

  const renderSkeleton = () => {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4">
              <Skeleton className="w-full aspect-[4/5] rounded-xl mb-4" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4">
              <Skeleton className="w-full aspect-[4/5] rounded-xl mb-4" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Flame className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Ainda não há eventos em alta</h2>
        <p className="text-gray-500 mb-4 max-w-md">
          Assim que os eventos começarem a ganhar tração em vendas e visualizações, eles vão aparecer aqui em
          destaque.
        </p>
        <Button asChild variant="outline">
          <Link to={ROUTE_PATHS.EXPLORE}>
            Explorar todos os eventos
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
    );
  };

  const topThree = events.slice(0, 3);
  const others = events.slice(3);

  return (
    <Layout fullWidth={true}>
      <div className="bg-white min-h-screen pb-12">
        <div className="border-b border-gray-100 bg-white">
          <div className="container max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Flame className="w-5 h-5" />
              </span>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <span>🔥 Em alta</span>
                </div>
                <h1 className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">Os eventos com mais tração</h1>
                <p className="text-gray-500 text-sm md:text-base mt-1">
                  Ranking em tempo quase real considerando vendas de ingressos e visualizações de página.
                </p>
              </div>
            </div>

            <TopNavigation />
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 py-8 space-y-10">
          {loadError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              Não foi possível carregar os eventos em alta. Tente novamente em alguns instantes.
            </div>
          )}

          {isLoading ? (
            renderSkeleton()
          ) : events.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-lg font-semibold text-gray-900">Top 3 do momento</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
                  {topThree.map((event, index) => (
                    <div key={event.id} className="relative pt-8">
                      <div className="absolute top-2 left-3 z-10">
                        <div className="inline-flex items-center gap-1 rounded-full bg-black/80 px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                          <span>{index + 1}º</span>
                          {index === 0 && <span className="text-yellow-300">Líder</span>}
                          {index === 1 && <span className="text-gray-200">Em alta</span>}
                          {index === 2 && <span className="text-orange-200">Subindo</span>}
                        </div>
                      </div>
                      <EventCard event={event} className="h-full mt-4" />
                    </div>
                  ))}
                </div>
              </section>

              {others.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Outros eventos em alta</h2>
                    <span className="text-sm text-gray-500">
                      {events.length} eventos no total
                    </span>
                  </div>
                  <EventGrid events={others} />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default EmAlta;

