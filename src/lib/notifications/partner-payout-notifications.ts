/**
 * Partner (BA/BP) Payout Notification System
 * Handles email, SMS, and in-app notifications for all BA/BP payout application status changes
 * Follows the same pattern as cp-payout-notifications.ts
 */

import { sendEmail } from '@/lib/communication/email-service'
import { sendSMS } from '@/lib/communication/sms-service'
import { createInAppNotification } from './notification-service'

export type PartnerType = 'BA' | 'BP'

export interface PartnerPayoutNotificationData {
  applicationId: string
  appId: string
  partnerType: PartnerType
  partnerUserId: string
  partnerName: string
  partnerEmail: string
  partnerPhone?: string
  partnerCode: string
  customerName: string
  leadNumber: string
  bankName: string
  loanType: string
  disbursedAmount: number
  expectedCommissionAmount: number
  status: PartnerPayoutStatus
  isTeamOverride?: boolean
  linkedApplicationId?: string
  changedByName?: string
  changedByRole?: string
  reason?: string
  notes?: string
  transactionId?: string
  paymentDate?: string
  paymentAmount?: number
  paymentMode?: string
}

export type PartnerPayoutStatus =
  | 'PENDING'
  | 'ACCOUNTS_VERIFICATION'
  | 'ACCOUNTS_VERIFIED'
  | 'SA_APPROVED'
  | 'FINANCE_PROCESSING'
  | 'PAYOUT_CREDITED'
  | 'REJECTED'
  | 'ON_HOLD'

interface NotificationResult {
  email_sent: boolean
  sms_sent: boolean
  in_app_sent: boolean
  errors: string[]
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'

function getPartnerLabel(type: PartnerType): string {
  return type === 'BA' ? 'Business Associate' : 'Business Partner'
}

function getPartnerPortalUrl(type: PartnerType): string {
  return `/partners/${type.toLowerCase()}/payout-applications`
}

function getPartnerColor(type: PartnerType): string {
  return type === 'BA' ? '#2563EB' : '#7C3AED'
}

function getPartnerGradient(type: PartnerType): string {
  return type === 'BA'
    ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
    : 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)'
}

/**
 * Send notification for application submission
 */
export async function notifyPartnerApplicationSubmitted(data: PartnerPayoutNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  const color = getPartnerColor(data.partnerType)
  const gradient = getPartnerGradient(data.partnerType)
  const label = getPartnerLabel(data.partnerType)
  const portalUrl = getPartnerPortalUrl(data.partnerType)
  const overrideNote = data.isTeamOverride ? ' (Team Override)' : ''

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${gradient}; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payout Application Submitted!</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partnerName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your ${label} payout application${overrideNote} has been submitted successfully and is now under review.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${color};">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Application ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">
                  ${data.appId}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Partner Code:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.partnerCode}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Customer Name:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.customerName}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Bank:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.bankName}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Disbursed Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  &#8377;${data.disbursedAmount.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Expected Commission:</td>
                <td style="padding: 8px 0; color: ${color}; font-size: 16px; font-weight: bold; text-align: right;">
                  &#8377;${data.expectedCommissionAmount.toLocaleString('en-IN')}
                </td>
              </tr>
            </table>
          </div>

          <div style="background: #EFF6FF; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1E40AF;">
              <strong>What's Next?</strong><br>
              Your application will be reviewed by our Accounts team after bank payout sheet reconciliation. Track the status in real-time from your dashboard.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}${portalUrl}"
               style="display: inline-block; background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Track Your Application
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Thank you for your partnership!<br>
            LOANZ360 Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partnerEmail,
      subject: `Payout Application Submitted: ${data.appId} - ${data.customerName}`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.partnerPhone) {
    try {
      const smsMessage = `LOANZ360: Your ${data.partnerType} payout application ${data.appId} for ${data.customerName} (Rs.${data.expectedCommissionAmount}) has been submitted. Track at ${APP_URL}${portalUrl}`

      await sendSMS(data.partnerPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.partnerUserId,
      type: 'info',
      category: 'payout',
      title: 'Payout Application Submitted',
      message: `Your ${data.partnerType} payout application ${data.appId} for ${data.customerName} has been submitted successfully.`,
      actionUrl: portalUrl,
      actionLabel: 'Track Status',
      icon: '📋',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        partnerType: data.partnerType,
        status: data.status,
      },
    })
    in_app_sent = true
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { email_sent, sms_sent, in_app_sent, errors }
}

