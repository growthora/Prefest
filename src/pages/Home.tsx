import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Music, PartyPopper, Theater, ChevronRight, Briefcase, Ticket, Mic } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { eventService, type Event as SupabaseEvent } from '@/services/event.service';
import { type Event as FrontendEvent, buildCollectionPath, buildEventDetailsPath, ROUTE_PATHS } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

const Home = () => {
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  
  useEffect(() => {
    const title = 'Compre seu ingresso e conheça quem vai estar na festa | Pré-fest';
    const description =
      'Compre ingressos e descubra quem vai estar na festa antes de chegar. Dê match antes do evento, chegue acompanhado e viva experiências melhores.';

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

  const [currentSlide, setCurrentSlide] = useState(0);
  const [emblaApi, setEmblaApi] = useState<any>();
  const [isCarouselReady, setIsCarouselReady] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    
    // Garantir que o carrossel inicie pronto e sem animação no primeiro frame
    const onInit = () => {
      setIsCarouselReady(true);
    };

    if (emblaApi.rootNode()) {
      onInit();
    }
    
    emblaApi.on("init", onInit);
    emblaApi.on("reInit", onInit);
    
    emblaApi.on("select", () => {
      setCurrentSlide(emblaApi.selectedScrollSnap());
    });
    
    return () => {
      emblaApi.off("init", onInit);
      emblaApi.off("reInit", onInit);
    };
  }, [emblaApi]);

  const loadEvents = async () => {
    try {
      setLoadError(false);
      // Force at least 1.5s loading for smooth UX
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));
      const dataPromise = eventService.getAllEvents();
      
      const [_, data] = await Promise.all([minLoadTime, dataPromise]);
      
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
      
      // Preload carousel images to prevent layout shift
      const imagesToPreload = convertedEvents.slice(0, 5).map(e => e.image);
      await Promise.all(imagesToPreload.map(src => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));
      
      setEvents(convertedEvents);
    } catch (err) {
      console.error('❌ Erro ao carregar eventos:', err);
      setEvents([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const collections = [
    { icon: Music, label: "Festas e Shows", slug: "festas-e-shows" },
    { icon: PartyPopper, label: "Carnaval", slug: "carnaval" },
    { icon: Theater, label: "Teatros e Espetáculos", slug: "teatros-e-espetaculos" },
    { icon: Mic, label: "Stand Up Comedy", slug: "stand-up-comedy" },
    { icon: Ticket, label: "Descontos Exclusivos", slug: "descontos-exclusivos" },
    { icon: Briefcase, label: "Eventos Corporativos", slug: "eventos-corporativos" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
    <Layout showTopBanner={true} fullWidth={true}>
      <div className="space-y-12 pb-12">
        <section className="bg-gradient-to-b from-white via-white to-slate-50 border-b border-slate-100">
          <div className="container max-w-7xl mx-auto px-4 py-10 md:py-16">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold text-primary border border-primary/10">
                  <span>Ingressos + Match antes da festa</span>
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
                  Compre seu ingresso e conheça quem vai estar na festa.
                </h1>
                <p className="text-base md:text-lg text-slate-600 max-w-xl">
                  Dê match antes do evento, combine encontros e chegue acompanhado. Tudo no mesmo lugar onde você compra o ingresso.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Button
                    size="lg"
                    className="px-8 text-base font-semibold"
                    asChild
                  >
                    <Link to={ROUTE_PATHS.EVENTS}>
                      Ver festas disponíveis
                    </Link>
                  </Button>
                  <p className="text-xs text-slate-500">
                    Sem cadastro obrigatório para começar a explorar os eventos.
                  </p>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="relative max-w-md ml-auto">
                  <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full opacity-70" />
                  <div className="relative rounded-3xl border border-slate-100 bg-white shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium text-slate-600">Eventos ao vivo</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {events.length > 0 ? `${events.length} festas encontradas` : 'Carregando festas...'}
                      </span>
                    </div>
                    <div className="p-4 space-y-3 max-h-72 overflow-hidden">
                      {isLoading && (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                              <Skeleton className="h-12 w-12 rounded-xl" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-3 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!isLoading && events.slice(0, 3).map((event) => (
                        <div key={event.id} className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                            <img
                              src={event.image}
                              alt={event.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                              {event.title}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span className="line-clamp-1">
                                {event.city || event.location}
                              </span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-slate-500">
                              {event.date}
                            </p>
                            <p className="text-[11px] font-semibold text-primary">
                              {event.price === 0
                                ? 'Grátis'
                                : new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(event.price)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {!isLoading && events.length === 0 && !loadError && (
                        <p className="text-xs text-slate-500">
                          Assim que novos eventos forem publicados, eles aparecerão aqui.
                        </p>
                      )}
                      {loadError && (
                        <p className="text-xs text-red-500">
                          Não foi possível carregar os eventos agora. Tente novamente em instantes.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="w-full bg-white pt-4 pb-8 overflow-hidden">
          <div className="container max-w-7xl mx-auto px-4 relative">
            <Carousel  
              setApi={setEmblaApi}
              opts={{
                align: "center",
                loop: true,
                skipSnaps: false,
                dragFree: false,
                startIndex: 0,
                watchDrag: isCarouselReady, // Evita interação antes de estar pronto
              }}
              className={`w-full mx-auto ${isCarouselReady ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
            >
              <CarouselContent className="-ml-0 items-center h-[260px] sm:h-[320px] md:h-[380px]">
                {events.slice(0, 5).map((event, index) => {
                  const isActive = index === currentSlide;
                  
                  return (
                    <CarouselItem key={event.id} className={`pl-0 basis-[85%] sm:basis-[65%] md:basis-[55%] lg:basis-[45%] ${isCarouselReady ? 'transition-all duration-500' : 'transition-none'} ease-in-out z-0 py-4`}>
                      <div 
                        className={`
                          relative ${isCarouselReady ? 'transition-all duration-500' : 'transition-none'} ease-[cubic-bezier(0.25,0.1,0.25,1)] transform
                          ${isActive 
                            ? 'scale-100 z-30 opacity-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] translate-y-0' 
                            : 'scale-90 opacity-40 hover:opacity-60 z-10 translate-y-2 grayscale-[30%]'
                          }
                        `}
                      >
                        <Card className="border-0 rounded-xl overflow-hidden shadow-none bg-transparent">
                          <CardContent className="p-0 relative aspect-[16/9] cursor-pointer">
                            <img 
                              src={event.image} 
                              alt={event.title}
                              className="absolute inset-0 w-full h-full object-cover rounded-xl"
                            />
                            {/* Overlay sutil para hover */}
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-300" />
                          </CardContent>
                        </Card>
                      </div>
                    </CarouselItem>
                  );
                })}
                {events.length === 0 && (
                  <CarouselItem className="basis-full">
                    <Skeleton className="w-full aspect-[2/1] rounded-2xl" />
                  </CarouselItem>
                )}
              </CarouselContent>
              
              {/* Navigation Arrows - Centered Vertically relative to Carousel */}
              <div className="hidden md:flex pointer-events-none absolute top-1/2 -translate-y-1/2 left-0 right-0 items-center justify-between w-full px-2 lg:px-8 z-40 h-0">
                 <CarouselPrevious className="pointer-events-auto h-12 w-12 border border-gray-100 bg-white/90 text-gray-700 shadow-lg hover:bg-white hover:scale-105 transition-all rounded-full flex items-center justify-center -translate-y-12">
                    <ChevronRight className="rotate-180 w-6 h-6" />
                 </CarouselPrevious>
                 <CarouselNext className="pointer-events-auto h-12 w-12 border border-gray-100 bg-white/90 text-gray-700 shadow-lg hover:bg-white hover:scale-105 transition-all rounded-full flex items-center justify-center -translate-y-12">
                    <ChevronRight className="w-6 h-6" />
                 </CarouselNext>
              </div>
            </Carousel>

            {/* Active Slide Details (Below Carousel) */}
            <div className="mt-6 text-center max-w-4xl mx-auto transition-all duration-300 px-4">
               {events.length > 0 && events[currentSlide] && (
                 <motion.div
                   key={events[currentSlide].id}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ duration: 0.4, ease: "easeOut" }}
                 >
                   {/* Dots Indicator */}
                   <div className="flex justify-center gap-2 mb-4">
                     {events.slice(0, 5).map((_, idx) => (
                       <button
                         key={idx}
                         onClick={() => emblaApi?.scrollTo(idx)}
                         className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-primary w-6' : 'bg-gray-200 hover:bg-gray-300'}`}
                         aria-label={`Ir para slide ${idx + 1}`}
                       />
                     ))}
                   </div>

                   <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 uppercase tracking-tight line-clamp-2">
                     {events[currentSlide].title}
                   </h2>
                   
                   <div className="flex flex-wrap items-center justify-center gap-4 text-gray-600 font-medium text-sm md:text-base">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={16} className="text-gray-400" />
                        <span>{events[currentSlide].city || events[currentSlide].location}</span>
                        {events[currentSlide].city && <span className="text-gray-400">|</span>}
                        {events[currentSlide].city && <span>BA</span>}
                      </div>
                      <div className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full" />
                      <div className="flex items-center gap-1.5">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="capitalize">
                          {new Date(events[currentSlide].date.split('/').reverse().join('-')).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}, {events[currentSlide].date}
                        </span>
                        <span className="text-gray-400">às</span>
                        <span>{events[currentSlide].time}</span>
                      </div>
                   </div>
                 </motion.div>
               )}
            </div>
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 space-y-16">
          {collections.length > 0 && (
          <div>
            <div className="flex justify-between items-end mb-8 border-b border-gray-100 pb-4">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Explore nossas coleções</h2>
              <Button variant="link" className="text-primary font-bold hover:no-underline hover:opacity-80">Ver tudo</Button>
            </div>
            
            <Carousel
              opts={{
                align: "start",
                dragFree: true,
                containScroll: "trimSnaps",
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-3 pb-2">
                {collections.map((col, idx) => (
                  <CarouselItem
                    key={idx}
                    className="pl-3 basis-[48%] sm:basis-[32%] lg:basis-[16%]"
                  >
                    <Link to={buildCollectionPath(col.slug)}>
                      <div className="flex flex-col items-center justify-center p-5 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group h-32">
                        <div className="w-10 h-10 mb-3 text-gray-400 group-hover:text-primary transition-colors">
                          <col.icon size={32} strokeWidth={1.5} />
                        </div>
                        <span className="font-medium text-xs sm:text-sm text-gray-600 group-hover:text-primary transition-colors text-center leading-tight">
                          {col.label}
                        </span>
                      </div>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
          )}

          {/* Featured Events Section */}
          <div className="relative group">
            <div className="flex items-center justify-between mb-6 px-1">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Eventos em destaque</h2>
              <Link to={buildCollectionPath("destaques")} className="text-primary font-bold hover:underline flex items-center gap-1">
                Ver todos <ChevronRight size={16} />
              </Link>
            </div>
            
            {isLoading ? (
               <div className="flex gap-6 overflow-hidden">
                 {[1, 2, 3, 4].map((i) => (
                   <div key={i} className="min-w-[280px] md:min-w-[320px] space-y-3">
                     <Skeleton className="h-[300px] w-full rounded-2xl" />
                     <Skeleton className="h-4 w-[200px]" />
                     <Skeleton className="h-4 w-[150px]" />
                   </div>
                 ))}
               </div>
            ) : (
              <Carousel
                opts={{
                  align: "start",
                  dragFree: true,
                  containScroll: "trimSnaps",
                  slidesToScroll: "auto",
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4 pb-4">
                  {events.slice(0, 8).map((event) => (
                    <CarouselItem key={event.id} className="pl-4 basis-[280px] md:basis-[320px] lg:basis-[350px]">
                      <div className="h-full transform transition-transform hover:-translate-y-1 duration-300">
                        <div className="relative group/card h-full">
                          <Link to={buildEventDetailsPath(event.slug || event.id)} className="block h-full">
                            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl mb-3">
                              <img 
                                src={event.image} 
                                alt={event.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                              
                              <div className="absolute top-3 left-3">
                                <Badge className="bg-white/90 text-black hover:bg-white font-bold backdrop-blur-md shadow-sm">
                                  {event.category}
                                </Badge>
                              </div>

                              <div className="absolute bottom-3 left-3 right-3 text-white">
                                <p className="text-xs font-bold uppercase tracking-wider text-primary-foreground/90 mb-1">
                                  {new Date(event.date.split('/').reverse().join('-')).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')} • {event.time}
                                </p>
                                <h3 className="font-bold text-lg leading-tight line-clamp-2 text-shadow-sm">
                                  {event.title}
                                </h3>
                              </div>
                            </div>
                            
                            <div className="px-1">
                              <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                                <MapPin size={14} />
                                <span className="truncate">{event.location}</span>
                              </div>
                              <div className="font-bold text-lg text-primary">
                                {event.price === 0 ? 'Grátis' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.price)}
                              </div>
                            </div>
                          </Link>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {/* Navigation Buttons (Visible on hover/desktop) */}
                <div className="hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <CarouselPrevious className="left-0 -translate-x-1/2 h-12 w-12 border-none bg-white/90 shadow-lg hover:bg-white hover:scale-110 text-gray-800" />
                  <CarouselNext className="right-0 translate-x-1/2 h-12 w-12 border-none bg-white/90 shadow-lg hover:bg-white hover:scale-110 text-gray-800" />
                </div>
              </Carousel>
            )}
          </div>

          {/* Events Near You / More Events */}
          <div className="relative group">
            <div className="flex items-center justify-between mb-6 px-1">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Próximos eventos</h2>
              <Link to={buildCollectionPath("proximos-eventos")} className="text-primary font-bold hover:underline flex items-center gap-1">
                Ver todos <ChevronRight size={16} />
              </Link>
            </div>
            
            {isLoading ? (
               <div className="flex gap-6 overflow-hidden">
                 {[1, 2, 3, 4].map((i) => (
                   <div key={i} className="min-w-[280px] md:min-w-[320px] space-y-3">
                     <Skeleton className="h-[300px] w-full rounded-2xl" />
                     <Skeleton className="h-4 w-[200px]" />
                     <Skeleton className="h-4 w-[150px]" />
                   </div>
                 ))}
               </div>
            ) : (
              <Carousel
                opts={{
                  align: "start",
                  dragFree: true,
                  containScroll: "trimSnaps",
                  slidesToScroll: "auto",
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4 pb-4">
                  {events.slice(4, 12).map((event) => (
                    <CarouselItem key={event.id} className="pl-4 basis-[280px] md:basis-[320px] lg:basis-[350px]">
                       {/* Reusing the same card structure for consistency */}
                       <div className="h-full transform transition-transform hover:-translate-y-1 duration-300">
                        <div className="relative group/card h-full">
                          <Link to={buildEventDetailsPath(event.slug || event.id)} className="block h-full">
                            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl mb-3">
                              <img 
                                src={event.image} 
                                alt={event.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                              
                              <div className="absolute top-3 left-3">
                                <Badge className="bg-white/90 text-black hover:bg-white font-bold backdrop-blur-md shadow-sm">
                                  {event.category}
                                </Badge>
                              </div>

                              <div className="absolute bottom-3 left-3 right-3 text-white">
                                <p className="text-xs font-bold uppercase tracking-wider text-primary-foreground/90 mb-1">
                                  {new Date(event.date.split('/').reverse().join('-')).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')} • {event.time}
                                </p>
                                <h3 className="font-bold text-lg leading-tight line-clamp-2 text-shadow-sm">
                                  {event.title}
                                </h3>
                              </div>
                            </div>
                            
                            <div className="px-1">
                              <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                                <MapPin size={14} />
                                <span className="truncate">{event.location}</span>
                              </div>
                              <div className="font-bold text-lg text-primary">
                                {event.price === 0 ? 'Grátis' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.price)}
                              </div>
                            </div>
                          </Link>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                 {/* Navigation Buttons (Visible on hover/desktop) */}
                 <div className="hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <CarouselPrevious className="left-0 -translate-x-1/2 h-12 w-12 border-none bg-white/90 shadow-lg hover:bg-white hover:scale-110 text-gray-800" />
                  <CarouselNext className="right-0 translate-x-1/2 h-12 w-12 border-none bg-white/90 shadow-lg hover:bg-white hover:scale-110 text-gray-800" />
                </div>
              </Carousel>
            )}
          </div>
          
          {!isLoading && loadError && events.length === 0 && (
            <div className="mt-8 text-center text-sm text-gray-500">
              Não foi possível carregar os eventos no momento. Tente novamente em instantes.
            </div>
          )}
        </div>
      </div>
    </Layout>
    </motion.div>
  );
};

export default Home;
