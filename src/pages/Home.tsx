import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Calendar, Music, PartyPopper, Theater, ChevronRight, Briefcase, Ticket, Mic } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EventGrid, HorizontalEventCard } from '@/components/EventCards';
import { eventService, type Event as SupabaseEvent } from '@/services/event.service';
import { type Event as FrontendEvent } from '@/lib/index';
import { IMAGES } from '@/assets/images';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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
  
  useEffect(() => {
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

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
    <Layout showTopBanner={true} fullWidth={true}>
      <div className="space-y-12 pb-12">
        
        {/* Hero Carousel - Sympla 3D Style */}
        <div className="w-full bg-white pt-8 pb-12 overflow-hidden">
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
              <CarouselContent className="-ml-0 items-center h-[350px] md:h-[400px]">
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
          
          {/* Collections */}
          <div>
            <div className="flex justify-between items-end mb-8 border-b border-gray-100 pb-4">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Explore nossas coleções</h2>
              <Button variant="link" className="text-primary font-bold hover:no-underline hover:opacity-80">Ver tudo</Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {collections.map((col, idx) => (
                <Link key={idx} to={`/colecao/${col.slug}`}>
                  <div className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group h-32">
                    <div className="w-10 h-10 mb-3 text-gray-400 group-hover:text-primary transition-colors">
                      <col.icon size={40} strokeWidth={1.5} />
                    </div>
                    <span className="font-medium text-sm text-gray-600 group-hover:text-primary transition-colors text-center leading-tight">{col.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Featured Events Section */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Eventos em destaque</h2>
              <Link to="/colecao/destaques" className="text-primary font-bold hover:underline">Ver todos</Link>
            </div>
            
            {isLoading ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {[1, 2, 3, 4].map((i) => (
                   <div key={i} className="space-y-3">
                     <Skeleton className="h-[300px] w-full rounded-xl" />
                     <Skeleton className="h-4 w-[250px]" />
                     <Skeleton className="h-4 w-[200px]" />
                   </div>
                 ))}
               </div>
            ) : (
               <EventGrid events={events.slice(0, 4)} />
            )}
          </div>

          {/* Events Near You / More Events */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Próximos eventos</h2>
              <Link to="/colecao/proximos-eventos" className="text-primary font-bold hover:underline">Ver todos</Link>
            </div>
            
            {isLoading ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {[1, 2, 3, 4].map((i) => (
                   <div key={i} className="space-y-3">
                     <Skeleton className="h-[300px] w-full rounded-xl" />
                     <Skeleton className="h-4 w-[250px]" />
                     <Skeleton className="h-4 w-[200px]" />
                   </div>
                 ))}
               </div>
            ) : (
               <EventGrid events={events.slice(4, 8)} />
            )}
          </div>
        </div>
      </div>
    </Layout>
    </motion.div>
  );
};

export default Home;
