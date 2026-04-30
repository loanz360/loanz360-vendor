/**
 * Security Logger - Client & Server Compatible
 * Uses database logging instead of filesystem
 */

export interface SecurityLogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'critical'
  event: string
  ip: string
  userAgent?: string
  email?: string
  details?: Record<string, unknown>
  duration?: string
}

export class SecurityLogger {
  constructor() {
    // Compatible with both client and server
  }

  private isServer(): boolean {
    return typeof window === 'undefined'
  }

  logSecurityEvent(entry: Omit<SecurityLogEntry, 'timestamp'>): void {
    const fullEntry: SecurityLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      const icon = entry.level === 'error' ? '❌' :
                   entry.level === 'warn' ? '⚠️' :
                   entry.level === 'critical' ? '🚨' : '📝'
      // eslint-disable-next-line no-console
    }

    // In production, log to database via API
    if (process.env.NODE_ENV === 'production') {
      this.logToDatabase(fullEntry)
    }

    // Send critical alerts
    if (entry.level === 'critical') {
      this.sendCriticalAlert(fullEntry)
    }
  }

  private async logToDatabase(entry: SecurityLogEntry): Promise<void> {
    try {
      if (this.isServer()) {
        // Server-side: Use full URL with localhost
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        await fetch(`${baseUrl}/api/security/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        }).catch(err => {
          // eslint-disable-next-line no-console
          console.error('Failed to log to database (server):', err)
        })
      } else {
        // Client-side: Use relative URL
        await fetch('/api/security/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        }).catch(err => {
          // eslint-disable-next-line no-console
          console.error('Failed to log to database (client):', err)
        })
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Database logging error:', error)
    }
  }

  private sendCriticalAlert(entry: SecurityLogEntry): void {
    // In production, implement integration with:
    // - Email alerts
    // - Slack notifications
    // - PagerDuty
    // - SMS alerts
    // eslint-disable-next-line no-console
    console.error('🚨 CRITICAL SECURITY ALERT:', entry)

    // Example webhook integration (uncomment and configure for production):
    /*
    if (process.env.SECURITY_WEBHOOK_URL) {
      fetch(process.env.SECURITY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 CRITICAL: ${entry.event}`,
          details: entry
        })
      }).catch(error => console.error('Failed to send alert:', error))
    }
    */
  }

  // Audit specific events
  logAuditEvent(event: string, details: Record<string, unknown>, ip: string): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      event: `AUDIT: ${event}`,
      ip,
      details
    }

    this.logSecurityEvent(entry)
  }

  // Query logs from database
  async getSecurityLogs(
    startDate?: Date,
    endDate?: Date,
    level?: SecurityLogEntry['level']
  ): Promise<SecurityLogEntry[]> {
    try {
      // TODO: Implement API endpoint to fetch logs from database
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate.toISOString())
      if (endDate) params.append('endDate', endDate.toISOString())
      if (level) params.append('level', level)

      const response = await fetch(`/api/security/logs?${params}`)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch security logs:', error)
    }

    return []
  }
}

// Global security logger instance
export const securityLogger = new SecurityLogger()
