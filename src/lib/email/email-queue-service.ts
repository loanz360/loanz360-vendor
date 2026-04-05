/**
 * Email Queue Service
 * Enterprise email notification system with queue, templates, and preferences
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { sendEmail } from './email-service'
import logger from '@/lib/monitoring/logger'

export interface EmailTemplate {
  template_key: string
  template_name: string
  category: string
  subject_template: string
  html_template: string
  text_template: string
  template_variables: string[]
}

export interface EmailQueueItem {
  id: string
  recipient_email: string
  recipient_name: string | null
  subject: string
  html_body: string
  text_body: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  priority: number
  attempts: number
  max_attempts: number
  template_data: Record<string, any> | null
}

/**
 * Render template with data
 * Simple Handlebars-like template rendering
 */
export function renderTemplate(template: string, data: Record<string, any>): string {
  let rendered = template

  // Replace {{variable}} with values
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(regex, String(value ?? ''))
  }

  // Handle {{#if condition}} ... {{/if}} blocks
  rendered = rendered.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
    return data[condition] ? content : ''
  })

  // Clean up any remaining template tags
  rendered = rendered.replace(/\{\{.*?\}\}/g, '')

  return rendered
}

/**
 * Queue an email for delivery
 */
export async function queueEmail(params: {
  recipient_admin_id?: string
  recipient_email: string
  recipient_name: string
  template_key: string
  template_data: Record<string, any>
  priority?: number
  scheduled_for?: Date
}): Promise<string | null> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase.rpc('queue_email', {
      p_recipient_admin_id: params.recipient_admin_id || null,
      p_recipient_email: params.recipient_email,
      p_recipient_name: params.recipient_name,
      p_template_key: params.template_key,
      p_template_data: params.template_data,
      p_priority: params.priority || 5,
      p_scheduled_for: params.scheduled_for?.toISOString() || null
    })

    if (error) {
      logger.error('Failed to queue email', error, { template_key: params.template_key })
      return null
    }

    logger.info('Email queued successfully', {
      email_id: data,
      template_key: params.template_key,
      recipient: params.recipient_email
    })

    return data
  } catch (error) {
    logger.error('Failed to queue email', error instanceof Error ? error : undefined)
    return null
  }
}

/**
 * Send welcome email to new admin
 */
export async function sendWelcomeEmail(params: {
  admin_id: string
  admin_name: string
  admin_email: string
  admin_unique_id: string
  reset_password_url: string
}): Promise<string | null> {
  return await queueEmail({
    recipient_admin_id: params.admin_id,
    recipient_email: params.admin_email,
    recipient_name: params.admin_name,
    template_key: 'admin_welcome',
    template_data: {
      admin_name: params.admin_name,
      admin_unique_id: params.admin_unique_id,
      admin_email: params.admin_email,
      reset_password_url: params.reset_password_url
    },
    priority: 3 // High priority
  })
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: {
  admin_id: string
  admin_name: string
  admin_email: string
  reset_url: string
  expiry_hours?: number
}): Promise<string | null> {
  return await queueEmail({
    recipient_admin_id: params.admin_id,
    recipient_email: params.admin_email,
    recipient_name: params.admin_name,
    template_key: 'password_reset',
    template_data: {
      admin_name: params.admin_name,
      reset_url: params.reset_url,
      expiry_hours: params.expiry_hours || 24
    },
    priority: 2 // High priority
  })
}

/**
 * Send 2FA enabled notification
 */
export async function send2FAEnabledEmail(params: {
  admin_id: string
  admin_name: string
  admin_email: string
  enabled_at: string
  ip_address: string
  device_info: string
}): Promise<string | null> {
  return await queueEmail({
    recipient_admin_id: params.admin_id,
    recipient_email: params.admin_email,
    recipient_name: params.admin_name,
    template_key: '2fa_enabled',
    template_data: {
      admin_name: params.admin_name,
      enabled_at: params.enabled_at,
      ip_address: params.ip_address,
      device_info: params.device_info
    },
    priority: 3 // High priority
  })
}

/**
 * Send suspicious login alert
 */
