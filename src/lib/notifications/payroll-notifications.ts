// =====================================================
// PAYROLL EMAIL NOTIFICATIONS
// Complete email notification system for payroll module
// =====================================================

import { createClient } from '@/lib/supabase/server'

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// =====================================================
// EMAIL SERVICE CONFIGURATION
// =====================================================

interface EmailConfig {
  from: string
  fromName: string
  replyTo?: string
}

const EMAIL_CONFIG: EmailConfig = {
  from: process.env.PAYROLL_EMAIL_FROM || 'payroll@loanz360.com',
  fromName: process.env.COMPANY_NAME || 'Loanz360 Payroll',
  replyTo: process.env.HR_EMAIL || 'hr@loanz360.com'
}

// =====================================================
// EMAIL TEMPLATES
// =====================================================

interface PayslipEmailData {
  employeeName: string
  month: string
  year: number
  grossSalary: number
  netSalary: number
  payslipUrl: string
}

function getPayslipEmailTemplate(data: PayslipEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${escapeHtml(data.month)} ${data.year}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
    .salary-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .salary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .salary-row:last-child { border-bottom: none; font-weight: bold; font-size: 1.1em; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 0.9em; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Your Payslip is Ready!</h1>
      <p>${escapeHtml(data.month)} ${data.year}</p>
    </div>
    <div class="content">
      <p>Dear ${escapeHtml(data.employeeName)},</p>

      <p>Your payslip for <strong>${escapeHtml(data.month)} ${data.year}</strong> has been generated and is now available for download.</p>

      <div class="salary-box">
        <div class="salary-row">
          <span>Gross Salary:</span>
          <span>₹${data.grossSalary.toLocaleString('en-IN')}</span>
        </div>
        <div class="salary-row">
          <span>Net Salary:</span>
          <span><strong>₹${data.netSalary.toLocaleString('en-IN')}</strong></span>
        </div>
      </div>

      <center>
        <a href="${data.payslipUrl}" class="button">📄 Download Payslip</a>
      </center>

      <p><small>Note: This is a system-generated email. Please do not reply to this email. For any queries, contact HR.</small></p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${EMAIL_CONFIG.fromName}. All rights reserved.</p>
      <p><small>This email contains confidential information. If you received this by mistake, please delete it.</small></p>
    </div>
  </div>
</body>
</html>
  `
}

function getTaxDeclarationReminderTemplate(employeeName: string, financialYear: string, deadline: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Declaration Reminder</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f39c12; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { background: #fff; padding: 20px; margin-top: 20px; border: 1px solid #ddd; border-radius: 5px; }
    .warning { background: #fff3cd; border-left: 4px solid #f39c12; padding: 15px; margin: 20px 0; }
    .button { display: inline-block; background: #f39c12; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Tax Declaration Reminder</h1>
    </div>
    <div class="content">
      <p>Dear ${escapeHtml(employeeName)},</p>

      <p>This is a friendly reminder to submit your tax declaration for <strong>FY ${escapeHtml(financialYear)}</strong>.</p>

      <div class="warning">
        <strong>⚠️ Deadline: ${escapeHtml(deadline)}</strong>
      </div>

      <p>Submit your investment proofs to save tax and optimize your take-home salary.</p>

      <p><strong>Documents you can submit:</strong></p>
      <ul>
        <li>LIC/Insurance Premiums (80C)</li>
        <li>PPF Deposits (80C)</li>
        <li>Home Loan Principal (80C)</li>
        <li>Tuition Fees (80C)</li>
        <li>NPS Contributions (80CCD)</li>
        <li>Health Insurance (80D)</li>
        <li>Education Loan Interest (80E)</li>
        <li>Rent Receipts (HRA)</li>
      </ul>

      <center>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/employees/employee/payroll/tax-declaration" class="button">Submit Declaration</a>
      </center>
    </div>
  </div>
</body>
</html>
  `
}

function getLoanApprovalTemplate(employeeName: string, loanType: string, loanAmount: number, status: 'APPROVED' | 'REJECTED', comments?: string): string {
  const isApproved = status === 'APPROVED'
  const color = isApproved ? '#27ae60' : '#e74c3c'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Loan ${escapeHtml(status)}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${color}; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { background: #fff; padding: 20px; margin-top: 20px; border: 1px solid #ddd; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isApproved ? '✅' : '❌'} Loan ${escapeHtml(status)}</h1>
    </div>
    <div class="content">
      <p>Dear ${escapeHtml(employeeName)},</p>

      <p>Your ${escapeHtml(loanType.toLowerCase())} loan application for <strong>₹${loanAmount.toLocaleString('en-IN')}</strong> has been <strong>${escapeHtml(status.toLowerCase())}</strong>.</p>

      ${comments ? `<p><strong>Comments:</strong> ${escapeHtml(comments)}</p>` : ''}

      ${isApproved ? `
        <p>The loan amount will be disbursed to your registered bank account within 3-5 business days.</p>
        <p>EMI deductions will start from next month's salary.</p>
      ` : `
        <p>For more information, please contact HR.</p>
      `}
    </div>
  </div>
</body>
</html>
  `
}

function getReimbursementStatusTemplate(employeeName: string, claimAmount: number, category: string, status: string, approvedAmount?: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reimbursement ${escapeHtml(status)}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3498db; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { background: #fff; padding: 20px; margin-top: 20px; border: 1px solid #ddd; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💼 Reimbursement Update</h1>
    </div>
    <div class="content">
      <p>Dear ${escapeHtml(employeeName)},</p>

      <p>Your <strong>${escapeHtml(category)}</strong> reimbursement claim has been <strong>${escapeHtml(status)}</strong>.</p>

      <p><strong>Claim Amount:</strong> ₹${claimAmount.toLocaleString('en-IN')}</p>

      ${approvedAmount ? `<p><strong>Approved Amount:</strong> ₹${approvedAmount.toLocaleString('en-IN')}</p>` : ''}

      ${status === 'APPROVED' ? `
        <p>The approved amount will be credited to your account with next month's salary.</p>
      ` : ''}
    </div>
  </div>
</body>
</html>
  `
}

// =====================================================
// EMAIL SENDING FUNCTIONS
// =====================================================

interface SendEmailParams {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType?: string
  }>
}

async function sendEmail(params: SendEmailParams): Promise<boolean> {
  try {
    // Check if email service is configured
    const resendApiKey = process.env.RESEND_API_KEY
    const sendgridApiKey = process.env.SENDGRID_API_KEY

    if (resendApiKey) {
      // Resend email integration
      const { Resend } = await import('resend')
      const resend = new Resend(resendApiKey)

      await resend.emails.send({
        from: `${EMAIL_CONFIG.fromName} <${EMAIL_CONFIG.from}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments?.map(a => ({
          filename: a.filename,
          content: typeof a.content === 'string' ? Buffer.from(a.content) : a.content
        }))
      })

      console.log('[EMAIL] Sent via Resend:', { to: params.to, subject: params.subject })
      return true
    }

    if (sendgridApiKey) {
      // SendGrid email integration
      const sgMail = await import('@sendgrid/mail')
      sgMail.default.setApiKey(sendgridApiKey)

      await sgMail.default.send({
        from: { name: EMAIL_CONFIG.fromName, email: EMAIL_CONFIG.from },
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments?.map(a => ({
          filename: a.filename,
          content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
          type: a.contentType || 'application/pdf',
          disposition: 'attachment'
        }))
      })

      console.log('[EMAIL] Sent via SendGrid:', { to: params.to, subject: params.subject })
      return true
    }

    // No email service configured — return false so is_emailed is NOT set to true
    console.warn('[EMAIL] No email service configured (set RESEND_API_KEY or SENDGRID_API_KEY). Email NOT sent:', {
      to: params.to,
      subject: params.subject
    })
    return false
  } catch (error) {
    console.error('[EMAIL] Failed to send email:', error)
    return false
  }
}

// =====================================================
// PAYROLL NOTIFICATION FUNCTIONS
// =====================================================

export async function sendPayslipEmail(payslipId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Fetch payslip details
    const { data: payslip, error } = await supabase
      .from('payslips')
      .select(`
        id,
        month,
        year,
        gross_salary,
        net_salary,
        pdf_url,
        user_id,
        users!inner(
          email,
          employee_profile!inner(
            first_name,
            last_name
          )
        )
      `)
      .eq('id', payslipId)
      .maybeSingle()

    if (error || !payslip) {
      console.error('Failed to fetch payslip:', error)
      return false
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const employeeName = `${payslip.users.employee_profile.first_name} ${payslip.users.employee_profile.last_name}`

    const emailData: PayslipEmailData = {
      employeeName,
      month: monthNames[payslip.month - 1],
      year: payslip.year,
      grossSalary: payslip.gross_salary,
      netSalary: payslip.net_salary,
      payslipUrl: payslip.pdf_url || `${process.env.NEXT_PUBLIC_APP_URL}/employees/employee/payroll/payslips`
    }

    const sent = await sendEmail({
      to: payslip.users.email,
      subject: `Payslip for ${emailData.month} ${emailData.year} - ${EMAIL_CONFIG.fromName}`,
      html: getPayslipEmailTemplate(emailData)
    })

    if (sent) {
      // Update email status
      await supabase
        .from('payslips')
        .update({
          is_emailed: true,
          emailed_at: new Date().toISOString(),
          email_to: payslip.users.email,
          email_status: 'sent'
        })
        .eq('id', payslipId)
    }

    return sent
  } catch (error) {
    console.error('Error sending payslip email:', error)
    return false
  }
}

export async function sendBulkPayslipEmails(payrollRunId: string): Promise<{ sent: number; failed: number }> {
  try {
    const supabase = await createClient()

    const { data: payslips } = await supabase
      .from('payslips')
      .select('id')
      .eq('payroll_run_id', payrollRunId)
      .eq('is_emailed', false)

    if (!payslips || payslips.length === 0) {
      return { sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0

    for (const payslip of payslips) {
      const success = await sendPayslipEmail(payslip.id)
      if (success) {
        sent++
      } else {
        failed++
      }
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return { sent, failed }
  } catch (error) {
    console.error('Error sending bulk payslip emails:', error)
    return { sent: 0, failed: 0 }
  }
}

export async function sendTaxDeclarationReminder(userId: string, financialYear: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: user } = await supabase
      .from('users')
      .select(`
        email,
        employee_profile!inner(
          first_name,
          last_name
        )
      `)
      .eq('id', userId)
      .maybeSingle()

    if (!user) return false

    const employeeName = `${user.employee_profile.first_name} ${user.employee_profile.last_name}`
    const deadline = 'March 31st'

    return await sendEmail({
      to: user.email,
      subject: `⏰ Reminder: Submit Tax Declaration for FY ${financialYear}`,
      html: getTaxDeclarationReminderTemplate(employeeName, financialYear, deadline)
    })
  } catch (error) {
    console.error('Error sending tax declaration reminder:', error)
    return false
  }
}

export async function sendLoanApprovalNotification(
  loanId: string,
  status: 'APPROVED' | 'REJECTED',
  comments?: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: loan } = await supabase
      .from('employee_loans')
      .select(`
        loan_type,
        loan_amount,
        employees!inner(
          user_id,
          users!inner(
            email,
            employee_profile!inner(
              first_name,
              last_name
            )
          )
        )
      `)
      .eq('id', loanId)
      .maybeSingle()

    if (!loan) return false

    const employeeName = `${loan.employees.users.employee_profile.first_name} ${loan.employees.users.employee_profile.last_name}`

    return await sendEmail({
      to: loan.employees.users.email,
      subject: `Loan Application ${status} - ${EMAIL_CONFIG.fromName}`,
      html: getLoanApprovalTemplate(employeeName, loan.loan_type, loan.loan_amount, status, comments)
    })
  } catch (error) {
    console.error('Error sending loan approval notification:', error)
    return false
  }
}

export async function sendReimbursementStatusNotification(
  reimbursementId: string,
  status: string,
  approvedAmount?: number
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: reimbursement } = await supabase
      .from('employee_reimbursements')
      .select(`
        claim_amount,
        category:reimbursement_categories(category_name),
        employees!inner(
          user_id,
          users!inner(
            email,
            employee_profile!inner(
              first_name,
              last_name
            )
          )
        )
      `)
      .eq('id', reimbursementId)
      .maybeSingle()

    if (!reimbursement) return false

    const employeeName = `${reimbursement.employees.users.employee_profile.first_name} ${reimbursement.employees.users.employee_profile.last_name}`

    return await sendEmail({
      to: reimbursement.employees.users.email,
      subject: `Reimbursement ${status} - ${EMAIL_CONFIG.fromName}`,
      html: getReimbursementStatusTemplate(
        employeeName,
        reimbursement.claim_amount,
        reimbursement.category.category_name,
        status,
        approvedAmount
      )
    })
  } catch (error) {
    console.error('Error sending reimbursement status notification:', error)
    return false
  }
}

// =====================================================
// SCHEDULED NOTIFICATION JOBS
// =====================================================

export async function sendPendingTaxDeclarationReminders(): Promise<number> {
  try {
    const supabase = await createClient()

    // Find employees who haven't submitted tax declaration
    const currentYear = new Date().getFullYear()
    const financialYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`

    const { data: employees } = await supabase
      .from('users')
      .select('id, email')
      .not('id', 'in', supabase
        .from('tax_declarations')
        .select('user_id')
        .eq('financial_year', financialYear)
        .eq('status', 'submitted')
      )

    if (!employees || employees.length === 0) return 0

    let sent = 0
    for (const employee of employees) {
      const success = await sendTaxDeclarationReminder(employee.id, financialYear)
      if (success) sent++
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return sent
  } catch (error) {
    console.error('Error sending tax declaration reminders:', error)
    return 0
  }
}
