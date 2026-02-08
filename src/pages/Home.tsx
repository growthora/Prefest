import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MapPin, Calendar, Music, PartyPopper, Theater, ChevronRight, Briefcase, Ticket, Mic } from 'lucide-react';
import { Layout } from '@/components/Layout';
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

  useEffect(() => {
    if (!emblaApi) return;
    
    emblaApi.on("select", () => {
      setCurrentSlide(emblaApi.selectedScrollSnap());
    });
  }, [emblaApi]);

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

  const collections = [
    { icon: Music, label: "Festas e Shows" },
    { icon: PartyPopper, label: "Carnaval" },
    { icon: Theater, label: "Teatros e Espetáculos" },
    { icon: Mic, label: "Stand Up Comedy" },
    { icon: Ticket, label: "Descontos Exclusivos" },
    { icon: Briefcase, label: "Eventos Corporativos" },
  ];

  return (
    <Layout showTopBanner={true}>
      <div className="space-y-12 pb-12">
        
        {/* Hero Carousel - Sympla 3D Style */}
        <div className="w-full bg-white pt-12 pb-16 overflow-hidden">
          <div className="container mx-auto px-4">
            <Carousel 
              setApi={setEmblaApi}
              opts={{
                align: "center",
                loop: true,
                skipSnaps: false,
                dragFree: false,
              }}
              className="w-full max-w-[1200px] mx-auto"
            >
              <CarouselContent className="-ml-0 items-center h-[400px]">
                {events.slice(0, 5).map((event, index) => {
                  const isActive = index === currentSlide;
                  
                  return (
                    <CarouselItem key={event.id} className="pl-0 basis-[70%] sm:basis-[60%] md:basis-[55%] lg:basis-[50%] transition-all duration-300 ease-in-out z-0">
                      <div 
                        className={`
                          relative transition-all duration-500 transform
                          ${isActive 
                            ? 'scale-100 z-30 opacity-100 shadow-2xl translate-y-0' 
                            : 'scale-90 opacity-60 hover:opacity-100 z-10 blur-[1px] translate-y-2'
                          }
                        `}
                      >
                        <Card className="border-0 rounded-2xl overflow-hidden shadow-lg bg-transparent">
                          <CardContent className="p-0 relative aspect-[16/9] cursor-pointer">
                            <img 
                              src={event.image} 
                              alt={event.title}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
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
              
              <div className="hidden md:block pointer-events-none absolute inset-0 flex items-center justify-between px-[20%] z-40">
                 <CarouselPrevious className="pointer-events-auto h-12 w-12 border-none bg-white text-primary shadow-xl opacity-90 hover:opacity-100 transition-opacity rounded-full flex items-center justify-center translate-x-1/2">
                    <ChevronRight className="rotate-180 w-6 h-6" />
                 </CarouselPrevious>
                 <CarouselNext className="pointer-events-auto h-12 w-12 border-none bg-white text-primary shadow-xl opacity-90 hover:opacity-100 transition-opacity rounded-full flex items-center justify-center -translate-x-1/2">
                    <ChevronRight className="w-6 h-6" />
                 </CarouselNext>
              </div>
            </Carousel>

            {/* Active Slide Details (Below Carousel) */}
            <div className="mt-8 text-center max-w-2xl mx-auto transition-all duration-300">
               {events.length > 0 && events[currentSlide] && (
                 <motion.div
                   key={events[currentSlide].id}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ duration: 0.3 }}
                 >
                   {/* Dots Indicator */}
                   <div className="flex justify-center gap-2 mb-6">
                     {events.slice(0, 5).map((_, idx) => (
                       <button
                         key={idx}
                         onClick={() => emblaApi?.scrollTo(idx)}
                         className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-primary' : 'bg-gray-300 hover:bg-gray-400'}`}
                       />
                     ))}
                   </div>

                   <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 uppercase tracking-tight">
                     {events[currentSlide].title}
                   </h2>
                   <div className="flex items-center justify-center gap-4 text-gray-500 font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-gray-400" />
                        <span>{events[currentSlide].city || events[currentSlide].location} - {events[currentSlide].city ? 'BA' : 'BR'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-gray-400" />
                        <span className="capitalize">{new Date(events[currentSlide].date.split('/').reverse().join('-')).toLocaleDateString('pt-BR', { weekday: 'short' })}, {events[currentSlide].date} às {events[currentSlide].time}</span>
                      </div>
                   </div>
                 </motion.div>
               )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 space-y-16">
          
          {/* Collections */}
          <div>
            <div className="flex justify-between items-end mb-8 border-b border-gray-100 pb-4">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Explore nossas coleções</h2>
              <Button variant="link" className="text-primary font-bold hover:no-underline hover:opacity-80">Ver tudo</Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {collections.map((col, idx) => (
                <div key={idx} className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group h-32">
                  <div className="w-10 h-10 mb-3 text-gray-400 group-hover:text-primary transition-colors">
                    <col.icon size={40} strokeWidth={1.5} />
                  </div>
                  <span className="font-medium text-sm text-gray-600 group-hover:text-primary transition-colors text-center leading-tight">{col.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Featured Events Section */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Eventos em destaque</h2>
              <Link to="/explorar" className="text-primary font-bold hover:underline">Ver todos</Link>
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
              <Link to="/explorar" className="text-primary font-bold hover:underline">Ver todos</Link>
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
  );
};

export default Home;
