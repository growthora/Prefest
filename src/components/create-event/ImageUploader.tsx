import { ImageCropUploader } from "@/components/ImageCropUploader";

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
  error?: string;
}

export function ImageUploader({ value, onChange, className, error }: ImageUploaderProps) {
  return (
    <ImageCropUploader
      type="event"
      value={value}
      onChange={onChange}
      className={className}
      error={error}
      label="Imagem de Capa *"
    />
  );
}
