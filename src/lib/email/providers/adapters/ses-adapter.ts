/**
 * Amazon SES Email Provider Adapter
 * https://docs.aws.amazon.com/ses/latest/APIReference/
 *
 * Features:
 * - Transactional email sending
 * - Bulk/batch email sending for marketing campaigns
 * - Email templates support
 * - Delivery tracking via SNS webhooks
 * - Bounce and complaint handling
 * - Configuration sets for tracking
 */

import {
  SESv2Client,
  SendEmailCommand,
  GetAccountCommand,
  ListEmailTemplatesCommand,
  CreateEmailTemplateCommand,
  DeleteEmailTemplateCommand,
  GetEmailTemplateCommand,
  TestRenderEmailTemplateCommand,
  CreateConfigurationSetCommand,
  DeleteConfigurationSetCommand,
  ListConfigurationSetsCommand,
  CreateConfigurationSetEventDestinationCommand,
  GetSuppressedDestinationCommand,
  PutSuppressedDestinationCommand,
  DeleteSuppressedDestinationCommand,
  ListSuppressedDestinationsCommand,
  EmailContent,
  MessageTag,
  SuppressionListReason,
} from '@aws-sdk/client-sesv2';

import { BaseEmailProviderAdapter } from '../base-adapter';
import {
  EmailProviderType,
  ProviderCategory,
  ProviderCapabilities,
  SendEmailRequest,
  SendEmailResponse,
  HealthCheckResult,
  WebhookEvent,
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface SESConfiguration {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail: string;
  fromName?: string;
  configurationSetName?: string;
  feedbackForwardingEmail?: string;
}

export interface SESTemplate {
  templateName: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
}

export interface SESBulkEmailEntry {
  to: string[];
  templateName?: string;
  templateData?: Record<string, string>;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  tags?: Record<string, string>;
}

export interface SESSuppressedEmail {
  email: string;
  reason: 'BOUNCE' | 'COMPLAINT';
}

export interface SESAccountStatus {
  sendingEnabled: boolean;
  sendQuota: {
    max24HourSend: number;
    maxSendRate: number;
    sentLast24Hours: number;
  };
  enforcementStatus: string;
  productionAccessEnabled: boolean;
}

// SNS Notification Types
export interface SESNotification {
  notificationType: 'Bounce' | 'Complaint' | 'Delivery';
  mail: {
    timestamp: string;
    source: string;
    sourceArn?: string;
    sendingAccountId?: string;
    messageId: string;
    destination: string[];
    headersTruncated?: boolean;
    headers?: Array<{ name: string; value: string }>;
    commonHeaders?: {
      from: string[];
      to: string[];
      subject: string;
    };
  };
  bounce?: {
    bounceType: 'Undetermined' | 'Permanent' | 'Transient';
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      action?: string;
      status?: string;
      diagnosticCode?: string;
    }>;
    timestamp: string;
    feedbackId: string;
    reportingMTA?: string;
  };
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
    timestamp: string;
    feedbackId: string;
    complaintSubType?: string;
    complaintFeedbackType?: string;
    userAgent?: string;
    arrivalDate?: string;
  };
  delivery?: {
    timestamp: string;
    processingTimeMillis: number;
    recipients: string[];
    smtpResponse: string;
    reportingMTA: string;
  };
}

// ============================================================================
// SES ADAPTER
// ============================================================================

export class SESAdapter extends BaseEmailProviderAdapter {
  readonly providerName: EmailProviderType = 'ses';
  readonly providerType: ProviderCategory = 'transactional';
  readonly capabilities: ProviderCapabilities = {
    canSendEmail: true,
    canReceiveEmail: false,
    canManageAccounts: false,
    canManageFolders: false,
    canSearchEmails: false,
    supportsOAuth: false,
    supportsWebhooks: true, // via SNS
    supportsTracking: true, // via Configuration Sets
    supportsTemplates: true, // SES Templates
    supportsAttachments: true,
    supportsBulkSend: true, // SendBulkEmail API
    supportsScheduledSend: false, // Not natively (use external scheduler)
    maxAttachmentSize: 10 * 1024 * 1024, // 10MB
    maxRecipientsPerEmail: 50,
    maxEmailsPerBatch: 500, // Bulk API limit
    defaultRateLimitPerSecond: 14, // Default SES sandbox
    defaultRateLimitPerMinute: 840,
    defaultRateLimitPerHour: 50400,
    defaultRateLimitPerDay: 50000, // Sandbox: 200/day, Production: varies
  };

