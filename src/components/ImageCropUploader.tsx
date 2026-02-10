import React, { useState, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/utils/canvasUtils';
import { storageService } from '@/services/storage.service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, Image as ImageIcon, ZoomIn, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ImageType = 'profile' | 'event';

interface ImageCropUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  type: ImageType;
  aspectRatio?: number; // Optional override
  className?: string;
  error?: string;
  label?: string;
}

const CONFIG = {
  profile: {
    aspect: 1,
    cropShape: 'round' as const,
    resize: { width: 512, height: 512 },
    bucket: 'profiles'
  },
  event: {
    aspect: 16 / 9,
    cropShape: 'rect' as const,
    resize: { width: 1280, height: 720 },
    bucket: 'events'
  }
};

export function ImageCropUploader({ 
  value, 
  onChange, 
  type, 
  aspectRatio, 
  className, 
  error,
  label,
  children
}: ImageCropUploaderProps & { children?: React.ReactNode }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = CONFIG[type];
  const aspect = aspectRatio || config.aspect;

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validations
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setIsCropping(true);
        setZoom(1);
      });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsUploading(true);
      
      // 1. Get cropped blob
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        0, // rotation
        { horizontal: false, vertical: false },
        'image/jpeg'
      );

      // 2. Create File object
      const filename = `cropped_${Date.now()}.jpg`;
      const file = new File([croppedBlob], filename, { type: 'image/jpeg' });

      // 3. Upload
      const url = await storageService.uploadImage(file, config.bucket);
      
      // 4. Update parent
      onChange(url);
      
      // 5. Cleanup
      setIsCropping(false);
      setImageSrc(null);
      toast.success('Imagem atualizada com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao processar imagem.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setIsCropping(false);
    setImageSrc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;

    if (window.confirm('Tem certeza que deseja remover esta imagem?')) {
      try {
        // Optional: delete from storage if needed
        // await storageService.deleteImage(value);
        onChange('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error(err);
        toast.error('Erro ao remover imagem');
      }
    }
  };

  const handleFileClick = () => !isUploading && fileInputRef.current?.click();

  if (children) {
    return (
      <>
        <div className={cn("relative inline-block", className)} onClick={handleFileClick}>
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/jpeg,image/png,image/webp" 
            className="hidden" 
            onChange={onFileChange}
            disabled={isUploading}
          />
          {children}
          {isUploading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
        </div>
        
        {/* Cropper Modal */}
        <Dialog open={isCropping} onOpenChange={(open) => !open && handleCancel()}>
          <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-background">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Ajustar Imagem</DialogTitle>
              <DialogDescription>
                Arraste e aplique zoom para enquadrar a imagem corretamente.
              </DialogDescription>
            </DialogHeader>

            <div className="relative w-full h-[400px] bg-black/90">
              {imageSrc && (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  cropShape={config.cropShape}
                  showGrid={true}
                />
              )}
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <ZoomIn className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setZoom(value[0])}
                  className="flex-1"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Salvar Imagem'
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      
      <div 
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-2 overflow-hidden bg-muted/20",
          value ? "border-primary/50 bg-primary/5" : "border-muted-foreground/25 hover:border-primary hover:bg-muted/30",
          error && "border-red-500 bg-red-50",
          isUploading && "opacity-70 cursor-wait",
          type === 'profile' ? "w-48 h-48 mx-auto rounded-full" : "w-full aspect-video"
        )}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/jpeg,image/png,image/webp" 
          className="hidden" 
          onChange={onFileChange}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center text-primary z-10">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm font-medium">Processando...</span>
          </div>
        ) : value ? (
          <>
             <img 
              src={value} 
              alt="Preview" 
              className={cn(
                "absolute inset-0 w-full h-full object-cover",
                type === 'profile' && "rounded-full"
              )}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                Alterar
              </span>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleRemove}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-muted-foreground text-center p-4">
            <div className="bg-background p-3 rounded-full mb-2 shadow-sm">
              {type === 'profile' ? <ImageIcon className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
            </div>
            <p className="font-medium text-sm">Clique para upload</p>
            <p className="text-xs opacity-70 mt-1">JPG, PNG ou WEBP (Max. 5MB)</p>
          </div>
        )}
      </div>
      
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      {/* Cropper Modal */}
      <Dialog open={isCropping} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Ajustar Imagem</DialogTitle>
            <DialogDescription>
              Arraste e aplique zoom para enquadrar a imagem corretamente.
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full h-[400px] bg-black/90">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape={config.cropShape}
                showGrid={true}
              />
            )}
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(value) => setZoom(value[0])}
                className="flex-1"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Salvar Imagem'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
