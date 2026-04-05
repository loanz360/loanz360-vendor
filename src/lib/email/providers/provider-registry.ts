/**
 * Email Provider Registry
 * Centralized registry for all email provider adapters
 * Supports dynamic registration of custom providers
 */

import {
  EmailProviderType,
  ProviderCategory,
  ProviderDefinition,
  ProviderCapabilities,
  ProviderConfigSchema,
  ProviderConfigField,
  IEmailProviderAdapter,
  ProviderCredentials,
} from './types';
import { BaseEmailProviderAdapter } from './base-adapter';

// ============================================================================
// PROVIDER DEFINITIONS
// ============================================================================

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  canSendEmail: true,
  canReceiveEmail: false,
  canManageAccounts: false,
  canManageFolders: false,
  canSearchEmails: false,
  supportsOAuth: false,
  supportsWebhooks: false,
  supportsTracking: false,
  supportsTemplates: false,
  supportsAttachments: true,
  supportsBulkSend: false,
  supportsScheduledSend: false,
  maxAttachmentSize: 25 * 1024 * 1024, // 25MB
  maxRecipientsPerEmail: 50,
  maxEmailsPerBatch: 100,
  defaultRateLimitPerSecond: 10,
  defaultRateLimitPerMinute: 100,
  defaultRateLimitPerHour: 1000,
  defaultRateLimitPerDay: 10000,
};

