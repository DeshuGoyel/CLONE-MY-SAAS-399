import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "./logger";
import { withRetry, withTimeout } from "./apiHelpers";

interface UploadConfig {
  maxFileSize: number;
  allowedTypes: string[];
  maxTotalSize: number;
  chunkSize: number;
  maxRetries: number;
  retryDelay: number;
}

export class UploadManager {
  private supabase: any;
  private config: UploadConfig;

  constructor(config?: Partial<UploadConfig>) {
    this.supabase = createClientComponentClient();
    this.config = {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png'],
      maxTotalSize: 50 * 1024 * 1024, // 50MB
      chunkSize: 2 * 1024 * 1024, // 2MB chunks
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  private validateFile(file: File): { valid: boolean; error?: string } {
    if (!this.config.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Only ${this.config.allowedTypes.join(', ')} are allowed.`,
      };
    }

    if (file.size > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${this.config.maxFileSize / 1024 / 1024}MB.`,
      };
    }

    return { valid: true };
  }

  private async uploadWithRetry(
    filePath: string,
    file: File,
    retryCount: number = 0
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const result = await withRetry(
        async () => {
          return await withTimeout(
            this.supabase.storage
              .from("userphotos")
              .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
              }),
            60000,
            "Upload timeout"
          );
        },
        this.config.maxRetries,
        this.config.retryDelay,
        `Upload ${file.name}`
      );

      if (result.error) {
        throw result.error;
      }

      const { data: { publicUrl } } = this.supabase.storage
        .from("userphotos")
        .getPublicUrl(filePath);

      return { success: true, url: publicUrl };
    } catch (error: any) {
      logger.error(`Upload failed for ${file.name}`, {
        error: error.message,
        retryCount,
        maxRetries: this.config.maxRetries,
      });

      return {
        success: false,
        error: error.message || "Upload failed",
      };
    }
  }

  async uploadSingleImage(
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${userId}/selfies/${fileName}`;

      // Simulate progress for now (would be enhanced with actual chunked upload)
      if (onProgress) {
        onProgress(30);
      }

      const result = await this.uploadWithRetry(filePath, file);

      if (result.success) {
        if (onProgress) {
          onProgress(100);
        }
        return result;
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Upload failed",
      };
    }
  }

  async uploadMultipleImages(
    files: File[],
    userId: string,
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<{ success: boolean; urls: string[]; errors: string[] }> {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > this.config.maxTotalSize) {
      return {
        success: false,
        urls: [],
        errors: [`Total upload size exceeds ${this.config.maxTotalSize / 1024 / 1024}MB limit`],
      };
    }

    const results = await Promise.all(
      files.map(async (file, index) => {
        const result = await this.uploadSingleImage(file, userId, (progress) => {
          if (onProgress) {
            onProgress(index, progress);
          }
        });
        return result;
      })
    );

    const successfulUrls = results
      .filter((result) => result.success && result.url)
      .map((result) => result.url!);

    const errors = results
      .filter((result) => !result.success)
      .map((result) => result.error || "Unknown error");

    return {
      success: errors.length === 0,
      urls: successfulUrls,
      errors,
    };
  }

  async validateImageDimensions(file: File, minWidth: number = 300, maxWidth: number = 8000): Promise<{ valid: boolean; error?: string; dimensions?: { width: number; height: number } }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < minWidth || img.height < minWidth) {
          resolve({
            valid: false,
            error: `Image dimensions too small. Minimum ${minWidth}x${minWidth} pixels required.`,
            dimensions: { width: img.width, height: img.height },
          });
        } else if (img.width > maxWidth || img.height > maxWidth) {
          resolve({
            valid: false,
            error: `Image dimensions too large. Maximum ${maxWidth}x${maxWidth} pixels allowed.`,
            dimensions: { width: img.width, height: img.height },
          });
        } else {
          resolve({
            valid: true,
            dimensions: { width: img.width, height: img.height },
          });
        }
      };
      img.onerror = () => {
        resolve({
          valid: false,
          error: "Failed to load image for validation.",
        });
      };
      img.src = URL.createObjectURL(file);
    });
  }

  getUploadSpeedEstimate(fileSize: number): string {
    // Estimate based on typical network speeds (simplified)
    const estimatedSpeed = 1 * 1024 * 1024; // 1MB/s conservative estimate
    const estimatedTime = fileSize / estimatedSpeed;
    
    if (estimatedTime < 1) {
      return "< 1 second";
    } else if (estimatedTime < 60) {
      return `${Math.round(estimatedTime)} seconds`;
    } else {
      return `${Math.round(estimatedTime / 60)} minutes`;
    }
  }
}