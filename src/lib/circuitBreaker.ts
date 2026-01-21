import { logger } from './logger';

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount: number = 0;
  private nextAttempt: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly serviceName: string;

  constructor(serviceName: string, failureThreshold: number = 5, resetTimeout: number = 300000) {
    this.serviceName = serviceName;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit breaker half-open for ${this.serviceName}`, {
          service: this.serviceName,
          state: this.state,
        });
      } else {
        const retryAfter = Math.ceil((this.nextAttempt - now) / 1000);
        logger.warn(`Circuit breaker open for ${this.serviceName}`, {
          service: this.serviceName,
          retryAfter,
        });
        throw new Error(`Service unavailable. Please try again in ${retryAfter} seconds.`);
      }
    }

    try {
      const result = await fn();
      
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        logger.info(`Circuit breaker closed for ${this.serviceName}`, {
          service: this.serviceName,
          state: this.state,
        });
      }

      return result;
    } catch (error) {
      this.failureCount++;
      
      if (this.failureCount >= this.failureThreshold) {
        this.trip();
      }

      logger.error(`Circuit breaker failure for ${this.serviceName}`, {
        service: this.serviceName,
        failureCount: this.failureCount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private trip(): void {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.resetTimeout;
    
    logger.error(`Circuit breaker tripped for ${this.serviceName}`, {
      service: this.serviceName,
      state: this.state,
      resetTime: new Date(this.nextAttempt).toISOString(),
    });
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttempt = 0;
    
    logger.info(`Circuit breaker reset for ${this.serviceName}`, {
      service: this.serviceName,
      state: this.state,
    });
  }

  getStatus(): {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    nextAttempt?: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.state === 'OPEN' ? this.nextAttempt : undefined,
    };
  }
}

// Global circuit breakers for external services
export const astriaCircuitBreaker = new CircuitBreaker('Astria API', 5, 300000); // 5 failures, 5 minute reset
export const stripeCircuitBreaker = new CircuitBreaker('Stripe API', 3, 180000); // 3 failures, 3 minute reset
export const sendGridCircuitBreaker = new CircuitBreaker('SendGrid API', 4, 240000); // 4 failures, 4 minute reset