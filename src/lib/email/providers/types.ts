/**
 * Email Provider Type Definitions
 * Enterprise-grade type system for email provider abstraction
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type EmailProviderType =
  | 'zoho'
  | 'google'
  | 'microsoft'
  | 'hostinger'
  | 'sendgrid'
  | 'mailgun'
  | 'resend'
  | 'ses' // Amazon SES
  | 'postmark'
  | 'sparkpost'
  | 'mailchimp'
  | 'custom_smtp'
  | 'custom_api';

export type ProviderCategory =
  | 'email_service' // Full email service (Zoho, Google, Microsoft)
  | 'transactional' // Transactional email (SendGrid, Resend)
  | 'marketing' // Marketing email (Mailchimp)
  | 'smtp_relay'; // SMTP relay only

export type ProviderAuthType =
  | 'api_key'
  | 'oauth2'
  | 'smtp_credentials'
  | 'api_key_secret'
  | 'bearer_token';

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export interface ProviderCredentials {
  id: string;
  providerName: EmailProviderType;
  providerType: ProviderCategory;
  displayName: string;
  description?: string;

  // API Authentication
  apiKey?: string;
  apiSecret?: string;
  apiEndpoint?: string;

  // OAuth Authentication
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthRedirectUri?: string;
  oauthScopes?: string[];
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthTokenExpiresAt?: Date;

  // SMTP Configuration
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpUseTls?: boolean;
  smtpUseSsl?: boolean;

  // IMAP Configuration
  imapHost?: string;
  imapPort?: number;
  imapUsername?: string;
  imapPassword?: string;
  imapUseSsl?: boolean;

  // Webhook Configuration
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEvents?: string[];

  // Custom Configuration
  customConfig?: Record<string, unknown>;

  // Rate Limits
  rateLimitPerSecond?: number;
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  monthlyQuota?: number;

  // Status
  isActive: boolean;
  isPrimary: boolean;
  isVerified: boolean;
  healthStatus: ProviderHealthStatus;
  priority: number;
}

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

// ============================================================================
// PROVIDER CAPABILITIES
// ============================================================================

export interface ProviderCapabilities {
  // Email Operations
  canSendEmail: boolean;
  canReceiveEmail: boolean;
  canManageAccounts: boolean;
  canManageFolders: boolean;
  canSearchEmails: boolean;

  // Advanced Features
  supportsOAuth: boolean;
  supportsWebhooks: boolean;
  supportsTracking: boolean;
  supportsTemplates: boolean;
  supportsAttachments: boolean;
  supportsBulkSend: boolean;
  supportsScheduledSend: boolean;

  // Limits
  maxAttachmentSize: number; // in bytes
  maxRecipientsPerEmail: number;
  maxEmailsPerBatch: number;

  // Rate Limits
  defaultRateLimitPerSecond: number;
  defaultRateLimitPerMinute: number;
  defaultRateLimitPerHour: number;
  defaultRateLimitPerDay: number;
}

// ============================================================================
// EMAIL OPERATIONS
// ============================================================================

export interface SendEmailRequest {
  from?: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  metadata?: Record<string, unknown>;
  scheduledAt?: Date;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
  timestamp: Date;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  contentId?: string; // For inline attachments
  encoding?: 'base64' | 'binary';
}

// ============================================================================
// ACCOUNT MANAGEMENT
// ============================================================================

export interface CreateAccountRequest {
  email: string;
  password?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  storageQuotaMb?: number;
  aliases?: string[];
}

export interface CreateAccountResponse {
  success: boolean;
  accountId?: string;
  providerAccountId?: string;
  email?: string;
  error?: string;
}

export interface SuspendAccountRequest {
  accountId: string;
  reason?: string;
}

export interface DeleteAccountRequest {
  accountId: string;
  permanent?: boolean;
  backupData?: boolean;
}

export interface AccountQuotaInfo {
  storageQuotaMb: number;
  storageUsedMb: number;
  storageUsedPercent: number;
  emailsSentToday: number;
  dailySendLimit: number;
}

// ============================================================================
// HEALTH & MONITORING
// ============================================================================

export interface HealthCheckResult {
  healthy: boolean;
  status: ProviderHealthStatus;
  latencyMs?: number;
  message?: string;
  checkedAt: Date;
  details?: Record<string, unknown>;
}

export interface ProviderMetrics {
  providerId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
}

// ============================================================================
// PROVIDER ADAPTER INTERFACE
// ============================================================================

/**
 * Base interface for all email provider adapters
 * Implement this interface to add support for a new email provider
 */
export interface IEmailProviderAdapter {
  // Provider Information
  readonly providerName: EmailProviderType;
  readonly providerType: ProviderCategory;
  readonly capabilities: ProviderCapabilities;

  // Initialization
  initialize(credentials: ProviderCredentials): Promise<void>;
  validateCredentials(): Promise<boolean>;

  // Health Check
  healthCheck(): Promise<HealthCheckResult>;

  // Email Operations
  sendEmail(request: SendEmailRequest): Promise<SendEmailResponse>;
  sendBulkEmail?(requests: SendEmailRequest[]): Promise<SendEmailResponse[]>;

  // Account Management (optional - for full email services)
  createAccount?(request: CreateAccountRequest): Promise<CreateAccountResponse>;
  suspendAccount?(request: SuspendAccountRequest): Promise<boolean>;
  activateAccount?(accountId: string): Promise<boolean>;
  deleteAccount?(request: DeleteAccountRequest): Promise<boolean>;
  getAccountQuota?(accountId: string): Promise<AccountQuotaInfo>;
  syncAccountQuota?(accountId: string): Promise<AccountQuotaInfo>;

  // OAuth (optional)
  getAuthorizationUrl?(redirectUri: string, state?: string): string;
  exchangeCodeForTokens?(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshAccessToken?(): Promise<OAuthTokens>;

  // Webhooks (optional)
  verifyWebhookSignature?(payload: string, signature: string): boolean;
  parseWebhookEvent?(payload: unknown): WebhookEvent;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

export interface WebhookEvent {
  eventType: string;
  timestamp: Date;
  messageId?: string;
  recipient?: string;
  data: Record<string, unknown>;
}

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

export interface ProviderDefinition {
  name: EmailProviderType;
  displayName: string;
  category: ProviderCategory;
  authTypes: ProviderAuthType[];
  capabilities: ProviderCapabilities;
  configSchema: ProviderConfigSchema;
  iconUrl?: string;
  documentationUrl?: string;
}

export interface ProviderConfigSchema {
  required: string[];
  optional: string[];
  fields: ProviderConfigField[];
}

export interface ProviderConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json';
  required: boolean;
  encrypted: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
}