// Built-in provider definitions
export const PROVIDER_DEFINITIONS: Record<EmailProviderType, ProviderDefinition> = {
  zoho: {
    name: 'zoho',
    displayName: 'Zoho Mail',
    category: 'email_service',
    authTypes: ['oauth2', 'smtp_credentials'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      canReceiveEmail: true,
      canManageAccounts: true,
      canManageFolders: true,
      canSearchEmails: true,
      supportsOAuth: true,
      supportsWebhooks: true,
    },
    configSchema: {
      required: ['oauthClientId', 'oauthClientSecret', 'domain'],
      optional: ['smtpHost', 'smtpPort', 'imapHost', 'imapPort'],
      fields: [
        { name: 'domain', label: 'Email Domain', type: 'text', required: true, encrypted: false, placeholder: 'company.com' },
        { name: 'oauthClientId', label: 'OAuth Client ID', type: 'text', required: true, encrypted: false },
        { name: 'oauthClientSecret', label: 'OAuth Client Secret', type: 'password', required: true, encrypted: true },
        { name: 'smtpHost', label: 'SMTP Host', type: 'text', required: false, encrypted: false, defaultValue: 'smtp.zoho.com' },
        { name: 'smtpPort', label: 'SMTP Port', type: 'number', required: false, encrypted: false, defaultValue: 465 },
        { name: 'imapHost', label: 'IMAP Host', type: 'text', required: false, encrypted: false, defaultValue: 'imap.zoho.com' },
        { name: 'imapPort', label: 'IMAP Port', type: 'number', required: false, encrypted: false, defaultValue: 993 },
      ],
    },
    documentationUrl: 'https://www.zoho.com/mail/help/api/',
  },

  google: {
    name: 'google',
    displayName: 'Google Workspace',
    category: 'email_service',
    authTypes: ['oauth2'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      canReceiveEmail: true,
      canManageAccounts: true,
      canManageFolders: true,
      canSearchEmails: true,
      supportsOAuth: true,
      supportsWebhooks: true,
      supportsTracking: true,
    },
    configSchema: {
      required: ['oauthClientId', 'oauthClientSecret', 'domain'],
      optional: ['serviceAccountKey'],
      fields: [
        { name: 'domain', label: 'Email Domain', type: 'text', required: true, encrypted: false },
        { name: 'oauthClientId', label: 'OAuth Client ID', type: 'text', required: true, encrypted: false },
        { name: 'oauthClientSecret', label: 'OAuth Client Secret', type: 'password', required: true, encrypted: true },
        { name: 'serviceAccountKey', label: 'Service Account JSON', type: 'json', required: false, encrypted: true },
      ],
    },
    documentationUrl: 'https://developers.google.com/gmail/api',
  },

  microsoft: {
    name: 'microsoft',
    displayName: 'Microsoft 365',
    category: 'email_service',
    authTypes: ['oauth2'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      canReceiveEmail: true,
      canManageAccounts: true,
      canManageFolders: true,
      canSearchEmails: true,
      supportsOAuth: true,
      supportsWebhooks: true,
      supportsTracking: true,
    },
    configSchema: {
      required: ['oauthClientId', 'oauthClientSecret', 'tenantId', 'domain'],
      optional: [],
      fields: [
        { name: 'domain', label: 'Email Domain', type: 'text', required: true, encrypted: false },
        { name: 'tenantId', label: 'Azure Tenant ID', type: 'text', required: true, encrypted: false },
        { name: 'oauthClientId', label: 'Application (Client) ID', type: 'text', required: true, encrypted: false },
        { name: 'oauthClientSecret', label: 'Client Secret', type: 'password', required: true, encrypted: true },
      ],
    },
    documentationUrl: 'https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview',
  },

  hostinger: {
    name: 'hostinger',
    displayName: 'Hostinger Email',
    category: 'email_service',
    authTypes: ['smtp_credentials'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      canReceiveEmail: true,
    },
    configSchema: {
      required: ['smtpUsername', 'smtpPassword', 'domain'],
      optional: ['smtpHost', 'smtpPort'],
      fields: [
        { name: 'domain', label: 'Email Domain', type: 'text', required: true, encrypted: false },
        { name: 'smtpUsername', label: 'SMTP Username', type: 'text', required: true, encrypted: false },
        { name: 'smtpPassword', label: 'SMTP Password', type: 'password', required: true, encrypted: true },
        { name: 'smtpHost', label: 'SMTP Host', type: 'text', required: false, encrypted: false, defaultValue: 'smtp.hostinger.com' },
        { name: 'smtpPort', label: 'SMTP Port', type: 'number', required: false, encrypted: false, defaultValue: 465 },
      ],
    },
  },

  sendgrid: {
    name: 'sendgrid',
    displayName: 'SendGrid',
    category: 'transactional',
    authTypes: ['api_key'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      supportsWebhooks: true,
      supportsTracking: true,
      supportsTemplates: true,
      supportsBulkSend: true,
      supportsScheduledSend: true,
      maxEmailsPerBatch: 1000,
      defaultRateLimitPerSecond: 100,
    },
    configSchema: {
      required: ['apiKey'],
      optional: ['webhookUrl', 'fromEmail', 'fromName'],
      fields: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, encrypted: true },
        { name: 'fromEmail', label: 'Default From Email', type: 'text', required: false, encrypted: false },
        { name: 'fromName', label: 'Default From Name', type: 'text', required: false, encrypted: false },
        { name: 'webhookUrl', label: 'Webhook URL', type: 'text', required: false, encrypted: false },
      ],
    },
    documentationUrl: 'https://docs.sendgrid.com/api-reference',
  },

  mailgun: {
    name: 'mailgun',
    displayName: 'Mailgun',
    category: 'transactional',
    authTypes: ['api_key'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      supportsWebhooks: true,
      supportsTracking: true,
      supportsTemplates: true,
      supportsBulkSend: true,
      supportsScheduledSend: true,
    },
    configSchema: {
      required: ['apiKey', 'domain'],
      optional: ['region', 'webhookSigningKey'],
      fields: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, encrypted: true },
        { name: 'domain', label: 'Sending Domain', type: 'text', required: true, encrypted: false },
        { name: 'region', label: 'Region', type: 'select', required: false, encrypted: false, options: [
          { label: 'US', value: 'us' },
          { label: 'EU', value: 'eu' },
        ], defaultValue: 'us' },
        { name: 'webhookSigningKey', label: 'Webhook Signing Key', type: 'password', required: false, encrypted: true },
      ],
    },
    documentationUrl: 'https://documentation.mailgun.com/en/latest/',
  },

  resend: {
    name: 'resend',
    displayName: 'Resend',
    category: 'transactional',
    authTypes: ['api_key'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      supportsWebhooks: true,
      supportsTracking: true,
      supportsBulkSend: true,
    },
    configSchema: {
      required: ['apiKey'],
      optional: ['fromEmail', 'fromName'],
      fields: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, encrypted: true },
        { name: 'fromEmail', label: 'Default From Email', type: 'text', required: false, encrypted: false },
        { name: 'fromName', label: 'Default From Name', type: 'text', required: false, encrypted: false },
      ],
    },
    documentationUrl: 'https://resend.com/docs',
  },

  ses: {
    name: 'ses',
    displayName: 'Amazon SES',
    category: 'transactional',
    authTypes: ['api_key_secret'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      supportsWebhooks: true,
      supportsTracking: true,
      supportsBulkSend: true,
      maxEmailsPerBatch: 500,
      defaultRateLimitPerSecond: 14,
    },
    configSchema: {
      required: ['accessKeyId', 'secretAccessKey', 'region'],
      optional: ['fromEmail'],
      fields: [
        { name: 'accessKeyId', label: 'AWS Access Key ID', type: 'text', required: true, encrypted: false },
        { name: 'secretAccessKey', label: 'AWS Secret Access Key', type: 'password', required: true, encrypted: true },
        { name: 'region', label: 'AWS Region', type: 'select', required: true, encrypted: false, options: [
          { label: 'US East (N. Virginia)', value: 'us-east-1' },
          { label: 'US West (Oregon)', value: 'us-west-2' },
          { label: 'EU (Ireland)', value: 'eu-west-1' },
          { label: 'EU (Frankfurt)', value: 'eu-central-1' },
          { label: 'Asia Pacific (Mumbai)', value: 'ap-south-1' },
          { label: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
        ] },
        { name: 'fromEmail', label: 'Verified From Email', type: 'text', required: false, encrypted: false },
      ],
    },
    documentationUrl: 'https://docs.aws.amazon.com/ses/latest/APIReference/',
  },

  postmark: {
    name: 'postmark',
    displayName: 'Postmark',
    category: 'transactional',
    authTypes: ['api_key'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      supportsWebhooks: true,
      supportsTracking: true,
      supportsTemplates: true,
      supportsBulkSend: true,
    },
    configSchema: {
      required: ['apiKey'],
      optional: ['fromEmail', 'messageStream'],
      fields: [
        { name: 'apiKey', label: 'Server API Token', type: 'password', required: true, encrypted: true },
        { name: 'fromEmail', label: 'Default From Email', type: 'text', required: false, encrypted: false },
        { name: 'messageStream', label: 'Message Stream', type: 'text', required: false, encrypted: false, defaultValue: 'outbound' },
      ],
    },
    documentationUrl: 'https://postmarkapp.com/developer',
  },

  sparkpost: {
    name: 'sparkpost',
    displayName: 'SparkPost',
    category: 'transactional',
    authTypes: ['api_key'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      supportsWebhooks: true,
      supportsTracking: true,
      supportsTemplates: true,
      supportsBulkSend: true,
    },
    configSchema: {
      required: ['apiKey'],
      optional: ['region'],
      fields: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, encrypted: true },
        { name: 'region', label: 'Region', type: 'select', required: false, encrypted: false, options: [
          { label: 'US', value: 'us' },
          { label: 'EU', value: 'eu' },
        ], defaultValue: 'us' },
      ],
    },
    documentationUrl: 'https://developers.sparkpost.com/',
  },

  mailchimp: {
    name: 'mailchimp',
    displayName: 'Mailchimp Transactional',
    category: 'marketing',
    authTypes: ['api_key'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      supportsWebhooks: true,
      supportsTracking: true,
      supportsTemplates: true,
      supportsBulkSend: true,
    },
    configSchema: {
      required: ['apiKey'],
      optional: ['fromEmail'],
      fields: [
        { name: 'apiKey', label: 'Mandrill API Key', type: 'password', required: true, encrypted: true },
        { name: 'fromEmail', label: 'Default From Email', type: 'text', required: false, encrypted: false },
      ],
    },
    documentationUrl: 'https://mailchimp.com/developer/transactional/',
  },

  custom_smtp: {
    name: 'custom_smtp',
    displayName: 'Custom SMTP',
    category: 'smtp_relay',
    authTypes: ['smtp_credentials'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
    },
    configSchema: {
      required: ['smtpHost', 'smtpPort', 'smtpUsername', 'smtpPassword'],
      optional: ['smtpUseTls', 'smtpUseSsl', 'fromEmail'],
      fields: [
        { name: 'smtpHost', label: 'SMTP Host', type: 'text', required: true, encrypted: false },
        { name: 'smtpPort', label: 'SMTP Port', type: 'number', required: true, encrypted: false },
        { name: 'smtpUsername', label: 'Username', type: 'text', required: true, encrypted: false },
        { name: 'smtpPassword', label: 'Password', type: 'password', required: true, encrypted: true },
        { name: 'smtpUseTls', label: 'Use TLS', type: 'boolean', required: false, encrypted: false, defaultValue: true },
        { name: 'smtpUseSsl', label: 'Use SSL', type: 'boolean', required: false, encrypted: false, defaultValue: false },
        { name: 'fromEmail', label: 'Default From Email', type: 'text', required: false, encrypted: false },
      ],
    },
  },

  custom_api: {
    name: 'custom_api',
    displayName: 'Custom API Provider',
    category: 'transactional',
    authTypes: ['api_key', 'api_key_secret', 'bearer_token'],
    capabilities: {
      ...DEFAULT_CAPABILITIES,
    },
    configSchema: {
      required: ['apiEndpoint', 'apiKey'],
      optional: ['apiSecret', 'customHeaders', 'customConfig'],
      fields: [
        { name: 'apiEndpoint', label: 'API Endpoint URL', type: 'text', required: true, encrypted: false, placeholder: 'https://api.example.com/v1/email/send' },
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, encrypted: true },
        { name: 'apiSecret', label: 'API Secret', type: 'password', required: false, encrypted: true },
        { name: 'authType', label: 'Authentication Type', type: 'select', required: true, encrypted: false, options: [
          { label: 'API Key Header', value: 'api_key' },
          { label: 'Bearer Token', value: 'bearer' },
          { label: 'Basic Auth', value: 'basic' },
        ], defaultValue: 'api_key' },
        { name: 'authHeaderName', label: 'Auth Header Name', type: 'text', required: false, encrypted: false, defaultValue: 'X-API-Key' },
        { name: 'customHeaders', label: 'Custom Headers (JSON)', type: 'json', required: false, encrypted: false },
        { name: 'requestBodyFormat', label: 'Request Body Format', type: 'select', required: false, encrypted: false, options: [
          { label: 'JSON', value: 'json' },
          { label: 'Form Data', value: 'form' },
        ], defaultValue: 'json' },
        { name: 'customConfig', label: 'Custom Configuration (JSON)', type: 'json', required: false, encrypted: false },
      ],
    },
  },
};

