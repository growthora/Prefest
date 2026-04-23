import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, Filter, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { EventListItem } from '@/components/EventListItem';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BRAZIL_STATES } from '@/constants/states';
import { ROUTE_PATHS, type Event as FrontendEvent } from '@/lib';
import { eventService, type Event as SupabaseEvent } from '@/services/event.service';
import { getStableEventKey, logDuplicateItems, removeDuplicates } from '@/utils/eventDeduplication';

interface ExtendedEvent extends FrontendEvent {
  rawDate: Date;
  numericPrice: number;
}

interface FilterOption {
  label: string;
  value: string;
}

interface CountedFilterOption extends FilterOption {
  count: number;
}

interface FilterOverrides {
  search?: string;
  date?: string;
  price?: string;
  category?: string;
  state?: string;
}

const DATE_OPTIONS: FilterOption[] = [
  { label: 'Hoje', value: 'today' },
  { label: 'Amanhã', value: 'tomorrow' },
  { label: 'Esta semana', value: 'week' },
  { label: 'Este fim de semana', value: 'weekend' },
  { label: 'Próximo mês', value: 'next_month' },
];

const PRICE_OPTIONS: FilterOption[] = [
  { label: 'Pago', value: 'paid' },
  { label: 'Gratuito', value: 'free' },
];

const SORT_OPTIONS: FilterOption[] = [
  { label: 'Relevância', value: 'relevance' },
  { label: 'Data (próximos)', value: 'date' },
  { label: 'Menor preço', value: 'price_asc' },
];

const normalizeCategoryValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getWeekStartMonday = (date: Date) => {
  const dayIndexMondayZero = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - dayIndexMondayZero);
  return startOfDay(start);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
};

const getEventCategoryLabel = (event: SupabaseEvent) => {
  const category = event.category?.trim();
  if (category) return category;
  if (event.event_type === 'festive') return 'Festas e shows';
  if (event.event_type === 'formal') return 'Congressos e palestras';
  return 'Geral';
};

