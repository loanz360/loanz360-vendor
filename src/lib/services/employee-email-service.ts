/**
 * Employee Email Service
 * Uses Resend (same as send-email.ts) for sending employee lifecycle emails
 */

import { Resend } from 'resend'
import { logger } from '@/lib/utils/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'LOANZ360 HR <noreply@loanz360.com>'

export const EMAIL_CONFIG = {
  LOGIN_URL: `${process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'}/employees/auth/login`,
  RESET_PASSWORD_URL: `${process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'}/employees/auth/reset-password`,
}

interface WelcomeEmailData {
  employee: {
    employee_id: string
    full_name: string
    work_email: string
    personal_email: string
    department: string
    sub_role: string
    joining_date: string
  }
  credentials: {
    username: string
    temporary_password: string
    login_url: string
  }
}

/**
 * Send welcome email with credentials to new employee
 * Sends to personal email (since work email IS the login)
 */
export async function sendEmployeeWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
  try {
    const html = generateWelcomeEmailHTML(data)

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.employee.personal_email,
      subject: `Welcome to LOANZ360 - Your Employee Account is Ready (${data.employee.employee_id})`,
      html
    })

    if (result.error) {
      logger.error('Resend error sending welcome email:', result.error)
      return false
    }

    logger.info(`Welcome email sent to ${data.employee.personal_email} (Resend ID: ${result.data?.id})`)
    return true
  } catch (error) {
    logger.error('Failed to send welcome email:', error)
    return false
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(employee: {
  full_name: string
  personal_email: string
  reset_link: string
}): Promise<boolean> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: employee.personal_email,
      subject: 'LOANZ360 - Password Reset Request',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #FF6700 0%, #FF8533 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Password Reset</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hello ${employee.full_name},</p>
            <p>A password reset was requested for your LOANZ360 employee account.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${employee.reset_link}" style="display: inline-block; background: #FF6700; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #6b7280; font-size: 13px;">If you didn't request this, please ignore this email or contact HR immediately.</p>
          </div>
        </div>
      `
    })

    return !result.error
  } catch (error) {
    logger.error('Failed to send password reset email:', error)
    return false
  }
}

/**
 * Send status change notification
 */
export async function sendStatusChangeEmail(employee: {
  full_name: string
  personal_email: string
  old_status: string
  new_status: string
  reason?: string
}): Promise<boolean> {
  try {
    const statusLabels: Record<string, string> = {
      'PENDING_ONBOARDING': 'Pending Onboarding',
      'ACTIVE': 'Active',
      'ON_LEAVE': 'On Leave',
      'SUSPENDED': 'Suspended',
      'TERMINATED': 'Terminated',
      'RESIGNED': 'Resigned',
      'PENDING_PROFILE_REVIEW': 'Profile Under Review',
      'NEEDS_PROFILE_CORRECTION': 'Profile Needs Correction',
    }

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: employee.personal_email,
      subject: `LOANZ360 - Your Employment Status Has Been Updated`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #FF6700 0%, #FF8533 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Status Update</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hello ${employee.full_name},</p>
            <p>Your employment status has been updated:</p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Previous:</strong> ${statusLabels[employee.old_status] || employee.old_status}</p>
              <p style="margin: 5px 0;"><strong>Updated to:</strong> ${statusLabels[employee.new_status] || employee.new_status}</p>
              ${employee.reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${employee.reason}</p>` : ''}
            </div>
            <p>If you have questions, please contact your HR representative.</p>
          </div>
        </div>
      `
    })

    return !result.error
  } catch (error) {
    logger.error('Failed to send status change email:', error)
    return false
  }
}

/**
 * Generate HTML template for welcome email — LOANZ360 branded
 */
function generateWelcomeEmailHTML(data: WelcomeEmailData): string {
  const subRoleLabel = data.employee.sub_role.replace(/_/g, ' ')
  const joiningDate = new Date(data.employee.joining_date).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to LOANZ360</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FF6700 0%, #FF8533 50%, #FF6700 100%); color: white; padding: 35px 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Welcome to LOANZ360</h1>
          <p style="margin: 0; font-size: 15px; opacity: 0.9;">We're excited to have you onboard, ${data.employee.full_name}!</p>
        </div>

        <!-- Content -->
        <div style="background: white; padding: 35px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

          <p style="font-size: 16px; margin-bottom: 5px;">Hello <strong>${data.employee.full_name}</strong>,</p>

          <p>Congratulations on joining the team! You've been onboarded as <strong>${subRoleLabel}</strong> in the <strong>${data.employee.department}</strong> department.</p>

          <p>Your official joining date is <strong>${joiningDate}</strong>.</p>

          <!-- Credentials Box -->
          <div style="background: #FFF7ED; border: 2px solid #FF6700; border-radius: 10px; padding: 24px; margin: 25px 0;">
            <h3 style="margin: 0 0 16px 0; color: #FF6700; font-size: 16px;">Your Login Credentials</h3>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 12px; background: #FFF; border-radius: 6px; margin-bottom: 8px;">
                  <span style="font-size: 12px; color: #FF6700; font-weight: 600; text-transform: uppercase;">Employee ID</span><br>
                  <span style="font-family: 'Courier New', monospace; font-size: 15px; color: #171717; font-weight: 600;">${data.employee.employee_id}</span>
                </td>
              </tr>
              <tr><td style="height: 8px;"></td></tr>
              <tr>
                <td style="padding: 10px 12px; background: #FFF; border-radius: 6px;">
                  <span style="font-size: 12px; color: #FF6700; font-weight: 600; text-transform: uppercase;">Login Email (Username)</span><br>
                  <span style="font-family: 'Courier New', monospace; font-size: 15px; color: #171717; font-weight: 600;">${data.credentials.username}</span>
                </td>
              </tr>
              <tr><td style="height: 8px;"></td></tr>
              <tr>
                <td style="padding: 10px 12px; background: #FFF; border-radius: 6px;">
                  <span style="font-size: 12px; color: #FF6700; font-weight: 600; text-transform: uppercase;">Temporary Password</span><br>
                  <span style="font-family: 'Courier New', monospace; font-size: 15px; color: #171717; font-weight: 600;">${data.credentials.temporary_password}</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Security Warning -->
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 14px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <strong style="color: #92400E;">Important Security Notice:</strong><br>
            <span style="color: #78350F; font-size: 14px;">You will be required to change your password on first login. Keep your credentials safe and do not share them.</span>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.credentials.login_url}" style="display: inline-block; background: #FF6700; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">Login to Your Account</a>
          </div>

          <!-- Next Steps -->
          <h3 style="color: #171717; margin-bottom: 10px;">What's Next?</h3>
          <ol style="padding-left: 20px; color: #4B5563; font-size: 14px;">
            <li style="margin-bottom: 6px;">Log in using the credentials above</li>
            <li style="margin-bottom: 6px;">Change your temporary password</li>
            <li style="margin-bottom: 6px;">Complete your employee profile (all fields are mandatory)</li>
            <li style="margin-bottom: 6px;">Submit your profile for HR review</li>
            <li style="margin-bottom: 6px;">Once approved, all portal features will be unlocked</li>
          </ol>

          <p style="margin-top: 25px;">If you have any questions, please reach out to your HR representative.</p>

          <p style="margin-top: 20px;">
            <strong>Best regards,</strong><br>
            <span style="color: #FF6700;">LOANZ360 HR Team</span>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 20px; padding: 15px;">
          <p style="margin: 0;">This is an automated message from LOANZ360. Please do not reply to this email.</p>
          <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} LOANZ360. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate temporary password (kept for backward compatibility)
 * The API route now has its own crypto.randomInt-based version
 */
export function generateTemporaryPassword(): string {
  const crypto = require('crypto')
  const length = 12
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const special = '!@#$%^&*'
  const allChars = uppercase + lowercase + digits + special

  let password = ''
  password += uppercase[crypto.randomInt(0, uppercase.length)]
  password += lowercase[crypto.randomInt(0, lowercase.length)]
  password += digits[crypto.randomInt(0, digits.length)]
  password += special[crypto.randomInt(0, special.length)]

  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)]
  }

  const arr = password.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}
