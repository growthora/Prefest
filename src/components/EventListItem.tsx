import React from 'react';
import { Link } from 'react-router-dom';
import { Event, ROUTE_PATHS } from '@/lib/index';
import { cn } from '@/lib/utils';

interface EventListItemProps {
  event: Event;
  className?: string;
}

export function EventListItem({ event, className }: EventListItemProps) {
  const eventLink = ROUTE_PATHS.EVENT_DETAILS.replace(':slug', event.slug || event.id);

  return (
    <Link 
      to={eventLink} 
      className={cn(
        "flex gap-4 p-4 hover:bg-gray-50 transition-all duration-200 group border-b border-gray-100 last:border-0", 
        className
      )}
    >
      {/* Thumbnail - Retangular Compacta */}
      <div className="relative w-[120px] h-[90px] sm:w-[140px] sm:h-[90px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        <img 
          src={event.image} 
          alt={event.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col justify-center min-w-0 py-1">
        {/* Título */}
        <h3 className="font-bold text-base sm:text-lg text-gray-900 leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">
          {event.title}
        </h3>
        
        {/* Informações Secundárias */}
        <div className="flex flex-col gap-0.5 text-sm text-gray-500">
          {/* Localização */}
          <span className="truncate">
             {event.location}
             {event.city && ` - ${event.city}`}
             {event.state && `, ${event.state}`}
          </span>
          
          {/* Data e Hora */}
          <span className="text-gray-500 font-medium capitalize flex items-center gap-1">
             {event.date} • {event.time}
          </span>
        </div>
      </div>
    </Link>
  );
}