// ============================================================================
// PROVIDER REGISTRY CLASS
// ============================================================================

type AdapterConstructor = new () => BaseEmailProviderAdapter;

class ProviderRegistryClass {
  private adapters: Map<EmailProviderType, AdapterConstructor> = new Map();
  private instances: Map<string, IEmailProviderAdapter> = new Map();
  private customDefinitions: Map<string, ProviderDefinition> = new Map();

  /**
   * Register a provider adapter
   */
  registerAdapter(providerName: EmailProviderType, adapterClass: AdapterConstructor): void {
    this.adapters.set(providerName, adapterClass);
    console.info(`[ProviderRegistry] Registered adapter for ${providerName}`);
  }

  /**
   * Register a custom provider definition
   */
  registerCustomProvider(definition: ProviderDefinition): void {
    this.customDefinitions.set(definition.name, definition);
    console.info(`[ProviderRegistry] Registered custom provider: ${definition.displayName}`);
  }

  /**
   * Get provider definition
   */
  getProviderDefinition(providerName: EmailProviderType | string): ProviderDefinition | undefined {
    return PROVIDER_DEFINITIONS[providerName as EmailProviderType] ||
           this.customDefinitions.get(providerName);
  }

  /**
   * Get all provider definitions
   */
  getAllProviderDefinitions(): ProviderDefinition[] {
    return [
      ...Object.values(PROVIDER_DEFINITIONS),
      ...Array.from(this.customDefinitions.values()),
    ];
  }