/**
 * Send notification for status change - routes to appropriate handler
 */
export async function notifyPartnerPayoutStatusChange(
  data: PartnerPayoutNotificationData,
  _previousStatus: PartnerPayoutStatus
): Promise<NotificationResult> {
  switch (data.status) {
    case 'ACCOUNTS_VERIFICATION':
      return notifyPartnerUnderVerification(data)
    case 'ACCOUNTS_VERIFIED':
      return notifyPartnerVerified(data)
    case 'SA_APPROVED':
      return notifyPartnerApproved(data)
    case 'FINANCE_PROCESSING':
      return notifyPartnerProcessing(data)
    case 'PAYOUT_CREDITED':
      return notifyPartnerPayoutCredited(data)
    case 'REJECTED':
      return notifyPartnerRejected(data)
    case 'ON_HOLD':
      return notifyPartnerOnHold(data)
    default:
      return { email_sent: false, sms_sent: false, in_app_sent: false, errors: ['Unknown status'] }
  }
}

/**
 * Notify when application is picked up for verification
 */
async function notifyPartnerUnderVerification(data: PartnerPayoutNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  const email_sent = false
  const sms_sent = false
  let in_app_sent = false

  const portalUrl = getPartnerPortalUrl(data.partnerType)

  try {
    await createInAppNotification({
      adminId: data.partnerUserId,
      type: 'info',
      category: 'payout',
      title: 'Application Under Verification',
      message: `Your ${data.partnerType} application ${data.appId} is being verified by our accounts team.`,
      actionUrl: portalUrl,
      actionLabel: 'View Status',
      icon: '🔍',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        partnerType: data.partnerType,
        status: data.status,
      },
    })
    in_app_sent = true
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { email_sent, sms_sent, in_app_sent, errors }
}

/**
 * Notify when application is verified by accounts
 */
