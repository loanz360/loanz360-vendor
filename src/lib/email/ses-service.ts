/**
 * Amazon SES Email Service
 * High-level service for sending emails via Amazon SES
 *
 * Features:
 * - Simple email sending
 * - Bulk/batch email sending for marketing campaigns
 * - Template management
 * - Bounce/complaint handling
 * - Integration with app notification system
 */

import { SESAdapter, createSESAdapter, SESNotification, SESTemplate } from './providers';
import { ProviderCredentials } from './providers/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface SESServiceConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail: string;
  fromName?: string;
  configurationSetName?: string;
  replyToEmail?: string;
}

// ============================================================================
// EMAIL TYPES
// ============================================================================

export interface SendSESEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface SendSESTemplatedEmailParams {
  to: string | string[];
  templateName: string;
  templateData: Record<string, string>;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  tags?: string[];
}

export interface SendSESBulkEmailParams {
  recipients: Array<{
    to: string | string[];
    subject?: string;
    html?: string;
    text?: string;
    templateData?: Record<string, string>;
    tags?: Record<string, string>;
  }>;
  defaultSubject?: string;
  defaultHtml?: string;
  defaultText?: string;
  templateName?: string;
}

export interface SESEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SESBulkEmailResult {
  totalSent: number;
  totalFailed: number;
  results: SESEmailResult[];
}

// ============================================================================
// SES SERVICE CLASS
// ============================================================================

class SESEmailService {
  private adapter: SESAdapter | null = null;
  private config: SESServiceConfig | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the SES service with configuration
   */
  async initialize(config: SESServiceConfig): Promise<void> {
    this.config = config;

    // Create adapter credentials
    const credentials: ProviderCredentials = {
      id: 'ses-service',
      providerName: 'ses',
      providerType: 'transactional',
      displayName: 'Amazon SES',
      apiKey: config.accessKeyId,
      apiSecret: config.secretAccessKey,
      customConfig: {
        region: config.region,
        fromEmail: config.fromEmail,
        fromName: config.fromName || 'Loanz360',
        configurationSetName: config.configurationSetName,
      },
      isActive: true,
      isPrimary: true,
      isVerified: true,
      healthStatus: 'unknown',
      priority: 1,
    };

    this.adapter = createSESAdapter();
    await this.adapter.initialize(credentials);

    // Validate credentials
    const isValid = await this.adapter.validateCredentials();
    if (!isValid) {
      throw new Error('Invalid SES credentials');
    }

    this.initialized = true;
  }

