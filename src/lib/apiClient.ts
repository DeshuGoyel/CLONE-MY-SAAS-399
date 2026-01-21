import { logger } from './logger';
import { withRetry, withTimeout } from './apiHelpers';

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelay?: number;
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeoutMs: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  requestId?: string;
}

export class ApiClient {
  private config: ApiClientConfig;
  private failedRequests: number = 0;
  private circuitOpen: boolean = false;
  private circuitResetTimeout: NodeJS.Timeout | null = null;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeoutMs: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 300000, // 5 minutes
      },
      ...config,
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    requestId?: string
  ): Promise<ApiResponse<T>> {
    if (this.circuitOpen) {
      logger.warn('Circuit breaker is open, failing fast', {
        endpoint,
        method,
        requestId,
      });
      
      return {
        success: false,
        error: 'Service temporarily unavailable',
        statusCode: 503,
        requestId,
      };
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = this.getHeaders();

    try {
      const response = await withRetry(
        async () => {
          return await withTimeout(
            fetch(url, {
              method,
              headers,
              body: body ? JSON.stringify(body) : undefined,
            }),
            this.config.timeoutMs!,
            `${method} ${endpoint} timeout`
          );
        },
        this.config.maxRetries!,
        this.config.retryDelay!,
        `${method} ${endpoint}`
      );

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorData.message || 'No error details'}`
        );
      }

      const data = await response.json();
      
      // Reset failed request counter on success
      this.failedRequests = 0;

      logger.debug('API request successful', {
        endpoint,
        method,
        statusCode: response.status,
        requestId,
      });

      return {
        success: true,
        data,
        statusCode: response.status,
        requestId,
      };
    } catch (error: any) {
      this.failedRequests++;
      
      logger.error('API request failed', {
        endpoint,
        method,
        error: error.message,
        requestId,
        failedRequests: this.failedRequests,
      });

      // Check circuit breaker threshold
      if (this.config.circuitBreaker && 
          this.failedRequests >= this.config.circuitBreaker.failureThreshold) {
        this.openCircuit();
      }

      return {
        success: false,
        error: error.message,
        statusCode: error.message.includes('timeout') ? 408 : 500,
        requestId,
      };
    }
  }

  private async parseErrorResponse(response: Response): Promise<{ message: string; details?: any }> {
    try {
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        return {
          message: errorData.message || 'API error',
          details: errorData,
        };
      } else {
        const text = await response.text();
        return {
          message: text || 'API error',
        };
      }
    } catch (parseError) {
      return {
        message: `API error: ${response.status} ${response.statusText}`,
      };
    }
  }

  private openCircuit() {
    this.circuitOpen = true;
    logger.warn('Circuit breaker opened', {
      failureThreshold: this.config.circuitBreaker?.failureThreshold,
      failedRequests: this.failedRequests,
    });

    // Schedule circuit reset
    if (this.circuitResetTimeout) {
      clearTimeout(this.circuitResetTimeout);
    }

    this.circuitResetTimeout = setTimeout(() => {
      this.resetCircuit();
    }, this.config.circuitBreaker?.resetTimeoutMs || 300000);
  }

  private resetCircuit() {
    this.circuitOpen = false;
    this.failedRequests = 0;
    logger.info('Circuit breaker reset');
  }

  async get<T>(endpoint: string, requestId?: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, 'GET', undefined, requestId);
  }

  async post<T>(endpoint: string, body: any, requestId?: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, 'POST', body, requestId);
  }

  async put<T>(endpoint: string, body: any, requestId?: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, 'PUT', body, requestId);
  }

  async delete<T>(endpoint: string, requestId?: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, 'DELETE', undefined, requestId);
  }

  async patch<T>(endpoint: string, body: any, requestId?: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, 'PATCH', body, requestId);
  }

  getCircuitStatus(): { open: boolean; failedRequests: number } {
    return {
      open: this.circuitOpen,
      failedRequests: this.failedRequests,
    };
  }

  async closeCircuitManually() {
    this.resetCircuit();
    if (this.circuitResetTimeout) {
      clearTimeout(this.circuitResetTimeout);
      this.circuitResetTimeout = null;
    }
  }

  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
          },
        };
      } else {
        return {
          success: false,
          error: 'Health check failed',
          statusCode: response.status,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Health check error: ${error.message}`,
        statusCode: 503,
      };
    }
  }
}