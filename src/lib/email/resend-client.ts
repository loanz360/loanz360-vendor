/**
 * Resend Email Service
 * Free tier: 100 emails/day, 3,000 emails/month
 * Perfect for development and small production use
 */

import { Resend } from 'resend'

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY

if (!resendApiKey && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️ RESEND_API_KEY not found in environment variables. Email sending will fail.')
}

// Only initialize Resend if API key is available
// Use a placeholder key during build time to prevent errors
export const resend = new Resend(resendApiKey || 're_placeholder_key_for_build_only')

// Default sender email (must be verified in Resend dashboard)
export const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
export const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME || 'Loanz360'

/**
 * Send email using Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
}: {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
}) {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    })

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`)
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email sending failed:', error)
    throw error
  }
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!resendApiKey
}
