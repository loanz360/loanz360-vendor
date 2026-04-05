/**
 * Client-Side Logger
 * Replaces console.log with environment-aware logging
 * Only logs in development mode
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

class ClientLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.isDevelopment && level !== 'error') {
      return // Only log errors in production
    }

    const timestamp = new Date().toISOString()
    const prefix = `[${level.toUpperCase()}] ${timestamp}`

    switch (level) {
      case 'debug':
        console.debug(prefix, message, context || '')
        break
      case 'info':
        console.info(prefix, message, context || '')
        break
      case 'warn':
        console.warn(prefix, message, context || '')
        break
      case 'error':
        console.error(prefix, message, context || '')
        break
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  private persistError(message: string, context?: LogContext) {
    // Fire-and-forget: persist to /api/errors for admin visibility in production
    if (typeof window === 'undefined') return
    try {
      const errorId = `ERR_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId,
          message,
          type: 'error',
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          additional: context,
        }),
      }).catch(() => { /* ignore network failures in logger */ })
    } catch {
      // Never throw from logger
    }
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context)
    if (!this.isDevelopment) {
      this.persistError(message, context)
    }
  }
}

export const clientLogger = new ClientLogger()
