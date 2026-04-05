/**
 * CP Payout Notification System
 * Handles email, SMS, and in-app notifications for all CP application status changes
 */

import { sendEmail } from '@/lib/communication/email-service'
import { sendSMS } from '@/lib/communication/sms-service'
import { createInAppNotification } from './notification-service'

export interface CPApplicationNotificationData {
  applicationId: string
  appId: string
  cpUserId: string
  cpName: string
  cpEmail: string
  cpPhone?: string
  customerName: string
  applicationNumber: string
  bankName: string
  loanType: string
  loanAmount: number
  expectedPayoutAmount: number
  status: CPPayoutStatus
  changedByName?: string
  changedByRole?: string
  reason?: string
  notes?: string
  transactionId?: string
  paymentDate?: string
  paymentAmount?: number
  paymentMode?: string
}

export type CPPayoutStatus =
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

/**
 * Get status display info
 */
function getStatusInfo(status: CPPayoutStatus): {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
} {
  const statusMap: Record<CPPayoutStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
    'PENDING': { label: 'Pending', color: '#6B7280', bgColor: '#F3F4F6', borderColor: '#D1D5DB', icon: '⏳' },
    'ACCOUNTS_VERIFICATION': { label: 'Under Verification', color: '#2563EB', bgColor: '#DBEAFE', borderColor: '#93C5FD', icon: '🔍' },
    'ACCOUNTS_VERIFIED': { label: 'Verified', color: '#059669', bgColor: '#D1FAE5', borderColor: '#6EE7B7', icon: '✓' },
    'SA_APPROVED': { label: 'Approved', color: '#7C3AED', bgColor: '#EDE9FE', borderColor: '#C4B5FD', icon: '✅' },
    'FINANCE_PROCESSING': { label: 'Processing', color: '#0891B2', bgColor: '#CFFAFE', borderColor: '#67E8F9', icon: '⚙️' },
    'PAYOUT_CREDITED': { label: 'Credited', color: '#16A34A', bgColor: '#DCFCE7', borderColor: '#86EFAC', icon: '💰' },
    'REJECTED': { label: 'Rejected', color: '#DC2626', bgColor: '#FEE2E2', borderColor: '#FCA5A5', icon: '❌' },
    'ON_HOLD': { label: 'On Hold', color: '#D97706', bgColor: '#FEF3C7', borderColor: '#FCD34D', icon: '⏸️' },
  }
  return statusMap[status] || statusMap['PENDING']
}

/**
 * Send notification for application submission
 */
