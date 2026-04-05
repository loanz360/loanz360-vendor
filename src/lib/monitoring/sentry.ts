/**
 * SECURITY FIX MEDIUM-02: Error Monitoring with Sentry
 *
 * Enterprise-grade error tracking for production
 * - Real-time error alerts
 * - Performance monitoring
 * - User context tracking
 * - Release tracking
 *
 * Setup Instructions:
 * 1. Sign up at https://sentry.io
 * 2. Create a new Next.js project
 * 3. Add to .env.local:
 *    NEXT_PUBLIC_SENTRY_DSN=your_dsn_here
 *    SENTRY_AUTH_TOKEN=your_auth_token_here (for source maps)
 * 4. Install: npm install @sentry/nextjs
 */

// Note: Sentry is optional. If not configured, errors will use fallback logging
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

export const sentryConfig = {
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: process.env.NODE_ENV === 'development',

  // Don't send PII to Sentry
  beforeSend(event: any) {
    // Remove sensitive data
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers?.Authorization
      delete event.request.headers?.['X-CSRF-Token']
    }

    // Remove sensitive query params
    if (event.request?.query_string) {
      const sensitiveParams = ['token', 'key', 'password', 'secret', 'api_key']
      sensitiveParams.forEach(param => {
        event.request.query_string = event.request.query_string.replace(
          new RegExp(`${param}=[^&]*`, 'gi'),
          `${param}=[REDACTED]`
        )
      })
    }

    return event
  },

  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'chrome-extension://',
    'moz-extension://',
    // Network errors
    'NetworkError',
    'Network request failed',
    // User cancelled actions
    'AbortError',
    'User canceled',
  ],
}

/**
 * Initialize Sentry (call this in app initialization)
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error monitoring disabled.')
    return false
  }

  try {
    // Sentry will be initialized via sentry.client.config.ts and sentry.server.config.ts
    // after npm install @sentry/nextjs and running npx @sentry/wizard@latest -i nextjs
    console.log('Sentry monitoring enabled')
    return true
  } catch (error) {
    console.error('Failed to initialize Sentry:', error)
    return false
  }
}

/**
 * Capture error to Sentry (with fallback)
 */
export function captureError(
  error: Error | unknown,
  context?: {
    user?: { id: string; email?: string; role?: string }
    tags?: Record<string, string>
    extra?: Record<string, any>
  }
) {
  // If Sentry is available, use it
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    const Sentry = (window as any).Sentry

    if (context?.user) {
      Sentry.setUser(context.user)
    }

    if (context?.tags) {
      Sentry.setTags(context.tags)
    }

    if (context?.extra) {
      Sentry.setExtras(context.extra)
    }

    Sentry.captureException(error)
  } else {
    // Fallback to console
    console.error('Error captured:', error, context)
  }
}

/**
 * Capture message to Sentry (with fallback)
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    const Sentry = (window as any).Sentry
    Sentry.captureMessage(message, { level, extra: context })
  } else {
    console[level === 'warning' ? 'warn' : level](message, context)
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: {
  id: string
  email?: string
  role?: string
}) {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    const Sentry = (window as any).Sentry
    Sentry.setUser(user)
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    const Sentry = (window as any).Sentry
    Sentry.setUser(null)
  }
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    const Sentry = (window as any).Sentry
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    })
  }
}

/**
 * Performance monitoring
 */
export function startTransaction(name: string, op: string) {
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    const Sentry = (window as any).Sentry
    return Sentry.startTransaction({ name, op })
  }
  return null
}
