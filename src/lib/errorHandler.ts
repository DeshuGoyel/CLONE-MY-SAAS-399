import { logger } from './logger';
import { generateRequestId } from './apiHelpers';

export interface ApiError extends Error {
  statusCode?: number;
  errorCode?: string;
  details?: any;
  isOperational?: boolean;
  requestId?: string;
}

export class ErrorHandler {
  static createError(
    message: string,
    statusCode: number = 500,
    errorCode?: string,
    details?: any,
    isOperational: boolean = true
  ): ApiError {
    const error = new Error(message) as ApiError;
    error.statusCode = statusCode;
    error.errorCode = errorCode;
    error.details = details;
    error.isOperational = isOperational;
    error.requestId = generateRequestId();
    
    return error;
  }

  static handleError(error: unknown, context: string = 'Application'): ApiError {
    const requestId = generateRequestId();
    
    if (error instanceof Error) {
      const apiError = error as ApiError;
      
      if (!apiError.requestId) {
        apiError.requestId = requestId;
      }
      
      if (!apiError.statusCode) {
        apiError.statusCode = 500;
      }
      
      if (!apiError.errorCode) {
        apiError.errorCode = 'INTERNAL_ERROR';
      }
      
      if (apiError.isOperational === undefined) {
        apiError.isOperational = true;
      }
      
      this.logError(apiError, context);
      return apiError;
    } else {
      const unknownError = this.createError(
        'An unknown error occurred',
        500,
        'UNKNOWN_ERROR',
        { originalError: error },
        false
      );
      
      this.logError(unknownError, context);
      return unknownError;
    }
  }

  static logError(error: ApiError, context: string): void {
    const logLevel = error.statusCode && error.statusCode >= 500 ? 'error' : 'warn';
    
    const logData = {
      requestId: error.requestId,
      context,
      errorCode: error.errorCode,
      message: error.message,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      stack: error.stack,
      details: error.details,
    };
    
    if (logLevel === 'error') {
      logger.error('Error occurred', logData);
    } else {
      logger.warn('Error occurred', logData);
    }
  }

  static formatErrorResponse(error: ApiError): {
    error: string;
    errorCode?: string;
    details?: any;
    requestId?: string;
    timestamp: string;
  } {
    return {
      error: error.message,
      errorCode: error.errorCode,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined,
      requestId: error.requestId,
      timestamp: new Date().toISOString(),
    };
  }

  static handleApiError(error: unknown, context: string = 'API'): {
    success: false;
    error: string;
    errorCode?: string;
    details?: any;
    requestId?: string;
    timestamp: string;
  } {
    const apiError = this.handleError(error, context);
    return {
      success: false,
      ...this.formatErrorResponse(apiError),
    };
  }

  static handleHttpError(error: unknown, context: string = 'HTTP'): { 
    response: Response; 
    error: ApiError;
  } {
    const apiError = this.handleError(error, context);
    const responseBody = this.formatErrorResponse(apiError);
    
    return {
      response: new Response(JSON.stringify(responseBody), {
        status: apiError.statusCode || 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': apiError.requestId,
        },
      }),
      error: apiError,
    };
  }

  static createValidationError(
    message: string,
    details: any,
    errorCode: string = 'VALIDATION_ERROR'
  ): ApiError {
    return this.createError(message, 400, errorCode, details, true);
  }

  static createAuthenticationError(
    message: string = 'Authentication failed',
    errorCode: string = 'AUTHENTICATION_ERROR'
  ): ApiError {
    return this.createError(message, 401, errorCode, undefined, true);
  }

  static createAuthorizationError(
    message: string = 'Authorization failed',
    errorCode: string = 'AUTHORIZATION_ERROR'
  ): ApiError {
    return this.createError(message, 403, errorCode, undefined, true);
  }

  static createNotFoundError(
    message: string = 'Resource not found',
    errorCode: string = 'NOT_FOUND_ERROR'
  ): ApiError {
    return this.createError(message, 404, errorCode, undefined, true);
  }

  static createRateLimitError(
    message: string = 'Rate limit exceeded',
    errorCode: string = 'RATE_LIMIT_ERROR',
    retryAfter: number
  ): ApiError {
    return this.createError(message, 429, errorCode, { retryAfter }, true);
  }

  static createConflictError(
    message: string = 'Conflict occurred',
    errorCode: string = 'CONFLICT_ERROR'
  ): ApiError {
    return this.createError(message, 409, errorCode, undefined, true);
  }

  static createServiceUnavailableError(
    message: string = 'Service temporarily unavailable',
    errorCode: string = 'SERVICE_UNAVAILABLE_ERROR'
  ): ApiError {
    return this.createError(message, 503, errorCode, undefined, false);
  }

  static isOperationalError(error: unknown): boolean {
    if (error instanceof Error) {
      const apiError = error as ApiError;
      return apiError.isOperational !== false;
    }
    return true;
  }

  static async handleAsyncError<T>(
    promise: Promise<T>,
    context: string = 'Async Operation'
  ): Promise<{ success: boolean; data?: T; error?: ApiError }> {
    try {
      const data = await promise;
      return { success: true, data };
    } catch (error) {
      const apiError = this.handleError(error, context);
      return { success: false, error: apiError };
    }
  }
}