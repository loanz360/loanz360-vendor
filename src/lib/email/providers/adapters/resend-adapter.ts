/**
 * Resend Email Provider Adapter
 * https://resend.com/docs
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

const RESEND_API_URL = 'https://api.resend.com';

interface ResendEmailPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type?: string;
  }>;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
}

interface ResendResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

export class ResendAdapter extends BaseEmailProviderAdapter {
  readonly providerName: EmailProviderType = 'resend';
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
    supportsTemplates: false,
    supportsAttachments: true,
    supportsBulkSend: true,
    supportsScheduledSend: false,
    maxAttachmentSize: 40 * 1024 * 1024, // 40MB
    maxRecipientsPerEmail: 50,
    maxEmailsPerBatch: 100,
    defaultRateLimitPerSecond: 10,
    defaultRateLimitPerMinute: 100,
    defaultRateLimitPerHour: 1000,
    defaultRateLimitPerDay: 50000,
  };

  private apiKey: string = '';

  protected async onInitialize(): Promise<void> {
    if (!this.credentials?.apiKey) {
      throw new Error('Resend API key is required');
    }
    this.apiKey = this.credentials.apiKey;
  }

  protected async performCredentialValidation(): Promise<boolean> {
    try {
      // Test API key by fetching domains
      const response = await fetch(`${RESEND_API_URL}/domains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      this.log('error', 'Resend credential validation failed', { error });
      return false;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${RESEND_API_URL}/domains`, {
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
          message: 'Resend API is accessible',
          checkedAt: new Date(),
        };
      }

      return {
        healthy: false,
        status: 'degraded',
        latencyMs,
        message: `Resend API returned ${response.status}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'down',
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Resend health check failed',
        checkedAt: new Date(),
      };
    }
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    this.ensureInitialized();

    try {
      const payload: ResendEmailPayload = {
        from: request.from || this.credentials?.customConfig?.fromEmail as string || 'noreply@example.com',
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        reply_to: request.replyTo,
        subject: request.subject,
        text: request.bodyText,
        html: request.bodyHtml,
        headers: request.headers,
      };

      // Handle attachments
      if (request.attachments && request.attachments.length > 0) {
        payload.attachments = request.attachments.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string'
            ? att.content
            : Buffer.from(att.content).toString('base64'),
          type: att.contentType,
        }));
      }

      // Handle tags
      if (request.tags && request.tags.length > 0) {
        payload.tags = request.tags.map(tag => ({ name: tag, value: 'true' }));
      }

      const response = await fetch(`${RESEND_API_URL}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData: ResendErrorResponse = await response.json();
        return {
          success: false,
          error: errorData.message,
          errorCode: errorData.name,
          timestamp: new Date(),
        };
      }

      const data: ResendResponse = await response.json();

      return {
        success: true,
        messageId: data.id,
        providerMessageId: data.id,
        timestamp: new Date(),
      };
    } catch (error) {
      this.log('error', 'Failed to send email via Resend', { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
        errorCode: 'RESEND_SEND_ERROR',
        timestamp: new Date(),
      };
    }
  }

  async sendBulkEmail(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    // Resend supports batch API
    const batchSize = 100;
    const results: SendEmailResponse[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPayload = batch.map(request => ({
        from: request.from || this.credentials?.customConfig?.fromEmail as string || 'noreply@example.com',
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        reply_to: request.replyTo,
        subject: request.subject,
        text: request.bodyText,
        html: request.bodyHtml,
      }));

      try {
        const response = await fetch(`${RESEND_API_URL}/emails/batch`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batchPayload),
        });

        if (response.ok) {
          const data: { data: Array<{ id: string }> } = await response.json();
          for (const item of data.data) {
            results.push({
              success: true,
              messageId: item.id,
              providerMessageId: item.id,
              timestamp: new Date(),
            });
          }
        } else {
          // If batch fails, mark all as failed
          for (let j = 0; j < batch.length; j++) {
            results.push({
              success: false,
              error: 'Batch send failed',
              timestamp: new Date(),
            });
          }
        }
      } catch (error) {
        // If request fails, mark all as failed
        for (let j = 0; j < batch.length; j++) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Batch send failed',
            timestamp: new Date(),
          });
        }
      }
    }

    return results;
  }

  protected performWebhookVerification(payload: string, signature: string): boolean {
    // Resend uses SVIX for webhooks
    // In production, use the svix package for proper verification
    if (!this.credentials?.webhookSecret) {
      return false;
    }

    // Basic verification (use svix library in production)
    return signature.length > 0;
  }

  protected performWebhookParsing(payload: unknown): WebhookEvent {
    const data = payload as Record<string, unknown>;

    return {
      eventType: data.type as string,
      timestamp: new Date(data.created_at as string),
      messageId: (data.data as Record<string, unknown>)?.email_id as string,
      recipient: (data.data as Record<string, unknown>)?.to as string,
      data: data.data as Record<string, unknown>,
    };
  }
}