  private client: SESv2Client | null = null;
  private config: SESConfiguration | null = null;

  protected async onInitialize(): Promise<void> {
    if (!this.credentials?.apiKey || !this.credentials?.apiSecret) {
      throw new Error('AWS Access Key ID and Secret Access Key are required for SES');
    }

    const region = (this.credentials.customConfig?.region as string) || 'us-east-1';

    this.config = {
      accessKeyId: this.credentials.apiKey,
      secretAccessKey: this.credentials.apiSecret,
      region,
      fromEmail: (this.credentials.customConfig?.fromEmail as string) || '',
      fromName: (this.credentials.customConfig?.fromName as string) || 'Loanz360',
      configurationSetName: (this.credentials.customConfig?.configurationSetName as string) || undefined,
      feedbackForwardingEmail: (this.credentials.customConfig?.feedbackForwardingEmail as string) || undefined,
    };

    this.client = new SESv2Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  protected async performCredentialValidation(): Promise<boolean> {
    try {
      if (!this.client) return false;

      const command = new GetAccountCommand({});
      const response = await this.client.send(command);

      return !!response.SendingEnabled;
    } catch (error) {
      this.log('error', 'SES credential validation failed', { error });
      return false;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (!this.client) {
        return {
          healthy: false,
          status: 'down',
          message: 'SES client not initialized',
          checkedAt: new Date(),
        };
      }

      const command = new GetAccountCommand({});
      const response = await this.client.send(command);
      const latencyMs = Date.now() - startTime;

      if (response.SendingEnabled) {
        return {
          healthy: true,
          status: 'healthy',
          latencyMs,
          message: 'SES is operational',
          checkedAt: new Date(),
          details: {
            sendingEnabled: response.SendingEnabled,
            enforcementStatus: response.EnforcementStatus,
            productionAccessEnabled: response.ProductionAccessEnabled,
            sendQuota: response.SendQuota,
          },
        };
      }

      return {
        healthy: false,
        status: 'degraded',
        latencyMs,
        message: 'SES sending is disabled',
        checkedAt: new Date(),
        details: {
          enforcementStatus: response.EnforcementStatus,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'down',
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'SES health check failed',
        checkedAt: new Date(),
      };
    }
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    this.ensureInitialized();

    try {
      if (!this.client || !this.config) {
        throw new Error('SES client not initialized');
      }

      const fromAddress = request.from ||
        (this.config.fromName
          ? `${this.config.fromName} <${this.config.fromEmail}>`
          : this.config.fromEmail);

      const emailContent: EmailContent = {};

      // Build email content
      if (request.bodyHtml || request.bodyText) {
        emailContent.Simple = {
          Subject: {
            Data: request.subject,
            Charset: 'UTF-8',
          },
          Body: {},
        };

        if (request.bodyHtml) {
          emailContent.Simple.Body!.Html = {
            Data: request.bodyHtml,
            Charset: 'UTF-8',
          };
        }

        if (request.bodyText) {
          emailContent.Simple.Body!.Text = {
            Data: request.bodyText,
            Charset: 'UTF-8',
          };
        }
      }

      // Build tags
      const emailTags: MessageTag[] = [];
      if (request.tags) {
        for (const tag of request.tags) {
          emailTags.push({ Name: tag, Value: 'true' });
        }
      }

      // Add metadata as tags
      if (request.metadata) {
        for (const [key, value] of Object.entries(request.metadata)) {
          if (typeof value === 'string') {
            emailTags.push({ Name: key, Value: value });
          }
        }
      }

      const command = new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: request.to,
          CcAddresses: request.cc,
          BccAddresses: request.bcc,
        },
        ReplyToAddresses: request.replyTo ? [request.replyTo] : undefined,
        Content: emailContent,
        EmailTags: emailTags.length > 0 ? emailTags : undefined,
        ConfigurationSetName: this.config.configurationSetName,
      });

      const response = await this.client.send(command);

      return {
        success: true,
        messageId: response.MessageId,
        providerMessageId: response.MessageId,
        timestamp: new Date(),
      };
    } catch (error) {
      this.log('error', 'Failed to send email via SES', { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
        errorCode: 'SES_SEND_ERROR',
        timestamp: new Date(),
      };
    }
  }

