import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

export class IdempotencyManager {
  private supabaseUrl: string;
  private supabaseServiceRoleKey: string;
  private tableName: string;

  constructor(tableName: string = 'webhook_idempotency') {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    this.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.tableName = tableName;

    if (!this.supabaseUrl) {
      throw new Error("MISSING NEXT_PUBLIC_SUPABASE_URL!");
    }

    if (!this.supabaseServiceRoleKey) {
      throw new Error("MISSING SUPABASE_SERVICE_ROLE_KEY!");
    }
  }

  private getSupabaseClient() {
    return createClient(
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
  }

  async checkIdempotency(key: string): Promise<boolean> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from(this.tableName)
        .select('id')
        .eq('idempotency_key', key)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows found", which means the key doesn't exist
        logger.error('Error checking idempotency', {
          key,
          error: error.message,
        });
        return false;
      }

      return !!data;
    } catch (error: any) {
      logger.error('Idempotency check failed', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  async markProcessed(key: string, ttlHours: number = 24): Promise<boolean> {
    try {
      const supabase = this.getSupabaseClient();
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from(this.tableName)
        .upsert({
          idempotency_key: key,
          processed_at: new Date().toISOString(),
          expires_at: expiresAt,
        }, {
          onConflict: 'idempotency_key',
        });

      if (error) {
        logger.error('Error marking idempotency key as processed', {
          key,
          error: error.message,
        });
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error('Failed to mark idempotency key', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  async cleanupExpiredKeys(): Promise<number> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from(this.tableName)
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        logger.error('Error cleaning up expired idempotency keys', {
          error: error.message,
        });
        return 0;
      }

      return data?.length || 0;
    } catch (error: any) {
      logger.error('Idempotency cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  async getProcessedKeys(): Promise<string[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from(this.tableName)
        .select('idempotency_key')
        .gt('expires_at', new Date().toISOString());

      if (error) {
        logger.error('Error fetching processed keys', {
          error: error.message,
        });
        return [];
      }

      return data.map((item: any) => item.idempotency_key);
    } catch (error: any) {
      logger.error('Failed to get processed keys', {
        error: error.message,
      });
      return [];
    }
  }

  generateIdempotencyKey(userId: string, timestamp: string, eventType: string): string {
    // Create a unique key that includes user, timestamp, and event type
    const normalizedTimestamp = new Date(timestamp).toISOString();
    return `webhook_${userId}_${eventType}_${normalizedTimestamp}`;
  }

  async ensureTableExists(): Promise<boolean> {
    try {
      const supabase = this.getSupabaseClient();

      // Check if table exists
      const { data, error } = await supabase
        .rpc('table_exists', {
          table_name: this.tableName,
        });

      if (error) {
        logger.warn('Could not check if idempotency table exists', {
          error: error.message,
        });
        return false;
      }

      if (!data) {
        // Table doesn't exist, create it
        await this.createTable();
        return true;
      }

      return true;
    } catch (error: any) {
      logger.error('Failed to ensure idempotency table exists', {
        error: error.message,
      });
      return false;
    }
  }

  private async createTable(): Promise<boolean> {
    try {
      const supabase = this.getSupabaseClient();

      const { error } = await supabase.rpc('create_idempotency_table', {
        table_name: this.tableName,
      });

      if (error) {
        logger.error('Failed to create idempotency table', {
          error: error.message,
        });
        return false;
      }

      logger.info('Created idempotency table', {
        tableName: this.tableName,
      });

      return true;
    } catch (error: any) {
      logger.error('Idempotency table creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const tableExists = await this.ensureTableExists();
      if (!tableExists) {
        return false;
      }

      // Clean up expired keys on initialization
      await this.cleanupExpiredKeys();

      return true;
    } catch (error: any) {
      logger.error('Idempotency manager initialization failed', {
        error: error.message,
      });
      return false;
    }
  }
}