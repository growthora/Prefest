import React from 'react';
import { Loader2 } from 'lucide-react';

export function GlobalLoader() {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          Carregando...
        </p>
      </div>
    </div>
  );
}
