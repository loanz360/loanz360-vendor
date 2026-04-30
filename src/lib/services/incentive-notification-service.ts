/**
 * Incentive Notification Service
 * Handles email notifications for incentive-related events
 */

import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/monitoring/logger'
import { sendEmail as sendEmailService, sendBulkEmails } from '@/lib/email/email-service'

interface NotificationPayload {
  to: string[]
  subject: string
  html: string
  category?: string
}

/**
 * Send email notification using the centralized email service
 */
async function sendEmail(payload: NotificationPayload): Promise<boolean> {
  try {
    // Use bulk email service for multiple recipients
    if (payload.to.length > 1) {
      const result = await sendBulkEmails(payload.to, payload.subject, payload.html)
      return result.sent > 0
    }

    // Single email
    return await sendEmailService({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    })
  } catch (error) {
    logger.error('Failed to send email notification', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Send incentive launch notification to eligible employees
 */
export async function sendIncentiveLaunchNotification(
  incentiveId: string,
  incentiveTitle: string,
  rewardAmount: number,
  endDate: string,
  targetEmployeeIds: string[]
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Get employee emails
    const { data: employees, error } = await supabase
      .from('employees')
      .select('email, full_name')
      .in('id', targetEmployeeIds)

    if (error || !employees) {
      logger.error('Failed to fetch employee emails', error)
      return false
    }

    const emails = employees.map((e) => e.email).filter(Boolean)

    if (emails.length === 0) {
      logger.warn('No valid emails found for incentive launch notification')
      return false
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Incentive Program Launched</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ec4899 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                🎁 New Incentive Program!
              </h1>
              <p style="margin: 10px 0 0; color: #fef3c7; font-size: 16px;">
                An exciting opportunity awaits you
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: bold;">
                ${incentiveTitle}
              </h2>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">
                  💰 Reward: ₹${rewardAmount.toLocaleString()}
                </p>
              </div>

              <p style="margin: 0 0 15px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                A new incentive program has been launched specifically for you! This is your chance to earn exciting rewards by achieving your performance targets.
              </p>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #6b7280; font-size: 14px;">📅 Valid Until:</span>
                      <span style="color: #111827; font-size: 14px; font-weight: 600; margin-left: 10px;">
                        ${new Date(endDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Log in to your dashboard to view complete details, track your progress, and start working towards earning this reward!
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/employees/incentives" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      View Incentive Details
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                <strong>Questions?</strong> Contact your manager or HR department for more information about this incentive program.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                © ${new Date().getFullYear()} Loanz360. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    return await sendEmail({
      to: emails,
      subject: `🎁 New Incentive: ${incentiveTitle}`,
      html,
      category: 'incentive_launch',
    })
  } catch (error) {
    logger.error('Error in sendIncentiveLaunchNotification', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Send achievement congratulations email
 */
export async function sendAchievementNotification(
  employeeId: string,
  incentiveTitle: string,
  earnedAmount: number
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: employee, error } = await supabase
      .from('employees')
      .select('email, full_name')
      .eq('id', employeeId)
      .maybeSingle()

    if (error || !employee || !employee.email) {
      logger.error('Failed to fetch employee email', error)
      return false
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Congratulations on Your Achievement!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 64px; margin-bottom: 15px;">🎉</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Congratulations, ${employee.full_name}!
              </h1>
              <p style="margin: 10px 0 0; color: #dbeafe; font-size: 16px;">
                You've achieved your target!
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                We're thrilled to inform you that you've successfully achieved the target for:
              </p>

              <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: bold; text-align: center;">
                ${incentiveTitle}
              </h2>

              <div style="background: linear-gradient(135deg, #d1fae5 0%, #dbeafe 100%); border: 2px solid #10b981; padding: 30px; margin: 30px 0; border-radius: 12px; text-align: center;">
                <p style="margin: 0 0 10px; color: #047857; font-size: 16px; font-weight: 600;">
                  You've Earned
                </p>
                <p style="margin: 0; color: #065f46; font-size: 42px; font-weight: bold;">
                  ₹${earnedAmount.toLocaleString()}
                </p>
              </div>

              <p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your hard work and dedication have paid off! You can now submit a claim to receive your reward.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/employees/incentives" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Claim Your Reward
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                <strong>Next Steps:</strong> Log in to your dashboard and click on "MyTargets & Incentives" to submit your claim. Your claim will be reviewed by the admin team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                © ${new Date().getFullYear()} Loanz360. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    return await sendEmail({
      to: [employee.email],
      subject: `🎉 Congratulations! You've achieved ${incentiveTitle}`,
      html,
      category: 'achievement',
    })
  } catch (error) {
    logger.error('Error in sendAchievementNotification', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Send expiry reminder notification
 */
export async function sendExpiryReminderNotification(
  incentiveId: string,
  incentiveTitle: string,
  daysRemaining: number
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Get all allocations for this incentive that are still in progress
    const { data: allocations, error } = await supabase
      .from('incentive_allocations')
      .select(
        `
        user_id,
        progress_percentage,
        user:employees!incentive_allocations_user_id_fkey(email, full_name)
      `
      )
      .eq('incentive_id', incentiveId)
      .in('allocation_status', ['eligible', 'in_progress'])

    if (error || !allocations) {
      logger.error('Failed to fetch allocations for expiry reminder', error)
      return false
    }

    const emails = allocations.map((a: unknown) => a.user.email).filter(Boolean)

    if (emails.length === 0) {
      logger.warn('No valid emails found for expiry reminder')
      return false
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Incentive Expiring Soon</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 64px; margin-bottom: 15px;">⏰</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Incentive Expiring Soon!
              </h1>
              <p style="margin: 10px 0 0; color: #fef3c7; font-size: 16px;">
                Only ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                This is a friendly reminder that the following incentive program is expiring soon:
              </p>

              <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: bold; text-align: center;">
                ${incentiveTitle}
              </h2>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">
                  ⚠️ Only ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left to achieve your target!
                </p>
              </div>

              <p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Don't miss out on this opportunity! Log in to your dashboard to check your current progress and see what you need to do to achieve this incentive.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/employees/incentives" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Check My Progress
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                <strong>Tip:</strong> Focus on the remaining requirements and push hard to achieve this target before time runs out!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                © ${new Date().getFullYear()} Loanz360. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    return await sendEmail({
      to: emails,
      subject: `⏰ Reminder: ${incentiveTitle} expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`,
      html,
      category: 'expiry_reminder',
    })
  } catch (error) {
    logger.error('Error in sendExpiryReminderNotification', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Send claim approved notification
 */
export async function sendClaimApprovedNotification(
  employeeId: string,
  incentiveTitle: string,
  claimedAmount: number
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: employee, error } = await supabase
      .from('employees')
      .select('email, full_name')
      .eq('id', employeeId)
      .maybeSingle()

    if (error || !employee || !employee.email) {
      return false
    }

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px;">
    <h1 style="color: #10b981;">✅ Claim Approved!</h1>
    <p>Dear ${employee.full_name},</p>
    <p>Great news! Your claim for <strong>${incentiveTitle}</strong> has been approved.</p>
    <div style="background: #d1fae5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="font-size: 24px; color: #065f46; font-weight: bold;">₹${claimedAmount.toLocaleString()}</p>
    </div>
    <p>The payment will be processed soon. You'll receive another notification once the payment is completed.</p>
    <p>Thank you for your hard work!</p>
  </div>
</body>
</html>
    `

    return await sendEmail({
      to: [employee.email],
      subject: `✅ Your claim for ${incentiveTitle} has been approved`,
      html,
      category: 'claim_approved',
    })
  } catch (error) {
    logger.error('Error in sendClaimApprovedNotification', error instanceof Error ? error : undefined)
    return false
  }
}
