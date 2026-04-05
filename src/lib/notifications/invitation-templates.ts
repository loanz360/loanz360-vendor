/**
 * Invitation Notification Templates
 * Email and SMS templates for member invitations
 */

export interface InvitationEmailData {
  inviteeName: string
  inviterName?: string
  entityName: string
  roleName: string
  inviteCode: string
  invitationLink: string
  personalMessage?: string
  expiresAt: Date
}

export interface InvitationSMSData {
  inviteeName: string
  entityName: string
  inviteCode: string
  invitationLink: string
}

/**
 * Generate HTML email for member invitation
 */
export function generateInvitationEmailHTML(data: InvitationEmailData): string {
  const formattedExpiry = data.expiresAt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join ${data.entityName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
    }
    .invitation-box {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .invitation-box h3 {
      margin: 0 0 15px;
      color: #f97316;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #666;
      font-size: 14px;
    }
    .detail-value {
      font-weight: 600;
      color: #333;
    }
    .personal-message {
      background: #fff8f0;
      border-left: 4px solid #f97316;
      padding: 15px;
      margin: 20px 0;
      font-style: italic;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: white !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .cta-button:hover {
      opacity: 0.9;
    }
    .text-center {
      text-align: center;
    }
    .expiry-notice {
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 12px 15px;
      font-size: 14px;
      color: #92400e;
      margin: 20px 0;
    }
    .invite-code {
      background: #f3f4f6;
      font-family: monospace;
      font-size: 14px;
      padding: 8px 12px;
      border-radius: 4px;
      color: #374151;
    }
    .footer {
      background: #1f2937;
      color: #9ca3af;
      padding: 30px;
      text-align: center;
      font-size: 13px;
    }
    .footer a {
      color: #f97316;
      text-decoration: none;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: white;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">LOANZ360</div>
      <h1>You're Invited! 🎉</h1>
      <p>Join ${data.entityName} on LOANZ360</p>
    </div>

    <div class="content">
      <p class="greeting">Hi ${data.inviteeName},</p>

      <p>You've been invited to join <strong>${data.entityName}</strong> as a <strong>${data.roleName}</strong> on LOANZ360, India's most trusted loan management platform.</p>

      ${data.personalMessage ? `
      <div class="personal-message">
        <strong>Personal message:</strong><br>
        "${data.personalMessage}"
      </div>
      ` : ''}

      <div class="invitation-box">
        <h3>Invitation Details</h3>
        <div class="detail-row">
          <span class="detail-label">Entity</span>
          <span class="detail-value">${data.entityName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Your Role</span>
          <span class="detail-value">${data.roleName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Invite Code</span>
          <span class="invite-code">${data.inviteCode}</span>
        </div>
      </div>

      <div class="text-center">
        <a href="${data.invitationLink}" class="cta-button">Accept Invitation</a>
      </div>

      <div class="expiry-notice">
        ⏰ This invitation expires on <strong>${formattedExpiry}</strong>. Please accept before then.
      </div>

      <p style="font-size: 14px; color: #666;">
        If you weren't expecting this invitation or don't recognize the sender, you can safely ignore this email.
      </p>

      <p style="font-size: 14px; color: #666; margin-top: 20px;">
        If the button doesn't work, copy and paste this link in your browser:<br>
        <a href="${data.invitationLink}" style="color: #f97316; word-break: break-all;">${data.invitationLink}</a>
      </p>
    </div>

    <div class="footer">
      <p><strong>LOANZ360</strong></p>
      <p>India's Most Trusted Loan Management Platform</p>
      <p style="margin-top: 15px;">
        <a href="https://loanz360.com">Website</a> •
        <a href="https://loanz360.com/privacy">Privacy Policy</a> •
        <a href="https://loanz360.com/terms">Terms of Service</a>
      </p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} LOANZ360. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text email for member invitation
 */
export function generateInvitationEmailText(data: InvitationEmailData): string {
  const formattedExpiry = data.expiresAt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return `
Hi ${data.inviteeName},

You've been invited to join ${data.entityName} as a ${data.roleName} on LOANZ360!

${data.personalMessage ? `Personal message: "${data.personalMessage}"\n` : ''}
INVITATION DETAILS
------------------
Entity: ${data.entityName}
Your Role: ${data.roleName}
Invite Code: ${data.inviteCode}

ACCEPT YOUR INVITATION
----------------------
Click here to accept: ${data.invitationLink}

Or use invite code: ${data.inviteCode}

⏰ This invitation expires on ${formattedExpiry}

If you weren't expecting this invitation, you can safely ignore this email.

---
LOANZ360
India's Most Trusted Loan Management Platform
https://loanz360.com
  `.trim()
}

/**
 * Generate SMS text for member invitation
 */
export function generateInvitationSMS(data: InvitationSMSData): string {
  // SMS should be concise (< 160 chars ideally)
  const shortLink = data.invitationLink.replace('https://', '').replace('http://', '')

  return `Hi ${data.inviteeName}, you've been invited to join ${data.entityName} on LOANZ360 as a partner. Accept here: ${shortLink}`
}

/**
 * Generate WhatsApp message for member invitation
 */
export function generateInvitationWhatsApp(data: InvitationSMSData & { roleName: string; personalMessage?: string }): string {
  let message = `🎉 *You're Invited to Join ${data.entityName}!*

Hi ${data.inviteeName},

You've been invited to join *${data.entityName}* as a *${data.roleName}* on LOANZ360.`

  if (data.personalMessage) {
    message += `

💬 _"${data.personalMessage}"_`
  }

  message += `

✅ *Accept your invitation:*
${data.invitationLink}

📱 Or use code: \`${data.inviteCode}\`

_LOANZ360 - India's Most Trusted Loan Management Platform_`

  return message
}

/**
 * Reminder email subject and preview
 */
export function generateReminderSubject(entityName: string): string {
  return `Reminder: Your invitation to join ${entityName} is waiting!`
}

/**
 * Generate email subject
 */
export function generateInvitationSubject(entityName: string): string {
  return `You're invited to join ${entityName} on LOANZ360`
}
