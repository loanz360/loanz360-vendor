/**
 * WhatsApp Business API Integration Service
 * Ready for Meta Business API connection
 *
 * Notification types:
 * - Application status updates
 * - EMI reminders (3 days before, 1 day before, overdue)
 * - Document expiry alerts
 * - Rate drop alerts
 * - Disbursement confirmation
 *
 * TODO: Configure Meta Business API credentials in Supabase env:
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ID
 */

export type WhatsAppTemplate =
  | 'APPLICATION_STATUS'
  | 'EMI_REMINDER'
  | 'DOCUMENT_EXPIRY'
  | 'RATE_DROP'
  | 'DISBURSEMENT_CONFIRMED'
  | 'WELCOME'
  | 'KYC_PENDING'

interface WhatsAppMessage {
  to: string // Mobile number with country code (e.g., +91XXXXXXXXXX)
  template: WhatsAppTemplate
  parameters: Record<string, string>
  language?: string
}

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

const TEMPLATE_MAP: Record<WhatsAppTemplate, string> = {
  APPLICATION_STATUS: 'loan_application_update',
  EMI_REMINDER: 'emi_payment_reminder',
  DOCUMENT_EXPIRY: 'document_expiry_alert',
  RATE_DROP: 'interest_rate_drop',
  DISBURSEMENT_CONFIRMED: 'loan_disbursement',
  WELCOME: 'customer_welcome',
  KYC_PENDING: 'kyc_verification_pending',
}

/**
 * Send WhatsApp message using template
 * Currently returns mock success — connect to Meta API when ready
 */
export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<SendResult> {
  const { to, template, parameters } = message

  // Validate phone number format
  const cleanPhone = to.replace(/\D/g, '')
  if (cleanPhone.length < 10) {
    return { success: false, error: 'Invalid phone number' }
  }

  const templateName = TEMPLATE_MAP[template]
  if (!templateName) {
    return { success: false, error: 'Unknown template' }
  }

  // TODO: Replace with actual Meta Business API call
  // const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
  // const response = await fetch(WHATSAPP_API_URL, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     messaging_product: 'whatsapp',
  //     to: cleanPhone,
  //     type: 'template',
  //     template: {
  //       name: templateName,
  //       language: { code: message.language || 'en' },
  //       components: [{
  //         type: 'body',
  //         parameters: Object.values(parameters).map(value => ({ type: 'text', text: value })),
  //       }],
  //     },
  //   }),
  // })

  // Log the intent for now
  const mockMessageId = `wamid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return {
    success: true,
    messageId: mockMessageId,
  }
}

/**
 * Send EMI reminder via WhatsApp
 */
export async function sendEMIReminder(
  mobile: string,
  customerName: string,
  emiAmount: number,
  dueDate: string,
  loanType: string
): Promise<SendResult> {
  return sendWhatsAppMessage({
    to: mobile,
    template: 'EMI_REMINDER',
    parameters: {
      customer_name: customerName,
      emi_amount: `₹${emiAmount.toLocaleString('en-IN')}`,
      due_date: dueDate,
      loan_type: loanType,
    },
  })
}

/**
 * Send application status update via WhatsApp
 */
export async function sendApplicationUpdate(
  mobile: string,
  customerName: string,
  applicationId: string,
  status: string
): Promise<SendResult> {
  return sendWhatsAppMessage({
    to: mobile,
    template: 'APPLICATION_STATUS',
    parameters: {
      customer_name: customerName,
      application_id: applicationId,
      status,
    },
  })
}
