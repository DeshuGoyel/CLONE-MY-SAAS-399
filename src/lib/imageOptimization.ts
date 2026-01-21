import { logger } from './logger';

export interface ImageOptimizationOptions {
  quality?: number; // 0-1
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  progressive?: boolean;
  compressionLevel?: number; // 0-9
}

export class ImageOptimizer {
  static async optimizeImage(
    imageUrl: string,
    options: ImageOptimizationOptions = {}
  ): Promise<{ 
    optimizedUrl: string; 
    originalSize: number; 
    optimizedSize: number; 
    format: string; 
    dimensions: { width: number; height: number };
  }> {
    try {
      // In a real implementation, this would use a CDN or image optimization service
      // For now, we'll simulate the optimization process
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const originalSize = blob.size;
      
      // Simulate optimization based on options
      const format = options.format || 'webp';
      const quality = options.quality !== undefined ? options.quality : 0.8;
      const optimizedSize = Math.round(originalSize * quality * 0.8); // Simulate 20% reduction from quality + format change
      
      // Get image dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });
      
      const dimensions = {
        width: options.width || img.width,
        height: options.height || img.height,
      };
      
      if (options.maintainAspectRatio !== false && options.width && options.height) {
        const aspectRatio = img.width / img.height;
        if (options.width / options.height > aspectRatio) {
          dimensions.width = options.height * aspectRatio;
        } else {
          dimensions.height = options.width / aspectRatio;
        }
      }
      
      logger.info('Image optimization completed', {
        originalSize,
        optimizedSize,
        format,
        dimensions,
        quality,
      });
      
      return {
        optimizedUrl: imageUrl, // In real implementation, this would be the CDN URL
        originalSize,
        optimizedSize,
        format,
        dimensions,
      };
    } catch (error: any) {
      logger.error('Image optimization failed', {
        imageUrl,
        error: error.message,
        options,
      });
      
      throw new Error(`Image optimization failed: ${error.message}`);
    }
  }

  static getOptimizedUrl(
    baseUrl: string,
    options: ImageOptimizationOptions = {}
  ): string {
    // Generate CDN-style optimized URL parameters
    const params = new URLSearchParams();
    
    if (options.format) {
      params.append('format', options.format);
    }
    
    if (options.quality !== undefined) {
      params.append('quality', Math.round(options.quality * 100).toString());
    }
    
    if (options.width) {
      params.append('width', options.width.toString());
    }
    
    if (options.height) {
      params.append('height', options.height.toString());
    }
    
    if (options.maintainAspectRatio !== undefined) {
      params.append('maintainAspectRatio', options.maintainAspectRatio.toString());
    }
    
    if (options.progressive !== undefined) {
      params.append('progressive', options.progressive.toString());
    }
    
    if (options.compressionLevel !== undefined) {
      params.append('compression', options.compressionLevel.toString());
    }
    
    // In a real implementation, this would be the CDN URL
    return `${baseUrl}?${params.toString()}`;
  }

  static getFormatRecommendation(
    userAgent: string,
    imageType: 'photo' | 'graphic' | 'icon' = 'photo'
  ): { format: string; quality: number } {
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isFirefox = userAgent.includes('Firefox');
    const isModernBrowser = !isSafari && !isFirefox;
    
    if (imageType === 'photo') {
      if (isModernBrowser) {
        return { format: 'avif', quality: 0.8 };
      } else if (isSafari) {
        return { format: 'webp', quality: 0.85 };
      } else {
        return { format: 'jpeg', quality: 0.85 };
      }
    } else if (imageType === 'graphic') {
      if (isModernBrowser) {
        return { format: 'webp', quality: 0.9 };
      } else {
        return { format: 'png', quality: 1 };
      }
    } else { // icon
      return { format: 'png', quality: 1 };
    }
  }

  static calculateSizeReduction(
    originalSize: number,
    format: string,
    quality: number
  ): number {
    // Estimate size reduction based on format and quality
    let formatFactor = 1;
    
    switch (format) {
      case 'avif':
        formatFactor = 0.6; // AVIF is typically 40% smaller than JPEG
        break;
      case 'webp':
        formatFactor = 0.7; // WebP is typically 30% smaller than JPEG
        break;
      case 'jpeg':
        formatFactor = 1;
        break;
      case 'png':
        formatFactor = 1.2; // PNG can be larger than JPEG for photos
        break;
    }
    
    const qualityFactor = quality;
    const estimatedSize = originalSize * formatFactor * qualityFactor;
    
    return Math.round(originalSize - estimatedSize);
  }

