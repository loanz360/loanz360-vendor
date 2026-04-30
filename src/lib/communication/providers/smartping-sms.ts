/**
 * SmartPing/VCon SMS Provider
 *
 * Custom HTTP-based SMS gateway implementation
 * API Documentation: HTTP_SMS_API.pdf
 *
 * Features:
 * - DLT compliance for India
 * - Unicode support for regional languages
 * - Single and bulk SMS sending
 * - Delivery tracking
 * - Error handling with detailed status codes
 */

import { createClient } from '@/lib/supabase/client'

// =====================================================
// TYPES
// =====================================================

export interface SmartPingSMSConfig {
  apiEndpoint: string
  username: string
  password: string
  dltPrincipalEntityId?: string
  defaultSenderId: string
}

export interface SendSMSParams {
  to: string // Mobile number with/without country code
  message: string
  unicode?: boolean // true for regional languages
  senderId?: string // 6-character sender ID
  dltContentId?: string // DLT template ID
  dltPrincipalEntityId?: string
  correlationId?: string // Client tracking ID
}

export interface SendBulkSMSParams {
  recipients: Array<{
    to: string
    message: string
    variables?: Record<string, string>
  }>
  unicode?: boolean
  senderId?: string
  dltContentId?: string
  dltPrincipalEntityId?: string
}

export interface SmartPingSMSResponse {
  success: boolean
  transactionId?: number
  state?: string // 'SUBMIT_ACCEPTED', 'SUBMIT_REJECTED'
  statusCode: number
  description: string
  pdu?: number // Number of message parts
  error?: string
}

// Error codes from SmartPing API
export enum SmartPingErrorCode {
  SUCCESS = 200,
  INVALID_SENDER_ID = 2051,
  AUTHENTICATION_FAILURE = 2070,
  INVALID_MOBILE_NUMBER = 2054,
  INSUFFICIENT_BALANCE = 6001,
  DLT_CONTENT_ID_MISSING = 7001,
  INTERNAL_ERROR = 5000,
}

// =====================================================
// SMARTPING SMS PROVIDER CLASS
// =====================================================

export class SmartPingSMSProvider {
  private config: SmartPingSMSConfig
  private supabase = createClient()

  constructor(config: SmartPingSMSConfig) {
    this.config = config
  }

  /**
   * Send single SMS
   */
  async sendSMS(params: SendSMSParams): Promise<SmartPingSMSResponse> {
    try {
      // Validate phone number
      const normalizedPhone = this.normalizePhoneNumber(params.to)
      if (!normalizedPhone) {
        return {
          success: false,
          statusCode: SmartPingErrorCode.INVALID_MOBILE_NUMBER,
          description: 'Invalid mobile number format',
          error: 'INVALID_PHONE_NUMBER'
        }
      }

      // Validate sender ID
      const senderId = params.senderId || this.config.defaultSenderId
      if (!this.isValidSenderId(senderId)) {
        return {
          success: false,
          statusCode: SmartPingErrorCode.INVALID_SENDER_ID,
          description: 'Sender ID must be 3-11 alphanumeric characters',
          error: 'INVALID_SENDER_ID'
        }
      }

      // Build API request URL
      const url = this.buildRequestURL({
        to: normalizedPhone,
        message: params.message,
        unicode: params.unicode ?? false,
        senderId,
        dltContentId: params.dltContentId,
        dltPrincipalEntityId: params.dltPrincipalEntityId || this.config.dltPrincipalEntityId,
        correlationId: params.correlationId
      })

      // Send request to SmartPing API
      const response = await fetch(url, {
        method: 'GET', // SmartPing uses GET method
        headers: {
          'Accept': 'application/json'
        }
      })

      const data = await response.json()

      // Parse response
      const result = this.parseResponse(data)

      // Log delivery to database
      await this.logDelivery({
        recipient: normalizedPhone,
        message: params.message,
        senderId,
        dltContentId: params.dltContentId,
        response: result,
        correlationId: params.correlationId
      })

      return result
    } catch (error) {
      console.error('SmartPing SMS error:', error)

      return {
        success: false,
        statusCode: SmartPingErrorCode.INTERNAL_ERROR,
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        error: 'PROVIDER_ERROR'
      }
    }
  }

  /**
   * Send bulk SMS
   */
  async sendBulkSMS(params: SendBulkSMSParams): Promise<SmartPingSMSResponse[]> {
    const results: SmartPingSMSResponse[] = []

    for (const recipient of params.recipients) {
      const result = await this.sendSMS({
        to: recipient.to,
        message: recipient.message,
        unicode: params.unicode,
        senderId: params.senderId,
        dltContentId: params.dltContentId,
        dltPrincipalEntityId: params.dltPrincipalEntityId
      })

      results.push(result)

      // Add small delay to avoid rate limiting (60 requests/min = 1 per second)
      await this.sleep(1000)
    }

    return results
  }

