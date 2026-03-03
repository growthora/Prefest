import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, X, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeImage: string; // Base64
  copyPasteCode: string;
  amount: number;
  expirationDate?: string; // Optional
  onCheckStatus?: () => Promise<void>;
}

export function PixPaymentModal({ isOpen, onClose, qrCodeImage, copyPasteCode, amount, expirationDate, onCheckStatus }: PixPaymentModalProps) {
  const [isChecking, setIsChecking] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(copyPasteCode);
    toast.success('Código Pix copiado com sucesso!');
  };

  const handleCheckStatus = async () => {
    if (!onCheckStatus) return;
    setIsChecking(true);
    try {
        await onCheckStatus();
    } finally {
        setIsChecking(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    Pagamento via Pix
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Escaneie o QR Code ou copie o código para pagar.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border-2 border-primary/20">
                 {/* QR Code Image - usually comes as base64 from Asaas */}
                 {qrCodeImage ? (
                   <img 
                      src={`data:image/png;base64,${qrCodeImage}`} 
                      alt="QR Code Pix" 
                      className="w-48 h-48 object-contain"
                   />
                 ) : (
                   <div className="w-48 h-48 flex items-center justify-center text-muted-foreground text-xs">
                     QR Code indisponível
                   </div>
                 )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor a pagar</span>
                  <span className="font-bold font-mono text-lg">R$ {amount.toFixed(2)}</span>
                </div>
                {expirationDate && (
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Vencimento</span>
                        <span className="font-mono">{new Date(expirationDate).toLocaleString()}</span>
                    </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Pix Copia e Cola
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-muted/50 rounded-lg font-mono text-xs truncate border border-border">
                    {copyPasteCode}
                  </div>
                  <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-500 flex items-start gap-2">
                <div className="w-4 h-4 mt-0.5 shrink-0 rounded-full border border-blue-500 flex items-center justify-center text-[10px] font-bold">i</div>
                <p>
                  Após o pagamento, seu ingresso será liberado automaticamente em alguns instantes.
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-muted/30 border-t border-border flex justify-end gap-2">
                {onCheckStatus && (
                    <Button 
                        onClick={handleCheckStatus} 
                        variant="outline"
                        disabled={isChecking}
                    >
                        {isChecking ? 'Verificando...' : 'Já paguei'}
                    </Button>
                )}
                <Button onClick={onClose}>
                    Fechar e Aguardar
                </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
