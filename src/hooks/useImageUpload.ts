import { useState, useCallback, useRef } from 'react';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { updateUser } from '@/action/updateUser';
import { validateImage } from '@/lib/imageValidation';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'paused';
  error?: string;
  url?: string;
  uploadedBytes?: number;
  totalBytes?: number;
  speed?: string;
  eta?: string;
}

export interface UploadState {
  isUploading: boolean;
  isPaused: boolean;
  error: string | null;
  uploadProgress: UploadProgress[];
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const supabase = createClientComponentClient();
  const uploadQueueRef = useRef<{ file: File; userId: string; chunkIndex: number; retryCount: number }[]>([]);
  const currentUploadRef = useRef<{ file: File; userId: string; chunkIndex: number; retryCount: number } | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const bytesUploadedRef = useRef<number>(0);

  const uploadChunk = async (
    file: File,
    userId: string,
    chunkIndex: number,
    retryCount: number = 0
  ): Promise<{ success: boolean; chunkIndex: number; error?: string }> => {
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const chunkFileName = `${fileName}.part${chunkIndex}`;
      const filePath = `${userId}/selfies/${chunkFileName}`;

      const startByte = chunkIndex * CHUNK_SIZE;
      const endByte = Math.min(startByte + CHUNK_SIZE, file.size);
      const chunk = file.slice(startByte, endByte);

      const { error: uploadError } = await supabase.storage
        .from("userphotos")
        .upload(filePath, chunk, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => 
            setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount))
          );
          return uploadChunk(file, userId, chunkIndex, retryCount + 1);
        }
        throw uploadError;
      }

      return { success: true, chunkIndex };
    } catch (error: any) {
      return { 
        success: false, 
        chunkIndex,
        error: error.message || "Chunk upload failed" 
      };
    }
  };

  const uploadSingleImage = async (
    file: File,
    userId: string,
    fileIndex: number
  ): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${userId}/selfies/${fileName}`;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      let uploadedChunks = 0;
      let uploadFailed = false;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (isPaused) {
          setUploadProgress(prev => prev.map((item, idx) => 
            idx === fileIndex ? { ...item, status: 'paused' as const } : item
          ));
          return { success: false, error: 'Upload paused' };
        }

        const chunkResult = await uploadChunk(file, userId, chunkIndex);
        
        if (!chunkResult.success) {
          uploadFailed = true;
          setUploadProgress(prev => prev.map((item, idx) => 
            idx === fileIndex ? { 
              ...item, 
              status: 'error' as const, 
              error: chunkResult.error,
              progress: Math.round((chunkIndex / totalChunks) * 100)
            } : item
          ));
          break;
        }

        uploadedChunks++;
        const progress = Math.round((uploadedChunks / totalChunks) * 100);
        
        // Calculate speed and ETA
        const now = Date.now();
        if (startTimeRef.current === null) {
          startTimeRef.current = now;
        }
        
        const elapsed = (now - startTimeRef.current) / 1000; // seconds
        const bytesUploaded = uploadedChunks * CHUNK_SIZE;
        bytesUploadedRef.current = bytesUploaded;
        
        const speed = elapsed > 0 ? (bytesUploaded / elapsed) : 0; // bytes per second
        const remainingBytes = file.size - bytesUploaded;
        const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

        setUploadProgress(prev => prev.map((item, idx) => 
          idx === fileIndex ? { 
            ...item, 
            status: 'uploading' as const,
            progress,
            uploadedBytes: bytesUploaded,
            totalBytes: file.size,
            speed: formatSpeed(speed),
            eta: formatETA(eta)
          } : item
        ));
      }

      if (uploadFailed) {
        return { success: false, error: 'Chunk upload failed' };
      }

      // After all chunks are uploaded, create the final file
      const { error: uploadError } = await supabase.storage
        .from("userphotos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
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

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const formatETA = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const uploadImages = async (images: Array<{ file: File; pixels: number }>) => {
    if (images.length === 0) {
      setError("Please upload at least one image before continuing.");
      return false;
    }

    setIsUploading(true);
    setIsPaused(false);
    setError(null);

    const initialProgress: UploadProgress[] = images.map(({ file }) => ({
      fileName: file.name,
      progress: 0,
      status: 'pending' as const,
      totalBytes: file.size,
      uploadedBytes: 0,
    }));
    setUploadProgress(initialProgress);
    startTimeRef.current = null;
    bytesUploadedRef.current = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (let i = 0; i < images.length; i++) {
        if (isPaused) {
          setUploadProgress(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'paused' as const } : item
          ));
          break;
        }

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
          idx === i ? { ...item, progress: 10 } : item
        ));

        const result = await uploadSingleImage(file, user.id, i);

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
    setIsPaused(false);
  }, []);

  const pauseUpload = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeUpload = useCallback(() => {
    setIsPaused(false);
    // Restart upload from where it left off
    if (uploadProgress.some(p => p.status === 'paused')) {
      setIsUploading(true);
    }
  }, [uploadProgress]);

  const getOverallProgress = useCallback((): { 
    totalProgress: number; 
    completed: number; 
    total: number; 
    speed?: string; 
    eta?: string; 
  } => {
    const completed = uploadProgress.filter(p => p.status === 'completed').length;
    const total = uploadProgress.length;
    const totalProgress = total > 0 
      ? Math.round((completed / total) * 100) 
      : 0;
    
    // Calculate overall speed and ETA
    let overallSpeed: string | undefined;
    let overallETA: string | undefined;
    
    if (startTimeRef.current && bytesUploadedRef.current > 0) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const speed = elapsed > 0 ? (bytesUploadedRef.current / elapsed) : 0;
      overallSpeed = formatSpeed(speed);
      
      const totalBytes = uploadProgress.reduce((sum, p) => sum + (p.totalBytes || 0), 0);
      const remainingBytes = totalBytes - bytesUploadedRef.current;
      const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
      overallETA = formatETA(eta);
    }
    
    return { totalProgress, completed, total, speed: overallSpeed, eta: overallETA };
  }, [uploadProgress]);

  return { 
    uploadImages, 
    isUploading, 
    isPaused,
    error, 
    uploadProgress,
    resetProgress,
    pauseUpload,
    resumeUpload,
    getOverallProgress
  };
};