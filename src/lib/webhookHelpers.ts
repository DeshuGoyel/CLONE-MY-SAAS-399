import { logger } from './logger';
import { withRetry, withTimeout } from './apiHelpers';

export function validateWebhookSecret(
  providedSecret: string | null,
  expectedSecret: string
): boolean {
  if (!providedSecret) {
    logger.warn('Webhook secret missing from request');
    return false;
  }

  const isValid = providedSecret.toLowerCase() === expectedSecret.toLowerCase();
  
  if (!isValid) {
    logger.warn('Invalid webhook secret provided', {
      providedLength: providedSecret.length,
    });
  }
  
  return isValid;
}

export async function processWebhookWithRetry<T>(
  webhookData: T,
  processor: (data: T) => Promise<any>,
  context: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const result = await withRetry(
      async () => {
        return await withTimeout(
          processor(webhookData),
          60000,
          `${context} timeout`
        );
      },
      3,
      1000,
      context
    );

    logger.info(`${context} processed successfully`);
    return { success: true, result };
  } catch (error: any) {
    logger.error(`${context} processing failed`, {
      error: error.message,
      stack: error.stack,
    });
    
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

export function generateIdempotencyKey(userId: string, timestamp: string): string {
  return `${userId}_${timestamp}`;
}

export function checkIdempotency(
  processedKeys: Set<string>,
  key: string
): boolean {
  if (processedKeys.has(key)) {
    logger.warn('Duplicate webhook detected (idempotency check)', { key });
    return true;
  }
  
  processedKeys.add(key);
  
  setTimeout(() => {
    processedKeys.delete(key);
  }, 24 * 60 * 60 * 1000);
  
  return false;
}
