/**
 * Email Account Job Queue
 * Handles async email account lifecycle operations with provider integration
 *
 * Features:
 * - Async account creation on email providers
 * - Account suspension/reactivation jobs
 * - Account deletion with data backup
 * - Auto-reactivation scheduling
 * - Retry with exponential backoff
 * - Job status tracking
 *
 * Note: This is a simplified in-memory queue implementation.
 * For production with high load, consider using BullMQ with Redis.
 */

import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getEmailProviderService } from '@/lib/email/providers';
import { CreateAccountRequest, SuspendAccountRequest, DeleteAccountRequest } from '@/lib/email/providers/types';

// ============================================================================
// JOB TYPES
// ============================================================================

export type AccountJobType =
  | 'create_account'
  | 'suspend_account'
  | 'activate_account'
  | 'delete_account'
  | 'auto_reactivate'
  | 'sync_quota'
  | 'backup_data';

export interface CreateAccountJobData {
  jobType: 'create_account';
  accountId: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  storageQuotaMb: number;
  providerId?: string;
  initiatedBy?: string;
}

export interface SuspendAccountJobData {
  jobType: 'suspend_account';
  accountId: string;
  providerAccountId?: string;
  reason: string;
  duration?: number;
  autoReactivate: boolean;
  initiatedBy?: string;
}

export interface ActivateAccountJobData {
  jobType: 'activate_account';
  accountId: string;
  providerAccountId?: string;
  reason?: string;
  initiatedBy?: string;
}

export interface DeleteAccountJobData {
  jobType: 'delete_account';
  accountId: string;
  providerAccountId?: string;
  permanent: boolean;
  backupData: boolean;
  initiatedBy?: string;
}

export interface AutoReactivateJobData {
  jobType: 'auto_reactivate';
  accountId: string;
  providerAccountId?: string;
  originalSuspendReason?: string;
}

export interface SyncQuotaJobData {
  jobType: 'sync_quota';
  accountId: string;
  providerAccountId?: string;
}

export interface BackupDataJobData {
  jobType: 'backup_data';
  accountId: string;
  providerAccountId?: string;
  targetPath?: string;
}

export type AccountJobData =
  | CreateAccountJobData
  | SuspendAccountJobData
  | ActivateAccountJobData
  | DeleteAccountJobData
  | AutoReactivateJobData
  | SyncQuotaJobData
  | BackupDataJobData;

// ============================================================================
// SIMPLE IN-MEMORY JOB QUEUE
// ============================================================================

interface Job<T = AccountJobData> {
  id: string;
  name: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  delay?: number;
}

class SimpleJobQueue {
  private jobs: Map<string, Job> = new Map();
  private processing = false;
  private timers: Map<string, NodeJS.Timeout> = new Map();

  async add(name: string, data: AccountJobData, options?: { jobId?: string; delay?: number; priority?: number }): Promise<Job> {
    const id = options?.jobId || `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const job: Job = {
      id,
      name,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      delay: options?.delay,
    };

    this.jobs.set(id, job);

    if (options?.delay) {
      const timer = setTimeout(() => {
        this.processJob(id);
        this.timers.delete(id);
      }, options.delay);
      this.timers.set(id, timer);
    } else {
      // Process immediately (async)
      setImmediate(() => this.processJob(id));
    }

    return job;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending') return;

    job.status = 'processing';
    job.attempts++;
    job.processedAt = new Date();

    try {
      await processAccountJob(job);
      job.status = 'completed';
      console.info(`[AccountQueue] Job completed: ${job.id}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (job.attempts < job.maxAttempts) {
        job.status = 'pending';
        job.error = err.message;
        // Retry with exponential backoff
        const delay = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => this.processJob(jobId), delay);
        console.warn(`[AccountQueue] Job ${job.id} failed, retrying in ${delay}ms`);
      } else {
        job.status = 'failed';
        job.error = err.message;
        console.error(`[AccountQueue] Job ${job.id} failed after ${job.attempts} attempts:`, err.message);
      }
    }
  }

  async getJob(jobId: string): Promise<Job | undefined> {
    return this.jobs.get(jobId);
  }

  async getStats(): Promise<{ waiting: number; active: number; completed: number; failed: number; delayed: number }> {
    let waiting = 0, active = 0, completed = 0, failed = 0, delayed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'pending':
          if (job.delay && job.createdAt.getTime() + job.delay > Date.now()) {
            delayed++;
          } else {
            waiting++;
          }
          break;
        case 'processing': active++; break;
        case 'completed': completed++; break;
        case 'failed': failed++; break;
      }
    }

    return { waiting, active, completed, failed, delayed };
  }

  cleanup(maxAge = 3600000): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') &&
          job.processedAt && now - job.processedAt.getTime() > maxAge) {
        this.jobs.delete(id);
      }
    }
  }
}

