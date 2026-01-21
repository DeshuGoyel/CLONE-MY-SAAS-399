import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';
import { getClientIp } from '@/lib/apiHelpers';

export async function withApiLogging(
  request: NextRequest,
  handler: (request: Request) => Promise<NextResponse>,
  options?: {
    serviceName?: string;
    logSensitiveData?: boolean;
  }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const contentType = request.headers.get('content-type') || 'unknown';
  const method = request.method;
  const path = request.nextUrl.pathname;
  const serviceName = options?.serviceName || 'api';

  // Extract user ID from auth token if available
  let userId: string | undefined;
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // In a real implementation, you would decode the JWT to get user ID
    // For now, we'll just use a placeholder
    userId = token.split('.')[0]; // Simple extraction for logging purposes
  }

  logger.info('API request started', {
    requestId,
    serviceName,
    method,
    path,
    ip,
    userAgent,
    userId,
    contentType,
  });

  try {
    // Log request body for non-sensitive endpoints
    let requestBody: any = undefined;
    if (options?.logSensitiveData !== false && !path.includes('/payment') && !path.includes('/webhook')) {
      try {
        const bodyText = await request.text();
        if (bodyText) {
          try {
            requestBody = JSON.parse(bodyText);
            // Sanitize sensitive fields
            if (requestBody.password) requestBody.password = '[REDACTED]';
            if (requestBody.token) requestBody.token = '[REDACTED]';
            if (requestBody.apiKey) requestBody.apiKey = '[REDACTED]';
          } catch {
            requestBody = '[non-JSON body]';
          }
        }
      } catch (error) {
        // Couldn't read body, continue without it
        logger.debug('Could not read request body for logging', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Reconstruct the request for the handler
    const requestForHandler = request.clone();

    const response = await handler(requestForHandler);
    const duration = Date.now() - startTime;

    logger.info('API request completed', {
      requestId,
      serviceName,
      method,
      path,
      status: response.status,
      duration,
      userId,
      ip,
    });

    // Add request ID to response headers for tracing
    response.headers.set('X-Request-ID', requestId);
    response.headers.set('X-Response-Time', duration.toString());

    return response;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('API request failed', {
      requestId,
      serviceName,
      method,
      path,
      error: error.message,
      stack: error.stack,
      duration,
      userId,
      ip,
    });

    // Return a consistent error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        requestId,
      },
      {
        status: 500,
        headers: {
          'X-Request-ID': requestId,
          'X-Response-Time': duration.toString(),
        },
      }
    );
  }
}

export function logApiError(
  requestId: string,
  error: Error,
  context: {
    serviceName?: string;
    method?: string;
    path?: string;
    userId?: string;
    [key: string]: any;
  } = {}
): void {
  logger.error('API error occurred', {
    requestId,
    serviceName: context.serviceName || 'api',
    method: context.method || 'unknown',
    path: context.path || 'unknown',
    userId: context.userId,
    error: error.message,
    stack: error.stack,
    ...context,
  });
}

export function logApiSuccess(
  requestId: string,
  context: {
    serviceName?: string;
    method?: string;
    path?: string;
    userId?: string;
    duration?: number;
    [key: string]: any;
  } = {}
): void {
  logger.info('API operation successful', {
    requestId,
    serviceName: context.serviceName || 'api',
    method: context.method || 'unknown',
    path: context.path || 'unknown',
    userId: context.userId,
    duration: context.duration,
    ...context,
  });
}