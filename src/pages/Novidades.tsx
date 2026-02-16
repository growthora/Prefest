import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { eventService, type Event as SupabaseEvent } from '@/services/event.service';
import { type Event as FrontendEvent, ROUTE_PATHS } from '@/lib/index';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight, Sparkles } from 'lucide-react';
import { EventCard } from '@/components/EventCards';

const Novidades = () => {
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const title = 'Novos eventos publicados | Pré-fest';
    const description =
      'Veja os eventos recém-publicados na Pré-fest. Fique por dentro das novidades e garanta seus ingressos antes de todo mundo.';

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
      const data = await eventService.getNewEvents();

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
      console.error('Erro ao carregar novidades', err);
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
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
        >
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
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground font-medium whitespace-nowrap"
        >
          Novidades
        </Link>
      </div>
    );
  };

  const renderSkeleton = () => {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex flex-col items-center">
              <Skeleton className="w-8 h-8 rounded-full mb-2" />
              <div className="w-px flex-1 bg-gray-100" />
            </div>
            <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-4">
              <Skeleton className="w-full aspect-[4/5] rounded-xl mb-4" />
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEmptyState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Ainda não há novidades</h2>
        <p className="text-gray-500 mb-4 max-w-md">
          Assim que novos eventos forem publicados nos próximos dias, eles vão aparecer aqui primeiro.
        </p>
        <Button asChild variant="outline">
          <Link to={ROUTE_PATHS.EXPLORE}>
            Explorar outros eventos
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
    );
  };

  return (
    <Layout fullWidth={true}>
      <div className="bg-white min-h-screen pb-12">
        <div className="border-b border-gray-100 bg-white">
          <div className="container max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <span>🆕 Novidades</span>
                </div>
                <h1 className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">Eventos recém-publicados</h1>
                <p className="text-gray-500 text-sm md:text-base mt-1">
                  Timeline com os eventos publicados nos últimos dias, sempre com datas futuras.
                </p>
              </div>
            </div>

            <TopNavigation />
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 py-8">
          {loadError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              Não foi possível carregar as novidades. Tente novamente em alguns instantes.
            </div>
          )}

          {isLoading ? (
            renderSkeleton()
          ) : events.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="space-y-6">
              {events.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      <Clock className="w-4 h-4" />
                    </div>
                    {index !== events.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-2" />}
                  </div>
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 mb-2 text-xs text-primary font-semibold bg-primary/5 px-2 py-1 rounded-full">
                      <span>🆕 Novo</span>
                      <span>Publicado recentemente</span>
                    </div>
                    <EventCard event={event} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Novidades;

