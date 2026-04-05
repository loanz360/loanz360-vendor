/**
 * Email Quota Management Service
 * Enterprise-grade hierarchical quota system
 *
 * Features:
 * - Hierarchical quota policies (Organization → Department → Role → Individual)
 * - Real-time quota monitoring
 * - Quota alerts and notifications
 * - Policy enforcement
 * - Quota usage analytics
 */

import { createSupabaseAdmin } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export type QuotaSource = 'organization' | 'department' | 'role' | 'individual';

export interface QuotaPolicy {
  id: string;
  name: string;
  description?: string;
  scopeType: QuotaSource;
  scopeId?: string; // Department ID, Role name, or Account ID
  scopeName?: string;

  // Storage Quotas
  storageQuotaMb: number;
  storageWarningThresholdPercent: number;
  storageCriticalThresholdPercent: number;

  // Send Quotas
  dailySendLimit: number;
  hourlySendLimit?: number;
  monthlySendLimit?: number;

  // Email Size Limits
  maxAttachmentSizeMb: number;
  maxEmailSizeMb: number;
  maxRecipientsPerEmail: number;

  // Priority
  priority: number;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface EffectiveQuota {
  storageQuotaMb: number;
  storageWarningThresholdPercent: number;
  storageCriticalThresholdPercent: number;
  dailySendLimit: number;
  hourlySendLimit: number;
  monthlySendLimit: number;
  maxAttachmentSizeMb: number;
  maxEmailSizeMb: number;
  maxRecipientsPerEmail: number;
  source: QuotaSource;
  policyId?: string;
  policyName?: string;
}

export interface QuotaUsage {
  accountId: string;
  email: string;

  // Storage
  storageUsedMb: number;
  storageQuotaMb: number;
  storageUsedPercent: number;
  storageStatus: 'ok' | 'warning' | 'critical' | 'exceeded';

  // Daily Sends
  emailsSentToday: number;
  dailySendLimit: number;
  dailySendUsedPercent: number;
  dailySendStatus: 'ok' | 'warning' | 'critical' | 'exceeded';

  // Hourly Sends
  emailsSentThisHour: number;
  hourlySendLimit: number;
  hourlySendUsedPercent: number;
  hourlySendStatus: 'ok' | 'warning' | 'critical' | 'exceeded';

  // Monthly Sends
  emailsSentThisMonth: number;
  monthlySendLimit: number;
  monthlySendUsedPercent: number;
  monthlySendStatus: 'ok' | 'warning' | 'critical' | 'exceeded';

  effectiveQuota: EffectiveQuota;
}

export interface QuotaAlert {
  id: string;
  accountId: string;
  alertType: 'storage_warning' | 'storage_critical' | 'storage_exceeded' |
             'daily_send_warning' | 'daily_send_critical' | 'daily_send_exceeded' |
             'hourly_send_exceeded' | 'monthly_send_warning' | 'monthly_send_exceeded';
  message: string;
  currentValue: number;
  thresholdValue: number;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export interface CreatePolicyParams {
  name: string;
  description?: string;
  scopeType: QuotaSource;
  scopeId?: string;
  scopeName?: string;
  storageQuotaMb?: number;
  storageWarningThresholdPercent?: number;
  storageCriticalThresholdPercent?: number;
  dailySendLimit?: number;
  hourlySendLimit?: number;
  monthlySendLimit?: number;
  maxAttachmentSizeMb?: number;
  maxEmailSizeMb?: number;
  maxRecipientsPerEmail?: number;
  priority?: number;
}

// ============================================================================
// DEFAULT QUOTAS
// ============================================================================

const DEFAULT_ORGANIZATION_QUOTA: EffectiveQuota = {
  storageQuotaMb: 5120, // 5 GB
  storageWarningThresholdPercent: 80,
  storageCriticalThresholdPercent: 95,
  dailySendLimit: 500,
  hourlySendLimit: 100,
  monthlySendLimit: 10000,
  maxAttachmentSizeMb: 25,
  maxEmailSizeMb: 35,
  maxRecipientsPerEmail: 50,
  source: 'organization',
};

// ============================================================================
// QUOTA SERVICE
// ============================================================================

export class QuotaService {
  private supabase = createSupabaseAdmin();