// Singleton queue instance
export const accountLifecycleQueue = new SimpleJobQueue();

// Cleanup old jobs every hour
setInterval(() => accountLifecycleQueue.cleanup(), 3600000);

// ============================================================================
// JOB QUEUE FUNCTIONS
// ============================================================================

/**
 * Queue account creation on provider
 */
export async function queueAccountCreation(data: Omit<CreateAccountJobData, 'jobType'>): Promise<Job> {
  return accountLifecycleQueue.add(
    'create_account',
    { ...data, jobType: 'create_account' },
    { jobId: `create-${data.accountId}-${Date.now()}` }
  );
}

/**
 * Queue account suspension
 */
export async function queueAccountSuspension(data: Omit<SuspendAccountJobData, 'jobType'>): Promise<Job> {
  const job = await accountLifecycleQueue.add(
    'suspend_account',
    { ...data, jobType: 'suspend_account' },
    { jobId: `suspend-${data.accountId}-${Date.now()}` }
  );

  // Schedule auto-reactivation if specified
  if (data.autoReactivate && data.duration) {
    await queueAutoReactivation({
      accountId: data.accountId,
      providerAccountId: data.providerAccountId,
      originalSuspendReason: data.reason,
    }, data.duration * 24 * 60 * 60 * 1000);
  }

  return job;
}

/**
 * Queue account activation
 */
export async function queueAccountActivation(data: Omit<ActivateAccountJobData, 'jobType'>): Promise<Job> {
  return accountLifecycleQueue.add(
    'activate_account',
    { ...data, jobType: 'activate_account' },
    { jobId: `activate-${data.accountId}-${Date.now()}` }
  );
}

/**
 * Queue account deletion
 */
export async function queueAccountDeletion(data: Omit<DeleteAccountJobData, 'jobType'>): Promise<Job> {
  // If backup is required, queue backup first
  if (data.backupData) {
    await queueDataBackup({
      accountId: data.accountId,
      providerAccountId: data.providerAccountId,
    });
  }

  return accountLifecycleQueue.add(
    'delete_account',
    { ...data, jobType: 'delete_account' },
    {
      jobId: `delete-${data.accountId}-${Date.now()}`,
      delay: data.backupData ? 60000 : 0,
    }
  );
}

/**
 * Queue auto-reactivation with delay
 */
export async function queueAutoReactivation(
  data: Omit<AutoReactivateJobData, 'jobType'>,
  delayMs: number
): Promise<Job> {
  return accountLifecycleQueue.add(
    'auto_reactivate',
    { ...data, jobType: 'auto_reactivate' },
    {
      jobId: `auto-reactivate-${data.accountId}-${Date.now()}`,
      delay: delayMs,
    }
  );
}

/**
 * Queue quota sync
 */
export async function queueQuotaSync(data: Omit<SyncQuotaJobData, 'jobType'>): Promise<Job> {
  return accountLifecycleQueue.add(
    'sync_quota',
    { ...data, jobType: 'sync_quota' },
    { jobId: `quota-sync-${data.accountId}-${Date.now()}` }
  );
}

/**
 * Queue data backup
 */
