import { useState, useCallback } from 'react';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { updateUser } from '@/action/updateUser';
import { validateImage } from '@/lib/imageValidation';
import { UploadManager } from '@/lib/uploadManager';
import { logger } from '@/lib/logger';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'paused';
  error?: string;
  url?: string;
  speed?: string;
  estimatedTime?: string;
}

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const supabase = createClientComponentClient();
  const uploadManager = new UploadManager();

  const uploadSingleImage = async (
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
      const validation = await uploadManager.validateImageDimensions(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const result = await uploadManager.uploadSingleImage(file, userId, onProgress);
      return result;
    } catch (error: any) {
      logger.error('Image upload failed', {
        fileName: file.name,
        error: error.message,
      });
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
    setIsPaused(false);

    const initialProgress: UploadProgress[] = images.map(({ file }) => ({
      fileName: file.name,
      progress: 0,
      status: 'pending' as const,
      speed: uploadManager.getUploadSpeedEstimate(file.size),
      estimatedTime: uploadManager.getUploadSpeedEstimate(file.size),
    }));
    setUploadProgress(initialProgress);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const results = await uploadManager.uploadMultipleImages(
        images.map(img => img.file),
        user.id,
        (fileIndex, progress) => {
          setUploadProgress(prev => prev.map((item, idx) => 
            idx === fileIndex ? { ...item, status: 'uploading', progress } : item
          ));
        }
      );

      if (!results.success) {
        const errorMessages = results.errors.join('; ');
        setError(`Upload failed: ${errorMessages}`);
        
        setUploadProgress(prev => prev.map((item, idx) => {
          const hasError = results.errors[idx];
          return hasError ? { ...item, status: 'error', error: results.errors[idx] } : item;
        }));
        
        return false;
      }

      await updateUser({ userPhotos: { userSelfies: results.urls } });

      setUploadProgress(prev => prev.map((item, idx) => 
        results.urls[idx] ? { 
          ...item, 
          status: 'completed', 
          progress: 100,
          url: results.urls[idx] 
        } : item
      ));

      return true;
    } catch (error: any) {
      logger.error('Bulk image upload failed', {
        error: error.message,
        stack: error.stack,
      });
      setError(`Failed to upload images: ${error.message || "Unknown error"}`);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const pauseUpload = useCallback(() => {
    setIsPaused(true);
    setUploadProgress(prev => prev.map(item => 
      item.status === 'uploading' ? { ...item, status: 'paused' } : item
    ));
  }, []);

  const resumeUpload = useCallback(() => {
    setIsPaused(false);
    setUploadProgress(prev => prev.map(item => 
      item.status === 'paused' ? { ...item, status: 'uploading' } : item
    ));
  }, []);

  const resetProgress = useCallback(() => {
    setUploadProgress([]);
    setError(null);
    setIsPaused(false);
  }, []);

  return { 
    uploadImages, 
    isUploading, 
    error, 
    uploadProgress,
    resetProgress,
    pauseUpload,
    resumeUpload,
    isPaused
  };
};