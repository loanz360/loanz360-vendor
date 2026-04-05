/**
 * WhatsApp Business API Provider
 *
 * Supports: Text messages, Media, Interactive buttons, Templates
 * API: Meta WhatsApp Cloud API v18.0
 *
 * Features:
 * - Send text messages
 * - Send template messages (pre-approved)
 * - Send interactive messages with buttons
 * - Send media (images, documents, videos)
 * - Handle delivery status webhooks
 */

import { createClient } from '@/lib/supabase/client'

// =====================================================
// TYPES
// =====================================================

export interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  apiVersion: string
  businessAccountId?: string
}

export interface SendWhatsAppTextParams {
  to: string
  message: string
  previewUrl?: boolean
}

export interface SendWhatsAppTemplateParams {
  to: string
  templateName: string
  languageCode?: string
  components?: TemplateComponent[]
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button'
  parameters: TemplateParameter[]
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document'
  text?: string
  currency?: { fallback_value: string; code: string; amount_1000: number }
  date_time?: { fallback_value: string }
  image?: { link: string }
  document?: { link: string; filename: string }
}

export interface SendWhatsAppInteractiveParams {
  to: string
  type: 'button' | 'list'
  header?: string
  body: string
  footer?: string
  buttons?: Array<{ id: string; title: string }>
  listSections?: Array<{
    title: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>
}

export interface SendWhatsAppMediaParams {
  to: string
  type: 'image' | 'document' | 'video' | 'audio'
  mediaUrl: string
  caption?: string
  filename?: string
}

export interface WhatsAppResponse {
  success: boolean
  messageId?: string
  status?: string
  error?: string
  errorCode?: number
  errorMessage?: string
}

// =====================================================
// WHATSAPP PROVIDER CLASS
// =====================================================

export class WhatsAppProvider {
  private config: WhatsAppConfig
  private baseUrl: string
  private supabase = createClient()

