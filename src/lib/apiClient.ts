import { logger } from './logger';
import { generateRequestId } from './apiHelpers';
import { astriaCircuitBreaker, stripeCircuitBreaker, sendGridCircuitBreaker } from './circuitBreaker';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  requestId: string;
  duration?: number;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  serviceType?: 'astria' | 'stripe' | 'sendgrid' | 'other';
  retryCount?: number;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...defaultHeaders,
    };
  }

  async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 60000,
      serviceType = 'other',
      retryCount = 0,
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const requestHeaders = { ...this.defaultHeaders, ...headers };
    
    logger.debug('API request initiated', {
      requestId,
      url,
      method,
      serviceType,
      retryCount,
    });

    try {
      // Apply circuit breaker based on service type
      const circuitBreaker = this.getCircuitBreaker(serviceType);
      
      const response = await circuitBreaker.call(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const fetchOptions: RequestInit = {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          };

          const fetchResponse = await fetch(url, fetchOptions);
          clearTimeout(timeoutId);

          const responseBody = await this.parseResponse(fetchResponse);
          const duration = Date.now() - startTime;

          if (!fetchResponse.ok) {
            logger.warn('API request failed', {
              requestId,
              url,
              method,
              status: fetchResponse.status,
              statusText: fetchResponse.statusText,
              duration,
            });

            return {
              success: false,
              error: {
                message: responseBody.message || fetchResponse.statusText || 'Request failed',
                code: fetchResponse.status.toString(),
                details: responseBody,
              },
              requestId,
              duration,
            };
          }

          logger.info('API request successful', {
            requestId,
            url,
            method,
            status: fetchResponse.status,
            duration,
          });

          return {
            success: true,
            data: responseBody,
            requestId,
            duration,
          };
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      });

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logger.error('API request failed', {
        requestId,
        url,
        method,
        serviceType,
        error: error.message,
        stack: error.stack,
        duration,
      });

      // Handle specific error types
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: {
            message: 'Request timed out',
            code: 'TIMEOUT',
            details: { timeout },
          },
          requestId,
          duration,
        };
      }

      if (error.message.includes('circuit breaker')) {
        return {
          success: false,
          error: {
            message: error.message,
            code: 'CIRCUIT_BREAKER_OPEN',
          },
          requestId,
          duration,
        };
      }

      return {
        success: false,
        error: {
          message: error.message || 'Unknown error',
          code: 'API_ERROR',
          details: { originalError: error.message },
        },
        requestId,
        duration,
      };
    }
  }

  private getCircuitBreaker(serviceType: ApiRequestOptions['serviceType']) {
    switch (serviceType) {
      case 'astria':
        return astriaCircuitBreaker;
      case 'stripe':
        return stripeCircuitBreaker;
      case 'sendgrid':
        return sendGridCircuitBreaker;
      default:
        return {
          call: async <T>(fn: () => Promise<T>) => fn(),
        };
    }
  }

  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      logger.warn('Failed to parse response body', {
        status: response.status,
        contentType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { message: 'Failed to parse response' };
    }
  }

  async get<T>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  getStatus() {
    return {
      astria: astriaCircuitBreaker.getStatus(),
      stripe: stripeCircuitBreaker.getStatus(),
      sendgrid: sendGridCircuitBreaker.getStatus(),
    };
  }
}

// Singleton instances for common services
export const astriaClient = new ApiClient('https://api.astria.ai', {
  'X-API-Key': process.env.ASTRIA_API_KEY || '',
});

export const stripeClient = new ApiClient('https://api.stripe.com/v1', {
  'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || ''}`,
});

export const sendGridClient = new ApiClient('https://api.sendgrid.com/v3', {
  'Authorization': `Bearer ${process.env.SENDGRID_API_KEY || ''}`,
  'Content-Type': 'application/json',
});