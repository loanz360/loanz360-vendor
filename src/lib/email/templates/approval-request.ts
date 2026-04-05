// Plain HTML email template to avoid @react-email Html component conflict with Next.js

interface ApprovalRequestProps {
  approverName: string
  employeeName: string
  leaveType: string
  fromDate: string
  toDate: string
  totalDays: number
  reason: string
  actionUrl: string
}

export const ApprovalRequestEmail = ({
  approverName,
  employeeName,
  leaveType,
  fromDate,
  toDate,
  totalDays,
  reason,
  actionUrl
}: ApprovalRequestProps): string => {
  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Leave Request Awaiting Approval</title>
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif; margin: 0; padding: 20px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0 48px; margin-bottom: 64px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
    <h1 style="font-size: 32px; font-weight: bold; text-align: center; margin: 0 0 30px; color: #ff6b00;">LOANZ360</h1>

    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; padding: 8px 24px; border-radius: 24px; background-color: #f97316; color: #ffffff; font-size: 14px; font-weight: bold;">
        ⏰ Action Required
      </span>
    </div>

    <p style="color: #525f7f; font-size: 16px; line-height: 24px; text-align: left; margin: 16px 40px;">Hi ${approverName},</p>

    <p style="color: #525f7f; font-size: 16px; line-height: 24px; text-align: left; margin: 16px 40px;">
      <strong>${employeeName}</strong> has submitted a leave request that requires your approval.
    </p>

    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 40px;">
      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Employee:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${employeeName}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Leave Type:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${leaveType}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">From Date:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${fromDate}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">To Date:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${toDate}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Total Days:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${totalDays}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Reason:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${reason}</p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${actionUrl}" style="background-color: #ff6b00; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: inline-block; padding: 12px 32px;">
        Review Request
      </a>
    </div>

    <hr style="border-color: #e6ebf1; margin: 20px 40px;">

    <p style="color: #8898aa; font-size: 12px; line-height: 16px; text-align: center; margin: 20px 40px;">
      Please review and take action on this request at your earliest convenience.
    </p>
  </div>
</body>
</html>
  `.trim()
}

export default ApprovalRequestEmail
