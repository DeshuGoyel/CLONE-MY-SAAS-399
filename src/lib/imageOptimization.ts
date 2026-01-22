import { logger } from './logger';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'right' | 'bottom' | 'left' | 'faces';
  blur?: number;
  sharpen?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

export interface OptimizedImageUrlOptions extends ImageOptimizationOptions {
  baseUrl: string;
  cdnUrl?: string;
}

export function generateOptimizedImageUrl(options: OptimizedImageUrlOptions): string {
  const {
    baseUrl,
    cdnUrl = 'https://cdn.cvphoto.app',
    width,
    height,
    quality = 85,
    format = 'auto',
    fit = 'cover',
    position = 'center',
    blur,
    sharpen,
    brightness,
    contrast,
    saturation,
  } = options;

  try {
    // Encode the base URL to be used as a parameter
    const encodedUrl = encodeURIComponent(baseUrl);

    // Build query parameters
    const params = new URLSearchParams();

    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    if (quality) params.append('quality', quality.toString());
    if (format && format !== 'auto') params.append('format', format);
    if (fit) params.append('fit', fit);
    if (position) params.append('position', position);
    if (blur) params.append('blur', blur.toString());
    if (sharpen) params.append('sharpen', sharpen.toString());
    if (brightness) params.append('brightness', brightness.toString());
    if (contrast) params.append('contrast', contrast.toString());
    if (saturation) params.append('saturation', saturation.toString());

    // Construct the CDN URL
    const optimizedUrl = `${cdnUrl}/optimize?url=${encodedUrl}&${params.toString()}`;

    logger.debug('Generated optimized image URL', {
      originalUrl: baseUrl,
      optimizedUrl,
      options: {
        width,
        height,
        quality,
        format,
        fit,
        position,
      },
    });

    return optimizedUrl;
  } catch (error) {
    logger.error('Failed to generate optimized image URL', {
      baseUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
      options,
    });
    return baseUrl; // Fallback to original URL
  }
}

export function generateResponsiveImageSrcSet(
  baseUrl: string,
  sizes: number[] = [300, 600, 1200, 2400],
  options: Omit<ImageOptimizationOptions, 'width'> = {}
): string {
  try {
    const srcSet = sizes
      .map(size => {
        const url = generateOptimizedImageUrl({
          baseUrl,
          width: size,
          ...options,
        });
        return `${url} ${size}w`;
      })
      .join(', ');

    logger.debug('Generated responsive image srcset', {
      baseUrl,
      sizes,
      srcSet,
    });

    return srcSet;
  } catch (error) {
    logger.error('Failed to generate responsive image srcset', {
      baseUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return '';
  }
}

export function getOptimalImageFormat(userAgent?: string): 'webp' | 'avif' | 'jpeg' | 'png' {
  if (!userAgent) return 'webp';

  const userAgentLower = userAgent.toLowerCase();

  // AVIF support (modern browsers)
  if (userAgentLower.includes('chrome/') || userAgentLower.includes('edge/') || userAgentLower.includes('opr/')) {
    const chromeVersionMatch = userAgentLower.match(/chrome\/(\d+)/);
    if (chromeVersionMatch) {
      const chromeVersion = parseInt(chromeVersionMatch[1]);
      if (chromeVersion >= 85) return 'avif';
    }
  }

  // WebP support (most modern browsers)
  if (
    userAgentLower.includes('chrome/') ||
    userAgentLower.includes('firefox/') ||
    userAgentLower.includes('edge/') ||
    userAgentLower.includes('opera/') ||
    userAgentLower.includes('safari/')
  ) {
    return 'webp';
  }

  // Fallback to JPEG for older browsers
  return 'jpeg';
}

export function getOptimalQuality(deviceType: 'mobile' | 'desktop' | 'high-dpi' = 'desktop'): number {
  switch (deviceType) {
    case 'mobile':
      return 70; // Lower quality for mobile to save bandwidth
    case 'high-dpi':
      return 90; // Higher quality for high-DPI displays
    case 'desktop':
    default:
      return 85; // Standard quality for desktop
  }
}

export function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for dimension detection'));
    };
    
    img.src = url;
  });
}

export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  
  return `${width / divisor}:${height / divisor}`;
}

export function generateImageAltText(
  description: string,
  userName?: string,
  context?: string
): string {
  let altText = description;
  
  if (userName) {
    altText = `${userName}'s ${description}`;
  }
  
  if (context) {
    altText = `${altText} for ${context}`;
  }
  
  return altText;
}

export function getImageOptimizationPresets() {
  return {
    thumbnail: {
      width: 300,
      height: 300,
      quality: 75,
      format: 'webp' as const,
      fit: 'cover' as const,
    },
    preview: {
      width: 800,
      height: 800,
      quality: 80,
      format: 'webp' as const,
      fit: 'contain' as const,
    },
    full: {
      width: 2000,
      height: 2000,
      quality: 90,
      format: 'webp' as const,
      fit: 'contain' as const,
    },
    print: {
      width: 3000,
      height: 3000,
      quality: 95,
      format: 'png' as const,
      fit: 'contain' as const,
    },
  };
}