  /**
   * Initialize from environment variables
   */
  async initializeFromEnv(): Promise<void> {
    const config: SESServiceConfig = {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
      fromEmail: process.env.AWS_SES_FROM_EMAIL || process.env.EMAIL_FROM || '',
      fromName: process.env.AWS_SES_FROM_NAME || process.env.EMAIL_FROM_NAME || 'Loanz360',
      configurationSetName: process.env.AWS_SES_CONFIGURATION_SET,
      replyToEmail: process.env.AWS_SES_REPLY_TO || process.env.EMAIL_REPLY_TO,
    };

    if (!config.accessKeyId || !config.secretAccessKey || !config.fromEmail) {
      throw new Error('Missing required SES environment variables');
    }

    await this.initialize(config);
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the underlying adapter for advanced operations
   */
  getAdapter(): SESAdapter | null {
    return this.adapter;
  }

  /**
   * Send a single email
   */
  async sendEmail(params: SendSESEmailParams): Promise<SESEmailResult> {
    if (!this.adapter || !this.config) {
      return { success: false, error: 'SES service not initialized' };
    }

    const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

    const result = await this.adapter.sendEmail({
      to: toAddresses,
      subject: params.subject,
      bodyHtml: params.html,
      bodyText: params.text,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo || this.config.replyToEmail,
      tags: params.tags,
      metadata: params.metadata,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  }

  /**
   * Send a templated email
   */
  async sendTemplatedEmail(params: SendSESTemplatedEmailParams): Promise<SESEmailResult> {
    if (!this.adapter || !this.config) {
      return { success: false, error: 'SES service not initialized' };
    }

    const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

    const result = await this.adapter.sendTemplatedEmail({
      to: toAddresses,
      templateName: params.templateName,
      templateData: params.templateData,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo || this.config.replyToEmail,
      tags: params.tags,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  }

  /**
   * Send bulk emails (for marketing campaigns)
   */
  async sendBulkEmail(params: SendSESBulkEmailParams): Promise<SESBulkEmailResult> {
    if (!this.adapter || !this.config) {
      return {
        totalSent: 0,
        totalFailed: params.recipients.length,
        results: params.recipients.map(() => ({
          success: false,
          error: 'SES service not initialized',
        })),
      };
    }

    const requests = params.recipients.map(recipient => {
      const toAddresses = Array.isArray(recipient.to) ? recipient.to : [recipient.to];

      return {
        to: toAddresses,
        subject: recipient.subject || params.defaultSubject || '',
        bodyHtml: recipient.html || params.defaultHtml,
        bodyText: recipient.text || params.defaultText,
        tags: recipient.tags ? Object.keys(recipient.tags) : undefined,
      };
    });

    const results = await this.adapter.sendBulkEmail(requests);

    const emailResults: SESEmailResult[] = results.map(r => ({
      success: r.success,
      messageId: r.messageId,
      error: r.error,
    }));

    const totalSent = emailResults.filter(r => r.success).length;
    const totalFailed = emailResults.filter(r => !r.success).length;

    return {
      totalSent,
      totalFailed,
      results: emailResults,
    };
  }

  /**
   * Send marketing campaign emails with personalization
   */
  async sendMarketingCampaign(params: {
    recipients: Array<{
      email: string;
      name?: string;
      customData?: Record<string, string>;
    }>;
    subject: string;
    htmlTemplate: string;
    textTemplate?: string;
    campaignId?: string;
    tags?: string[];
  }): Promise<SESBulkEmailResult> {
    if (!this.adapter || !this.config) {
      return {
        totalSent: 0,
        totalFailed: params.recipients.length,
        results: params.recipients.map(() => ({
          success: false,
          error: 'SES service not initialized',
        })),
      };
    }

    // Process templates with personalization
    const requests = params.recipients.map(recipient => {
      let html = params.htmlTemplate;
      let text = params.textTemplate || '';
      let subject = params.subject;

      // Replace common variables
      const variables: Record<string, string> = {
        '{{email}}': recipient.email,
        '{{name}}': recipient.name || '',
        '{{first_name}}': recipient.name?.split(' ')[0] || '',
        ...recipient.customData,
      };

      for (const [key, value] of Object.entries(variables)) {
        html = html.replace(new RegExp(key, 'g'), value);
        text = text.replace(new RegExp(key, 'g'), value);
        subject = subject.replace(new RegExp(key, 'g'), value);
      }

      const tags = [...(params.tags || [])];
      if (params.campaignId) {
        tags.push(`campaign:${params.campaignId}`);
      }

      return {
        to: [recipient.email],
        subject,
        bodyHtml: html,
        bodyText: text || undefined,
        tags,
      };
    });

    const results = await this.adapter.sendBulkEmail(requests);

    const emailResults: SESEmailResult[] = results.map(r => ({
      success: r.success,
      messageId: r.messageId,
      error: r.error,
    }));

    return {
      totalSent: emailResults.filter(r => r.success).length,
      totalFailed: emailResults.filter(r => !r.success).length,
      results: emailResults,
    };
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  /**
   * Create an email template
   */
  async createTemplate(template: SESTemplate): Promise<boolean> {
    if (!this.adapter) return false;
    return this.adapter.createTemplate(template);
  }

  /**
   * Delete an email template
   */
  async deleteTemplate(templateName: string): Promise<boolean> {
    if (!this.adapter) return false;
    return this.adapter.deleteTemplate(templateName);
  }

  /**
   * Get an email template
   */
  async getTemplate(templateName: string): Promise<SESTemplate | null> {
    if (!this.adapter) return null;
    return this.adapter.getTemplate(templateName);
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<string[]> {
    if (!this.adapter) return [];
    return this.adapter.listTemplates();
  }

  /**
   * Test render a template
   */
  async testRenderTemplate(templateName: string, data: Record<string, string>): Promise<string | null> {
    if (!this.adapter) return null;
    return this.adapter.testRenderTemplate(templateName, data);
  }

  // ============================================================================
  // ACCOUNT & QUOTA
  // ============================================================================

  /**
   * Get SES account status and sending quota
   */
  async getAccountStatus() {
    if (!this.adapter) return null;
    return this.adapter.getAccountStatus();
  }

  /**
   * Perform health check
   */
  async healthCheck() {
    if (!this.adapter) {
      return {
        healthy: false,
        status: 'down' as const,
        message: 'SES service not initialized',
        checkedAt: new Date(),
      };
    }
    return this.adapter.healthCheck();
  }

  // ============================================================================
  // SUPPRESSION LIST
  // ============================================================================

  /**
   * Check if an email is suppressed
   */
  async isEmailSuppressed(email: string): Promise<boolean> {
    if (!this.adapter) return false;
    const result = await this.adapter.getSuppressedDestination(email);
    return result !== null;
  }

  /**
   * Add email to suppression list
   */
  async suppressEmail(email: string, reason: 'BOUNCE' | 'COMPLAINT'): Promise<boolean> {
    if (!this.adapter) return false;
    return this.adapter.addToSuppressionList(email, reason);
  }

  /**
   * Remove email from suppression list
   */
  async unsuppressEmail(email: string): Promise<boolean> {
    if (!this.adapter) return false;
    return this.adapter.removeFromSuppressionList(email);
  }

  /**
   * List suppressed emails
   */
  async listSuppressedEmails(params?: {
    reason?: 'BOUNCE' | 'COMPLAINT';
    startDate?: Date;
    endDate?: Date;
  }) {
    if (!this.adapter) return [];
    return this.adapter.listSuppressedDestinations(params);
  }

  // ============================================================================
  // CONFIGURATION SETS
  // ============================================================================

  /**
   * Create a configuration set for tracking
   */
  async createConfigurationSet(name: string): Promise<boolean> {
    if (!this.adapter) return false;
    return this.adapter.createConfigurationSet(name);
  }

  /**
   * Delete a configuration set
   */
  async deleteConfigurationSet(name: string): Promise<boolean> {
    if (!this.adapter) return false;
    return this.adapter.deleteConfigurationSet(name);
  }

  /**
   * List configuration sets
   */
  async listConfigurationSets(): Promise<string[]> {
    if (!this.adapter) return [];
    return this.adapter.listConfigurationSets();
  }

  /**
   * Add SNS event destination for tracking
   */
  async addSNSEventDestination(params: {
    configurationSetName: string;
    eventDestinationName: string;
    snsTopicArn: string;
    eventTypes: Array<'SEND' | 'REJECT' | 'BOUNCE' | 'COMPLAINT' | 'DELIVERY' | 'OPEN' | 'CLICK' | 'RENDERING_FAILURE'>;
  }): Promise<boolean> {
    if (!this.adapter) return false;
    return this.adapter.addSNSEventDestination(params);
  }

  // ============================================================================
  // WEBHOOK PROCESSING
  // ============================================================================

  /**
   * Process SNS notification from SES
   */
  processNotification(notification: SESNotification) {
    if (!this.adapter) {
      return { action: 'ignore' as const };
    }
    return this.adapter.processNotification(notification);
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: unknown) {
    if (!this.adapter) return null;
    return this.adapter.parseWebhookEvent(payload);
  }
}

// ============================================================================
// SINGLETON & FACTORY
// ============================================================================

let sesServiceInstance: SESEmailService | null = null;

/**
 * Get the singleton SES service instance
 */
export function getSESService(): SESEmailService {
  if (!sesServiceInstance) {
    sesServiceInstance = new SESEmailService();
  }
  return sesServiceInstance;
}

/**
 * Create a new SES service instance
 */
export function createSESService(): SESEmailService {
  return new SESEmailService();
}

/**
 * Initialize and get the SES service
 */
export async function initializeSESService(config?: SESServiceConfig): Promise<SESEmailService> {
  const service = getSESService();

  if (!service.isInitialized()) {
    if (config) {
      await service.initialize(config);
    } else {
      await service.initializeFromEnv();
    }
  }

  return service;
}

// Export the service class
export { SESEmailService };
