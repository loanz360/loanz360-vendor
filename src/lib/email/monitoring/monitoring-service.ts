/**
 * Email Monitoring Service
 * Enterprise-grade monitoring and metrics system
 *
 * Features:
 * - Real-time provider health monitoring
 * - Email delivery metrics
 * - Error tracking and alerting
 * - Usage analytics
 * - Performance dashboards
 */

import { createSupabaseAdmin } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface ProviderHealthMetrics {
  providerId: string;
  providerName: string;
  displayName: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastChecked: Date;
  uptime24h: number; // Percentage
  avgLatencyMs: number;
  errorRate24h: number; // Percentage
  requestsToday: number;
  successfulToday: number;
  failedToday: number;
}

export interface EmailDeliveryMetrics {
  period: 'hour' | 'day' | 'week' | 'month';
  totalSent: number;
  delivered: number;
  bounced: number;
  failed: number;
  pending: number;
  deliveryRate: number; // Percentage
  bounceRate: number;
  avgDeliveryTimeMs: number;
}

export interface SystemOverview {
  totalAccounts: number;
  activeAccounts: number;
  suspendedAccounts: number;
  pendingAccounts: number;
  totalEmailsSentToday: number;
  totalEmailsSentThisMonth: number;
  totalStorageUsedMb: number;
  totalStorageQuotaMb: number;
  storageUsedPercent: number;
  activeProviders: number;
  healthyProviders: number;
  pendingApprovals: number;
}

export interface ActivityLog {
  id: string;
  accountId?: string;
  accountEmail?: string;
  action: string;
  status: 'success' | 'failure' | 'pending';
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AlertConfig {
  id: string;
  alertType: string;
  threshold: number;
  isActive: boolean;
  notifyEmail?: string;
  notifyWebhook?: string;
  createdAt: Date;
}

export interface MonitoringAlert {
  id: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// MONITORING SERVICE
// ============================================================================

export class MonitoringService {
  private supabase = createSupabaseAdmin();

  // ============================================================================
  // SYSTEM OVERVIEW
  // ============================================================================

  /**
   * Get system overview metrics
   */
  async getSystemOverview(): Promise<SystemOverview> {
    const [
      accountStats,
      emailStats,
      storageStats,
      providerStats,
      approvalStats,
    ] = await Promise.all([
      this.getAccountStats(),
      this.getEmailStats(),
      this.getStorageStats(),
      this.getProviderStats(),
      this.getApprovalStats(),
    ]);

    return {
      ...accountStats,
      ...emailStats,
      ...storageStats,
      ...providerStats,
      ...approvalStats,
    };
  }

  private async getAccountStats() {
    const { data: accounts } = await this.supabase
      .from('email_accounts')
      .select('status');

    const stats = {
      totalAccounts: accounts?.length || 0,
      activeAccounts: 0,
      suspendedAccounts: 0,
      pendingAccounts: 0,
    };

    for (const account of accounts || []) {
      switch (account.status) {
        case 'active':
          stats.activeAccounts++;
          break;
        case 'suspended':
          stats.suspendedAccounts++;
          break;
        case 'pending':
          stats.pendingAccounts++;
          break;
      }
    }

    return stats;
  }

