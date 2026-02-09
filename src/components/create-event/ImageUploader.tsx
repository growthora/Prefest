import React, { useState, useRef } from 'react';
import { storageService } from '@/services/storage.service';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
  error?: string;
}

export function ImageUploader({ value, onChange, className, error }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Se já tiver uma imagem, remove a antiga (opcional, dependendo da regra de negócio)
      // if (value) await storageService.deleteImage(value);

      const url = await storageService.uploadImage(file, 'events');
      onChange(url);
    } catch (err) {
      console.error('Falha no upload', err);
      // Aqui poderia ter um toast de erro
    } finally {
      setUploading(false);
      // Limpar input para permitir selecionar o mesmo arquivo novamente se necessário
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!value) return;

    if (window.confirm('Tem certeza que deseja remover esta imagem?')) {
      try {
        await storageService.deleteImage(value);
        onChange('');
      } catch (err) {
        console.error('Erro ao remover imagem', err);
      }
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>Imagem de Capa *</Label>
      
      <div 
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-2",
          value ? "border-primary/50 bg-primary/5" : "border-gray-300 hover:border-primary hover:bg-gray-50",
          error && "border-red-500 bg-red-50",
          uploading && "opacity-70 cursor-wait"
        )}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange}
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center text-primary">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm font-medium">Enviando imagem...</span>
          </div>
        ) : value ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img 
              src={value} 
              alt="Preview" 
              className="max-h-[300px] rounded-md object-contain shadow-sm"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 rounded-full w-8 h-8 shadow-md"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-500">
            <div className="bg-gray-100 p-3 rounded-full mb-2">
              <Upload className="w-6 h-6" />
            </div>
            <p className="font-medium">Clique para fazer upload</p>
            <p className="text-xs text-gray-400">JPG, PNG ou WEBP (Max. 5MB)</p>
          </div>
        )}
      </div>
      
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