  async sendBulkEmail(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    this.ensureInitialized();

    if (!this.client || !this.config) {
      return requests.map(() => ({
        success: false,
        error: 'SES client not initialized',
        timestamp: new Date(),
      }));
    }

    const results: SendEmailResponse[] = [];
    const batchSize = 500; // SES bulk limit

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await this.sendBulkBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private async sendBulkBatch(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    // For bulk sending, we'll send emails concurrently in smaller batches
    // This is more reliable than the SES bulk API which has specific template requirements
    const results: SendEmailResponse[] = [];
    const concurrency = 10; // Send 10 emails at a time

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchPromises = batch.map(request => this.sendEmail(request));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to respect rate limits
      if (i + concurrency < requests.length) {
        await this.delay(100);
      }
    }

    return results;
  }

  // ============================================================================
  // SES SPECIFIC FEATURES
  // ============================================================================

  /**
   * Get SES account status including sending quota
   */
  async getAccountStatus(): Promise<SESAccountStatus | null> {
    try {
      if (!this.client) return null;

      const command = new GetAccountCommand({});
      const response = await this.client.send(command);

      return {
        sendingEnabled: response.SendingEnabled || false,
        sendQuota: {
          max24HourSend: response.SendQuota?.Max24HourSend || 0,
          maxSendRate: response.SendQuota?.MaxSendRate || 0,
          sentLast24Hours: response.SendQuota?.SentLast24Hours || 0,
        },
        enforcementStatus: response.EnforcementStatus || 'UNKNOWN',
        productionAccessEnabled: response.ProductionAccessEnabled || false,
      };
    } catch (error) {
      this.log('error', 'Failed to get SES account status', { error });
      return null;
    }
  }