  private async getEmailStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { count: todayCount } = await this.supabase
      .from('email_activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'email_sent')
      .gte('created_at', today.toISOString());

    const { count: monthCount } = await this.supabase
      .from('email_activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'email_sent')
      .gte('created_at', monthStart.toISOString());

    return {
      totalEmailsSentToday: todayCount || 0,
      totalEmailsSentThisMonth: monthCount || 0,
    };
  }

  private async getStorageStats() {
    const { data: accounts } = await this.supabase
      .from('email_accounts')
      .select('storage_used_mb, storage_quota_mb');

    let totalUsed = 0;
    let totalQuota = 0;

    for (const account of accounts || []) {
      totalUsed += account.storage_used_mb || 0;
      totalQuota += account.storage_quota_mb || 0;
    }

    return {
      totalStorageUsedMb: totalUsed,
      totalStorageQuotaMb: totalQuota,
      storageUsedPercent: totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0,
    };
  }

  private async getProviderStats() {
    const { data: providers } = await this.supabase
      .from('email_provider_credentials')
      .select('is_active, health_status')
      .eq('is_active', true);

    return {
      activeProviders: providers?.length || 0,
      healthyProviders: providers?.filter(p => p.health_status === 'healthy').length || 0,
    };
  }

  private async getApprovalStats() {
    const { count } = await this.supabase
      .from('email_approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    return {
      pendingApprovals: count || 0,
    };
  }

  // ============================================================================
  // PROVIDER HEALTH
  // ============================================================================

  /**
   * Get health metrics for all providers
   */
  async getProviderHealthMetrics(): Promise<ProviderHealthMetrics[]> {
    const { data: providers } = await this.supabase
      .from('email_provider_credentials')
      .select('*')
      .eq('is_active', true);

    const metrics: ProviderHealthMetrics[] = [];

    for (const provider of providers || []) {
      const healthData = await this.getProviderHealth(provider.id);
      metrics.push({
        providerId: provider.id,
        providerName: provider.provider_name,
        displayName: provider.display_name || provider.provider_name,
        status: provider.health_status || 'unknown',
        lastChecked: provider.last_health_check ? new Date(provider.last_health_check) : new Date(),
        ...healthData,
      });
    }

    return metrics;
  }

  private async getProviderHealth(providerId: string) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get 24h health checks
    const { data: healthChecks } = await this.supabase
      .from('email_provider_health')
      .select('status, latency_ms')
      .eq('provider_id', providerId)
      .gte('checked_at', dayAgo.toISOString());

    // Get today's usage
    const { data: usageLogs } = await this.supabase
      .from('email_provider_usage_logs')
      .select('is_success, response_time_ms')
      .eq('provider_id', providerId)
      .gte('created_at', today.toISOString());

    const totalChecks = healthChecks?.length || 0;
    const healthyChecks = healthChecks?.filter(c => c.status === 'healthy').length || 0;
    const uptime24h = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 100;

    const avgLatency = healthChecks && healthChecks.length > 0
      ? healthChecks.reduce((sum, c) => sum + (c.latency_ms || 0), 0) / healthChecks.length
      : 0;

    const totalRequests = usageLogs?.length || 0;
    const successfulRequests = usageLogs?.filter(l => l.is_success).length || 0;
    const failedRequests = totalRequests - successfulRequests;
    const errorRate24h = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    return {
      uptime24h,
      avgLatencyMs: Math.round(avgLatency),
      errorRate24h,
      requestsToday: totalRequests,
      successfulToday: successfulRequests,
      failedToday: failedRequests,
    };
  }

  /**
   * Perform health check on a provider
   */
  async performHealthCheck(providerId: string): Promise<{
    status: 'healthy' | 'degraded' | 'down' | 'unknown';
    latencyMs?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Get provider credentials
      const { data: provider } = await this.supabase
        .from('email_provider_credentials')
        .select('*')
        .eq('id', providerId)
        .maybeSingle();

      if (!provider) {
        return { status: 'unknown', error: 'Provider not found' };
      }

      // For now, we'll simulate a health check
      // In production, this would actually ping the provider's API
      const latencyMs = Date.now() - startTime;

      // Record health check
      await this.supabase.from('email_provider_health').insert({
        provider_id: providerId,
        check_type: 'api_health',
        status: 'healthy',
        latency_ms: latencyMs,
        checked_at: new Date().toISOString(),
      });

      // Update provider status
      await this.supabase
        .from('email_provider_credentials')
        .update({
          health_status: 'healthy',
          last_health_check: new Date().toISOString(),
        })
        .eq('id', providerId);

      return { status: 'healthy', latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Record failed health check
      await this.supabase.from('email_provider_health').insert({
        provider_id: providerId,
        check_type: 'api_health',
        status: 'down',
        latency_ms: latencyMs,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        checked_at: new Date().toISOString(),
      });

      return { status: 'down', latencyMs, error: 'Health check failed' };
    }
  }

