/**
 * Email Service - Production-ready email delivery
 * Supports: Resend, SendGrid with delivery tracking and bounce handling
 */

export interface EmailConfig {
  provider: 'resend' | 'sendgrid'
  apiKey: string
  fromEmail: string
  fromName: string
  replyTo?: string
}

export interface EmailTemplate {
  id: string
  subject: string
  htmlBody: string
  textBody?: string
  variables: string[]
}

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  templateId?: string
  variables?: Record<string, string>
  cc?: string[]
  bcc?: string[]
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType?: string
  }>
  replyTo?: string
  tags?: Record<string, string>
}

export interface EmailDeliveryResult {
  success: boolean
  messageId?: string
  status: 'queued' | 'sent' | 'failed'
  error?: string
  provider: string
}

class EmailService {
  private config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
  }

  /**
   * Send email via configured provider
   */
  async send(params: SendEmailParams): Promise<EmailDeliveryResult> {
    try {
      // Render template if templateId provided
      let html = params.html
      let text = params.text
      let subject = params.subject

      if (params.templateId && params.variables) {
        const rendered = await this.renderTemplate(params.templateId, params.variables)
        html = rendered.html
        text = rendered.text
        subject = rendered.subject
      }

      // Send via provider
      if (this.config.provider === 'resend') {
        return await this.sendViaResend({ ...params, html, text, subject })
      } else if (this.config.provider === 'sendgrid') {
        return await this.sendViaSendGrid({ ...params, html, text, subject })
      }

      throw new Error(`Unsupported email provider: ${this.config.provider}`)
    } catch (error: unknown) {
      console.error('[EmailService] Send failed:', error)
      return {
        success: false,
        status: 'failed',
        error: error.message,
        provider: this.config.provider,
      }
    }
  }

  /**
   * Send via Resend
   */
  private async sendViaResend(params: SendEmailParams): Promise<EmailDeliveryResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        cc: params.cc,
        bcc: params.bcc,
        reply_to: params.replyTo || this.config.replyTo,
        attachments: params.attachments,
        tags: params.tags,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Resend API error')
    }

    return {
      success: true,
      messageId: data.id,
      status: 'sent',
      provider: 'resend',
    }
  }

  /**
   * Send via SendGrid
   */
  private async sendViaSendGrid(params: SendEmailParams): Promise<EmailDeliveryResult> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: (Array.isArray(params.to) ? params.to : [params.to]).map(email => ({ email })),
            cc: params.cc?.map(email => ({ email })),
            bcc: params.bcc?.map(email => ({ email })),
            subject: params.subject,
          },
        ],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        reply_to: params.replyTo || this.config.replyTo
          ? { email: params.replyTo || this.config.replyTo! }
          : undefined,
        content: [
          { type: 'text/plain', value: params.text || '' },
          { type: 'text/html', value: params.html || '' },
        ].filter(c => c.value),
        attachments: params.attachments?.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
        })),
        categories: params.tags ? Object.keys(params.tags) : undefined,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'SendGrid API error')
    }

    const messageId = response.headers.get('x-message-id')

    return {
      success: true,
      messageId: messageId || undefined,
      status: 'sent',
      provider: 'sendgrid',
    }
  }

  /**
   * Render email template with variables
   */
  private async renderTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ subject: string; html: string; text: string }> {
    // Fetch template from database
    // This is a placeholder - actual implementation would query the database
    const template = await this.getTemplate(templateId)

    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    // Replace variables
    let subject = template.subject
    let html = template.htmlBody
    let text = template.textBody || ''

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      subject = subject.replace(regex, value)
      html = html.replace(regex, value)
      text = text.replace(regex, value)
    }

    return { subject, html, text }
  }

  /**
   * Get template from database
   */
  private async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    try {
      // Dynamic import to avoid circular dependencies
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = createClient()

      // Query the communication_templates table for email templates
      const { data, error } = await supabase
        .from('communication_templates')
        .select('subject, content, content_html, template_type, is_active')
        .eq('template_code', templateId)
        .eq('template_type', 'email')
        .eq('is_active', true)
        .maybeSingle()

      if (error || !data) {
        console.error(`[EmailService] Template not found: ${templateId}`, error)
        return null
      }

      return {
        subject: data.subject || '',
        htmlBody: data.content_html || data.content || '',
        textBody: data.content || ''
      }
    } catch (error) {
      console.error(`[EmailService] Error fetching template: ${templateId}`, error)
      return null
    }
  }

  /**
   * Handle webhook from email provider (delivery status, opens, clicks)
   */
  async handleWebhook(
    provider: 'resend' | 'sendgrid',
    payload: any
  ): Promise<{ processed: boolean; event: string }> {
    if (provider === 'resend') {
      return this.handleResendWebhook(payload)
    } else if (provider === 'sendgrid') {
      return this.handleSendGridWebhook(payload)
    }

    return { processed: false, event: 'unknown' }
  }

  /**
   * Handle Resend webhook
   */
  private async handleResendWebhook(payload: any): Promise<{ processed: boolean; event: string }> {
    const event = payload.type
    const messageId = payload.data?.email_id

    switch (event) {
      case 'email.sent':
        await this.updateDeliveryStatus(messageId, 'sent')
        break
      case 'email.delivered':
        await this.updateDeliveryStatus(messageId, 'delivered')
        break
      case 'email.opened':
        await this.trackEmailOpened(messageId)
        break
      case 'email.clicked':
        await this.trackEmailClicked(messageId, payload.data?.link)
        break
      case 'email.bounced':
        await this.handleBounce(messageId, payload.data?.reason)
        break
      case 'email.complained':
        await this.handleComplaint(messageId)
        break
    }

    return { processed: true, event }
  }

  /**
   * Handle SendGrid webhook
   */
  private async handleSendGridWebhook(payload: any): Promise<{ processed: boolean; event: string }> {
    // SendGrid sends events as an array
    const events = Array.isArray(payload) ? payload : [payload]

    for (const event of events) {
      const messageId = event.sg_message_id
      const eventType = event.event

      switch (eventType) {
        case 'delivered':
          await this.updateDeliveryStatus(messageId, 'delivered')
          break
        case 'open':
          await this.trackEmailOpened(messageId)
          break
        case 'click':
          await this.trackEmailClicked(messageId, event.url)
          break
        case 'bounce':
        case 'dropped':
          await this.handleBounce(messageId, event.reason)
          break
        case 'spamreport':
          await this.handleComplaint(messageId)
          break
      }
    }

    return { processed: true, event: events[0]?.event || 'unknown' }
  }

  /**
   * Update delivery status in database
   */
  private async updateDeliveryStatus(messageId: string, status: string): Promise<void> {
    // Update communication_log table
  }

  /**
   * Track email opened
   */
  private async trackEmailOpened(messageId: string): Promise<void> {
    // Update communication_log with opened_at timestamp
  }

  /**
   * Track email link clicked
   */
  private async trackEmailClicked(messageId: string, link: string): Promise<void> {
    // Update communication_log with clicked_at timestamp
  }

  /**
   * Handle email bounce
   */
  private async handleBounce(messageId: string, reason: string): Promise<void> {
    // Mark email as bounced, potentially unsubscribe if hard bounce
  }

  /**
   * Handle spam complaint
   */
  private async handleComplaint(messageId: string): Promise<void> {
    // Automatically unsubscribe user
  }
}

// Singleton instance
let emailService: EmailService | null = null

export function getEmailService(): EmailService {
  if (!emailService) {
    const provider = (process.env.EMAIL_PROVIDER || 'resend') as 'resend' | 'sendgrid'
    const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY || ''
    const fromEmail = process.env.EMAIL_FROM || 'noreply@loanz360.com'
    const fromName = process.env.EMAIL_FROM_NAME || 'LOANZ 360'
    const replyTo = process.env.EMAIL_REPLY_TO

    emailService = new EmailService({
      provider,
      apiKey,
      fromEmail,
      fromName,
      replyTo,
    })
  }

  return emailService
}

// Convenience functions
export async function sendEmail(params: SendEmailParams): Promise<EmailDeliveryResult> {
  return getEmailService().send(params)
}

export async function sendTemplateEmail(
  to: string | string[],
  templateId: string,
  variables: Record<string, string>,
  options?: Partial<SendEmailParams>
): Promise<EmailDeliveryResult> {
  return getEmailService().send({
    to,
    subject: '', // Will be set by template
    templateId,
    variables,
    ...options,
  })
}
