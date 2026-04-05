'use client'

import { securityLogger } from '@/lib/security-logger'

export interface ErrorReport {
  errorId: string
  message: string
  stack?: string
  type: 'javascript' | 'unhandled_rejection' | 'network' | 'api' | 'auth'
  url: string
  userAgent: string
  timestamp: string
  userId?: string
  sessionId?: string
  additional?: Record<string, unknown>
}

class GlobalErrorHandler {
  private isInitialized = false
  private errorQueue: ErrorReport[] = []
  private readonly maxQueueSize = 100

  initialize() {
    if (this.isInitialized || typeof window === 'undefined') {
      return
    }

    // Handle uncaught JavaScript errors
    window.addEventListener('error', this.handleError.bind(this))

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this))

    // Handle resource loading errors (images, scripts, etc.)
    window.addEventListener('error', this.handleResourceError.bind(this), true)

    this.isInitialized = true
    console.log('🛡️ Global error handler initialized')
  }

  private handleError(event: ErrorEvent) {
    const error: ErrorReport = {
      errorId: this.generateErrorId(),
      message: event.message,
      stack: event.error?.stack,
      type: 'javascript',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      additional: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    }

    this.reportError(error)
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    const error: ErrorReport = {
      errorId: this.generateErrorId(),
      message: event.reason?.message || 'Unhandled Promise Rejection',
      stack: event.reason?.stack,
      type: 'unhandled_rejection',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      additional: {
        reason: event.reason
      }
    }

    this.reportError(error)

    // Prevent the default browser console error
    event.preventDefault()
  }

  private handleResourceError(event: Event) {
    const target = event.target

    if (target && target !== window && target instanceof HTMLElement) {
      const error: ErrorReport = {
        errorId: this.generateErrorId(),
        message: `Resource failed to load: ${target.tagName}`,
        type: 'network',
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        additional: {
          resourceType: target.tagName.toLowerCase(),
          resourceUrl: (target as HTMLImageElement | HTMLScriptElement).src || (target as HTMLLinkElement).href || '',
          outerHTML: target.outerHTML?.substring(0, 200) + '...'
        }
      }

      this.reportError(error)
    }
  }

  reportError(error: ErrorReport) {
    // Add to queue
    this.errorQueue.push(error)

    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift()
    }

    // Log to security logger
    securityLogger.logSecurityEvent({
      level: error.type === 'unhandled_rejection' ? 'critical' : 'error',
      event: 'GLOBAL_ERROR',
      ip: 'unknown',
      userAgent: error.userAgent,
      details: {
        errorId: error.errorId,
        errorType: error.type,
        message: error.message,
        stack: error.stack,
        url: error.url,
        userAgent: error.userAgent,
        additional: error.additional
      }
    })

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Global Error Handler')
      console.error('Error ID:', error.errorId)
      console.error('Type:', error.type)
      console.error('Message:', error.message)
      console.error('Additional:', error.additional)
      console.groupEnd()
    }

    // Send to external error tracking service (implement as needed)
    this.sendToExternalService(error)
  }

  private sendToExternalService(error: ErrorReport) {
    // This can be implemented to send errors to services like:
    // - Sentry
    // - LogRocket
    // - Bugsnag
    // - Custom error tracking endpoint

    // Example implementation for custom endpoint:
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error),
      }).catch(() => {
        // Silently fail to avoid infinite error loops
      })
    }
  }

  // Manual error reporting for API calls and custom errors
  reportApiError(error: Error | unknown, context: {
    endpoint: string
    method: string
    status?: number
    response?: unknown
  }) {
    const err = error instanceof Error ? error : new Error(String(error));
    const errorReport: ErrorReport = {
      errorId: this.generateErrorId(),
      message: err.message || 'API Error',
      stack: err.stack,
      type: 'api',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      additional: {
        endpoint: context.endpoint,
        method: context.method,
        status: context.status,
        response: context.response
      }
    }

    this.reportError(errorReport)
  }

  reportAuthError(error: Error | unknown, context: {
    action: string
    userId?: string
  }) {
    const err = error instanceof Error ? error : new Error(String(error));
    const errorReport: ErrorReport = {
      errorId: this.generateErrorId(),
      message: err.message || 'Authentication Error',
      stack: err.stack,
      type: 'auth',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      userId: context.userId,
      additional: {
        action: context.action
      }
    }

    this.reportError(errorReport)
  }

  // Get recent errors for debugging
  getRecentErrors(count = 10): ErrorReport[] {
    return this.errorQueue.slice(-count)
  }

  // Clear error queue
  clearErrors() {
    this.errorQueue = []
  }

  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const globalErrorHandler = new GlobalErrorHandler()

// Utility functions for common error reporting patterns
export const reportError = {
  api: (error: Error | unknown, context: { endpoint: string; method: string; status?: number; response?: unknown }) => {
    globalErrorHandler.reportApiError(error, context)
  },

  auth: (error: Error | unknown, context: { action: string; userId?: string }) => {
    globalErrorHandler.reportAuthError(error, context)
  },

  custom: (message: string, additional?: Record<string, unknown>) => {
    const error: ErrorReport = {
      errorId: `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      type: 'javascript',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
      additional
    }
    globalErrorHandler.reportError(error)
  }
}

// React Hook for easy error reporting in components
export function useErrorReporting() {
  return {
    reportError: reportError.custom,
    reportApiError: reportError.api,
    reportAuthError: reportError.auth,
    getRecentErrors: () => globalErrorHandler.getRecentErrors(),
    clearErrors: () => globalErrorHandler.clearErrors()
  }
}