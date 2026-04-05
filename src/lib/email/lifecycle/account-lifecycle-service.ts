/**
 * Email Account Lifecycle Service
 * Enterprise-grade account lifecycle management
 *
 * Features:
 * - Full account lifecycle (creation → activation → suspension → termination)
 * - Automated lifecycle events based on policies
 * - Integration with HR systems for onboarding/offboarding
 * - Audit trail for all lifecycle changes
 * - Async provider integration via job queue
 * - Auto-reactivation scheduling
 */

import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getEmailProviderService } from '@/lib/email/providers';
import {
  queueAccountCreation,
  queueAccountSuspension,
  queueAccountActivation,
  queueAccountDeletion,
  queueQuotaSync,
  getAccountJobStatus,
} from './email-account-queue';

// ============================================================================
// TYPES
// ============================================================================

export type AccountLifecycleState =
  | 'pending_approval'
  | 'creating'
  | 'active'
  | 'suspended'
  | 'inactive'
  | 'pending_offboard'
  | 'archived'
  | 'terminated';

export type LifecycleEventType =
  | 'created'
  | 'activated'
  | 'suspended'
  | 'reactivated'
  | 'disabled'
  | 'pending_offboard'
  | 'archived'
  | 'terminated'
  | 'deleted'
  | 'quota_exceeded'
  | 'quota_warning'
  | 'storage_exceeded'
  | 'inactivity_warning'
  | 'password_reset'
  | 'security_lock'
  | 'compliance_hold'
  | 'legal_hold_applied'
  | 'legal_hold_released'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied';

export type LifecycleTrigger =
  | 'admin'
  | 'system'
  | 'policy'
  | 'employee_exit'
  | 'inactivity'
  | 'scheduled'
  | 'hr_integration';

export interface LifecycleEvent {
  id: string;
  emailAccountId: string;
  eventType: LifecycleEventType;
  triggeredBy: LifecycleTrigger;
  triggeredByUserId?: string;
  previousState?: AccountLifecycleState;
  newState?: AccountLifecycleState;
  reason?: string;
  adminNotes?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateAccountParams {
  userId: string;
  employeeProfileId?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  department?: string;
  designation?: string;
  storageQuotaMb?: number;
  dailySendLimit?: number;
  requireApproval?: boolean;
}

export interface OffboardAccountParams {
  accountId: string;
  reason?: string;
  scheduledDate?: Date;
  backupData?: boolean;
  forwardEmailsTo?: string;
  autoReplyMessage?: string;
}

export interface SuspendAccountParams {
  accountId: string;
  reason: string;
  duration?: number; // Days
  autoReactivate?: boolean;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class AccountLifecycleService {
  private supabase = createSupabaseAdmin();
  private providerService = getEmailProviderService();

  // ============================================================================
  // ACCOUNT CREATION
  // ============================================================================

  /**
   * Create a new email account with full lifecycle tracking
   */
  async createAccount(
    params: CreateAccountParams,
    adminUserId?: string
  ): Promise<{
    success: boolean;
    accountId?: string;
    email?: string;
    error?: string;
    requiresApproval?: boolean;
  }> {
    try {
      // Check if user already has an account
      const { data: existing } = await this.supabase
        .from('email_accounts')
        .select('id')
        .eq('user_id', params.userId)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'User already has an email account' };
      }

      // Get provider configuration
      const provider = await this.providerService.getPrimaryProvider();
      if (!provider) {
        return { success: false, error: 'No active email provider configured' };
      }

      // Check if approval is required
      if (params.requireApproval) {
        // Create account in pending_approval state
        const { data: account, error } = await this.supabase
          .from('email_accounts')
          .insert({
            user_id: params.userId,
            employee_profile_id: params.employeeProfileId,
            display_name: params.displayName || `${params.firstName} ${params.lastName}`,
            lifecycle_state: 'pending_approval',
            status: 'pending',
            storage_quota_mb: params.storageQuotaMb || 5120,
            daily_send_limit: params.dailySendLimit || 500,
            created_by: adminUserId,
          })
          .select('id')
          .maybeSingle();

        if (error) {
          return { success: false, error: 'Failed to create account request' };
        }

        // Log lifecycle event
        await this.logLifecycleEvent({
          emailAccountId: account.id,
          eventType: 'approval_requested',
          triggeredBy: adminUserId ? 'admin' : 'system',
          triggeredByUserId: adminUserId,
          newState: 'pending_approval',
          metadata: { params },
        });

        return {
          success: true,
          accountId: account.id,
          requiresApproval: true,
        };
      }

      // Create account directly
      return this.provisionAccount(params, adminUserId);
    } catch (error) {
      console.error('[AccountLifecycle] Error creating account:', error);
      return { success: false, error: 'Failed to create account' };
    }
  }

