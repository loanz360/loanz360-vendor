/**
 * SendGrid Email Provider Adapter
 * https://docs.sendgrid.com/api-reference
 */

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
import crypto from 'crypto';

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3';

interface SendGridPersonalization {
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  subject?: string;
  headers?: Record<string, string>;
  custom_args?: Record<string, string>;
  send_at?: number;
}

interface SendGridMailPayload {
  personalizations: SendGridPersonalization[];
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  subject: string;
  content: Array<{ type: string; value: string }>;
  attachments?: Array<{
    content: string;
    type: string;
    filename: string;
    disposition?: 'attachment' | 'inline';
    content_id?: string;
  }>;
  categories?: string[];
  custom_args?: Record<string, string>;
  tracking_settings?: {
    click_tracking?: { enable: boolean };
    open_tracking?: { enable: boolean };
  };
}

export class SendGridAdapter extends BaseEmailProviderAdapter {
  readonly providerName: EmailProviderType = 'sendgrid';
  readonly providerType: ProviderCategory = 'transactional';
  readonly capabilities: ProviderCapabilities = {
    canSendEmail: true,
    canReceiveEmail: false,
    canManageAccounts: false,
    canManageFolders: false,
    canSearchEmails: false,
    supportsOAuth: false,
    supportsWebhooks: true,
    supportsTracking: true,
    supportsTemplates: true,
    supportsAttachments: true,
    supportsBulkSend: true,
    supportsScheduledSend: true,
    maxAttachmentSize: 30 * 1024 * 1024, // 30MB
    maxRecipientsPerEmail: 1000,
    maxEmailsPerBatch: 1000,
    defaultRateLimitPerSecond: 100,
    defaultRateLimitPerMinute: 600,
    defaultRateLimitPerHour: 10000,
    defaultRateLimitPerDay: 100000,
  };

  private apiKey: string = '';

  protected async onInitialize(): Promise<void> {
    if (!this.credentials?.apiKey) {
      throw new Error('SendGrid API key is required');
    }
    this.apiKey = this.credentials.apiKey;
  }

  protected async performCredentialValidation(): Promise<boolean> {
    try {
      const response = await fetch(`${SENDGRID_API_URL}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      this.log('error', 'SendGrid credential validation failed', { error });
      return false;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${SENDGRID_API_URL}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          healthy: true,
          status: 'healthy',
          latencyMs,
          message: 'SendGrid API is accessible',
          checkedAt: new Date(),
        };
      }

      if (response.status === 429) {
        return {
          healthy: true,
          status: 'degraded',
          latencyMs,
          message: 'SendGrid rate limited',
          checkedAt: new Date(),
        };
      }

      return {
        healthy: false,
        status: 'down',
        latencyMs,
        message: `SendGrid API returned ${response.status}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'down',
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'SendGrid health check failed',
        checkedAt: new Date(),
      };
    }
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    this.ensureInitialized();

    try {
      const fromEmail = request.from || this.credentials?.customConfig?.fromEmail as string || 'noreply@example.com';

      const payload: SendGridMailPayload = {
        personalizations: [{
          to: request.to.map(email => ({ email })),
          cc: request.cc?.map(email => ({ email })),
          bcc: request.bcc?.map(email => ({ email })),
          headers: request.headers,
        }],
        from: {
          email: fromEmail,
          name: request.fromName || this.credentials?.customConfig?.fromName as string,
        },
        subject: request.subject,
        content: [],
        tracking_settings: {
          click_tracking: { enable: request.trackClicks !== false },
          open_tracking: { enable: request.trackOpens !== false },
        },
      };

      // Add reply-to
      if (request.replyTo) {
        payload.reply_to = { email: request.replyTo };
      }

      // Add content
      if (request.bodyText) {
        payload.content.push({ type: 'text/plain', value: request.bodyText });
      }
      if (request.bodyHtml) {
        payload.content.push({ type: 'text/html', value: request.bodyHtml });
      }

      // Handle attachments
      if (request.attachments && request.attachments.length > 0) {
        payload.attachments = request.attachments.map(att => ({
          content: typeof att.content === 'string'
            ? att.content
            : Buffer.from(att.content).toString('base64'),
          type: att.contentType,
          filename: att.filename,
          disposition: att.contentId ? 'inline' : 'attachment',
          content_id: att.contentId,
        }));
      }

      // Handle categories/tags
      if (request.tags && request.tags.length > 0) {
        payload.categories = request.tags;
      }

      // Handle scheduled send
      if (request.scheduledAt) {
        payload.personalizations[0].send_at = Math.floor(request.scheduledAt.getTime() / 1000);
      }

      const response = await fetch(`${SENDGRID_API_URL}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 202) {
        // SendGrid returns 202 Accepted for successful sends
        const messageId = response.headers.get('x-message-id');

        return {
          success: true,
          messageId: messageId || undefined,
          providerMessageId: messageId || undefined,
          timestamp: new Date(),
        };
      }

      const errorText = await response.text();
      let errorData: { errors?: Array<{ message: string }> } = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Not JSON
      }

      return {
        success: false,
        error: errorData.errors?.[0]?.message || errorText,
        errorCode: `HTTP_${response.status}`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.log('error', 'Failed to send email via SendGrid', { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
        errorCode: 'SENDGRID_SEND_ERROR',
        timestamp: new Date(),
      };
    }
  }

  async sendBulkEmail(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    // SendGrid supports multiple personalizations in a single request
    // but for simplicity and error isolation, we'll send in parallel batches
    const batchSize = 50;
    const results: SendEmailResponse[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(req => this.sendEmail(req)));
      results.push(...batchResults);
    }

    return results;
  }

  protected performWebhookVerification(payload: string, signature: string): boolean {
    if (!this.credentials?.webhookSecret) {
      return false;
    }

    // SendGrid uses HMAC-SHA256 for webhook verification
    const expectedSignature = crypto
      .createHmac('sha256', this.credentials.webhookSecret)
      .update(payload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  protected performWebhookParsing(payload: unknown): WebhookEvent {
    const events = payload as Array<Record<string, unknown>>;
    const event = events[0]; // SendGrid sends array of events

    return {
      eventType: event.event as string,
      timestamp: new Date((event.timestamp as number) * 1000),
      messageId: event.sg_message_id as string,
      recipient: event.email as string,
      data: event,
    };
  }
}
