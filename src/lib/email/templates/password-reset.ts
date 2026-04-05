/**
 * Password Reset Email Template
 * Professional, secure password reset emails for admin accounts
 */

export interface PasswordResetVariables {
  adminName: string
  resetLink: string
  expiryHours: number
  ipAddress: string
  userAgent: string
  requestedAt: string
}

export function getPasswordResetTemplate(variables: PasswordResetVariables): {
  subject: string
  html: string
  text: string
} {
  const { adminName, resetLink, expiryHours, ipAddress, userAgent, requestedAt } = variables

  const subject = 'Password Reset Request - LOANZ 360'

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    h1 {
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .content {
      margin-bottom: 30px;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      background-color: #1d4ed8;
    }
    .alt-link {
      margin-top: 20px;
      padding: 15px;
      background-color: #f9fafb;
      border-radius: 6px;
      font-size: 13px;
      word-break: break-all;
      color: #6b7280;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning-box strong {
      color: #92400e;
    }
    .info-box {
      background-color: #f0f9ff;
      border-left: 4px solid #0284c7;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
    }
    .security-details {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #6b7280;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #f0f0f0;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
    }
    .footer a {
      color: #2563eb;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">LOANZ 360</div>
      <p style="color: #6b7280; margin: 0;">Admin Management System</p>
    </div>

    <h1>Password Reset Request</h1>

    <div class="greeting">
      Hello ${adminName},
    </div>

    <div class="content">
      <p>
        We received a request to reset the password for your admin account. If you made this request,
        click the button below to reset your password:
      </p>

      <div class="button-container">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>

      <div class="alt-link">
        <strong>Or copy and paste this link:</strong><br>
        <a href="${resetLink}">${resetLink}</a>
      </div>

      <div class="warning-box">
        <strong>⚠️ Important:</strong> This link will expire in ${expiryHours} hours for security reasons.
      </div>

      <div class="info-box">
        <strong>Security Information:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>This link can only be used once</li>
          <li>After ${expiryHours} hours, you'll need to request a new password reset</li>
          <li>Your old password will continue to work until you set a new one</li>
        </ul>
      </div>

      <p>
        <strong>Didn't request this?</strong><br>
        If you didn't request a password reset, please ignore this email. Your password will not be changed.
        However, if you're concerned about the security of your account, please contact your system administrator immediately.
      </p>
    </div>

    <div class="security-details">
      <strong>Request Details:</strong>
      <ul style="margin: 5px 0; padding-left: 20px;">
        <li><strong>Time:</strong> ${requestedAt}</li>
        <li><strong>IP Address:</strong> ${ipAddress}</li>
        <li><strong>Browser:</strong> ${userAgent}</li>
      </ul>
      <p style="margin-top: 10px;">
        If you don't recognize this activity, please contact support immediately.
      </p>
    </div>

    <div class="footer">
      <p>
        This is an automated message from <strong>LOANZ 360</strong> Admin Management System.<br>
        Please do not reply to this email.
      </p>
      <p style="margin-top: 10px;">
        Need help? Contact your system administrator.
      </p>
    </div>
  </div>
</body>
</html>
`

  const text = `
LOANZ 360 - Password Reset Request

Hello ${adminName},

We received a request to reset the password for your admin account.

To reset your password, copy and paste the following link into your browser:
${resetLink}

⚠️ IMPORTANT: This link will expire in ${expiryHours} hours for security reasons.

Security Information:
- This link can only be used once
- After ${expiryHours} hours, you'll need to request a new password reset
- Your old password will continue to work until you set a new one

Didn't request this?
If you didn't request a password reset, please ignore this email. Your password will not be changed.
However, if you're concerned about the security of your account, please contact your system administrator immediately.

Request Details:
- Time: ${requestedAt}
- IP Address: ${ipAddress}
- Browser: ${userAgent}

If you don't recognize this activity, please contact support immediately.

---
This is an automated message from LOANZ 360 Admin Management System.
Please do not reply to this email.

Need help? Contact your system administrator.
`

  return {
    subject,
    html,
    text,
  }
}

/**
 * Password Reset Success Notification Template
 */
export function getPasswordResetSuccessTemplate(variables: {
  adminName: string
  resetAt: string
  ipAddress: string
  userAgent: string
}): {
  subject: string
  html: string
  text: string
} {
  const { adminName, resetAt, ipAddress, userAgent } = variables

  const subject = 'Password Changed Successfully - LOANZ 360'

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    .success-icon {
      font-size: 48px;
      margin: 20px 0;
    }
    h1 {
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .security-details {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #6b7280;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #f0f0f0;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">LOANZ 360</div>
      <p style="color: #6b7280; margin: 0;">Admin Management System</p>
    </div>

    <div style="text-align: center;">
      <div class="success-icon">✅</div>
      <h1>Password Changed Successfully</h1>
    </div>

    <div>
      <p>Hello ${adminName},</p>

      <p>
        This is a confirmation that your password was successfully changed. You can now use your new password
        to log in to your account.
      </p>

      <div class="warning-box">
        <strong>⚠️ Security Alert:</strong> If you did not make this change, please contact your system
        administrator immediately. Your account may be compromised.
      </div>
    </div>

    <div class="security-details">
      <strong>Change Details:</strong>
      <ul style="margin: 5px 0; padding-left: 20px;">
        <li><strong>Time:</strong> ${resetAt}</li>
        <li><strong>IP Address:</strong> ${ipAddress}</li>
        <li><strong>Browser:</strong> ${userAgent}</li>
      </ul>
    </div>

    <div class="footer">
      <p>
        This is an automated message from <strong>LOANZ 360</strong> Admin Management System.<br>
        Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
`

  const text = `
LOANZ 360 - Password Changed Successfully

Hello ${adminName},

✅ This is a confirmation that your password was successfully changed. You can now use your new password to log in to your account.

⚠️ SECURITY ALERT:
If you did not make this change, please contact your system administrator immediately. Your account may be compromised.

Change Details:
- Time: ${resetAt}
- IP Address: ${ipAddress}
- Browser: ${userAgent}

---
This is an automated message from LOANZ 360 Admin Management System.
Please do not reply to this email.
`

  return {
    subject,
    html,
    text,
  }
}
