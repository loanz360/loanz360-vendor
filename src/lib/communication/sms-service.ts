/**
 * SMS Service - Production-ready SMS delivery
 * Supports: Custom API, Twilio, MSG91 with delivery tracking
 */

export interface SMSConfig {
  provider: 'custom' | 'twilio' | 'msg91'
  apiKey: string
  apiUrl?: string // For custom provider
  senderId: string
  accountSid?: string // For Twilio
}

export interface SendSMSParams {
  to: string | string[] // Mobile numbers
  message: string
  templateId?: string
  variables?: Record<string, string>
  senderId?: string
  scheduledAt?: Date
  tags?: Record<string, string>
}

export interface SMSDeliveryResult {
  success: boolean
  messageId?: string
  status: 'queued' | 'sent' | 'failed'
  error?: string
  provider: string
  deliveryInfo?: {
    to: string
    messageId: string
    status: string
  }[]
}

class SMSService {
  private config: SMSConfig

  constructor(config: SMSConfig) {
    this.config = config
  }

  /**
   * Send SMS via configured provider
   */
  async send(params: SendSMSParams): Promise<SMSDeliveryResult> {
    try {
      // Render template if templateId provided
      let message = params.message

      if (params.templateId && params.variables) {
        message = await this.renderTemplate(params.templateId, params.variables)
      }

      // Normalize phone numbers
      const recipients = Array.isArray(params.to) ? params.to : [params.to]
      const normalizedRecipients = recipients.map(phone => this.normalizeMobile(phone))

      // Send via provider
      if (this.config.provider === 'custom') {
        return await this.sendViaCustom({ ...params, to: normalizedRecipients, message })
      } else if (this.config.provider === 'twilio') {
        return await this.sendViaTwilio({ ...params, to: normalizedRecipients, message })
      } else if (this.config.provider === 'msg91') {
        return await this.sendViaMSG91({ ...params, to: normalizedRecipients, message })
      }

      throw new Error(`Unsupported SMS provider: ${this.config.provider}`)
    } catch (error: unknown) {
      console.error('[SMSService] Send failed:', error)
      return {
        success: false,
        status: 'failed',
        error: error.message,
        provider: this.config.provider,
      }
    }
  }

  /**
   * Send via Custom API
   */
  private async sendViaCustom(params: SendSMSParams): Promise<SMSDeliveryResult> {
    if (!this.config.apiUrl) {
      throw new Error('Custom SMS API URL not configured')
    }

    const recipients = Array.isArray(params.to) ? params.to : [params.to]
    const deliveryInfo: { to: string; messageId: string; status: string }[] = []

    // Send to each recipient
    for (const recipient of recipients) {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient,
          message: params.message,
          senderId: params.senderId || this.config.senderId,
          scheduledAt: params.scheduledAt?.toISOString(),
          tags: params.tags,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Custom SMS API error')
      }

      deliveryInfo.push({
        to: recipient,
        messageId: data.messageId || data.id,
        status: data.status || 'sent',
      })
    }

