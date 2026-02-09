import React, { useState, useEffect } from 'react';
import { BRAZIL_STATES } from '@/constants/states';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface LocationSelectProps {
  state: string;
  city: string;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  disabled?: boolean;
}

interface City {
  id: number;
  nome: string;
}

export function LocationSelect({ 
  state, 
  city, 
  onStateChange, 
  onCityChange, 
  disabled 
}: LocationSelectProps) {
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    if (state) {
      loadCities(state);
    } else {
      setCities([]);
    }
  }, [state]);

  const loadCities = async (uf: string) => {
    setLoadingCities(true);
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
      const data = await response.json();
      setCities(data.sort((a: City, b: City) => a.nome.localeCompare(b.nome)));
    } catch (error) {
      console.error('Failed to load cities', error);
      setCities([]);
    } finally {
      setLoadingCities(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Estado (UF) *</Label>
        <Select 
          value={state} 
          onValueChange={(val) => {
            onStateChange(val);
            onCityChange(''); // Reset city when state changes
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o estado" />
          </SelectTrigger>
          <SelectContent>
            {BRAZIL_STATES.map((state) => (
              <SelectItem key={state.value} value={state.value}>
                {state.label} ({state.value})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Cidade *</Label>
        <Select 
          value={city} 
          onValueChange={onCityChange}
          disabled={!state || disabled || loadingCities}
        >
          <SelectTrigger>
            <SelectValue placeholder={
              !state 
                ? "Selecione o estado primeiro" 
                : loadingCities 
                  ? "Carregando cidades..." 
                  : "Selecione a cidade"
            } />
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city.id} value={city.nome}>
                {city.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