const ExploreEvents = () => {
  const [events, setEvents] = useState<ExtendedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryParam = searchParams.get('category') || '';
  const stateParam = searchParams.get('state') || '';
  const searchParam = searchParams.get('q') || '';
  const sortParam = searchParams.get('sort') || 'relevance';
  const dateParam = searchParams.get('date') || '';
  const priceParam = searchParams.get('price') || '';

  const [localSearchQuery, setLocalSearchQuery] = useState(searchParam);
  const [sortBy, setSortBy] = useState(sortParam);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    setLocalSearchQuery(searchParam);
  }, [searchParam]);

  useEffect(() => {
    setSortBy(sortParam);
  }, [sortParam]);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const data = await eventService.getAllEvents();

      const convertedEvents: ExtendedEvent[] = data.map((event: SupabaseEvent) => {
        const category = getEventCategoryLabel(event);
        const numericPrice =
          typeof event.display_price_value === 'number'
            ? event.display_price_value
            : typeof event.price === 'number'
              ? event.price
              : Number.POSITIVE_INFINITY;

        return {
          id: event.id,
          slug: event.slug,
          title: event.title,
          date: new Date(event.event_date).toLocaleDateString('pt-BR'),
          time: new Date(event.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          location: event.location || '',
          address: event.location || '',
          city: event.city || '',
          state: event.state || '',
          event_type: event.event_type,
          price: event.price,
          image: event.image_url || 'https://placehold.co/600x400/1a1a1a/ffffff?text=Evento',
          description: event.description || '',
          category,
          attendeesCount: event.current_participants,
          tags: category ? [category] : [],
          rawDate: new Date(event.event_date),
          numericPrice,
        };
      });

      logDuplicateItems('ExploreEvents', convertedEvents);
      setEvents(removeDuplicates(convertedEvents));
    } catch {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const dayAfterTomorrowStart = addDays(todayStart, 2);
  const weekStart = getWeekStartMonday(now);
  const nextWeekStart = addDays(weekStart, 7);
  const weekendStart = addDays(weekStart, 5);
  const nextMondayStart = addDays(weekStart, 7);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthAfterNextStart = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  const eventMatchesFilters = (event: ExtendedEvent, overrides: FilterOverrides = {}) => {
    const activeSearch = overrides.search ?? searchParam;
    const activeDate = overrides.date ?? dateParam;
    const activePrice = overrides.price ?? priceParam;
    const activeCategory = overrides.category ?? categoryParam;
    const activeState = overrides.state ?? stateParam;

    const matchesSearch =
      activeSearch === '' ||
      event.title.toLowerCase().includes(activeSearch.toLowerCase()) ||
      event.location.toLowerCase().includes(activeSearch.toLowerCase());

    const matchesDate = (() => {
      if (!activeDate) return true;

      const eventTime = event.rawDate?.getTime?.() ? event.rawDate : new Date(event.rawDate);
      const time = eventTime.getTime();

      if (Number.isNaN(time)) return true;
      if (activeDate === 'today') return time >= todayStart.getTime() && time < tomorrowStart.getTime();
      if (activeDate === 'tomorrow') return time >= tomorrowStart.getTime() && time < dayAfterTomorrowStart.getTime();
      if (activeDate === 'week') return time >= now.getTime() && time < nextWeekStart.getTime();
      if (activeDate === 'weekend') return time >= weekendStart.getTime() && time < nextMondayStart.getTime();
      if (activeDate === 'next_month') return time >= nextMonthStart.getTime() && time < monthAfterNextStart.getTime();

      return true;
    })();

    const matchesPrice = (() => {
      if (!activePrice) return true;
      const price = Number.isFinite(event.numericPrice) ? event.numericPrice : Number.POSITIVE_INFINITY;
      if (activePrice === 'free') return price === 0;
      if (activePrice === 'paid') return price > 0;
      return true;
    })();

    const normalizedCategoryParam = activeCategory ? normalizeCategoryValue(activeCategory) : '';
    const normalizedEventCategory = normalizeCategoryValue(event.category || '');
    const matchesCategory =
      !normalizedCategoryParam ||
      normalizedCategoryParam === 'todas' ||
      normalizedEventCategory === normalizedCategoryParam ||
      (normalizedCategoryParam === normalizeCategoryValue('Festas e shows') && event.event_type === 'festive') ||
      (normalizedCategoryParam === normalizeCategoryValue('Congressos e palestras') && event.event_type === 'formal');

    const matchesState =
      !activeState ||
      activeState === 'all' ||
      event.state === activeState ||
      event.location.includes(`- ${activeState}`) ||
      event.address.includes(`/${activeState}`);

    return matchesSearch && matchesDate && matchesPrice && matchesCategory && matchesState;
  };

  const getMatchingEvents = (overrides: FilterOverrides = {}) =>
    events.filter((event) => eventMatchesFilters(event, overrides));

  const filteredEvents = removeDuplicates(getMatchingEvents());

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (sortBy === 'date') {
      return a.rawDate.getTime() - b.rawDate.getTime();
    }

    if (sortBy === 'price_asc') {
      return a.numericPrice - b.numericPrice;
    }

    return 0;
  });

  const visibleEvents = removeDuplicates(sortedEvents);
  const allDatesCount = getMatchingEvents({ date: '' }).length;
  const allPricesCount = getMatchingEvents({ price: '' }).length;
  const categoryBaseEvents = getMatchingEvents({ category: '' });

  const dateOptions: CountedFilterOption[] = DATE_OPTIONS.map((option) => ({
    ...option,
    count: getMatchingEvents({ date: option.value }).length,
  }));

  const priceOptions: CountedFilterOption[] = PRICE_OPTIONS.map((option) => ({
    ...option,
    count: getMatchingEvents({ price: option.value }).length,
  }));

  const availableCategoryNames = Array.from(
    new Set(
      categoryBaseEvents
        .map((event) => event.category?.trim())
        .filter((category): category is string => Boolean(category))
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  if (categoryParam && !availableCategoryNames.some((category) => normalizeCategoryValue(category) === normalizeCategoryValue(categoryParam))) {
    availableCategoryNames.push(categoryParam);
    availableCategoryNames.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  const categoryOptions: CountedFilterOption[] = [
    { label: 'Todas', value: '', count: categoryBaseEvents.length },
    ...availableCategoryNames.map((category) => ({
      label: category,
      value: category,
      count: getMatchingEvents({ category }).length,
    })),
  ];

  const selectedDateLabel = dateOptions.find((option) => option.value === dateParam)?.label || 'Data';
  const selectedPriceLabel = priceOptions.find((option) => option.value === priceParam)?.label || 'Preço';
  const selectedCategoryLabel =
    categoryOptions.find((option) => normalizeCategoryValue(option.value) === normalizeCategoryValue(categoryParam))?.label ||
    'Categoria';
  const activeFilterCount = [dateParam, priceParam, categoryParam, stateParam].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0 || sortBy !== 'relevance';

  const handleSortValueChange = (value: string) => {
    setSortBy(value);

    const params = new URLSearchParams(searchParams);
    if (value === 'relevance') {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }

    setSearchParams(params);
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    handleSortValueChange(event.target.value);
  };

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams(searchParams);
    if (!category || category === 'Todas') {
      params.delete('category');
    } else {
      params.set('category', category);
    }
    setSearchParams(params);
  };

  const handleSearch = (term: string) => {
    setLocalSearchQuery(term);
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    setSearchParams(params);
  };

  const handleDateChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (!value) {
      params.delete('date');
    } else if (params.get('date') === value) {
      params.delete('date');
    } else {
      params.set('date', value);
    }
    setSearchParams(params);
  };

  const handlePriceChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (!value) {
      params.delete('price');
    } else if (params.get('price') === value) {
      params.delete('price');
    } else {
      params.set('price', value);
    }
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    const params = new URLSearchParams(searchParams);
    ['category', 'date', 'price', 'state', 'sort'].forEach((param) => params.delete(param));
    setSearchParams(params);
  };

  const stateLabel = BRAZIL_STATES.find((state) => state.value === stateParam)?.label;
  const displayTitle = categoryParam || (stateLabel ? `Eventos em ${stateLabel}` : 'Explore eventos');

  return (
    <Layout fullWidth={true}>
      <div className="bg-white min-h-screen pb-12">
        <div className="bg-white border-b border-gray-100 py-8">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Link to={ROUTE_PATHS.HOME} className="hover:text-primary transition-colors">
                Página inicial
              </Link>
              <ChevronRight size={14} />
              <span className="text-gray-900 font-medium">{displayTitle}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{displayTitle}</h1>
                <p className="text-gray-500">
                  {filteredEvents.length} eventos encontrados
                  {categoryParam && stateLabel && ` em ${stateLabel}`}
                </p>
              </div>

              <div className="md:hidden relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar eventos..."
                  className="pl-10 h-10 rounded-lg border-gray-200"
                  value={localSearchQuery}
                  onChange={(event) => handleSearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="hidden lg:block space-y-8">
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm sticky top-24">
                <div className="flex items-center gap-2 font-bold text-lg text-gray-800 mb-6 pb-4 border-b border-gray-100">
                  <Filter size={20} className="text-primary" />
                  Filtros
                </div>

                <div className="mb-6">
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Nome ou local..."
                      className="pl-10 h-10 bg-gray-50 border-gray-200 focus-visible:ring-primary/20"
                      value={localSearchQuery}
                      onChange={(event) => handleSearch(event.target.value)}
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">Categorias</label>
                  <div className="space-y-2">
                    {categoryOptions.map((categoryOption) => {
                      const isSelected =
                        (!categoryOption.value && !categoryParam) ||
                        normalizeCategoryValue(categoryOption.value) === normalizeCategoryValue(categoryParam);
                      const isDisabled = categoryOption.count === 0 && !isSelected;

                      return (
                        <label
                          key={categoryOption.value || 'all-categories'}
                          className={`flex items-center gap-3 group ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 group-hover:border-primary'}`}
                            onClick={() => {
                              if (!isDisabled) handleCategoryChange(categoryOption.value);
                            }}
                          >
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <span
                            className={`text-sm transition-colors ${isSelected ? 'text-primary font-medium' : 'text-gray-600 group-hover:text-primary'}`}
                            onClick={() => {
                              if (!isDisabled) handleCategoryChange(categoryOption.value);
                            }}
                          >
                            {categoryOption.label}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">{categoryOption.count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">Data</label>
                  <div className="space-y-2">
                    {dateOptions.map((option) => {
                      const isSelected = dateParam === option.value;
                      const isDisabled = option.count === 0 && !isSelected;

                      return (
                        <label
                          key={option.value}
                          className={`flex items-center gap-3 group ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 group-hover:border-primary'}`}
                            onClick={() => {
                              if (!isDisabled) handleDateChange(option.value);
                            }}
                          >
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <span
                            className={`text-sm transition-colors ${isSelected ? 'text-primary font-medium' : 'text-gray-600 group-hover:text-primary'}`}
                            onClick={() => {
                              if (!isDisabled) handleDateChange(option.value);
                            }}
                          >
                            {option.label}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">{option.count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">Preço</label>
                  <div className="space-y-2">
                    {priceOptions.map((option) => {
                      const isSelected = priceParam === option.value;
                      const isDisabled = option.count === 0 && !isSelected;

                      return (
                        <label
                          key={option.value}
                          className={`flex items-center gap-3 group ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 group-hover:border-primary'}`}
                            onClick={() => {
                              if (!isDisabled) handlePriceChange(option.value);
                            }}
                          >
                            {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                          </div>
                          <span
                            className={`text-sm transition-colors ${isSelected ? 'text-primary font-medium' : 'text-gray-600 group-hover:text-primary'}`}
                            onClick={() => {
                              if (!isDisabled) handlePriceChange(option.value);
                            }}
                          >
                            {option.label}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">{option.count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="lg:hidden flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-6">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={`rounded-full border-gray-300 text-gray-700 h-9 px-4 font-normal flex-shrink-0 ${hasActiveFilters ? 'bg-gray-100 font-medium' : ''}`}
                    >
                      <Filter size={14} className="mr-2" />
                      {activeFilterCount > 0 ? `Filtrar (${activeFilterCount})` : 'Filtrar'}
                      <ChevronDown size={14} className="ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={sortBy} onValueChange={handleSortValueChange}>
                      {SORT_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    {hasActiveFilters && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={handleClearFilters}>Limpar filtros</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={`rounded-full border-gray-300 text-gray-700 h-9 px-4 font-normal flex-shrink-0 ${dateParam ? 'bg-primary/10 border-primary text-primary' : ''}`}
                    >
                      {selectedDateLabel}
                      <ChevronDown size={14} className="ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Filtrar por data</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={dateParam || 'all'} onValueChange={(value) => handleDateChange(value === 'all' ? '' : value)}>
                      <DropdownMenuRadioItem value="all">
                        Todas as datas
                        <DropdownMenuShortcut>{allDatesCount}</DropdownMenuShortcut>
                      </DropdownMenuRadioItem>
                      {dateOptions.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          disabled={option.count === 0 && dateParam !== option.value}
                        >
                          {option.label}
                          <DropdownMenuShortcut>{option.count}</DropdownMenuShortcut>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={`rounded-full border-gray-300 text-gray-700 h-9 px-4 font-normal flex-shrink-0 ${priceParam ? 'bg-primary/10 border-primary text-primary' : ''}`}
                    >
                      {selectedPriceLabel}
                      <ChevronDown size={14} className="ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Filtrar por preço</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={priceParam || 'all'} onValueChange={(value) => handlePriceChange(value === 'all' ? '' : value)}>
                      <DropdownMenuRadioItem value="all">
                        Todos os preços
                        <DropdownMenuShortcut>{allPricesCount}</DropdownMenuShortcut>
                      </DropdownMenuRadioItem>
                      {priceOptions.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          disabled={option.count === 0 && priceParam !== option.value}
                        >
                          {option.label}
                          <DropdownMenuShortcut>{option.count}</DropdownMenuShortcut>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={`rounded-full border-gray-300 text-gray-700 h-9 px-4 font-normal flex-shrink-0 ${categoryParam ? 'bg-primary/10 border-primary text-primary' : ''}`}
                    >
                      {selectedCategoryLabel}
                      <ChevronDown size={14} className="ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel>Filtrar por categoria</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={categoryParam || 'all'} onValueChange={(value) => handleCategoryChange(value === 'all' ? '' : value)}>
                      {categoryOptions.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value || 'all-categories-mobile'}
                          value={option.value || 'all'}
                          disabled={option.count === 0 && normalizeCategoryValue(option.value) !== normalizeCategoryValue(categoryParam)}
                        >
                          {option.label}
                          <DropdownMenuShortcut>{option.count}</DropdownMenuShortcut>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="text-gray-600 font-medium">
                  {isLoading ? 'Buscando eventos...' : visibleEvents.length > 0 ? `${visibleEvents.length} eventos encontrados` : 'Nenhum evento encontrado'}
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <span className="text-sm text-gray-500">Ordenar por:</span>
                  <select
                    value={sortBy}
                    onChange={handleSortChange}
                    className="text-sm font-medium text-gray-800 bg-transparent border-none cursor-pointer focus:ring-0 outline-none"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="bg-white border-b border-gray-100 p-4 last:border-0">
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
                ) : visibleEvents.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    {visibleEvents.map((event) => (
                      <EventListItem
                        key={getStableEventKey(event)}
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
                        : 'Tente ajustar seus termos de busca ou filtros para encontrar o que procura.'}
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