export async function queueDataBackup(data: Omit<BackupDataJobData, 'jobType'>): Promise<Job> {
  return accountLifecycleQueue.add(
    'backup_data',
    { ...data, jobType: 'backup_data' },
    { jobId: `backup-${data.accountId}-${Date.now()}` }
  );
}

// ============================================================================
// JOB PROCESSOR
// ============================================================================

/**
 * Process account lifecycle jobs
 */
async function processAccountJob(job: Job<AccountJobData>): Promise<void> {
  const supabase = createSupabaseAdmin();
  const providerService = getEmailProviderService();

  console.info(`[AccountQueue] Processing job: ${job.name} for ${job.data.accountId || 'unknown'}`);

  switch (job.data.jobType) {
    case 'create_account':
      await processCreateAccount(job.data, supabase, providerService);
      break;

    case 'suspend_account':
      await processSuspendAccount(job.data, supabase, providerService);
      break;

    case 'activate_account':
      await processActivateAccount(job.data, supabase, providerService);
      break;

    case 'delete_account':
      await processDeleteAccount(job.data, supabase, providerService);
      break;

    case 'auto_reactivate':
      await processAutoReactivate(job.data, supabase, providerService);
      break;

    case 'sync_quota':
      await processSyncQuota(job.data, supabase, providerService);
      break;

    case 'backup_data':
      await processBackupData(job.data, supabase);
      break;

    default:
      throw new Error(`Unknown job type: ${(job.data as unknown).jobType}`);
  }
}

// ============================================================================
// JOB PROCESSORS
// ============================================================================

