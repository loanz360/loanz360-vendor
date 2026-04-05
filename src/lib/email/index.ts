/**
 * Email System Library
 * Enterprise-grade email functionality for Loanz360
 *
 * This module provides comprehensive email management capabilities:
 * - Multi-provider integration (Zoho, Google, Microsoft, SendGrid, etc.)
 * - Account lifecycle management
 * - Approval workflows
 * - Hierarchical quota system
 * - Monitoring and metrics
 * - Aliases, shared mailboxes, distribution lists
 * - Compliance features (legal hold, retention policies)
 */

// Clients
export { ZohoMailClient, createZohoClient } from './zoho-client';
export { IMAPClient, createIMAPClient, createZohoIMAPConfig, createIMAPConfigForProvider } from './imap-client';
export { SMTPClient, createSMTPClient, createZohoSMTPConfig, createSMTPConfigForProvider, sendZohoEmail } from './smtp-client';

// Utilities
export {
  parseName,
  generateLocalPart,
  generateUniqueEmail,
  generateEmailFromFullName,
  isValidEmail,
  isCompanyEmail,
  extractNameFromEmail,
  generateEmailSuggestions,
  batchGenerateEmails,
  type EmailFormat,
  type GeneratedEmail,
} from './email-generator';

export {
  replaceVariables,
  buildSignatureVariables,
  renderSignatureHtml,
  renderSignatureText,
  generateDefaultSignatureHtml,
  generateDefaultSignatureText,
  generateProfessionalSignatureHtml,
  generateMinimalSignatureHtml,
  wrapSignatureHtml,
  insertSignature,
  removeSignature,
  previewSignature,
  extractTemplateVariables,
  validateSignatureTemplate,
} from './signature-renderer';

export {
  formatEmailAddress,
  formatEmailAddresses,
  parseEmailAddress,
  parseEmailAddresses,
  isValidEmailAddress,
  getEmailInitials,
  getDisplayName,
  formatFileSize,
  formatEmailDate,
  formatRelativeTime,
  truncateText,
  generateSnippet,
  getFolderIcon,
  getFolderDisplayName,
  getFolderColor,
  getDefaultFolderStats,
  sortEmailsByDate,
  groupEmailsByDate,
  filterEmails,
  extractAllRecipients,
  isInternalEmail,
  getAttachmentIcon,
  sanitizeEmailHtml,
  linkifyText,
  quoteEmailForReply,
  generateForwardHeader,
} from './email-utils';

// Re-export types
export type {
  // Provider & Account
  EmailProvider,
  EmailAccountStatus,
  EmailProviderConfig,
  EmailAccount,
  EmailAccountWithUser,
  CreateEmailAccountRequest,
  UpdateEmailAccountRequest,
  BulkCreateEmailAccountsRequest,

  // Messages
  EmailMessage,
  EmailThread,
  EmailAddress,
  EmailAttachment,
  EmailFolder,

  // Compose & Draft
  ComposeEmailRequest,
  SendEmailResponse,
  EmailDraft,
  DraftAttachment,
  SaveDraftRequest,

  // Signature
  EmailSignature,
  EmailSocialLinks,
  SignatureVariables,
  CreateEmailSignatureRequest,
  UpdateEmailSignatureRequest,

  // Activity & Quota
  EmailActivityLog,
  EmailQuotaUsage,
  EmailUsageStats,
  QuotaCheckResult,
  EmailAction,

  // Templates & Contacts
  EmailQuickTemplate,
  CreateQuickTemplateRequest,
  EmailContact,
  CreateContactRequest,
  ContactType,

  // Labels
  EmailLabel,
  CreateLabelRequest,

  // Scheduled
  ScheduledEmail,
  ScheduledEmailStatus,

  // Settings
  EmailAdminSetting,
  EmailAdminSettings,
  UpdateEmailSettingsRequest,
  EmailSettingType,
  EmailSettingCategory,

  // Stats & Search
  EmailFolderStats,
  EmailSearchParams,
  EmailSearchResult,
  EmailAdminDashboardStats,
  EmailActivityChartData,

  // API
  EmailApiResponse,
  EmailPaginatedResponse,

  // Config
  IMAPConfig,
  SMTPConfig,
  IMAPMailbox,

  // Client State
  ComposeFormState,
  EmailClientState,
} from '@/types/email';

// Enterprise Features
// Provider Management
export { getEmailProviderService } from './providers';
export type { IEmailProviderAdapter, ProviderCredentials, SendEmailRequest, SendEmailResponse } from './providers/types';

// Account Lifecycle
export {
  getAccountLifecycleService,
  startAccountLifecycleWorker,
  stopAccountLifecycleWorker,
  setupAccountQueueEvents,
  getAccountQueueStats,
} from './lifecycle';
export type {
  AccountLifecycleState,
  LifecycleEventType,
  CreateAccountParams,
  SuspendAccountParams,
  OffboardAccountParams,
  LifecycleEvent,
  AccountJobType,
} from './lifecycle';

// Approval Workflows
export { getApprovalWorkflowService } from './workflows';
export type { WorkflowType, ApprovalStatus, ApprovalRequest, WorkflowDefinition } from './workflows';

// Quota Management
export { getQuotaService } from './quota';
export type { QuotaPolicy, QuotaUsage, EffectiveQuota } from './quota';

// Monitoring
export { getMonitoringService } from './monitoring';
export type { ProviderHealthMetrics, EmailDeliveryMetrics, SystemOverview, MonitoringAlert } from './monitoring';

// Aliases & Shared Mailboxes
export { getAliasService } from './aliases';
export type { EmailAlias, SharedMailbox, DistributionList, EmailDelegation } from './aliases';

// Compliance
export { getComplianceService } from './compliance';
export type { LegalHold, RetentionPolicy, AuditLogEntry } from './compliance';

// Amazon SES Integration
export {
  getSESService,
  createSESService,
  initializeSESService,
  SESEmailService,
} from './ses-service';
export type {
  SESServiceConfig,
  SendSESEmailParams,
  SendSESTemplatedEmailParams,
  SendSESBulkEmailParams,
  SESEmailResult,
  SESBulkEmailResult,
} from './ses-service';

// SES Provider Adapter
export {
  SESAdapter,
  getSESAdapter,
  createSESAdapter,
} from './providers';
export type {
  SESConfiguration,
  SESTemplate,
  SESBulkEmailEntry,
  SESSuppressedEmail,
  SESAccountStatus,
  SESNotification,
} from './providers';
