/**
 * Payout Notification System
 * Handles email and SMS notifications for commission approvals/rejections
 */

import { sendEmail } from '@/lib/communication/email-service'
import { sendSMS } from '@/lib/communication/sms-service'

export interface CommissionNotificationData {
  partner_id: string
  partner_name: string
  partner_email: string
  partner_phone?: string
  partner_type?: string // 'BUSINESS_ASSOCIATE' | 'BUSINESS_PARTNER' | 'CHANNEL_PARTNER'
  commission_amount: number
  lead_id: string
  customer_name: string
  loan_product: string
  status: 'APPROVED' | 'REJECTED' | 'PAID'
  batch_number?: string
  payment_reference?: string
  rejection_reason?: string
  remarks?: string
}

/**
 * Get the correct partner commissions/payout URL based on partner type
 */
function getPartnerCommissionsUrl(partnerType?: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  switch (partnerType) {
    case 'BUSINESS_ASSOCIATE': return `${base}/partners/ba/commissions`
    case 'BUSINESS_PARTNER': return `${base}/partners/bp/commissions`
    case 'CHANNEL_PARTNER': return `${base}/partners/cp/payout-status`
    default: return `${base}/partners/ba/commissions`
  }
}

// TODO: Wire notifyCommissionApproval, notifyCommissionRejection, notifyCommissionPaid,
// and notifyBatchSummary into superadmin payout routes (approve/reject/paid batch actions).
// These functions are exported but currently not called from any route handler.

/**
 * Send commission approval notification
 */
