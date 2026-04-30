/**
 * WhatsApp Notification Service
 * Integrates with WhatsApp Business API for partner notifications
 * Supports Twilio WhatsApp and Meta WhatsApp Business API
 */

interface WhatsAppConfig {
  provider: 'twilio' | 'meta' | 'custom'
  accountSid?: string // Twilio
  authToken?: string // Twilio
  whatsappNumber?: string // Twilio
  accessToken?: string // Meta
  phoneNumberId?: string // Meta
  apiUrl?: string // Custom
  apiKey?: string // Custom
}

interface WhatsAppMessage {
  to: string // Phone number in E.164 format (e.g., +919876543210)
  message: string
  template?: string // Template name for WhatsApp Business
  templateParams?: Record<string, string> // Template variables
}

interface WhatsAppResponse {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Get WhatsApp configuration from environment variables
 */
function getWhatsAppConfig(): WhatsAppConfig {
  const provider = (process.env.WHATSAPP_PROVIDER || 'twilio') as 'twilio' | 'meta' | 'custom'

  return {
    provider,
    // Twilio config
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER, // e.g., whatsapp:+14155238886

    // Meta WhatsApp Business API config
    accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID,

    // Custom provider config
    apiUrl: process.env.WHATSAPP_API_URL,
    apiKey: process.env.WHATSAPP_API_KEY,
  }
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '')

  // If starts with 0, replace with country code (assuming India +91)
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1)
  }

  // If doesn't start with country code, add India code
  if (!cleaned.startsWith('91') && cleaned.length === 10) {
    cleaned = '91' + cleaned
  }

  // Add + prefix
  return '+' + cleaned
}

/**
 * Send WhatsApp message via Twilio
 */