  // ============================================================================
  // POLICY MANAGEMENT
  // ============================================================================

  /**
   * Create a new quota policy
   */
  async createPolicy(
    params: CreatePolicyParams,
    createdBy: string
  ): Promise<{ success: boolean; policyId?: string; error?: string }> {
    try {
      // Validate scope
      if (params.scopeType !== 'organization' && !params.scopeId && !params.scopeName) {
        return { success: false, error: 'Scope ID or name required for non-organization policies' };
      }

      const { data, error } = await this.supabase
        .from('email_department_policies')
        .insert({
          policy_name: params.name,
          description: params.description,
          department_id: params.scopeType === 'department' ? params.scopeId : null,
          department_name: params.scopeName || params.name,
          storage_quota_mb: params.storageQuotaMb || DEFAULT_ORGANIZATION_QUOTA.storageQuotaMb,
          daily_send_limit: params.dailySendLimit || DEFAULT_ORGANIZATION_QUOTA.dailySendLimit,
          max_attachment_size_mb: params.maxAttachmentSizeMb || DEFAULT_ORGANIZATION_QUOTA.maxAttachmentSizeMb,
          max_recipients_per_email: params.maxRecipientsPerEmail || DEFAULT_ORGANIZATION_QUOTA.maxRecipientsPerEmail,
          priority: params.priority || 100,
          is_active: true,
          created_by: createdBy,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[QuotaService] Error creating policy:', error);
        return { success: false, error: 'Failed to create policy' };
      }

      return { success: true, policyId: data.id };
    } catch (error) {
      console.error('[QuotaService] Error creating policy:', error);
      return { success: false, error: 'Failed to create policy' };
    }
  }

  /**
   * Get all active policies
   */
  async getPolicies(): Promise<QuotaPolicy[]> {
    const { data } = await this.supabase
      .from('email_department_policies')
      .select('*')
      .eq('is_active', true)
      .order('priority');

    return (data || []).map(this.mapDbToPolicy);
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(policyId: string): Promise<QuotaPolicy | null> {
    const { data } = await this.supabase
      .from('email_department_policies')
      .select('*')
      .eq('id', policyId)
      .maybeSingle();

    if (!data) return null;
    return this.mapDbToPolicy(data);
  }

  /**
   * Update a policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<CreatePolicyParams>,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      };

      if (updates.name) updateData.policy_name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.storageQuotaMb !== undefined) updateData.storage_quota_mb = updates.storageQuotaMb;
      if (updates.dailySendLimit !== undefined) updateData.daily_send_limit = updates.dailySendLimit;
      if (updates.maxAttachmentSizeMb !== undefined) updateData.max_attachment_size_mb = updates.maxAttachmentSizeMb;
      if (updates.maxRecipientsPerEmail !== undefined) updateData.max_recipients_per_email = updates.maxRecipientsPerEmail;
      if (updates.priority !== undefined) updateData.priority = updates.priority;

      const { error } = await this.supabase
        .from('email_department_policies')
        .update(updateData)
        .eq('id', policyId);

      if (error) {
        return { success: false, error: 'Failed to update policy' };
      }

      return { success: true };
    } catch (error) {
      console.error('[QuotaService] Error updating policy:', error);
      return { success: false, error: 'Failed to update policy' };
    }
  }

  /**
   * Deactivate a policy
   */
  async deactivatePolicy(policyId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('email_department_policies')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', policyId);

    if (error) {
      return { success: false, error: 'Failed to deactivate policy' };
    }

    return { success: true };
  }

  // ============================================================================
  // QUOTA RESOLUTION
  // ============================================================================

  /**
   * Get effective quota for an account (hierarchical resolution)
   */
  async getEffectiveQuota(accountId: string): Promise<EffectiveQuota> {
    // Get account with employee profile
    const { data: account } = await this.supabase
      .from('email_accounts')
      .select(`
        id,
        storage_quota_mb,
        daily_send_limit,
        department_policy_id,
        employee_profile:employee_profile_id (
          department,
          designation
        )
      `)
      .eq('id', accountId)
      .maybeSingle();

    if (!account) {
      return DEFAULT_ORGANIZATION_QUOTA;
    }

    // Level 1: Check individual override
    if (account.storage_quota_mb && account.daily_send_limit) {
      return {
        storageQuotaMb: account.storage_quota_mb,
        storageWarningThresholdPercent: 80,
        storageCriticalThresholdPercent: 95,
        dailySendLimit: account.daily_send_limit,
        hourlySendLimit: Math.ceil(account.daily_send_limit / 10),
        monthlySendLimit: account.daily_send_limit * 30,
        maxAttachmentSizeMb: 25,
        maxEmailSizeMb: 35,
        maxRecipientsPerEmail: 50,
        source: 'individual',
      };
    }

    // Level 2: Check assigned department policy
    if (account.department_policy_id) {
      const policy = await this.getPolicyById(account.department_policy_id);
      if (policy) {
        return {
          storageQuotaMb: policy.storageQuotaMb,
          storageWarningThresholdPercent: policy.storageWarningThresholdPercent,
          storageCriticalThresholdPercent: policy.storageCriticalThresholdPercent,
          dailySendLimit: policy.dailySendLimit,
          hourlySendLimit: policy.hourlySendLimit || Math.ceil(policy.dailySendLimit / 10),
          monthlySendLimit: policy.monthlySendLimit || policy.dailySendLimit * 30,
          maxAttachmentSizeMb: policy.maxAttachmentSizeMb,
          maxEmailSizeMb: policy.maxEmailSizeMb,
          maxRecipientsPerEmail: policy.maxRecipientsPerEmail,
          source: 'department',
          policyId: policy.id,
          policyName: policy.name,
        };
      }
    }

    // Level 3: Check department-based policy
    const department = account.employee_profile?.department;
    if (department) {
      const { data: deptPolicy } = await this.supabase
        .from('email_department_policies')
        .select('*')
        .eq('department_name', department)
        .eq('is_active', true)
        .order('priority')
        .limit(1)
        .maybeSingle();

      if (deptPolicy) {
        const policy = this.mapDbToPolicy(deptPolicy);
        return {
          storageQuotaMb: policy.storageQuotaMb,
          storageWarningThresholdPercent: policy.storageWarningThresholdPercent,
          storageCriticalThresholdPercent: policy.storageCriticalThresholdPercent,
          dailySendLimit: policy.dailySendLimit,
          hourlySendLimit: policy.hourlySendLimit || Math.ceil(policy.dailySendLimit / 10),
          monthlySendLimit: policy.monthlySendLimit || policy.dailySendLimit * 30,
          maxAttachmentSizeMb: policy.maxAttachmentSizeMb,
          maxEmailSizeMb: policy.maxEmailSizeMb,
          maxRecipientsPerEmail: policy.maxRecipientsPerEmail,
          source: 'department',
          policyId: policy.id,
          policyName: policy.name,
        };
      }
    }

    // Level 4: Return organization defaults
    return DEFAULT_ORGANIZATION_QUOTA;
  }

  // ============================================================================
  // QUOTA USAGE
  // ============================================================================

  /**
   * Get quota usage for an account
   */
  async getQuotaUsage(accountId: string): Promise<QuotaUsage | null> {
    const { data: account } = await this.supabase
      .from('email_accounts')
      .select('id, email_address, storage_used_mb, emails_sent_today')
      .eq('id', accountId)
      .maybeSingle();

    if (!account) return null;

    const effectiveQuota = await this.getEffectiveQuota(accountId);

    // Get hourly and monthly send counts
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: hourlySends } = await this.supabase
      .from('email_activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('email_account_id', accountId)
      .eq('action', 'email_sent')
      .gte('created_at', oneHourAgo.toISOString());

    const { count: monthlySends } = await this.supabase
      .from('email_activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('email_account_id', accountId)
      .eq('action', 'email_sent')
      .gte('created_at', monthStart.toISOString());

    const storageUsedPercent = effectiveQuota.storageQuotaMb > 0
      ? (account.storage_used_mb / effectiveQuota.storageQuotaMb) * 100
      : 0;

    const dailySendUsedPercent = effectiveQuota.dailySendLimit > 0
      ? (account.emails_sent_today / effectiveQuota.dailySendLimit) * 100
      : 0;

    const hourlySendUsedPercent = effectiveQuota.hourlySendLimit > 0
      ? ((hourlySends || 0) / effectiveQuota.hourlySendLimit) * 100
      : 0;

    const monthlySendUsedPercent = effectiveQuota.monthlySendLimit > 0
      ? ((monthlySends || 0) / effectiveQuota.monthlySendLimit) * 100
      : 0;

    return {
      accountId: account.id,
      email: account.email_address,

      storageUsedMb: account.storage_used_mb || 0,
      storageQuotaMb: effectiveQuota.storageQuotaMb,
      storageUsedPercent,
      storageStatus: this.getQuotaStatus(storageUsedPercent, effectiveQuota.storageWarningThresholdPercent, effectiveQuota.storageCriticalThresholdPercent),

      emailsSentToday: account.emails_sent_today || 0,
      dailySendLimit: effectiveQuota.dailySendLimit,
      dailySendUsedPercent,
      dailySendStatus: this.getQuotaStatus(dailySendUsedPercent, 80, 95),

      emailsSentThisHour: hourlySends || 0,
      hourlySendLimit: effectiveQuota.hourlySendLimit,
      hourlySendUsedPercent,
      hourlySendStatus: this.getQuotaStatus(hourlySendUsedPercent, 80, 95),

      emailsSentThisMonth: monthlySends || 0,
      monthlySendLimit: effectiveQuota.monthlySendLimit,
      monthlySendUsedPercent,
      monthlySendStatus: this.getQuotaStatus(monthlySendUsedPercent, 80, 95),

      effectiveQuota,
    };
  }

  /**
   * Get quota usage for all accounts (summary)
   */
  async getAllQuotaUsage(options?: {
    status?: 'ok' | 'warning' | 'critical' | 'exceeded';
    limit?: number;
    offset?: number;
  }): Promise<{ accounts: QuotaUsage[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const { data: accounts, count } = await this.supabase
      .from('email_accounts')
      .select('id', { count: 'exact' })
      .eq('status', 'active')
      .range(offset, offset + limit - 1);

    const usages: QuotaUsage[] = [];

    for (const account of accounts || []) {
      const usage = await this.getQuotaUsage(account.id);
      if (usage) {
        // Filter by status if specified
        if (options?.status) {
          if (usage.storageStatus === options.status ||
              usage.dailySendStatus === options.status) {
            usages.push(usage);
          }
        } else {
          usages.push(usage);
        }
      }
    }

    return { accounts: usages, total: count || 0 };
  }

  /**
   * Get accounts near quota limits
   */
  async getAccountsNearQuota(thresholdPercent: number = 80): Promise<QuotaUsage[]> {
    const { data: accounts } = await this.supabase
      .from('email_accounts')
      .select('id, email_address, storage_used_mb, storage_quota_mb, emails_sent_today, daily_send_limit')
      .eq('status', 'active');

    const nearQuotaAccounts: QuotaUsage[] = [];

    for (const account of accounts || []) {
      const storagePercent = account.storage_quota_mb > 0
        ? (account.storage_used_mb / account.storage_quota_mb) * 100
        : 0;
      const sendPercent = account.daily_send_limit > 0
        ? (account.emails_sent_today / account.daily_send_limit) * 100
        : 0;

      if (storagePercent >= thresholdPercent || sendPercent >= thresholdPercent) {
        const usage = await this.getQuotaUsage(account.id);
        if (usage) {
          nearQuotaAccounts.push(usage);
        }
      }
    }

    return nearQuotaAccounts.sort((a, b) => {
      const aMax = Math.max(a.storageUsedPercent, a.dailySendUsedPercent);
      const bMax = Math.max(b.storageUsedPercent, b.dailySendUsedPercent);
      return bMax - aMax;
    });
  }

  // ============================================================================
  // QUOTA ENFORCEMENT
  // ============================================================================

  /**
   * Check if an account can send email
   */
  async canSendEmail(
    accountId: string,
    recipientCount: number = 1,
    attachmentSizeMb: number = 0
  ): Promise<{
    allowed: boolean;
    reason?: string;
    quotaUsage?: QuotaUsage;
  }> {
    const usage = await this.getQuotaUsage(accountId);
    if (!usage) {
      return { allowed: false, reason: 'Account not found' };
    }

    // Check daily limit
    if (usage.emailsSentToday >= usage.dailySendLimit) {
      return {
        allowed: false,
        reason: 'Daily send limit exceeded',
        quotaUsage: usage,
      };
    }

    // Check hourly limit
    if (usage.emailsSentThisHour >= usage.hourlySendLimit) {
      return {
        allowed: false,
        reason: 'Hourly send limit exceeded',
        quotaUsage: usage,
      };
    }

    // Check monthly limit
    if (usage.emailsSentThisMonth >= usage.monthlySendLimit) {
      return {
        allowed: false,
        reason: 'Monthly send limit exceeded',
        quotaUsage: usage,
      };
    }

    // Check recipient limit
    if (recipientCount > usage.effectiveQuota.maxRecipientsPerEmail) {
      return {
        allowed: false,
        reason: `Maximum ${usage.effectiveQuota.maxRecipientsPerEmail} recipients allowed`,
        quotaUsage: usage,
      };
    }

    // Check attachment size
    if (attachmentSizeMb > usage.effectiveQuota.maxAttachmentSizeMb) {
      return {
        allowed: false,
        reason: `Attachment exceeds ${usage.effectiveQuota.maxAttachmentSizeMb}MB limit`,
        quotaUsage: usage,
      };
    }

    return { allowed: true, quotaUsage: usage };
  }

  /**
   * Update account individual quota
   */
  async updateAccountQuota(
    accountId: string,
    updates: {
      storageQuotaMb?: number;
      dailySendLimit?: number;
    },
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.storageQuotaMb !== undefined) {
        updateData.storage_quota_mb = updates.storageQuotaMb;
      }
      if (updates.dailySendLimit !== undefined) {
        updateData.daily_send_limit = updates.dailySendLimit;
      }

      const { error } = await this.supabase
        .from('email_accounts')
        .update(updateData)
        .eq('id', accountId);

      if (error) {
        return { success: false, error: 'Failed to update quota' };
      }

      // Log the change
      await this.supabase.from('email_account_lifecycle_events').insert({
        email_account_id: accountId,
        event_type: 'quota_exceeded', // Reusing for quota changes
        triggered_by: 'admin',
        triggered_by_user_id: updatedBy,
        metadata: { updates, action: 'quota_update' },
      });

      return { success: true };
    } catch (error) {
      console.error('[QuotaService] Error updating account quota:', error);
      return { success: false, error: 'Failed to update quota' };
    }
  }

  /**
   * Assign policy to account
   */
  async assignPolicyToAccount(
    accountId: string,
    policyId: string,
    assignedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('email_accounts')
        .update({
          department_policy_id: policyId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      if (error) {
        return { success: false, error: 'Failed to assign policy' };
      }

      return { success: true };
    } catch (error) {
      console.error('[QuotaService] Error assigning policy:', error);
      return { success: false, error: 'Failed to assign policy' };
    }
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  /**
   * Get quota usage statistics
   */
  async getQuotaStatistics(): Promise<{
    totalAccounts: number;
    accountsByStorageStatus: Record<string, number>;
    accountsBySendStatus: Record<string, number>;
    averageStorageUsedPercent: number;
    averageDailySendUsedPercent: number;
    totalStorageUsedMb: number;
    totalStorageQuotaMb: number;
  }> {
    const { data: accounts } = await this.supabase
      .from('email_accounts')
      .select('id, storage_used_mb, storage_quota_mb, emails_sent_today, daily_send_limit')
      .eq('status', 'active');

    const stats = {
      totalAccounts: accounts?.length || 0,
      accountsByStorageStatus: { ok: 0, warning: 0, critical: 0, exceeded: 0 },
      accountsBySendStatus: { ok: 0, warning: 0, critical: 0, exceeded: 0 },
      averageStorageUsedPercent: 0,
      averageDailySendUsedPercent: 0,
      totalStorageUsedMb: 0,
      totalStorageQuotaMb: 0,
    };

    if (!accounts || accounts.length === 0) {
      return stats;
    }

    let totalStoragePercent = 0;
    let totalSendPercent = 0;

    for (const account of accounts) {
      const storagePercent = account.storage_quota_mb > 0
        ? (account.storage_used_mb / account.storage_quota_mb) * 100
        : 0;
      const sendPercent = account.daily_send_limit > 0
        ? (account.emails_sent_today / account.daily_send_limit) * 100
        : 0;

      const storageStatus = this.getQuotaStatus(storagePercent, 80, 95);
      const sendStatus = this.getQuotaStatus(sendPercent, 80, 95);

      stats.accountsByStorageStatus[storageStatus]++;
      stats.accountsBySendStatus[sendStatus]++;

      totalStoragePercent += storagePercent;
      totalSendPercent += sendPercent;

      stats.totalStorageUsedMb += account.storage_used_mb || 0;
      stats.totalStorageQuotaMb += account.storage_quota_mb || 0;
    }

    stats.averageStorageUsedPercent = totalStoragePercent / accounts.length;
    stats.averageDailySendUsedPercent = totalSendPercent / accounts.length;

    return stats;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getQuotaStatus(
    usedPercent: number,
    warningThreshold: number,
    criticalThreshold: number
  ): 'ok' | 'warning' | 'critical' | 'exceeded' {
    if (usedPercent >= 100) return 'exceeded';
    if (usedPercent >= criticalThreshold) return 'critical';
    if (usedPercent >= warningThreshold) return 'warning';
    return 'ok';
  }

  private mapDbToPolicy(data: Record<string, unknown>): QuotaPolicy {
    return {
      id: data.id as string,
      name: data.policy_name as string,
      description: data.description as string | undefined,
      scopeType: data.department_id ? 'department' : 'organization',
      scopeId: data.department_id as string | undefined,
      scopeName: data.department_name as string | undefined,
      storageQuotaMb: (data.storage_quota_mb as number) || 5120,
      storageWarningThresholdPercent: 80,
      storageCriticalThresholdPercent: 95,
      dailySendLimit: (data.daily_send_limit as number) || 500,
      hourlySendLimit: undefined,
      monthlySendLimit: (data.monthly_send_limit as number) || undefined,
      maxAttachmentSizeMb: (data.max_attachment_size_mb as number) || 25,
      maxEmailSizeMb: 35,
      maxRecipientsPerEmail: (data.max_recipients_per_email as number) || 50,
      priority: (data.priority as number) || 100,
      isActive: data.is_active as boolean,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

// Singleton
let quotaServiceInstance: QuotaService | null = null;

export function getQuotaService(): QuotaService {
  if (!quotaServiceInstance) {
    quotaServiceInstance = new QuotaService();
  }
  return quotaServiceInstance;
}

export default QuotaService;
