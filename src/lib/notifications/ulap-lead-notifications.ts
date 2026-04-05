/**
 * ULAP Lead Notifications Service
 * Unified notification system for all lead-related events
 *
 * Integrates with the existing notification infrastructure to send
 * multi-channel notifications for lead lifecycle events.
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/communication/email-service'
import { sendSMS } from '@/lib/communication/sms-service'
import { createInAppNotification, renderTemplate } from './notification-service'

// ============================================================================
// TYPES
// ============================================================================

export type LeadNotificationType =
  | 'LEAD_CREATED'
  | 'LEAD_ASSIGNED'
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_CONTACTED'
  | 'DOCUMENTS_REQUESTED'
  | 'DOCUMENTS_RECEIVED'
  | 'CAM_GENERATED'
  | 'LEAD_APPROVED'
  | 'LEAD_REJECTED'
  | 'LEAD_DISBURSED'
  | 'FOLLOW_UP_REMINDER'
  | 'LEAD_ESCALATED'
  | 'REFERRAL_BONUS'

export interface LeadNotificationParams {
  type: LeadNotificationType
  leadId: string
  leadNumber: string
  customerName: string
  customerMobile: string
  customerEmail?: string
  loanType: string
  loanAmount: number
  // Recipients
  customerId?: string
  partnerId?: string
  employeeId?: string
  bdeId?: string
  bdeName?: string
  // Additional context
  previousStatus?: string
  newStatus?: string
  reason?: string
  referralCode?: string
  referrerName?: string
  camScore?: number
  approvalAmount?: number
  disbursementAmount?: number
  nextFollowUp?: Date
  // Channels to send on
  channels?: ('email' | 'sms' | 'in_app' | 'whatsapp')[]
}

export interface NotificationResult {
  success: boolean
  channels: {
    email?: { sent: boolean; error?: string }
    sms?: { sent: boolean; error?: string }
    in_app?: { sent: boolean; error?: string }
    whatsapp?: { sent: boolean; error?: string }
  }
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

const NOTIFICATION_TEMPLATES: Record<LeadNotificationType, {
  customer?: { sms: string; email: { subject: string; body: string } }
  partner?: { sms: string; email: { subject: string; body: string } }
  employee?: { sms: string; inApp: { title: string; message: string } }
  bde?: { sms: string; inApp: { title: string; message: string } }
}> = {
  LEAD_CREATED: {
    customer: {
      sms: 'Dear {{customer_name}}, your {{loan_type}} application for ₹{{loan_amount}} has been received. Application ID: {{lead_number}}. Our team will contact you shortly. - LOANZ360',
      email: {
        subject: 'Application Received - {{lead_number}}',
        body: `
          <h2>Your Loan Application Has Been Received!</h2>
          <p>Dear {{customer_name}},</p>
          <p>Thank you for applying for a <strong>{{loan_type}}</strong> with LOANZ 360.</p>
          <p><strong>Application Details:</strong></p>
          <ul>
            <li>Application ID: <strong>{{lead_number}}</strong></li>
            <li>Loan Amount: <strong>₹{{loan_amount}}</strong></li>
          </ul>
          <p>Our team will review your application and contact you within 24-48 hours.</p>
          <p>You can track your application status at: <a href="{{tracking_url}}">Track Application</a></p>
        `,
      },
    },
    partner: {
      sms: 'New lead {{lead_number}} created for {{customer_name}} - {{loan_type}} ₹{{loan_amount}}. Check your dashboard. - LOANZ360',
      email: {
        subject: 'New Lead Created - {{lead_number}}',
        body: `
          <h2>New Lead Created Successfully</h2>
          <p>A new lead has been created:</p>
          <ul>
            <li>Lead ID: <strong>{{lead_number}}</strong></li>
            <li>Customer: <strong>{{customer_name}}</strong></li>
            <li>Loan Type: <strong>{{loan_type}}</strong></li>
            <li>Amount: <strong>₹{{loan_amount}}</strong></li>
          </ul>
          <p>The lead has been assigned to {{bde_name}} for processing.</p>
        `,
      },
    },
    bde: {
      sms: 'New lead assigned: {{customer_name}} - {{loan_type}} ₹{{loan_amount}}. Lead ID: {{lead_number}}. - LOANZ360',
      inApp: {
        title: 'New Lead Assigned',
        message: 'New lead {{lead_number}} - {{customer_name}} ({{loan_type}} ₹{{loan_amount}}) has been assigned to you.',
      },
    },
  },

  LEAD_ASSIGNED: {
    customer: {
      sms: 'Dear {{customer_name}}, your application {{lead_number}} has been assigned to {{bde_name}}. They will contact you soon. - LOANZ360',
      email: {
        subject: 'Loan Executive Assigned - {{lead_number}}',
        body: `
          <h2>Your Dedicated Loan Executive</h2>
          <p>Dear {{customer_name}},</p>
          <p>Your loan application <strong>{{lead_number}}</strong> has been assigned to:</p>
          <p><strong>{{bde_name}}</strong></p>
          <p>They will contact you shortly to guide you through the process.</p>
        `,
      },
    },
    bde: {
      sms: 'Lead {{lead_number}} assigned: {{customer_name}} - {{loan_type}} ₹{{loan_amount}}. Contact: {{customer_mobile}}. - LOANZ360',
      inApp: {
        title: 'Lead Assigned to You',
        message: '{{customer_name}} - {{loan_type}} for ₹{{loan_amount}}. Please contact the customer.',
      },
    },
  },

  LEAD_STATUS_CHANGED: {
    customer: {
      sms: 'Dear {{customer_name}}, your application {{lead_number}} status updated to {{new_status}}. Track at loanz360.com - LOANZ360',
      email: {
        subject: 'Application Status Update - {{lead_number}}',
        body: `
          <h2>Application Status Update</h2>
          <p>Dear {{customer_name}},</p>
          <p>Your loan application <strong>{{lead_number}}</strong> status has been updated:</p>
          <p>Previous Status: {{previous_status}}</p>
          <p>Current Status: <strong>{{new_status}}</strong></p>
          <p>Track your application: <a href="{{tracking_url}}">View Status</a></p>
        `,
      },
    },
    partner: {
      sms: 'Lead {{lead_number}} status changed: {{previous_status}} → {{new_status}}. - LOANZ360',
      email: {
        subject: 'Lead Status Update - {{lead_number}}',
        body: `
          <h2>Lead Status Update</h2>
          <p>Lead <strong>{{lead_number}}</strong> status has changed:</p>
          <ul>
            <li>Customer: {{customer_name}}</li>
            <li>Previous Status: {{previous_status}}</li>
            <li>Current Status: <strong>{{new_status}}</strong></li>
          </ul>
        `,
      },
    },
  },

  LEAD_CONTACTED: {
    customer: {
      sms: 'Dear {{customer_name}}, we tried reaching you regarding application {{lead_number}}. Please call back or expect a call soon. - LOANZ360',
      email: {
        subject: 'We Tried to Reach You - {{lead_number}}',
        body: `
          <h2>Contact Attempt</h2>
          <p>Dear {{customer_name}},</p>
          <p>Our executive tried reaching you regarding your loan application <strong>{{lead_number}}</strong>.</p>
          <p>Please expect a call from us or call us back at your convenience.</p>
        `,
      },
    },
  },

  DOCUMENTS_REQUESTED: {
    customer: {
      sms: 'Dear {{customer_name}}, please upload required documents for application {{lead_number}}. Visit our portal or reply to this message. - LOANZ360',
      email: {
        subject: 'Documents Required - {{lead_number}}',
        body: `
          <h2>Documents Required for Your Application</h2>
          <p>Dear {{customer_name}},</p>
          <p>To proceed with your loan application <strong>{{lead_number}}</strong>, we need the following documents:</p>
          <ul>
            <li>Identity Proof (Aadhaar/PAN/Passport)</li>
            <li>Address Proof</li>
            <li>Income Proof (Salary slips/ITR/Bank statements)</li>
          </ul>
          <p>Please upload them through our portal or share with your assigned executive.</p>
        `,
      },
    },
  },

  DOCUMENTS_RECEIVED: {
    customer: {
      sms: 'Dear {{customer_name}}, documents received for application {{lead_number}}. We are now processing your application. - LOANZ360',
      email: {
        subject: 'Documents Received - {{lead_number}}',
        body: `
          <h2>Documents Received Successfully</h2>
          <p>Dear {{customer_name}},</p>
          <p>We have received your documents for application <strong>{{lead_number}}</strong>.</p>
          <p>Our team is now processing your application. You will be notified once the review is complete.</p>
        `,
      },
    },
    bde: {
      sms: 'Documents received for lead {{lead_number}} - {{customer_name}}. Ready for processing. - LOANZ360',
      inApp: {
        title: 'Documents Received',
        message: 'Documents uploaded for {{lead_number}} - {{customer_name}}. Ready for review.',
      },
    },
  },

  CAM_GENERATED: {
    bde: {
      sms: 'CAM generated for lead {{lead_number}}. Score: {{cam_score}}. Review and proceed. - LOANZ360',
      inApp: {
        title: 'CAM Report Ready',
        message: 'Credit Assessment for {{lead_number}} is ready. Score: {{cam_score}}.',
      },
    },
    partner: {
      sms: 'CAM generated for your lead {{lead_number}}. Customer: {{customer_name}}. - LOANZ360',
      email: {
        subject: 'CAM Generated - {{lead_number}}',
        body: `
          <h2>Credit Assessment Complete</h2>
          <p>Credit Assessment Memorandum has been generated for lead <strong>{{lead_number}}</strong>.</p>
          <ul>
            <li>Customer: {{customer_name}}</li>
            <li>Loan Type: {{loan_type}}</li>
            <li>Requested Amount: ₹{{loan_amount}}</li>
          </ul>
          <p>The application is under final review.</p>
        `,
      },
    },
  },

  LEAD_APPROVED: {
    customer: {
      sms: 'Congratulations {{customer_name}}! Your {{loan_type}} for ₹{{approval_amount}} is APPROVED! Application: {{lead_number}}. We will contact you for next steps. - LOANZ360',
      email: {
        subject: '🎉 Loan Approved - {{lead_number}}',
        body: `
          <h2>Congratulations! Your Loan is Approved! 🎉</h2>
          <p>Dear {{customer_name}},</p>
          <p>We are delighted to inform you that your <strong>{{loan_type}}</strong> application has been <strong>APPROVED</strong>!</p>
          <p><strong>Approval Details:</strong></p>
          <ul>
            <li>Application ID: {{lead_number}}</li>
            <li>Approved Amount: <strong>₹{{approval_amount}}</strong></li>
          </ul>
          <p>Our team will contact you shortly for the disbursement process.</p>
        `,
      },
    },
    partner: {
      sms: 'Great news! Lead {{lead_number}} APPROVED for ₹{{approval_amount}}! Customer: {{customer_name}}. - LOANZ360',
      email: {
        subject: '✅ Lead Approved - {{lead_number}}',
        body: `
          <h2>Lead Approved!</h2>
          <p>Your lead has been approved:</p>
          <ul>
            <li>Lead ID: {{lead_number}}</li>
            <li>Customer: {{customer_name}}</li>
            <li>Approved Amount: ₹{{approval_amount}}</li>
          </ul>
          <p>Commission will be processed upon disbursement.</p>
        `,
      },
    },
    bde: {
      sms: 'Lead {{lead_number}} APPROVED! Amount: ₹{{approval_amount}}. Proceed with disbursement. - LOANZ360',
      inApp: {
        title: '✅ Lead Approved',
        message: '{{lead_number}} - {{customer_name}} approved for ₹{{approval_amount}}!',
      },
    },
  },

  LEAD_REJECTED: {
    customer: {
      sms: 'Dear {{customer_name}}, we regret that your application {{lead_number}} could not be approved at this time. Contact us for details. - LOANZ360',
      email: {
        subject: 'Application Update - {{lead_number}}',
        body: `
          <h2>Application Update</h2>
          <p>Dear {{customer_name}},</p>
          <p>We regret to inform you that your loan application <strong>{{lead_number}}</strong> could not be approved at this time.</p>
          <p>{{reason}}</p>
          <p>Please feel free to contact us for more details or to discuss alternative options.</p>
        `,
      },
    },
    partner: {
      sms: 'Lead {{lead_number}} not approved. Customer: {{customer_name}}. Reason: {{reason}} - LOANZ360',
      email: {
        subject: 'Lead Not Approved - {{lead_number}}',
        body: `
          <h2>Lead Not Approved</h2>
          <p>Lead <strong>{{lead_number}}</strong> could not be approved:</p>
          <ul>
            <li>Customer: {{customer_name}}</li>
            <li>Reason: {{reason}}</li>
          </ul>
        `,
      },
    },
  },

  LEAD_DISBURSED: {
    customer: {
      sms: 'Dear {{customer_name}}, ₹{{disbursement_amount}} has been disbursed to your account for {{loan_type}}. Ref: {{lead_number}}. Thank you for choosing LOANZ360!',
      email: {
        subject: '💰 Loan Disbursed - {{lead_number}}',
        body: `
          <h2>Loan Amount Disbursed! 💰</h2>
          <p>Dear {{customer_name}},</p>
          <p>Your loan amount has been successfully disbursed!</p>
          <p><strong>Disbursement Details:</strong></p>
          <ul>
            <li>Application ID: {{lead_number}}</li>
            <li>Loan Type: {{loan_type}}</li>
            <li>Amount Disbursed: <strong>₹{{disbursement_amount}}</strong></li>
          </ul>
          <p>Thank you for choosing LOANZ 360. We wish you all the best!</p>
        `,
      },
    },
    partner: {
      sms: 'Disbursed! Lead {{lead_number}} - ₹{{disbursement_amount}}. Commission will be processed soon. - LOANZ360',
      email: {
        subject: '💰 Disbursement Complete - {{lead_number}}',
        body: `
          <h2>Loan Disbursed - Commission Eligible!</h2>
          <p>Lead <strong>{{lead_number}}</strong> has been disbursed:</p>
          <ul>
            <li>Customer: {{customer_name}}</li>
            <li>Amount Disbursed: ₹{{disbursement_amount}}</li>
          </ul>
          <p>Your commission will be processed as per the payout schedule.</p>
        `,
      },
    },
  },

  FOLLOW_UP_REMINDER: {
    bde: {
      sms: 'Reminder: Follow up with {{customer_name}} ({{lead_number}}) today. - LOANZ360',
      inApp: {
        title: '📞 Follow-up Reminder',
        message: 'Time to follow up with {{customer_name}} for lead {{lead_number}}.',
      },
    },
  },

  LEAD_ESCALATED: {
    bde: {
      sms: 'Lead {{lead_number}} has been escalated. Reason: {{reason}}. Action required. - LOANZ360',
      inApp: {
        title: '⚠️ Lead Escalated',
        message: 'Lead {{lead_number}} escalated: {{reason}}',
      },
    },
  },

  REFERRAL_BONUS: {
    partner: {
      sms: 'Congrats! You earned referral bonus for lead {{lead_number}} from {{customer_name}}. Check your dashboard. - LOANZ360',
      email: {
        subject: '🎁 Referral Bonus Earned!',
        body: `
          <h2>You Earned a Referral Bonus! 🎁</h2>
          <p>Great news! Your referral has resulted in a successful lead.</p>
          <ul>
            <li>Lead ID: {{lead_number}}</li>
            <li>Customer: {{customer_name}}</li>
          </ul>
          <p>Your referral bonus will be processed as per the payout schedule.</p>
        `,
      },
    },
  },
}

// ============================================================================
// MAIN NOTIFICATION FUNCTION
// ============================================================================

/**
 * Send ULAP lead notifications
 */
