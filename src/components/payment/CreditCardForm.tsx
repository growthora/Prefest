import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, User, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CreditCardFormProps {
  onChange: (data: CreditCardData, isValid: boolean) => void;
  className?: string;
}

export function CreditCardForm({ onChange, className }: CreditCardFormProps) {
  const [data, setData] = useState<CreditCardData>({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreditCardData, string>>>({});

  const validate = (currentData: CreditCardData) => {
    const newErrors: Partial<Record<keyof CreditCardData, string>> = {};
    let isValid = true;

    if (!currentData.holderName.trim()) {
      newErrors.holderName = 'Nome do titular é obrigatório';
      isValid = false;
    }

    // Basic Luhn algorithm check could be added here, but length check is a start
    const cleanNumber = currentData.number.replace(/\D/g, '');
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      newErrors.number = 'Número de cartão inválido';
      isValid = false;
    }

    if (!currentData.expiryMonth || !/^\d{2}$/.test(currentData.expiryMonth) || Number(currentData.expiryMonth) < 1 || Number(currentData.expiryMonth) > 12) {
      newErrors.expiryMonth = 'Mês inválido';
      isValid = false;
    }

    const currentYear = new Date().getFullYear() % 100; // Last 2 digits
    if (!currentData.expiryYear || !/^\d{2}$/.test(currentData.expiryYear) || Number(currentData.expiryYear) < currentYear) {
      newErrors.expiryYear = 'Ano inválido';
      isValid = false;
    }

    if (!currentData.ccv || !/^\d{3,4}$/.test(currentData.ccv)) {
      newErrors.ccv = 'CVV inválido';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (field: keyof CreditCardData, value: string) => {
    let formattedValue = value;
    
    if (field === 'number') {
      formattedValue = value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
    } else if (field === 'expiryMonth' || field === 'expiryYear' || field === 'ccv') {
      formattedValue = value.replace(/\D/g, '');
    } else if (field === 'holderName') {
      formattedValue = value.toUpperCase();
    }

    const newData = { ...data, [field]: formattedValue };
    setData(newData);
    
    // Validate on change to give feedback, but maybe debounce in a real app
    // Here we just pass the validity status up
    const isValid = validate(newData);
    onChange(newData, isValid);
  };

  return (
    <div className={cn("space-y-4 p-4 border rounded-xl bg-card/50", className)}>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          Nome do Titular
        </Label>
        <Input
          placeholder="COMO ESTÁ NO CARTÃO"
          value={data.holderName}
          onChange={(e) => handleChange('holderName', e.target.value)}
          className={cn(errors.holderName && "border-red-500 focus-visible:ring-red-500")}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          Número do Cartão
        </Label>
        <Input
          placeholder="0000 0000 0000 0000"
          value={data.number}
          onChange={(e) => handleChange('number', e.target.value)}
          maxLength={19} // 16 digits + 3 spaces
          className={cn(errors.number && "border-red-500 focus-visible:ring-red-500")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Validade
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="MM"
              value={data.expiryMonth}
              onChange={(e) => handleChange('expiryMonth', e.target.value)}
              maxLength={2}
              className={cn("text-center", errors.expiryMonth && "border-red-500 focus-visible:ring-red-500")}
            />
            <span className="text-muted-foreground self-center">/</span>
            <Input
              placeholder="AA"
              value={data.expiryYear}
              onChange={(e) => handleChange('expiryYear', e.target.value)}
              maxLength={2}
              className={cn("text-center", errors.expiryYear && "border-red-500 focus-visible:ring-red-500")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            CVV
          </Label>
          <Input
            placeholder="123"
            value={data.ccv}
            onChange={(e) => handleChange('ccv', e.target.value)}
            maxLength={4}
            type="password"
            className={cn(errors.ccv && "border-red-500 focus-visible:ring-red-500")}
          />
        </div>
      </div>
      
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Lock className="w-3 h-3" />
        Seus dados são enviados diretamente para o processador de pagamentos e não são armazenados por nós.
      </p>
    </div>
  );
}


