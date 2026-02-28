import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { Ban, ShieldCheck, HeartHandshake, Smile, AlertTriangle } from 'lucide-react';
import { differenceInYears, parseISO } from 'date-fns';

interface MatchGuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function MatchGuidelinesModal({ isOpen, onClose, onAccept }: MatchGuidelinesModalProps) {
  const { profile } = useAuth();
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    if (profile?.birth_date) {
      const birthDate = parseISO(profile.birth_date);
      const userAge = differenceInYears(new Date(), birthDate);
      setAge(userAge);
    }
  }, [profile]);

  const isUnderage = age !== null && age < 18;

  const handleAction = () => {
    if (isUnderage) {
      onClose();
    } else {
      onAccept();
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            {isUnderage ? (
              <Ban className="h-6 w-6 text-red-600" />
            ) : (
              <HeartHandshake className="h-6 w-6 text-primary" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            {isUnderage ? 'Acesso Restrito' : 'Bem-vindo ao Match!'}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {isUnderage 
              ? 'Esta funcionalidade é exclusiva para maiores de 18 anos.' 
              : 'Antes de começar, precisamos combinar algumas coisas para garantir a melhor experiência para todos.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isUnderage ? (
            <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 text-center">
              <p className="text-sm text-destructive font-medium">
                Identificamos que sua idade é {age} anos.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                De acordo com nossos termos de uso e legislação vigente, não é permitido o acesso ao Match para menores de idade.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold block text-foreground">Segurança em primeiro lugar</span>
                  Nunca compartilhe dados financeiros ou endereço residencial antes de conhecer bem a pessoa.
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Smile className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold block text-foreground">Seja respeitoso</span>
                  Trate todos com gentileza. Assédio, discurso de ódio ou bullying não serão tolerados.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold block text-foreground">Denuncie comportamentos suspeitos</span>
                  Se algo parecer errado, use a ferramenta de denúncia para nos ajudar a manter a comunidade segura.
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button 
            className="w-full sm:w-auto min-w-[150px]" 
            variant={isUnderage ? "destructive" : "default"}
            onClick={handleAction}
          >
            {isUnderage ? 'Entendi' : 'Concordar e Continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
