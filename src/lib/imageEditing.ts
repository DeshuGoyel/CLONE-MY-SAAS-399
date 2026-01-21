import { logger } from './logger';

export interface ImageEditOptions {
  brightness?: number; // 0-200%
  contrast?: number; // 0-200%
  saturation?: number; // 0-200%
  hue?: number; // 0-360 degrees
  blur?: number; // 0-10px
  sharpen?: number; // 0-10
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  rotate?: number; // degrees
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  resize?: {
    width: number;
    height: number;
    maintainAspectRatio?: boolean;
  };
}

export class ImageEditor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private originalImage: HTMLImageElement | null = null;
  private editHistory: string[] = [];
  private maxHistory: number = 10;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  async loadImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.originalImage = img;
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        this.addToHistory('load');
        resolve();
      };
      img.onerror = (error) => {
        logger.error('Failed to load image', {
          imageUrl,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        reject(new Error('Failed to load image'));
      };
      img.src = imageUrl;
    });
  }

  private addToHistory(action: string): void {
    this.editHistory.push(action);
    if (this.editHistory.length > this.maxHistory) {
      this.editHistory.shift();
    }
  }

  private getCurrentImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  private setImageData(data: ImageData): void {
    this.ctx.putImageData(data, 0, 0);
  }

  applyBrightness(brightness: number): void {
    if (brightness < 0 || brightness > 200) {
      throw new Error('Brightness must be between 0 and 200');
    }

    const factor = brightness / 100;
    const imageData = this.getCurrentImageData();
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * factor); // R
      data[i + 1] = Math.min(255, data[i + 1] * factor); // G
      data[i + 2] = Math.min(255, data[i + 2] * factor); // B
    }

    this.setImageData(imageData);
    this.addToHistory('brightness');
  }

  applyContrast(contrast: number): void {
    if (contrast < 0 || contrast > 200) {
      throw new Error('Contrast must be between 0 and 200');
    }

    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const imageData = this.getCurrentImageData();
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128)); // R
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128)); // G
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128)); // B
    }

    this.setImageData(imageData);
    this.addToHistory('contrast');
  }

  applySaturation(saturation: number): void {
    if (saturation < 0 || saturation > 200) {
      throw new Error('Saturation must be between 0 and 200');
    }

    const factor = saturation / 100;
    const imageData = this.getCurrentImageData();
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      let h = 0, s = 0, l = (max + min) / 2;

      if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
        
        if (max === r) {
          h = ((g - b) / delta) % 6;
        } else if (max === g) {
          h = (b - r) / delta + 2;
        } else {
          h = (r - g) / delta + 4;
        }
        
        h = Math.round(h * 60);
        if (h < 0) h += 360;
      }

      s = s * factor;

      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;

      let newR = 0, newG = 0, newB = 0;
      
      if (h >= 0 && h < 60) {
        newR = c; newG = x; newB = 0;
      } else if (h >= 60 && h < 120) {
        newR = x; newG = c; newB = 0;
      } else if (h >= 120 && h < 180) {
        newR = 0; newG = c; newB = x;
      } else if (h >= 180 && h < 240) {
        newR = 0; newG = x; newB = c;
      } else if (h >= 240 && h < 300) {
        newR = x; newG = 0; newB = c;
      } else {
        newR = c; newG = 0; newB = x;
      }

      data[i] = Math.round((newR + m) * 255); // R
      data[i + 1] = Math.round((newG + m) * 255); // G
      data[i + 2] = Math.round((newB + m) * 255); // B
    }

    this.setImageData(imageData);
    this.addToHistory('saturation');
  }

  applyHue(hue: number): void {
    if (hue < 0 || hue > 360) {
      throw new Error('Hue must be between 0 and 360');
    }

    const imageData = this.getCurrentImageData();
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      let h = 0, s = 0, l = (max + min) / 2;

      if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
        
        if (max === r) {
          h = ((g - b) / delta) % 6;
        } else if (max === g) {
          h = (b - r) / delta + 2;
        } else {
          h = (r - g) / delta + 4;
        }
        
        h = Math.round(h * 60);
        if (h < 0) h += 360;
      }

      const newHue = (h + hue) % 360;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((newHue / 60) % 2) - 1));
      const m = l - c / 2;

      let newR = 0, newG = 0, newB = 0;
      
      if (newHue >= 0 && newHue < 60) {
        newR = c; newG = x; newB = 0;
      } else if (newHue >= 60 && newHue < 120) {
        newR = x; newG = c; newB = 0;
      } else if (newHue >= 120 && newHue < 180) {
        newR = 0; newG = c; newB = x;
      } else if (newHue >= 180 && newHue < 240) {
        newR = 0; newG = x; newB = c;
      } else if (newHue >= 240 && newHue < 300) {
        newR = x; newG = 0; newB = c;
      } else {
        newR = c; newG = 0; newB = x;
      }

      data[i] = Math.round((newR + m) * 255); // R
      data[i + 1] = Math.round((newG + m) * 255); // G
      data[i + 2] = Math.round((newB + m) * 255); // B
    }

    this.setImageData(imageData);
    this.addToHistory('hue');
  }

  applyBlur(blur: number): void {
    if (blur < 0 || blur > 10) {
      throw new Error('Blur must be between 0 and 10');
    }

    if (blur === 0) return;

    const imageData = this.getCurrentImageData();
    const tempData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const radius = Math.floor(blur);
    const weight = 1 / ((radius * 2 + 1) ** 2);

    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.min(Math.max(x + dx, 0), imageData.width - 1);
            const ny = Math.min(Math.max(y + dy, 0), imageData.height - 1);
            const index = (ny * imageData.width + nx) * 4;

            r += tempData.data[index];
            g += tempData.data[index + 1];
            b += tempData.data[index + 2];
            a += tempData.data[index + 3];
            count++;
          }
        }

        const index = (y * imageData.width + x) * 4;
        imageData.data[index] = r * weight;
        imageData.data[index + 1] = g * weight;
        imageData.data[index + 2] = b * weight;
        imageData.data[index + 3] = a * weight;
      }
    }

    this.setImageData(imageData);
    this.addToHistory('blur');
  }

  applySharpen(sharpen: number): void {
    if (sharpen < 0 || sharpen > 10) {
      throw new Error('Sharpen must be between 0 and 10');
    }

    if (sharpen === 0) return;

    const imageData = this.getCurrentImageData();
    const tempData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const factor = sharpen / 5;

    for (let y = 1; y < imageData.height - 1; y++) {
      for (let x = 1; x < imageData.width - 1; x++) {
        const index = (y * imageData.width + x) * 4;
        const centerIndex = index;

        // Get surrounding pixels
        const top = ((y - 1) * imageData.width + x) * 4;
        const bottom = ((y + 1) * imageData.width + x) * 4;
        const left = (y * imageData.width + (x - 1)) * 4;
        const right = (y * imageData.width + (x + 1)) * 4;

        // Apply sharpening kernel
        const r = tempData.data[centerIndex] * (1 + 4 * factor) - 
                  (tempData.data[top] + tempData.data[bottom] + 
                   tempData.data[left] + tempData.data[right]) * factor;
        const g = tempData.data[centerIndex + 1] * (1 + 4 * factor) - 
                  (tempData.data[top + 1] + tempData.data[bottom + 1] + 
                   tempData.data[left + 1] + tempData.data[right + 1]) * factor;
        const b = tempData.data[centerIndex + 2] * (1 + 4 * factor) - 
                  (tempData.data[top + 2] + tempData.data[bottom + 2] + 
                   tempData.data[left + 2] + tempData.data[right + 2]) * factor;

        imageData.data[index] = Math.min(255, Math.max(0, r));
        imageData.data[index + 1] = Math.min(255, Math.max(0, g));
        imageData.data[index + 2] = Math.min(255, Math.max(0, b));
      }
    }

    this.setImageData(imageData);
    this.addToHistory('sharpen');
  }

  flipHorizontal(): void {
    const imageData = this.getCurrentImageData();
    const tempData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const srcIndex = (y * imageData.width + x) * 4;
        const destIndex = (y * imageData.width + (imageData.width - 1 - x)) * 4;

        imageData.data[destIndex] = tempData.data[srcIndex];
        imageData.data[destIndex + 1] = tempData.data[srcIndex + 1];
        imageData.data[destIndex + 2] = tempData.data[srcIndex + 2];
        imageData.data[destIndex + 3] = tempData.data[srcIndex + 3];
      }
    }

    this.setImageData(imageData);
    this.addToHistory('flipHorizontal');
  }

  flipVertical(): void {
    const imageData = this.getCurrentImageData();
    const tempData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const srcIndex = (y * imageData.width + x) * 4;
        const destIndex = ((imageData.height - 1 - y) * imageData.width + x) * 4;

        imageData.data[destIndex] = tempData.data[srcIndex];
        imageData.data[destIndex + 1] = tempData.data[srcIndex + 1];
        imageData.data[destIndex + 2] = tempData.data[srcIndex + 2];
        imageData.data[destIndex + 3] = tempData.data[srcIndex + 3];
      }
    }

    this.setImageData(imageData);
    this.addToHistory('flipVertical');
  }

  rotate(degrees: number): void {
    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const imageData = this.getCurrentImageData();
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;

    // Calculate new dimensions
    const width = imageData.width;
    const height = imageData.height;
    const newWidth = Math.abs(width * cos) + Math.abs(height * sin);
    const newHeight = Math.abs(height * cos) + Math.abs(width * sin);

    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;

    // Translate to center
    tempCtx.translate(newWidth / 2, newHeight / 2);
    tempCtx.rotate(radians);
    tempCtx.drawImage(this.canvas, -width / 2, -height / 2);

    // Update main canvas
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.ctx.drawImage(tempCanvas, 0, 0);

    this.addToHistory('rotate');
  }

  crop(x: number, y: number, width: number, height: number): void {
    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
      throw new Error('Invalid crop dimensions');
    }

    if (x + width > this.canvas.width || y + height > this.canvas.height) {
      throw new Error('Crop area exceeds image dimensions');
    }

    const imageData = this.ctx.getImageData(x, y, width, height);
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.putImageData(imageData, 0, 0);

    this.addToHistory('crop');
  }

  resize(width: number, height: number, maintainAspectRatio: boolean = true): void {
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid resize dimensions');
    }

    if (maintainAspectRatio) {
      const aspectRatio = this.canvas.width / this.canvas.height;
      if (width / height > aspectRatio) {
        width = height * aspectRatio;
      } else {
        height = width / aspectRatio;
      }
    }

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;

    tempCanvas.width = width;
    tempCanvas.height = height;

    // Use high-quality scaling
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(this.canvas, 0, 0, width, height);

    // Update main canvas
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(tempCanvas, 0, 0);

    this.addToHistory('resize');
  }

  reset(): void {
    if (this.originalImage) {
      this.canvas.width = this.originalImage.width;
      this.canvas.height = this.originalImage.height;
      this.ctx.drawImage(this.originalImage, 0, 0);
      this.editHistory = ['load'];
    }
  }

  undo(): boolean {
    if (this.editHistory.length <= 1) {
      return false;
    }

    this.editHistory.pop();
    this.reset();

    // Reapply all edits except the last one
    const historyToReapply = [...this.editHistory];
    historyToReapply.pop(); // Remove the initial 'load'

    // This is a simplified approach - in a real implementation,
    // you would store the actual edit parameters
    return true;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getDataUrl(type: string = 'image/jpeg', quality: number = 0.9): string {
    return this.canvas.toDataURL(type, quality);
  }

  async exportImage(type: string = 'image/jpeg', quality: number = 0.9): Promise<Blob> {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          throw new Error('Failed to export image');
        }
      }, type, quality);
    });
  }

  getDimensions(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  getEditHistory(): string[] {
    return [...this.editHistory];
  }

  clearHistory(): void {
    this.editHistory = this.editHistory.length > 0 ? ['load'] : [];
  }

  applyMultipleEdits(edits: ImageEditOptions): void {
    if (edits.brightness !== undefined) {
      this.applyBrightness(edits.brightness);
    }
    if (edits.contrast !== undefined) {
      this.applyContrast(edits.contrast);
    }
    if (edits.saturation !== undefined) {
      this.applySaturation(edits.saturation);
    }
    if (edits.hue !== undefined) {
      this.applyHue(edits.hue);
    }
    if (edits.blur !== undefined) {
      this.applyBlur(edits.blur);
    }
    if (edits.sharpen !== undefined) {
      this.applySharpen(edits.sharpen);
    }
    if (edits.flipHorizontal) {
      this.flipHorizontal();
    }
    if (edits.flipVertical) {
      this.flipVertical();
    }
    if (edits.rotate !== undefined) {
      this.rotate(edits.rotate);
    }
    if (edits.crop) {
      this.crop(edits.crop.x, edits.crop.y, edits.crop.width, edits.crop.height);
    }
    if (edits.resize) {
      this.resize(edits.resize.width, edits.resize.height, edits.resize.maintainAspectRatio);
    }
  }
}