  /**
   * Provision account on the email provider
   * Uses async job queue to create account on provider
   */
  private async provisionAccount(
    params: CreateAccountParams,
    adminUserId?: string
  ): Promise<{
    success: boolean;
    accountId?: string;
    email?: string;
    jobId?: string;
    error?: string;
  }> {
    try {
      // Generate unique email address
      const { data: config } = await this.supabase
        .from('email_provider_config')
        .select('domain')
        .eq('is_active', true)
        .maybeSingle();

      if (!config?.domain) {
        return { success: false, error: 'Email domain not configured' };
      }

      const emailAddress = await this.generateUniqueEmail(
        params.firstName,
        params.lastName,
        config.domain
      );

      // Create account record in "creating" state
      const { data: account, error: createError } = await this.supabase
        .from('email_accounts')
        .insert({
          user_id: params.userId,
          employee_profile_id: params.employeeProfileId,
          email_address: emailAddress,
          email_local_part: emailAddress.split('@')[0],
          display_name: params.displayName || `${params.firstName} ${params.lastName}`,
          lifecycle_state: 'creating',
          status: 'pending',
          storage_quota_mb: params.storageQuotaMb || 5120,
          daily_send_limit: params.dailySendLimit || 500,
          created_by: adminUserId,
        })
        .select('id')
        .maybeSingle();

      if (createError) {
        return { success: false, error: 'Failed to create account record' };
      }

      // Log creation event
      await this.logLifecycleEvent({
        emailAccountId: account.id,
        eventType: 'created',
        triggeredBy: adminUserId ? 'admin' : 'system',
        triggeredByUserId: adminUserId,
        newState: 'creating',
        metadata: { email: emailAddress },
      });

      // Queue async job to create account on provider
      const job = await queueAccountCreation({
        accountId: account.id,
        email: emailAddress,
        displayName: params.displayName || `${params.firstName} ${params.lastName}`,
        firstName: params.firstName,
        lastName: params.lastName,
        department: params.department,
        storageQuotaMb: params.storageQuotaMb || 5120,
        initiatedBy: adminUserId,
      });

      console.info(`[AccountLifecycle] Queued account creation job: ${job.id} for ${emailAddress}`);

      return {
        success: true,
        accountId: account.id,
        email: emailAddress,
        jobId: job.id,
      };
    } catch (error) {
      console.error('[AccountLifecycle] Error provisioning account:', error);
      return { success: false, error: 'Failed to provision account' };
    }
  }

  // ============================================================================
  // ACCOUNT SUSPENSION
  // ============================================================================