  /**
   * Get providers by category
   */
  getProvidersByCategory(category: ProviderCategory): ProviderDefinition[] {
    return this.getAllProviderDefinitions().filter(p => p.category === category);
  }

  /**
   * Create adapter instance
   */
  async createAdapter(
    providerName: EmailProviderType,
    credentials: ProviderCredentials
  ): Promise<IEmailProviderAdapter> {
    const AdapterClass = this.adapters.get(providerName);

    if (!AdapterClass) {
      throw new Error(`No adapter registered for provider: ${providerName}`);
    }

    const adapter = new AdapterClass();
    await adapter.initialize(credentials);

    // Cache the instance
    const instanceKey = `${providerName}:${credentials.id}`;
    this.instances.set(instanceKey, adapter);

    return adapter;
  }

  /**
   * Get cached adapter instance
   */
  getAdapterInstance(providerName: EmailProviderType, credentialsId: string): IEmailProviderAdapter | undefined {
    const instanceKey = `${providerName}:${credentialsId}`;
    return this.instances.get(instanceKey);
  }

  /**
   * Remove cached adapter instance
   */
  removeAdapterInstance(providerName: EmailProviderType, credentialsId: string): void {
    const instanceKey = `${providerName}:${credentialsId}`;
    this.instances.delete(instanceKey);
  }