async function sendViaTwilio(config: WhatsAppConfig, message: WhatsAppMessage): Promise<WhatsAppResponse> {
  if (!config.accountSid || !config.authToken || !config.whatsappNumber) {
    return {
      success: false,
      error: 'Twilio WhatsApp configuration incomplete'
    }
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`

    const formData = new URLSearchParams()
    formData.append('From', config.whatsappNumber)
    formData.append('To', `whatsapp:${message.to}`)
    formData.append('Body', message.message)

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    const data = await response.json()

    if (response.ok && data.sid) {
      return {
        success: true,
        messageId: data.sid
      }
    } else {
      return {
        success: false,
        error: data.message || 'Twilio WhatsApp send failed'
      }
    }
  } catch (error) {
    console.error('Twilio WhatsApp error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send WhatsApp message via Meta (Facebook) WhatsApp Business API
 */
async function sendViaMeta(config: WhatsAppConfig, message: WhatsAppMessage): Promise<WhatsAppResponse> {
  if (!config.accessToken || !config.phoneNumberId) {
    return {
      success: false,
      error: 'Meta WhatsApp configuration incomplete'
    }
  }

  try {
    const metaUrl = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: message.to.replace('+', ''), // Meta doesn't use + prefix
      type: 'text',
      text: {
        body: message.message
      }
    }

    // If using template
    if (message.template) {
      payload.type = 'template'
      payload.template = {
        name: message.template,
        language: { code: 'en' },
        components: message.templateParams ? [
          {
            type: 'body',
            parameters: Object.values(message.templateParams).map(value => ({
              type: 'text',
              text: value
            }))
          }
        ] : []
      }
      delete payload.text
    }

    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (response.ok && data.messages && data.messages[0]?.id) {
      return {
        success: true,
        messageId: data.messages[0].id
      }
    } else {
      return {
        success: false,
        error: data.error?.message || 'Meta WhatsApp send failed'
      }
    }
  } catch (error) {
    console.error('Meta WhatsApp error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send WhatsApp message via custom API
 */
async function sendViaCustom(config: WhatsAppConfig, message: WhatsAppMessage): Promise<WhatsAppResponse> {
  if (!config.apiUrl || !config.apiKey) {
    return {
      success: false,
      error: 'Custom WhatsApp configuration incomplete'
    }
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: message.to,
        message: message.message,
        template: message.template,
        params: message.templateParams
      })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      return {
        success: true,
        messageId: data.messageId || data.id
      }
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Custom WhatsApp send failed'
      }
    }
  } catch (error) {
    console.error('Custom WhatsApp error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Main function to send WhatsApp message
 */
export async function sendWhatsAppMessage(params: WhatsAppMessage): Promise<WhatsAppResponse> {
  // Normalize phone number
  const normalizedPhone = normalizePhoneNumber(params.to)
  const message: WhatsAppMessage = {
    ...params,
    to: normalizedPhone
  }

  const config = getWhatsAppConfig()

  // Check if WhatsApp is configured
  if (!config.provider) {
    console.warn('WhatsApp not configured, skipping message')
    return {
      success: false,
      error: 'WhatsApp not configured'
    }
  }

  // Send via appropriate provider
  switch (config.provider) {
    case 'twilio':
      return sendViaTwilio(config, message)

    case 'meta':
      return sendViaMeta(config, message)

    case 'custom':
      return sendViaCustom(config, message)

    default:
      return {
        success: false,
        error: `Unsupported WhatsApp provider: ${config.provider}`
      }
  }
}

/**
 * Commission approval WhatsApp notification
 */
export async function sendCommissionApprovalWhatsApp(params: {
  partnerPhone: string
  partnerName: string
  commissionAmount: number
  batchNumber: string
}): Promise<WhatsAppResponse> {
  const message = `🎉 *LOANZ360 Commission Approved*

Hello ${params.partnerName}!

Your commission has been approved:
💰 Amount: ₹${params.commissionAmount.toLocaleString('en-IN')}
📦 Batch: ${params.batchNumber}

Payment will be processed soon. Thank you for your partnership!

- Team LOANZ360`

  return sendWhatsAppMessage({
    to: params.partnerPhone,
    message
  })
}

/**
 * Commission payment WhatsApp notification
 */
export async function sendCommissionPaymentWhatsApp(params: {
  partnerPhone: string
  partnerName: string
  commissionAmount: number
  batchNumber: string
  paymentReference: string
}): Promise<WhatsAppResponse> {
  const message = `💸 *LOANZ360 Commission Paid*

Hello ${params.partnerName}!

Your commission payment has been processed:
✅ Amount: ₹${params.commissionAmount.toLocaleString('en-IN')}
📦 Batch: ${params.batchNumber}
🔖 Reference: ${params.paymentReference}

Thank you for your continued partnership!

- Team LOANZ360`

  return sendWhatsAppMessage({
    to: params.partnerPhone,
    message
  })
}

/**
 * Commission rejection WhatsApp notification
 */
export async function sendCommissionRejectionWhatsApp(params: {
  partnerPhone: string
  partnerName: string
  commissionAmount: number
  reason: string
}): Promise<WhatsAppResponse> {
  const message = `⚠️ *LOANZ360 Commission Update*

Hello ${params.partnerName},

We regret to inform you that a commission of ₹${params.commissionAmount.toLocaleString('en-IN')} has been rejected.

Reason: ${params.reason}

Please contact support if you have questions.

- Team LOANZ360`

  return sendWhatsAppMessage({
    to: params.partnerPhone,
    message
  })
}

/**
 * Batch summary WhatsApp notification
 */
export async function sendBatchSummaryWhatsApp(params: {
  partnerPhone: string
  partnerName: string
  batchNumber: string
  totalCommissions: number
  totalAmount: number
  status: string
}): Promise<WhatsAppResponse> {
  const statusEmoji = params.status === 'APPROVED' ? '✅' : params.status === 'PAID' ? '💸' : '📦'

  const message = `${statusEmoji} *LOANZ360 Batch Update*

Hello ${params.partnerName}!

Batch ${params.batchNumber} - ${params.status}

📊 Total Commissions: ${params.totalCommissions}
💰 Total Amount: ₹${params.totalAmount.toLocaleString('en-IN')}

${params.status === 'APPROVED' ? 'Payment will be processed soon.' : 'Payment has been processed!'}

- Team LOANZ360`

  return sendWhatsAppMessage({
    to: params.partnerPhone,
    message
  })
}

/**
 * Send employee login credentials via WhatsApp
 */
export async function sendEmployeeCredentialsWhatsApp(params: {
  employeePhone: string
  employeeName: string
  employeeId: string
  workEmail: string
  temporaryPassword: string
  loginUrl: string
}): Promise<WhatsAppResponse> {
  const message = `🔐 *LOANZ360 - Employee Login Credentials*

Hello ${params.employeeName}!

Welcome to LOANZ360! Here are your login credentials:

👤 Employee ID: ${params.employeeId}
📧 Login Email: ${params.workEmail}
🔑 Temporary Password: ${params.temporaryPassword}

🌐 Login URL: ${params.loginUrl}

⚠️ Please change your password immediately after first login.

📋 After logging in, complete your profile and submit for HR review.

- HR Team, LOANZ360`

  return sendWhatsAppMessage({
    to: params.employeePhone,
    message
  })
}