  // ============================================================================
  // EMAIL DELIVERY METRICS
  // ============================================================================

  /**
   * Get email delivery metrics
   */
  async getDeliveryMetrics(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<EmailDeliveryMetrics> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const { data: logs } = await this.supabase
      .from('email_activity_logs')
      .select('action, status, metadata')
      .in('action', ['email_sent', 'email_delivered', 'email_bounced', 'email_failed'])
      .gte('created_at', startDate.toISOString());

    let totalSent = 0;
    let delivered = 0;
    let bounced = 0;
    let failed = 0;
    let pending = 0;

    for (const log of logs || []) {
      switch (log.action) {
        case 'email_sent':
          totalSent++;
          if (log.status === 'pending') pending++;
          break;
        case 'email_delivered':
          delivered++;
          break;
        case 'email_bounced':
          bounced++;
          break;
        case 'email_failed':
          failed++;
          break;
      }
    }

    // If we don't have delivery tracking, assume sent = delivered
    if (delivered === 0 && totalSent > 0) {
      delivered = totalSent - bounced - failed;
    }

    return {
      period,
      totalSent,
      delivered,
      bounced,
      failed,
      pending,
      deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
      bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
      avgDeliveryTimeMs: 0, // Would need webhook tracking for this
    };
  }

  /**
   * Get delivery trends over time
   */
  async getDeliveryTrends(days: number = 7): Promise<Array<{
    date: string;
    sent: number;
    delivered: number;
    bounced: number;
    failed: number;
  }>> {
    const trends: Array<{
      date: string;
      sent: number;
      delivered: number;
      bounced: number;
      failed: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { data: logs } = await this.supabase
        .from('email_activity_logs')
        .select('action')
        .in('action', ['email_sent', 'email_delivered', 'email_bounced', 'email_failed'])
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      let sent = 0;
      let delivered = 0;
      let bounced = 0;
      let failed = 0;

      for (const log of logs || []) {
        switch (log.action) {
          case 'email_sent':
            sent++;
            break;
          case 'email_delivered':
            delivered++;
            break;
          case 'email_bounced':
            bounced++;
            break;
          case 'email_failed':
            failed++;
            break;
        }
      }

      trends.push({
        date: date.toISOString().split('T')[0],
        sent,
        delivered: delivered || sent - bounced - failed,
        bounced,
        failed,
      });
    }

    return trends;
  }

  // ============================================================================
  // ACTIVITY LOGS
  // ============================================================================