export async function sendLeadNotification(
  params: LeadNotificationParams
): Promise<NotificationResult> {
  const result: NotificationResult = {
    success: true,
    channels: {},
  }

  const template = NOTIFICATION_TEMPLATES[params.type]
  if (!template) {
    console.error(`No template found for notification type: ${params.type}`)
    return { success: false, channels: {} }
  }

  const channels = params.channels || ['email', 'sms', 'in_app']

  // Prepare variables for template rendering
  const variables = {
    customer_name: params.customerName,
    customer_mobile: params.customerMobile,
    lead_number: params.leadNumber,
    loan_type: params.loanType,
    loan_amount: formatCurrency(params.loanAmount),
    bde_name: params.bdeName || 'our executive',
    previous_status: params.previousStatus || '',
    new_status: params.newStatus || '',
    reason: params.reason || '',
    cam_score: params.camScore || '',
    approval_amount: params.approvalAmount ? formatCurrency(params.approvalAmount) : '',
    disbursement_amount: params.disbursementAmount ? formatCurrency(params.disbursementAmount) : '',
    tracking_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'}/customers/track?id=${params.leadNumber}`,
    referrer_name: params.referrerName || '',
  }

  // Send to customer
  if (template.customer) {
    if (channels.includes('sms') && params.customerMobile) {
      result.channels.sms = await sendSMSNotification(
        params.customerMobile,
        renderTemplate(template.customer.sms, variables)
      )
    }

    if (channels.includes('email') && params.customerEmail) {
      result.channels.email = await sendEmailNotification(
        params.customerEmail,
        renderTemplate(template.customer.email.subject, variables),
        renderTemplate(template.customer.email.body, variables)
      )
    }
  }

  // Send to partner
  if (template.partner && params.partnerId) {
    const partnerDetails = await getPartnerDetails(params.partnerId)
    if (partnerDetails) {
      if (channels.includes('sms') && partnerDetails.mobile) {
        await sendSMSNotification(
          partnerDetails.mobile,
          renderTemplate(template.partner.sms, variables)
        )
      }

      if (channels.includes('email') && partnerDetails.email) {
        await sendEmailNotification(
          partnerDetails.email,
          renderTemplate(template.partner.email.subject, variables),
          renderTemplate(template.partner.email.body, variables)
        )
      }
    }
  }

  // Send to BDE
  if (template.bde && params.bdeId) {
    const bdeDetails = await getEmployeeDetails(params.bdeId)
    if (bdeDetails) {
      if (channels.includes('sms') && bdeDetails.mobile) {
        await sendSMSNotification(
          bdeDetails.mobile,
          renderTemplate(template.bde.sms, variables)
        )
      }

      if (channels.includes('in_app')) {
        await createInAppNotification({
          adminId: params.bdeId,
          type: getNotificationType(params.type),
          category: 'leads',
          title: renderTemplate(template.bde.inApp.title, variables),
          message: renderTemplate(template.bde.inApp.message, variables),
          actionUrl: `/employees/leads/${params.leadId}`,
          actionLabel: 'View Lead',
          icon: getNotificationIcon(params.type),
          metadata: { leadId: params.leadId, leadNumber: params.leadNumber },
        })
        result.channels.in_app = { sent: true }
      }
    }
  }

  // Log notification
  await logNotification(params, result)

  return result
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function sendSMSNotification(
  to: string,
  message: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    await sendSMS(to, message)
    return { sent: true }
  } catch (error) {
    console.error('SMS notification failed:', error)
    return { sent: false, error: String(error) }
  }
}

