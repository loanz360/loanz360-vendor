/**
 * Email Provider System
 * Enterprise-grade email provider abstraction layer
 *
 * Features:
 * - Multiple provider support (Zoho, Google, Microsoft, SendGrid, Resend, Amazon SES, etc.)
 * - Extensible custom API adapter for third-party integrations
 * - Automatic failover between providers
 * - Rate limiting and quota management
 * - Health monitoring
 * - Encrypted credential storage
 */

// Types
export * from './types';

// Base adapter
export { BaseEmailProviderAdapter } from './base-adapter';

// Provider registry
export { ProviderRegistry, PROVIDER_DEFINITIONS } from './provider-registry';

// Provider service
export {
  EmailProviderService,
  getEmailProviderService,
} from './provider-service';

// Adapters
export { SMTPAdapter } from './adapters/smtp-adapter';
export { ResendAdapter } from './adapters/resend-adapter';
export { SendGridAdapter } from './adapters/sendgrid-adapter';
export { CustomAPIAdapter, createCustomAdapter } from './adapters/custom-api-adapter';
export { SESAdapter, getSESAdapter, createSESAdapter } from './adapters/ses-adapter';
export type {
  SESConfiguration,
  SESTemplate,
  SESBulkEmailEntry,
  SESSuppressedEmail,
  SESAccountStatus,
  SESNotification,
} from './adapters/ses-adapter';

// Re-export commonly used types for convenience
export type {
  EmailProviderType,
  ProviderCategory,
  ProviderCredentials,
  ProviderDefinition,
  SendEmailRequest,
  SendEmailResponse,
  HealthCheckResult,
  IEmailProviderAdapter,
} from './types';