  /**
   * Send SMS using template
   */
  async sendTemplatedSMS(params: {
    templateCode: string
    to: string
    variables: Record<string, string>
    senderId?: string
  }): Promise<SmartPingSMSResponse> {
    try {
      // Fetch template from database
      const { data: template, error } = await this.supabase
        .from('communication_templates')
        .select('*')
        .eq('template_code', params.templateCode)
        .eq('template_type', 'sms')
        .eq('is_active', true)
        .maybeSingle()

      if (error || !template) {
        return {
          success: false,
          statusCode: SmartPingErrorCode.INTERNAL_ERROR,
          description: 'Template not found or inactive',
          error: 'TEMPLATE_NOT_FOUND'
        }
      }

      // Render template with variables
      const message = this.renderTemplate(template.content, params.variables)

      // Determine if unicode is needed (check for non-ASCII characters)
      const unicode = this.containsUnicode(message)

      // Send SMS
      return await this.sendSMS({
        to: params.to,
        message,
        unicode,
        senderId: params.senderId || template.default_sender_id,
        dltContentId: template.dlt_template_id,
        dltPrincipalEntityId: this.config.dltPrincipalEntityId
      })
    } catch (error) {
      console.error('SmartPing templated SMS error:', error)

      return {
        success: false,
        statusCode: SmartPingErrorCode.INTERNAL_ERROR,
        description: error instanceof Error ? error.message : 'Template rendering error',
        error: 'TEMPLATE_ERROR'
      }
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Build SmartPing API request URL
   */
  private buildRequestURL(params: SendSMSParams): string {
    const urlParams = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
      unicode: params.unicode ? 'true' : 'false',
      from: params.senderId || this.config.defaultSenderId,
      to: params.to,
      text: params.message
    })

    // Add optional parameters
    if (params.dltContentId) {
      urlParams.append('dltContentId', params.dltContentId)
    }

    if (params.dltPrincipalEntityId) {
      urlParams.append('dltPrincipalEntityId', params.dltPrincipalEntityId)
    }

    if (params.correlationId) {
      urlParams.append('corelationId', params.correlationId) // Note: API uses 'corelation' (typo in their API)
    }

    return `${this.config.apiEndpoint}?${urlParams.toString()}`
  }

  /**
   * Parse SmartPing API response
   */
  private parseResponse(data: Record<string, unknown>): SmartPingSMSResponse {
    const statusCode = data.statusCode || data.status || 5000

    // Success response
    if (statusCode === 200) {
      return {
        success: true,
        transactionId: data.transactionId,
        state: data.state,
        statusCode: 200,
        description: data.description || 'Message accepted successfully',
        pdu: data.pdu || 1
      }
    }

    // Error response
    return {
      success: false,
      statusCode,
      description: this.getErrorDescription(statusCode),
      error: data.error || 'SMS_DELIVERY_FAILED'
    }
  }

  /**
   * Get human-readable error description
   */
  private getErrorDescription(statusCode: number): string {
    switch (statusCode) {
      case SmartPingErrorCode.INVALID_SENDER_ID:
        return 'Invalid sender ID. Sender ID must be 6 characters.'
      case SmartPingErrorCode.AUTHENTICATION_FAILURE:
        return 'Authentication failed. Check API username and password.'
      case SmartPingErrorCode.INVALID_MOBILE_NUMBER:
        return 'Invalid mobile number format.'
      case SmartPingErrorCode.INSUFFICIENT_BALANCE:
        return 'Insufficient SMS balance. Please recharge your account.'
      case SmartPingErrorCode.DLT_CONTENT_ID_MISSING:
        return 'DLT Content ID is required for SMS delivery in India.'
      default:
        return 'SMS delivery failed. Please try again later.'
    }
  }

  /**
   * Normalize phone number to standard format
   * Accepts: 9876543210, +919876543210, 919876543210
   * Returns: 919876543210 (with country code)
   */
  private normalizePhoneNumber(phone: string): string | null {
    // Remove all non-digit characters
    let normalized = phone.replace(/\D/g, '')

    // If starts with 91 and has 12 digits total (919876543210)
    if (normalized.startsWith('91') && normalized.length === 12) {
      return normalized
    }

    // If 10 digits (9876543210), add India country code
    if (normalized.length === 10) {
      return '91' + normalized
    }

    // If starts with 0 and has 11 digits (09876543210), remove leading 0 and add country code
    if (normalized.startsWith('0') && normalized.length === 11) {
      return '91' + normalized.substring(1)
    }

    // Invalid format
    return null
  }

  /**
   * Validate sender ID format
   * Typically 6 characters but some providers allow up to 11 characters
   * Must be alphanumeric (A-Z, a-z, 0-9)
   */
  private isValidSenderId(senderId: string): boolean {
    // Allow 3-11 alphanumeric characters (flexible for different providers)
    return /^[A-Za-z0-9]{3,11}$/.test(senderId)
  }

  /**
   * Render template with variables
   * Example: "Your OTP is {{otp}}" + {otp: "123456"} = "Your OTP is 123456"
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
   * Check if string contains unicode (non-ASCII) characters
   */
  private containsUnicode(text: string): boolean {
    return /[^\u0000-\u007F]/.test(text)
  }

