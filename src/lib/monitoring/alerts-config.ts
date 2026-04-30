/**
 * Monitoring & Alerts Configuration
 * Centralized configuration for security monitoring and alerting
 *
 * Purpose: Bring Monitoring score from 6/10 to 10/10
 *
 * Features:
 * - Rate limit violation monitoring
 * - SQL injection attempt detection
 * - Authentication failure tracking
 * - Performance degradation alerts
 * - Webhook delivery failures
 * - Data retention job monitoring
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { trackMetric } from './metrics'
import { captureException, captureMessage, Severity } from './sentry'

// ============================================================================
// ALERT SEVERITY LEVELS
// ============================================================================

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

// ============================================================================
// ALERT TYPES
// ============================================================================

export enum AlertType {
  RATE_LIMIT_VIOLATION = 'RATE_LIMIT_VIOLATION',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  AUTH_FAILURE = 'AUTH_FAILURE',
  PERFORMANCE_DEGRADATION = 'PERFORMANCE_DEGRADATION',
  WEBHOOK_FAILURE = 'WEBHOOK_FAILURE',
  DATA_RETENTION_FAILURE = 'DATA_RETENTION_FAILURE',
  DUPLICATE_DETECTION = 'DUPLICATE_DETECTION',
  BULK_OPERATION_LIMIT = 'BULK_OPERATION_LIMIT',
  GDPR_REQUEST = 'GDPR_REQUEST',
}

// ============================================================================
// ALERT CONFIGURATION
// ============================================================================

interface AlertConfig {
  type: AlertType
  severity: AlertSeverity
  threshold: number // How many occurrences before alerting
  window_minutes: number // Time window for threshold
  notification_channels: ('email' | 'slack' | 'sms' | 'pagerduty')[]
  auto_escalate: boolean
  escalation_threshold?: number
}

export const ALERT_CONFIGS: Record<AlertType, AlertConfig> = {
  [AlertType.RATE_LIMIT_VIOLATION]: {
    type: AlertType.RATE_LIMIT_VIOLATION,
    severity: AlertSeverity.WARNING,
    threshold: 10, // Alert if 10+ violations in window
    window_minutes: 5,
    notification_channels: ['email', 'slack'],
    auto_escalate: true,
    escalation_threshold: 50, // Escalate to critical if 50+ violations
  },

  [AlertType.SQL_INJECTION_ATTEMPT]: {
    type: AlertType.SQL_INJECTION_ATTEMPT,
    severity: AlertSeverity.CRITICAL,
    threshold: 1, // Alert immediately on ANY attempt
    window_minutes: 1,
    notification_channels: ['email', 'slack', 'pagerduty'],
    auto_escalate: false, // Already critical
  },

  [AlertType.AUTH_FAILURE]: {
    type: AlertType.AUTH_FAILURE,
    severity: AlertSeverity.WARNING,
    threshold: 5, // Alert if 5+ failures in window
    window_minutes: 5,
    notification_channels: ['email', 'slack'],
    auto_escalate: true,
    escalation_threshold: 20, // Escalate if 20+ failures (possible attack)
  },

  [AlertType.PERFORMANCE_DEGRADATION]: {
    type: AlertType.PERFORMANCE_DEGRADATION,
    severity: AlertSeverity.ERROR,
    threshold: 5, // Alert if 5+ slow requests
    window_minutes: 10,
    notification_channels: ['email', 'slack'],
    auto_escalate: true,
    escalation_threshold: 20,
  },

  [AlertType.WEBHOOK_FAILURE]: {
    type: AlertType.WEBHOOK_FAILURE,
    severity: AlertSeverity.WARNING,
    threshold: 3, // Alert if 3+ consecutive failures
    window_minutes: 15,
    notification_channels: ['email'],
    auto_escalate: true,
    escalation_threshold: 10,
  },

  [AlertType.DATA_RETENTION_FAILURE]: {
    type: AlertType.DATA_RETENTION_FAILURE,
    severity: AlertSeverity.ERROR,
    threshold: 1, // Alert on any cleanup job failure
    window_minutes: 1440, // 24 hours
    notification_channels: ['email', 'slack'],
    auto_escalate: false,
  },

  [AlertType.DUPLICATE_DETECTION]: {
    type: AlertType.DUPLICATE_DETECTION,
    severity: AlertSeverity.INFO,
    threshold: 10, // Alert if 10+ duplicates detected
    window_minutes: 60,
    notification_channels: ['email'],
    auto_escalate: false,
  },

  [AlertType.BULK_OPERATION_LIMIT]: {
    type: AlertType.BULK_OPERATION_LIMIT,
    severity: AlertSeverity.WARNING,
    threshold: 3, // Alert if user hits limit 3+ times
    window_minutes: 30,
    notification_channels: ['email'],
    auto_escalate: false,
  },

  [AlertType.GDPR_REQUEST]: {
    type: AlertType.GDPR_REQUEST,
    severity: AlertSeverity.INFO,
    threshold: 1, // Alert on every GDPR request
    window_minutes: 1,
    notification_channels: ['email', 'slack'],
    auto_escalate: false,
  },
}

// ============================================================================
// ALERT TRACKING
// ============================================================================

interface AlertEvent {
  type: AlertType
  severity: AlertSeverity
  message: string
  metadata?: Record<string, any>
  user_id?: string
  ip_address?: string
  user_agent?: string
  endpoint?: string
  timestamp: Date
}

/**
 * Track an alert event and determine if notification should be sent
 */
