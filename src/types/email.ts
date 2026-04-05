// ============================================================================
// Email System Types
// Enterprise-grade Internal Email System for Loanz360
// ============================================================================

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type EmailProvider = 'zoho' | 'google' | 'microsoft' | 'hostinger';

export type EmailAccountStatus = 'active' | 'suspended' | 'disabled' | 'pending' | 'creating';

export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'starred' | 'archive' | 'all';

export type EmailAction =
  | 'sent'
  | 'received'
  | 'read'
  | 'unread'
  | 'deleted'
  | 'restored'
  | 'attachment_download'
  | 'attachment_upload'
  | 'forwarded'
  | 'replied'
  | 'starred'
  | 'unstarred'
  | 'archived'
  | 'spam_marked'
  | 'spam_unmarked'
  | 'draft_saved'
  | 'draft_deleted'
  | 'account_created'
  | 'account_suspended'
  | 'account_activated'
  | 'password_reset'
  | 'settings_changed'
  | 'login'
  | 'logout';

export type EmailSyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export type ContactType = 'manual' | 'auto' | 'internal' | 'external';

export type ScheduledEmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export type EmailSettingType = 'string' | 'number' | 'boolean' | 'json' | 'array';

export type EmailSettingCategory = 'general' | 'account' | 'limits' | 'security' | 'policy' | 'signature' | 'compliance' | 'features' | 'appearance';

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export interface EmailProviderConfig {
  id: string;
  provider: EmailProvider;
  domain: string;

  // API Settings (sensitive fields may be hidden in responses)
  api_client_id: string | null;
  api_client_secret_encrypted?: string;
  api_refresh_token_encrypted?: string;
  api_access_token_encrypted?: string;
  api_token_expires_at: string | null;

  // IMAP Settings
  imap_host: string;
  imap_port: number;
  imap_use_ssl: boolean;

  // SMTP Settings
  smtp_host: string;
  smtp_port: number;
  smtp_use_ssl: boolean;

  // Limits
  daily_send_limit_per_user: number;
  max_attachment_size_mb: number;
  max_recipients_per_email: number;
  max_total_attachments_mb: number;

  // Status
  is_active: boolean;
  setup_completed: boolean;
  last_verified_at: string | null;
  verification_status: 'pending' | 'verified' | 'failed';

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface EmailProviderConfigInput {
  provider: EmailProvider;
  domain: string;
  api_client_id?: string;
  api_client_secret?: string;
  imap_host?: string;
  imap_port?: number;
  imap_use_ssl?: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_use_ssl?: boolean;
  daily_send_limit_per_user?: number;
  max_attachment_size_mb?: number;
  max_recipients_per_email?: number;
}

// ============================================================================
// EMAIL ACCOUNT
// ============================================================================

export interface EmailAccount {
  id: string;
  user_id: string;
  employee_profile_id: string | null;

  // Email Address
  email_address: string;
  email_local_part: string;
  display_name: string | null;

  // Provider Account Info
  zoho_account_id: string | null;
  zoho_zuid: string | null;
  provider_user_id: string | null;

  // Quota & Usage
  storage_quota_mb: number;
  storage_used_mb: number;
  daily_send_limit: number;
  emails_sent_today: number;
  last_send_reset_at: string;

  // Status
  status: EmailAccountStatus;
  is_verified: boolean;
  verified_at: string | null;
  suspension_reason: string | null;
  suspended_at: string | null;
  suspended_by: string | null;

  // Sync Info
  last_sync_at: string | null;
  sync_status: EmailSyncStatus;
  sync_error: string | null;

  // Auto Reply Settings
  auto_reply_enabled: boolean;
  auto_reply_message: string | null;
  auto_reply_start_date: string | null;
  auto_reply_end_date: string | null;

  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface EmailAccountWithUser extends EmailAccount {
  personal_email: string;
  full_name: string;
  avatar_url: string | null;
  employee_role: string;
  employee_subrole: string | null;
  department: string | null;
  designation: string | null;
  emp_code: string | null;
}

export interface CreateEmailAccountRequest {
  user_id: string;
  employee_profile_id?: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  storage_quota_mb?: number;
  daily_send_limit?: number;
}

export interface BulkCreateEmailAccountsRequest {
  employee_ids: string[];
  storage_quota_mb?: number;
  daily_send_limit?: number;
}

export interface UpdateEmailAccountRequest {
  display_name?: string;
  storage_quota_mb?: number;
  daily_send_limit?: number;
  status?: EmailAccountStatus;
  suspension_reason?: string;
  auto_reply_enabled?: boolean;
  auto_reply_message?: string;
  auto_reply_start_date?: string;
  auto_reply_end_date?: string;
}

// ============================================================================
// EMAIL SIGNATURE
// ============================================================================

export interface EmailSignature {
  id: string;
  name: string;
  description: string | null;

  // Content (supports template variables)
  signature_html: string;
  signature_text: string;

  // Settings
  is_default: boolean;
  is_mandatory: boolean;
  applies_to_roles: string[];
  applies_to_departments: string[];

  // Branding
  include_logo: boolean;
  logo_url: string | null;
  logo_width: number;
  social_links: EmailSocialLinks;
  primary_color: string;
  secondary_color: string;

  is_active: boolean;
  sort_order: number;

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface EmailSocialLinks {
  linkedin?: string;
  twitter?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
}

export interface CreateEmailSignatureRequest {
  name: string;
  description?: string;
  signature_html: string;
  signature_text: string;
  is_default?: boolean;
  is_mandatory?: boolean;
  applies_to_roles?: string[];
  applies_to_departments?: string[];
  include_logo?: boolean;
  logo_url?: string;
  logo_width?: number;
  social_links?: EmailSocialLinks;
  primary_color?: string;
  secondary_color?: string;
}

export interface UpdateEmailSignatureRequest extends Partial<CreateEmailSignatureRequest> {
  is_active?: boolean;
  sort_order?: number;
}

// Signature template variables
export interface SignatureVariables {
  full_name: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  phone: string;
  mobile: string;
  email: string;
  company: string;
  employee_id: string;
  address?: string;
}

// ============================================================================
// EMAIL MESSAGE
// ============================================================================

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  content_id?: string; // For inline images (cid:xxx)
  is_inline: boolean;
  download_url?: string;
  s3_key?: string;
}

export interface EmailMessage {
  id: string;
  message_id: string;
  thread_id?: string;
  conversation_id?: string;
  folder: EmailFolder;

  // Addresses
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  reply_to?: EmailAddress;

  // Content
  subject: string;
  body_html: string;
  body_text: string;
  snippet: string; // Preview text (first ~100 chars)

  // Attachments
  attachments: EmailAttachment[];
  has_attachments: boolean;
  total_attachment_size: number;

  // Flags
  is_read: boolean;
  is_starred: boolean;
  is_important: boolean;
  is_draft: boolean;
  is_sent: boolean;

  // Labels
  labels: string[];

  // Dates
  received_at: string;
  sent_at?: string;
  internal_date: string;

  // Metadata
  headers?: Record<string, string>;
  raw_size?: number;
}

export interface EmailThread {
  id: string;
  thread_id: string;
  subject: string;
  snippet: string;
  participant_count: number;
  participants: EmailAddress[];
  message_count: number;
  messages: EmailMessage[];
  has_attachments: boolean;
  is_read: boolean;
  is_starred: boolean;
  latest_message_at: string;
  first_message_at: string;
}

// ============================================================================
// COMPOSE EMAIL
// ============================================================================

export interface ComposeEmailRequest {
  to: (string | EmailAddress)[];
  cc?: (string | EmailAddress)[];
  bcc?: (string | EmailAddress)[];
  subject: string;
  body_html: string;
  body_text?: string;
  attachments?: (string | { id: string; filename: string; size: number; content_type: string })[]; // Attachment IDs or objects
  reply_to_message_id?: string;
  forward_from_message_id?: string;
  thread_id?: string;
  include_signature?: boolean;
  scheduled_at?: string;
  schedule_send_at?: string;
  save_draft?: boolean;
  save_as_draft?: boolean;
}

export interface SendEmailResponse {
  success: boolean;
  message_id?: string;
  thread_id?: string;
  error?: string;
  quota_remaining?: number;
}

// ============================================================================
// EMAIL DRAFT
// ============================================================================

export interface EmailDraft {
  id: string;
  email_account_id: string;

  // Content
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];

  // Reference
  reply_to_message_id: string | null;
  forward_from_message_id: string | null;
  is_reply: boolean;
  is_forward: boolean;

  // Attachments
  attachments: DraftAttachment[];

  // Sync
  synced_to_provider: boolean;
  provider_draft_id: string | null;
  last_synced_at: string | null;
  auto_saved: boolean;

  created_at: string;
  updated_at: string;
}

export interface DraftAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  s3_key: string;
  uploaded_at: string;
}

