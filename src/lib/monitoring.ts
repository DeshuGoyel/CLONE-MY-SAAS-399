import { logger } from './logger';
import { generateRequestId } from './apiHelpers';

export interface MonitoringConfig {
  serviceName: string;
  environment: string;
  version: string;
  sampleRate: number;
  enabled: boolean;
}

export class Monitoring {
  private config: MonitoringConfig;
  private initialized: boolean = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      serviceName: 'cvphoto-app',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      sampleRate: 1.0,
      enabled: process.env.NODE_ENV === 'production',
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (!this.config.enabled) {
      logger.info('Monitoring disabled', {
        environment: this.config.environment,
      });
      return;
    }
    
    try {
      // In a real implementation, this would initialize Sentry or other monitoring
      logger.info('Monitoring initialized', {
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        sampleRate: this.config.sampleRate,
      });
      
      this.initialized = true;
    } catch (error: any) {
      logger.error('Failed to initialize monitoring', {
        error: error.message,
      });
      this.config.enabled = false;
    }
  }

  captureError(error: unknown, context: Record<string, any> = {}): string {
    if (!this.config.enabled) {
      return '';
    }
    
    const requestId = generateRequestId();
    
    try {
      let errorMessage = 'Unknown error';
      let errorStack: string | undefined;
      let errorType = 'Error';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
        errorType = error.name;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      const errorData = {
        requestId,
        timestamp: new Date().toISOString(),
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        errorType,
        errorMessage,
        errorStack,
        context,
      };
      
      logger.error('Error captured by monitoring', errorData);
      
      // In a real implementation, this would send to Sentry or other service
      // For now, we'll just log it
      
      return requestId;
    } catch (monitoringError: any) {
      logger.error('Monitoring error capture failed', {
        requestId,
        error: monitoringError.message,
        originalError: error,
      });
      return requestId;
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context: Record<string, any> = {}): string {
    if (!this.config.enabled) {
      return '';
    }
    
    const requestId = generateRequestId();
    
    try {
      const messageData = {
        requestId,
        timestamp: new Date().toISOString(),
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        level,
        message,
        context,
      };
      
      switch (level) {
        case 'error':
          logger.error('Monitoring message captured', messageData);
          break;
        case 'warning':
          logger.warn('Monitoring message captured', messageData);
          break;
        case 'info':
        default:
          logger.info('Monitoring message captured', messageData);
          break;
      }
      
      return requestId;
    } catch (monitoringError: any) {
      logger.error('Monitoring message capture failed', {
        requestId,
        error: monitoringError.message,
        message,
      });
      return requestId;
    }
  }

  capturePerformance(
    operation: string,
    durationMs: number,
    context: Record<string, any> = {}
  ): string {
    if (!this.config.enabled) {
      return '';
    }
    
    const requestId = generateRequestId();
    
    try {
      const performanceData = {
        requestId,
        timestamp: new Date().toISOString(),
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        operation,
        durationMs,
        context,
      };
      
      logger.info('Performance metric captured', performanceData);
      
      return requestId;
    } catch (monitoringError: any) {
      logger.error('Performance monitoring failed', {
        requestId,
        error: monitoringError.message,
        operation,
        durationMs,
      });
      return requestId;
    }
  }

  async checkHealth(): Promise<{ 
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: Record<string, string>;
  }> {
    try {
      const checks: Record<string, string> = {};
      
      // Check basic functionality
      checks['basic_functionality'] = 'healthy';
      
      // Check environment variables
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        checks['environment_variables'] = 'degraded';
      } else {
        checks['environment_variables'] = 'healthy';
      }
      
      // Determine overall status
      const statusValues = Object.values(checks);
      const hasUnhealthy = statusValues.includes('unhealthy');
      const hasDegraded = statusValues.includes('degraded');
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (hasUnhealthy) {
        overallStatus = 'unhealthy';
      } else if (hasDegraded) {
        overallStatus = 'degraded';
      }
      
      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
      };
    } catch (error: any) {
      logger.error('Health check failed', {
        error: error.message,
      });
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          health_check: 'failed',
        },
      };
    }
  }

  async trackMetric(
    metricName: string,
    value: number,
    tags: Record<string, string> = {}
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    try {
      const metricData = {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString(),
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        metricName,
        value,
        tags,
      };
      
      logger.debug('Metric tracked', metricData);
      
      // In a real implementation, this would send to a metrics service
    } catch (error: any) {
      logger.error('Metric tracking failed', {
        metricName,
        error: error.message,
      });
    }
  }

  async trackEvent(
    eventName: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    try {
      const eventData = {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString(),
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        eventName,
        properties,
      };
      
      logger.info('Event tracked', eventData);
      
      // In a real implementation, this would send to an analytics service
    } catch (error: any) {
      logger.error('Event tracking failed', {
        eventName,
        error: error.message,
      });
    }
  }

  async withMonitoring<T>(
    operationName: string,
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    if (!this.config.enabled) {
      return operation();
    }
    
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.capturePerformance(operationName, duration, {
        ...context,
        requestId,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.captureError(error, {
        ...context,
        requestId,
        operation: operationName,
        duration,
      });
      
      throw error;
    }
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async setUserContext(userId: string, userData: Record<string, any> = {}): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    try {
      const contextData = {
        userId,
        ...userData,
      };
      
      logger.debug('User context set for monitoring', {
        userId,
        environment: this.config.environment,
      });
      
      // In a real implementation, this would set user context in Sentry
    } catch (error: any) {
      logger.error('Failed to set user context', {
        userId,
        error: error.message,
      });
    }
  }

  async clearUserContext(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    try {
      logger.debug('User context cleared for monitoring');
      
      // In a real implementation, this would clear user context in Sentry
    } catch (error: any) {
      logger.error('Failed to clear user context', {
        error: error.message,
      });
    }
  }

  async captureBreadcrumb(
    message: string,
    category: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    try {
      const breadcrumbData = {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString(),
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        message,
        category,
        data,
      };
      
      logger.debug('Breadcrumb captured', breadcrumbData);
      
      // In a real implementation, this would add a breadcrumb in Sentry
    } catch (error: any) {
      logger.error('Failed to capture breadcrumb', {
        message,
        error: error.message,
      });
    }
  }

  async flush(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    try {
      logger.debug('Flushing monitoring data');
      
      // In a real implementation, this would flush any buffered data
    } catch (error: any) {
      logger.error('Failed to flush monitoring data', {
        error: error.message,
      });
    }
  }

  async close(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    try {
      await this.flush();
      logger.info('Monitoring closed');
      this.initialized = false;
    } catch (error: any) {
      logger.error('Failed to close monitoring', {
        error: error.message,
      });
    }
  }
}