export async function sendSuspiciousLoginAlert(params: {
  admin_id: string
  admin_name: string
  admin_email: string
  login_time: string
  location: string
  ip_address: string
  device_info: string
  risk_score: number
  secure_account_url: string
}): Promise<string | null> {
  return await queueEmail({
    recipient_admin_id: params.admin_id,
    recipient_email: params.admin_email,
    recipient_name: params.admin_name,
    template_key: 'suspicious_login',
    template_data: {
      admin_name: params.admin_name,
      login_time: params.login_time,
      location: params.location,
      ip_address: params.ip_address,
      device_info: params.device_info,
      risk_score: params.risk_score,
      secure_account_url: params.secure_account_url
    },
    priority: 1 // Critical priority
  })
}

/**
 * Send permission granted notification
 */
export async function sendPermissionGrantedEmail(params: {
  admin_id: string
  admin_name: string
  admin_email: string
  module_name: string
  permissions_list: string
  granted_by_name: string
  granted_at: string
  is_temporary?: boolean
  expires_at?: string
}): Promise<string | null> {
  return await queueEmail({
    recipient_admin_id: params.admin_id,
    recipient_email: params.admin_email,
    recipient_name: params.admin_name,
    template_key: 'permission_granted',
    template_data: {
      admin_name: params.admin_name,
      module_name: params.module_name,
      permissions_list: params.permissions_list,
      granted_by_name: params.granted_by_name,
      granted_at: params.granted_at,
      is_temporary: params.is_temporary || false,
      expires_at: params.expires_at || ''
    },
    priority: 4
  })
}

/**
 * Send permission revoked notification
 */
export async function sendPermissionRevokedEmail(params: {
  admin_id: string
  admin_name: string
  admin_email: string
  module_name: string
  revoked_by_name: string
  revoked_at: string
  reason: string
}): Promise<string | null> {
  return await queueEmail({
    recipient_admin_id: params.admin_id,
    recipient_email: params.admin_email,
    recipient_name: params.admin_name,
    template_key: 'permission_revoked',
    template_data: {
      admin_name: params.admin_name,
      module_name: params.module_name,
      revoked_by_name: params.revoked_by_name,
      revoked_at: params.revoked_at,
      reason: params.reason
    },
    priority: 4
  })
}

/**
 * Send account status changed notification
 */
export async function sendAccountStatusChangedEmail(params: {
  admin_id: string
  admin_name: string
  admin_email: string
  old_status: string
  new_status: string
  changed_by_name: string
  changed_at: string
  reason: string
}): Promise<string | null> {
  return await queueEmail({
    recipient_admin_id: params.admin_id,
    recipient_email: params.admin_email,
    recipient_name: params.admin_name,
    template_key: 'account_status_changed',
    template_data: {
      admin_name: params.admin_name,
      old_status: params.old_status,
      new_status: params.new_status,
      changed_by_name: params.changed_by_name,
      changed_at: params.changed_at,
      reason: params.reason
    },
    priority: 3
  })
}

/**
 * Send session terminated notification
 */
export async function sendSessionTerminatedEmail(params: {
  admin_id: string
  admin_name: string
  admin_email: string
  device_info: string
  location: string
  ip_address: string
  terminated_by: string
  terminated_at: string
  reason: string
}): Promise<string | null> {
  return await queueEmail({
    recipient_admin_id: params.admin_id,
    recipient_email: params.admin_email,
    recipient_name: params.admin_name,
    template_key: 'session_terminated',
    template_data: {
      admin_name: params.admin_name,
      device_info: params.device_info,
      location: params.location,
      ip_address: params.ip_address,
      terminated_by: params.terminated_by,
      terminated_at: params.terminated_at,
      reason: params.reason
    },
    priority: 3
  })
}

/**
 * Get pending emails from queue
 */
export async function getPendingEmails(limit: number = 10): Promise<EmailQueueItem[]> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase.rpc('get_pending_emails', {
      p_limit: limit
    })

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Failed to get pending emails', error instanceof Error ? error : undefined)
    return []
  }
}

/**
 * Process email queue - sends pending emails
 */
