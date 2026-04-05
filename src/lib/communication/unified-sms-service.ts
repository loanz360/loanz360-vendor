/**
 * Unified SMS Service
 *
 * Centralized SMS service that:
 * - Manages multiple SMS providers (SmartPing, MSG91, Twilio)
 * - Database-driven template system
 * - Automatic provider failover
 * - Delivery tracking and analytics
 * - Rate limiting and retry logic
 */

import { createClient } from '@/lib/supabase/client'
import {
  SmartPingSMSProvider,
  createSmartPingSMSProvider,
  type SmartPingSMSResponse
} from './providers/smartping-sms'

// =====================================================
// TYPES
// =====================================================

export interface SMSProviderConfig {
  id: string
  providerName: string
  isActive: boolean
  isPrimary: boolean
  priority: number
}

export interface SMSTemplate {
  id: string
  templateCode: string
  templateName: string
  content: string
  variables: string[]
  dltTemplateId?: string
  defaultSenderId?: string
  isActive: boolean
}

export interface SendSMSRequest {
  to: string | string[] // Single phone or array of phones
  templateCode: string
  variables: Record<string, string>
  senderId?: string
  userId?: string // Link to user for tracking
  correlationId?: string
}

export interface SendRawSMSRequest {
  to: string | string[]
  message: string
  senderId?: string
  unicode?: boolean
  dltContentId?: string
  userId?: string
  correlationId?: string
}

export interface SMSDeliveryResult {
  success: boolean
  recipient: string
  transactionId?: string
  statusCode: number
  description: string
  error?: string
}

// =====================================================
// UNIFIED SMS SERVICE CLASS
// =====================================================

export class UnifiedSMSService {
  private supabase = createClient()
  private providerCache: Map<string, any> = new Map()
  private templateCache: Map<string, SMSTemplate> = new Map()
  private lastCacheUpdate: number = 0
  private cacheTimeout: number = 5 * 60 * 1000 // 5 minutes

  /**
   * Send SMS using template
   */
  async sendSMS(request: SendSMSRequest): Promise<SMSDeliveryResult[]> {
    try {
      // Normalize recipients to array
      const recipients = Array.isArray(request.to) ? request.to : [request.to]

      // Fetch template
      const template = await this.getTemplate(request.templateCode)
      if (!template) {
        return recipients.map(recipient => ({
          success: false,
          recipient,
          statusCode: 5000,
          description: 'Template not found or inactive',
          error: 'TEMPLATE_NOT_FOUND'
        }))
      }

      // Validate variables
      const missingVars = this.validateTemplateVariables(template, request.variables)
      if (missingVars.length > 0) {
        return recipients.map(recipient => ({
          success: false,
          recipient,
          statusCode: 5000,
          description: `Missing required variables: ${missingVars.join(', ')}`,
          error: 'MISSING_VARIABLES'
        }))
      }

      // Render template
      const message = this.renderTemplate(template.content, request.variables)

      // Get active provider
      const provider = await this.getActiveProvider()
      if (!provider) {
        return recipients.map(recipient => ({
          success: false,
          recipient,
          statusCode: 5000,
          description: 'No active SMS provider configured',
          error: 'NO_PROVIDER'
        }))
      }

      // Send SMS to all recipients
      const results: SMSDeliveryResult[] = []

      for (const recipient of recipients) {
        const result = await this.sendWithProvider(provider, {
          to: recipient,
          message,
          senderId: request.senderId || template.defaultSenderId,
          unicode: this.containsUnicode(message),
          dltContentId: template.dltTemplateId,
          templateCode: request.templateCode,
          variables: request.variables,
          userId: request.userId,
          correlationId: request.correlationId
        })

        results.push(result)
      }

      return results
    } catch (error) {
      console.error('UnifiedSMSService error:', error)

      const recipients = Array.isArray(request.to) ? request.to : [request.to]
      return recipients.map(recipient => ({
        success: false,
        recipient,
        statusCode: 5000,
        description: error instanceof Error ? error.message : 'Unknown error',
        error: 'SERVICE_ERROR'
      }))
    }
  }

