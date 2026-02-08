import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ROUTE_PATHS } from "@/lib/index";
import { ErrorBoundary } from "@/components/ErrorBoundary";

console.log('📦 App.test.tsx carregado');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const TestApp = () => {
  console.log('🧪 TestApp renderizando...');
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" richColors />
          <HashRouter>
            <Routes>
              <Route path="/" element={
                <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
                  <h1>✅ App Funcionando!</h1>
                  <p>O problema estava no AuthContext ou em algum componente específico.</p>
                  <p>Localização: {window.location.href}</p>
                  <p>Hash: {window.location.hash}</p>
                </div>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default TestApp;
