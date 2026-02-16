import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { type Event } from '@/lib/index';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface HeroCarouselProps {
  events: Event[];
}

export const HeroCarousel = ({ events }: HeroCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-play logic
  useEffect(() => {
    if (!isAutoPlaying || events.length === 0) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % events.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying, events.length]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % events.length);
    setIsAutoPlaying(false);
  }, [events.length]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + events.length) % events.length);
    setIsAutoPlaying(false);
  }, [events.length]);

  const handleDotClick = (index: number) => {
    setActiveIndex(index);
    setIsAutoPlaying(false);
  };

  if (!events.length) return null;

  // Determine which items to show. We want a circular list effect.
  // We'll render all items but only style the visible ones around the active index specially.
  // Actually, for a true 3D effect with many items, rendering all might be heavy if N is large.
  // But for < 20 items, it's fine.
  
  const getCardStyle = (index: number) => {
    // Calculate distance from active index, handling wrapping
    const total = events.length;
    let offset = (index - activeIndex);
    
    // Adjust offset for wrapping (shortest path)
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;

    const absOffset = Math.abs(offset);
    const isActive = offset === 0;

    // Visibility cutoff
    if (absOffset > 2) {
      return {
        x: offset > 0 ? '100%' : '-100%',
        scale: 0.5,
        opacity: 0,
        zIndex: 0,
        display: 'none' 
      };
    }

    // Config for "Cover Flow" style
    // Center (0): z=30, scale=1, x=0
    // Side (1): z=20, scale=0.85, x= +/- 55%
    // Far Side (2): z=10, scale=0.7, x= +/- 90%

    const spacing = 60; // Percent spacing
    let xStr = '0%';
    let scale = 1;
    let opacity = 1;
    let zIndex = 30;

    if (offset === 0) {
      xStr = '0%';
      scale = 1;
      opacity = 1;
      zIndex = 30;
    } else if (offset === 1) {
      xStr = '55%';
      scale = 0.85;
      opacity = 0.7;
      zIndex = 20;
    } else if (offset === -1) {
      xStr = '-55%';
      scale = 0.85;
      opacity = 0.7;
      zIndex = 20;
    } else if (offset === 2) {
      xStr = '90%';
      scale = 0.7;
      opacity = 0.4;
      zIndex = 10;
    } else if (offset === -2) {
      xStr = '-90%';
      scale = 0.7;
      opacity = 0.4;
      zIndex = 10;
    }

    return {
      x: xStr,
      scale,
      opacity,
      zIndex,
      display: 'block'
    };
  };

  return (
    <div className="relative w-full py-8 md:py-12 overflow-hidden bg-white">
      <div className="container max-w-7xl mx-auto px-4">
        {/* Carousel Container */}
        <div className="relative h-[250px] sm:h-[350px] md:h-[450px] flex items-center justify-center perspective-1000">
          <AnimatePresence initial={false} mode='popLayout'>
            {events.map((event, index) => {
              const style = getCardStyle(index);
              
              // Only render if visible (display !== 'none') to save resources? 
              // Framer motion handles layout animations better if we render.
              // We'll use the style object directly.
              
              // Helper to calculate wrapping index for key or logic if needed, but 'index' is stable here.
              
              return (
                <motion.div
                  key={event.id}
                  initial={false}
                  animate={{
                    x: style.x,
                    scale: style.scale,
                    opacity: style.opacity,
                    zIndex: style.zIndex,
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [0.25, 0.1, 0.25, 1.0], // cubic-bezier for smooth motion
                  }}
                  className="absolute w-[80%] sm:w-[60%] md:w-[50%] lg:w-[45%] aspect-[16/9] rounded-2xl shadow-2xl origin-center cursor-pointer"
                  style={{
                    display: style.display,
                  }}
                  onClick={() => {
                    if (style.zIndex < 30) {
                      setActiveIndex(index);
                      setIsAutoPlaying(false);
                    }
                  }}
                >
                  <Link to={`/eventos/${event.slug}`} className="block w-full h-full relative group overflow-hidden rounded-2xl">
                    <img
                      src={event.image}
                      alt={event.title}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                    
                    {/* Gradient Overlay for Text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl flex flex-col justify-end p-6">
                      <h3 className="text-white text-xl md:text-2xl font-bold mb-1 truncate">{event.title}</h3>
                      <p className="text-white/80 text-sm md:text-base">{event.date} • {event.location}</p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <button
            onClick={handlePrev}
            className="absolute left-4 md:left-8 z-40 p-3 rounded-full bg-white/90 shadow-lg hover:bg-white text-primary transition-all hover:scale-110 focus:outline-none"
            aria-label="Previous slide"
          >
            <ChevronLeft size={24} />
          </button>
          
          <button
            onClick={handleNext}
            className="absolute right-4 md:right-8 z-40 p-3 rounded-full bg-white/90 shadow-lg hover:bg-white text-primary transition-all hover:scale-110 focus:outline-none"
            aria-label="Next slide"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Indicators */}
        <div className="flex justify-center gap-2 mt-6 md:mt-8">
          {events.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleDotClick(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                idx === activeIndex 
                  ? "bg-primary w-6" 
                  : "bg-gray-300 hover:bg-gray-400"
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