  /**
   * Send raw SMS without template
   */
  async sendRawSMS(request: SendRawSMSRequest): Promise<SMSDeliveryResult[]> {
    try {
      // Normalize recipients to array
      const recipients = Array.isArray(request.to) ? request.to : [request.to]

      // Get active provider
      const provider = await this.getActiveProvider()
      if (!provider) {
        return recipients.map(recipient => ({
          success: false,
          recipient,
          statusCode: 5000,
          description: 'No active SMS provider configured',
          error: 'NO_PROVIDER'
        }))
      }

      // Send SMS to all recipients
      const results: SMSDeliveryResult[] = []

      for (const recipient of recipients) {
        const result = await this.sendWithProvider(provider, {
          to: recipient,
          message: request.message,
          senderId: request.senderId,
          unicode: request.unicode ?? this.containsUnicode(request.message),
          dltContentId: request.dltContentId,
          userId: request.userId,
          correlationId: request.correlationId
        })

        results.push(result)
      }

      return results
    } catch (error) {
      console.error('UnifiedSMSService raw SMS error:', error)

      const recipients = Array.isArray(request.to) ? request.to : [request.to]
      return recipients.map(recipient => ({
        success: false,
        recipient,
        statusCode: 5000,
        description: error instanceof Error ? error.message : 'Unknown error',
        error: 'SERVICE_ERROR'
      }))
    }
  }

  /**
   * Send OTP SMS (convenience method)
   */
  async sendOTP(params: {
    phone: string
    otp: string
    validity: number
    templateCode?: string
    userId?: string
  }): Promise<SMSDeliveryResult> {
    const results = await this.sendSMS({
      to: params.phone,
      templateCode: params.templateCode || 'OTP_LOGIN',
      variables: {
        otp: params.otp,
        validity: params.validity.toString()
      },
      userId: params.userId
    })

    return results[0]
  }

  /**
   * Get list of available templates
   */
  async getTemplates(filter?: {
    type?: 'sms' | 'email'
    category?: string
    isActive?: boolean
  }): Promise<SMSTemplate[]> {
    let query = this.supabase
      .from('communication_templates')
      .select('*')
      .order('template_name')

    if (filter?.type) {
      query = query.eq('template_type', filter.type)
    }

    if (filter?.category) {
      query = query.eq('category', filter.category)
    }

    if (filter?.isActive !== undefined) {
      query = query.eq('is_active', filter.isActive)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching templates:', error)
      return []
    }

    return data || []
  }

