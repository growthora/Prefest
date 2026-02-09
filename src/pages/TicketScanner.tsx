import React, { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Scan, 
  RotateCcw,
  ArrowLeft,
  Keyboard,
  Camera,
  Calendar,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { eventService, Event } from '@/services/event.service';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { ROUTE_PATHS } from '@/lib/index';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ValidationResult {
  success: boolean;
  message: string;
  code: string;
  participant_id?: string;
  ticket_type_id?: string;
  used_at?: string;
}

interface ScanHistoryItem {
  id: string;
  timestamp: Date;
  result: ValidationResult;
  ticketId: string;
}

export default function TicketScanner() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  // State for Event Selection
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Scanner State
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);

  // Check permissions
  useEffect(() => {
    if (!profile) return;
    
    const hasPermission = 
      profile.roles?.includes('ORGANIZER') || 
      profile.roles?.includes('ADMIN') || 
      profile.roles?.includes('STAFF') ||
      profile.role === 'admin' ||
      profile.role === 'equipe';

    if (!hasPermission) {
      toast.error('Acesso negado. Apenas organizadores e equipe podem acessar o scanner.');
      navigate(ROUTE_PATHS.HOME);
    }
  }, [profile, navigate]);

  // Load Organizer Events
  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user]);

  const loadEvents = async () => {
    try {
      setLoadingEvents(true);
      const data = await eventService.getOrganizerEvents(user!.id);
      setEvents(data);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Erro ao carregar eventos do organizador');
    } finally {
      setLoadingEvents(false);
    }
  };

  // Resume scanning after 3 seconds of success/error display
  useEffect(() => {
    if (!scanning && lastResult) {
      const timer = setTimeout(() => {
        setScanning(true);
        setLastResult(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [scanning, lastResult]);

  const handleScan = async (detectedCodes: any[]) => {
    if (!scanning || processing || !user || !selectedEvent) return;
    
    if (detectedCodes && detectedCodes.length > 0) {
      const rawValue = detectedCodes[0].rawValue;
      await processTicket(rawValue);
    }
  };

  const processTicket = async (rawValue: string) => {
    if (!selectedEvent) return;

    setProcessing(true);
    setScanning(false);
    
    // Normalize input
    const cleanCode = rawValue.trim();

    try {
      // 1. Try to parse as JSON (Legacy)
      let payload;
      let isJson = false;
      try {
        if (cleanCode.startsWith('{')) {
          payload = JSON.parse(cleanCode);
          isJson = true;
        }
      } catch (e) {
        // Not JSON
      }

      if (isJson && payload) {
        if (!payload.t || !payload.e || !payload.k) {
          throw new Error('QR Code incompleto');
        }

        // Backend Validation: Passing selectedEvent.id as the expected event context
        const result = await eventService.validateTicket(
          payload.t,
          selectedEvent.id, // Enforce validation against SELECTED event
          payload.k,
          user!.id
        );

        setLastResult(result);
        addToHistory(result, payload.t);
        
        if (result.success) {
          // Play success sound if needed (browser policy might block)
        }
      } else {
        // 2. Simple Code Validation (New format: PF-XXXX-XXXX)
        const normalizedCode = cleanCode.toUpperCase();
        
        // Regex validation for format PF-XXXX-XXXX
        const codeRegex = /^PF-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        if (!codeRegex.test(normalizedCode)) {
          const errorResult = {
            success: false,
            message: `Formato de código inválido: ${normalizedCode}`,
            code: 'INVALID_FORMAT'
          };
          setLastResult(errorResult);
          addToHistory(errorResult, normalizedCode);
          setProcessing(false);
          return;
        }

        console.log('Validating simple code:', normalizedCode);

        const result = await eventService.validateTicketScan(
          normalizedCode,
          selectedEvent.id,
          user!.id
        );

        setLastResult(result);
        addToHistory(result, normalizedCode);
        
        if (result.success) {
          // Play success sound
        }
      }

    } catch (error: any) {
      console.error('Validation error:', error);
      const errorResult = {
        success: false,
        message: error.message || 'Erro na validação',
        code: 'ERROR'
      };
      setLastResult(errorResult);
      addToHistory(errorResult, 'unknown');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualCode || manualCode.length < 6 || !user || !selectedEvent) return;

    setProcessing(true);
    setIsManualDialogOpen(false);
    setScanning(false); // Stop scanner while validating

    // Normalize input
    const normalizedCode = manualCode.trim().toUpperCase();

    try {
      const result = await eventService.validateTicketScan(
        normalizedCode,
        selectedEvent.id, // Enforce validation against SELECTED event
        user.id
      );

      setLastResult(result);
      addToHistory(result, `MANUAL-${normalizedCode}`);
      setManualCode('');

    } catch (error: any) {
      console.error('Manual validation error:', error);
      const errorResult = {
        success: false,
        message: error.message || 'Erro na validação manual',
        code: 'ERROR'
      };
      setLastResult(errorResult);
      addToHistory(errorResult, `MANUAL-${normalizedCode}`);
    } finally {
      setProcessing(false);
    }
  };

  const addToHistory = (result: ValidationResult, ticketId: string) => {
    setHistory(prev => [{
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      result,
      ticketId
    }, ...prev].slice(0, 50));
  };

  const handleError = (error: any) => {
    console.error(error);
    if (error?.message?.includes('permission')) {
      setCameraError('Permissão da câmera negada. Verifique as configurações do navegador.');
    } else {
      setCameraError('Erro ao acessar a câmera.');
    }
  };

  // RENDER: Event Selection
  if (!selectedEvent) {
    return (
      <Layout title="Scanner de Ingressos" showBottomNav={false}>
        <div className="p-4 max-w-md mx-auto min-h-screen flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Selecionar Evento</h1>
              <p className="text-muted-foreground">Escolha o evento para validar ingressos</p>
            </div>
          </div>

          {loadingEvents ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhum evento encontrado</h3>
              <p className="text-muted-foreground mb-6">Você ainda não criou eventos ou não há eventos futuros.</p>
              <Button onClick={() => navigate(ROUTE_PATHS.CREATE_EVENT, { state: { returnTo: '/scanner' } })}>
                Criar Evento
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map(event => (
                <Card 
                  key={event.id} 
                  className="cursor-pointer hover:border-primary transition-colors active:scale-[0.98]"
                  onClick={() => setSelectedEvent(event)}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold line-clamp-1">{event.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(event.event_date), "dd 'de' MMMM", { locale: ptBR })}
                      </CardDescription>
                    </div>
                    <Badge variant={event.event_type === 'festive' ? 'default' : 'secondary'}>
                      {event.event_type === 'festive' ? 'Festa' : 'Formal'}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // RENDER: Scanner
  return (
    <Layout title="Scanner" showBottomNav={false}>
      <div className="p-4 max-w-md mx-auto min-h-screen flex flex-col">
        {/* Header with Selected Event */}
        <div className="bg-card border rounded-xl p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Evento Atual</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs hover:text-primary"
              onClick={() => {
                setSelectedEvent(null);
                setHistory([]);
                setScanning(true);
              }}
            >
              Trocar
            </Button>
          </div>
          <h2 className="font-bold text-lg leading-tight truncate">{selectedEvent.title}</h2>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {format(new Date(selectedEvent.event_date), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <Button 
            className={`flex-1 ${scanning ? 'bg-primary' : 'bg-muted text-muted-foreground'}`}
            onClick={() => {
              setScanning(true);
              setLastResult(null);
            }}
          >
            <Camera className="w-4 h-4 mr-2" />
            Scanner
          </Button>
          
          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <Keyboard className="w-4 h-4 mr-2" />
                Digitar Código
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Validar Manualmente</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Digite o código do ingresso (min. 6 caracteres)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualSubmit();
                  }}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Você pode digitar os primeiros caracteres do ID do ingresso.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsManualDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleManualSubmit} disabled={manualCode.length < 6}>
                  Validar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Scanner Viewport */}
        <div className="relative aspect-square bg-black rounded-3xl overflow-hidden mb-6 shadow-2xl border-4 border-white/10">
          {cameraError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center p-6">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-muted-foreground">{cameraError}</p>
              </div>
            </div>
          ) : (
            <>
              {scanning && (
                <Scanner 
                  onScan={handleScan}
                  onError={handleError}
                  components={{ audio: false, finder: false }} 
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
              )}
              
              {/* Overlay UI */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Scan Frame */}
                {scanning && !processing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-primary/50 rounded-2xl relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl" />
                      <motion.div 
                        animate={{ y: [0, 250, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-full h-1 bg-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.5)]"
                      />
                    </div>
                  </div>
                )}

                {/* Result Overlay */}
                <AnimatePresence>
                  {lastResult && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center z-50`}
                    >
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
                        lastResult.success ? 'bg-green-500/20 text-green-500' : 
                        lastResult.code === 'ALREADY_USED' ? 'bg-orange-500/20 text-orange-500' : 
                        lastResult.code === 'WRONG_EVENT' ? 'bg-red-500/20 text-red-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {lastResult.success ? (
                          <CheckCircle2 className="w-12 h-12" />
                        ) : lastResult.code === 'ALREADY_USED' ? (
                          <RotateCcw className="w-12 h-12" />
                        ) : (
                          <XCircle className="w-12 h-12" />
                        )}
                      </div>
                      
                      <h3 className={`text-2xl font-bold mb-2 ${
                        lastResult.success ? 'text-green-500' : 
                        lastResult.code === 'ALREADY_USED' ? 'text-orange-500' : 
                        'text-red-500'
                      }`}>
                        {lastResult.success ? 'INGRESSO VÁLIDO' : 
                         lastResult.code === 'ALREADY_USED' ? 'JÁ UTILIZADO' :
                         lastResult.code === 'WRONG_EVENT' ? 'EVENTO INCORRETO' :
                         'INVÁLIDO'}
                      </h3>
                      
                      <p className="text-white/80 text-lg mb-8">
                        {lastResult.message}
                      </p>

                      {lastResult.participant_id && (
                        <div className="bg-white/10 rounded-lg p-3 w-full mb-6">
                          <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Participante ID</p>
                          <p className="font-mono text-sm">{lastResult.participant_id.substring(0, 8)}...</p>
                        </div>
                      )}

                      {lastResult.used_at && (
                        <div className="bg-white/10 rounded-lg p-3 w-full">
                          <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Utilizado em</p>
                          <p className="font-mono text-sm">
                            {format(new Date(lastResult.used_at), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        {/* Scan History */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Scan className="w-4 h-4" />
            Histórico Recente
          </h3>
          <div className="overflow-y-auto space-y-2 flex-1 pr-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum ingresso validado ainda.
              </p>
            ) : (
              history.map(item => (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.result.success ? 'bg-green-500/5 border-green-500/20' : 
                    item.result.code === 'ALREADY_USED' ? 'bg-orange-500/5 border-orange-500/20' : 
                    'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.result.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : item.result.code === 'ALREADY_USED' ? (
                      <RotateCcw className="w-5 h-5 text-orange-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        item.result.success ? 'text-green-700 dark:text-green-300' : 
                        item.result.code === 'ALREADY_USED' ? 'text-orange-700 dark:text-orange-300' : 
                        'text-red-700 dark:text-red-300'
                      }`}>
                        {item.result.success ? 'Validado' : 
                         item.result.code === 'ALREADY_USED' ? 'Já utilizado' : 
                         item.result.code === 'WRONG_EVENT' ? 'Evento incorreto' :
                         'Inválido'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(item.timestamp, "HH:mm:ss")} • ID: {item.ticketId.substring(0, 6)}...
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}