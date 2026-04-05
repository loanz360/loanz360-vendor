/**
 * Super Admin Password Reset Email Template
 */

export function generateSuperAdminPasswordResetEmail(
  email: string,
  resetUrl: string,
  expiryMinutes: number = 60
): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Super Admin Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ff6600 0%, #ff8833 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔐</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Reset Your Password</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333333; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                Hello,
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                We received a request to reset the password for your Super Admin account:
              </p>

              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 0 0 30px 0;">
                <p style="color: #ff6600; font-size: 16px; font-weight: bold; margin: 0;">
                  ${email}
                </p>
              </div>

              <p style="color: #333333; font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
                Click the button below to reset your password:
              </p>

              <!-- Reset Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="display: inline-block; background: linear-gradient(135deg, #ff6600 0%, #ff8833 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(255, 102, 0, 0.3);">
                      Reset Password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #666666; font-size: 14px; line-height: 21px; margin: 30px 0 0 0;">
                Or copy and paste this link into your browser:
              </p>
              <p style="color: #ff6600; font-size: 12px; word-break: break-all; margin: 10px 0 0 0;">
                ${resetUrl}
              </p>

              <!-- Security Notice -->
              <div style="background-color: #fff3e0; border-left: 4px solid #ff6600; padding: 15px; margin: 30px 0 0 0; border-radius: 4px;">
                <p style="color: #333333; font-size: 14px; line-height: 21px; margin: 0 0 10px 0; font-weight: bold;">
                  ⚠️ Important Security Information:
                </p>
                <ul style="color: #666666; font-size: 14px; line-height: 21px; margin: 0; padding-left: 20px;">
                  <li>This link will expire in <strong>${expiryMinutes} minutes</strong></li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Never share this link with anyone</li>
                  <li>Contact your system administrator if you have concerns</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #eeeeee;">
              <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0 0 10px 0;">
                This is an automated security email from Loanz360
              </p>
              <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0;">
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

  const text = `
Reset Your Super Admin Password

Hello,

We received a request to reset the password for your Super Admin account: ${email}

Click the link below to reset your password:
${resetUrl}

IMPORTANT SECURITY INFORMATION:
- This link will expire in ${expiryMinutes} minutes
- If you didn't request this reset, please ignore this email
- Never share this link with anyone
- Contact your system administrator if you have concerns

This is an automated security email from Loanz360
© ${new Date().getFullYear()} Loanz360. All rights reserved.
  `

  return { html, text }
}