  /**
   * Suspend an email account
   * Uses async job queue to suspend account on provider
   */
  async suspendAccount(
    params: SuspendAccountParams,
    adminUserId?: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      // Get current account state
      const { data: account } = await this.supabase
        .from('email_accounts')
        .select('id, lifecycle_state, legal_hold_applied, provider_account_id')
        .eq('id', params.accountId)
        .maybeSingle();

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      // Check if under legal hold
      if (account.legal_hold_applied) {
        return { success: false, error: 'Cannot suspend account under legal hold' };
      }

      // Update local account state immediately
      const { error } = await this.supabase
        .from('email_accounts')
        .update({
          lifecycle_state: 'suspended',
          status: 'suspended',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.accountId);

      if (error) {
        return { success: false, error: 'Failed to suspend account' };
      }

      // Log event
      await this.logLifecycleEvent({
        emailAccountId: params.accountId,
        eventType: 'suspended',
        triggeredBy: adminUserId ? 'admin' : 'system',
        triggeredByUserId: adminUserId,
        previousState: account.lifecycle_state as AccountLifecycleState,
        newState: 'suspended',
        reason: params.reason,
        metadata: {
          duration: params.duration,
          autoReactivate: params.autoReactivate,
        },
      });

      // Queue async job to suspend on provider and schedule auto-reactivation
      const job = await queueAccountSuspension({
        accountId: params.accountId,
        providerAccountId: account.provider_account_id || undefined,
        reason: params.reason,
        duration: params.duration,
        autoReactivate: params.autoReactivate ?? false,
        initiatedBy: adminUserId,
      });

      console.info(`[AccountLifecycle] Queued account suspension job: ${job.id}`);

      return { success: true, jobId: job.id };
    } catch (error) {
      console.error('[AccountLifecycle] Error suspending account:', error);
      return { success: false, error: 'Failed to suspend account' };
    }
  }

  /**
   * Reactivate a suspended account
   * Uses async job queue to reactivate on provider
   */
  async reactivateAccount(
    accountId: string,
    adminUserId?: string,
    reason?: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const { data: account } = await this.supabase
        .from('email_accounts')
        .select('id, lifecycle_state, provider_account_id')
        .eq('id', accountId)
        .maybeSingle();

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      if (account.lifecycle_state !== 'suspended' && account.lifecycle_state !== 'inactive') {
        return { success: false, error: 'Account is not suspended' };
      }

      // Update local state immediately
      const { error } = await this.supabase
        .from('email_accounts')
        .update({
          lifecycle_state: 'active',
          status: 'active',
          inactivity_warning_sent_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      if (error) {
        return { success: false, error: 'Failed to reactivate account' };
      }

      // Log event
      await this.logLifecycleEvent({
        emailAccountId: accountId,
        eventType: 'reactivated',
        triggeredBy: adminUserId ? 'admin' : 'system',
        triggeredByUserId: adminUserId,
        previousState: account.lifecycle_state as AccountLifecycleState,
        newState: 'active',
        reason,
      });

      // Queue async job to reactivate on provider
      const job = await queueAccountActivation({
        accountId,
        providerAccountId: account.provider_account_id || undefined,
        reason,
        initiatedBy: adminUserId,
      });

      console.info(`[AccountLifecycle] Queued account activation job: ${job.id}`);

      return { success: true, jobId: job.id };
    } catch (error) {
      console.error('[AccountLifecycle] Error reactivating account:', error);
      return { success: false, error: 'Failed to reactivate account' };
    }
  }

  // ============================================================================
  // OFFBOARDING
  // ============================================================================

  /**
   * Initiate employee offboarding process
   */
  async initiateOffboarding(
    params: OffboardAccountParams,
    adminUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: account } = await this.supabase
        .from('email_accounts')
        .select('id, lifecycle_state, legal_hold_applied')
        .eq('id', params.accountId)
        .maybeSingle();

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      if (account.legal_hold_applied) {
        return { success: false, error: 'Cannot offboard account under legal hold' };
      }

      // Update account for offboarding
      const { error } = await this.supabase
        .from('email_accounts')
        .update({
          lifecycle_state: 'pending_offboard',
          scheduled_offboard_date: params.scheduledDate?.toISOString() || new Date().toISOString(),
          offboard_initiated_by: adminUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.accountId);

      if (error) {
        return { success: false, error: 'Failed to initiate offboarding' };
      }

      // Log event
      await this.logLifecycleEvent({
        emailAccountId: params.accountId,
        eventType: 'pending_offboard',
        triggeredBy: adminUserId ? 'admin' : 'hr_integration',
        triggeredByUserId: adminUserId,
        previousState: account.lifecycle_state as AccountLifecycleState,
        newState: 'pending_offboard',
        reason: params.reason,
        metadata: {
          scheduledDate: params.scheduledDate,
          backupData: params.backupData,
          forwardEmailsTo: params.forwardEmailsTo,
          autoReplyMessage: params.autoReplyMessage,
        },
      });

      // Set up auto-reply if specified
      if (params.autoReplyMessage) {
        await this.supabase
          .from('email_accounts')
          .update({
            auto_reply_enabled: true,
            auto_reply_message: params.autoReplyMessage,
          })
          .eq('id', params.accountId);
      }

      return { success: true };
    } catch (error) {
      console.error('[AccountLifecycle] Error initiating offboarding:', error);
      return { success: false, error: 'Failed to initiate offboarding' };
    }
  }

