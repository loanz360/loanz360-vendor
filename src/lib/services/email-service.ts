/**
 * Email Service
 * Handles sending emails for notifications
 */

interface EmailOptions {
  to: string[]
  subject: string
  html: string
  from?: string
}

/**
 * Send email using configured email service
 * This is a placeholder implementation - you'll need to configure your email provider
 * Popular options: Resend, SendGrid, AWS SES, Nodemailer
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // TODO: Configure your email service provider
    // Example for Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: options.from || 'Loanz360 <notifications@loanz360.com>',
    //   to: options.to,
    //   subject: options.subject,
    //   html: options.html
    // })


    // For now, just return true to indicate success
    // In production, implement actual email sending
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

/**
 * Generate notification email HTML template
 */
export function generateNotificationEmailHTML(data: {
  title: string
  message: string
  notificationType: string
  priority: string
  senderName: string
  recipientName: string
}): string {
  const priorityColors: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f97316',
    normal: '#6b7280',
    low: '#10b981'
  }

  const typeEmojis: Record<string, string> = {
    announcement: '📢',
    alert: '⚠️',
    update: '📢',
    reminder: '⏰',
    celebration: '🎉',
    custom: '📝'
  }

  const priorityColor = priorityColors[data.priority] || priorityColors.normal
  const typeEmoji = typeEmojis[data.notificationType] || '📬'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                ${typeEmoji} Loanz360 Notification
              </h1>
            </td>
          </tr>

          <!-- Priority Badge -->
          <tr>
            <td style="padding: 20px 30px 10px;">
              <div style="display: inline-block; background-color: ${priorityColor}; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                ${data.priority} Priority
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 10px 30px 30px;">
              <h2 style="margin: 0 0 15px; color: #1f2937; font-size: 20px; font-weight: 600;">
                ${data.title}
              </h2>
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${data.message}
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Sent by <strong>${data.senderName}</strong>
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 30px; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'}/employees/notifications"
                 style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                View in Dashboard
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated notification from Loanz360
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
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
  `.trim()
}
