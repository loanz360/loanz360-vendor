/**
 * Custom SMTP Provider Adapter
 * Universal SMTP adapter for any SMTP server
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { BaseEmailProviderAdapter } from '../base-adapter';
import {
  EmailProviderType,
  ProviderCategory,
  ProviderCapabilities,
  SendEmailRequest,
  SendEmailResponse,
  HealthCheckResult,
} from '../types';

export class SMTPAdapter extends BaseEmailProviderAdapter {
  readonly providerName: EmailProviderType = 'custom_smtp';
  readonly providerType: ProviderCategory = 'smtp_relay';
  readonly capabilities: ProviderCapabilities = {
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
    supportsBulkSend: true,
    supportsScheduledSend: false,
    maxAttachmentSize: 25 * 1024 * 1024,
    maxRecipientsPerEmail: 100,
    maxEmailsPerBatch: 50,
    defaultRateLimitPerSecond: 10,
    defaultRateLimitPerMinute: 100,
    defaultRateLimitPerHour: 1000,
    defaultRateLimitPerDay: 10000,
  };

  private transporter: Transporter | null = null;

  protected async onInitialize(): Promise<void> {
    if (!this.credentials) return;

    this.transporter = nodemailer.createTransport({
      host: this.credentials.smtpHost,
      port: this.credentials.smtpPort,
      secure: this.credentials.smtpUseSsl,
      auth: {
        user: this.credentials.smtpUsername,
        pass: this.credentials.smtpPassword,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certs in development
      },
    });
  }

  protected async performCredentialValidation(): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.log('error', 'SMTP credential validation failed', { error });
      return false;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (!this.transporter) {
        return {
          healthy: false,
          status: 'down',
          message: 'SMTP transporter not initialized',
          checkedAt: new Date(),
        };
      }

      await this.transporter.verify();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        status: 'healthy',
        latencyMs,
        message: 'SMTP connection verified',
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'down',
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'SMTP health check failed',
        checkedAt: new Date(),
      };
    }
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    this.ensureInitialized();

    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP transporter not initialized',
        timestamp: new Date(),
      };
    }

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: request.from || this.credentials?.customConfig?.fromEmail as string,
        to: request.to.join(', '),
        cc: request.cc?.join(', '),
        bcc: request.bcc?.join(', '),
        replyTo: request.replyTo,
        subject: request.subject,
        text: request.bodyText,
        html: request.bodyHtml,
        headers: request.headers,
      };

      // Handle attachments
      if (request.attachments && request.attachments.length > 0) {
        mailOptions.attachments = request.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          cid: att.contentId,
          encoding: att.encoding,
        }));
      }

      const result = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId,
        providerMessageId: result.messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      this.log('error', 'Failed to send email via SMTP', { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
        errorCode: 'SMTP_SEND_ERROR',
        timestamp: new Date(),
      };
    }
  }

  async sendBulkEmail(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    // Send in parallel with concurrency limit
    const batchSize = 10;
    const results: SendEmailResponse[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(req => this.sendEmail(req)));
      results.push(...batchResults);
    }

    return results;
  }
}
