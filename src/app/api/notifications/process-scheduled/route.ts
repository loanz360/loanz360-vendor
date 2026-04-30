
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET/POST /api/notifications/process-scheduled
 * Process scheduled notifications that are due to be sent
 * This should be called by a cron job (e.g., Vercel Cron, external cron service)
 * Vercel Cron uses GET by default
 */

async function processScheduledNotifications(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access (optional for Vercel internal cron)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // If CRON_SECRET is set, verify it. Otherwise, allow Vercel internal cron
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Find notifications that are scheduled and due to be sent
    const now = new Date().toISOString()
    const { data: scheduledNotifications, error: fetchError } = await supabase
      .from('system_notifications')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(100)

    if (fetchError) {
      apiLogger.error('Error fetching scheduled notifications', fetchError)
      return NextResponse.json({ success: false, error: 'Failed to fetch scheduled notifications' }, { status: 500 })
    }

    if (!scheduledNotifications || scheduledNotifications.length === 0) {
      return NextResponse.json({ message: 'No scheduled notifications to process', processed: 0 })
    }

    const processedCount = []
    const errors: string[] = []

    // Process each scheduled notification
    for (const notification of scheduledNotifications) {
      try {
        // Find target recipients based on targeting rules
        let recipients: { id: string; type: string }[] = []

        if (notification.target_type === 'all') {
          // All users across all categories
          const { data: allEmployees } = await supabase
            .from('employees')
            .select('id')

          const { data: allPartners } = await supabase
            .from('partners')
            .select('user_id as id')

          const { data: allCustomers } = await supabase
            .from('customers')
            .select('user_id as id')

          recipients = [
            ...(allEmployees?.map(e => ({ id: e.id, type: 'employee' })) || []),
            ...(allPartners?.map(p => ({ id: p.id, type: 'partner' })) || []),
            ...(allCustomers?.map(c => ({ id: c.id, type: 'customer' })) || [])
          ]
        } else if (notification.target_type === 'category') {
          // All users in a specific category
          if (notification.target_category === 'employee') {
            const { data: employees } = await supabase
              .from('employees')
              .select('id')
            recipients = employees?.map(e => ({ id: e.id, type: 'employee' })) || []
          } else if (notification.target_category === 'partner') {
            const { data: partners } = await supabase
              .from('partners')
              .select('user_id as id')
            recipients = partners?.map(p => ({ id: p.id, type: 'partner' })) || []
          } else if (notification.target_category === 'customer') {
            const { data: customers } = await supabase
              .from('customers')
              .select('user_id as id')
            recipients = customers?.map(c => ({ id: c.id, type: 'customer' })) || []
          }
        } else if (notification.target_type === 'subrole') {
          // Specific subrole within a category
          if (notification.target_category === 'employee') {
            const { data: employees } = await supabase
              .from('employees')
              .select('id')
              .eq('sub_role', notification.target_subrole)
            recipients = employees?.map(e => ({ id: e.id, type: 'employee' })) || []
          } else if (notification.target_category === 'partner') {
            const { data: partners } = await supabase
              .from('partners')
              .select('user_id as id')
              .eq('sub_role', notification.target_subrole)
            recipients = partners?.map(p => ({ id: p.id, type: 'partner' })) || []
          } else if (notification.target_category === 'customer') {
            const { data: customers } = await supabase
              .from('customers')
              .select('user_id as id')
              .eq('sub_role', notification.target_subrole)
            recipients = customers?.map(c => ({ id: c.id, type: 'customer' })) || []
          }
        } else if (notification.target_type === 'individual' && notification.target_users) {
          // Specific users
          for (const userId of notification.target_users) {
            const { data: emp } = await supabase
              .from('employees')
              .select('id')
              .eq('id', userId)
              .maybeSingle()

            if (emp) {
              recipients.push({ id: userId, type: 'employee' })
              continue
            }

            const { data: partner } = await supabase
              .from('partners')
              .select('user_id')
              .eq('user_id', userId)
              .maybeSingle()

            if (partner) {
              recipients.push({ id: userId, type: 'partner' })
              continue
            }

            const { data: customer } = await supabase
              .from('customers')
              .select('user_id')
              .eq('user_id', userId)
              .maybeSingle()

            if (customer) {
              recipients.push({ id: userId, type: 'customer' })
            }
          }
        }

        // Remove duplicates
        const uniqueRecipients = Array.from(
          new Map(recipients.map(r => [r.id, r])).values()
        )

        // Create recipient records
        if (uniqueRecipients.length > 0) {
          const recipientRecords = uniqueRecipients.map(r => ({
            notification_id: notification.id,
            user_id: r.id,
            user_type: r.type
          }))

          const { error: recipientsError } = await supabase
            .from('notification_recipients')
            .insert(recipientRecords)

          if (recipientsError) {
            apiLogger.error('Error creating recipient records', recipientsError)
            errors.push(`Failed to create recipients for notification ${notification.id}`)
            continue
          }

          // Update total recipients count and status
          await supabase
            .from('system_notifications')
            .update({
              total_recipients: uniqueRecipients.length,
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id)

          // Trigger email sending if requested
          if (notification.send_email) {
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notification_id: notification.id,
                title: notification.title,
                message: notification.message,
                notification_type: notification.notification_type,
                priority: notification.priority,
                sender_name: notification.sent_by_name,
                recipient_ids: uniqueRecipients.map(r => r.id)
              })
            }).catch(err => apiLogger.error('Failed to trigger email job', err))
          }

          processedCount.push(notification.id)
        } else {
          // No recipients found, mark as sent anyway
          await supabase
            .from('system_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id)

          processedCount.push(notification.id)
        }
      } catch (error) {
        apiLogger.error(`Error processing notification ${notification.id}:`, error)
        errors.push(`Failed to process notification ${notification.id}: ${error}`)
      }
    }

    return NextResponse.json({
      message: 'Scheduled notifications processed',
      processed: processedCount.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    apiLogger.error('Error in process-scheduled', error)
    logApiError(error as Error, request, { action: 'processScheduled' })
    return NextResponse.json(
      { error: 'Failed to process scheduled notifications' },
      { status: 500 }
    )
  }
}

// Support both GET (Vercel Cron) and POST (external cron)
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  return processScheduledNotifications(request)
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  return processScheduledNotifications(request)
}