  /**
   * Log SMS delivery to database
   */
  private async logDelivery(params: {
    recipient: string
    message: string
    senderId: string
    dltContentId?: string
    response: SmartPingSMSResponse
    correlationId?: string
  }): Promise<void> {
    try {
      await this.supabase.from('communication_delivery_log').insert({
        message_type: 'sms',
        recipient_identifier: params.recipient,
        content: params.message,
        provider_name: 'smartping',
        status: params.response.success ? 'sent' : 'failed',
        provider_transaction_id: params.response.transactionId?.toString(),
        correlation_id: params.correlationId,
        error_code: params.response.success ? null : params.response.statusCode.toString(),
        error_message: params.response.success ? null : params.response.description,
        provider_response: params.response as unknown,
        message_parts: params.response.pdu || 1,
        variables_used: {
          sender_id: params.senderId,
          dlt_content_id: params.dltContentId
        }
      })
    } catch (error) {
      console.error('Failed to log SMS delivery:', error)
      // Don't throw - logging failure shouldn't fail the SMS send
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create SmartPing SMS provider instance
 * Loads configuration from environment variables
 */
export async function createSmartPingSMSProvider(): Promise<SmartPingSMSProvider> {
  const config: SmartPingSMSConfig = {
    apiEndpoint: process.env.SMARTPING_API_ENDPOINT || 'https://api.smartping.ai/fe/api/v1/send',
    username: process.env.SMARTPING_USERNAME || '',
    password: process.env.SMARTPING_PASSWORD || '',
    dltPrincipalEntityId: process.env.SMARTPING_DLT_PRINCIPAL_ENTITY_ID,
    defaultSenderId: process.env.SMARTPING_DEFAULT_SENDER_ID || 'exclmtrpg'
  }

  // Validate required config
  if (!config.username || !config.password) {
    throw new Error('SmartPing SMS provider: Missing required credentials (SMARTPING_USERNAME, SMARTPING_PASSWORD)')
  }

  return new SmartPingSMSProvider(config)
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Send OTP SMS using SmartPing
 */
export async function sendOTPSMS(params: {
  phone: string
  otp: string
  validity: number // minutes
  templateCode?: string
}): Promise<SmartPingSMSResponse> {
  const provider = await createSmartPingSMSProvider()

  return provider.sendTemplatedSMS({
    templateCode: params.templateCode || 'OTP_LOGIN',
    to: params.phone,
    variables: {
      otp: params.otp,
      validity: params.validity.toString()
    }
  })
}

/**
 * Send welcome SMS to new user
 */
export async function sendWelcomeSMS(params: {
  phone: string
  name: string
  appUrl: string
}): Promise<SmartPingSMSResponse> {
  const provider = await createSmartPingSMSProvider()

  return provider.sendTemplatedSMS({
    templateCode: 'WELCOME_SMS',
    to: params.phone,
    variables: {
      name: params.name,
      app_url: params.appUrl
    }
  })
}

/**
 * Send loan status update SMS
 */
export async function sendLoanStatusSMS(params: {
  phone: string
  name: string
  loanId: string
  status: string
  message: string
  supportPhone: string
}): Promise<SmartPingSMSResponse> {
  const provider = await createSmartPingSMSProvider()

  return provider.sendTemplatedSMS({
    templateCode: 'LOAN_STATUS_UPDATE',
    to: params.phone,
    variables: {
      name: params.name,
      loan_id: params.loanId,
      status: params.status,
      message: params.message,
      support_phone: params.supportPhone
    }
  })
}

/**
 * Send payment reminder SMS
 */
export async function sendPaymentReminderSMS(params: {
  phone: string
  name: string
  amount: string
  dueDate: string
  loanAccount: string
}): Promise<SmartPingSMSResponse> {
  const provider = await createSmartPingSMSProvider()

  return provider.sendTemplatedSMS({
    templateCode: 'PAYMENT_REMINDER',
    to: params.phone,
    variables: {
      name: params.name,
      amount: params.amount,
      due_date: params.dueDate,
      loan_account: params.loanAccount
    }
  })
}

/**
 * Send profile completion reminder SMS
 * Encourages customers to complete their profile for personalized services
 */
export async function sendProfileReminderSMS(params: {
  phone: string
  name: string
  profileCompletionPercent?: number
}): Promise<SmartPingSMSResponse> {
  const provider = await createSmartPingSMSProvider()

  // Use a direct message if no template exists
  const message = `Hi ${params.name}, Your LOANZ360 profile is ${params.profileCompletionPercent || 0}% complete. Complete your profile now to unlock personalized loan offers, faster approvals & exclusive benefits! Visit: loanz360.com/my-profile`

  return provider.sendSMS({
    to: params.phone,
    message,
    unicode: false,
    dltContentId: process.env.SMARTPING_PROFILE_REMINDER_DLT_ID
  })
}