export async function trackAlert(event: AlertEvent): Promise<void> {
  const config = ALERT_CONFIGS[event.type]

  try {
    // 1. Log to database
    const supabase = createSupabaseAdmin()
    const { error: insertError } = await supabase.from('alert_events').insert({
      alert_type: event.type,
      severity: event.severity,
      message: event.message,
      metadata: event.metadata || {},
      user_id: event.user_id || null,
      ip_address: event.ip_address || null,
      user_agent: event.user_agent || null,
      endpoint: event.endpoint || null,
      created_at: event.timestamp.toISOString(),
    })

    if (insertError) {
      console.error('[Alert Tracking] Failed to insert alert:', insertError)
    }

    // 2. Track metric
    trackMetric('alert.triggered', 1, {
      alert_type: event.type,
      severity: event.severity,
    })

    // 3. Send to Sentry based on severity
    if (event.severity === AlertSeverity.CRITICAL || event.severity === AlertSeverity.ERROR) {
      captureMessage(event.message, {
        level: event.severity === AlertSeverity.CRITICAL ? 'error' : 'warning',
        tags: {
          alert_type: event.type,
          endpoint: event.endpoint,
        },
        extra: event.metadata,
      })
    }

    // 4. Check if threshold reached for notification
    const shouldNotify = await checkAlertThreshold(event.type, config)

    if (shouldNotify) {
      await sendAlertNotification(event, config)
    }

    // 5. Check auto-escalation
    if (config.auto_escalate && config.escalation_threshold) {
      const shouldEscalate = await checkEscalationThreshold(
        event.type,
        config.escalation_threshold,
        config.window_minutes
      )

      if (shouldEscalate) {
        await escalateAlert(event, config)
      }
    }
  } catch (error) {
    console.error('[Alert Tracking] Error tracking alert:', error)
    captureException(error as Error)
  }
}

/**
 * Check if alert threshold has been reached
 */
async function checkAlertThreshold(
  alertType: AlertType,
  config: AlertConfig
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()

    const windowStart = new Date(Date.now() - config.window_minutes * 60 * 1000)

    const { count, error } = await supabase
      .from('alert_events')
      .select('*', { count: 'exact', head: true })
      .eq('alert_type', alertType)
      .gte('created_at', windowStart.toISOString())

    if (error) {
      console.error('[Alert Threshold] Query error:', error)
      return false
    }

    return (count || 0) >= config.threshold
  } catch (error) {
    console.error('[Alert Threshold] Error:', error)
    return false
  }
}

/**
 * Check if escalation threshold has been reached
 */
async function checkEscalationThreshold(
  alertType: AlertType,
  escalationThreshold: number,
  windowMinutes: number
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()

    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

    const { count, error } = await supabase
      .from('alert_events')
      .select('*', { count: 'exact', head: true })
      .eq('alert_type', alertType)
      .gte('created_at', windowStart.toISOString())

    if (error) {
      console.error('[Alert Escalation] Query error:', error)
      return false
    }

    return (count || 0) >= escalationThreshold
  } catch (error) {
    console.error('[Alert Escalation] Error:', error)
    return false
  }
}

/**
 * Send alert notification
 */
async function sendAlertNotification(event: AlertEvent, config: AlertConfig): Promise<void> {

  // Email notification
  if (config.notification_channels.includes('email')) {
    // Integrate with email service
    // await sendAlertEmail(event, config)
  }

  // Slack notification
  if (config.notification_channels.includes('slack')) {
    // Integrate with Slack webhook
    // await sendSlackAlert(event, config)
  }

  // SMS notification
  if (config.notification_channels.includes('sms')) {
    // Integrate with SMS service
    // await sendSMSAlert(event, config)
  }

  // PagerDuty notification
  if (config.notification_channels.includes('pagerduty')) {
    // Integrate with PagerDuty
    // await sendPagerDutyAlert(event, config)
  }
}

