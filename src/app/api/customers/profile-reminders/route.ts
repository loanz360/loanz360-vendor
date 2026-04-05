export const dynamic = 'force-dynamic'

/**
 * Profile Completion Reminder API
 *
 * This endpoint sends SMS reminders to customers who haven't completed their profiles.
 * It can be triggered by:
 * 1. A cron job (e.g., Vercel Cron, GitHub Actions)
 * 2. Manual trigger from admin panel
 *
 * Features:
 * - Sends SMS to customers with incomplete profiles
 * - Tracks last reminder sent to avoid spamming
 * - Respects opt-out preferences
 * - Limits reminders to once per week per customer
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendProfileReminderSMS } from '@/lib/communication/providers/smartping-sms'
import { apiLogger } from '@/lib/utils/logger'

// Minimum days between reminders
const REMINDER_INTERVAL_DAYS = 7

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET

/**
 * POST /api/customers/profile-reminders
 * Trigger profile completion reminders
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET> (for cron jobs)
 * - x-cron-secret: <CRON_SECRET> (alternative auth)
 *
 * Body (optional):
 * - customerId: string - Send reminder to specific customer
 * - dryRun: boolean - If true, don't actually send SMS, just return who would receive
 * - limit: number - Maximum number of reminders to send (default 100)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request (for cron jobs or admin)
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-cron-secret')

    const isAuthorized =
      (authHeader && authHeader === `Bearer ${CRON_SECRET}`) ||
      (cronSecret && cronSecret === CRON_SECRET)

    // If not a cron job, check if it's an admin user
    let isAdmin = false
    if (!isAuthorized) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        isAdmin = userData?.role === 'SUPERADMIN' || userData?.role === 'ADMIN'
      }
    }

    if (!isAuthorized && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { customerId, dryRun = false, limit = 100 } = body

    const supabase = await createClient()

    // Calculate the date threshold (only send if last reminder was more than X days ago)
    const reminderThreshold = new Date()
    reminderThreshold.setDate(reminderThreshold.getDate() - REMINDER_INTERVAL_DAYS)

    // Build query for customers with incomplete profiles
    let query = supabase
      .from('customer_individual_profiles')
      .select(`
        id,
        user_id,
        full_name,
        profile_completion,
        last_profile_reminder_sent,
        users!inner (
          id,
          mobile,
          email,
          sms_opt_in
        )
      `)
      .lt('profile_completion', 100) // Only incomplete profiles
      .not('users.mobile', 'is', null) // Must have a mobile number

    // If specific customer, filter by that
    if (customerId) {
      query = query.eq('user_id', customerId)
    } else {
      // For bulk sends, only include those who haven't received a recent reminder
      query = query.or(`last_profile_reminder_sent.is.null,last_profile_reminder_sent.lt.${reminderThreshold.toISOString()}`)
    }

    // Limit the number of reminders
    query = query.limit(limit)

    const { data: profiles, error } = await query

    if (error) {
      apiLogger.error('Error fetching profiles for reminders', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profiles' },
        { status: 500 }
      )
    }

    // Filter out customers who have opted out of SMS
    const eligibleProfiles = profiles?.filter((p: any) =>
      p.users?.sms_opt_in !== false && p.users?.mobile
    ) || []

    if (eligibleProfiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible customers found for reminders',
        sent: 0,
        skipped: profiles?.length || 0
      })
    }

    // If dry run, just return the list
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldSendTo: eligibleProfiles.map((p: any) => ({
          id: p.id,
          name: p.full_name,
          phone: p.users?.mobile?.slice(0, 4) + '****' + p.users?.mobile?.slice(-2),
          profileCompletion: p.profile_completion,
          lastReminder: p.last_profile_reminder_sent
        })),
        count: eligibleProfiles.length
      })
    }

    // Send reminders
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const profile of eligibleProfiles as any[]) {
      try {
        const phone = profile.users?.mobile
        const name = profile.full_name?.split(' ')[0] || 'Customer'

        // Send SMS
        const smsResult = await sendProfileReminderSMS({
          phone,
          name,
          profileCompletionPercent: profile.profile_completion
        })

        if (smsResult.success) {
          results.sent++

          // Update last reminder sent timestamp
          await supabase
            .from('customer_individual_profiles')
            .update({ last_profile_reminder_sent: new Date().toISOString() })
            .eq('id', profile.id)
        } else {
          results.failed++
          results.errors.push(`${profile.id}: ${smsResult.description}`)
        }

        // Rate limit: wait 1 second between SMS
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (err) {
        results.failed++
        results.errors.push(`${profile.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${results.sent} reminder(s)`,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined // Limit error output
    })
  } catch (error) {
    apiLogger.error('Profile reminder API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/customers/profile-reminders
 * Get statistics about profile completion reminders
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPERADMIN' && userData?.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get profile completion statistics
    const { data: stats, error } = await supabase
      .from('customer_individual_profiles')
      .select('profile_completion, last_profile_reminder_sent')

    if (error) {
      throw error
    }

    const statistics = {
      total: stats?.length || 0,
      complete: stats?.filter(p => p.profile_completion >= 100).length || 0,
      incomplete: stats?.filter(p => p.profile_completion < 100).length || 0,
      neverReminded: stats?.filter(p => !p.last_profile_reminder_sent && p.profile_completion < 100).length || 0,
      byCompletionRange: {
        '0-25%': stats?.filter(p => p.profile_completion < 25).length || 0,
        '25-50%': stats?.filter(p => p.profile_completion >= 25 && p.profile_completion < 50).length || 0,
        '50-75%': stats?.filter(p => p.profile_completion >= 50 && p.profile_completion < 75).length || 0,
        '75-99%': stats?.filter(p => p.profile_completion >= 75 && p.profile_completion < 100).length || 0,
        '100%': stats?.filter(p => p.profile_completion >= 100).length || 0
      }
    }

    return NextResponse.json({
      success: true,
      statistics
    })
  } catch (error) {
    apiLogger.error('Profile reminder stats error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
