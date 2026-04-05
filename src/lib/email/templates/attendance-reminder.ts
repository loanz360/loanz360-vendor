// Plain HTML email template to avoid @react-email Html component conflict with Next.js

interface AttendanceReminderProps {
  employeeName: string
  reminderType: 'check-in' | 'check-out' | 'missing'
  date: string
  actionUrl: string
}

export const AttendanceReminderEmail = ({
  employeeName,
  reminderType,
  date,
  actionUrl
}: AttendanceReminderProps): string => {
  const getReminderMessage = () => {
    switch (reminderType) {
      case 'check-in':
        return "Don't forget to check in for today!"
      case 'check-out':
        return "Remember to check out before leaving!"
      case 'missing':
        return "You have missing attendance records."
      default:
        return "Attendance reminder"
    }
  }

  const getReminderDetails = () => {
    switch (reminderType) {
      case 'check-in':
        return "Please mark your attendance by checking in through the employee portal."
      case 'check-out':
        return "Please complete your attendance by checking out through the employee portal."
      case 'missing':
        return "You have one or more missing attendance records. Please regularize them through the employee portal."
      default:
        return "Please update your attendance."
    }
  }

  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attendance Reminder</title>
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif; margin: 0; padding: 20px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0 48px; margin-bottom: 64px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
    <h1 style="font-size: 32px; font-weight: bold; text-align: center; margin: 0 0 30px; color: #ff6b00;">LOANZ360</h1>

    <div style="text-align: center; margin: 20px 0;">
      <p style="font-size: 64px; margin: 0;">⏰</p>
      <p style="font-size: 24px; font-weight: bold; color: #32325d; margin: 16px 0;">Attendance Reminder</p>
    </div>

    <p style="color: #525f7f; font-size: 16px; line-height: 24px; text-align: left; margin: 16px 40px;">Hi ${employeeName},</p>

    <p style="color: #525f7f; font-size: 16px; line-height: 24px; text-align: left; margin: 16px 40px;">
      <strong>${getReminderMessage()}</strong>
    </p>

    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 40px;">
      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Date:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${date}</p>

      <p style="color: #8898aa; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px;">Action Required:</p>
      <p style="color: #32325d; font-size: 16px; margin: 0 0 12px;">${getReminderDetails()}</p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${actionUrl}" style="background-color: #ff6b00; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: inline-block; padding: 12px 32px;">
        Mark Attendance
      </a>
    </div>

    <hr style="border-color: #e6ebf1; margin: 20px 40px;">

    <p style="color: #8898aa; font-size: 12px; line-height: 16px; text-align: center; margin: 20px 40px;">
      This is an automated reminder from LOANZ360 Attendance Management System.
      Regular and timely attendance marking helps maintain accurate records.
    </p>
  </div>
</body>
</html>
  `.trim()
}

export default AttendanceReminderEmail
