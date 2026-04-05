// Email Provider Factory

import { BaseEmailProvider, EmailProviderConfig, EmailMessage, EmailResponse } from './types'

// Resend Provider
class ResendProvider extends BaseEmailProvider {
  constructor(config: EmailProviderConfig) {
    super('resend', 'Resend', config)
  }

  async sendEmail(message: EmailMessage): Promise<EmailResponse> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: message.from || `${this.config.from_name} <${this.config.from_email}>`,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        cc: message.cc,
        bcc: message.bcc,
        reply_to: message.reply_to
      })
    })
    const data = await response.json()
    return { success: !!data.id, message_id: data.id, provider_response: data }
  }

  async sendBulkEmail(messages: EmailMessage[]): Promise<EmailResponse[]> {
    return Promise.all(messages.map(m => this.sendEmail(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'sent' as const }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/domains', {
        headers: { 'Authorization': `Bearer ${this.config.api_key}` }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// SendGrid Provider
class SendGridProvider extends BaseEmailProvider {
  constructor(config: EmailProviderConfig) {
    super('sendgrid', 'SendGrid', config)
  }

  async sendEmail(message: EmailMessage): Promise<EmailResponse> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: (Array.isArray(message.to) ? message.to : [message.to]).map(e => ({ email: e })),
          cc: message.cc?.map(e => ({ email: e })),
          bcc: message.bcc?.map(e => ({ email: e }))
        }],
        from: { email: this.config.from_email, name: this.config.from_name },
        subject: message.subject,
        content: [
          ...(message.text ? [{ type: 'text/plain', value: message.text }] : []),
          ...(message.html ? [{ type: 'text/html', value: message.html }] : [])
        ]
      })
    })
    const messageId = response.headers.get('X-Message-Id') || ''
    return { success: response.ok, message_id: messageId }
  }

  async sendBulkEmail(messages: EmailMessage[]): Promise<EmailResponse[]> {
    return Promise.all(messages.map(m => this.sendEmail(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'sent' as const }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: { 'Authorization': `Bearer ${this.config.api_key}` }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// AWS SES Provider
class AWSSESProvider extends BaseEmailProvider {
  constructor(config: EmailProviderConfig) {
    super('aws_ses', 'AWS SES', config)
  }

  async sendEmail(message: EmailMessage): Promise<EmailResponse> {
    // Simplified - in production use AWS SDK
    const region = this.config.region || 'us-east-1'
    const endpoint = `https://email.${region}.amazonaws.com`

    // This is a simplified implementation
    // Production should use proper AWS signature
    return {
      success: false,
      error: 'AWS SES requires AWS SDK for proper authentication'
    }
  }

  async sendBulkEmail(messages: EmailMessage[]): Promise<EmailResponse[]> {
    return Promise.all(messages.map(m => this.sendEmail(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'sent' as const }
  }

  async validateCredentials(): Promise<boolean> {
    return !!this.config.api_key && !!this.config.api_secret
  }
}

// Mailgun Provider
class MailgunProvider extends BaseEmailProvider {
  constructor(config: EmailProviderConfig) {
    super('mailgun', 'Mailgun', config)
  }

  async sendEmail(message: EmailMessage): Promise<EmailResponse> {
    const domain = this.config.domain
    const formData = new FormData()
    formData.append('from', message.from || `${this.config.from_name} <${this.config.from_email}>`)
    formData.append('to', Array.isArray(message.to) ? message.to.join(',') : message.to)
    formData.append('subject', message.subject)
    if (message.html) formData.append('html', message.html)
    if (message.text) formData.append('text', message.text)

    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${this.config.api_key}`).toString('base64')}`
      },
      body: formData
    })
    const data = await response.json()
    return { success: !!data.id, message_id: data.id, provider_response: data }
  }

  async sendBulkEmail(messages: EmailMessage[]): Promise<EmailResponse[]> {
    return Promise.all(messages.map(m => this.sendEmail(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'sent' as const }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`https://api.mailgun.net/v3/domains`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.config.api_key}`).toString('base64')}`
        }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Postmark Provider
class PostmarkProvider extends BaseEmailProvider {
  constructor(config: EmailProviderConfig) {
    super('postmark', 'Postmark', config)
  }

  async sendEmail(message: EmailMessage): Promise<EmailResponse> {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.config.api_key || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        From: message.from || `${this.config.from_name} <${this.config.from_email}>`,
        To: Array.isArray(message.to) ? message.to.join(',') : message.to,
        Subject: message.subject,
        HtmlBody: message.html,
        TextBody: message.text,
        Cc: message.cc?.join(','),
        Bcc: message.bcc?.join(','),
        ReplyTo: message.reply_to
      })
    })
    const data = await response.json()
    return { success: !!data.MessageID, message_id: data.MessageID, provider_response: data }
  }

  async sendBulkEmail(messages: EmailMessage[]): Promise<EmailResponse[]> {
    return Promise.all(messages.map(m => this.sendEmail(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'sent' as const }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch('https://api.postmarkapp.com/server', {
        headers: { 'X-Postmark-Server-Token': this.config.api_key || '' }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// SMTP Provider (using nodemailer in production)
class SMTPProvider extends BaseEmailProvider {
  constructor(config: EmailProviderConfig) {
    super('smtp', 'SMTP', config)
  }

  async sendEmail(message: EmailMessage): Promise<EmailResponse> {
    // In production, use nodemailer
    return {
      success: false,
      error: 'SMTP requires nodemailer package for sending emails'
    }
  }

  async sendBulkEmail(messages: EmailMessage[]): Promise<EmailResponse[]> {
    return Promise.all(messages.map(m => this.sendEmail(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'sent' as const }
  }

  async validateCredentials(): Promise<boolean> {
    return !!this.config.host && !!this.config.username
  }
}

// Provider factory
export function createEmailProvider(
  providerName: string,
  config: EmailProviderConfig
): BaseEmailProvider {
  switch (providerName.toLowerCase()) {
    case 'resend':
      return new ResendProvider(config)
    case 'sendgrid':
      return new SendGridProvider(config)
    case 'aws_ses':
    case 'ses':
      return new AWSSESProvider(config)
    case 'mailgun':
      return new MailgunProvider(config)
    case 'postmark':
      return new PostmarkProvider(config)
    case 'smtp':
      return new SMTPProvider(config)
    default:
      throw new Error(`Unknown email provider: ${providerName}`)
  }
}

export const SUPPORTED_EMAIL_PROVIDERS = [
  { id: 'resend', name: 'Resend', type: 'API' },
  { id: 'sendgrid', name: 'SendGrid', type: 'API' },
  { id: 'aws_ses', name: 'AWS SES', type: 'API' },
  { id: 'mailgun', name: 'Mailgun', type: 'API' },
  { id: 'postmark', name: 'Postmark', type: 'API' },
  { id: 'smtp', name: 'SMTP Server', type: 'SMTP' }
]

export * from './types'
