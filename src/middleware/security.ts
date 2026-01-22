import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';

// Allowed origins for CORS
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'https://cvphoto.app'];

// CSRF token management
const csrfTokens = new Map<string, string>();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.join(', '),
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': ""
    + "default-src 'self'; "
    + "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.supabase.co https://*.googleapis.com; "
    + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    + "img-src 'self' data: https://*.stripe.com https://*.supabase.co https://*.googleapis.com https://*.gstatic.com; "
    + "font-src 'self' https://fonts.gstatic.com; "
    + "connect-src 'self' https://*.stripe.com https://*.supabase.co https://*.googleapis.com; "
    + "frame-src 'self' https://*.stripe.com; "
    + "object-src 'none'; "
    + "base-uri 'self'; "
    + "form-action 'self' https://*.stripe.com; "
    + "frame-ancestors 'none';"
};

export function addSecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const requestId = generateRequestId();
  
  // Clone the response to modify headers
  const secureResponse = NextResponse.next({
    request: {
      headers: response.headers,
    },
  });

  // Add security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    secureResponse.headers.set(key, value);
  });

  // Add CORS headers
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    secureResponse.headers.set('Access-Control-Allow-Origin', origin);
    secureResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  logger.debug('Security headers added', {
    requestId,
    path: request.nextUrl.pathname,
    method: request.method,
  });

  return secureResponse;
}

export function generateCSRFToken(userId: string): string {
  const token = `${userId}-${Math.random().toString(36).substr(2, 16)}-${Date.now()}`;
  csrfTokens.set(userId, token);
  
  // Set timeout to remove token after 1 hour
  setTimeout(() => {
    csrfTokens.delete(userId);
  }, 60 * 60 * 1000);
  
  return token;
}

export function validateCSRFToken(userId: string, token: string): boolean {
  const storedToken = csrfTokens.get(userId);
  
  if (!storedToken) {
    logger.warn('CSRF token not found', { userId });
    return false;
  }
  
  if (storedToken !== token) {
    logger.warn('CSRF token mismatch', { userId });
    return false;
  }
  
  // Token is valid, remove it to prevent reuse
  csrfTokens.delete(userId);
  return true;
}

export function handleOptionsRequest(request: NextRequest): NextResponse {
  const requestId = generateRequestId();
  
  logger.debug('Handling OPTIONS request', {
    requestId,
    path: request.nextUrl.pathname,
  });

  const response = new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });

  return response;
}

export function checkContentType(request: NextRequest, expectedTypes: string[] = ['application/json']): boolean {
  const contentType = request.headers.get('content-type');
  
  if (!contentType) {
    logger.warn('Missing Content-Type header', {
      path: request.nextUrl.pathname,
      method: request.method,
    });
    return false;
  }
  
  const isValid = expectedTypes.some(type => contentType.includes(type));
  
  if (!isValid) {
    logger.warn('Invalid Content-Type', {
      path: request.nextUrl.pathname,
      contentType,
      expectedTypes,
    });
  }
  
  return isValid;
}

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Basic XSS prevention
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&/g, '&amp;')
      .replace(/\"/g, '&quot;')
      .replace(/\'/g, '&#39;');
  } else if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  } else if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, any> = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
}