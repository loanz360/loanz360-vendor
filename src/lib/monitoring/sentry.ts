/**
 * Sentry Error Tracking Configuration
 * 
 * To activate:
 * 1. Create account at sentry.io
 * 2. Set NEXT_PUBLIC_SENTRY_DSN in Vercel env vars
 * 3. npm install @sentry/nextjs
 * 4. Run: npx @sentry/wizard@latest -i nextjs
 * 
 * This file provides a lightweight fallback that logs errors
 * when Sentry is not configured.
 */

interface ErrorContext {
  userId?: string
  route?: string
  requestId?: string
  extra?: Record<string, unknown>
}

export function captureException(error: Error, context?: ErrorContext): void {
  // When Sentry is configured, replace with:
  // Sentry.captureException(error, { extra: context })
  
  console.error('[ERROR_TRACKING]', {
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    ...context,
    timestamp: new Date().toISOString(),
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  console.log(`[${level.toUpperCase()}]`, message, new Date().toISOString())
}

export function setUser(userId: string, email?: string): void {
  // When Sentry is configured:
  // Sentry.setUser({ id: userId, email })
}