  constructor(config: WhatsAppConfig) {
    this.config = config
    this.baseUrl = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`
  }

  /**
   * Send WhatsApp text message
   */
  async sendText(params: SendWhatsAppTextParams): Promise<WhatsAppResponse> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(params.to)

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'text',
          text: {
            preview_url: params.previewUrl ?? false,
            body: params.message
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return this.handleError(data)
      }

      const result = {
        success: true,
        messageId: data.messages[0].id,
        status: 'sent'
      }

      // Log to database
      await this.logDelivery({
        recipient: normalizedPhone,
        message: params.message,
        response: result
      })

      return result
    } catch (error) {
      console.error('WhatsApp send text error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp send failed'
      }
    }
  }

  /**
   * Send WhatsApp template message (pre-approved)
   */
  async sendTemplate(params: SendWhatsAppTemplateParams): Promise<WhatsAppResponse> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(params.to)

      const payload: any = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: params.templateName,
          language: {
            code: params.languageCode || 'en'
          }
        }
      }

      if (params.components && params.components.length > 0) {
        payload.template.components = params.components
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        return this.handleError(data)
      }

      const result = {
        success: true,
        messageId: data.messages[0].id,
        status: 'sent'
      }

      await this.logDelivery({
        recipient: normalizedPhone,
        message: `Template: ${params.templateName}`,
        response: result
      })

      return result
    } catch (error) {
      console.error('WhatsApp send template error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Template send failed'
      }
    }
  }

  /**
   * Send interactive message with buttons or list
   */
  async sendInteractive(params: SendWhatsAppInteractiveParams): Promise<WhatsAppResponse> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(params.to)

      const interactive: any = {
        type: params.type,
        body: { text: params.body }
      }

      if (params.header) {
        interactive.header = { type: 'text', text: params.header }
      }

      if (params.footer) {
        interactive.footer = { text: params.footer }
      }

      if (params.type === 'button' && params.buttons) {
        interactive.action = {
          buttons: params.buttons.map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
          }))
        }
      }

      if (params.type === 'list' && params.listSections) {
        interactive.action = {
          button: 'View Options',
          sections: params.listSections
        }
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'interactive',
          interactive
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return this.handleError(data)
      }

      const result = {
        success: true,
        messageId: data.messages[0].id,
        status: 'sent'
      }

      await this.logDelivery({
        recipient: normalizedPhone,
        message: params.body,
        response: result
      })

      return result
    } catch (error) {
      console.error('WhatsApp send interactive error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Interactive send failed'
      }
    }
  }

  /**
   * Send media (image, document, video, audio)
   */
  async sendMedia(params: SendWhatsAppMediaParams): Promise<WhatsAppResponse> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(params.to)

      const mediaObject: any = {
        link: params.mediaUrl
      }

      if (params.caption) {
        mediaObject.caption = params.caption
      }

      if (params.filename && params.type === 'document') {
        mediaObject.filename = params.filename
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: params.type,
          [params.type]: mediaObject
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return this.handleError(data)
      }

      return {
        success: true,
        messageId: data.messages[0].id,
        status: 'sent'
      }
    } catch (error) {
      console.error('WhatsApp send media error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Media send failed'
      }
    }
  }

  /**
   * Handle WhatsApp webhook
   */
  static async handleWebhook(body: any) {
    try {
      const entry = body.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value

      if (!value) return

      // Handle status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          await WhatsAppProvider.updateDeliveryStatus(status.id, status.status)
        }
      }

      // Handle incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          await WhatsAppProvider.handleIncomingMessage(message)
        }
      }
    } catch (error) {
      console.error('WhatsApp webhook error:', error)
    }
  }

  /**
   * Update delivery status in database
   */
  private static async updateDeliveryStatus(messageId: string, status: string) {
    const supabase = createClient()

    const statusMap: Record<string, string> = {
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'delivered',
      'failed': 'failed'
    }

    await supabase
      .from('communication_delivery_log')
      .update({
        status: statusMap[status] || 'sent',
        delivered_at: status === 'delivered' || status === 'read' ? new Date().toISOString() : null,
        failed_at: status === 'failed' ? new Date().toISOString() : null
      })
      .eq('provider_transaction_id', messageId)
  }

  /**
   * Handle incoming message (for future chatbot integration)
   */
  private static async handleIncomingMessage(message: any) {
    console.log('Incoming WhatsApp message:', {
      from: message.from,
      type: message.type,
      timestamp: message.timestamp
    })
    // Future: Store for chatbot processing
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Normalize phone number (remove + and ensure country code)
   */
  private normalizePhoneNumber(phone: string): string {
    let normalized = phone.replace(/\D/g, '')

    // If starts with 91 and has 12 digits
    if (normalized.startsWith('91') && normalized.length === 12) {
      return normalized
    }

    // If 10 digits, add India country code
    if (normalized.length === 10) {
      return '91' + normalized
    }

    return normalized
  }

  /**
   * Handle API errors
   */
  private handleError(data: any): WhatsAppResponse {
    const error = data.error || {}

    return {
      success: false,
      errorCode: error.code,
      errorMessage: error.message || 'WhatsApp API error',
      error: error.error_data?.details || error.message || 'Unknown error'
    }
  }

  /**
   * Log delivery to database
   */
  private async logDelivery(params: {
    recipient: string
    message: string
    response: WhatsAppResponse
  }) {
    try {
      await this.supabase.from('communication_delivery_log').insert({
        message_type: 'sms', // Using sms type for now, can add 'whatsapp' later
        recipient_identifier: params.recipient,
        content: params.message,
        provider_name: 'whatsapp',
        status: params.response.success ? 'sent' : 'failed',
        provider_transaction_id: params.response.messageId,
        error_code: params.response.errorCode?.toString(),
        error_message: params.response.errorMessage,
        provider_response: params.response as any
      })
    } catch (error) {
      console.error('Failed to log WhatsApp delivery:', error)
    }
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create WhatsApp provider instance
 */
export async function createWhatsAppProvider(): Promise<WhatsAppProvider> {
  const config: WhatsAppConfig = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  }

  if (!config.phoneNumberId || !config.accessToken) {
    throw new Error('WhatsApp provider: Missing required credentials (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN)')
  }

  return new WhatsAppProvider(config)
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Send OTP via WhatsApp
 */
export async function sendWhatsAppOTP(params: {
  phone: string
  otp: string
  validity: number
}) {
  const provider = await createWhatsAppProvider()

  // Try template first (if approved)
  try {
    return await provider.sendTemplate({
      to: params.phone,
      templateName: 'otp_authentication',
      languageCode: 'en',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.otp },
            { type: 'text', text: params.validity.toString() }
          ]
        }
      ]
    })
  } catch {
    // Fallback to text message
    return await provider.sendText({
      to: params.phone,
      message: `${params.otp} is your OTP for LOANZ 360. Valid for ${params.validity} minutes. Do not share with anyone.`
    })
  }
}

/**
 * Send loan status update via WhatsApp
 */
export async function sendWhatsAppLoanUpdate(params: {
  phone: string
  name: string
  loanId: string
  status: string
  message: string
}) {
  const provider = await createWhatsAppProvider()

  return await provider.sendText({
    to: params.phone,
    message: `Dear ${params.name},\n\nYour loan application ${params.loanId} status: *${status}*\n\n${params.message}\n\nLogin to LOANZ 360 for details.`
  })
}

/**
 * Send interactive message with quick replies
 */
export async function sendWhatsAppInteractiveMessage(params: {
  phone: string
  message: string
  buttons: Array<{ id: string; title: string }>
}) {
  const provider = await createWhatsAppProvider()

  return await provider.sendInteractive({
    to: params.phone,
    type: 'button',
    body: params.message,
    buttons: params.buttons,
    footer: 'LOANZ 360'
  })
}
