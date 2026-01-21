import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';

export async function apiLoggingMiddleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const path = request.nextUrl.pathname;
  const method = request.method;
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Skip logging for health checks and static assets
  if (path === '/api/health' || path.startsWith('/_next/')) {
    return NextResponse.next();
  }

  logger.info('API request started', {
    requestId,
    path,
    method,
    clientIp,
    userAgent,
  });

  const response = NextResponse.next();

  // Log response details
  response.then((res) => {
    const duration = Date.now() - startTime;
    
    logger.info('API request completed', {
      requestId,
      path,
      method,
      statusCode: res.status,
      duration,
      clientIp,
    });
    
    return res;
  }).catch((error) => {
    const duration = Date.now() - startTime;
    
    logger.error('API request failed', {
      requestId,
      path,
      method,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      clientIp,
    });
    
    throw error;
  });

  return response;
}