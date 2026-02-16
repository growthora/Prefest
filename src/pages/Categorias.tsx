import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { eventService, type Category } from '@/services/event.service';
import { ROUTE_PATHS } from '@/lib/index';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { Grid2X2, ChevronRight, Music, Theater, Mic, Map, Utensils, Ticket, Trophy, Gamepad, Star } from 'lucide-react';

type CategoryWithCount = Category & { upcoming_events_count: number };

const iconMap: Record<string, React.ReactNode> = {
  'festas-e-shows': <Music className="w-5 h-5" />,
  'teatros-e-espetaculos': <Theater className="w-5 h-5" />,
  'congressos-e-palestras': <Mic className="w-5 h-5" />,
  'passeios-e-tours': <Map className="w-5 h-5" />,
  'gastronomia': <Utensils className="w-5 h-5" />,
  'gratis': <Ticket className="w-5 h-5" />,
  'esportes': <Trophy className="w-5 h-5" />,
  'geek-e-tecnologia': <Gamepad className="w-5 h-5" />,
};

const getCategoryIcon = (slug: string | null) => {
  if (!slug) return <Star className="w-5 h-5" />;
  return iconMap[slug] || <Star className="w-5 h-5" />;
};

const Categorias = () => {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const title = 'Categorias de eventos | Pré-fest';
    const description =
      'Navegue por categorias de eventos e encontre experiências do seu jeito: festas, shows, teatros, gastronomia e muito mais.';

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

    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      setLoadError(false);
      const data = await eventService.getCategoriesWithUpcomingEvents();
      setCategories(data);
    } catch (err) {
      console.error('Erro ao carregar categorias', err);
      setLoadError(true);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryClick = (category: CategoryWithCount) => {
    const search = new URLSearchParams({ category: category.name }).toString();
    navigate(`${ROUTE_PATHS.EXPLORE}?${search}`);
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
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground font-medium whitespace-nowrap"
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  };

  const renderEmptyState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Grid2X2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Nenhuma categoria disponível no momento</h2>
        <p className="text-gray-500 mb-4 max-w-md">
          Assim que novos eventos forem publicados, você verá aqui as categorias com experiências disponíveis.
        </p>
        <Button asChild variant="outline">
          <Link to={ROUTE_PATHS.EXPLORE}>
            Ver todos os eventos
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
                <Grid2X2 className="w-5 h-5" />
              </span>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <span>Explorar por interesse</span>
                </div>
                <h1 className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">Categorias de eventos</h1>
                <p className="text-gray-500 text-sm md:text-base mt-1">
                  Escolha um tipo de experiência e veja os eventos que combinam com você.
                </p>
              </div>
            </div>

            <TopNavigation />
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
          {loadError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              Não foi possível carregar as categorias. Tente novamente em alguns instantes.
            </div>
          )}

          {isLoading ? (
            renderSkeleton()
          ) : categories.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map(category => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleCategoryClick(category)}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary w-10 h-10">
                      {getCategoryIcon(category.slug)}
                    </div>
                    <div className="text-xs font-semibold text-primary/80 bg-primary/5 px-2 py-1 rounded-full">
                      {category.upcoming_events_count} eventos
                    </div>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">{category.name}</h2>
                    <p className="text-xs text-gray-500">
                      Descubra eventos de {category.name.toLowerCase()} e viva novas experiências.
                    </p>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-2 transition-all">
                    Ver eventos
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Categorias;

