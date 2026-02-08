import React from 'react';
import { Loader2 } from 'lucide-react';

export function DashboardLoader() {
  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          Carregando informações...
        </p>
      </div>
    </div>
  );
}
