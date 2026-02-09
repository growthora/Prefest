import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronDown, Filter, ChevronRight } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { EventListItem } from '@/components/EventListItem';
import { eventService, type Event as SupabaseEvent } from '@/services/event.service';
import { type Event as FrontendEvent } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib';
import { BRAZIL_STATES } from '@/constants/states';

const ExploreEvents = () => {
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL Params
  const categoryParam = searchParams.get('category');
  const stateParam = searchParams.get('state');
  const searchParam = searchParams.get('q') || '';

  // Local state for inputs (synced with URL on submit/change)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchParam);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    setLocalSearchQuery(searchParam);
  }, [searchParam]);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const data = await eventService.getAllEvents();
      
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
      console.error('❌ Erro ao carregar eventos:', err);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter Logic
  const filteredEvents = events.filter(event => {
    // Search Filter
    const matchesSearch = searchParam === '' || 
      event.title.toLowerCase().includes(searchParam.toLowerCase()) || 
      event.location.toLowerCase().includes(searchParam.toLowerCase());

    // Category Filter
    const matchesCategory = !categoryParam || categoryParam === 'Todas' || 
      event.category?.toLowerCase() === categoryParam.toLowerCase() ||
      (categoryParam === 'Festas e shows' && event.event_type === 'festive') || // Fallback/Mapping
      (categoryParam === 'Congressos e palestras' && event.event_type === 'formal');

    // State Filter
    const matchesState = !stateParam || stateParam === 'all' || 
      event.state === stateParam ||
      event.location?.includes(`- ${stateParam}`) || // Fallback comum "Cidade - UF"
      event.address?.includes(`/${stateParam}`);     // Fallback comum "Cidade/UF"

    return matchesSearch && matchesCategory && matchesState;
  });

  const handleCategoryChange = (category: string) => {
    if (category === 'Todas') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', category);
    }
    setSearchParams(searchParams);
  };

  const handleSearch = (term: string) => {
    setLocalSearchQuery(term);
    if (term) {
      searchParams.set('q', term);
    } else {
      searchParams.delete('q');
    }
    setSearchParams(searchParams);
  };

  const categories = ['Todas', 'Festas e shows', 'Teatros e espetáculos', 'Congressos e palestras', 'Passeios e tours', 'Gastronomia', 'Grátis'];
  
  const stateLabel = BRAZIL_STATES.find(s => s.value === stateParam)?.label;
  const displayTitle = categoryParam || (stateLabel ? `Eventos em ${stateLabel}` : 'Explore eventos');

  return (
    <Layout fullWidth={true}>
      <div className="bg-white min-h-screen pb-12">
        
        {/* Header Section */}
        <div className="bg-white border-b border-gray-100 py-8">
          <div className="container max-w-7xl mx-auto px-4">
            
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Link to={ROUTE_PATHS.HOME} className="hover:text-primary transition-colors">Página inicial</Link>
              <ChevronRight size={14} />
              <span className="text-gray-900 font-medium">
                {displayTitle}
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                 <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                   {displayTitle}
                 </h1>
                 <p className="text-gray-500">
                   {filteredEvents.length} eventos encontrados
                   {categoryParam && stateLabel && ` em ${stateLabel}`}
                 </p>
              </div>
              
              {/* Mobile Search - Visible only on mobile */}
              <div className="md:hidden relative w-full">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <Input 
                   placeholder="Buscar eventos..." 
                   className="pl-10 h-10 rounded-lg border-gray-200"
                   value={localSearchQuery}
                   onChange={(e) => handleSearch(e.target.value)}
                 />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar Filters - Desktop Only */}
            <div className="hidden lg:block space-y-8">
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm sticky top-24">
                <div className="flex items-center gap-2 font-bold text-lg text-gray-800 mb-6 pb-4 border-b border-gray-100">
                  <Filter size={20} className="text-primary" />
                  Filtros
                </div>
                
                {/* Search in Sidebar */}
                <div className="mb-6">
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                      placeholder="Nome ou local..." 
                      className="pl-10 h-10 bg-gray-50 border-gray-200 focus-visible:ring-primary/20"
                      value={localSearchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Categories */}
                <div className="mb-6">
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">Categorias</label>
                  <div className="space-y-2">
                    {categories.map((cat) => {
                      const isSelected = (cat === 'Todas' && !categoryParam) || cat === categoryParam;
                      return (
                        <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                          <div 
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 group-hover:border-primary'}`}
                            onClick={() => handleCategoryChange(cat)}
                          >
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <span 
                            className={`text-sm transition-colors ${isSelected ? 'text-primary font-medium' : 'text-gray-600 group-hover:text-primary'}`}
                            onClick={() => handleCategoryChange(cat)}
                          >
                            {cat}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Date (Mock) */}
                <div className="mb-6">
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">Data</label>
                  <div className="space-y-2">
                    {['Hoje', 'Amanhã', 'Esta semana', 'Este fim de semana', 'Próximo mês'].map((date) => (
                      <label key={date} className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-4 h-4 rounded-full border border-gray-300 group-hover:border-primary flex items-center justify-center transition-colors"></div>
                        <span className="text-gray-600 group-hover:text-primary transition-colors text-sm">{date}</span>
                      </label>
                    ))}
                  </div>
                </div>

                 {/* Price (Mock) */}
                 <div>
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">Preço</label>
                  <div className="space-y-2">
                    {['Pago', 'Gratuito'].map((price) => (
                      <label key={price} className="flex items-center gap-3 cursor-pointer group">
                         <div className="w-4 h-4 rounded border border-gray-300 group-hover:border-primary flex items-center justify-center transition-colors"></div>
                        <span className="text-gray-600 group-hover:text-primary transition-colors text-sm">{price}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Results Grid */}
            <div className="lg:col-span-3">
              {/* Mobile Quick Filters */}
              <div className="lg:hidden flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-6">
                 {['Filtrar', 'Data', 'Preço', 'Categoria'].map((filter, idx) => (
                   <Button 
                     key={filter} 
                     variant="outline" 
                     className={`rounded-full border-gray-300 text-gray-700 h-9 px-4 font-normal flex-shrink-0 ${idx === 0 ? 'bg-gray-100 font-medium' : ''}`}
                   >
                     {idx === 0 && <Filter size={14} className="mr-2" />}
                     {filter} 
                     {idx !== 0 && <ChevronDown size={14} className="ml-2" />}
                   </Button>
                 ))}
               </div>

              <div className="flex items-center justify-between mb-6">
                <div className="text-gray-600 font-medium">
                  {isLoading ? 'Buscando eventos...' : 
                   filteredEvents.length > 0 ? `${filteredEvents.length} eventos encontrados` : 'Nenhum evento encontrado'}
                </div>
                
                {/* Sort - Desktop */}
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-sm text-gray-500">Ordenar por:</span>
                  <select className="text-sm font-medium text-gray-800 bg-transparent border-none cursor-pointer focus:ring-0 outline-none">
                    <option>Relevância</option>
                    <option>Data (próximos)</option>
                    <option>Menor preço</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white border-b border-gray-100 p-4 last:border-0">
                      <div className="flex gap-4">
                        <Skeleton className="w-[120px] h-[90px] sm:w-[160px] sm:h-[100px] rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2 py-1">
                          <Skeleton className="h-5 w-3/4 rounded-md" />
                          <Skeleton className="h-4 w-1/3 rounded-md" />
                          <Skeleton className="h-4 w-1/4 rounded-md mt-2" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : filteredEvents.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    {filteredEvents.map((event) => (
                      <EventListItem 
                        key={event.id} 
                        event={event} 
                        className="last:border-0"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                      <Search className="text-gray-300 w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Nenhum evento encontrado</h3>
                    <p className="text-gray-500 text-center max-w-xs">
                      {categoryParam 
                        ? `Não encontramos eventos na categoria "${categoryParam}".` 
                        : "Tente ajustar seus termos de busca ou filtros para encontrar o que procura."}
                    </p>
                    <Button 
                      variant="link" 
                      className="text-primary mt-4 font-bold"
                      onClick={() => {
                        setSearchParams({});
                        setLocalSearchQuery('');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ExploreEvents;
