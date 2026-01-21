import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { rateLimiter } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/apiHelpers';

export async function securityMiddleware(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  const path = request.nextUrl.pathname;
  const method = request.method;
  const clientIp = getClientIp(request);

  logger.debug('Security middleware processing request', {
    requestId,
    path,
    method,
    clientIp,
  });

  // Security headers
  const response = NextResponse.next();

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.supabase.co; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https://*.supabase.co https://*.stripe.com https://*.amazonaws.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' https://*.supabase.co https://*.stripe.com https://api.astria.ai; " +
    "frame-src 'self' https://*.stripe.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self' https://*.stripe.com; " +
    "frame-ancestors 'none'"
  );

  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Content Type Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Frame Options
  response.headers.set('X-Frame-Options', 'DENY');

  // Strict Transport Security
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  // Rate limiting for API routes
  if (path.startsWith('/api/')) {
    const rateLimitConfig = {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 100, // 100 requests per hour per IP
    };

    const rateLimitResult = await rateLimiter.checkLimit(clientIp, rateLimitConfig);

    if (!rateLimitResult.allowed) {
      logger.warn('API rate limit exceeded', {
        requestId,
        path,
        clientIp,
        remaining: rateLimitResult.remaining,
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
      });

      return new NextResponse(JSON.stringify({
        error: 'Too Many Requests',
        message: 'API rate limit exceeded',
        requestId,
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          'X-Request-ID': requestId,
        },
      });
    }

    // Add rate limit headers to all API responses
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
  }

  // Add request ID header for tracing
  response.headers.set('X-Request-ID', requestId);

  const duration = Date.now() - startTime;

  logger.info('Security middleware completed', {
    requestId,
    path,
    method,
    clientIp,
    duration,
    status: response.status,
  });

  return response;
}