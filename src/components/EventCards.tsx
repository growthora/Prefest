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
import { getStableEventKey, removeDuplicates } from '@/utils/eventDeduplication';

interface EventCardProps {
  event: Event;
  className?: string;
  onLikeToggle?: (isLiked: boolean) => void;
}

export function EventCard({ event, className, onLikeToggle }: EventCardProps) {
  const eventLink = ROUTE_PATHS.EVENT_DETAILS.replace(':slug', event.slug || event.id);
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);

  const eventEndTimestamp = new Date((event.event_end_at || event.end_at || event.event_start_at || '') as string).getTime();
  const isEnded = !Number.isNaN(eventEndTimestamp) && Date.now() >= eventEndTimestamp;
  const normalizedCategory = (event.category || '').trim().toLowerCase();
  const displayTags = (event.tags || [])
    .map(tag => String(tag).trim())
    .filter(tag => tag.length > 0 && tag.toLowerCase() !== normalizedCategory)
    .slice(0, 1);

  useEffect(() => {
    if (!user || !event.id) return;

    const run = async () => {
      try {
        if (event.id.length === 36) {
          const liked = await eventService.hasUserLiked(event.id, user.id);
          setIsLiked(liked);
        }
      } catch (err) {
        void err;
      }
    };

    run();
  }, [user, event.id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error("Faça login para curtir este evento!");
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
      const newStatus = await eventService.toggleLike(event.id, user.id);
      setIsLiked(newStatus); // Confirm state from server
      toast.success(newStatus ? "Evento favoritado!" : "Removido dos favoritos");
      if (onLikeToggle) {
        onLikeToggle(newStatus);
      }
    } catch {
      setIsLiked(previousState); // Revert on error
      toast.error("Erro ao atualizar favorito");
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const slugOrId = encodeURIComponent(event.slug || event.id);
    const shareUrl = new URL(ROUTE_PATHS.EVENT_DETAILS.replace(':slug', slugOrId), window.location.origin).toString();
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado!");
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error("Erro ao compartilhar");
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
      <div className="relative w-full aspect-video overflow-hidden bg-gray-900">
        {/* Main Image Layer */}
        {(event.image && typeof event.image === 'string' && event.image.trim() !== '' && event.image !== 'undefined' && event.image !== 'null') ? (
          <img
            src={event.image}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover object-center z-10 transition-transform duration-700 scale-100 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <Calendar className="w-12 h-12 text-gray-600" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-90 z-20 pointer-events-none" />
        
        {/* Floating Badges */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-30">
          <Badge className="bg-background/80 backdrop-blur-md text-foreground border-none font-medium">
            {event.category}
          </Badge>
          {isEnded && (
            <Badge variant="destructive" className="bg-amber-500/80 text-white border-none">
              Encerrado
            </Badge>
          )}
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
              {event.event_type === 'formal' ? 'Networking' : 'Match'}
            </Badge>
          )}
          {displayTags.map((tag: string) => (
            <Badge key={tag} variant="outline" className="bg-black/40 backdrop-blur-sm border-white/10 text-white/80">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Actions Buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
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
        <div className="absolute bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-full tabular-nums text-xs font-bold shadow-[0_0_20px_rgba(255,0,127,0.4)] z-30">
          {event.time}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold tabular-nums text-muted-foreground uppercase tracking-widest">
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
            {event.display_price_label ? (
              <span className="text-sm font-semibold text-foreground">
                {event.display_price_label}
              </span>
            ) : (
              event.is_free_event ? (
                <span className="text-lg font-bold tabular-nums text-foreground">
                  Evento gratuito
                </span>
              ) : event.display_price_value !== undefined ? (
                <>
                  <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-semibold">
                    A partir de
                  </span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.display_price_value)}
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">Consulte os lotes</span>
              )
            )}
          </div>
          
          {isEnded ? (
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(255,0,127,0.3)] hover:shadow-[0_0_25px_rgba(255,0,127,0.5)] transition-all px-6"
              disabled
            >
              <span className="flex items-center">
                Indisponível
                <Ticket className="ml-2 w-4 h-4" />
              </span>
            </Button>
          ) : (
            <Button
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(255,0,127,0.3)] hover:shadow-[0_0_25px_rgba(255,0,127,0.5)] transition-all px-6"
            >
              <Link to={eventLink}>
                Comprar
                <Ticket className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          )}
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
  const uniqueEvents = removeDuplicates(events);

  return (
    <div 
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8",
        className
      )}
    >
      {uniqueEvents.map((event, index) => (
        <EventCard 
          key={getStableEventKey(event)}
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

  // Formatar data estilo Sympla: "Sábado, 28 de Mar às 17:00"
  // Se a data vier como string "DD/MM/YYYY", precisamos tratar, mas assumindo ISO ou Date object
  // O frontend mock converte para string "DD/MM/YYYY", então vamos tentar parsear ou usar o que tem
  
  // Nota: O event.date no frontend já vem formatado como string locale pt-BR em ExploreEvents. 
  // Mas aqui vamos tentar reformatar se possível ou usar como está.
  // Idealmente, deveríamos receber o objeto Date ou ISO string. 
  // Vou assumir que o display já está próximo, mas vou ajustar o estilo visual.
  
  return (
    <Link 
      to={eventLink} 
      className={cn(
        "flex gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 group border border-transparent hover:border-gray-100", 
        className
      )}
    >
      {/* Image - Thumbnail Retangular */}
      <div className="relative w-[120px] h-[90px] sm:w-[160px] sm:h-[100px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {event.image && event.image.trim() !== '' && event.image !== 'undefined' && event.image !== 'null' ? (
          <img 
            src={event.image} 
            alt={event.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <h3 className="font-bold text-base sm:text-lg text-gray-900 leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">
          {event.title}
        </h3>
        
        <div className="flex flex-col gap-0.5 text-sm text-gray-500">
          <span className="truncate">
             {event.location}
             {event.city && ` - ${event.city}`}
             {event.state && `, ${event.state}`}
          </span>
          <span className="text-gray-500 font-medium capitalize flex items-center gap-1">
             {/* Ícone opcional, Sympla usa texto puro ou ícones muito discretos */}
             {event.date} • {event.time}
          </span>
        </div>
      </div>
    </Link>
  );
}