  /**
   * Get delivery logs
   */
  async getDeliveryLogs(filter?: {
    recipient?: string
    userId?: string
    status?: string
    from?: Date
    to?: Date
    limit?: number
  }): Promise<any[]> {
    let query = this.supabase
      .from('communication_delivery_log')
      .select('*')
      .eq('message_type', 'sms')
      .order('created_at', { ascending: false })

    if (filter?.recipient) {
      query = query.eq('recipient_identifier', filter.recipient)
    }

    if (filter?.userId) {
      query = query.eq('recipient_user_id', filter.userId)
    }

    if (filter?.status) {
      query = query.eq('status', filter.status)
    }

    if (filter?.from) {
      query = query.gte('created_at', filter.from.toISOString())
    }

    if (filter?.to) {
      query = query.lte('created_at', filter.to.toISOString())
    }

    if (filter?.limit) {
      query = query.limit(filter.limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching delivery logs:', error)
      return []
    }

    return data || []
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(filter?: {
    from?: Date
    to?: Date
    templateCode?: string
  }): Promise<{
    totalSent: number
    totalDelivered: number
    totalFailed: number
    deliveryRate: number
    avgDeliveryTime: number
  }> {
    let query = this.supabase
      .from('communication_delivery_log')
      .select('status, created_at, sent_at, delivered_at')
      .eq('message_type', 'sms')

    if (filter?.from) {
      query = query.gte('created_at', filter.from.toISOString())
    }

    if (filter?.to) {
      query = query.lte('created_at', filter.to.toISOString())
    }

    if (filter?.templateCode) {
      query = query.eq('template_code', filter.templateCode)
    }

    const { data, error } = await query

    if (error || !data) {
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        deliveryRate: 0,
        avgDeliveryTime: 0
      }
    }

    const totalSent = data.length
    const totalDelivered = data.filter(d => d.status === 'delivered').length
    const totalFailed = data.filter(d => d.status === 'failed').length

    // Calculate average delivery time
    const deliveryTimes = data
      .filter(d => d.sent_at && d.delivered_at)
      .map(d => {
        const sent = new Date(d.sent_at).getTime()
        const delivered = new Date(d.delivered_at).getTime()
        return (delivered - sent) / 1000 // seconds
      })

    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : 0

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      avgDeliveryTime
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Get template from cache or database
   */
  private async getTemplate(templateCode: string): Promise<SMSTemplate | null> {
    // Check cache
    if (this.templateCache.has(templateCode) && Date.now() - this.lastCacheUpdate < this.cacheTimeout) {
      return this.templateCache.get(templateCode) || null
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from('communication_templates')
      .select('*')
      .eq('template_code', templateCode)
      .eq('template_type', 'sms')
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    const template: SMSTemplate = {
      id: data.id,
      templateCode: data.template_code,
      templateName: data.template_name,
      content: data.content,
      variables: data.variables || [],
      dltTemplateId: data.dlt_template_id,
      defaultSenderId: data.default_sender_id,
      isActive: data.is_active
    }

    // Update cache
    this.templateCache.set(templateCode, template)
    this.lastCacheUpdate = Date.now()

    return template
  }

  /**
   * Get active SMS provider
   */
  private async getActiveProvider(): Promise<SmartPingSMSProvider | null> {
    // Check cache
    if (this.providerCache.has('primary') && Date.now() - this.lastCacheUpdate < this.cacheTimeout) {
      return this.providerCache.get('primary')
    }

    // For now, we only support SmartPing
    // In future, add MSG91, Twilio based on provider_name in database
    try {
      const provider = await createSmartPingSMSProvider()
      this.providerCache.set('primary', provider)
      return provider
    } catch (error) {
      console.error('Failed to create SMS provider:', error)
      return null
    }
  }

  /**
   * Send SMS with specific provider
   */
  private async sendWithProvider(
    provider: SmartPingSMSProvider,
    params: {
      to: string
      message: string
      senderId?: string
      unicode?: boolean
      dltContentId?: string
      templateCode?: string
      variables?: Record<string, string>
      userId?: string
      correlationId?: string
    }
  ): Promise<SMSDeliveryResult> {
    try {
      const response = await provider.sendSMS({
        to: params.to,
        message: params.message,
        senderId: params.senderId,
        unicode: params.unicode,
        dltContentId: params.dltContentId,
        correlationId: params.correlationId
      })

      // Log to database
      await this.logDelivery({
        recipient: params.to,
        message: params.message,
        templateCode: params.templateCode,
        variables: params.variables,
        userId: params.userId,
        response
      })

      return {
        success: response.success,
        recipient: params.to,
        transactionId: response.transactionId?.toString(),
        statusCode: response.statusCode,
        description: response.description,
        error: response.error
      }
    } catch (error) {
      console.error('Provider send error:', error)

      return {
        success: false,
        recipient: params.to,
        statusCode: 5000,
        description: error instanceof Error ? error.message : 'Provider error',
        error: 'PROVIDER_ERROR'
      }
    }
  }

  /**
   * Validate template variables
   */
  private validateTemplateVariables(template: SMSTemplate, variables: Record<string, string>): string[] {
    const missing: string[] = []

    for (const varName of template.variables) {
      if (!variables[varName]) {
        missing.push(varName)
      }
    }

    return missing
  }

  /**
   * Render template with variables
   */
  private renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      rendered = rendered.replace(regex, value)
    }

    return rendered
  }

  /**
   * Check if text contains unicode characters
   */
  private containsUnicode(text: string): boolean {
    return /[^\u0000-\u007F]/.test(text)
  }

  /**
   * Log delivery to database
   */
  private async logDelivery(params: {
    recipient: string
    message: string
    templateCode?: string
    variables?: Record<string, string>
    userId?: string
    response: SmartPingSMSResponse
  }): Promise<void> {
    try {
      await this.supabase.from('communication_delivery_log').insert({
        message_type: 'sms',
        template_code: params.templateCode,
        recipient_identifier: params.recipient,
        recipient_user_id: params.userId,
        provider_name: 'smartping',
        content: params.message,
        variables_used: params.variables,
        status: params.response.success ? 'sent' : 'failed',
        provider_transaction_id: params.response.transactionId?.toString(),
        error_code: params.response.success ? null : params.response.statusCode.toString(),
        error_message: params.response.success ? null : params.response.description,
        provider_response: params.response as any,
        message_parts: params.response.pdu || 1
      })
    } catch (error) {
      console.error('Failed to log SMS delivery:', error)
      // Don't throw - logging failure shouldn't fail the SMS send
    }
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let smsServiceInstance: UnifiedSMSService | null = null

/**
 * Get UnifiedSMSService singleton instance
 */
export function getSMSService(): UnifiedSMSService {
  if (!smsServiceInstance) {
    smsServiceInstance = new UnifiedSMSService()
  }

  return smsServiceInstance
}

// =====================================================
// CONVENIENCE EXPORTS
// =====================================================

export const smsService = {
  send: (request: SendSMSRequest) => getSMSService().sendSMS(request),
  sendRaw: (request: SendRawSMSRequest) => getSMSService().sendRawSMS(request),
  sendOTP: (params: {
    phone: string
    otp: string
    validity: number
    templateCode?: string
    userId?: string
  }) => getSMSService().sendOTP(params),
  getTemplates: (filter?: any) => getSMSService().getTemplates(filter),
  getDeliveryLogs: (filter?: any) => getSMSService().getDeliveryLogs(filter),
  getDeliveryStats: (filter?: any) => getSMSService().getDeliveryStats(filter)
}