export async function notifyCommissionApproval(data: CommissionNotificationData): Promise<{
  email_sent: boolean
  sms_sent: boolean
  errors: string[]
}> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Commission Approved! 🎉</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partner_name},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Great news! Your commission for lead <strong>${data.lead_id}</strong> has been approved and added to payout batch <strong>${data.batch_number}</strong>.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Commission Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 16px; font-weight: bold; text-align: right;">
                  ₹${data.commission_amount.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Batch Number:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.batch_number}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Customer:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.customer_name}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Product:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.loan_product}
                </td>
              </tr>
            </table>
          </div>

          ${data.remarks ? `
          <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400E;">
              <strong>Note:</strong> ${data.remarks}
            </p>
          </div>
          ` : ''}

          <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
            Your commission will be processed with the next payout cycle. You can track the status in your partner portal.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${getPartnerCommissionsUrl(data.partner_type)}"
               style="display: inline-block; background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Payout Status
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Thank you for your continued partnership!<br>
            LOANZ360 Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partner_email,
      subject: `Commission Approved: ₹${data.commission_amount.toLocaleString('en-IN')} - ${data.batch_number}`,
      html: emailTemplate,
      from: process.env.NOTIFICATION_EMAIL_FROM || 'payouts@loanz360.com'
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.partner_phone) {
    try {
      const smsMessage = `LOANZ360: Your commission of Rs.${data.commission_amount} for lead ${data.lead_id} has been APPROVED. Batch: ${data.batch_number}. Check portal for details.`

      await sendSMS({
        to: data.partner_phone,
        message: smsMessage
      })

      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return {
    email_sent,
    sms_sent,
    errors
  }
}

/**
 * Send commission rejection notification
 */
export async function notifyCommissionRejection(data: CommissionNotificationData): Promise<{
  email_sent: boolean
  sms_sent: boolean
  errors: string[]
}> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Commission Update</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partner_name},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            We regret to inform you that your commission for lead <strong>${data.lead_id}</strong> has been rejected.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #EF4444;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Commission Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 16px; font-weight: bold; text-align: right;">
                  ₹${data.commission_amount.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Lead ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.lead_id}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Customer:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.customer_name}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Product:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.loan_product}
                </td>
              </tr>
            </table>
          </div>

          ${data.rejection_reason ? `
          <div style="background: #FEE2E2; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #EF4444;">
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #991B1B; font-weight: bold;">
              Rejection Reason:
            </p>
            <p style="margin: 0; font-size: 14px; color: #7F1D1D;">
              ${data.rejection_reason}
            </p>
          </div>
          ` : ''}

          <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
            If you believe this is an error or have questions about this decision, please contact our support team immediately.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${getPartnerCommissionsUrl(data.partner_type)}"
               style="display: inline-block; background: #6B7280; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Commission Details
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Best regards,<br>
            LOANZ360 Finance Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partner_email,
      subject: `Commission Update - Lead ${data.lead_id}`,
      html: emailTemplate,
      from: process.env.NOTIFICATION_EMAIL_FROM || 'payouts@loanz360.com'
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.partner_phone) {
    try {
      const smsMessage = `LOANZ360: Commission for lead ${data.lead_id} has been REJECTED. Reason: ${data.rejection_reason?.substring(0, 80) || 'See email for details'}. Contact support if needed.`

      await sendSMS({
        to: data.partner_phone,
        message: smsMessage
      })

      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return {
    email_sent,
    sms_sent,
    errors
  }
}

/**
 * Send commission payment notification
 */
export async function notifyCommissionPaid(data: CommissionNotificationData): Promise<{
  email_sent: boolean
  sms_sent: boolean
  errors: string[]
}> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Processed! 💰</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partner_name},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your commission payment has been successfully processed!
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3B82F6;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Payment Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 18px; font-weight: bold; text-align: right;">
                  ₹${data.commission_amount.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Batch Number:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.batch_number}
                </td>
              </tr>
              ${data.payment_reference ? `
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Payment Reference:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-family: monospace;">
                  ${data.payment_reference}
                </td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Lead ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.lead_id}
                </td>
              </tr>
            </table>
          </div>

          <div style="background: #DBEAFE; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1E40AF;">
              <strong>💳 Payment Timeline:</strong> The amount should reflect in your registered bank account within 1-2 business days.
            </p>
          </div>

          <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
            You can download your payment receipt from the partner portal.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${getPartnerCommissionsUrl(data.partner_type)}"
               style="display: inline-block; background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Payment Details
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Thank you for your partnership!<br>
            LOANZ360 Finance Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partner_email,
      subject: `Payment Processed: ₹${data.commission_amount.toLocaleString('en-IN')} - ${data.batch_number}`,
      html: emailTemplate,
      from: process.env.NOTIFICATION_EMAIL_FROM || 'payouts@loanz360.com'
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.partner_phone) {
    try {
      const smsMessage = `LOANZ360: Payment of Rs.${data.commission_amount} has been PROCESSED. ${data.payment_reference ? `Ref: ${data.payment_reference}. ` : ''}Amount will reflect in 1-2 business days.`

      await sendSMS({
        to: data.partner_phone,
        message: smsMessage
      })

      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return {
    email_sent,
    sms_sent,
    errors
  }
}

/**
 * Send batch summary notification to partner (weekly/monthly)
 */
export async function notifyBatchSummary(
  partnerEmail: string,
  partnerName: string,
  summary: {
    partner_type?: string
    period: string
    total_commissions: number
    total_amount: number
    pending_count: number
    pending_amount: number
    paid_count: number
    paid_amount: number
  }
): Promise<boolean> {
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Commission Summary - ${summary.period}</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${partnerName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Here's your commission summary for ${summary.period}:
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #111827; margin-top: 0;">Total Commissions</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Count:</td>
                <td style="padding: 8px 0; color: #111827; text-align: right; font-weight: bold;">
                  ${summary.total_commissions}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Amount:</td>
                <td style="padding: 8px 0; color: #111827; text-align: right; font-weight: bold;">
                  ₹${summary.total_amount.toLocaleString('en-IN')}
                </td>
              </tr>
            </table>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">

            <h3 style="color: #10B981;">Paid Commissions</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Count:</td>
                <td style="padding: 8px 0; color: #10B981; text-align: right; font-weight: bold;">
                  ${summary.paid_count}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Amount:</td>
                <td style="padding: 8px 0; color: #10B981; text-align: right; font-weight: bold;">
                  ₹${summary.paid_amount.toLocaleString('en-IN')}
                </td>
              </tr>
            </table>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">

            <h3 style="color: #F59E0B;">Pending Commissions</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Count:</td>
                <td style="padding: 8px 0; color: #F59E0B; text-align: right; font-weight: bold;">
                  ${summary.pending_count}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Amount:</td>
                <td style="padding: 8px 0; color: #F59E0B; text-align: right; font-weight: bold;">
                  ₹${summary.pending_amount.toLocaleString('en-IN')}
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${getPartnerCommissionsUrl(summary.partner_type)}"
               style="display: inline-block; background: #F59E0B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Detailed Report
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Thank you for your continued partnership!<br>
            LOANZ360 Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: partnerEmail,
      subject: `Commission Summary - ${summary.period}`,
      html: emailTemplate,
      from: process.env.NOTIFICATION_EMAIL_FROM || 'payouts@loanz360.com'
    })

    return true
  } catch (error) {
    console.error('Batch summary notification failed:', error)
    return false
  }
}
