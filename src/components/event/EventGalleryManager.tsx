import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { storageService } from '@/services/storage.service';

export interface EventGalleryImage {
  image_url: string;
  is_cover: boolean;
}

interface EventGalleryManagerProps {
  images: EventGalleryImage[];
  onChange: (images: EventGalleryImage[]) => void;
  label?: string;
  readOnly?: boolean;
  maxImages?: number;
  uploadFolder?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 900;
const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT;

async function prepareGalleryImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const sourceWidth = img.width;
        const sourceHeight = img.height;
        if (!sourceWidth || !sourceHeight) {
          resolve(file);
          return;
        }

        const sourceRatio = sourceWidth / sourceHeight;
        let cropWidth = sourceWidth;
        let cropHeight = sourceHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (sourceRatio > TARGET_RATIO) {
          cropWidth = sourceHeight * TARGET_RATIO;
          offsetX = (sourceWidth - cropWidth) / 2;
        } else if (sourceRatio < TARGET_RATIO) {
          cropHeight = sourceWidth / TARGET_RATIO;
          offsetY = (sourceHeight - cropHeight) / 2;
        }

        const canvas = document.createElement('canvas');
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(
          img,
          offsetX,
          offsetY,
          cropWidth,
          cropHeight,
          0,
          0,
          TARGET_WIDTH,
          TARGET_HEIGHT
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp' }));
          },
          'image/webp',
          0.85
        );
      };

      img.onerror = () => resolve(file);
      img.src = reader.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function normalizeImages(input: EventGalleryImage[], maxImages: number): EventGalleryImage[] {
  const deduped = input
    .filter((item) => item && typeof item.image_url === 'string' && item.image_url.trim().length > 0)
    .reduce<EventGalleryImage[]>((acc, item) => {
      if (acc.some((existing) => existing.image_url === item.image_url)) return acc;
      acc.push({ image_url: item.image_url.trim(), is_cover: !!item.is_cover });
      return acc;
    }, [])
    .slice(0, maxImages);

  if (deduped.length === 0) return [];

  const coverIndex = deduped.findIndex((item) => item.is_cover);
  return deduped.map((item, index) => ({
    ...item,
    is_cover: coverIndex >= 0 ? index === coverIndex : index === 0,
  }));
}

export function EventGalleryManager({
  images,
  onChange,
  label = 'Galeria de imagens',
  readOnly = false,
  maxImages = 5,
  uploadFolder = 'events',
}: EventGalleryManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const normalizedImages = useMemo(() => normalizeImages(images, maxImages), [images, maxImages]);

  const commit = (next: EventGalleryImage[]) => {
    onChange(normalizeImages(next, maxImages));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= normalizedImages.length) return;

    const next = [...normalizedImages];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    commit(next);
  };

  const removeImage = (index: number) => {
    const next = normalizedImages.filter((_, i) => i !== index);
    commit(next);
  };

  const setCover = (index: number) => {
    commit(normalizedImages.map((img, i) => ({ ...img, is_cover: i === index })));
  };

  const handleUploadClick = () => {
    if (readOnly || isUploading) return;
    inputRef.current?.click();
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const availableSlots = maxImages - normalizedImages.length;

    if (availableSlots <= 0) {
      toast.error(`Limite máximo de ${maxImages} imagens por evento.`);
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      toast.warning(`Apenas ${availableSlots} imagem(ns) serão enviadas por causa do limite.`);
    }

    const uploaded: EventGalleryImage[] = [];

    try {
      setIsUploading(true);
      for (const file of filesToUpload) {
        if (!file.type.startsWith('image/')) {
          toast.error(`Arquivo inválido: ${file.name}`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`Imagem muito grande (${file.name}). Máximo: 5MB.`);
          continue;
        }

        const preparedFile = await prepareGalleryImage(file);
        const url = await storageService.uploadImage(preparedFile, 'event-images', uploadFolder);
        uploaded.push({ image_url: url, is_cover: false });
      }

      if (uploaded.length > 0) {
        commit([...normalizedImages, ...uploaded]);
      }
    } catch {
      toast.error('Erro ao enviar imagem. Tente novamente.');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {normalizedImages.length}/{maxImages}
        </span>
      </div>

      {!readOnly && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleUploadClick}
            disabled={isUploading || normalizedImages.length >= maxImages}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando imagens...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4 mr-2" />
                Adicionar imagens
              </>
            )}
          </Button>
        </div>
      )}

      {normalizedImages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Adicione entre 1 e {maxImages} imagens.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {normalizedImages.map((img, index) => (
            <div
              key={`${img.image_url}-${index}`}
              className="flex flex-col rounded-xl border bg-card shadow-sm overflow-hidden"
            >
              <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
                <img
                  src={img.image_url}
                  alt={`Imagem ${index + 1}`}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
                {img.is_cover && (
                  <span className="absolute top-2 right-2 z-10 text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/95 text-primary-foreground shadow">
                    CAPA
                  </span>
                )}
              </div>

              {!readOnly && (
                <div className="p-2 border-t bg-background flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={img.is_cover ? 'secondary' : 'outline'}
                    onClick={() => setCover(index)}
                    disabled={img.is_cover}
                    className="shrink-0"
                  >
                    <Star className="h-4 w-4 mr-1" /> Capa
                  </Button>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => moveImage(index, -1)}
                      disabled={index === 0}
                      className="h-8 w-8"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => moveImage(index, 1)}
                      disabled={index === normalizedImages.length - 1}
                      className="h-8 w-8"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeImage(index)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


