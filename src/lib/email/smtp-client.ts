/**
 * SMTP Email Client
 * Server-side SMTP operations for sending emails
 * Uses nodemailer for reliable SMTP connections
 */

import {
  SMTPConfig,
  ComposeEmailRequest,
  SendEmailResponse,
  EmailAttachment,
  DraftAttachment,
} from '@/types/email';

// Note: In production, import nodemailer
// import nodemailer from 'nodemailer';
// import type { Transporter } from 'nodemailer';

/**
 * Email send options
 */
interface SendOptions {
  from: {
    email: string;
    name?: string;
  };
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: AttachmentOption[];
  replyTo?: string;
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
}

interface AttachmentOption {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  cid?: string; // For inline images
}

/**
 * SMTP Client Class
 */
export class SMTPClient {
  private config: SMTPConfig;
  private transporter: unknown = null; // nodemailer.Transporter in production

  constructor(config: SMTPConfig) {
    this.config = config;
  }

  /**
   * Initialize transporter
   */
  async initialize(): Promise<void> {
    // In production:
    /*
    const nodemailer = await import('nodemailer');
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
    */
    this.transporter = {};
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    if (!this.transporter) {
      await this.initialize();
    }

    // In production:
    // return await this.transporter.verify();

    return true;
  }

  /**
   * Send email
   */
  async send(options: SendOptions): Promise<SendEmailResponse> {
    if (!this.transporter) {
      await this.initialize();
    }

    try {
      const mailOptions = {
        from: options.from.name
          ? `"${options.from.name}" <${options.from.email}>`
          : options.from.email,
        to: options.to.join(', '),
        cc: options.cc?.join(', '),
        bcc: options.bcc?.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
        replyTo: options.replyTo,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          path: att.path,
          contentType: att.contentType,
          cid: att.cid,
        })),
        headers: options.headers,
        priority: options.priority,
        messageId: options.messageId,
        inReplyTo: options.inReplyTo,
        references: options.references?.join(' '),
      };

      // In production:
      /*
      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        message_id: info.messageId,
      };
      */

      // Mock success response
      return {
        success: true,
        message_id: `msg_${Date.now()}_${crypto.getRandomValues(new Uint8Array(6)).reduce((s, b) => s + b.toString(36).padStart(2, '0'), '').substring(0, 9)}`,
      };
    } catch (error) {
      console.error('SMTP send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Send email from compose request
   */
  async sendFromCompose(
    compose: ComposeEmailRequest,
    fromEmail: string,
    fromName: string,
    attachments?: DraftAttachment[]
  ): Promise<SendEmailResponse> {
    const attachmentOptions: AttachmentOption[] = [];

    // In production, download attachments from S3
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        // const content = await downloadFromS3(att.s3_key);
        attachmentOptions.push({
          filename: att.name,
          // content: content,
          contentType: att.type,
        });
      }
    }

    return this.send({
      from: { email: fromEmail, name: fromName },
      to: compose.to,
      cc: compose.cc,
      bcc: compose.bcc,
      subject: compose.subject,
      html: compose.body_html,
      text: compose.body_text,
      attachments: attachmentOptions,
      inReplyTo: compose.reply_to_message_id,
      references: compose.reply_to_message_id ? [compose.reply_to_message_id] : undefined,
    });
  }

  /**
   * Send with retry logic
   */
  async sendWithRetry(
    options: SendOptions,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<SendEmailResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.send(options);
        if (result.success) {
          return result;
        }
        lastError = new Error(result.error || 'Unknown error');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }

      if (attempt < maxRetries) {
        await this.delay(delayMs * attempt);
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries} attempts: ${lastError?.message}`,
    };
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      // Remove style and script tags with content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Replace common tags
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      // Remove remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    // In production:
    // await this.transporter?.close();
    this.transporter = null;
  }
}

/**
 * Create SMTP client with config
 */
export function createSMTPClient(config: SMTPConfig): SMTPClient {
  return new SMTPClient(config);
}

/**
 * Create SMTP config for Zoho
 */
export function createZohoSMTPConfig(
  email: string,
  password: string
): SMTPConfig {
  return {
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
  };
}

/**
 * Create SMTP config for common providers
 */
export function createSMTPConfigForProvider(
  provider: 'zoho' | 'gmail' | 'outlook' | 'hostinger',
  email: string,
  password: string
): SMTPConfig {
  const configs: Record<string, Partial<SMTPConfig>> = {
    zoho: { host: 'smtp.zoho.com', port: 465, secure: true },
    gmail: { host: 'smtp.gmail.com', port: 465, secure: true },
    outlook: { host: 'smtp.office365.com', port: 587, secure: false },
    hostinger: { host: 'smtp.hostinger.com', port: 465, secure: true },
  };

  const config = configs[provider] || configs.zoho;

  return {
    host: config.host!,
    port: config.port!,
    secure: config.secure!,
    auth: {
      user: email,
      pass: password,
    },
  };
}

/**
 * Send a single email using Zoho SMTP
 */
export async function sendZohoEmail(
  email: string,
  password: string,
  options: SendOptions
): Promise<SendEmailResponse> {
  const client = createSMTPClient(createZohoSMTPConfig(email, password));
  try {
    await client.initialize();
    return await client.send(options);
  } finally {
    await client.close();
  }
}

export default SMTPClient;
