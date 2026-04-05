interface NotificationEmailProps {
  title: string
  message: string
  messageHtml?: string
  senderName: string
  imageUrl?: string
  actionUrl?: string
  actionLabel?: string
  priority: string
  notificationUrl: string
}

/**
 * Generate HTML email content as a string (compatible with Next.js 15 App Router)
 */
export function generateEmailHtml({
  title,
  message,
  messageHtml,
  senderName,
  imageUrl,
  actionUrl,
  actionLabel,
  priority,
  notificationUrl
}: NotificationEmailProps): string {
  const priorityColors: Record<string, string> = {
    urgent: '#DC2626',
    high: '#FF6700',
    normal: '#3B82F6',
    low: '#6B7280'
  }

  const priorityColor = priorityColors[priority] || priorityColors.normal
  const currentYear = new Date().getFullYear()
  const settingsUrl = `${notificationUrl.split('/notifications')[0]}/settings/notifications`

  const imageSection = imageUrl ? `
    <tr>
      <td style="padding: 0 32px 24px 32px;">
        <img
          src="${imageUrl}"
          alt="Notification banner"
          style="width: 100%; height: auto; border-radius: 8px; display: block;"
        />
      </td>
    </tr>` : ''

  const actionButtonSection = (actionUrl && actionLabel) ? `
    <tr>
      <td style="padding: 0 32px 24px 32px;">
        <a
          href="${actionUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="display: inline-block; background-color: #FF6700; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;"
        >
          ${actionLabel}
        </a>
      </td>
    </tr>` : ''

  const messageContent = messageHtml
    ? `<div style="font-size: 16px; line-height: 1.6; color: #374151;">${messageHtml}</div>`
    : `<p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${message}</p>`

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Priority Bar -->
            <tr>
              <td style="background-color: ${priorityColor}; height: 4px;"></td>
            </tr>

            <!-- Header -->
            <tr>
              <td style="padding: 32px 32px 24px 32px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 8px;">
                        LOANZ 360
                      </div>
                      <div style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                        Notification from ${senderName}
                      </div>
                    </td>
                    <td align="right">
                      <div style="background-color: ${priorityColor}; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                        ${priority}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Banner Image -->
            ${imageSection}

            <!-- Title -->
            <tr>
              <td style="padding: 0 32px 16px 32px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #111827; line-height: 1.4;">
                  ${title}
                </h1>
              </td>
            </tr>

            <!-- Message -->
            <tr>
              <td style="padding: 0 32px 24px 32px;">
                ${messageContent}
              </td>
            </tr>

            <!-- Action Button -->
            ${actionButtonSection}

            <!-- View Notification Button -->
            <tr>
              <td style="padding: 0 32px 32px 32px;">
                <a
                  href="${notificationUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="display: inline-block; background-color: #ffffff; color: #FF6700; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; border: 2px solid #FF6700;"
                >
                  View in LOANZ 360
                </a>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 0 32px;">
                <div style="border-top: 1px solid #e5e7eb; margin: 0;"></div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 32px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                  You received this notification because you are a member of LOANZ 360.
                </p>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                  To manage your notification preferences, visit your <a href="${settingsUrl}" style="color: #FF6700; text-decoration: none;">settings page</a>.
                </p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  © ${currentYear} LOANZ 360. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// Plain text version for email clients that don't support HTML
export function generatePlainTextEmail({
  title,
  message,
  senderName,
  priority,
  actionUrl,
  actionLabel,
  notificationUrl
}: NotificationEmailProps): string {
  let plainText = `LOANZ 360 - ${priority.toUpperCase()} NOTIFICATION\n\n`
  plainText += `From: ${senderName}\n\n`
  plainText += `${title}\n`
  plainText += `${'='.repeat(title.length)}\n\n`
  plainText += `${message}\n\n`

  if (actionUrl && actionLabel) {
    plainText += `${actionLabel}: ${actionUrl}\n\n`
  }

  plainText += `View in LOANZ 360: ${notificationUrl}\n\n`
  plainText += `---\n`
  plainText += `You received this notification because you are a member of LOANZ 360.\n`
  plainText += `Manage your notification preferences: ${notificationUrl.split('/notifications')[0]}/settings/notifications\n\n`
  plainText += `© ${new Date().getFullYear()} LOANZ 360. All rights reserved.`

  return plainText
}