  static async generateResponsiveSrcSet(
    imageUrl: string,
    sizes: number[] = [300, 600, 1200, 2400]
  ): Promise<{ 
    srcSet: string; 
    sizes: string;
  }> {
    try {
      // Get original image dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });
      
      const aspectRatio = img.width / img.height;
      
      // Generate srcset
      const srcSetParts = sizes.map(size => {
        const width = size;
        const height = Math.round(size / aspectRatio);
        const optimizedUrl = this.getOptimizedUrl(imageUrl, {
          width,
          height,
          format: 'webp',
          quality: 0.8,
        });
        return `${optimizedUrl} ${width}w`;
      });
      
      const srcSet = srcSetParts.join(', ');
      const sizesAttr = `(max-width: 600px) ${sizes[0]}px, (max-width: 1200px) ${sizes[1]}px, ${sizes[2]}px`;
      
      return { srcSet, sizes: sizesAttr };
    } catch (error: any) {
      logger.error('Failed to generate responsive srcset', {
        imageUrl,
        error: error.message,
      });
      
      throw new Error(`Failed to generate srcset: ${error.message}`);
    }
  }

  static async optimizeImageForDevice(
    imageUrl: string,
    userAgent: string,
    maxWidth: number = 2000
  ): Promise<{ 
    optimizedUrl: string; 
    format: string; 
    quality: number;
  }> {
    try {
      // Get device information from user agent
      const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
      const isHighDpi = /iPhone|iPad|iPod|Macintosh/.test(userAgent); // Simple heuristic
      
      // Determine target width based on device
      let targetWidth = maxWidth;
      if (isMobile) {
        targetWidth = Math.min(1200, maxWidth);
      }
      
      // Get format recommendation
      const formatRec = this.getFormatRecommendation(userAgent, 'photo');
      
      // Determine quality based on device
      let quality = formatRec.quality;
      if (isHighDpi) {
        quality = Math.min(0.95, quality + 0.1);
      }
      
      const optimizedUrl = this.getOptimizedUrl(imageUrl, {
        width: targetWidth,
        format: formatRec.format,
        quality,
        maintainAspectRatio: true,
      });
      
      return {
        optimizedUrl,
        format: formatRec.format,
        quality,
      };
    } catch (error: any) {
      logger.error('Failed to optimize image for device', {
        imageUrl,
        userAgent,
        error: error.message,
      });
      
      throw new Error(`Device optimization failed: ${error.message}`);
    }
  }

  static async batchOptimizeImages(
    imageUrls: string[],
    options: ImageOptimizationOptions = {}
  ): Promise<{ 
    results: Array<{ 
      originalUrl: string; 
      optimizedUrl: string; 
      originalSize: number; 
      optimizedSize: number; 
      format: string;
    }>; 
    totalOriginalSize: number; 
    totalOptimizedSize: number; 
    totalReduction: number; 
    reductionPercentage: number;
  }> {
    try {
      const results = [];
      let totalOriginalSize = 0;
      let totalOptimizedSize = 0;
      
      for (const url of imageUrls) {
        const result = await this.optimizeImage(url, options);
        results.push({
          originalUrl: url,
          optimizedUrl: result.optimizedUrl,
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
          format: result.format,
        });
        
        totalOriginalSize += result.originalSize;
        totalOptimizedSize += result.optimizedSize;
      }
      
      const totalReduction = totalOriginalSize - totalOptimizedSize;
      const reductionPercentage = totalOriginalSize > 0 
        ? Math.round((totalReduction / totalOriginalSize) * 100) 
        : 0;
      
      logger.info('Batch image optimization completed', {
        imageCount: imageUrls.length,
        totalOriginalSize,
        totalOptimizedSize,
        totalReduction,
        reductionPercentage,
      });
      
      return {
        results,
        totalOriginalSize,
        totalOptimizedSize,
        totalReduction,
        reductionPercentage,
      };
    } catch (error: any) {
      logger.error('Batch image optimization failed', {
        imageCount: imageUrls.length,
        error: error.message,
      });
      
      throw new Error(`Batch optimization failed: ${error.message}`);
    }
  }

  static getImageFormatFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (extension === 'jpg' || extension === 'jpeg') return 'jpeg';
    if (extension === 'png') return 'png';
    if (extension === 'webp') return 'webp';
    if (extension === 'avif') return 'avif';
    if (extension === 'gif') return 'gif';
    
    return 'unknown';
  }

  static isImageUrl(url: string): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'];
    const extension = url.split('.').pop()?.toLowerCase();
    
    return extension ? imageExtensions.includes(extension) : false;
  }

  static async preloadImages(imageUrls: string[]): Promise<void> {
    try {
      await Promise.all(
        imageUrls.map(url => new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        }))
      );
      
      logger.debug('Image preloading completed', {
        imageCount: imageUrls.length,
      });
    } catch (error: any) {
      logger.warn('Image preloading failed for some images', {
        error: error.message,
      });
    }
  }
}