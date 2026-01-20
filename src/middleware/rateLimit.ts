import { NextResponse } from 'next/server';
import { rateLimiter, rateLimitConfig } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';

export async function withRateLimit(
  request: Request,
  handler: (request: Request) => Promise<NextResponse>,
  options?: {
    userIdExtractor?: (request: Request) => Promise<string | null>;
    limitType?: 'user' | 'ip' | 'astriaPerUser';
  }
): Promise<NextResponse> {
  const limitType = options?.limitType || 'ip';
  const config = rateLimitConfig[limitType];
  
  let identifier: string;
  
  if (limitType === 'user' || limitType === 'astriaPerUser') {
    if (!options?.userIdExtractor) {
      throw new Error('userIdExtractor required for user-based rate limiting');
    }
    
    const userId = await options.userIdExtractor(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    identifier = `${limitType}:${userId}`;
  } else {
    const ip = getClientIp(request);
    identifier = `ip:${ip}`;
  }
  
  const result = await rateLimiter.checkLimit(identifier, config);
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    
    logger.warn('Rate limit exceeded', {
      identifier,
      limitType,
      retryAfter,
    });
    
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    );
  }
  
  const response = await handler(request);
  
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
  
  return response;
}
