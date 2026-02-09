import { useState, useEffect } from 'react';
import { Download, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface TicketQRCodeProps {
  ticketId: string;
  eventId: string;
  ticketToken: string;
  ticketCode?: string;
  status: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
}

export default function TicketQRCode({ 
  ticketId, 
  eventId, 
  ticketToken,
  ticketCode,
  status,
  eventTitle, 
  eventDate, 
  eventLocation 
}: TicketQRCodeProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (ticketCode) {
      const size = 300;
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(ticketCode)}&format=png`;
      setQrCodeUrl(url);
    } else if (ticketId && eventId && ticketToken) {
      // Fallback legacy JSON format
      const payload = JSON.stringify({
        t: ticketId,
        e: eventId,
        k: ticketToken
      });
      
      const size = 300;
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}&format=png`;
      setQrCodeUrl(url);
    }
  }, [ticketId, eventId, ticketToken, ticketCode]);

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.download = `ingresso-${eventTitle.replace(/\s+/g, '-')}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'valid':
        return {
          label: 'Válido',
          icon: <CheckCircle2 className="w-4 h-4" />,
          variant: 'default' as const,
          color: 'text-green-600',
        };
      case 'used':
        return {
          label: 'Utilizado',
          icon: <CheckCircle2 className="w-4 h-4" />,
          variant: 'secondary' as const,
          color: 'text-orange-600',
        };
      case 'canceled':
      case 'invalid':
        return {
          label: 'Inválido',
          icon: <XCircle className="w-4 h-4" />,
          variant: 'destructive' as const,
          color: 'text-red-600',
        };
      default:
        return {
          label: 'Pendente',
          icon: <Clock className="w-4 h-4" />,
          variant: 'outline' as const,
          color: 'text-gray-600',
        };
    }
  };

  const statusInfo = getStatusInfo(status || 'valid');

  return (
    <Card className="overflow-hidden border-none shadow-lg bg-card">
      <CardHeader className="bg-primary/5 pb-4">
        <div className="flex justify-between items-start gap-4">
           <div className="flex-1">
             <h3 className="font-bold text-lg leading-tight line-clamp-2">{eventTitle}</h3>
             <div className="text-sm text-muted-foreground mt-1 flex flex-col gap-1">
               <span>{eventDate}</span>
               <span>{eventLocation}</span>
             </div>
           </div>
           <Badge variant={statusInfo.variant} className="shrink-0">
             {statusInfo.icon}
             <span className="ml-1">{statusInfo.label}</span>
           </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex flex-col items-center">
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="QR Code do Ingresso" className="w-48 h-48 object-contain" />
          ) : (
            <Skeleton className="w-48 h-48" />
          )}
        </div>
        
        <div className="text-center w-full space-y-4">
           <div className="text-xs text-muted-foreground font-mono">
             <p>{ticketCode ? `CÓD: ${ticketCode}` : `ID: ${ticketId.slice(0, 8)}...`}</p>
           </div>
           
           <Button onClick={downloadQRCode} variant="outline" className="w-full gap-2">
             <Download className="w-4 h-4" />
             Baixar Ingresso
           </Button>
        </div>
      </CardContent>
    </Card>
  );
}
