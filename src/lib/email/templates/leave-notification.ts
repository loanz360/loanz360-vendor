// Plain HTML email template to avoid @react-email Html component conflict with Next.js

interface LeaveNotificationProps {
  employeeName: string
  leaveType: string
  fromDate: string
  toDate: string
  totalDays: number
  status: 'approved' | 'rejected' | 'pending'
  approverName?: string
  rejectionReason?: string
  actionUrl?: string
}

export const LeaveNotificationEmail = ({
  employeeName,
  leaveType,
  fromDate,
  toDate,
  totalDays,
  status,
  approverName,
  rejectionReason,
  actionUrl
}: LeaveNotificationProps): string => {
  const statusColor = status === 'approved' ? '#22c55e' : status === 'rejected' ? '#ef4444' : '#f97316'
  const statusText = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending Approval'

  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leave Request ${statusText}</title>
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif; margin: 0; padding: 20px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0 48px; margin-bottom: 64px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
    <h1 style="font-size: 32px; font-weight: bold; text-align: center; margin: 0 0 30px; color: #ff6b00;">LOANZ360</h1>

    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; padding: 8px 24px; border-radius: 24px; color: #ffffff; font-size: 14px; font-weight: bold; text-transform: uppercase; background-color: ${statusColor};">
        ${statusText}
      </span>
    </div>

    <p style="color: #525f7f; font-size: 16px; line-height: 24px; text-align: left; margin: 16px 40px;">Hi ${employeeName},</p>

    <p style="color: #525f7f; font-size: 16px; line-height: 24px; text-align: left; margin: 16px 40px;">
      Your leave request has been <strong>${statusText.toLowerCase()}</strong>.
    </p>

    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 40px;">
      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Leave Type:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${leaveType}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">From Date:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${fromDate}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">To Date:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${toDate}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Total Days:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${totalDays}</p>

      ${approverName ? `
      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">
        ${status === 'approved' ? 'Approved By:' : 'Rejected By:'}
      </p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${approverName}</p>
      ` : ''}

      ${rejectionReason ? `
      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Reason:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${rejectionReason}</p>
      ` : ''}
    </div>

    ${actionUrl ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${actionUrl}" style="background-color: #ff6b00; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: inline-block; padding: 12px 32px;">
        View Details
      </a>
    </div>
    ` : ''}

    <hr style="border-color: #e6ebf1; margin: 20px 40px;">

    <p style="color: #8898aa; font-size: 12px; line-height: 16px; text-align: center; margin: 20px 40px;">
      This is an automated notification from LOANZ360 Attendance Management System.
    </p>
  </div>
</body>
</html>
  `.trim()
}

export default LeaveNotificationEmail
