/**
 * Email Account Lifecycle Module
 * Enterprise-grade account lifecycle management with provider integration
 */

// Main Service
export {
  AccountLifecycleService,
  getAccountLifecycleService,
} from './account-lifecycle-service';

// Types
export type {
  AccountLifecycleState,
  LifecycleEventType,
  LifecycleTrigger,
  LifecycleEvent,
  CreateAccountParams,
  OffboardAccountParams,
  SuspendAccountParams,
} from './account-lifecycle-service';

// Job Queue
export {
  accountLifecycleQueue,
  queueAccountCreation,
  queueAccountSuspension,
  queueAccountActivation,
  queueAccountDeletion,
  queueAutoReactivation,
  queueQuotaSync,
  queueDataBackup,
  getAccountJobStatus,
  getAccountQueueStats,
  startAccountLifecycleWorker,
  stopAccountLifecycleWorker,
  setupAccountQueueEvents,
  closeAccountQueueEvents,
} from './email-account-queue';

// Job Types
export type {
  AccountJobType,
  AccountJobData,
  CreateAccountJobData,
  SuspendAccountJobData,
  ActivateAccountJobData,
  DeleteAccountJobData,
  AutoReactivateJobData,
  SyncQuotaJobData,
  BackupDataJobData,
} from './email-account-queue';