export interface SaveDraftRequest {
  subject?: string;
  body_html?: string;
  body_text?: string;
  to_addresses?: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  reply_to_message_id?: string;
  forward_from_message_id?: string;
  attachments?: string[];
}

// ============================================================================
// EMAIL ACTIVITY & AUDIT
// ============================================================================

export interface EmailActivityLog {
  id: string;
  email_account_id: string | null;
  user_id: string | null;

  action: EmailAction;

  // Email Details
  message_id: string | null;
  thread_id: string | null;
  subject: string | null;
  from_address: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  has_attachments: boolean;
  attachment_count: number;
  total_attachment_size_bytes: number;

  folder: EmailFolder | null;

  // Client Info
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  geo_location: GeoLocation | null;

  details: Record<string, unknown>;

  created_at: string;
}

export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// QUOTA & USAGE
// ============================================================================

export interface EmailQuotaUsage {
  id: string;
  email_account_id: string;
  date: string;
  emails_sent: number;
  emails_received: number;
  emails_read: number;
  emails_deleted: number;
  attachments_sent: number;
  attachments_received: number;
  total_sent_size_bytes: number;
  total_received_size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface EmailUsageStats {
  email_account_id: string;
  email_address: string;
  display_name: string | null;
  storage_quota_mb: number;
  storage_used_mb: number;
  daily_send_limit: number;
  emails_sent_today: number;
  status: EmailAccountStatus;
  storage_percent_used: number;
  daily_quota_percent_used: number;
  emails_sent_30d: number;
  emails_received_30d: number;
  last_sync_at: string | null;
  created_at: string;
}

export interface QuotaCheckResult {
  can_send: boolean;
  emails_sent: number;
  daily_limit: number;
  remaining: number;
}

// ============================================================================
// QUICK TEMPLATES
// ============================================================================

export interface EmailQuickTemplate {
  id: string;
  email_account_id: string | null;
  name: string;
  description: string | null;
  category: string;
  subject: string | null;
  body_html: string;
  body_text: string;
  is_global: boolean;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateQuickTemplateRequest {
  name: string;
  description?: string;
  category?: string;
  subject?: string;
  body_html: string;
  body_text: string;
  is_global?: boolean;
  tags?: string[];
}

// ============================================================================
// CONTACTS / ADDRESS BOOK
// ============================================================================

export interface EmailContact {
  id: string;
  email_account_id: string;
  email_address: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  department: string | null;
  phone: string | null;
  notes: string | null;
  contact_type: ContactType;
  is_favorite: boolean;
  emails_sent_count: number;
  emails_received_count: number;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContactRequest {
  email_address: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  department?: string;
  phone?: string;
  notes?: string;
  is_favorite?: boolean;
}

// ============================================================================
// LABELS
// ============================================================================

export interface EmailLabel {
  id: string;
  email_account_id: string;
  name: string;
  color: string;
  icon: string | null;
  is_system: boolean;
  is_visible: boolean;
  sort_order: number;
  total_count: number;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateLabelRequest {
  name: string;
  color?: string;
  icon?: string;
}

// ============================================================================
// SCHEDULED EMAILS
// ============================================================================

export interface ScheduledEmail {
  id: string;
  email_account_id: string;
  draft_id: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  attachments: DraftAttachment[];
  scheduled_at: string;
  timezone: string;
  status: ScheduledEmailStatus;
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ADMIN SETTINGS
// ============================================================================

export interface EmailAdminSetting {
  id: string;
  setting_key: string;
  setting_value: unknown;
  setting_type: EmailSettingType;
  description: string | null;
  category: EmailSettingCategory;
  is_editable: boolean;
  requires_restart: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailAdminSettings {
  // Account
  email_format: string;

  // Limits
  default_daily_limit: number;
  default_storage_quota_mb: number;
  max_attachment_size_mb: number;
  max_total_attachments_mb: number;
  max_recipients: number;

  // Security
  allowed_attachment_types: string[];
  blocked_attachment_types: string[];
  spam_filter_enabled: boolean;
  virus_scan_enabled: boolean;

  // Policy
  allow_external_emails: boolean;
  external_email_warning: boolean;
  auto_reply_max_days: number;

  // Signature
  require_signature: boolean;
  signature_position: 'top' | 'bottom';
  signature_separator: string;

  // Compliance
  auto_bcc_admin: boolean;
  admin_bcc_email: string;
  retention_days: number;
  audit_log_retention_days: number;

  // Features
  email_recall_enabled: boolean;
  read_receipt_enabled: boolean;
  schedule_send_enabled: boolean;
  undo_send_seconds: number;

  // Appearance
  default_font_family: string;
  default_font_size: number;
}

export interface UpdateEmailSettingsRequest {
  [key: string]: unknown;
}

// ============================================================================
// FOLDER STATS
// ============================================================================

export interface EmailFolderStats {
  folder: EmailFolder;
  name: string;
  icon: string;
  color: string;
  total: number;
  unread: number;
  is_system: boolean;
}

// ============================================================================
// SEARCH
// ============================================================================

export interface EmailSearchParams {
  query?: string;
  folder?: EmailFolder;
  from?: string;
  to?: string;
  subject?: string;
  has_attachment?: boolean;
  is_read?: boolean;
  is_starred?: boolean;
  date_from?: string;
  date_to?: string;
  label?: string;
  page?: number;
  limit?: number;
  sort_by?: 'date' | 'from' | 'subject' | 'size';
  sort_order?: 'asc' | 'desc';
}

export interface EmailSearchResult {
  messages: EmailMessage[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================

export interface EmailAdminDashboardStats {
  total_accounts: number;
  active_accounts: number;
  pending_accounts: number;
  suspended_accounts: number;
  total_storage_used_mb: number;
  total_storage_quota_mb: number;
  emails_sent_today: number;
  avg_emails_per_user_today: number;
}

export interface EmailActivityChartData {
  date: string;
  sent: number;
  received: number;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface EmailApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface EmailPaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ============================================================================
// IMAP/SMTP TYPES
// ============================================================================

export interface IMAPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized: boolean;
  };
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface IMAPMailbox {
  name: string;
  path: string;
  flags: string[];
  delimiter: string;
  exists: number;
  recent: number;
  unseen: number;
  uidValidity: number;
  uidNext: number;
}

// ============================================================================
// ZOHO SPECIFIC TYPES
// ============================================================================

export interface ZohoAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface ZohoMailAccount {
  accountId: string;
  displayName: string;
  emailAddress: string;
  accountType: string;
  isConfirmed: boolean;
  isPrimary: boolean;
}

export interface ZohoEmailMessage {
  messageId: string;
  folderId: string;
  subject: string;
  from: ZohoEmailAddress;
  to: ZohoEmailAddress[];
  cc?: ZohoEmailAddress[];
  bcc?: ZohoEmailAddress[];
  receivedTime: number;
  sentTime?: number;
  hasAttachment: boolean;
  isRead: boolean;
  isFlagged: boolean;
  summary: string;
  content?: string;
  htmlContent?: string;
}

export interface ZohoEmailAddress {
  address: string;
  name?: string;
}

export interface ZohoFolder {
  folderId: string;
  folderName: string;
  folderType: string;
  unreadCount: number;
  messageCount: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type EmailAccountStatusFilter = EmailAccountStatus | 'all';

export type EmailSortField = 'date' | 'from' | 'to' | 'subject' | 'size';

export type EmailSortOrder = 'asc' | 'desc';

export interface EmailFilters {
  status?: EmailAccountStatusFilter;
  department?: string;
  role?: string;
  search?: string;
}

// Form state for compose
export interface ComposeFormState {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body_html: string;
  body_text: string;
  attachments: File[];
  uploadedAttachments: DraftAttachment[];
  showCc: boolean;
  showBcc: boolean;
  isReply: boolean;
  isForward: boolean;
  originalMessageId?: string;
  includeSignature: boolean;
  scheduleDate?: Date;
  isDirty: boolean;
  isSending: boolean;
  isSavingDraft: boolean;
}

// Email client state
export interface EmailClientState {
  currentFolder: EmailFolder;
  selectedMessageId: string | null;
  selectedMessages: string[];
  isComposing: boolean;
  composeMode: 'new' | 'reply' | 'replyAll' | 'forward';
  searchQuery: string;
  isSearching: boolean;
  viewMode: 'list' | 'split' | 'full';
}
