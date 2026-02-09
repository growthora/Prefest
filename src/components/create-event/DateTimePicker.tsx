import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarClock } from 'lucide-react';

interface DateTimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  required?: boolean;
  error?: string;
}

export function DateTimePicker({ 
  label, 
  value, 
  onChange, 
  min, 
  required,
  error 
}: DateTimePickerProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-gray-500" />
        {label} {required && '*'}
      </Label>
      <Input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        step="60" // 1 minute step, removes seconds
        className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
