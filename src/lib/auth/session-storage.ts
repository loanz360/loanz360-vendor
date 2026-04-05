import type { AuthUser } from './middleware'
import { logger } from '@/lib/utils/logger'

/**
 * SECURITY: Client-side session metadata storage
 *
 * IMPORTANT: This class does NOT store authentication tokens client-side.
 * Authentication is handled via HTTP-Only cookies set by the server.
 * This storage only maintains user metadata for UI purposes.
 */
export class SecureSessionStorage {
  private static readonly SESSION_KEY = 'secure_session_metadata'
  private static readonly LAST_ACTIVITY_KEY = 'last_activity'
  private static readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly ACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes

  /**
   * SECURITY FIX: Store session metadata only (NO tokens)
   * Authentication tokens are in HTTP-Only cookies managed by server
   */
  static setSession(user: AuthUser): void {
    try {
      const sessionMetadata = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          // Only store non-sensitive user metadata
        },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        fingerprint: this.generateBrowserFingerprint()
      }

      // Store only metadata (NO tokens) in sessionStorage
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionMetadata))
      sessionStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString())

    } catch (error) {
      logger.error('Failed to store session metadata', error as Error, { userId: user.id })
    }
  }

  /**
   * Get session metadata (user info only)
   * Does NOT return tokens - they're in HTTP-Only cookies
   */
  static getSession(): { user: AuthUser } | null {
    try {
      const sessionData = sessionStorage.getItem(this.SESSION_KEY)
      if (!sessionData) {
        return null
      }

      const parsed = JSON.parse(sessionData)

      // Check session expiration
      if (this.isSessionExpired(parsed)) {
        this.clearSession()
        return null
      }

      // Check activity timeout
      if (this.isActivityExpired()) {
        this.clearSession()
        return null
      }

      // Verify browser fingerprint
      if (parsed.fingerprint !== this.generateBrowserFingerprint()) {
        logger.warn('Session fingerprint mismatch - possible session hijacking', {
          userId: parsed.user?.id
        })
        this.clearSession()
        return null
      }

      // Update last activity
      this.updateActivity()

      return {
        user: parsed.user
      }

    } catch (error) {
      logger.error('Failed to retrieve session metadata', error as Error)
      this.clearSession()
      return null
    }
  }

  /**
   * Check if user has session metadata
   * Note: This does NOT verify authentication (server validates tokens)
   */
  static isAuthenticated(): boolean {
    return this.getSession() !== null
  }

  /**
   * Check if user has specific role (from metadata)
   */
  static hasRole(requiredRole: string): boolean {
    const session = this.getSession()
    return session?.user.role === requiredRole || false
  }

  /**
   * Check if user has any of the required roles (from metadata)
   */
  static hasAnyRole(requiredRoles: string[]): boolean {
    const session = this.getSession()
    return session ? requiredRoles.includes(session.user.role) : false
  }

  /**
   * Get current user metadata
   */
  static getCurrentUser(): AuthUser | null {
    const session = this.getSession()
    return session?.user || null
  }

  // Update last activity timestamp
  static updateActivity(): void {
    try {
      sessionStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString())

      // Update session data
      const sessionData = sessionStorage.getItem(this.SESSION_KEY)
      if (sessionData) {
        const parsed = JSON.parse(sessionData)
        parsed.lastActivity = Date.now()
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(parsed))
      }
    } catch (error) {
      logger.error('Failed to update activity', error as Error)
    }
  }

  // Clear session metadata
  static clearSession(): void {
    try {
      sessionStorage.removeItem(this.SESSION_KEY)
      sessionStorage.removeItem(this.LAST_ACTIVITY_KEY)

      // Clear any legacy storage data
      sessionStorage.removeItem('secure_session')
      sessionStorage.removeItem('session_token')
      localStorage.removeItem('superAdminAuth')
      localStorage.removeItem('superAdminToken')
      localStorage.removeItem('superAdminUser')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')

    } catch (error) {
      logger.error('Failed to clear session data', error as Error)
    }
  }

  // Check if session is expired
  private static isSessionExpired(sessionData: { createdAt?: number }): boolean {
    const now = Date.now()
    const createdAt = sessionData.createdAt || 0
    return (now - createdAt) > this.SESSION_TIMEOUT
  }

  // Check if activity timeout has expired
  private static isActivityExpired(): boolean {
    try {
      const lastActivity = sessionStorage.getItem(this.LAST_ACTIVITY_KEY)
      if (!lastActivity) {
        return true
      }

      const now = Date.now()
      const lastActivityTime = parseInt(lastActivity, 10)
      return (now - lastActivityTime) > this.ACTIVITY_TIMEOUT

    } catch {
      return true
    }
  }

  // Generate browser fingerprint for session validation
  private static generateBrowserFingerprint(): string {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillText('Browser fingerprint', 2, 2)
      }

      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL()
      ].join('|')

      // Simple hash function
      let hash = 0
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }

      return hash.toString(36)

    } catch {
      // Fallback if canvas or other features are not available
      return navigator.userAgent + navigator.language
    }
  }


  // Initialize session monitoring
  static initializeSessionMonitoring(): void {
    // Update activity on user interactions
    const updateActivity = () => this.updateActivity()

    document.addEventListener('click', updateActivity)
    document.addEventListener('keypress', updateActivity)
    document.addEventListener('scroll', updateActivity)
    document.addEventListener('mousemove', updateActivity)

    // Check session validity periodically
    setInterval(() => {
      if (this.isAuthenticated()) {
        this.updateActivity()
      }
    }, 60000) // Check every minute

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Page became visible, check session validity
        if (!this.isAuthenticated()) {
          window.location.href = '/login'
        }
      }
    })

    // Handle storage events (for logout from other tabs)
    window.addEventListener('storage', (event) => {
      if (event.key === this.SESSION_KEY && !event.newValue) {
        // Session was cleared in another tab
        window.location.href = '/login'
      }
    })
  }
}