  /**
   * Create an email template
   */
  async createTemplate(template: SESTemplate): Promise<boolean> {
    try {
      if (!this.client) return false;

      const command = new CreateEmailTemplateCommand({
        TemplateName: template.templateName,
        TemplateContent: {
          Subject: template.subject,
          Html: template.htmlBody,
          Text: template.textBody,
        },
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      this.log('error', 'Failed to create SES template', { error, template: template.templateName });
      return false;
    }
  }

  /**
   * Delete an email template
   */
  async deleteTemplate(templateName: string): Promise<boolean> {
    try {
      if (!this.client) return false;

      const command = new DeleteEmailTemplateCommand({
        TemplateName: templateName,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      this.log('error', 'Failed to delete SES template', { error, templateName });
      return false;
    }
  }

  /**
   * Get an email template
   */
  async getTemplate(templateName: string): Promise<SESTemplate | null> {
    try {
      if (!this.client) return null;

      const command = new GetEmailTemplateCommand({
        TemplateName: templateName,
      });

      const response = await this.client.send(command);

      return {
        templateName: response.TemplateName || templateName,
        subject: response.TemplateContent?.Subject || '',
        htmlBody: response.TemplateContent?.Html,
        textBody: response.TemplateContent?.Text,
      };
    } catch (error) {
      this.log('error', 'Failed to get SES template', { error, templateName });
      return null;
    }
  }

  /**
   * List all email templates
   */
  async listTemplates(): Promise<string[]> {
    try {
      if (!this.client) return [];

      const command = new ListEmailTemplatesCommand({
        PageSize: 100,
      });

      const response = await this.client.send(command);

      return (response.TemplatesMetadata || []).map(t => t.TemplateName || '').filter(Boolean);
    } catch (error) {
      this.log('error', 'Failed to list SES templates', { error });
      return [];
    }
  }

  /**
   * Test render a template with data
   */
  async testRenderTemplate(templateName: string, templateData: Record<string, string>): Promise<string | null> {
    try {
      if (!this.client) return null;

      const command = new TestRenderEmailTemplateCommand({
        TemplateName: templateName,
        TemplateData: JSON.stringify(templateData),
      });

      const response = await this.client.send(command);
      return response.RenderedTemplate || null;
    } catch (error) {
      this.log('error', 'Failed to test render SES template', { error, templateName });
      return null;
    }
  }

  /**
   * Send templated email
   */
  async sendTemplatedEmail(params: {
    to: string[];
    templateName: string;
    templateData: Record<string, string>;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    tags?: string[];
  }): Promise<SendEmailResponse> {
    this.ensureInitialized();

    try {
      if (!this.client || !this.config) {
        throw new Error('SES client not initialized');
      }

      const fromAddress = this.config.fromName
        ? `${this.config.fromName} <${this.config.fromEmail}>`
        : this.config.fromEmail;

      const emailTags: MessageTag[] = [];
      if (params.tags) {
        for (const tag of params.tags) {
          emailTags.push({ Name: tag, Value: 'true' });
        }
      }

      const command = new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: params.to,
          CcAddresses: params.cc,
          BccAddresses: params.bcc,
        },
        ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
        Content: {
          Template: {
            TemplateName: params.templateName,
            TemplateData: JSON.stringify(params.templateData),
          },
        },
        EmailTags: emailTags.length > 0 ? emailTags : undefined,
        ConfigurationSetName: this.config.configurationSetName,
      });

      const response = await this.client.send(command);

      return {
        success: true,
        messageId: response.MessageId,
        providerMessageId: response.MessageId,
        timestamp: new Date(),
      };
    } catch (error) {
      this.log('error', 'Failed to send templated email via SES', { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send templated email',
        errorCode: 'SES_TEMPLATE_SEND_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Create a configuration set for tracking
   */
  async createConfigurationSet(name: string): Promise<boolean> {
    try {
      if (!this.client) return false;

      const command = new CreateConfigurationSetCommand({
        ConfigurationSetName: name,
        TrackingOptions: {
          CustomRedirectDomain: undefined,
        },
        SendingOptions: {
          SendingEnabled: true,
        },
        ReputationOptions: {
          ReputationMetricsEnabled: true,
        },
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      this.log('error', 'Failed to create SES configuration set', { error, name });
      return false;
    }
  }

  /**
   * Delete a configuration set
   */
  async deleteConfigurationSet(name: string): Promise<boolean> {
    try {
      if (!this.client) return false;

      const command = new DeleteConfigurationSetCommand({
        ConfigurationSetName: name,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      this.log('error', 'Failed to delete SES configuration set', { error, name });
      return false;
    }
  }

  /**
   * List all configuration sets
   */
  async listConfigurationSets(): Promise<string[]> {
    try {
      if (!this.client) return [];

      const command = new ListConfigurationSetsCommand({
        PageSize: 100,
      });

      const response = await this.client.send(command);

      return (response.ConfigurationSets || []).map(cs => cs || '').filter(Boolean);
    } catch (error) {
      this.log('error', 'Failed to list SES configuration sets', { error });
      return [];
    }
  }

  /**
   * Add SNS event destination to configuration set
   */
  async addSNSEventDestination(params: {
    configurationSetName: string;
    eventDestinationName: string;
    snsTopicArn: string;
    eventTypes: Array<'SEND' | 'REJECT' | 'BOUNCE' | 'COMPLAINT' | 'DELIVERY' | 'OPEN' | 'CLICK' | 'RENDERING_FAILURE'>;
  }): Promise<boolean> {
    try {
      if (!this.client) return false;

      const command = new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: params.configurationSetName,
        EventDestinationName: params.eventDestinationName,
        EventDestination: {
          Enabled: true,
          MatchingEventTypes: params.eventTypes,
          SnsDestination: {
            TopicArn: params.snsTopicArn,
          },
        },
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      this.log('error', 'Failed to add SNS event destination', { error, params });
      return false;
    }
  }

  // ============================================================================
  // SUPPRESSION LIST MANAGEMENT
  // ============================================================================

  /**
   * Get suppressed email destination
   */
  async getSuppressedDestination(email: string): Promise<SESSuppressedEmail | null> {
    try {
      if (!this.client) return null;

      const command = new GetSuppressedDestinationCommand({
        EmailAddress: email,
      });

      const response = await this.client.send(command);

      if (response.SuppressedDestination) {
        return {
          email: response.SuppressedDestination.EmailAddress || email,
          reason: response.SuppressedDestination.Reason as 'BOUNCE' | 'COMPLAINT',
        };
      }

      return null;
    } catch (error) {
      // Not found is expected for non-suppressed emails
      return null;
    }
  }

  /**
   * Add email to suppression list
   */
  async addToSuppressionList(email: string, reason: 'BOUNCE' | 'COMPLAINT'): Promise<boolean> {
    try {
      if (!this.client) return false;

      const command = new PutSuppressedDestinationCommand({
        EmailAddress: email,
        Reason: reason as SuppressionListReason,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      this.log('error', 'Failed to add to SES suppression list', { error, email });
      return false;
    }
  }

  /**
   * Remove email from suppression list
   */
  async removeFromSuppressionList(email: string): Promise<boolean> {
    try {
      if (!this.client) return false;

      const command = new DeleteSuppressedDestinationCommand({
        EmailAddress: email,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      this.log('error', 'Failed to remove from SES suppression list', { error, email });
      return false;
    }
  }

  /**
   * List suppressed destinations
   */
  async listSuppressedDestinations(params?: {
    reason?: 'BOUNCE' | 'COMPLAINT';
    startDate?: Date;
    endDate?: Date;
  }): Promise<SESSuppressedEmail[]> {
    try {
      if (!this.client) return [];

      const command = new ListSuppressedDestinationsCommand({
        Reasons: params?.reason ? [params.reason as SuppressionListReason] : undefined,
        StartDate: params?.startDate,
        EndDate: params?.endDate,
        PageSize: 100,
      });

      const response = await this.client.send(command);

      return (response.SuppressedDestinationSummaries || []).map(sd => ({
        email: sd.EmailAddress || '',
        reason: sd.Reason as 'BOUNCE' | 'COMPLAINT',
      }));
    } catch (error) {
      this.log('error', 'Failed to list SES suppressed destinations', { error });
      return [];
    }
  }

  // ============================================================================
  // WEBHOOK HANDLING
  // ============================================================================

  protected performWebhookVerification(payload: string, signature: string): boolean {
    // SNS message verification should be done using AWS SDK's SNS message validation
    // For now, basic validation - in production, use aws-sns-verify package
    try {
      const message = JSON.parse(payload);
      return !!(message.Type && message.MessageId);
    } catch {
      return false;
    }
  }

  protected performWebhookParsing(payload: unknown): WebhookEvent {
    const data = payload as Record<string, unknown>;

    // Handle SNS notification wrapper
    let notification: SESNotification;

    if (data.Type === 'Notification' && data.Message) {
      // SNS wrapped message
      notification = JSON.parse(data.Message as string);
    } else {
      notification = data as unknown as SESNotification;
    }

    let eventType = 'unknown';
    let recipient: string | undefined;

    if (notification.notificationType === 'Bounce') {
      eventType = notification.bounce?.bounceType === 'Permanent' ? 'email.hard_bounced' : 'email.soft_bounced';
      recipient = notification.bounce?.bouncedRecipients?.[0]?.emailAddress;
    } else if (notification.notificationType === 'Complaint') {
      eventType = 'email.complained';
      recipient = notification.complaint?.complainedRecipients?.[0]?.emailAddress;
    } else if (notification.notificationType === 'Delivery') {
      eventType = 'email.delivered';
      recipient = notification.delivery?.recipients?.[0];
    }

    return {
      eventType,
      timestamp: new Date(notification.mail.timestamp),
      messageId: notification.mail.messageId,
      recipient,
      data: notification as unknown as Record<string, unknown>,
    };
  }

  /**
   * Process SNS notification for bounces and complaints
   * Returns action to take (e.g., suppress email, log, etc.)
   */
  processNotification(notification: SESNotification): {
    action: 'suppress' | 'log' | 'ignore';
    email?: string;
    reason?: 'BOUNCE' | 'COMPLAINT';
    details?: Record<string, unknown>;
  } {
    if (notification.notificationType === 'Bounce') {
      const bounce = notification.bounce;
      if (bounce?.bounceType === 'Permanent') {
        // Hard bounce - should suppress
        return {
          action: 'suppress',
          email: bounce.bouncedRecipients?.[0]?.emailAddress,
          reason: 'BOUNCE',
          details: {
            bounceType: bounce.bounceType,
            bounceSubType: bounce.bounceSubType,
            diagnosticCode: bounce.bouncedRecipients?.[0]?.diagnosticCode,
          },
        };
      }
      // Soft bounce - just log
      return {
        action: 'log',
        details: {
          bounceType: bounce?.bounceType,
          bounceSubType: bounce?.bounceSubType,
        },
      };
    }

    if (notification.notificationType === 'Complaint') {
      // Complaints should always suppress
      return {
        action: 'suppress',
        email: notification.complaint?.complainedRecipients?.[0]?.emailAddress,
        reason: 'COMPLAINT',
        details: {
          complaintFeedbackType: notification.complaint?.complaintFeedbackType,
        },
      };
    }

    // Delivery notifications - just log
    return {
      action: 'log',
      details: {
        smtpResponse: notification.delivery?.smtpResponse,
        processingTimeMillis: notification.delivery?.processingTimeMillis,
      },
    };
  }
}

// Export singleton factory
let sesAdapterInstance: SESAdapter | null = null;

export function getSESAdapter(): SESAdapter {
  if (!sesAdapterInstance) {
    sesAdapterInstance = new SESAdapter();
  }
  return sesAdapterInstance;
}

export function createSESAdapter(): SESAdapter {
  return new SESAdapter();
}
