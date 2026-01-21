// Monitoring and Error Tracking Utility
// This provides a unified interface for error tracking and monitoring
// Currently implements basic logging, but can be extended with Sentry, Datadog, etc.

import { logger } from './logger';
import { generateRequestId } from './apiHelpers';

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  service?: string;
  endpoint?: string;
  method?: string;
  [key: string]: any;
}

export interface MonitoringEvent {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  context?: ErrorContext;
  error?: Error;
}

class MonitoringService {
  private enabled: boolean;
  private environment: string;
  private serviceName: string;

  constructor() {
    this.enabled = process.env.ENABLE_PERFORMANCE_MONITORING === 'true';
    this.environment = process.env.NODE_ENV || 'development';
    this.serviceName = process.env.npm_package_name || 'cvphoto-app';
  }

  captureError(error: Error, context: ErrorContext = {}): void {
    if (!this.enabled) {
      logger.debug('Error tracking disabled', { error: error.message });
      return;
    }

    const requestId = context.requestId || generateRequestId();
    const errorContext = {
      service: this.serviceName,
      environment: this.environment,
      timestamp: new Date().toISOString(),
      ...context,
      requestId,
    };

    // Log to structured logger
    logger.error(error.message, errorContext);

    // In a real implementation, this would also send to Sentry/Datadog
    // For now, we'll just use the structured logger
    
    if (error.stack) {
      logger.debug('Error stack trace', {
        requestId,
        stack: error.stack,
      });
    }
  }

  captureMessage(message: string, context: ErrorContext = {}): void {
    if (!this.enabled) {
      logger.debug('Message tracking disabled', { message });
      return;
    }

    const requestId = context.requestId || generateRequestId();
    const messageContext = {
      service: this.serviceName,
      environment: this.environment,
      timestamp: new Date().toISOString(),
      ...context,
      requestId,
    };

    logger.info(message, messageContext);
  }

  trackPerformance(
    operation: string,
    duration: number,
    context: ErrorContext = {}
  ): void {
    if (!this.enabled) {
      return;
    }

    const requestId = context.requestId || generateRequestId();
    const performanceContext = {
      service: this.serviceName,
      environment: this.environment,
      timestamp: new Date().toISOString(),
      operation,
      duration,
      ...context,
      requestId,
    };

    if (duration > 1000) {
      // Log slow operations as warnings
      logger.warn('Slow operation detected', performanceContext);
    } else {
      logger.debug('Operation performance', performanceContext);
    }
  }

  setUserContext(userId: string, userData: any = {}): void {
    if (!this.enabled) {
      return;
    }

    logger.info('User context set for monitoring', {
      userId,
      ...userData,
    });
  }

  captureException(error: Error, context: ErrorContext = {}): void {
    // Alias for captureError for compatibility
    this.captureError(error, context);
  }

  async withMonitoring<T>(
    operationName: string,
    fn: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    const requestId = context.requestId || generateRequestId();
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.trackPerformance(operationName, duration, { ...context, requestId });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.captureError(error as Error, { 
        ...context,
        requestId,
        operation: operationName,
        duration,
      });
      
      throw error;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getEnvironment(): string {
    return this.environment;
  }

  getServiceName(): string {
    return this.serviceName;
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

// Convenience functions for common monitoring scenarios
export function monitorApiEndpoint(
  endpoint: string,
  handler: (...args: any[]) => Promise<any>
): (...args: any[]) => Promise<any> {
  return async (...args: any[]) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      monitoring.trackPerformance(`api:${endpoint}`, duration, {
        requestId,
        endpoint,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      monitoring.captureError(error as Error, {
        requestId,
        endpoint,
        duration,
      });

      throw error;
    }
  };
}

export function monitorDatabaseQuery(
  queryName: string,
  handler: (...args: any[]) => Promise<any>
): (...args: any[]) => Promise<any> {
  return async (...args: any[]) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      monitoring.trackPerformance(`db:${queryName}`, duration, {
        requestId,
        queryName,
      });

      if (duration > 1000) {
        monitoring.captureMessage('Slow database query detected', {
          requestId,
          queryName,
          duration,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      monitoring.captureError(error as Error, {
        requestId,
        queryName,
        duration,
      });

      throw error;
    }
  };
}

export function monitorExternalApi(
  serviceName: string,
  handler: (...args: any[]) => Promise<any>
): (...args: any[]) => Promise<any> {
  return async (...args: any[]) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      monitoring.trackPerformance(`external:${serviceName}`, duration, {
        requestId,
        serviceName,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      monitoring.captureError(error as Error, {
        requestId,
        serviceName,
        duration,
      });

      throw error;
    }
  };
}

// Health check monitoring
export async function monitorHealthCheck(
  checkName: string,
  checkFn: () => Promise<{ healthy: boolean; details?: any }>
): Promise<{ healthy: boolean; details?: any; monitored: true }> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const result = await checkFn();
    const duration = Date.now() - startTime;

    if (result.healthy) {
      monitoring.trackPerformance(`health:${checkName}`, duration, {
        requestId,
        checkName,
        status: 'healthy',
      });
    } else {
      monitoring.captureMessage('Health check failed', {
        requestId,
        checkName,
        details: result.details,
        duration,
      });
    }

    return { ...result, monitored: true };
  } catch (error) {
    const duration = Date.now() - startTime;

    monitoring.captureError(error as Error, {
      requestId,
      checkName,
      duration,
    });

    return { healthy: false, details: { error: error instanceof Error ? error.message : 'Unknown error' }, monitored: true };
  }
}