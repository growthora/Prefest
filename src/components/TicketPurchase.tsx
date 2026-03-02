import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Flame, Ticket, CreditCard, ShieldCheck, Info, Tag, X } from 'lucide-react';
import { Event } from '@/lib/index';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { springPresets } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { couponService } from '@/services/coupon.service';
import { toast } from 'sonner';
import { TicketSelector } from './TicketSelector';
import { MatchGuidelinesModal } from './MatchGuidelinesModal';
import { CreditCardForm, CreditCardData } from './payment/CreditCardForm';
import { PixPaymentModal } from './payment/PixPaymentModal';
import type { TicketTypeDB } from '@/services/event.service';
import { supabase } from '@/lib/supabase';
import { Honeypot } from './security/Honeypot';
import { useSensitiveDataProtection } from '@/hooks/useSensitiveDataProtection';

import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface SingleModeToggleProps {
  enabled: boolean;
  onToggle: (val: boolean) => void;
  isLocked?: boolean;
}

export function SingleModeToggle({ enabled, onToggle, isLocked = false }: SingleModeToggleProps) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300 p-6",
        isLocked 
          ? "border-muted-foreground/20 bg-muted/30 opacity-60 cursor-not-allowed"
          : enabled 
            ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(255,0,127,0.15)]" 
            : "border-border bg-card/50 hover:border-muted-foreground/30"
      )}
    >
      {isLocked && (
        <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-full bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border">
          🔒 Bloqueado
        </div>
      )}
      
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Flame className={cn("w-5 h-5 transition-colors", enabled && !isLocked ? "text-primary animate-pulse" : "text-muted-foreground")} />
            <h3 className="font-bold text-lg tracking-tight">Conheça a Galera!! 🔥</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isLocked ? (
              <>
                Complete sua inscrição no evento para liberar a aba <span className="text-foreground font-medium">"Match do Evento"</span>. 
                Conecte-se com outros solteiros confirmados após garantir seu ingresso! 🎟️
              </>
            ) : (
              <>
                Ative para liberar a aba <span className="text-foreground font-medium">"Match do Evento"</span>. 
                Conecte-se com outros solteiros confirmados e encontre sua companhia ideal antes mesmo do show começar.
              </>
            )}
          </p>
        </div>
        <Switch 
          checked={enabled} 
          onCheckedChange={onToggle} 
          className="data-[state=checked]:bg-primary"
          disabled={isLocked}
        />
      </div>

      <AnimatePresence>
        {enabled && !isLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springPresets.gentle}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-4 border-t border-primary/10">
              <div className="flex flex-wrap gap-2">
                {['Anonimato Inteligente', 'IA de Compatibilidade', 'Chat Exclusivo'].map((feature) => (
                  <div 
                    key={feature} 
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-[10px] font-semibold uppercase tracking-wider text-primary border border-primary/20"
                  >
                    <Check className="w-3 h-3" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TicketPurchaseProps {
  event: Event;
  onPurchase: (singleMode: boolean, ticketTypeId?: string, totalPaid?: number) => Promise<void>;
  isParticipating?: boolean;
}

type CheckoutStep = 'select_ticket_type' | 'personal_data' | 'payment' | 'free_confirmation';

export function TicketPurchase({ event, onPurchase, isParticipating = false }: TicketPurchaseProps) {
  const { profile, user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>('select_ticket_type');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [singleMode, setSingleMode] = useState(false);
  const [showMatchGuidelines, setShowMatchGuidelines] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>();
  const [selectedTicketType, setSelectedTicketType] = useState<TicketTypeDB>();
  
  // Calculate age from profile birth_date
  const calculateAge = (birthDate?: string | null) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age.toString();
  };

  const fullName = profile?.full_name || '';
  const cpf = profile?.cpf || '';
  const email = profile?.email || '';
  const phone = profile?.phone || '';
  const age = calculateAge(profile?.birth_date);

  React.useEffect(() => {
    if (profile?.single_mode !== undefined) {
      setSingleMode(profile.single_mode);
    }
  }, [profile?.single_mode]);

  React.useEffect(() => {
    if (age && parseInt(age) < 18) {
      setSingleMode(false);
    }
  }, [age]);

  const handleToggleSingleMode = (val: boolean) => {
    if (val) {
      if (age && parseInt(age) < 18) {
        toast.error("É necessário ter mais de 18 anos para ativar o modo Match");
        return;
      }
      setShowMatchGuidelines(true);
    } else {
      setSingleMode(false);
    }
  };

  const confirmMatchEnabled = () => {
    setShowMatchGuidelines(false);
    setSingleMode(true);
    toast.success("Modo Match ativado!");
  };

  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO'>('PIX');
  const [hasAvailableTicketTypes, setHasAvailableTicketTypes] = useState<boolean | null>(null);
  
  // Credit Card State
  const [cardData, setCardData] = useState<CreditCardData | null>(null);
  const [isCardValid, setIsCardValid] = useState(false);

  // Pix Modal State
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string, copyPaste: string } | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Generate Idempotency Key when ticketId changes (new transaction intent)
  React.useEffect(() => {
    if (ticketId) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [ticketId]);

  const handleTicketSelect = (ticketTypeId: string, ticketType: TicketTypeDB) => {
    setSelectedTicketTypeId(ticketTypeId);
    setSelectedTicketType(ticketType);
  };

  const hasValidPersonalData = () => {
    // Check if profile data is present (since fields are read-only)
    if (!profile?.full_name || !profile?.cpf || !profile?.phone || !profile?.birth_date) {
      return false;
    }
    return true;
  };

  const handleRedirectToProfile = () => {
    navigate('/perfil/completar-cadastro');
  };

  const handleNextStep = async () => {
    if (step === 'select_ticket_type') {
      if (!selectedTicketTypeId) {
        toast.error('Selecione um tipo de ingresso');
        return;
      }
      
      setIsProcessing(true);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
            toast.error('Você precisa estar logado.');
            return;
        }

        // Refresh session to ensure valid token
        const { data: { session: freshSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
             toast.error('Sessão expirada. Faça login novamente.');
             return;
        }
        const currentSession = freshSession || session;

        const { data, error } = await supabase.functions.invoke('init-ticket-checkout-v2', {
            body: { 
                event_id: event.id,
                ticket_type_id: selectedTicketTypeId,
                quantity: 1 
            },
            headers: { Authorization: `Bearer ${currentSession.access_token}` }
        });

        if (error) throw error;

        if (data.type === 'paid') {
            setTicketId(data.ticket_id);
            setStep('personal_data'); // Force personal data step for PAID tickets too
        } else {
            if (data.nextStep === 'confirm') {
                setStep('free_confirmation');
            } else {
                setStep('personal_data');
            }
        }

      } catch (error: any) {
        console.error('Checkout init error:', error);
        let errorMessage = error.message || 'Erro ao iniciar checkout';
        if (errorMessage && (errorMessage.includes('Invalid JWT') || errorMessage.includes('401'))) {
            errorMessage = 'Sessão inválida. Tente fazer login novamente.';
        }
        // If profile is incomplete, the backend might return specific error
        if (errorMessage.includes('Dados incompletos') || errorMessage.includes('Profile incomplete')) {
            toast.error('Seu cadastro está incompleto. Redirecionando...');
            setTimeout(() => navigate('/perfil/completar-cadastro'), 1500);
            return;
        }
        toast.error(errorMessage);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (step === 'personal_data') {
      if (!hasValidPersonalData()) {
        toast.error('Seu cadastro está incompleto. Por favor, complete seu perfil.');
        return;
      }
      
      // If paid, go to payment. If free, go to confirmation
      if (selectedTicketType && selectedTicketType.price > 0) {
          setStep('payment');
      } else {
          setStep('free_confirmation');
      }
      return;
    }
  };

  const { sensitiveStyle, isDevToolsOpen } = useSensitiveDataProtection();

  // Anti-Bot: Honeypot state
  const [isBot, setIsBot] = useState(false);

  if (isBot) {
    // Silent fail for bots
    return null;
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Digite um código de cupom');
      return;
    }

    try {
      setValidatingCoupon(true);
      const coupon = await couponService.validateCoupon(couponCode);
      
      if (coupon) {
        setAppliedCoupon(coupon);
        toast.success(`Cupom "${coupon.code}" aplicado com sucesso! 🎉`);
      } else {
        toast.error('Cupom inválido ou expirado');
      }
    } catch (error) {
      toast.error('Erro ao validar cupom');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info('Cupom removido');
  };

  const handlePurchase = async () => {
    if (isParticipating) return;
    
    try {
      setIsProcessing(true);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error('Você precisa estar logado para comprar ingressos.');
        return;
      }

      // Refresh session to ensure valid token
      const { data: { session: freshSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
         toast.error('Sessão expirada. Faça login novamente.');
         return;
      }
      const currentSession = freshSession || session;

      if (total === 0) {
        // FREE FLOW
        // 1. Save Profile (if data exists in state)
        if (fullName && cpf && email && phone) {
            const { error: profileError } = await supabase.functions.invoke('save-buyer-profile-v2', {
                body: { full_name: fullName, cpf, phone, email },
                headers: { Authorization: `Bearer ${currentSession.access_token}` }
            });
            if (profileError) {
                console.error('Profile save error:', profileError);
                // Continue anyway? Or stop?
                // If profile save fails, ticket issue might fail if profile is required by constraint.
                // But let's try to continue.
            }
        }

        // 2. Issue Ticket
        const { error: ticketError } = await supabase.functions.invoke('issue-free-ticket-v2', {
            body: { 
                event_id: event.id,
                ticket_type_id: selectedTicketTypeId,
                quantity: 1 
            },
            headers: { Authorization: `Bearer ${currentSession.access_token}` }
        });

        if (ticketError) throw ticketError;

        toast.success('Ingresso gratuito confirmado! Você já pode conhecer quem vai à festa.');
        await onPurchase(singleMode, selectedTicketTypeId, 0);

      } else {
        // PAID FLOW
        if (!ticketId) {
            toast.error('Erro: Ticket não inicializado. Tente novamente.');
            return;
        }

        // 1. Save Profile (Mandatory for Paid too)
        if (fullName && cpf && email && phone) {
            const { error: profileError } = await supabase.functions.invoke('save-buyer-profile-v2', {
                body: { full_name: fullName, cpf, phone, email },
                headers: { Authorization: `Bearer ${currentSession.access_token}` }
            });
            if (profileError) {
                console.warn('Profile save warning (paid):', profileError);
            }
        }

        const payload = {
            ticket_id: ticketId,
            billing_type: paymentMethod === 'PIX' ? 'pix' : 'CREDIT_CARD',
            coupon_code: appliedCoupon ? appliedCoupon.code : undefined
        };

        const { data, error } = await supabase.functions.invoke('asaas-create-ticket-payment-v3', {
            body: payload,
            headers: { 
                Authorization: `Bearer ${currentSession.access_token}`,
                'Idempotency-Key': idempotencyKey
            }
        });

        if (error) throw error;

        if (data.pixQrCode || data.pixQrCodeText) {
            setPixData({
                qrCode: data.pixQrCode,
                copyPaste: data.pixQrCodeText || data.pixQrCode
            });
            setPixModalOpen(true);
        } else if (data.invoiceUrl) {
            window.location.href = data.invoiceUrl;
        } else {
            toast.error('Não foi possível obter a URL de pagamento. Tente novamente.');
        }
      }

    } catch (error: any) {
      console.error('Purchase error:', error);
      let errorMessage = error.message || 'Erro inesperado ao processar o pagamento';
      if (errorMessage.includes('Invalid JWT')) {
          errorMessage = 'Sessão inválida. Tente fazer login novamente.';
      }
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const basePrice = selectedTicketType?.price ?? event.price;
  const serviceFee = basePrice * 0.1;
  let discount = 0;
  
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percentage') {
      discount = basePrice * (appliedCoupon.discount_value / 100);
    } else {
      discount = appliedCoupon.discount_value;
    }
  }
  
  const total = Math.max(0, basePrice + serviceFee - discount);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Checkout do Ingresso</h2>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs font-semibold uppercase tracking-widest">
          <div
            className={cn(
              'flex items-center justify-center gap-2 rounded-full px-3 py-2 border transition-all',
              step === 'select_ticket_type'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground'
            )}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-primary text-background text-[10px]">
              1
            </span>
            Tipo de ingresso
          </div>
          <div
            className={cn(
              'flex items-center justify-center gap-2 rounded-full px-3 py-2 border transition-all',
              step === 'personal_data'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground'
            )}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-primary text-background text-[10px]">
              2
            </span>
            Dados pessoais
          </div>
          <div
            className={cn(
              'flex items-center justify-center gap-2 rounded-full px-3 py-2 border transition-all',
              step === 'payment'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground'
            )}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-primary text-background text-[10px]">
              3
            </span>
            Pagamento
          </div>
        </div>

        <Card className="p-6 bg-card/30 border-border backdrop-blur-sm">
          <div className="flex gap-6">
            <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-border/50">
              <img 
                src={event.image} 
                alt={event.title} 
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
              />
            </div>
            <div className="flex-1 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {event.category}
              </span>
              <h3 className="text-xl font-bold leading-none">{event.title}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                <span>{event.date}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>{event.time}</span>
              </div>
              <p className="text-sm text-muted-foreground">{event.location}</p>
            </div>
          </div>
        </Card>

        {/* Honeypot Field */}
        <Honeypot fieldName="fax" onChange={setIsBot} />

        <AnimatePresence mode="wait">
          {step === 'select_ticket_type' && (
            <motion.div
              key="select_ticket_type"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
              style={sensitiveStyle}
            >
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-widest">Tipo de ingresso</span>
                <p className="text-xs text-muted-foreground">
                  Escolha o tipo de ingresso que deseja adquirir para este evento.
                </p>
              </div>
              <TicketSelector
                eventId={event.id}
                onSelect={handleTicketSelect}
                selectedTicketTypeId={selectedTicketTypeId}
                onLoaded={(types) => setHasAvailableTicketTypes(types.length > 0)}
              />
              {hasAvailableTicketTypes === false && (
                <p className="text-xs text-red-500 font-medium">
                  Nenhum ingresso disponível no momento. Este evento não está aceitando novas compras.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {step === 'personal_data' && (
          <div className="space-y-4">
            {isAuthLoading ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {!hasValidPersonalData() && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-4">
                        <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
                            <Info className="w-4 h-4" /> Cadastro Incompleto
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                            Para continuar a compra, você precisa completar seus dados pessoais (CPF, Telefone, Data de Nascimento).
                        </p>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={handleRedirectToProfile}
                            className="w-full sm:w-auto"
                        >
                            Completar Cadastro
                        </Button>
                    </div>
                )}
                <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-widest">Dados pessoais</span>
                <p className="text-xs text-muted-foreground">
                    Confira seus dados para emissão do ingresso.
                </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-widest">Nome completo</Label>
                    <Input
                    value={fullName}
                    readOnly
                    className="bg-muted/50 cursor-not-allowed"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-widest">CPF</Label>
                    <Input
                    value={cpf}
                    readOnly
                    className="bg-muted/50 cursor-not-allowed"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-widest">E-mail</Label>
                    <Input
                    value={email}
                    readOnly
                    className="bg-muted/50 cursor-not-allowed"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-widest">Telefone</Label>
                    <Input
                    value={phone}
                    readOnly
                    className="bg-muted/50 cursor-not-allowed"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-widest">Idade</Label>
                    <Input
                    value={age}
                    readOnly
                    className="bg-muted/50 cursor-not-allowed"
                    />
                </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'free_confirmation' && (
          <div className="space-y-6">
             <div className="flex flex-col items-center justify-center space-y-2 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Check className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Confirme sua inscrição</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Você está prestes a garantir seu ingresso gratuito para <strong>{event.title}</strong>.
                </p>
             </div>
             
             <div className="bg-muted/30 p-4 rounded-xl space-y-3 text-sm border border-border">
                <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Participante</span>
                    <span className="font-medium">{fullName}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">CPF</span>
                    <span className="font-medium">{cpf}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingresso</span>
                    <span className="font-medium">{selectedTicketType?.name}</span>
                </div>
             </div>
             
             <div className="pt-2">
              <SingleModeToggle 
                enabled={singleMode} 
                onToggle={handleToggleSingleMode}
                isLocked={!!(age && parseInt(age) < 18)} 
              />
            </div>
          </div>
        )}

        {step === 'payment' && (
          <>
            <div className="mb-6">
              <SingleModeToggle 
                enabled={singleMode} 
                onToggle={handleToggleSingleMode}
                isLocked={!!(age && parseInt(age) < 18)} 
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest">Tipo de Ingresso</span>
              </div>
              <TicketSelector 
                eventId={event.id} 
                onSelect={handleTicketSelect} 
                selectedTicketTypeId={selectedTicketTypeId}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest">Forma de Pagamento</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left text-xs transition-all',
                    paymentMethod === 'PIX'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                  onClick={() => setPaymentMethod('PIX')}
                >
                  <span className="font-semibold uppercase tracking-widest">Pix</span>
                  <span className="text-[11px] text-muted-foreground">
                    QR Code Instantâneo
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left text-xs transition-all',
                    paymentMethod === 'CREDIT_CARD'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                >
                  <span className="font-semibold uppercase tracking-widest flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    Crédito
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Redirecionar para Asaas
                  </span>
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Após a compra, você já poderá conhecer quem vai à festa.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest">Cupom de Desconto</span>
              </div>
              
              {appliedCoupon ? (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-primary text-sm">{appliedCoupon.code}</p>
                      <p className="text-xs text-muted-foreground">{appliedCoupon.description}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleRemoveCoupon}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite o código do cupom"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    className="uppercase"
                    disabled={validatingCoupon}
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !couponCode.trim()}
                    variant="outline"
                    className="shrink-0"
                  >
                    {validatingCoupon ? 'Validando...' : 'Aplicar'}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedTicketType ? selectedTicketType.name : 'Ingresso'} (1x)
                </span>
                <span className="font-mono">R$ {basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Taxa de Serviço</span>
                  <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                </div>
                <span className="font-mono">R$ {serviceFee.toFixed(2)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-sm">
                  <span className="text-primary font-semibold">Desconto ({appliedCoupon.code})</span>
                  <span className="font-mono text-primary">- R$ {discount.toFixed(2)}</span>
                </div>
              )}
              <Separator className="bg-border/50" />
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter mb-1">Total do Pedido</p>
                  <p className="text-3xl font-bold tracking-tighter">R$ {total.toFixed(2)}</p>
                </div>
                <div className="text-right text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                  Pagamento Seguro via <br /> 
                  <span className="text-foreground">Asaas</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
        <Button 
          variant="outline" 
          className="h-14 rounded-2xl border-border hover:bg-muted/50 transition-colors"
          disabled={isProcessing || isParticipating || step === 'select_ticket_type'}
          onClick={() => {
            if (step === 'payment') {
              setStep('personal_data');
              return;
            }
            if (step === 'personal_data') {
              setStep('select_ticket_type');
            }
          }}
        >
          Voltar
        </Button>
        <Button 
          onClick={step === 'payment' ? handlePurchase : handleNextStep}
          className={cn(
            "h-14 rounded-2xl font-bold text-lg transition-all",
            isParticipating 
              ? "bg-green-600 hover:bg-green-600 cursor-not-allowed" 
              : "bg-primary hover:bg-primary/90 shadow-[0_10px_20px_-5px_rgba(255,0,127,0.4)] hover:scale-[1.02] active:scale-[0.98]"
          )}
          disabled={
            isProcessing ||
            isParticipating ||
            (step === 'select_ticket_type' && !selectedTicketTypeId) ||
            (step === 'payment' && !selectedTicketTypeId)
          }
        >
          {isParticipating ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Você já está inscrito!
            </>
          ) : isProcessing ? (
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
            />
          ) : (
            step === 'payment' ? (
              <>
                <Ticket className="w-5 h-5 mr-2" />
                Confirmar Ingressos
              </>
            ) : (
              <>Continuar</>
            )
          )}
        </Button>
      </div>

      <p className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.15em] opacity-50">
        Ao confirmar, você concorda com nossos termos de uso e políticas de privacidade. © 2026 Spark Events.
      </p>

      <MatchGuidelinesModal 
        isOpen={showMatchGuidelines} 
        onClose={() => setShowMatchGuidelines(false)} 
        onAccept={confirmMatchEnabled} 
      />

      {pixData && (
        <PixPaymentModal 
            isOpen={pixModalOpen}
            onClose={() => setPixModalOpen(false)}
            qrCodeImage={pixData.qrCode}
            copyPasteCode={pixData.copyPaste}
            amount={total}
            expirationDate={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
        />
      )}
    </div>
  );
}