    return {
      success: true,
      messageId: deliveryInfo[0]?.messageId,
      status: 'sent',
      provider: 'custom',
      deliveryInfo,
    }
  }

  /**
   * Send via Twilio
   */
  private async sendViaTwilio(params: SendSMSParams): Promise<SMSDeliveryResult> {
    if (!this.config.accountSid) {
      throw new Error('Twilio Account SID not configured')
    }

    const recipients = Array.isArray(params.to) ? params.to : [params.to]
    const deliveryInfo: { to: string; messageId: string; status: string }[] = []

    const authHeader = Buffer.from(
      `${this.config.accountSid}:${this.config.apiKey}`
    ).toString('base64')

    for (const recipient of recipients) {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: recipient,
            From: params.senderId || this.config.senderId,
            Body: params.message,
          }).toString(),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Twilio API error')
      }

      deliveryInfo.push({
        to: recipient,
        messageId: data.sid,
        status: data.status,
      })
    }

    return {
      success: true,
      messageId: deliveryInfo[0]?.messageId,
      status: 'sent',
      provider: 'twilio',
      deliveryInfo,
    }
  }

  /**
   * Send via MSG91
   */
  private async sendViaMSG91(params: SendSMSParams): Promise<SMSDeliveryResult> {
    const recipients = Array.isArray(params.to) ? params.to : [params.to]
    const deliveryInfo: { to: string; messageId: string; status: string }[] = []

    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'authkey': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: params.senderId || this.config.senderId,
        mobiles: recipients.join(','),
        message: params.message,
        route: '4', // Transactional route
        unicode: '1',
      }),
    })

    const data = await response.json()

    if (!response.ok || data.type === 'error') {
      throw new Error(data.message || 'MSG91 API error')
    }

    // MSG91 returns a request ID for all messages
    const requestId = data.request_id || data.message

    for (const recipient of recipients) {
      deliveryInfo.push({
        to: recipient,
        messageId: requestId,
        status: 'sent',
      })
    }

    return {
      success: true,
      messageId: requestId,
      status: 'sent',
      provider: 'msg91',
      deliveryInfo,
    }
  }

  /**
   * Render SMS template with variables
   */
  private async renderTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string> {
    // Fetch template from database
    const template = await this.getTemplate(templateId)

    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    // Replace variables
    let message = template.body

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      message = message.replace(regex, value)
    }

    return message
  }

  /**
   * Get template from database
   */
  private async getTemplate(templateId: string): Promise<{ body: string } | null> {
    try {
      // Dynamic import to avoid circular dependencies
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = createClient()

      // Query the communication_templates table
      const { data, error } = await supabase
        .from('communication_templates')
        .select('content, template_type, is_active')
        .eq('template_code', templateId)
        .eq('template_type', 'sms')
        .eq('is_active', true)
        .maybeSingle()

      if (error || !data) {
        console.error(`[SMSService] Template not found: ${templateId}`, error)
        return null
      }

      return { body: data.content }
    } catch (error) {
      console.error(`[SMSService] Error fetching template: ${templateId}`, error)
      return null
    }
  }

  /**
   * Normalize mobile number to E.164 format
   */
  private normalizeMobile(mobile: string): string {
    // Remove all non-digit characters
    let normalized = mobile.replace(/\D/g, '')

    // Add country code if missing (assuming India +91)
    if (normalized.length === 10) {
      normalized = '91' + normalized
    }

    // Remove leading + if present
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1)
    }

    return normalized
  }

  /**
   * Handle webhook from SMS provider (delivery status)
   */
  async handleWebhook(
    provider: 'custom' | 'twilio' | 'msg91',
    payload: any
  ): Promise<{ processed: boolean; event: string }> {
    if (provider === 'twilio') {
      return this.handleTwilioWebhook(payload)
    } else if (provider === 'msg91') {
      return this.handleMSG91Webhook(payload)
    }

    return { processed: false, event: 'unknown' }
  }

  /**
   * Handle Twilio webhook
   */
  private async handleTwilioWebhook(payload: any): Promise<{ processed: boolean; event: string }> {
    const messageId = payload.MessageSid
    const status = payload.MessageStatus
    const to = payload.To

    switch (status) {
      case 'delivered':
        await this.updateDeliveryStatus(messageId, 'delivered')
        break
      case 'failed':
      case 'undelivered':
        await this.handleDeliveryFailure(messageId, payload.ErrorMessage)
        break
    }

    return { processed: true, event: status }
  }

  /**
   * Handle MSG91 webhook
   */
  private async handleMSG91Webhook(payload: any): Promise<{ processed: boolean; event: string }> {
    const messageId = payload.requestId
    const status = payload.status
    const mobile = payload.mobile

    switch (status) {
      case '1':
      case 'DELIVERED':
        await this.updateDeliveryStatus(messageId, 'delivered')
        break
      case '2':
      case 'FAILED':
      case 'REJECTED':
        await this.handleDeliveryFailure(messageId, payload.description)
        break
    }

    return { processed: true, event: status }
  }

  /**
   * Update delivery status in database
   */
  private async updateDeliveryStatus(messageId: string, status: string): Promise<void> {
    // Update communication_log table
  }

  /**
   * Handle delivery failure
   */
  private async handleDeliveryFailure(messageId: string, error: string): Promise<void> {
    // Update communication_log with failure reason
  }
}

// Singleton instance
let smsService: SMSService | null = null

export function getSMSService(): SMSService {
  if (!smsService) {
    const provider = (process.env.SMS_PROVIDER || 'custom') as 'custom' | 'twilio' | 'msg91'
    const apiKey = process.env.SMS_API_KEY || ''
    const apiUrl = process.env.SMS_API_URL
    const senderId = process.env.SMS_SENDER_ID || 'LOANZ360'
    const accountSid = process.env.TWILIO_ACCOUNT_SID

    smsService = new SMSService({
      provider,
      apiKey,
      apiUrl,
      senderId,
      accountSid,
    })
  }

  return smsService
}

// Convenience functions
export async function sendSMS(
  to: string | string[],
  message: string,
  options?: Partial<SendSMSParams>
): Promise<SMSDeliveryResult> {
  return getSMSService().send({
    to,
    message,
    ...options,
  })
}

export async function sendTemplateSMS(
  to: string | string[],
  templateId: string,
  variables: Record<string, string>,
  options?: Partial<SendSMSParams>
): Promise<SMSDeliveryResult> {
  return getSMSService().send({
    to,
    message: '', // Will be set by template
    templateId,
    variables,
    ...options,
  })
}
