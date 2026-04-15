import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, X, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeImage: string;
  copyPasteCode: string;
  amount: number;
  expirationDate?: string;
  onCheckStatus?: () => Promise<void>;
}

const DEFAULT_QR_SIZE = 280;

export function PixPaymentModal({
  isOpen,
  onClose,
  qrCodeImage,
  copyPasteCode,
  amount,
  expirationDate,
  onCheckStatus,
}: PixPaymentModalProps) {
  const [isChecking, setIsChecking] = React.useState(false);
  const [qrSize, setQrSize] = React.useState(DEFAULT_QR_SIZE);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateQrSize = () => {
      const maxQrSize = window.innerWidth <= 480 ? 240 : DEFAULT_QR_SIZE;
      setQrSize(Math.min(window.innerWidth * 0.7, maxQrSize));
    };

    updateQrSize();
    window.addEventListener('resize', updateQrSize);

    return () => {
      window.removeEventListener('resize', updateQrSize);
    };
  }, []);

  const qrImageSrc = React.useMemo(() => {
    if (!qrCodeImage) {
      return '';
    }

    return qrCodeImage.startsWith('data:image')
      ? qrCodeImage
      : `data:image/png;base64,${qrCodeImage}`;
  }, [qrCodeImage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(copyPasteCode);
    toast.success('Codigo Pix copiado com sucesso!');
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden bg-background/80 p-3 backdrop-blur-sm sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="relative flex max-h-[92vh] w-full max-w-[26rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5">
              <div className="space-y-5 sm:space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">
                      Pix instantaneo
                    </p>
                    <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                      <QrCode className="h-5 w-5 text-primary" />
                      Pagamento via Pix
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Escaneie o QR Code ou copie o codigo para pagar.
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 shrink-0 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex w-full flex-col items-center justify-center">
                  <div className="box-border w-full max-w-[320px] rounded-2xl border-2 border-primary/20 bg-white p-3 sm:p-4">
                    <div className="flex w-full flex-col items-center justify-center">
                      {qrImageSrc ? (
                        <img
                          src={qrImageSrc}
                          alt="QR Code Pix"
                          className="mx-auto block h-auto w-full max-w-[280px] object-contain"
                          style={{ maxWidth: `${qrSize}px` }}
                        />
                      ) : (
                        <div
                          className="flex w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 text-center text-xs text-muted-foreground"
                          style={{
                            minHeight: `${qrSize}px`,
                            maxWidth: `${qrSize}px`,
                            margin: '0 auto',
                          }}
                        >
                          QR Code indisponivel
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Valor a pagar</span>
                    <span className="font-mono text-lg font-bold">R$ {amount.toFixed(2)}</span>
                  </div>

                  {expirationDate && (
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">Vencimento</span>
                      <span className="text-right font-mono">
                        {new Date(expirationDate).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Pix Copia e Cola
                  </p>

                  <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 rounded-xl border border-border bg-muted/50 p-3 text-center font-mono text-xs break-all">
                      {copyPasteCode}
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleCopy}
                      className="w-full shrink-0 gap-2 sm:w-auto"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-500">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-blue-500 text-[10px] font-bold">
                    i
                  </div>
                  <p className="min-w-0">
                    Apos o pagamento, seu ingresso sera liberado automaticamente em alguns instantes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/30 p-3 sm:flex-row sm:justify-end sm:p-4">
              {onCheckStatus && (
                <Button
                  onClick={handleCheckStatus}
                  variant="outline"
                  disabled={isChecking}
                  className="w-full sm:w-auto"
                >
                  {isChecking ? 'Verificando...' : 'Ja paguei'}
                </Button>
              )}

              <Button onClick={onClose} className="w-full sm:w-auto">
                Fechar e aguardar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
