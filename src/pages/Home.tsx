import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Calendar, Music, PartyPopper, Theater, ChevronRight, Briefcase, Ticket, Mic } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { HeroCarousel } from '@/components/HeroCarousel';
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

const Home = () => {
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadEvents();
  }, []);

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
        <HeroCarousel events={events} />

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
          <div className="relative group">
            <div className="flex items-center justify-between mb-6 px-1">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Eventos em destaque</h2>
              <Link to="/colecao/destaques" className="text-primary font-bold hover:underline flex items-center gap-1">
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
                          <Link to={`/eventos/${event.slug || event.id}`} className="block h-full">
                            <div className="relative overflow-hidden rounded-2xl mb-3 bg-gray-900 shadow-lg">
                              {/* Main Image Layer */}
                              <img 
                                src={event.image} 
                                alt={event.title}
                                className="w-full h-auto object-contain z-10 transition-transform duration-500 group-hover/card:scale-105"
                              />
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20 opacity-90" />
                              
                              <div className="absolute top-3 left-3">
                                <Badge className="bg-white/90 text-black hover:bg-white font-bold backdrop-blur-md shadow-sm">
                                  {event.category}
                                </Badge>
                              </div>

                              <div className="absolute bottom-3 left-3 right-3 text-white">
                                <p className="text-xs font-bold uppercase tracking-wider text-white mb-1">
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
              <Link to="/colecao/proximos-eventos" className="text-primary font-bold hover:underline flex items-center gap-1">
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
                          <Link to={`/eventos/${event.slug || event.id}`} className="block h-full">
                            <div className="relative overflow-hidden rounded-2xl mb-3 bg-gray-900 shadow-lg">
                              {/* Main Image Layer */}
                              <img 
                                src={event.image} 
                                alt={event.title}
                                className="w-full h-auto object-contain z-10 transition-transform duration-500 group-hover/card:scale-105"
                              />
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20 opacity-90" />
                              
                              <div className="absolute top-3 left-3">
                                <Badge className="bg-white/90 text-black hover:bg-white font-bold backdrop-blur-md shadow-sm">
                                  {event.category}
                                </Badge>
                              </div>

                              <div className="absolute bottom-3 left-3 right-3 text-white">
                                <p className="text-xs font-bold uppercase tracking-wider text-white mb-1">
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
        </div>
      </div>
    </Layout>
    </motion.div>
  );
};

export default Home;