async function sendEmailNotification(
  to: string,
  subject: string,
  body: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    await sendEmail({
      to,
      subject,
      html: wrapEmailTemplate(body),
    })
    return { sent: true }
  } catch (error) {
    console.error('Email notification failed:', error)
    return { sent: false, error: String(error) }
  }
}

function wrapEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h2 { color: #f97316; }
        ul { padding-left: 20px; }
        li { margin-bottom: 8px; }
        a { color: #f97316; }
        strong { color: #1a1a1a; }
      </style>
    </head>
    <body>
      ${content}
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
      <p style="font-size: 12px; color: #888;">
        This is an automated message from LOANZ 360.<br>
        Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}

async function getPartnerDetails(partnerId: string): Promise<{ mobile: string; email: string } | null> {
  const supabase = createSupabaseAdmin()
  const { data } = await supabase
    .from('partners')
    .select('mobile_number, email')
    .eq('id', partnerId)
    .maybeSingle()

  return data ? { mobile: data.mobile_number, email: data.email } : null
}

async function getEmployeeDetails(employeeId: string): Promise<{ mobile: string; email: string } | null> {
  const supabase = createSupabaseAdmin()
  const { data } = await supabase
    .from('employees')
    .select('mobile_number, email')
    .eq('id', employeeId)
    .maybeSingle()

  return data ? { mobile: data.mobile_number, email: data.email } : null
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function getNotificationType(type: LeadNotificationType): 'success' | 'info' | 'warning' | 'error' {
  const successTypes: LeadNotificationType[] = ['LEAD_APPROVED', 'LEAD_DISBURSED', 'REFERRAL_BONUS']
  const warningTypes: LeadNotificationType[] = ['DOCUMENTS_REQUESTED', 'FOLLOW_UP_REMINDER', 'LEAD_ESCALATED']
  const errorTypes: LeadNotificationType[] = ['LEAD_REJECTED']

  if (successTypes.includes(type)) return 'success'
  if (warningTypes.includes(type)) return 'warning'
  if (errorTypes.includes(type)) return 'error'
  return 'info'
}

function getNotificationIcon(type: LeadNotificationType): string {
  const icons: Record<LeadNotificationType, string> = {
    LEAD_CREATED: '📝',
    LEAD_ASSIGNED: '👤',
    LEAD_STATUS_CHANGED: '🔄',
    LEAD_CONTACTED: '📞',
    DOCUMENTS_REQUESTED: '📄',
    DOCUMENTS_RECEIVED: '✅',
    CAM_GENERATED: '📊',
    LEAD_APPROVED: '🎉',
    LEAD_REJECTED: '❌',
    LEAD_DISBURSED: '💰',
    FOLLOW_UP_REMINDER: '⏰',
    LEAD_ESCALATED: '⚠️',
    REFERRAL_BONUS: '🎁',
  }
  return icons[type] || '🔔'
}

async function logNotification(
  params: LeadNotificationParams,
  result: NotificationResult
): Promise<void> {
  try {
    const supabase = createSupabaseAdmin()
    await supabase.from('lead_notification_logs').insert({
      lead_id: params.leadId,
      lead_number: params.leadNumber,
      notification_type: params.type,
      customer_name: params.customerName,
      customer_mobile: params.customerMobile,
      customer_email: params.customerEmail,
      partner_id: params.partnerId,
      employee_id: params.employeeId,
      bde_id: params.bdeId,
      channels_attempted: Object.keys(result.channels),
      channels_succeeded: Object.entries(result.channels)
        .filter(([, v]) => v?.sent)
        .map(([k]) => k),
      result: result,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to log notification:', error)
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Send lead created notification
 */
export async function notifyLeadCreated(
  leadId: string,
  leadNumber: string,
  customerName: string,
  customerMobile: string,
  customerEmail: string | undefined,
  loanType: string,
  loanAmount: number,
  partnerId?: string,
  bdeId?: string,
  bdeName?: string
): Promise<NotificationResult> {
  return sendLeadNotification({
    type: 'LEAD_CREATED',
    leadId,
    leadNumber,
    customerName,
    customerMobile,
    customerEmail,
    loanType,
    loanAmount,
    partnerId,
    bdeId,
    bdeName,
  })
}

/**
 * Send lead approved notification
 */
export async function notifyLeadApproved(
  leadId: string,
  leadNumber: string,
  customerName: string,
  customerMobile: string,
  customerEmail: string | undefined,
  loanType: string,
  loanAmount: number,
  approvalAmount: number,
  partnerId?: string,
  bdeId?: string
): Promise<NotificationResult> {
  return sendLeadNotification({
    type: 'LEAD_APPROVED',
    leadId,
    leadNumber,
    customerName,
    customerMobile,
    customerEmail,
    loanType,
    loanAmount,
    approvalAmount,
    partnerId,
    bdeId,
  })
}

/**
 * Send lead disbursed notification
 */
export async function notifyLeadDisbursed(
  leadId: string,
  leadNumber: string,
  customerName: string,
  customerMobile: string,
  customerEmail: string | undefined,
  loanType: string,
  loanAmount: number,
  disbursementAmount: number,
  partnerId?: string,
  bdeId?: string
): Promise<NotificationResult> {
  return sendLeadNotification({
    type: 'LEAD_DISBURSED',
    leadId,
    leadNumber,
    customerName,
    customerMobile,
    customerEmail,
    loanType,
    loanAmount,
    disbursementAmount,
    partnerId,
    bdeId,
  })
}

/**
 * Send status change notification
 */
export async function notifyStatusChange(
  leadId: string,
  leadNumber: string,
  customerName: string,
  customerMobile: string,
  customerEmail: string | undefined,
  loanType: string,
  loanAmount: number,
  previousStatus: string,
  newStatus: string,
  partnerId?: string
): Promise<NotificationResult> {
  return sendLeadNotification({
    type: 'LEAD_STATUS_CHANGED',
    leadId,
    leadNumber,
    customerName,
    customerMobile,
    customerEmail,
    loanType,
    loanAmount,
    previousStatus,
    newStatus,
    partnerId,
  })
}

/**
 * Send follow-up reminder
 */
export async function notifyFollowUpReminder(
  leadId: string,
  leadNumber: string,
  customerName: string,
  customerMobile: string,
  loanType: string,
  loanAmount: number,
  bdeId: string
): Promise<NotificationResult> {
  return sendLeadNotification({
    type: 'FOLLOW_UP_REMINDER',
    leadId,
    leadNumber,
    customerName,
    customerMobile,
    loanType,
    loanAmount,
    bdeId,
    channels: ['sms', 'in_app'],
  })
}

export default {
  sendLeadNotification,
  notifyLeadCreated,
  notifyLeadApproved,
  notifyLeadDisbursed,
  notifyStatusChange,
  notifyFollowUpReminder,
}
