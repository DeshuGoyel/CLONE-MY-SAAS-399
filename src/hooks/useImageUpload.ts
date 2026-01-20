import { useState, useCallback } from 'react';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { updateUser } from '@/action/updateUser';
import { validateImage } from '@/lib/imageValidation';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
}

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const supabase = createClientComponentClient();

  const uploadSingleImage = async (
    file: File,
    userId: string,
    retryCount: number = 0
  ): Promise<{ success: boolean; url?: string; error?: string }> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${userId}/selfies/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("userphotos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => 
            setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount))
          );
          return uploadSingleImage(file, userId, retryCount + 1);
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("userphotos")
        .getPublicUrl(filePath);

      return { success: true, url: publicUrl };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || "Upload failed" 
      };
    }
  };

  const uploadImages = async (images: Array<{ file: File; pixels: number }>) => {
    if (images.length === 0) {
      setError("Please upload at least one image before continuing.");
      return false;
    }

    setIsUploading(true);
    setError(null);

    const initialProgress: UploadProgress[] = images.map(({ file }) => ({
      fileName: file.name,
      progress: 0,
      status: 'pending' as const,
    }));
    setUploadProgress(initialProgress);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (let i = 0; i < images.length; i++) {
        const { file } = images[i];

        setUploadProgress(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'uploading', progress: 0 } : item
        ));

        const validation = await validateImage(file);
        if (!validation.valid) {
          setUploadProgress(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'error', error: validation.error, progress: 0 } : item
          ));
          continue;
        }

        setUploadProgress(prev => prev.map((item, idx) => 
          idx === i ? { ...item, progress: 50 } : item
        ));

        const result = await uploadSingleImage(file, user.id);

        if (result.success) {
          setUploadProgress(prev => prev.map((item, idx) => 
            idx === i ? { 
              ...item, 
              status: 'completed', 
              progress: 100,
              url: result.url 
            } : item
          ));
        } else {
          setUploadProgress(prev => prev.map((item, idx) => 
            idx === i ? { 
              ...item, 
              status: 'error', 
              error: result.error,
              progress: 0 
            } : item
          ));
        }
      }

      const uploadedUrls = uploadProgress
        .filter(p => p.status === 'completed' && p.url)
        .map(p => p.url!);

      if (uploadedUrls.length === 0) {
        throw new Error("No images were uploaded successfully");
      }

      await updateUser({ userPhotos: { userSelfies: uploadedUrls } });

      return true;
    } catch (error: any) {
      console.error("Error uploading images:", error);
      setError(`Failed to upload images: ${error.message || "Unknown error"}`);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const resetProgress = useCallback(() => {
    setUploadProgress([]);
    setError(null);
  }, []);

  return { 
    uploadImages, 
    isUploading, 
    error, 
    uploadProgress,
    resetProgress 
  };
};