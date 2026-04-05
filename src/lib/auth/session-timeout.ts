/**
 * Session Timeout Management
 * Automatically logs out inactive users for security
 */

import { clientLogger } from '@/lib/utils/client-logger'

const DEFAULT_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds
const WARNING_BEFORE_TIMEOUT = 5 * 60 * 1000 // Show warning 5 minutes before timeout

export class SessionTimeoutManager {
  private timeoutId: NodeJS.Timeout | null = null
  private warningId: NodeJS.Timeout | null = null
  private lastActivity: number = Date.now()
  private timeoutDuration: number
  private warningDuration: number
  private onTimeout: () => void
  private onWarning?: (remainingSeconds: number) => void

  constructor(options: {
    timeout?: number
    onTimeout: () => void
    onWarning?: (remainingSeconds: number) => void
  }) {
    this.timeoutDuration = options.timeout || DEFAULT_TIMEOUT
    this.warningDuration = WARNING_BEFORE_TIMEOUT
    this.onTimeout = options.onTimeout
    this.onWarning = options.onWarning

    this.init()
  }

  private init() {
    // Listen for user activity
    this.attachEventListeners()

    // Start the timeout
    this.resetTimeout()

    clientLogger.debug('Session timeout manager initialized', {
      timeout: this.timeoutDuration / 1000 / 60 + ' minutes'
    })
  }

  private attachEventListeners() {
    if (typeof window === 'undefined') return

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ]

    events.forEach(event => {
      window.addEventListener(event, () => this.handleActivity(), { passive: true })
    })
  }

  private handleActivity() {
    const now = Date.now()
    const timeSinceLastActivity = now - this.lastActivity

    // Only reset if enough time has passed (prevent excessive resets)
    if (timeSinceLastActivity > 1000) {
      this.lastActivity = now
      this.resetTimeout()
    }
  }

  private resetTimeout() {
    // Clear existing timers
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }
    if (this.warningId) {
      clearTimeout(this.warningId)
    }

    // Set warning timer
    if (this.onWarning) {
      this.warningId = setTimeout(() => {
        const remainingSeconds = this.warningDuration / 1000
        clientLogger.warn('Session timeout warning', { remainingSeconds })
        this.onWarning?.(remainingSeconds)
      }, this.timeoutDuration - this.warningDuration)
    }

    // Set timeout timer
    this.timeoutId = setTimeout(() => {
      clientLogger.warn('Session timeout reached')
      this.onTimeout()
    }, this.timeoutDuration)
  }

  public extendSession() {
    clientLogger.debug('Session extended manually')
    this.resetTimeout()
  }

  public destroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }
    if (this.warningId) {
      clearTimeout(this.warningId)
    }

    if (typeof window !== 'undefined') {
      const events = [
        'mousedown',
        'mousemove',
        'keypress',
        'scroll',
        'touchstart',
        'click'
      ]

      events.forEach(event => {
        window.removeEventListener(event, () => this.handleActivity())
      })
    }

    clientLogger.debug('Session timeout manager destroyed')
  }

  public getRemainingTime(): number {
    const timeSinceLastActivity = Date.now() - this.lastActivity
    return Math.max(0, this.timeoutDuration - timeSinceLastActivity)
  }
}
