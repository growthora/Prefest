import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Ticket, Heart, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Event, ROUTE_PATHS } from '@/lib/index';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { eventService } from '@/services/event.service';
import { toast } from 'sonner';

interface EventCardProps {
  event: Event;
  className?: string;
  onLikeToggle?: (isLiked: boolean) => void;
}

export function EventCard({ event, className, onLikeToggle }: EventCardProps) {
  const eventLink = ROUTE_PATHS.EVENT_DETAILS.replace(':slug', event.slug || event.id);
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  useEffect(() => {
    if (user && event.id) {
      checkLikeStatus();
    }
  }, [user, event.id]);

  const checkLikeStatus = async () => {
    try {
      // Validar se ID é UUID antes de chamar o serviço para evitar erro 400 em dados mockados
      if (event.id.length === 36) { 
        const liked = await eventService.hasUserLiked(event.id, user!.id);
        setIsLiked(liked);
      }
    } catch (error) {
      // Silently fail for mock data or errors
      console.warn("Could not check like status", error);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error("Faça login para curtir este evento! ❤️");
      return;
    }

    // Validar UUID para evitar erros com dados mockados
    if (event.id.length !== 36) {
      toast.error("Este evento é demonstrativo e não pode ser curtido.");
      return;
    }

    const previousState = isLiked;
    setIsLiked(!previousState); // Optimistic

    try {
      setIsLoadingLike(true);
      const newStatus = await eventService.toggleLike(event.id, user.id);
      setIsLiked(newStatus); // Confirm state from server
      toast.success(newStatus ? "Evento favoritado! ❤️" : "Removido dos favoritos");
      if (onLikeToggle) {
        onLikeToggle(newStatus);
      }
    } catch (error) {
      setIsLiked(previousState); // Revert on error
      toast.error("Erro ao atualizar favorito");
      console.error(error);
    } finally {
      setIsLoadingLike(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const shareUrl = `${window.location.origin}/eventos/${event.slug || event.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado! 📎");
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast.error("Erro ao copiar link");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-card border border-border/50 transition-all duration-300",
        className
      )}
    >
      {/* Image Container with Overlay */}
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <img
          src={event.image}
          alt={event.title}
          className="h-full w-full object-cover transition-transform duration-700 scale-105 group-hover:scale-110 grayscale group-hover:grayscale-0 saturate-[0.6] group-hover:saturate-100 opacity-80 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-90" />
        
        {/* Floating Badges */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          <Badge className="bg-background/80 backdrop-blur-md text-foreground border-none font-medium">
            {event.category}
          </Badge>
          {event.event_type && (
            <Badge 
              variant="outline" 
              className={cn(
                "backdrop-blur-sm border-white/10",
                event.event_type === 'formal' 
                  ? "bg-blue-500/40 text-white" 
                  : "bg-pink-500/40 text-white"
              )}
            >
              {event.event_type === 'formal' ? '💼 Networking' : '🎉 Match'}
            </Badge>
          )}
          {event.tags.slice(0, 1).map((tag) => (
            <Badge key={tag} variant="outline" className="bg-black/40 backdrop-blur-sm border-white/10 text-white/80">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Actions Buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          {/* Like Button */}
          <button
            onClick={handleLike}
            className={cn(
              "p-2.5 rounded-full backdrop-blur-md transition-all duration-300",
              isLiked 
                ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" 
                : "bg-black/20 text-white hover:bg-black/40 hover:scale-110"
            )}
            title={isLiked ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Heart className={cn("w-5 h-5 transition-transform active:scale-95", isLiked && "fill-current scale-110")} />
          </button>
          
          {/* Share Button */}
          <button
            onClick={handleShare}
            className="p-2.5 rounded-full backdrop-blur-md transition-all duration-300 bg-black/20 text-white hover:bg-black/40 hover:scale-110"
            title="Compartilhar evento"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Top Info (Time) - Moved down slightly or keep if fits */}
        {/* If time is important, maybe move it? Or just keep it. 
            The previous code had it at top-4 right-4. 
            I'll move it to bottom-right of image or below Like button. 
            Let's put it at bottom-right of image section. */}
        <div className="absolute bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-mono text-xs font-bold shadow-[0_0_20px_rgba(255,0,127,0.4)]">
          {event.time}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <Calendar className="w-3 h-3 text-primary" />
            {event.date}
          </div>
          <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{event.location}</span>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-border/40">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-semibold">
              A partir de
            </span>
            <span className="text-lg font-mono font-bold text-foreground">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.price)}
            </span>
          </div>
          
          <Button
            asChild
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(255,0,127,0.3)] hover:shadow-[0_0_25px_rgba(255,0,127,0.5)] transition-all px-6"
          >
            <Link to={eventLink}>
              Comprar
              <Ticket className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

interface EventGridProps {
  events: Event[];
  className?: string;
  onLikeToggle?: (eventId: string, isLiked: boolean) => void;
}

export function EventGrid({ events, className, onLikeToggle }: EventGridProps) {
  return (
    <div 
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8",
        className
      )}
    >
      {events.map((event, index) => (
        <EventCard 
          key={event.id} 
          event={event} 
          className={index === 0 ? "md:col-span-1 lg:col-span-1" : ""}
          onLikeToggle={onLikeToggle ? (isLiked) => onLikeToggle(event.id, isLiked) : undefined} 
        />
      ))}
    </div>
  );
}

export function HorizontalEventCard({ event, className }: { event: Event; className?: string }) {
  const eventLink = ROUTE_PATHS.EVENT_DETAILS.replace(':slug', event.slug || event.id);

  return (
    <Link to={eventLink} className={cn("flex gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group border-b border-gray-100 last:border-0", className)}>
      {/* Image */}
      <div className="relative w-32 h-24 sm:w-48 sm:h-32 flex-shrink-0 rounded-lg overflow-hidden">
        <img 
          src={event.image} 
          alt={event.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-2 right-2">
           <Badge variant="secondary" className="bg-white/90 text-black text-xs font-bold backdrop-blur-sm shadow-sm">
             {event.event_type === 'paid' ? 'Ingressos' : 'Grátis'}
           </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {event.title}
        </h3>
        
        <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
             <MapPin size={14} />
             {event.location}
          </span>
          <span className="flex items-center gap-1 text-orange-600 font-medium capitalize">
             {new Date(event.date || Date.now()).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })} • {event.time}
          </span>
        </div>
      </div>
    </Link>
  );
}
