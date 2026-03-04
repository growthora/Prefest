import { supabase } from '../lib/supabase';

class StorageService {
  private bucketName = 'event-images';
  private avatarBucketName = 'avatars';

  async uploadEventImage(file: File, eventId: string): Promise<string> {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `events/${eventId}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('event-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName);

    return publicUrl.publicUrl;
  }

  async uploadAvatar(file: File, userId?: string): Promise<string> {
    if (!userId) {
      throw new Error('Usuário não autenticado para upload de avatar');
    }

    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      try {
        fileToUpload = await this.compressImage(file);
      } catch {
        // Fallback para o arquivo original.
      }
    }

    const extFromMime = fileToUpload.type.split('/')[1] || 'jpg';
    const filePath = `${userId}/profile-${Date.now()}.${extFromMime}`;

    const { error } = await supabase.storage
      .from(this.avatarBucketName)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from(this.avatarBucketName)
      .getPublicUrl(filePath);

    return publicUrl.publicUrl;
  }

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
  async uploadImage(file: File, bucket: string = 'event-images', folder: string = ''): Promise<string> {
    let fileToUpload = file;
    
    // Tentar comprimir se for imagem
    if (file.type.startsWith('image/')) {
      try {
        // console.log('🔄 [StorageService] Comprimindo imagem...', file.size);
        fileToUpload = await this.compressImage(file);
        // console.log('✅ [StorageService] Imagem comprimida:', fileToUpload.size);
      } catch (err) {
        // console.warn('⚠️ [StorageService] Erro ao comprimir imagem, usando original:', err);
      }
    }

    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = folder 
      ? `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      : `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // console.log('📤 [StorageService] Fazendo upload de imagem:', fileName, 'Bucket:', bucket);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      // console.error('❌ [StorageService] Erro no upload:', error);
      throw error;
    }

    // Obter URL pública da imagem
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    // console.log('✅ [StorageService] Upload concluído:', publicUrl);
    return publicUrl;
  }

  // Deletar imagem do bucket
  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Tenta identificar o bucket pela URL ou usa o padrão
      let bucket = this.bucketName;
      if (imageUrl.includes('/profiles/')) bucket = 'profiles';
      else if (imageUrl.includes('/avatars/')) bucket = 'avatars';
      else if (imageUrl.includes('/events/')) bucket = 'event-images';
      else if (imageUrl.includes('/event-images/')) bucket = 'event-images';

      // Extrair o caminho do arquivo da URL
      const urlParts = imageUrl.split(`/${bucket}/`);
      if (urlParts.length < 2) return;

      const filePath = urlParts[1];
      
      // console.log('🗑️ [StorageService] Deletando imagem:', filePath);

      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        // console.error('❌ [StorageService] Erro ao deletar:', error);
        throw error;
      }

      // console.log('✅ [StorageService] Imagem deletada');
    } catch (err) {
      // console.error('❌ [StorageService] Erro ao deletar imagem:', err);
      // Não lançar erro para não bloquear outras operações
    }
  }
}

export const storageService = new StorageService();