export async function notifyApplicationSubmitted(data: CPApplicationNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Application Submitted Successfully!</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.cpName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your payout application has been submitted successfully and is now under review.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #F97316;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Application ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">
                  ${data.appId}
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
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Loan Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">
                  ₹${data.loanAmount.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Expected Payout:</td>
                <td style="padding: 8px 0; color: #F97316; font-size: 16px; font-weight: bold; text-align: right;">
                  ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}
                </td>
              </tr>
            </table>
          </div>

          <div style="background: #FFF7ED; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #9A3412;">
              <strong>What's Next?</strong><br>
              Your application will be reviewed by our Accounts team. You can track the status in real-time from your dashboard.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/partners/cp/payout-status"
               style="display: inline-block; background: #F97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
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
      to: data.cpEmail,
      subject: `Application Submitted: ${data.appId} - ${data.customerName}`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.cpPhone) {
    try {
      const smsMessage = `LOANZ360: Your payout application ${data.appId} for ${data.customerName} (Rs.${data.expectedPayoutAmount}) has been submitted. Track at ${APP_URL}/partners/cp/payout-status`

      await sendSMS(data.cpPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.cpUserId,
      type: 'info',
      category: 'payout',
      title: 'Application Submitted',
      message: `Your payout application ${data.appId} for ${data.customerName} has been submitted successfully.`,
      actionUrl: `/partners/cp/payout-status`,
      actionLabel: 'Track Status',
      icon: '📋',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
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
 * Send notification for status change
 */
export async function notifyStatusChange(
  data: CPApplicationNotificationData,
  _previousStatus: CPPayoutStatus
): Promise<NotificationResult> {
  // Route to appropriate notification function based on status
  switch (data.status) {
    case 'ACCOUNTS_VERIFICATION':
      return notifyUnderVerification(data)
    case 'ACCOUNTS_VERIFIED':
      return notifyVerified(data)
    case 'SA_APPROVED':
      return notifyApproved(data)
    case 'FINANCE_PROCESSING':
      return notifyProcessing(data)
    case 'PAYOUT_CREDITED':
      return notifyPayoutCredited(data)
    case 'REJECTED':
      return notifyRejected(data)
    case 'ON_HOLD':
      return notifyOnHold(data)
    default:
      return { email_sent: false, sms_sent: false, in_app_sent: false, errors: ['Unknown status'] }
  }
}

/**
 * Notify when application is picked up for verification
 */
async function notifyUnderVerification(data: CPApplicationNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  const email_sent = false
  const sms_sent = false
  let in_app_sent = false

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.cpUserId,
      type: 'info',
      category: 'payout',
      title: 'Application Under Verification',
      message: `Your application ${data.appId} is being verified by our accounts team.`,
      actionUrl: `/partners/cp/payout-status`,
      actionLabel: 'View Status',
      icon: '🔍',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
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
async function notifyVerified(data: CPApplicationNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  const sms_sent = false
  let in_app_sent = false

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Verification Complete! ✓</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.cpName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Great news! Your payout application has been verified by our accounts team and is now pending admin approval.
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
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Expected Payout:</td>
                <td style="padding: 8px 0; color: #059669; font-size: 16px; font-weight: bold; text-align: right;">
                  ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}
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
            <a href="${APP_URL}/partners/cp/payout-status"
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
      to: data.cpEmail,
      subject: `Application Verified: ${data.appId} - Awaiting Approval`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.cpUserId,
      type: 'success',
      category: 'payout',
      title: 'Application Verified',
      message: `Your application ${data.appId} has been verified and is awaiting admin approval.`,
      actionUrl: `/partners/cp/payout-status`,
      actionLabel: 'View Status',
      icon: '✓',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
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
async function notifyApproved(data: CPApplicationNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Application Approved! ✅</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.cpName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Excellent news! Your payout application has been approved and is now being processed for payment.
          </p>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #7C3AED;">
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
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Approved Payout:</td>
                <td style="padding: 8px 0; color: #7C3AED; font-size: 18px; font-weight: bold; text-align: right;">
                  ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Status:</td>
                <td style="padding: 8px 0; color: #7C3AED; font-size: 14px; font-weight: bold; text-align: right;">
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
            <a href="${APP_URL}/partners/cp/payout-status"
               style="display: inline-block; background: #7C3AED; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
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
      to: data.cpEmail,
      subject: `Payout Approved: ₹${data.expectedPayoutAmount.toLocaleString('en-IN')} - ${data.appId}`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.cpPhone) {
    try {
      const smsMessage = `LOANZ360: Great news! Your payout of Rs.${data.expectedPayoutAmount} (${data.appId}) has been APPROVED. Payment will be processed soon.`

      await sendSMS(data.cpPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.cpUserId,
      type: 'success',
      category: 'payout',
      title: 'Payout Approved!',
      message: `Your payout of ₹${data.expectedPayoutAmount.toLocaleString('en-IN')} has been approved for ${data.appId}.`,
      actionUrl: `/partners/cp/payout-status`,
      actionLabel: 'Track Payment',
      icon: '✅',
      color: '#7C3AED',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
        status: data.status,
        amount: data.expectedPayoutAmount,
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
async function notifyProcessing(data: CPApplicationNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  const email_sent = false
  const sms_sent = false
  let in_app_sent = false

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.cpUserId,
      type: 'info',
      category: 'payout',
      title: 'Payment Processing',
      message: `Payment for ${data.appId} is being processed. Amount: ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}`,
      actionUrl: `/partners/cp/payout-status`,
      actionLabel: 'View Status',
      icon: '⚙️',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
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
async function notifyPayoutCredited(data: CPApplicationNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  const payoutAmount = data.paymentAmount || data.expectedPayoutAmount

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #16A34A 0%, #15803D 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Credited! 💰</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.cpName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your payout has been successfully credited to your bank account!
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
                  ₹${payoutAmount.toLocaleString('en-IN')}
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
              <strong>💳 Note:</strong> The amount should reflect in your bank account within 1-2 business days if not already credited.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/partners/cp/payout-status"
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
      to: data.cpEmail,
      subject: `Payment Credited: ₹${payoutAmount.toLocaleString('en-IN')} - ${data.appId}`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.cpPhone) {
    try {
      const smsMessage = `LOANZ360: Rs.${payoutAmount} CREDITED to your account! App: ${data.appId}. ${data.transactionId ? `Txn: ${data.transactionId}. ` : ''}Check bank in 1-2 days.`

      await sendSMS(data.cpPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.cpUserId,
      type: 'success',
      category: 'payout',
      title: 'Payment Credited!',
      message: `₹${payoutAmount.toLocaleString('en-IN')} has been credited to your account for ${data.appId}.`,
      actionUrl: `/partners/cp/payout-status`,
      actionLabel: 'View Details',
      icon: '💰',
      color: '#16A34A',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
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
async function notifyRejected(data: CPApplicationNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Application Update</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.cpName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            We regret to inform you that your payout application has been rejected.
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
                  ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}
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
            If you believe this is an error or have questions about this decision, please contact our support team.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/partners/cp/payout-status"
               style="display: inline-block; background: #6B7280; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Contact Support
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
      to: data.cpEmail,
      subject: `Application Update: ${data.appId} - Action Required`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.cpPhone) {
    try {
      const smsMessage = `LOANZ360: Your payout application ${data.appId} has been rejected. ${data.reason ? `Reason: ${data.reason.substring(0, 60)}` : 'Check email for details.'} Contact support if needed.`

      await sendSMS(data.cpPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.cpUserId,
      type: 'error',
      category: 'payout',
      title: 'Application Rejected',
      message: `Your application ${data.appId} has been rejected. ${data.reason || 'Contact support for details.'}`,
      actionUrl: `/partners/cp/payout-status`,
      actionLabel: 'View Details',
      icon: '❌',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
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
async function notifyOnHold(data: CPApplicationNotificationData): Promise<NotificationResult> {
  const errors: string[] = []
  let email_sent = false
  let sms_sent = false
  let in_app_sent = false

  // Email notification
  try {
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #D97706 0%, #B45309 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Application On Hold ⏸️</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${data.cpName},</p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your payout application has been put on hold and requires your attention.
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
                  ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}
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
            Please provide the required information or documents to proceed with your application. Contact support if you need assistance.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/partners/cp/payout-status"
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
      to: data.cpEmail,
      subject: `Action Required: ${data.appId} - On Hold`,
      html: emailTemplate,
    })

    email_sent = true
  } catch (error) {
    errors.push(`Email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // SMS notification
  if (data.cpPhone) {
    try {
      const smsMessage = `LOANZ360: Your application ${data.appId} is ON HOLD. ${data.reason ? `Reason: ${data.reason.substring(0, 60)}` : 'Please check email for details.'}`

      await sendSMS(data.cpPhone, smsMessage)
      sms_sent = true
    } catch (error) {
      errors.push(`SMS failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // In-app notification
  try {
    await createInAppNotification({
      adminId: data.cpUserId,
      type: 'warning',
      category: 'payout',
      title: 'Application On Hold',
      message: `Your application ${data.appId} is on hold. ${data.reason || 'Action required.'}`,
      actionUrl: `/partners/cp/payout-status`,
      actionLabel: 'View Details',
      icon: '⏸️',
      metadata: {
        applicationId: data.applicationId,
        appId: data.appId,
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
 * Send internal notification to employees/admins
 */
export async function notifyInternalTeam(
  recipients: { userId: string; name: string; email: string; role: string }[],
  data: CPApplicationNotificationData,
  eventType: 'new_application' | 'verification_complete' | 'approval_needed' | 'payment_needed'
): Promise<void> {
  const templates: Record<typeof eventType, { subject: string; message: string }> = {
    new_application: {
      subject: `New CP Application: ${data.appId}`,
      message: `A new CP application ${data.appId} from ${data.cpName} requires verification. Amount: ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}`
    },
    verification_complete: {
      subject: `Verification Complete: ${data.appId}`,
      message: `Application ${data.appId} has been verified and requires Super Admin approval. Amount: ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}`
    },
    approval_needed: {
      subject: `Approval Needed: ${data.appId}`,
      message: `Application ${data.appId} requires your approval. Amount: ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}`
    },
    payment_needed: {
      subject: `Payment Processing: ${data.appId}`,
      message: `Application ${data.appId} is approved and ready for payment processing. Amount: ₹${data.expectedPayoutAmount.toLocaleString('en-IN')}`
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
        actionUrl: getActionUrl(recipient.role, data.status),
        actionLabel: 'View Application',
        icon: '📋',
        metadata: {
          applicationId: data.applicationId,
          appId: data.appId,
          status: data.status,
        },
      })
    } catch (error) {
      console.error(`Failed to notify ${recipient.name}:`, error)
    }
  }
}

/**
 * Get action URL based on role
 */
function getActionUrl(role: string, _status: CPPayoutStatus): string {
  switch (role) {
    case 'ACCOUNTS_EXECUTIVE':
      return '/employees/accounts-executive/cp-applications'
    case 'SUPER_ADMIN':
      return '/superadmin/payouts'
    case 'FINANCE_EXECUTIVE':
      return '/employees/finance-executive/cp-payouts'
    default:
      return '/dashboard'
  }
}
