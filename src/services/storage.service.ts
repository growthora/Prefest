import { supabase } from '../lib/supabase';

class StorageService {
  private bucketName = 'event-images';

  // Compressão de imagem
  private async compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              // Create a new file with .webp extension
              const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
              const newFile = new File([blob], newName, { type: 'image/webp' });
              resolve(newFile);
            } else {
              reject(new Error('Falha na compressão da imagem'));
            }
          }, 'image/webp', 0.8);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  // Upload de imagem para o bucket
  async uploadImage(file: File, folder: string = 'events'): Promise<string> {
    let fileToUpload = file;
    
    // Tentar comprimir se for imagem
    if (file.type.startsWith('image/')) {
      try {
        console.log('🔄 [StorageService] Comprimindo imagem...', file.size);
        fileToUpload = await this.compressImage(file);
        console.log('✅ [StorageService] Imagem comprimida:', fileToUpload.size);
      } catch (err) {
        console.warn('⚠️ [StorageService] Erro ao comprimir imagem, usando original:', err);
      }
    }

    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    console.log('📤 [StorageService] Fazendo upload de imagem:', fileName);

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ [StorageService] Erro no upload:', error);
      throw error;
    }

    // Obter URL pública da imagem
    const { data: { publicUrl } } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(fileName);

    console.log('✅ [StorageService] Upload concluído:', publicUrl);
    return publicUrl;
  }

  // Deletar imagem do bucket
  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extrair o caminho do arquivo da URL
      const urlParts = imageUrl.split(`/${this.bucketName}/`);
      if (urlParts.length < 2) return;

      const filePath = urlParts[1];
      
      console.log('🗑️ [StorageService] Deletando imagem:', filePath);

      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('❌ [StorageService] Erro ao deletar:', error);
        throw error;
      }

      console.log('✅ [StorageService] Imagem deletada');
    } catch (err) {
      console.error('❌ [StorageService] Erro ao deletar imagem:', err);
      // Não lançar erro para não bloquear outras operações
    }
  }
}

export const storageService = new StorageService();