  /**
   * Complete offboarding process (archive account)
   */
  async completeOffboarding(
    accountId: string,
    adminUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: account } = await this.supabase
        .from('email_accounts')
        .select('id, lifecycle_state')
        .eq('id', accountId)
        .maybeSingle();

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      // Archive account
      const { error } = await this.supabase
        .from('email_accounts')
        .update({
          lifecycle_state: 'archived',
          status: 'disabled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      if (error) {
        return { success: false, error: 'Failed to archive account' };
      }

      // Log event
      await this.logLifecycleEvent({
        emailAccountId: accountId,
        eventType: 'archived',
        triggeredBy: adminUserId ? 'admin' : 'system',
        triggeredByUserId: adminUserId,
        previousState: account.lifecycle_state as AccountLifecycleState,
        newState: 'archived',
      });

      return { success: true };
    } catch (error) {
      console.error('[AccountLifecycle] Error completing offboarding:', error);
      return { success: false, error: 'Failed to complete offboarding' };
    }
  }

  /**
   * Permanently terminate an account
   * Uses async job queue to delete from provider
   */
  async terminateAccount(
    accountId: string,
    adminUserId?: string,
    reason?: string,
    options?: { permanent?: boolean; backupData?: boolean }
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const { data: account } = await this.supabase
        .from('email_accounts')
        .select('id, lifecycle_state, legal_hold_applied, provider_account_id')
        .eq('id', accountId)
        .maybeSingle();

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      if (account.legal_hold_applied) {
        return { success: false, error: 'Cannot terminate account under legal hold' };
      }

      // Update to terminated state locally
      const { error } = await this.supabase
        .from('email_accounts')
        .update({
          lifecycle_state: 'terminated',
          status: 'disabled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      if (error) {
        return { success: false, error: 'Failed to terminate account' };
      }

      // Log event
      await this.logLifecycleEvent({
        emailAccountId: accountId,
        eventType: 'terminated',
        triggeredBy: adminUserId ? 'admin' : 'system',
        triggeredByUserId: adminUserId,
        previousState: account.lifecycle_state as AccountLifecycleState,
        newState: 'terminated',
        reason,
      });

      // Queue async job to delete from provider
      const job = await queueAccountDeletion({
        accountId,
        providerAccountId: account.provider_account_id || undefined,
        permanent: options?.permanent ?? false,
        backupData: options?.backupData ?? true,
        initiatedBy: adminUserId,
      });

      console.info(`[AccountLifecycle] Queued account deletion job: ${job.id}`);

      return { success: true, jobId: job.id };
    } catch (error) {
      console.error('[AccountLifecycle] Error terminating account:', error);
      return { success: false, error: 'Failed to terminate account' };
    }
  }

  // ============================================================================
  // LEGAL HOLD
  // ============================================================================

  /**
   * Apply legal hold to an account
   */
  async applyLegalHold(
    accountId: string,
    matterId: string,
    adminUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('email_accounts')
        .update({
          legal_hold_applied: true,
          compliance_flags: {
            legal_hold_matter_id: matterId,
            legal_hold_applied_at: new Date().toISOString(),
            legal_hold_applied_by: adminUserId,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      if (error) {
        return { success: false, error: 'Failed to apply legal hold' };
      }

      await this.logLifecycleEvent({
        emailAccountId: accountId,
        eventType: 'legal_hold_applied',
        triggeredBy: 'admin',
        triggeredByUserId: adminUserId,
        metadata: { matterId },
      });

      return { success: true };
    } catch (error) {
      console.error('[AccountLifecycle] Error applying legal hold:', error);
      return { success: false, error: 'Failed to apply legal hold' };
    }
  }

  /**
   * Release legal hold from an account
   */
  async releaseLegalHold(
    accountId: string,
    matterId: string,
    adminUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('email_accounts')
        .update({
          legal_hold_applied: false,
          compliance_flags: {
            legal_hold_released_at: new Date().toISOString(),
            legal_hold_released_by: adminUserId,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId);

      if (error) {
        return { success: false, error: 'Failed to release legal hold' };
      }

      await this.logLifecycleEvent({
        emailAccountId: accountId,
        eventType: 'legal_hold_released',
        triggeredBy: 'admin',
        triggeredByUserId: adminUserId,
        metadata: { matterId },
      });

      return { success: true };
    } catch (error) {
      console.error('[AccountLifecycle] Error releasing legal hold:', error);
      return { success: false, error: 'Failed to release legal hold' };
    }
  }

  // ============================================================================
  // LIFECYCLE EVENTS
  // ============================================================================

  /**
   * Get lifecycle history for an account
   */
  async getLifecycleHistory(
    accountId: string,
    limit: number = 50
  ): Promise<LifecycleEvent[]> {
    const { data } = await this.supabase
      .from('email_account_lifecycle_events')
      .select('*')
      .eq('email_account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map(this.mapDbToEvent);
  }

  /**
   * Log a lifecycle event
   */
  private async logLifecycleEvent(event: {
    emailAccountId: string;
    eventType: LifecycleEventType;
    triggeredBy: LifecycleTrigger;
    triggeredByUserId?: string;
    previousState?: AccountLifecycleState;
    newState?: AccountLifecycleState;
    reason?: string;
    adminNotes?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.supabase.from('email_account_lifecycle_events').insert({
      email_account_id: event.emailAccountId,
      event_type: event.eventType,
      triggered_by: event.triggeredBy,
      triggered_by_user_id: event.triggeredByUserId,
      previous_state: event.previousState,
      new_state: event.newState,
      reason: event.reason,
      admin_notes: event.adminNotes,
      metadata: event.metadata || {},
    });
  }

  // ============================================================================
  // JOB STATUS & QUOTA SYNC
  // ============================================================================

  /**
   * Get status of an account lifecycle job
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    attemptsMade?: number;
    failedReason?: string;
  }> {
    return getAccountJobStatus(jobId);
  }

  /**
   * Sync quota information from provider
   */
  async syncQuota(accountId: string): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const { data: account } = await this.supabase
        .from('email_accounts')
        .select('id, provider_account_id')
        .eq('id', accountId)
        .maybeSingle();

      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      const job = await queueQuotaSync({
        accountId,
        providerAccountId: account.provider_account_id || undefined,
      });

      return { success: true, jobId: job.id };
    } catch (error) {
      console.error('[AccountLifecycle] Error queuing quota sync:', error);
      return { success: false, error: 'Failed to queue quota sync' };
    }
  }

  // ============================================================================
  // INACTIVITY MONITORING
  // ============================================================================

  /**
   * Check for inactive accounts and take action
   */
  async processInactiveAccounts(
    inactivityDays: number = 90,
    warningDays: number = 7
  ): Promise<{ processed: number; warnings: number; suspended: number }> {
    let warnings = 0;
    let suspended = 0;

    // Find accounts inactive for warning period
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() - (inactivityDays - warningDays));

    const { data: warningAccounts } = await this.supabase
      .from('email_accounts')
      .select('id')
      .eq('lifecycle_state', 'active')
      .is('inactivity_warning_sent_at', null)
      .lt('last_activity_at', warningDate.toISOString());

    for (const account of warningAccounts || []) {
      await this.logLifecycleEvent({
        emailAccountId: account.id,
        eventType: 'inactivity_warning',
        triggeredBy: 'policy',
      });

      await this.supabase
        .from('email_accounts')
        .update({ inactivity_warning_sent_at: new Date().toISOString() })
        .eq('id', account.id);

      warnings++;
    }

    // Find accounts inactive beyond threshold
    const suspendDate = new Date();
    suspendDate.setDate(suspendDate.getDate() - inactivityDays);

    const { data: inactiveAccounts } = await this.supabase
      .from('email_accounts')
      .select('id')
      .eq('lifecycle_state', 'active')
      .not('inactivity_warning_sent_at', 'is', null)
      .lt('last_activity_at', suspendDate.toISOString());

    for (const account of inactiveAccounts || []) {
      await this.suspendAccount(
        {
          accountId: account.id,
          reason: `Auto-suspended due to ${inactivityDays} days of inactivity`,
        }
      );

      await this.supabase
        .from('email_accounts')
        .update({ lifecycle_state: 'inactive' })
        .eq('id', account.id);

      suspended++;
    }

    return {
      processed: (warningAccounts?.length || 0) + (inactiveAccounts?.length || 0),
      warnings,
      suspended,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async generateUniqueEmail(
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<string> {
    const formats = [
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
      `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      `${firstName.toLowerCase()}.${lastName.toLowerCase().charAt(0)}`,
      `${firstName.toLowerCase().charAt(0)}.${lastName.toLowerCase()}`,
      `${firstName.toLowerCase().charAt(0)}${lastName.toLowerCase()}`,
    ];

    for (const format of formats) {
      const email = `${format}@${domain}`;

      const { data } = await this.supabase
        .from('email_accounts')
        .select('id')
        .eq('email_address', email)
        .maybeSingle();

      if (!data) {
        return email;
      }
    }

    // Add number suffix
    let counter = 1;
    while (counter < 100) {
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${counter}@${domain}`;

      const { data } = await this.supabase
        .from('email_accounts')
        .select('id')
        .eq('email_address', email)
        .maybeSingle();

      if (!data) {
        return email;
      }

      counter++;
    }

    throw new Error('Unable to generate unique email address');
  }

  private mapDbToEvent(data: Record<string, unknown>): LifecycleEvent {
    return {
      id: data.id as string,
      emailAccountId: data.email_account_id as string,
      eventType: data.event_type as LifecycleEventType,
      triggeredBy: data.triggered_by as LifecycleTrigger,
      triggeredByUserId: data.triggered_by_user_id as string | undefined,
      previousState: data.previous_state as AccountLifecycleState | undefined,
      newState: data.new_state as AccountLifecycleState | undefined,
      reason: data.reason as string | undefined,
      adminNotes: data.admin_notes as string | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(data.created_at as string),
    };
  }
}

// Singleton
let lifecycleServiceInstance: AccountLifecycleService | null = null;

export function getAccountLifecycleService(): AccountLifecycleService {
  if (!lifecycleServiceInstance) {
    lifecycleServiceInstance = new AccountLifecycleService();
  }
  return lifecycleServiceInstance;
}

export default AccountLifecycleService;