async function notifyPartnerVerified(data: PartnerPayoutNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  const sms_sent = false
  let in_app_sent = false

  const color = getPartnerColor(data.partnerType)
  const portalUrl = getPartnerPortalUrl(data.partnerType)

  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Verification Complete!</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partnerName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Great news! Your ${data.partnerType} payout application has been verified by our accounts team and is now pending admin approval.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #059669;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Application ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">
                  ${data.appId}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Customer:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.customerName}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Expected Commission:</td>
                <td style="padding: 8px 0; color: #059669; font-size: 16px; font-weight: bold; text-align: right;">
                  &#8377;${data.expectedCommissionAmount.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Status:</td>
                <td style="padding: 8px 0; color: #059669; font-size: 14px; font-weight: bold; text-align: right;">
                  Awaiting Admin Approval
                </td>
              </tr>
            </table>
          </div>

          ${data.notes ? `
          <div style="background: #D1FAE5; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #065F46;">
              <strong>Verification Note:</strong> ${data.notes}
            </p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}${portalUrl}"
               style="display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Track Your Application
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Thank you for your patience!<br>
            LOANZ360 Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partnerEmail,
      subject: `Application Verified: ${data.appId} - Awaiting Approval`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  try {
    await createInAppNotification({
      adminId: data.partnerUserId,
      type: 'success',
      category: 'payout',
      title: 'Application Verified',
      message: `Your ${data.partnerType} application ${data.appId} has been verified and is awaiting admin approval.`,
      actionUrl: portalUrl,
      actionLabel: 'View Status',
      icon: '✓',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        partnerType: data.partnerType,
        status: data.status,
      },
    })
    in_app_sent = true
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { email_sent, sms_sent, in_app_sent, errors }
}

/**
 * Notify when application is approved by Super Admin
 */
async function notifyPartnerApproved(data: PartnerPayoutNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  const color = getPartnerColor(data.partnerType)
  const gradient = getPartnerGradient(data.partnerType)
  const portalUrl = getPartnerPortalUrl(data.partnerType)

  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${gradient}; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payout Approved!</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partnerName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Excellent news! Your ${data.partnerType} payout application has been approved and is now being processed for payment.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${color};">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Application ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">
                  ${data.appId}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Customer:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.customerName}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Approved Commission:</td>
                <td style="padding: 8px 0; color: ${color}; font-size: 18px; font-weight: bold; text-align: right;">
                  &#8377;${data.expectedCommissionAmount.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Status:</td>
                <td style="padding: 8px 0; color: ${color}; font-size: 14px; font-weight: bold; text-align: right;">
                  Payment Processing
                </td>
              </tr>
            </table>
          </div>

          <div style="background: #EDE9FE; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #5B21B6;">
              <strong>What's Next?</strong><br>
              Our finance team will process your payment shortly. You will receive another notification once the payment is credited.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}${portalUrl}"
               style="display: inline-block; background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Track Payment
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Thank you for your partnership!<br>
            LOANZ360 Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partnerEmail,
      subject: `Payout Approved: ₹${data.expectedCommissionAmount.toLocaleString('en-IN')} - ${data.appId}`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  if (data.partnerPhone) {
    try {
      const smsMessage = `LOANZ360: Great news! Your ${data.partnerType} payout of Rs.${data.expectedCommissionAmount} (${data.appId}) has been APPROVED. Payment will be processed soon.`

      await sendSMS(data.partnerPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  try {
    await createInAppNotification({
      adminId: data.partnerUserId,
      type: 'success',
      category: 'payout',
      title: 'Payout Approved!',
      message: `Your ${data.partnerType} payout of ₹${data.expectedCommissionAmount.toLocaleString('en-IN')} has been approved for ${data.appId}.`,
      actionUrl: portalUrl,
      actionLabel: 'Track Payment',
      icon: '✅',
      color,
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        partnerType: data.partnerType,
        status: data.status,
        amount: data.expectedCommissionAmount,
      },
    })
    in_app_sent = true
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { email_sent, sms_sent, in_app_sent, errors }
}

/**
 * Notify when payment is being processed
 */
async function notifyPartnerProcessing(data: PartnerPayoutNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  const email_sent = false
  const sms_sent = false
  let in_app_sent = false

  const portalUrl = getPartnerPortalUrl(data.partnerType)

  try {
    await createInAppNotification({
      adminId: data.partnerUserId,
      type: 'info',
      category: 'payout',
      title: 'Payment Processing',
      message: `Payment for ${data.appId} is being processed. Amount: ₹${data.expectedCommissionAmount.toLocaleString('en-IN')}`,
      actionUrl: portalUrl,
      actionLabel: 'View Status',
      icon: '⚙️',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        partnerType: data.partnerType,
        status: data.status,
      },
    })
    in_app_sent = true
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { email_sent, sms_sent, in_app_sent, errors }
}

/**
 * Notify when payout is credited
 */
async function notifyPartnerPayoutCredited(data: PartnerPayoutNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  const payoutAmount = data.paymentAmount || data.expectedCommissionAmount
  const portalUrl = getPartnerPortalUrl(data.partnerType)

  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #16A34A 0%, #15803D 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Credited!</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partnerName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your ${data.partnerType} payout has been successfully credited to your bank account!
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #16A34A;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Application ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">
                  ${data.appId}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Customer:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.customerName}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Amount Credited:</td>
                <td style="padding: 8px 0; color: #16A34A; font-size: 20px; font-weight: bold; text-align: right;">
                  &#8377;${payoutAmount.toLocaleString('en-IN')}
                </td>
              </tr>
              ${data.transactionId ? `
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Transaction ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-family: monospace; text-align: right;">
                  ${data.transactionId}
                </td>
              </tr>
              ` : ''}
              ${data.paymentDate ? `
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Payment Date:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${new Date(data.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </td>
              </tr>
              ` : ''}
              ${data.paymentMode ? `
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Payment Mode:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.paymentMode}
                </td>
              </tr>
              ` : ''}
            </table>
          </div>

          <div style="background: #DCFCE7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #166534;">
              <strong>Note:</strong> The amount should reflect in your bank account within 1-2 business days if not already credited.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}${portalUrl}"
               style="display: inline-block; background: #16A34A; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Payment History
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Thank you for your partnership!<br>
            LOANZ360 Finance Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partnerEmail,
      subject: `Payment Credited: ₹${payoutAmount.toLocaleString('en-IN')} - ${data.appId}`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  if (data.partnerPhone) {
    try {
      const smsMessage = `LOANZ360: Rs.${payoutAmount} CREDITED to your account! ${data.partnerType} App: ${data.appId}. ${data.transactionId ? `Txn: ${data.transactionId}. ` : ''}Check bank in 1-2 days.`

      await sendSMS(data.partnerPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  try {
    await createInAppNotification({
      adminId: data.partnerUserId,
      type: 'success',
      category: 'payout',
      title: 'Payment Credited!',
      message: `₹${payoutAmount.toLocaleString('en-IN')} has been credited to your account for ${data.appId}.`,
      actionUrl: portalUrl,
      actionLabel: 'View Details',
      icon: '💰',
      color: '#16A34A',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        partnerType: data.partnerType,
        status: data.status,
        amount: payoutAmount,
        transactionId: data.transactionId,
      },
    })
    in_app_sent = true
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { email_sent, sms_sent, in_app_sent, errors }
}

/**
 * Notify when application is rejected
 */
async function notifyPartnerRejected(data: PartnerPayoutNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  const portalUrl = getPartnerPortalUrl(data.partnerType)

  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Application Update</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partnerName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            We regret to inform you that your ${data.partnerType} payout application has been rejected.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Application ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">
                  ${data.appId}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Customer:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.customerName}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  &#8377;${data.expectedCommissionAmount.toLocaleString('en-IN')}
                </td>
              </tr>
            </table>
          </div>

          ${data.reason ? `
          <div style="background: #FEE2E2; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #991B1B; font-weight: bold;">
              Rejection Reason:
            </p>
            <p style="margin: 0; font-size: 14px; color: #7F1D1D;">
              ${data.reason}
            </p>
          </div>
          ` : ''}

          <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
            If you believe this is an error or have questions about this decision, please raise a support ticket from your dashboard.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}${portalUrl}"
               style="display: inline-block; background: #6B7280; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Details
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Best regards,<br>
            LOANZ360 Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partnerEmail,
      subject: `Application Update: ${data.appId} - Action Required`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  if (data.partnerPhone) {
    try {
      const smsMessage = `LOANZ360: Your ${data.partnerType} payout application ${data.appId} has been rejected. ${data.reason ? `Reason: ${data.reason.substring(0, 60)}` : 'Check email for details.'} Contact support if needed.`

      await sendSMS(data.partnerPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  try {
    await createInAppNotification({
      adminId: data.partnerUserId,
      type: 'error',
      category: 'payout',
      title: 'Application Rejected',
      message: `Your ${data.partnerType} application ${data.appId} has been rejected. ${data.reason || 'Contact support for details.'}`,
      actionUrl: portalUrl,
      actionLabel: 'View Details',
      icon: '❌',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        partnerType: data.partnerType,
        status: data.status,
        reason: data.reason,
      },
    })
    in_app_sent = true
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { email_sent, sms_sent, in_app_sent, errors }
}

/**
 * Notify when application is put on hold
 */
async function notifyPartnerOnHold(data: PartnerPayoutNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  const portalUrl = getPartnerPortalUrl(data.partnerType)

  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #D97706 0%, #B45309 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Application On Hold</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.partnerName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your ${data.partnerType} payout application has been put on hold and may require your attention.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #D97706;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Application ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">
                  ${data.appId}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Customer:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ${data.customerName}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  &#8377;${data.expectedCommissionAmount.toLocaleString('en-IN')}
                </td>
              </tr>
            </table>
          </div>

          ${data.reason ? `
          <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #D97706;">
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #92400E; font-weight: bold;">
              Hold Reason:
            </p>
            <p style="margin: 0; font-size: 14px; color: #78350F;">
              ${data.reason}
            </p>
          </div>
          ` : ''}

          <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
            Please provide the required information or documents to proceed with your application. Raise a support ticket if you need assistance.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}${portalUrl}"
               style="display: inline-block; background: #D97706; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Application
            </a>
          </div>

          <p style="font-size: 14px; color: #6B7280;">
            Best regards,<br>
            LOANZ360 Team
          </p>
        </div>

        <div style="background: #111827; padding: 20px; text-align: center;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} LOANZ360. All rights reserved.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: data.partnerEmail,
      subject: `Action Required: ${data.appId} - On Hold`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  if (data.partnerPhone) {
    try {
      const smsMessage = `LOANZ360: Your ${data.partnerType} application ${data.appId} is ON HOLD. ${data.reason ? `Reason: ${data.reason.substring(0, 60)}` : 'Please check email for details.'}`

      await sendSMS(data.partnerPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  try {
    await createInAppNotification({
      adminId: data.partnerUserId,
      type: 'warning',
      category: 'payout',
      title: 'Application On Hold',
      message: `Your ${data.partnerType} application ${data.appId} is on hold. ${data.reason || 'Action required.'}`,
      actionUrl: portalUrl,
      actionLabel: 'View Details',
      icon: '⏸️',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        partnerType: data.partnerType,
        status: data.status,
        reason: data.reason,
      },
    })
    in_app_sent = true
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { email_sent, sms_sent, in_app_sent, errors }
}

/**
 * Send internal notification to employees/admins about partner payout events
 */
export async function notifyPartnerPayoutInternalTeam(
  recipients: { userId: string; name: string; email: string; role: string }[],
  data: PartnerPayoutNotificationData,
  eventType: 'new_application' | 'verification_complete' | 'approval_needed' | 'payment_needed'
): Promise<void> {
  const typeLabel = data.partnerType === 'BA' ? 'BA' : 'BP'
  const overrideLabel = data.isTeamOverride ? ' (Team Override)' : ''

  const templates: Record<typeof eventType, { subject: string; message: string }> = {
    new_application: {
      subject: `New ${typeLabel} Application${overrideLabel}: ${data.appId}`,
      message: `A new ${typeLabel} payout application${overrideLabel} ${data.appId} from ${data.partnerName} requires verification. Amount: ₹${data.expectedCommissionAmount.toLocaleString('en-IN')}`
    },
    verification_complete: {
      subject: `${typeLabel} Verification Complete: ${data.appId}`,
      message: `${typeLabel} application ${data.appId} has been verified and requires Super Admin approval. Amount: ₹${data.expectedCommissionAmount.toLocaleString('en-IN')}`
    },
    approval_needed: {
      subject: `${typeLabel} Approval Needed: ${data.appId}`,
      message: `${typeLabel} application ${data.appId} requires your approval. Partner: ${data.partnerName}. Amount: ₹${data.expectedCommissionAmount.toLocaleString('en-IN')}`
    },
    payment_needed: {
      subject: `${typeLabel} Payment Processing: ${data.appId}`,
      message: `${typeLabel} application ${data.appId} is approved and ready for payment processing. Amount: ₹${data.expectedCommissionAmount.toLocaleString('en-IN')}`
    }
  }

  const template = templates[eventType]

  for (const recipient of recipients) {
    try {
      await createInAppNotification({
        adminId: recipient.userId,
        type: 'info',
        category: 'payout',
        title: template.subject,
        message: template.message,
        actionUrl: getPartnerPayoutActionUrl(recipient.role, data.partnerType),
        actionLabel: 'View Application',
        icon: '📋',
        metadata: {
          applicationId: data.applicationId,
          appId: data.appId,
          partnerType: data.partnerType,
          status: data.status,
          isTeamOverride: data.isTeamOverride,
        },
      })
    } catch (error) {
      console.error(`Failed to notify ${recipient.name}:`, error)
    }
  }
}

/**
 * Get action URL based on role for partner payout applications
 */
function getPartnerPayoutActionUrl(role: string, partnerType: PartnerType): string {
  switch (role) {
    case 'ACCOUNTS_EXECUTIVE':
    case 'ACCOUNTS_MANAGER':
      return partnerType === 'BA'
        ? '/employees/accounts-executive/ba-applications'
        : '/employees/accounts-executive/bp-applications'
    case 'SUPER_ADMIN':
      return partnerType === 'BA'
        ? '/superadmin/payout-management/business-associate-approval'
        : '/superadmin/payout-management/business-partner-approval'
    case 'FINANCE_EXECUTIVE':
    case 'FINANCE_MANAGER':
      return '/employees/finance-executive/cp-payouts'
    default:
      return '/dashboard'
  }
}
