import { logger } from './logger';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  onOpen?: () => void;
  onClose?: () => void;
  onHalfOpen?: () => void;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private failureCount: number;
  private lastFailureTime: number;
  private resetTimeout: NodeJS.Timeout | null;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.resetTimeout = null;
    
    this.options = {
      failureThreshold: 5,
      resetTimeoutMs: 300000, // 5 minutes
      ...options,
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    switch (this.state) {
      case CircuitBreakerState.OPEN:
        if (this.shouldAttemptHalfOpen()) {
          return this.attemptHalfOpen(operation, fallback, requestId);
        } else {
          logger.warn('Circuit breaker is open, using fallback', { requestId });
          if (fallback) {
            return fallback();
          }
          throw new Error('Circuit breaker is open');
        }
      
      case CircuitBreakerState.HALF_OPEN:
        return this.attemptHalfOpen(operation, fallback, requestId);
      
      case CircuitBreakerState.CLOSED:
      default:
        return this.executeClosed(operation, fallback, requestId);
    }
  }

  private async executeClosed<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    try {
      const result = await operation();
      this.resetFailureCount();
      return result;
    } catch (error) {
      this.recordFailure(requestId);
      
      if (fallback) {
        logger.warn('Operation failed, using fallback', { requestId, error: error instanceof Error ? error.message : 'Unknown error' });
        return fallback();
      }
      
      throw error;
    }
  }

  private async attemptHalfOpen<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    try {
      logger.info('Attempting operation in half-open state', { requestId });
      const result = await operation();
      
      // Success in half-open state - close the circuit
      this.closeCircuit();
      return result;
    } catch (error) {
      // Failure in half-open state - reopen the circuit
      this.openCircuit();
      
      if (fallback) {
        logger.warn('Half-open attempt failed, using fallback', { requestId, error: error instanceof Error ? error.message : 'Unknown error' });
        return fallback();
      }
      
      throw error;
    }
  }

  private recordFailure(requestId?: string) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    logger.warn('Operation failed', {
      requestId,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
    });
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.openCircuit();
    }
  }

  private resetFailureCount() {
    this.failureCount = 0;
  }

  private openCircuit() {
    if (this.state === CircuitBreakerState.OPEN) {
      return;
    }
    
    this.state = CircuitBreakerState.OPEN;
    logger.warn('Circuit breaker opened', {
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
    });
    
    // Schedule circuit reset
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
    
    this.resetTimeout = setTimeout(() => {
      this.state = CircuitBreakerState.HALF_OPEN;
      logger.info('Circuit breaker transitioned to half-open state');
      if (this.options.onHalfOpen) {
        this.options.onHalfOpen();
      }
    }, this.options.resetTimeoutMs);
    
    if (this.options.onOpen) {
      this.options.onOpen();
    }
  }

  private closeCircuit() {
    if (this.state === CircuitBreakerState.CLOSED) {
      return;
    }
    
    this.state = CircuitBreakerState.CLOSED;
    this.resetFailureCount();
    
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    
    logger.info('Circuit breaker closed');
    
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  private shouldAttemptHalfOpen(): boolean {
    if (this.state !== CircuitBreakerState.OPEN) {
      return false;
    }
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.options.resetTimeoutMs;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitBreakerState.HALF_OPEN;
  }

  async manualReset() {
    this.closeCircuit();
  }

  async manualOpen() {
    this.openCircuit();
  }

  getStats(): {
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureTime: number;
    timeUntilReset: number | null;
  } {
    let timeUntilReset: number | null = null;
    
    if (this.state === CircuitBreakerState.OPEN && this.resetTimeout) {
      const resetTime = this.lastFailureTime + this.options.resetTimeoutMs;
      timeUntilReset = Math.max(0, resetTime - Date.now());
    }
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilReset,
    };
  }
}