import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'


// GET - Fetch notifications for the current partner
export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await verifyUnifiedAuth(request)
    } catch {
      // If auth fails, return empty data gracefully
      return NextResponse.json({
        data: [],
        unread_count: 0,
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      })
    }

    if (!auth.authorized) {
      // Return empty data instead of error for better UX
      return NextResponse.json({
        data: [],
        unread_count: 0,
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      })
    }

    const supabase = await createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    // Get query parameters
    const includeRead = searchParams.get('include_read') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get the partner's profile to determine their type
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, sub_role')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Map sub_role to partner type
    const partnerTypeMap: Record<string, string> = {
      'BUSINESS_ASSOCIATE': 'BA',
      'BUSINESS_PARTNER': 'BP',
      'CHANNEL_PARTNER': 'CP'
    }
    const partnerType = auth.isSuperAdmin ? 'SUPERADMIN' : (partnerTypeMap[profile.sub_role || ''] || 'BA')

    // For superadmin, return all notifications
    if (auth.isSuperAdmin) {
      const { data: notifications, error } = await supabase
        .from('payout_rate_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1)

      if (error) {
        apiLogger.error('Error fetching notifications', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 })
      }

      // Get total count
      const { count } = await supabase
        .from('payout_rate_notifications')
        .select('*', { count: 'exact', head: true })

      return NextResponse.json({
        data: notifications,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      })
    }

    // Fetch notifications with read status (using profile.id from earlier query)
    const { data: notifications, error } = await supabase
      .from('payout_rate_notifications')
      .select(`
        *,
        partner_notification_reads!left (
          is_read,
          read_at,
          is_dismissed,
          dismissed_at
        )
      `)
      .eq('is_active', true)
      .contains('target_partner_types', [partnerType])
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (error) {
      apiLogger.error('Error fetching notifications', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Process notifications to flatten read status
    const processedNotifications = notifications?.map(notification => {
      const readStatus = notification.partner_notification_reads?.[0]
      return {
        ...notification,
        is_read: readStatus?.is_read || false,
        read_at: readStatus?.read_at || null,
        is_dismissed: readStatus?.is_dismissed || false,
        dismissed_at: readStatus?.dismissed_at || null,
        partner_notification_reads: undefined
      }
    }).filter(n => {
      // Filter out dismissed notifications
      if (n.is_dismissed) return false
      // Filter out read notifications if not including them
      if (!includeRead && n.is_read) return false
      return true
    }) || []

    // Get unread count
    const unreadCount = processedNotifications.filter(n => !n.is_read).length

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('payout_rate_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .contains('target_partner_types', [partnerType])

    return NextResponse.json({
      data: processedNotifications,
      unread_count: unreadCount,
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (totalCount || 0)
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET notifications', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new notification (SuperAdmin only)
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden - SuperAdmin access required' }, { status: 403 })
    }

    const supabase = await createSupabaseAdmin()

    // Get profile for created_by reference
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', auth.userId)
      .maybeSingle()

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      notification_type,
      bank_name,
      location,
      loan_type,
      old_percentage,
      new_percentage,
      effective_from,
      effective_to,
      title,
      message,
      target_partner_types,
      priority
    } = body

    // Validate required fields
    if (!notification_type || !bank_name || !location || !loan_type || !new_percentage || !effective_from || !title || !message) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate percentage change
    let percentageChange = null
    if (old_percentage && new_percentage) {
      percentageChange = new_percentage - old_percentage
    }

    // Insert notification
    const { data, error } = await supabase
      .from('payout_rate_notifications')
      .insert({
        notification_type,
        bank_name,
        location,
        loan_type,
        old_percentage: old_percentage || null,
        new_percentage,
        percentage_change: percentageChange,
        effective_from,
        effective_to: effective_to || null,
        title,
        message,
        target_partner_types: target_partner_types || ['BA', 'BP', 'CP'],
        priority: priority || 'normal',
        created_by: profile.id
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating notification', error)
      return NextResponse.json({ success: false, error: 'Failed to create notification' }, { status: 500 })
    }

    return NextResponse.json({ data, message: 'Notification created successfully' }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error in POST notification', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Mark notification as read/dismissed
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseAdmin()

    // Get partner's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, sub_role')
      .eq('id', auth.userId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { notification_id, action, mark_all } = body

    // Handle mark all as read
    if (mark_all && action === 'read') {
      const partnerTypeMap: Record<string, string> = {
        'BUSINESS_ASSOCIATE': 'BA',
        'BUSINESS_PARTNER': 'BP',
        'CHANNEL_PARTNER': 'CP'
      }
      const partnerType = partnerTypeMap[profile.sub_role || '']

      if (!partnerType) {
        return NextResponse.json({ success: false, error: 'Invalid partner type' }, { status: 400 })
      }

      // Get all unread notifications for this partner type
      const { data: notifications } = await supabase
        .from('payout_rate_notifications')
        .select('id')
        .eq('is_active', true)
        .contains('target_partner_types', [partnerType])

      if (notifications && notifications.length > 0) {
        // Upsert read status for all notifications
        const readRecords = notifications.map(n => ({
          notification_id: n.id,
          partner_id: profile.id,
          is_read: true,
          read_at: new Date().toISOString()
        }))

        const { error } = await supabase
          .from('partner_notification_reads')
          .upsert(readRecords, { onConflict: 'notification_id,partner_id' })

        if (error) {
          apiLogger.error('Error marking all as read', error)
          return NextResponse.json({ success: false, error: 'Failed to mark all as read' }, { status: 500 })
        }
      }

      return NextResponse.json({ message: 'All notifications marked as read', count: notifications?.length || 0 })
    }

    // Handle single notification
    if (!notification_id) {
      return NextResponse.json({ success: false, error: 'notification_id is required' }, { status: 400 })
    }

    if (!action || !['read', 'dismiss'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Valid action (read/dismiss) is required' }, { status: 400 })
    }

    // Upsert read/dismiss status
    const updateData: Record<string, any> = {
      notification_id,
      partner_id: profile.id
    }

    if (action === 'read') {
      updateData.is_read = true
      updateData.read_at = new Date().toISOString()
    } else if (action === 'dismiss') {
      updateData.is_dismissed = true
      updateData.dismissed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('partner_notification_reads')
      .upsert(updateData, { onConflict: 'notification_id,partner_id' })

    if (error) {
      apiLogger.error('Error updating notification status', error)
      return NextResponse.json({ success: false, error: 'Failed to update notification status' }, { status: 500 })
    }

    return NextResponse.json({ message: `Notification ${action === 'read' ? 'marked as read' : 'dismissed'}` })
  } catch (error: unknown) {
    apiLogger.error('Error in PATCH notification', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a notification (SuperAdmin only)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden - SuperAdmin access required' }, { status: 403 })
    }

    const supabase = await createSupabaseAdmin()

    const searchParams = request.nextUrl.searchParams
    const notificationId = searchParams.get('id')

    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'notification id is required' }, { status: 400 })
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('payout_rate_notifications')
      .update({ is_active: false })
      .eq('id', notificationId)

    if (error) {
      apiLogger.error('Error deleting notification', error)
      return NextResponse.json({ success: false, error: 'Failed to delete notification' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Notification deleted successfully' })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE notification', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