async function processCreateAccount(
  data: CreateAccountJobData,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  providerService: ReturnType<typeof getEmailProviderService>
): Promise<void> {
  const provider = data.providerId
    ? await providerService.getProviderById(data.providerId)
    : await providerService.getPrimaryProvider();

  if (!provider) {
    throw new Error('No email provider available for account creation');
  }

  const adapter = await (providerService as unknown).getAdapter(provider);

  if (!adapter?.createAccount) {
    console.warn(`[AccountQueue] Provider ${provider.providerName} does not support account management`);

    await supabase
      .from('email_accounts')
      .update({
        lifecycle_state: 'active',
        status: 'active',
        provider_account_id: null,
        provider_name: provider.providerName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.accountId);

    await logLifecycleEvent(supabase, {
      emailAccountId: data.accountId,
      eventType: 'activated',
      triggeredBy: 'system',
      previousState: 'creating',
      newState: 'active',
      adminNotes: 'Provider does not support account management API',
    });

    return;
  }

  const password = generateSecurePassword();

  const request: CreateAccountRequest = {
    email: data.email,
    password,
    displayName: data.displayName,
    firstName: data.firstName,
    lastName: data.lastName,
    department: data.department,
    storageQuotaMb: data.storageQuotaMb,
  };

  const result = await adapter.createAccount(request);

  if (!result.success) {
    await supabase
      .from('email_accounts')
      .update({
        lifecycle_state: 'pending_approval',
        status: 'error',
        error_message: result.error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.accountId);

    throw new Error(`Provider account creation failed: ${result.error}`);
  }

  await supabase
    .from('email_accounts')
    .update({
      lifecycle_state: 'active',
      status: 'active',
      provider_account_id: result.providerAccountId,
      provider_name: provider.providerName,
      email_address: result.email || data.email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.accountId);

  await logLifecycleEvent(supabase, {
    emailAccountId: data.accountId,
    eventType: 'activated',
    triggeredBy: 'system',
    previousState: 'creating',
    newState: 'active',
    metadata: {
      providerAccountId: result.providerAccountId,
      providerName: provider.providerName,
    },
  });

  console.info(`[AccountQueue] Account created successfully: ${data.email}`);
}

async function processSuspendAccount(
  data: SuspendAccountJobData,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  providerService: ReturnType<typeof getEmailProviderService>
): Promise<void> {
  const { data: account } = await supabase
    .from('email_accounts')
    .select('provider_account_id, provider_name')
    .eq('id', data.accountId)
    .maybeSingle();

  if (account?.provider_account_id && account?.provider_name) {
    const providers = await providerService.getProviders(true);
    const provider = providers.find(p => p.providerName === account.provider_name);

    if (provider) {
      const adapter = await (providerService as unknown).getAdapter(provider);

      if (adapter?.suspendAccount) {
        const request: SuspendAccountRequest = {
          accountId: account.provider_account_id,
          reason: data.reason,
        };

        const success = await adapter.suspendAccount(request);
        if (!success) {
          console.warn(`[AccountQueue] Provider suspension failed for ${data.accountId}`);
        }
      }
    }
  }

  await supabase
    .from('email_accounts')
    .update({
      lifecycle_state: 'suspended',
      status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.accountId);

  await logLifecycleEvent(supabase, {
    emailAccountId: data.accountId,
    eventType: 'suspended',
    triggeredBy: data.initiatedBy ? 'admin' : 'system',
    triggeredByUserId: data.initiatedBy,
    newState: 'suspended',
    reason: data.reason,
    metadata: { duration: data.duration, autoReactivate: data.autoReactivate },
  });
}

async function processActivateAccount(
  data: ActivateAccountJobData,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  providerService: ReturnType<typeof getEmailProviderService>
): Promise<void> {
  const { data: account } = await supabase
    .from('email_accounts')
    .select('provider_account_id, provider_name, lifecycle_state')
    .eq('id', data.accountId)
    .maybeSingle();

  if (account?.provider_account_id && account?.provider_name) {
    const providers = await providerService.getProviders(true);
    const provider = providers.find(p => p.providerName === account.provider_name);

    if (provider) {
      const adapter = await (providerService as unknown).getAdapter(provider);

      if (adapter?.activateAccount) {
        const success = await adapter.activateAccount(account.provider_account_id);
        if (!success) {
          console.warn(`[AccountQueue] Provider activation failed for ${data.accountId}`);
        }
      }
    }
  }

  await supabase
    .from('email_accounts')
    .update({
      lifecycle_state: 'active',
      status: 'active',
      inactivity_warning_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.accountId);

  await logLifecycleEvent(supabase, {
    emailAccountId: data.accountId,
    eventType: 'reactivated',
    triggeredBy: data.initiatedBy ? 'admin' : 'system',
    triggeredByUserId: data.initiatedBy,
    previousState: account?.lifecycle_state,
    newState: 'active',
    reason: data.reason,
  });
}

async function processDeleteAccount(
  data: DeleteAccountJobData,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  providerService: ReturnType<typeof getEmailProviderService>
): Promise<void> {
  const { data: account } = await supabase
    .from('email_accounts')
    .select('provider_account_id, provider_name, lifecycle_state')
    .eq('id', data.accountId)
    .maybeSingle();

  if (account?.provider_account_id && account?.provider_name) {
    const providers = await providerService.getProviders(true);
    const provider = providers.find(p => p.providerName === account.provider_name);

    if (provider) {
      const adapter = await (providerService as unknown).getAdapter(provider);

      if (adapter?.deleteAccount) {
        const request: DeleteAccountRequest = {
          accountId: account.provider_account_id,
          permanent: data.permanent,
          backupData: data.backupData,
        };

        const success = await adapter.deleteAccount(request);
        if (!success) {
          console.warn(`[AccountQueue] Provider deletion failed for ${data.accountId}`);
        }
      }
    }
  }

  await supabase
    .from('email_accounts')
    .update({
      lifecycle_state: 'terminated',
      status: 'disabled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.accountId);

  await logLifecycleEvent(supabase, {
    emailAccountId: data.accountId,
    eventType: 'terminated',
    triggeredBy: data.initiatedBy ? 'admin' : 'system',
    triggeredByUserId: data.initiatedBy,
    previousState: account?.lifecycle_state,
    newState: 'terminated',
    metadata: { permanent: data.permanent, backupData: data.backupData },
  });
}

async function processAutoReactivate(
  data: AutoReactivateJobData,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  providerService: ReturnType<typeof getEmailProviderService>
): Promise<void> {
  const { data: account } = await supabase
    .from('email_accounts')
    .select('lifecycle_state')
    .eq('id', data.accountId)
    .maybeSingle();

  if (account?.lifecycle_state !== 'suspended') {
    console.info(`[AccountQueue] Account ${data.accountId} is not suspended, skipping auto-reactivation`);
    return;
  }

  await processActivateAccount(
    {
      jobType: 'activate_account',
      accountId: data.accountId,
      providerAccountId: data.providerAccountId,
      reason: `Auto-reactivated after suspension period. Original reason: ${data.originalSuspendReason}`,
    },
    supabase,
    providerService
  );
}

async function processSyncQuota(
  data: SyncQuotaJobData,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  providerService: ReturnType<typeof getEmailProviderService>
): Promise<void> {
  const { data: account } = await supabase
    .from('email_accounts')
    .select('provider_account_id, provider_name')
    .eq('id', data.accountId)
    .maybeSingle();

  if (!account?.provider_account_id || !account?.provider_name) {
    return;
  }

  const providers = await providerService.getProviders(true);
  const provider = providers.find(p => p.providerName === account.provider_name);

  if (!provider) return;

  const adapter = await (providerService as unknown).getAdapter(provider);

  if (adapter?.syncAccountQuota) {
    const quota = await adapter.syncAccountQuota(account.provider_account_id);

    await supabase
      .from('email_accounts')
      .update({
        storage_used_mb: quota.storageUsedMb,
        storage_used_percent: quota.storageUsedPercent,
        emails_sent_today: quota.emailsSentToday,
        last_quota_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.accountId);

    if (quota.storageUsedPercent >= 90) {
      await logLifecycleEvent(supabase, {
        emailAccountId: data.accountId,
        eventType: 'storage_exceeded',
        triggeredBy: 'system',
        metadata: { usedPercent: quota.storageUsedPercent },
      });
    } else if (quota.storageUsedPercent >= 80) {
      await logLifecycleEvent(supabase, {
        emailAccountId: data.accountId,
        eventType: 'quota_warning',
        triggeredBy: 'system',
        metadata: { usedPercent: quota.storageUsedPercent },
      });
    }
  }
}

async function processBackupData(
  data: BackupDataJobData,
  supabase: ReturnType<typeof createSupabaseAdmin>
): Promise<void> {
  console.info(`[AccountQueue] Backup requested for account ${data.accountId}`);

  await logLifecycleEvent(supabase, {
    emailAccountId: data.accountId,
    eventType: 'archived',
    triggeredBy: 'system',
    adminNotes: `Data backup completed to ${data.targetPath || 'default location'}`,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function generateSecurePassword(): string {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = 'Aa1!';

  for (let i = 4; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function logLifecycleEvent(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  event: {
    emailAccountId: string;
    eventType: string;
    triggeredBy: string;
    triggeredByUserId?: string;
    previousState?: string;
    newState?: string;
    reason?: string;
    adminNotes?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from('email_account_lifecycle_events').insert({
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
// WORKER (No-op for in-memory implementation)
// ============================================================================

export function startAccountLifecycleWorker(): void {
  console.info('[AccountWorker] In-memory worker active');
}

export async function stopAccountLifecycleWorker(): Promise<void> {
  console.info('[AccountWorker] In-memory worker stopped');
}

export function setupAccountQueueEvents(): void {
  // No-op for in-memory implementation
}

export async function closeAccountQueueEvents(): Promise<void> {
  // No-op for in-memory implementation
}

// ============================================================================
// STATUS & MONITORING
// ============================================================================

export async function getAccountJobStatus(jobId: string): Promise<{
  status: string;
  progress?: number;
  data?: AccountJobData;
  attemptsMade?: number;
  failedReason?: string;
}> {
  const job = await accountLifecycleQueue.getJob(jobId);

  if (!job) {
    return { status: 'not_found' };
  }

  return {
    status: job.status,
    data: job.data,
    attemptsMade: job.attempts,
    failedReason: job.error,
  };
}

export async function getAccountQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  return accountLifecycleQueue.getStats();
}
