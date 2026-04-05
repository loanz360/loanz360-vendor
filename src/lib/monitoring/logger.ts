/**
 * Logger Utility
 * Centralized logging for the application
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogMetadata {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString()
    const metaStr = metadata ? ` | ${JSON.stringify(metadata)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`
  }

  info(message: string, metadata?: LogMetadata): void {
    const formatted = this.formatMessage('info', message, metadata)
    console.log(formatted)
  }

  warn(message: string, metadata?: LogMetadata): void {
    const formatted = this.formatMessage('warn', message, metadata)
    console.warn(formatted)
  }

  error(message: string, error?: Error, metadata?: LogMetadata): void {
    const errorMeta = error
      ? {
          ...metadata,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        }
      : metadata

    const formatted = this.formatMessage('error', message, errorMeta)
    console.error(formatted)

    // In production, you might want to send errors to a service like Sentry
    if (!this.isDevelopment && typeof window === 'undefined') {
      // Server-side error tracking
      // Example: Sentry.captureException(error)
    }
  }

  debug(message: string, metadata?: LogMetadata): void {
    if (this.isDevelopment) {
      const formatted = this.formatMessage('debug', message, metadata)
      console.debug(formatted)
    }
  }
}

const logger = new Logger()

export default logger
