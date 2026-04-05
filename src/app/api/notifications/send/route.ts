export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * Helper to check Super Admin session from cookie
 */
async function checkSuperAdminSession(request: NextRequest): Promise<{ isValid: boolean; adminId?: string; adminName?: string }> {
  const superAdminSession = request.cookies.get('super_admin_session')?.value
  if (!superAdminSession) {
    return { isValid: false }
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: session, error } = await supabaseAdmin
    .from('super_admin_sessions')
    .select('super_admin_id, expires_at')
    .eq('session_id', superAdminSession)
    .maybeSingle()

  if (error || !session) {
    return { isValid: false }
  }

  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    return { isValid: false }
  }

  // Verify admin is active
  const { data: admin } = await supabaseAdmin
    .from('super_admins')
    .select('id, full_name, is_active, is_locked')
    .eq('id', session.super_admin_id)
    .maybeSingle()

  if (!admin || !admin.is_active || admin.is_locked) {
    return { isValid: false }
  }

  return { isValid: true, adminId: admin.id, adminName: admin.full_name }
}

/**
 * POST /api/notifications/send
 * Send notification to targeted users
 */
export async function POST(request: NextRequest) {
  try {
    // First check for Super Admin session
    const superAdminCheck = await checkSuperAdminSession(request)
    let isSuperAdmin = superAdminCheck.isValid
    let isHR = false
    let userId: string | null = superAdminCheck.adminId || null
    let userName: string | null = superAdminCheck.adminName || null
    let userRole: string | null = isSuperAdmin ? 'SUPER_ADMIN' : null

    // If not a Super Admin, check regular user authentication
    if (!isSuperAdmin) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      userId = user.id

      // Get user profile to check permissions
      const { data: userData } = await supabase
        .from('profiles')
        .select('role, sub_role, full_name')
        .eq('id', user.id)
        .maybeSingle()

      isSuperAdmin = userData?.role === 'SUPER_ADMIN'
      userRole = userData?.role || null
      userName = userData?.full_name || user.email || null
      const roleUpper = userData?.role?.toUpperCase()
      // HR can have role='HR' directly or be an employee with sub_role='HR'
      isHR = roleUpper === 'HR' || (roleUpper === 'EMPLOYEE' && userData?.sub_role?.toUpperCase() === 'HR')
    }

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin and HR can send notifications' },
        { status: 403 }
      )
    }

    // Apply role-based rate limiting AFTER auth check
    const rateLimitConfig = isSuperAdmin
      ? RATE_LIMIT_CONFIGS.NOTIFICATION_SEND_ADMIN
      : RATE_LIMIT_CONFIGS.NOTIFICATION_SEND_HR

    const rateLimitResponse = await rateLimit(request, rateLimitConfig)
    if (rateLimitResponse) {
      logApiError(new Error('Rate limit exceeded'), request, {
        action: 'send_notification',
        user_id: userId,
        role: userRole,
        limit: rateLimitConfig.limit,
        window: rateLimitConfig.window
      })
      return rateLimitResponse
    }

    // Parse request body
    const body = await request.json()
    const {
      title,
      message,
      notification_type,
      priority = 'normal',
      target_type,
      target_category,
      target_subrole,
      target_users, // Legacy: array of text IDs
      target_user_ids, // New: array of UUID for individual targeting
      target_geography, // New: {state_ids: [], city_ids: [], branch_ids: []}
      send_email = false,
      send_in_app = true,
      expires_at,
      is_pinned = false,
      attachment_url, // Legacy
      attachments, // New: [{name, url, size, type}]
      image_url, // New: notification banner image
      thumbnail_url, // New: small icon
      message_html, // New: rich text HTML
      valid_from, // New: validity period start
      valid_until, // New: validity period end
      allow_replies = false, // New: enable two-way communication
      action_url,
      action_label,
      scheduled_for
    } = body

    // Validation
    if (!title || !message || !notification_type || !target_type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, message, notification_type, target_type' },
        { status: 400 }
      )
    }

    // HR can only send to employees
    if (isHR && target_category !== 'employee' && target_type !== 'individual') {
      return NextResponse.json(
        { error: 'HR can only send notifications to employees' },
        { status: 403 }
      )
    }

    // Use admin client for all database operations
    const supabaseAdmin = createSupabaseAdmin()

    // Determine sender type
    const senderType = isSuperAdmin ? 'super_admin' : 'hr'

    // Create notification record with all new fields
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from('system_notifications')
      .insert({
        sent_by: userId,
        sent_by_type: senderType,
        sent_by_name: userName || 'Admin',
        created_by_admin_id: userId,
        title,
        message,
        message_html, // Rich text HTML
        notification_type,
        priority,
        target_type,
        target_category,
        target_subrole,
        target_users, // Legacy
        target_user_ids, // New: UUID array
        target_geography, // New: Geography filter
        send_email,
        send_in_app,
        expires_at,
        is_pinned,
        attachment_url, // Legacy
        attachments, // New: Multiple attachments
        image_url, // Notification banner
        thumbnail_url, // Small icon
        valid_from, // Validity period
        valid_until,
        allow_replies, // Enable replies
        action_url,
        action_label,
        status: scheduled_for ? 'scheduled' : 'sent',
        scheduled_for
      })
      .select()
      .maybeSingle()

    if (notificationError) {
      apiLogger.error('Error creating notification', notificationError)
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      )
    }

    // If scheduled, don't create recipients yet - will be created when cron job sends
    if (scheduled_for) {
      return NextResponse.json({
        success: true,
        notification,
        message: `Notification scheduled for ${new Date(scheduled_for).toLocaleString()}`,
        scheduled: true
      })
    }

    // Find target recipients with enhanced geography support
    let recipients: { id: string; type: string; state_id?: string; city_id?: string; branch_id?: string }[] = []

    // OPTIMIZED: Individual user IDs targeting (batch queries instead of N+1)
    if (target_type === 'individual' && target_user_ids && target_user_ids.length > 0) {
      // Batch query all user types at once instead of sequential queries
      const [
        { data: employees },
        { data: partners },
        { data: customers }
      ] = await Promise.all([
        supabaseAdmin
          .from('employees')
          .select('user_id, state_id, city_id, branch_id')
          .in('user_id', target_user_ids),
        supabaseAdmin
          .from('partners')
          .select('user_id, state_id, city_id, branch_id')
          .in('user_id', target_user_ids),
        supabaseAdmin
          .from('customers')
          .select('user_id')
          .in('user_id', target_user_ids)
      ])

      // Map results by user_id for O(1) lookup
      const employeeMap = new Map((employees || []).map(e => [e.user_id, e]))
      const partnerMap = new Map((partners || []).map(p => [p.user_id, p]))
      const customerMap = new Map((customers || []).map(c => [c.user_id, c]))

      // Resolve user types efficiently
      for (const recipientUserId of target_user_ids) {
        const emp = employeeMap.get(recipientUserId)
        if (emp) {
          recipients.push({
            id: recipientUserId,
            type: 'employee',
            state_id: emp.state_id,
            city_id: emp.city_id,
            branch_id: emp.branch_id
          })
          continue
        }

        const partner = partnerMap.get(recipientUserId)
        if (partner) {
          recipients.push({
            id: recipientUserId,
            type: 'partner',
            state_id: partner.state_id,
            city_id: partner.city_id,
            branch_id: partner.branch_id
          })
          continue
        }

        const customer = customerMap.get(recipientUserId)
        if (customer) {
          recipients.push({ id: recipientUserId, type: 'customer' })
        }
      }
    }
    // Legacy: target_users as text array (also optimized)
    else if (target_type === 'individual' && target_users && target_users.length > 0) {
      // Convert text array to UUID array for batch query
      const userIds = target_users.map((id: string) => id)

      // Batch query all user types
      const [
        { data: employees },
        { data: partners },
        { data: customers }
      ] = await Promise.all([
        supabaseAdmin.from('employees').select('user_id, state_id, city_id, branch_id').in('user_id', userIds),
        supabaseAdmin.from('partners').select('user_id, state_id, city_id, branch_id').in('user_id', userIds),
        supabaseAdmin.from('customers').select('user_id').in('user_id', userIds)
      ])

      const employeeMap = new Map((employees || []).map(e => [e.user_id, e]))
      const partnerMap = new Map((partners || []).map(p => [p.user_id, p]))
      const customerMap = new Map((customers || []).map(c => [c.user_id, c]))

      for (const recipientUserId of userIds) {
        const emp = employeeMap.get(recipientUserId)
        if (emp) {
          recipients.push({
            id: recipientUserId,
            type: 'employee',
            state_id: emp.state_id,
            city_id: emp.city_id,
            branch_id: emp.branch_id
          })
          continue
        }

        const partner = partnerMap.get(recipientUserId)
        if (partner) {
          recipients.push({
            id: recipientUserId,
            type: 'partner',
            state_id: partner.state_id,
            city_id: partner.city_id,
            branch_id: partner.branch_id
          })
          continue
        }

        const customer = customerMap.get(recipientUserId)
        if (customer) {
          recipients.push({ id: recipientUserId, type: 'customer' })
        }
      }
    }
    else if (target_type === 'all') {
      // All users across all categories
      let empQuery = supabaseAdmin.from('employees').select('user_id, state_id, city_id, branch_id')
      let partnerQuery = supabaseAdmin.from('partners').select('user_id, state_id, city_id, branch_id')
      let customerQuery = supabaseAdmin.from('customers').select('user_id')

      // Apply geography filters if provided
      if (target_geography) {
        if (target_geography.state_ids && target_geography.state_ids.length > 0) {
          empQuery = empQuery.in('state_id', target_geography.state_ids)
          partnerQuery = partnerQuery.in('state_id', target_geography.state_ids)
        }
        if (target_geography.city_ids && target_geography.city_ids.length > 0) {
          empQuery = empQuery.in('city_id', target_geography.city_ids)
          partnerQuery = partnerQuery.in('city_id', target_geography.city_ids)
        }
        if (target_geography.branch_ids && target_geography.branch_ids.length > 0) {
          empQuery = empQuery.in('branch_id', target_geography.branch_ids)
          partnerQuery = partnerQuery.in('branch_id', target_geography.branch_ids)
        }
      }

      const { data: allEmployees } = await empQuery
      const { data: allPartners } = await partnerQuery
      const { data: allCustomers } = await customerQuery

      recipients = [
        ...(allEmployees || []).map(e => ({ id: e.user_id, type: 'employee', state_id: e.state_id, city_id: e.city_id, branch_id: e.branch_id })),
        ...(allPartners || []).map(p => ({ id: p.user_id, type: 'partner', state_id: p.state_id, city_id: p.city_id, branch_id: p.branch_id })),
        ...(allCustomers || []).map(c => ({ id: c.user_id, type: 'customer' }))
      ]
    }
    else if (target_type === 'category') {
      // All users in a category (with geography filter)
      if (target_category === 'employee' || target_category === 'all') {
        let empQuery = supabaseAdmin.from('employees').select('user_id, state_id, city_id, branch_id')
        if (target_geography?.state_ids?.length) empQuery = empQuery.in('state_id', target_geography.state_ids)
        if (target_geography?.city_ids?.length) empQuery = empQuery.in('city_id', target_geography.city_ids)
        if (target_geography?.branch_ids?.length) empQuery = empQuery.in('branch_id', target_geography.branch_ids)

        const { data: employees } = await empQuery
        recipients.push(...(employees || []).map(e => ({ id: e.user_id, type: 'employee', state_id: e.state_id, city_id: e.city_id, branch_id: e.branch_id })))
      }

      if (target_category === 'partner' || target_category === 'all') {
        let partnerQuery = supabaseAdmin.from('partners').select('user_id, state_id, city_id, branch_id')
        if (target_geography?.state_ids?.length) partnerQuery = partnerQuery.in('state_id', target_geography.state_ids)
        if (target_geography?.city_ids?.length) partnerQuery = partnerQuery.in('city_id', target_geography.city_ids)
        if (target_geography?.branch_ids?.length) partnerQuery = partnerQuery.in('branch_id', target_geography.branch_ids)

        const { data: partners } = await partnerQuery
        recipients.push(...(partners || []).map(p => ({ id: p.user_id, type: 'partner', state_id: p.state_id, city_id: p.city_id, branch_id: p.branch_id })))
      }

      if (target_category === 'customer' || target_category === 'all') {
        const { data: customers } = await supabaseAdmin.from('customers').select('user_id')
        recipients.push(...(customers || []).map(c => ({ id: c.user_id, type: 'customer' })))
      }
    }
    else if (target_type === 'subrole') {
      // Users in specific subrole (with geography filter)
      if (target_category === 'employee') {
        let query = supabaseAdmin.from('employees').select('user_id, state_id, city_id, branch_id').eq('sub_role', target_subrole)
        if (target_geography?.state_ids?.length) query = query.in('state_id', target_geography.state_ids)
        if (target_geography?.city_ids?.length) query = query.in('city_id', target_geography.city_ids)
        if (target_geography?.branch_ids?.length) query = query.in('branch_id', target_geography.branch_ids)

        const { data: employees } = await query
        recipients = (employees || []).map(e => ({ id: e.user_id, type: 'employee', state_id: e.state_id, city_id: e.city_id, branch_id: e.branch_id }))
      } else if (target_category === 'partner') {
        let query = supabaseAdmin.from('partners').select('user_id, state_id, city_id, branch_id').eq('partner_type', target_subrole)
        if (target_geography?.state_ids?.length) query = query.in('state_id', target_geography.state_ids)
        if (target_geography?.city_ids?.length) query = query.in('city_id', target_geography.city_ids)
        if (target_geography?.branch_ids?.length) query = query.in('branch_id', target_geography.branch_ids)

        const { data: partners } = await query
        recipients = (partners || []).map(p => ({ id: p.user_id, type: 'partner', state_id: p.state_id, city_id: p.city_id, branch_id: p.branch_id }))
      } else if (target_category === 'customer') {
        const { data: customers } = await supabaseAdmin.from('customers').select('user_id').eq('customer_type', target_subrole)
        recipients = (customers || []).map(c => ({ id: c.user_id, type: 'customer' }))
      }
    }

    // Remove duplicates
    const uniqueRecipients = Array.from(
      new Map(recipients.map(r => [r.id, r])).values()
    )

    // Create recipient records with geography data
    if (uniqueRecipients.length > 0) {
      const recipientRecords = uniqueRecipients.map(r => ({
        notification_id: notification.id,
        user_id: r.id,
        user_type: r.type,
        user_geography: r.state_id || r.city_id || r.branch_id ? {
          state_id: r.state_id,
          city_id: r.city_id,
          branch_id: r.branch_id
        } : null
      }))

      const { error: recipientsError } = await supabaseAdmin
        .from('notification_recipients')
        .insert(recipientRecords)

      if (recipientsError) {
        apiLogger.error('Error creating recipient records', recipientsError)
        logApiError(recipientsError as Error, request, {
          action: 'create_recipients',
          notification_id: notification.id,
          recipient_count: uniqueRecipients.length
        })

        // Rollback: delete the notification if recipients failed to create
        await supabaseAdmin
          .from('system_notifications')
          .delete()
          .eq('id', notification.id)

        return NextResponse.json(
          { error: 'Failed to create notification recipients. Please try again.' },
          { status: 500 }
        )
      }

      // Update total recipients count with error handling
      const { error: updateError } = await supabaseAdmin
        .from('system_notifications')
        .update({ total_recipients: uniqueRecipients.length })
        .eq('id', notification.id)

      if (updateError) {
        apiLogger.error('Error updating recipient count', updateError)
        logApiError(updateError as Error, request, {
          action: 'update_recipient_count',
          notification_id: notification.id
        })
      }

      // Create initial analytics record with error handling
      const { error: analyticsError } = await supabaseAdmin
        .from('notification_analytics')
        .insert({
          notification_id: notification.id,
          sent_count: uniqueRecipients.length,
          delivered_count: uniqueRecipients.length
        })
        .onConflict('notification_id')
        .ignoreDuplicates()

      if (analyticsError) {
        apiLogger.error('Error creating analytics record', analyticsError)
        logApiError(analyticsError as Error, request, {
          action: 'create_analytics',
          notification_id: notification.id
        })
      }
    }

    // Trigger email sending if requested with proper error handling
    if (send_email && uniqueRecipients.length > 0) {
      try {
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notification_id: notification.id,
            title,
            message,
            notification_type,
            priority,
            sender_name: userName || 'System',
            recipient_ids: uniqueRecipients.map(r => r.id)
          })
        })

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json()
          apiLogger.error('Email job trigger failed', errorData)
          logApiError(new Error('Email job failed'), request, {
            action: 'trigger_email_job',
            notification_id: notification.id,
            error: errorData
          })
        }
      } catch (emailError) {
        apiLogger.error('Failed to trigger email job', emailError)
        logApiError(emailError as Error, request, {
          action: 'trigger_email_job',
          notification_id: notification.id
        })
        // Don't fail the whole request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      notification,
      recipients_count: uniqueRecipients.length
    })
  } catch (error) {
    apiLogger.error('Error in POST /api/notifications/send', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