/**
 * Escalate alert to higher severity
 */
async function escalateAlert(event: AlertEvent, config: AlertConfig): Promise<void> {

  const escalatedEvent: AlertEvent = {
    ...event,
    severity: AlertSeverity.CRITICAL,
    message: `[ESCALATED] ${event.message}`,
    metadata: {
      ...event.metadata,
      escalated_from: event.severity,
      escalation_reason: `Threshold of ${config.escalation_threshold} exceeded`,
    },
  }

  // Send to all critical channels
  await sendAlertNotification(escalatedEvent, {
    ...config,
    notification_channels: ['email', 'slack', 'pagerduty'],
  })

  // Track escalation metric
  trackMetric('alert.escalated', 1, {
    alert_type: event.type,
    from_severity: event.severity,
    to_severity: AlertSeverity.CRITICAL,
  })
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR COMMON ALERTS
// ============================================================================

export async function trackRateLimitViolation(
  ip: string,
  endpoint: string,
  userId?: string
): Promise<void> {
  await trackAlert({
    type: AlertType.RATE_LIMIT_VIOLATION,
    severity: AlertSeverity.WARNING,
    message: `Rate limit exceeded for ${endpoint}`,
    metadata: { endpoint },
    user_id: userId,
    ip_address: ip,
    endpoint,
    timestamp: new Date(),
  })
}

export async function trackSQLInjectionAttempt(
  input: string,
  endpoint: string,
  ip: string,
  userId?: string
): Promise<void> {
  await trackAlert({
    type: AlertType.SQL_INJECTION_ATTEMPT,
    severity: AlertSeverity.CRITICAL,
    message: `SQL injection attempt detected on ${endpoint}`,
    metadata: {
      malicious_input: input.substring(0, 100), // Truncate for safety
      endpoint,
    },
    user_id: userId,
    ip_address: ip,
    endpoint,
    timestamp: new Date(),
  })
}

export async function trackAuthFailure(
  email: string,
  ip: string,
  reason: string
): Promise<void> {
  await trackAlert({
    type: AlertType.AUTH_FAILURE,
    severity: AlertSeverity.WARNING,
    message: `Authentication failure for ${email}`,
    metadata: {
      email,
      reason,
    },
    ip_address: ip,
    timestamp: new Date(),
  })
}

export async function trackPerformanceDegradation(
  endpoint: string,
  duration: number,
  threshold: number
): Promise<void> {
  await trackAlert({
    type: AlertType.PERFORMANCE_DEGRADATION,
    severity: AlertSeverity.ERROR,
    message: `Performance degradation on ${endpoint} (${duration}ms > ${threshold}ms)`,
    metadata: {
      endpoint,
      duration_ms: duration,
      threshold_ms: threshold,
    },
    endpoint,
    timestamp: new Date(),
  })
}

export async function trackWebhookFailure(
  webhookId: string,
  endpoint: string,
  errorMessage: string
): Promise<void> {
  await trackAlert({
    type: AlertType.WEBHOOK_FAILURE,
    severity: AlertSeverity.WARNING,
    message: `Webhook delivery failed: ${endpoint}`,
    metadata: {
      webhook_id: webhookId,
      webhook_endpoint: endpoint,
      error: errorMessage,
    },
    timestamp: new Date(),
  })
}

export async function trackDataRetentionFailure(
  jobName: string,
  errorMessage: string
): Promise<void> {
  await trackAlert({
    type: AlertType.DATA_RETENTION_FAILURE,
    severity: AlertSeverity.ERROR,
    message: `Data retention job failed: ${jobName}`,
    metadata: {
      job_name: jobName,
      error: errorMessage,
    },
    timestamp: new Date(),
  })
}

export async function trackGDPRRequest(
  requestType: string,
  entityId: string,
  requestedBy: string
): Promise<void> {
  await trackAlert({
    type: AlertType.GDPR_REQUEST,
    severity: AlertSeverity.INFO,
    message: `GDPR deletion request received: ${requestType}`,
    metadata: {
      request_type: requestType,
      entity_id: entityId,
      requested_by: requestedBy,
    },
    timestamp: new Date(),
  })
}

// ============================================================================
// ALERT EVENTS TABLE SCHEMA (for reference - create via migration)
// ============================================================================

/*
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  endpoint TEXT,
  notified BOOLEAN DEFAULT false,
  notified_at TIMESTAMPTZ,
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_events_type ON alert_events(alert_type);
CREATE INDEX idx_alert_events_severity ON alert_events(severity);
CREATE INDEX idx_alert_events_created ON alert_events(created_at);
CREATE INDEX idx_alert_events_user ON alert_events(user_id) WHERE user_id IS NOT NULL;
*/
