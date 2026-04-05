/**
 * Alert Management System
 * Purpose: Send alerts for critical errors, performance issues, business events
 */

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertChannel = 'email' | 'slack' | 'sms' | 'pagerduty';

interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  channels: AlertChannel[];
  metadata?: Record<string, any>;
  timestamp?: number;
}

interface AlertRule {
  id: string;
  name: string;
  condition: (data: any) => boolean;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldown?: number; // Minimum time between alerts (ms)
  enabled: boolean;
}

class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private alertQueue: Alert[] = [];

  constructor() {
    // Initialize default alert rules
    this.initializeDefaultRules();

    // Process queue every 5 seconds
    if (typeof window === 'undefined') {
      setInterval(() => this.processQueue(), 5000);
    }
  }

  /**
   * Send an alert
   */
  async sendAlert(alert: Alert) {
    const alertWithTimestamp: Alert = {
      ...alert,
      timestamp: alert.timestamp || Date.now(),
    };

    this.alertQueue.push(alertWithTimestamp);

    // Send immediately for critical alerts
    if (alert.severity === 'critical') {
      await this.processQueue();
    }
  }

  /**
   * Register a custom alert rule
   */
  registerRule(rule: AlertRule) {
    this.rules.set(rule.id, rule);
  }

  /**
   * Check if data matches any alert rules
   */
  checkRules(data: any) {
    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastAlert = this.lastAlertTime.get(ruleId);
      if (lastAlert && rule.cooldown) {
        const timeSinceLastAlert = Date.now() - lastAlert;
        if (timeSinceLastAlert < rule.cooldown) {
          continue;
        }
      }

      // Check condition
      try {
        if (rule.condition(data)) {
          this.sendAlert({
            severity: rule.severity,
            title: rule.name,
            message: `Alert rule triggered: ${rule.name}`,
            channels: rule.channels,
            metadata: { ruleId, data },
          });
          this.lastAlertTime.set(ruleId, Date.now());
        }
      } catch (error) {
        console.error(`Error checking alert rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Process alert queue
   */
  private async processQueue() {
    if (this.alertQueue.length === 0) return;

    const alerts = [...this.alertQueue];
    this.alertQueue = [];

    for (const alert of alerts) {
      await this.dispatchAlert(alert);
    }
  }

  /**
   * Dispatch alert to configured channels
   */
  private async dispatchAlert(alert: Alert) {
    const promises: Promise<void>[] = [];

    for (const channel of alert.channels) {
      switch (channel) {
        case 'email':
          promises.push(this.sendEmailAlert(alert));
          break;
        case 'slack':
          promises.push(this.sendSlackAlert(alert));
          break;
        case 'sms':
          promises.push(this.sendSMSAlert(alert));
          break;
        case 'pagerduty':
          promises.push(this.sendPagerDutyAlert(alert));
          break;
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert) {
    try {
      const recipients = process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [];

      await fetch('/api/internal/send-alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          message: alert.message,
          metadata: alert.metadata,
        }),
      });
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert) {
    try {
      if (!process.env.SLACK_WEBHOOK_URL) return;

      const color = this.getSeverityColor(alert.severity);

      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color,
              title: alert.title,
              text: alert.message,
              fields: alert.metadata
                ? Object.entries(alert.metadata).map(([key, value]) => ({
                    title: key,
                    value: JSON.stringify(value),
                    short: true,
                  }))
                : [],
              footer: 'LOANZ 360 Monitoring',
              ts: Math.floor((alert.timestamp || Date.now()) / 1000),
            },
          ],
        }),
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Send SMS alert
   */
  private async sendSMSAlert(alert: Alert) {
    try {
      const recipients = process.env.ALERT_SMS_RECIPIENTS?.split(',') || [];

      for (const recipient of recipients) {
        await fetch('/api/internal/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipient,
            message: `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`,
          }),
        });
      }
    } catch (error) {
      console.error('Failed to send SMS alert:', error);
    }
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(alert: Alert) {
    try {
      if (!process.env.PAGERDUTY_INTEGRATION_KEY) return;

      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: process.env.PAGERDUTY_INTEGRATION_KEY,
          event_action: 'trigger',
          payload: {
            summary: alert.title,
            severity: alert.severity,
            source: 'loanz360-monitoring',
            custom_details: {
              message: alert.message,
              ...alert.metadata,
            },
          },
        }),
      });
    } catch (error) {
      console.error('Failed to send PagerDuty alert:', error);
    }
  }

  /**
   * Get Slack color for severity
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '#ff0000';
      case 'high':
        return '#ff6600';
      case 'medium':
        return '#ffcc00';
      case 'low':
        return '#3399ff';
      case 'info':
        return '#999999';
      default:
        return '#000000';
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules() {
    // High error rate
    this.registerRule({
      id: 'high_error_rate',
      name: 'High Error Rate Detected',
      condition: (data) => {
        const errorRate = data.errorRate || 0;
        return errorRate > 0.05; // 5% error rate
      },
      severity: 'high',
      channels: ['email', 'slack'],
      cooldown: 15 * 60 * 1000, // 15 minutes
      enabled: true,
    });

    // Slow API response
    this.registerRule({
      id: 'slow_api_response',
      name: 'Slow API Response Detected',
      condition: (data) => {
        const responseTime = data.responseTime || 0;
        return responseTime > 5000; // 5 seconds
      },
      severity: 'medium',
      channels: ['slack'],
      cooldown: 30 * 60 * 1000, // 30 minutes
      enabled: true,
    });

    // Database connection failure
    this.registerRule({
      id: 'database_connection_failure',
      name: 'Database Connection Failure',
      condition: (data) => {
        return data.databaseError === true;
      },
      severity: 'critical',
      channels: ['email', 'slack', 'sms', 'pagerduty'],
      cooldown: 5 * 60 * 1000, // 5 minutes
      enabled: true,
    });

    // Large number of duplicate leads
    this.registerRule({
      id: 'high_duplicate_rate',
      name: 'High Duplicate Lead Rate',
      condition: (data) => {
        const duplicateRate = data.duplicateRate || 0;
        return duplicateRate > 0.3; // 30% duplicates
      },
      severity: 'medium',
      channels: ['email', 'slack'],
      cooldown: 60 * 60 * 1000, // 1 hour
      enabled: true,
    });

    // GDPR deadline approaching
    this.registerRule({
      id: 'gdpr_deadline_approaching',
      name: 'GDPR Erasure Request Deadline Approaching',
      condition: (data) => {
        const daysUntilDeadline = data.daysUntilDeadline || 999;
        return daysUntilDeadline <= 3; // 3 days left
      },
      severity: 'high',
      channels: ['email', 'slack'],
      cooldown: 24 * 60 * 60 * 1000, // 1 day
      enabled: true,
    });
  }
}

// Singleton instance
export const alertManager = new AlertManager();

// Convenience functions
export async function sendAlert(
  severity: AlertSeverity,
  title: string,
  message: string,
  channels: AlertChannel[] = ['email', 'slack'],
  metadata?: Record<string, any>
) {
  await alertManager.sendAlert({ severity, title, message, channels, metadata });
}

export function registerAlertRule(rule: AlertRule) {
  alertManager.registerRule(rule);
}

export function checkAlertRules(data: any) {
  alertManager.checkRules(data);
}
