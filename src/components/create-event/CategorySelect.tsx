import React, { useEffect, useState } from 'react';
import { eventService, Category } from '@/services/event.service';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Music, Theater, Mic, Map, Utensils, Ticket, Trophy, Gamepad, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategorySelectProps {
  value: string;
  onChange: (categoryId: string, categoryName: string) => void;
  error?: string;
}

const ICONS: Record<string, React.ReactNode> = {
  'festas-e-shows': <Music className="w-4 h-4" />,
  'teatros-e-espetaculos': <Theater className="w-4 h-4" />,
  'congressos-e-palestras': <Mic className="w-4 h-4" />,
  'passeios-e-tours': <Map className="w-4 h-4" />,
  'gastronomia': <Utensils className="w-4 h-4" />,
  'gratis': <Ticket className="w-4 h-4" />,
  'esportes': <Trophy className="w-4 h-4" />,
  'geek-e-tecnologia': <Gamepad className="w-4 h-4" />,
  'default': <Star className="w-4 h-4" />
};

export function CategorySelect({ value, onChange, error }: CategorySelectProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await eventService.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {categories.map((category) => {
          const isSelected = value === category.id;
          const icon = ICONS[category.slug] || ICONS.default;
          
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onChange(category.id, category.name)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200",
                isSelected 
                  ? "bg-primary text-primary-foreground border-primary shadow-md transform scale-105" 
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:bg-gray-50"
              )}
            >
              {icon}
              <span className="font-medium text-sm">{category.name}</span>
              {isSelected && <Check className="w-3 h-3 ml-1" />}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
