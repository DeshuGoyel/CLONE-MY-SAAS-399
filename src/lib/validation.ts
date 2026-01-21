import { z } from 'zod';
import { logger } from './logger';

export const imageValidationSchema = z.object({
  file: z.instanceof(File),
  type: z.string().refine((val) => 
    ['image/jpeg', 'image/png'].includes(val),
    { message: 'Only JPEG and PNG images are allowed' }
  ),
  size: z.number().max(5 * 1024 * 1024, 
    { message: 'Maximum file size is 5MB' }
  ),
});

export const paymentValidationSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(3).max(3, 'Currency must be 3 characters'),
  customerEmail: z.string().email('Invalid email format'),
});

export const webhookValidationSchema = z.object({
  webhook_secret: z.string().min(1, 'Webhook secret is required'),
  user_id: z.string().min(1, 'User ID is required'),
  timestamp: z.string().datetime('Invalid timestamp format'),
});

export const referralValidationSchema = z.object({
  referralCode: z.string()
    .min(8, 'Referral code must be 8 characters')
    .max(8, 'Referral code must be 8 characters')
    .regex(/^[A-Z0-9]+$/, 'Referral code must be alphanumeric uppercase'),
});

export const apiRequestValidationSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  path: z.string().min(1, 'Path is required'),
  headers: z.record(z.string()),
  body: z.any().optional(),
});

export const userInputValidationSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  planType: z.enum(['basic', 'professional', 'executive']),
  customPrompt: z.string().max(500, 'Custom prompt must be 500 characters or less').optional(),
});

export const imageDimensionsSchema = z.object({
  width: z.number().min(300, 'Minimum width is 300px').max(8000, 'Maximum width is 8000px'),
  height: z.number().min(300, 'Minimum height is 300px').max(8000, 'Maximum height is 8000px'),
});

export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join('.')} - ${err.message}`)
        .join('; ');
      logger.warn('Validation failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
    logger.error('Unexpected validation error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: 'Validation failed' };
  }
}

export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const validation = validateWithSchema(imageValidationSchema, {
    file,
    type: file.type,
    size: file.size,
  });
  
  return {
    valid: validation.success,
    error: validation.error,
  };
}

export function validatePaymentData(data: unknown): {
  success: boolean;
  data?: z.infer<typeof paymentValidationSchema>;
  error?: string;
} {
  return validateWithSchema(paymentValidationSchema, data);
}

export function validateWebhookData(data: unknown): {
  success: boolean;
  data?: z.infer<typeof webhookValidationSchema>;
  error?: string;
} {
  return validateWithSchema(webhookValidationSchema, data);
}

export function sanitizeInput(input: string): string {
  // Basic sanitization to prevent XSS and injection
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '&#92;')
    .replace(/\//g, '&#47;')
    .trim();
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}