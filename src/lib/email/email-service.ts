/**
 * Email Service
 * Centralized email sending functionality using Nodemailer
 * Supports SMTP (Gmail, SendGrid SMTP, AWS SES SMTP, custom SMTP servers)
 */

import nodemailer from 'nodemailer'
import logger from '@/lib/monitoring/logger'

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  from?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: Array<{
    filename: string
    content?: string
    path?: string
  }>
}

/**
 * Create email transporter
 * Configure based on environment variables
 */
function createTransporter() {
  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'

  // Option 1: SMTP Configuration (works with Gmail, SendGrid SMTP, AWS SES SMTP, etc.)
  if (emailProvider === 'smtp') {
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }

  // Option 2: SendGrid API (if using SendGrid directly)
  if (emailProvider === 'sendgrid') {
    // For SendGrid, you can use their SMTP or install @sendgrid/mail package
    return nodemailer.createTransporter({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    })
  }

  // Option 3: AWS SES SMTP
  if (emailProvider === 'ses') {
    return nodemailer.createTransporter({
      host: process.env.SES_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SES_SMTP_USER,
        pass: process.env.SES_SMTP_PASSWORD,
      },
    })
  }

  // Fallback to development mode (ethereal.email test account)
  logger.warn('No email provider configured. Using development mode.')
  return null
}

/**
 * Send email
 * @param payload Email payload with to, subject, html, etc.
 * @returns Promise<boolean> - true if sent successfully
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const transporter = createTransporter()

    // If no transporter configured, log and skip (useful for development)
    if (!transporter) {
      logger.info('📧 Email notification (DEV MODE - not sent)', {
        to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
        subject: payload.subject,
      })
      return true // Return true in dev mode to not break flows
    }

    const mailOptions = {
      from: payload.from || process.env.EMAIL_FROM || 'Loanz360 <noreply@loanz360.com>',
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      html: payload.html,
      cc: payload.cc,
      bcc: payload.bcc,
      attachments: payload.attachments,
    }

    const info = await transporter.sendMail(mailOptions)

    logger.info('✅ Email sent successfully', {
      messageId: info.messageId,
      to: Array.isArray(payload.to) ? payload.to.length : 1,
      subject: payload.subject,
    })

    return true
  } catch (error) {
    logger.error('❌ Failed to send email', error instanceof Error ? error : undefined, {
      to: Array.isArray(payload.to) ? payload.to.length : 1,
      subject: payload.subject,
    })
    return false
  }
}

/**
 * Send bulk emails (for mass notifications)
 * Sends emails in batches to avoid rate limiting
 */
export async function sendBulkEmails(
  recipients: string[],
  subject: string,
  html: string,
  batchSize: number = 50
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  // Split into batches
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)

    const success = await sendEmail({
      to: batch,
      subject,
      html,
    })

    if (success) {
      sent += batch.length
    } else {
      failed += batch.length
    }

    // Wait 1 second between batches to avoid rate limiting
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  logger.info(`Bulk email completed: ${sent} sent, ${failed} failed`)

  return { sent, failed }
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