export async function processEmailQueue(batchSize: number = 10): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const supabase = createSupabaseAdmin()

  const result = {
    processed: 0,
    sent: 0,
    failed: 0
  }

  try {
    // Get pending emails
    const pendingEmails = await getPendingEmails(batchSize)

    if (pendingEmails.length === 0) {
      return result
    }

    logger.info(`Processing ${pendingEmails.length} pending emails from queue`)

    for (const email of pendingEmails) {
      result.processed++

      try {
        // Mark as processing
        await supabase
          .from('email_queue')
          .update({
            status: 'processing',
            attempts: email.attempts + 1,
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', email.id)

        // Render template with data
        let htmlBody = email.html_body
        let textBody = email.text_body
        let subject = email.subject

        if (email.template_data) {
          htmlBody = renderTemplate(email.html_body, email.template_data)
          textBody = renderTemplate(email.text_body, email.template_data)
          subject = renderTemplate(email.subject, email.template_data)
        }

        // Send email using existing email service
        const success = await sendEmail({
          to: email.recipient_email,
          subject,
          html: htmlBody
        })

        if (success) {
          // Mark as sent
          await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id)

          result.sent++
          logger.info(`Email sent successfully: ${email.id}`)
        } else {
          throw new Error('Failed to send email')
        }
      } catch (error: unknown) {
        result.failed++

        // Calculate next retry
        const retryDelay = Math.min(Math.pow(2, email.attempts) * 60, 3600) // Max 1 hour
        const nextRetry = new Date()
        nextRetry.setSeconds(nextRetry.getSeconds() + retryDelay)

        // Mark as failed
        await supabase
          .from('email_queue')
          .update({
            status: email.attempts + 1 >= email.max_attempts ? 'failed' : 'pending',
            error_message: error.message,
            next_retry_at: email.attempts + 1 < email.max_attempts ? nextRetry.toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id)

        logger.error(`Failed to send email: ${email.id}`, error)
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.info(`Email queue processing complete: ${result.sent} sent, ${result.failed} failed`)
  } catch (error) {
    logger.error('Failed to process email queue', error instanceof Error ? error : undefined)
  }

  return result
}

/**
 * Log email activity (opened, clicked, etc.)
 */
export async function logEmailActivity(
  emailId: string,
  activityType: string,
  activityData?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('email_activity_logs')
      .insert({
        email_queue_id: emailId,
        activity_type: activityType,
        activity_data: activityData,
        ip_address: ipAddress,
        user_agent: userAgent
      })

    if (error) throw error

    // Update email_queue timestamps
    const updates: any = {}
    if (activityType === 'delivered') {
      updates.delivered_at = new Date().toISOString()
    } else if (activityType === 'opened') {
      updates.opened_at = new Date().toISOString()
    } else if (activityType === 'clicked') {
      updates.clicked_at = new Date().toISOString()
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('email_queue')
        .update(updates)
        .eq('id', emailId)
    }

    return true
  } catch (error) {
    logger.error('Failed to log email activity', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Get admin notification preferences
 */
export async function getNotificationPreferences(adminId: string): Promise<any | null> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase
      .from('admin_notification_preferences')
      .select('*')
      .eq('admin_id', adminId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error

    return data
  } catch (error) {
    logger.error('Failed to get notification preferences', error instanceof Error ? error : undefined)
    return null
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  adminId: string,
  preferences: Record<string, any>
): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  try {
    // Check if preferences exist
    const { data: existing } = await supabase
      .from('admin_notification_preferences')
      .select('id')
      .eq('admin_id', adminId)
      .maybeSingle()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('admin_notification_preferences')
        .update({
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .eq('admin_id', adminId)

      if (error) throw error
    } else {
      // Insert new
      const { error } = await supabase
        .from('admin_notification_preferences')
        .insert({
          admin_id: adminId,
          ...preferences
        })

      if (error) throw error
    }

    logger.info('Notification preferences updated', { admin_id: adminId })
    return true
  } catch (error) {
    logger.error('Failed to update notification preferences', error instanceof Error ? error : undefined)
    return false
  }
}
