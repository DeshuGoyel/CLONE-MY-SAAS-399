import { logger } from './logger';
import { createClient } from '@supabase/supabase-js';

export class WebhookValidator {
  private supabaseUrl: string;
  private supabaseServiceRoleKey: string;
  private appWebhookSecret: string;

  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    this.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.appWebhookSecret = process.env.APP_WEBHOOK_SECRET || '';

    if (!this.supabaseUrl) {
      throw new Error("MISSING NEXT_PUBLIC_SUPABASE_URL!");
    }

    if (!this.supabaseServiceRoleKey) {
      throw new Error("MISSING SUPABASE_SERVICE_ROLE_KEY!");
    }

    if (!this.appWebhookSecret) {
      throw new Error("MISSING APP_WEBHOOK_SECRET!");
    }
  }

  validateWebhookSecret(
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

  async validateWebhookSignature(
    request: Request,
    signatureHeader: string | null,
    secret: string
  ): Promise<boolean> {
    try {
      const text = await request.text();
      const signature = signatureHeader || '';

      // In a real implementation, you would use Stripe's webhook signing
      // For now, we'll use a simple comparison
      const expectedSignature = this.generateExpectedSignature(text, secret);

      const isValid = signature === expectedSignature;

      if (!isValid) {
        logger.warn('Invalid webhook signature', {
          expected: expectedSignature,
          received: signature,
        });
      }

      return isValid;
    } catch (error: any) {
      logger.error('Webhook signature validation failed', {
        error: error.message,
      });
      return false;
    }
  }

  private generateExpectedSignature(text: string, secret: string): string {
    // Simple HMAC-like signature for demonstration
    // In production, use proper crypto libraries
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(text);
    return hmac.digest('hex');
  }

  async checkRateLimit(
    userId: string,
    ipAddress: string,
    endpoint: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const supabase = createClient(
      this.supabaseUrl,
      this.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    // Check user rate limit
    const userLimitKey = `rate_limit:user:${userId}:${endpoint}`;
    const ipLimitKey = `rate_limit:ip:${ipAddress}:${endpoint}`;

    // In a real implementation, you would check a rate limiting database
    // For now, we'll return a simple response
    return {
      allowed: true,
      remaining: 100,
      resetTime: Date.now() + 3600000,
    };
  }

  async logWebhookRequest(
    request: Request,
    userId: string | null,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const supabase = createClient(
        this.supabaseUrl,
        this.supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      );

      const requestData = {
        timestamp: new Date().toISOString(),
        user_id: userId,
        path: new URL(request.url).pathname,
        method: request.method,
        success,
        error: error || null,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      };

      // In a real implementation, you would log to a database
      logger.info('Webhook request logged', requestData);
    } catch (error: any) {
      logger.error('Failed to log webhook request', {
        error: error.message,
      });
    }
  }

  async validateIdempotency(
    userId: string,
    timestamp: string,
    processedKeys: Set<string>
  ): Promise<boolean> {
    const idempotencyKey = this.generateIdempotencyKey(userId, timestamp);

    if (processedKeys.has(idempotencyKey)) {
      logger.warn('Duplicate webhook detected (idempotency check)', { key: idempotencyKey });
      return true;
    }

    processedKeys.add(idempotencyKey);

    // Clean up old keys after 24 hours
    setTimeout(() => {
      processedKeys.delete(idempotencyKey);
    }, 24 * 60 * 60 * 1000);

    return false;
  }

  generateIdempotencyKey(userId: string, timestamp: string): string {
    return `${userId}_${timestamp}`;
  }

  async validateWebhookData(
    data: any,
    requiredFields: string[]
  ): Promise<{ valid: boolean; error?: string }> {
    for (const field of requiredFields) {
      if (!data[field]) {
        logger.warn('Missing required field in webhook data', { field });
        return {
          valid: false,
          error: `Missing required field: ${field}`,
        };
      }
    }

    return { valid: true };
  }

  async checkWebhookPermissions(
    userId: string,
    webhookType: string
  ): Promise<boolean> {
    // In a real implementation, you would check user permissions
    // For now, we'll return true for all users
    return true;
  }
}