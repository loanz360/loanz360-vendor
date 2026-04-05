/**
 * Centralized Logger Utility
 *
 * Production behavior:
 *   - Only logs 'warn', 'error', and 'fatal' levels
 *   - Debug and info logs are suppressed to reduce noise
 *   - Structured JSON output for log aggregation services
 *
 * Development behavior:
 *   - All log levels are shown
 *   - Formatted output with emojis for readability
 *
 * Usage:
 *   import { logger, offersLogger, apiLogger } from '@/lib/utils/logger'
 *   logger.info('Operation completed', { userId: '123' })
 *   logger.error('Operation failed', error, { offerId: 'abc' })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogContext {
  [key: string]: unknown
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development'
  private isProd = process.env.NODE_ENV === 'production'
  private module: string
  private minLevel: LogLevel

  constructor(module: string = 'APP', minLevel?: LogLevel) {
    this.module = module
    // In production, only log warnings and above by default
    // In development, log everything
    this.minLevel = minLevel ?? (this.isProd ? 'warn' : 'debug')
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel]
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return

    const timestamp = new Date().toISOString()
    const logEntry = { level, module: this.module, message, timestamp, ...context }

    const emoji: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      fatal: '🔥'
    }

    if (this.isProd) {
      // Structured JSON for log aggregation in production
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(logEntry))
    } else {
      // Human-readable format for development
      // eslint-disable-next-line no-console
      console.log(`${emoji[level]} [${this.module}] ${message}`, context || '')
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: this.isDev ? error.stack : undefined }
        : error
          ? { error }
          : {}
    this.log('error', message, { ...errorContext, ...context })
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : error
          ? { error }
          : {}
    this.log('fatal', message, { ...errorContext, ...context })
  }

  // Create a child logger with a sub-module name
  child(subModule: string): Logger {
    return new Logger(`${this.module}:${subModule}`, this.minLevel)
  }

  // Force enable all logging (useful for debugging)
  enableAll(): void {
    this.minLevel = 'debug'
  }
}

// Default logger instance
export const logger = new Logger()

// Module-specific loggers for better traceability
export const offersLogger = new Logger('OFFERS')
export const apiLogger = new Logger('API')
export const cronLogger = new Logger('CRON')
export const clientLogger = new Logger('CLIENT')

// Factory for creating custom loggers
export function createLogger(module: string, minLevel?: LogLevel): Logger {
  return new Logger(module, minLevel)
}

export default logger