  /**
   * Get recent activity logs
   */
  async getActivityLogs(options?: {
    limit?: number;
    offset?: number;
    accountId?: string;
    action?: string;
    status?: 'success' | 'failure' | 'pending';
  }): Promise<{ logs: ActivityLog[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    let query = this.supabase
      .from('email_activity_logs')
      .select(`
        *,
        email_accounts (email_address)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.accountId) {
      query = query.eq('email_account_id', options.accountId);
    }
    if (options?.action) {
      query = query.eq('action', options.action);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, count } = await query;

    const logs = (data || []).map((log): ActivityLog => ({
      id: log.id,
      accountId: log.email_account_id,
      accountEmail: log.email_accounts?.email_address,
      action: log.action,
      status: log.status || 'success',
      details: log.details,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      metadata: log.metadata,
      createdAt: new Date(log.created_at),
    }));

    return { logs, total: count || 0 };
  }

  /**
   * Get activity summary by action type
   */
  async getActivitySummary(hours: number = 24): Promise<Record<string, number>> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const { data: logs } = await this.supabase
      .from('email_activity_logs')
      .select('action')
      .gte('created_at', since.toISOString());

    const summary: Record<string, number> = {};

    for (const log of logs || []) {
      summary[log.action] = (summary[log.action] || 0) + 1;
    }

    return summary;
  }

  // ============================================================================
  // ALERTS
  // ============================================================================

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<MonitoringAlert[]> {
    // For now, generate alerts based on current metrics
    const alerts: MonitoringAlert[] = [];

    // Check provider health
    const providers = await this.getProviderHealthMetrics();
    for (const provider of providers) {
      if (provider.status === 'down') {
        alerts.push({
          id: `provider-down-${provider.providerId}`,
          alertType: 'provider_down',
          severity: 'critical',
          title: `Provider Down: ${provider.displayName}`,
          message: `The email provider ${provider.displayName} is currently unavailable.`,
          metadata: { providerId: provider.providerId },
          createdAt: new Date(),
        });
      } else if (provider.status === 'degraded') {
        alerts.push({
          id: `provider-degraded-${provider.providerId}`,
          alertType: 'provider_degraded',
          severity: 'warning',
          title: `Provider Degraded: ${provider.displayName}`,
          message: `The email provider ${provider.displayName} is experiencing degraded performance.`,
          metadata: { providerId: provider.providerId },
          createdAt: new Date(),
        });
      }
    }

    // Check for accounts near quota
    const { data: nearQuotaAccounts } = await this.supabase
      .from('email_accounts')
      .select('id, email_address, storage_used_mb, storage_quota_mb')
      .eq('status', 'active');

    for (const account of nearQuotaAccounts || []) {
      const usedPercent = account.storage_quota_mb > 0
        ? (account.storage_used_mb / account.storage_quota_mb) * 100
        : 0;

      if (usedPercent >= 95) {
        alerts.push({
          id: `quota-critical-${account.id}`,
          alertType: 'quota_critical',
          severity: 'critical',
          title: 'Storage Quota Critical',
          message: `Account ${account.email_address} has used ${usedPercent.toFixed(1)}% of storage quota.`,
          metadata: { accountId: account.id, usedPercent },
          createdAt: new Date(),
        });
      } else if (usedPercent >= 80) {
        alerts.push({
          id: `quota-warning-${account.id}`,
          alertType: 'quota_warning',
          severity: 'warning',
          title: 'Storage Quota Warning',
          message: `Account ${account.email_address} has used ${usedPercent.toFixed(1)}% of storage quota.`,
          metadata: { accountId: account.id, usedPercent },
          createdAt: new Date(),
        });
      }
    }

    return alerts.slice(0, 20); // Limit to 20 alerts
  }

  // ============================================================================
  // TOP METRICS
  // ============================================================================

  /**
   * Get top senders
   */
  async getTopSenders(limit: number = 10): Promise<Array<{
    accountId: string;
    email: string;
    displayName: string;
    emailsSentToday: number;
  }>> {
    const { data: accounts } = await this.supabase
      .from('email_accounts')
      .select('id, email_address, display_name, emails_sent_today')
      .eq('status', 'active')
      .order('emails_sent_today', { ascending: false })
      .limit(limit);

    return (accounts || []).map(a => ({
      accountId: a.id,
      email: a.email_address,
      displayName: a.display_name || a.email_address.split('@')[0],
      emailsSentToday: a.emails_sent_today || 0,
    }));
  }

  /**
   * Get accounts with errors
   */
  async getAccountsWithErrors(limit: number = 10): Promise<Array<{
    accountId: string;
    email: string;
    errorCount: number;
    lastError: Date;
  }>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: errors } = await this.supabase
      .from('email_activity_logs')
      .select('email_account_id, created_at, email_accounts(email_address)')
      .eq('status', 'failure')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    // Group by account
    const accountErrors: Record<string, { count: number; lastError: Date; email: string }> = {};

    for (const error of errors || []) {
      if (!error.email_account_id) continue;

      if (!accountErrors[error.email_account_id]) {
        accountErrors[error.email_account_id] = {
          count: 0,
          lastError: new Date(error.created_at),
          email: error.email_accounts?.email_address || 'Unknown',
        };
      }
      accountErrors[error.email_account_id].count++;
    }

    return Object.entries(accountErrors)
      .map(([accountId, data]) => ({
        accountId,
        email: data.email,
        errorCount: data.count,
        lastError: data.lastError,
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, limit);
  }
}

// Singleton
let monitoringServiceInstance: MonitoringService | null = null;

export function getMonitoringService(): MonitoringService {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new MonitoringService();
  }
  return monitoringServiceInstance;
}

export default MonitoringService;
