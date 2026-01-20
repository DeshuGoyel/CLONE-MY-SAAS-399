type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

interface LogContext {
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      level,
      message,
      ...context,
    };

    const logString = JSON.stringify(logEntry);

    switch (level) {
      case 'DEBUG':
        if (process.env.NODE_ENV === 'development') {
          console.debug(logString);
        }
        break;
      case 'INFO':
        console.info(logString);
        break;
      case 'WARN':
        console.warn(logString);
        break;
      case 'ERROR':
      case 'CRITICAL':
        console.error(logString);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('WARN', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('ERROR', message, context);
  }

  critical(message: string, context?: LogContext): void {
    this.log('CRITICAL', message, context);
  }
}

export const logger = new Logger();
