/**
 * Stage Transition WhatsApp Notifications
 *
 * Sends WhatsApp messages when leads transition between stages.
 * Fire-and-forget pattern - errors are swallowed by the caller.
 */

import { sendWhatsAppMessage } from '@/lib/communication/whatsapp-service'
import { logger } from '@/lib/utils/logger'

interface StageTransitionParams {
  customerPhone: string
  customerName: string
  loanType: string
  loanAmount: number
  croId: string
  baseUrl: string
  authCookie: string
}

type TransitionType = 'lead_to_deal' | 'deal_to_application' | 'application_submitted' | 'application_approved' | 'application_rejected'

const TRANSITION_MESSAGES: Record<TransitionType, (params: StageTransitionParams) => { subject: string; body: string }> = {
  lead_to_deal: (p) => ({
    subject: 'Your Loan Application is Moving Forward!',
    body: [
      `Hi ${p.customerName},`,
      '',
      `Great news! Your ${p.loanType} enquiry for ${formatAmount(p.loanAmount)} has been reviewed and moved to the next stage.`,
      '',
      'Our team will be in touch shortly to collect the required documents and guide you through the process.',
      '',
      'Thank you for choosing LOANZ 360!',
    ].join('\n'),
  }),

  deal_to_application: (p) => ({
    subject: 'Loan Application Created',
    body: [
      `Hi ${p.customerName},`,
      '',
      `Your ${p.loanType} application for ${formatAmount(p.loanAmount)} has been formally created.`,
      '',
      'Please ensure all documents are uploaded for faster processing.',
      '',
      'Track your application status anytime on the LOANZ 360 portal.',
    ].join('\n'),
  }),

  application_submitted: (p) => ({
    subject: 'Application Submitted for Review',
    body: [
      `Hi ${p.customerName},`,
      '',
      `Your ${p.loanType} application for ${formatAmount(p.loanAmount)} has been submitted for review.`,
      '',
      'Our credit team is now evaluating your profile. We will update you on the progress.',
    ].join('\n'),
  }),

  application_approved: (p) => ({
    subject: 'Congratulations! Loan Approved',
    body: [
      `Hi ${p.customerName},`,
      '',
      `Congratulations! Your ${p.loanType} for ${formatAmount(p.loanAmount)} has been approved!`,
      '',
      'Our team will contact you for the next steps including agreement signing and disbursement.',
      '',
      'Thank you for choosing LOANZ 360!',
    ].join('\n'),
  }),

  application_rejected: (p) => ({
    subject: 'Loan Application Update',
    body: [
      `Hi ${p.customerName},`,
      '',
      `We regret to inform you that your ${p.loanType} application could not be approved at this time.`,
      '',
      'Please contact our team for more details and alternative options that may suit your needs.',
    ].join('\n'),
  }),
}

function formatAmount(amount: number): string {
  if (amount >= 10000000) return `Rs. ${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `Rs. ${(amount / 100000).toFixed(2)} Lakh`
  return `Rs. ${amount.toLocaleString('en-IN')}`
}

/**
 * Send a WhatsApp message for a stage transition.
 * Designed to be called fire-and-forget with a .catch() handler.
 */
export async function sendStageTransitionMessage(
  transitionType: TransitionType,
  params: StageTransitionParams
): Promise<void> {
  try {
    const messageGenerator = TRANSITION_MESSAGES[transitionType]
    if (!messageGenerator) {
      logger.warn(`Unknown transition type: ${transitionType}`)
      return
    }

    const { body } = messageGenerator(params)

    await sendWhatsAppMessage({
      to: params.customerPhone,
      message: body,
      type: 'text',
    })

    logger.info(`Stage transition WhatsApp sent: ${transitionType} to ${params.customerPhone.slice(-4)}`)
  } catch (error) {
    logger.error(`Failed to send stage transition WhatsApp (${transitionType}):`, error)
    // Don't rethrow - this is fire-and-forget
  }
}