  /**
   * Clear all cached instances
   */
  clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Check if provider is registered
   */
  isProviderRegistered(providerName: EmailProviderType): boolean {
    return this.adapters.has(providerName);
  }

  /**
   * Get list of registered adapters
   */
  getRegisteredAdapters(): EmailProviderType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Validate provider credentials against schema
   */
  validateCredentials(
    providerName: EmailProviderType,
    credentials: Partial<ProviderCredentials>
  ): { valid: boolean; errors: string[] } {
    const definition = this.getProviderDefinition(providerName);

    if (!definition) {
      return { valid: false, errors: [`Unknown provider: ${providerName}`] };
    }

    const errors: string[] = [];

    // Check required fields
    for (const fieldName of definition.configSchema.required) {
      const field = definition.configSchema.fields.find(f => f.name === fieldName);
      const value = (credentials as Record<string, unknown>)[fieldName];

      if (value === undefined || value === null || value === '') {
        errors.push(`Missing required field: ${field?.label || fieldName}`);
      }
    }

    // Validate field types and constraints
    for (const field of definition.configSchema.fields) {
      const value = (credentials as Record<string, unknown>)[field.name];

      if (value !== undefined && value !== null) {
        // Type validation
        if (field.type === 'number' && typeof value !== 'number') {
          errors.push(`${field.label} must be a number`);
        }

        if (field.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${field.label} must be a boolean`);
        }

        // Constraint validation
        if (field.validation) {
          if (field.validation.minLength && String(value).length < field.validation.minLength) {
            errors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
          }

          if (field.validation.maxLength && String(value).length > field.validation.maxLength) {
            errors.push(`${field.label} must not exceed ${field.validation.maxLength} characters`);
          }

          if (field.validation.pattern && !new RegExp(field.validation.pattern).test(String(value))) {
            errors.push(`${field.label} has invalid format`);
          }

          if (field.validation.min !== undefined && Number(value) < field.validation.min) {
            errors.push(`${field.label} must be at least ${field.validation.min}`);
          }

          if (field.validation.max !== undefined && Number(value) > field.validation.max) {
            errors.push(`${field.label} must not exceed ${field.validation.max}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// Singleton instance
export const ProviderRegistry = new ProviderRegistryClass();

// Export for convenience
export default ProviderRegistry;
