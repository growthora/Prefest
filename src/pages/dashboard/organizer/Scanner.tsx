import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { EventService, Event } from '@/services/event.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scanner as QrScanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, AlertCircle, QrCode, Keyboard } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeTicketCode, validateTicketCodeFormat, extractQrCodeValue } from '@/utils/ticket-utils';

interface ScanResult {
  success: boolean;
  message: string;
  code: string;
  participant_id?: string;
  used_at?: string;
  ticket_details?: any;
}

export function Scanner() {
  const { user } = useAuth();
  const eventService = new EventService();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('scan');
  const [pauseScanner, setPauseScanner] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadOrganizerEvents();
    }
  }, [user?.id]);

  const loadOrganizerEvents = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;
      const data = await eventService.getOrganizerEvents(user.id);
      setEvents(data);
      if (data.length > 0) {
        // Select the first event by default, or the one happening today
        setSelectedEventId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (detectedCodes: any[]) => {
    if (pauseScanner || validating || !selectedEventId) return;

    // Use robust extraction
    const code = extractQrCodeValue(detectedCodes);
    
    if (!code) {
      console.log('No code detected or empty value');
      return;
    }

    // Prevent duplicate rapid scans of the same code
    if (code === lastScannedCode) return;
    
    setLastScannedCode(code);
    setPauseScanner(true); // Pause scanning while validating
    
    try {
      await processTicketValidation(code);
    } catch (error) {
      console.error('Validation error:', error);
      setScanResult({
        success: false,
        message: 'Erro ao processar validação',
        code: 'ERROR'
      });
    } finally {
      // Resume scanning after delay if needed, or keep paused until user dismisses result
      // For now, we'll keep it paused to show result
    }
  };

  const processTicketValidation = async (qrDataString: string) => {
    setValidating(true);
    setScanResult(null);

    // Normalize input
    const cleanCode = qrDataString.trim();

    try {
      // 1. Try to parse as JSON (Legacy format)
      let ticketData;
      let isJson = false;
      try {
        if (cleanCode.startsWith('{')) {
          ticketData = JSON.parse(cleanCode);
          isJson = true;
        }
      } catch (e) {
        // Not JSON, continue to simple code validation
      }

      if (isJson && ticketData) {
        const { id, eventId, token } = ticketData;

        if (!id || !eventId || !token) {
          throw new Error('Formato de QR Code inválido');
        }

        if (eventId !== selectedEventId) {
          setScanResult({
            success: false,
            message: 'Ingresso pertence a outro evento',
            code: 'WRONG_EVENT'
          });
          return;
        }

        if (!user?.id) return;

        const result = await eventService.validateTicket(id, eventId, token, user.id);
        setScanResult(result);

        if (result.success) {
          toast.success('Check-in realizado com sucesso!');
          playSuccessSound();
        } else {
          playErrorSound();
        }
      } else {
        // 2. Simple Code Validation (New format: PF-XXXX-XXXX)
        // Normalize for code format (uppercase, remove spaces)
        const normalizedCode = normalizeTicketCode(cleanCode);
        
        // Regex validation for format PF-XXXX-XXXX
        if (!validateTicketCodeFormat(normalizedCode)) {
          setScanResult({
            success: false,
            message: `Formato de código inválido: ${normalizedCode || 'vazio'}`,
            code: 'INVALID_FORMAT'
          });
          playErrorSound();
          return;
        }
        
        if (!selectedEventId || !user?.id) return;

        console.log('Validating simple code:', normalizedCode, 'Original:', qrDataString);
        const result = await eventService.validateTicketScan(normalizedCode, selectedEventId, user.id);
        setScanResult(result);

        if (result.success) {
          toast.success('Check-in realizado com sucesso!');
          playSuccessSound();
        } else {
          playErrorSound();
        }
      }

    } catch (error: any) {
      setScanResult({
        success: false,
        message: error.message || 'Erro desconhecido na validação',
        code: 'VALIDATION_ERROR'
      });
      playErrorSound();
    } finally {
      setValidating(false);
    }
  };

  const handleManualValidation = async (code: string = manualCode) => {
    if (!code || !selectedEventId || !user?.id) return;

    setValidating(true);
    setScanResult(null);
    setPauseScanner(true);
    
    // Normalize input using shared utility
    const normalizedCode = normalizeTicketCode(code);

    try {
      console.log('Manual validation:', normalizedCode);
      // Use validateTicketScan for manual entry too
      const result = await eventService.validateTicketScan(normalizedCode, selectedEventId, user.id);
      setScanResult(result);

      if (result.success) {
        toast.success('Check-in manual realizado!');
        setManualCode(''); // Clear input on success
        playSuccessSound();
      } else {
        playErrorSound();
      }
    } catch (error: any) {
      console.error('Manual validation error:', error);
      setScanResult({
        success: false,
        message: error.message || 'Erro na validação manual',
        code: 'ERROR'
      });
      playErrorSound();
    } finally {
      setValidating(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setLastScannedCode(null);
    setPauseScanner(false);
    setManualCode('');
  };

  const playSuccessSound = () => {
    // Optional: Implement sound feedback
    // const audio = new Audio('/sounds/success.mp3');
    // audio.play().catch(e => console.log('Audio play failed', e));
  };

  const playErrorSound = () => {
    // Optional: Implement sound feedback
  };

  const getResultColor = () => {
    if (!scanResult) return 'bg-gray-100 border-gray-200';
    if (scanResult.success) return 'bg-green-50 border-green-200 text-green-800';
    if (scanResult.code === 'ALREADY_USED') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    return 'bg-red-50 border-red-200 text-red-800';
  };

  const getResultIcon = () => {
    if (!scanResult) return null;
    if (scanResult.success) return <CheckCircle2 className="h-12 w-12 text-green-600" />;
    if (scanResult.code === 'ALREADY_USED') return <AlertCircle className="h-12 w-12 text-yellow-600" />;
    return <XCircle className="h-12 w-12 text-red-600" />;
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Scanner de Ingressos</h1>
        <p className="text-muted-foreground">Valide a entrada dos participantes</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Evento Selecionado</CardTitle>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
      </Card>

      {!selectedEventId ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            Selecione um evento acima para começar a validar ingressos.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">
              <QrCode className="mr-2 h-4 w-4" />
              Câmera
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Keyboard className="mr-2 h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-4">
            <TabsContent value="scan" className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                {!pauseScanner ? (
                  <QrScanner
                    onScan={handleScan}
                    onError={(error) => console.log(error?.message)}
                    constraints={{ facingMode: 'environment' }}
                    containerStyle={{ height: '100%', width: '100%' }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center space-y-4 p-6 text-center">
                    {scanResult ? (
                      <div className="flex flex-col items-center gap-4">
                         {getResultIcon()}
                         <div className="space-y-1">
                           <h3 className="font-semibold text-lg">
                             {scanResult.success ? 'Acesso Liberado' : 'Acesso Negado'}
                           </h3>
                           <p className="text-sm text-muted-foreground">{scanResult.message}</p>
                           {scanResult.used_at && (
                             <p className="text-xs text-yellow-600">
                               Validado em: {format(new Date(scanResult.used_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                             </p>
                           )}
                         </div>
                         <Button onClick={resetScanner} className="w-full mt-2">
                           Próximo Ingresso
                         </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p>Validando...</p>
                      </div>
                    )}
                  </div>
                )}
                
                {!pauseScanner && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-primary rounded-lg opacity-50" />
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Aponte a câmera para o QR Code do ingresso
              </p>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Código do Ingresso</label>
                    <Input 
                      placeholder="Digite o código (ex: a1b2c3...)" 
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="uppercase"
                    />
                    <p className="text-xs text-muted-foreground">
                      Digite os primeiros 6 caracteres ou o código completo
                    </p>
                  </div>
                  
                  {scanResult && activeTab === 'manual' && (
                    <div className={`p-4 rounded-lg border ${getResultColor()}`}>
                      <div className="flex items-start gap-3">
                        {getResultIcon()}
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">
                            {scanResult.success ? 'Válido' : 'Inválido'}
                          </h4>
                          <p className="text-sm opacity-90">{scanResult.message}</p>
                          {scanResult.used_at && (
                             <p className="text-xs mt-1 font-medium">
                               Data: {format(new Date(scanResult.used_at), "dd/MM/yyyy HH:mm")}
                             </p>
                           )}
                        </div>
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    onClick={() => handleManualValidation()} 
                    disabled={validating || manualCode.length < 6}
                  >
                    {validating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      'Validar Código'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}

export default Scanner;
