import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/notifications/[id]
 * Get a single notification by recipient record ID
 * The [id] param is the notification_recipients.id (recipient_id from frontend)
 * Access: Owner only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const recipientId = params.id

    // Get notification via notification_recipients joined to system_notifications
    const { data: recipient, error: recipientError } = await supabase
      .from('notification_recipients')
      .select(`
        *,
        notification:system_notifications(*)
      `)
      .eq('id', recipientId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (recipientError || !recipient) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 })
    }

    // Transform to flat notification object matching frontend interface
    const notification = {
      ...recipient.notification,
      recipient_id: recipient.id,
      is_read: recipient.is_read,
      read_at: recipient.read_at,
      is_archived: recipient.is_archived,
      archived_at: recipient.archived_at,
      starred: recipient.starred,
    }

    return NextResponse.json({
      success: true,
      data: notification,
    })
  } catch (error) {
    apiLogger.error('Error fetching notification', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification' },
      { status: 500 }
    )
  }
}

/**
 * Helper to update notification_recipients record
 * Shared by PATCH and PUT handlers
 */
async function updateNotificationRecipient(
  request: NextRequest,
  recipientId: string
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      is_read: z.boolean().optional(),


      is_archived: z.boolean().optional(),


      starred: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Build update object from allowed fields
    const updateData: Record<string, unknown> = {}

    if ('is_read' in body) {
      updateData.is_read = body.is_read
      updateData.read_at = body.is_read ? new Date().toISOString() : null
    }

    if ('is_archived' in body) {
      updateData.is_archived = body.is_archived
      updateData.archived_at = body.is_archived ? new Date().toISOString() : null
    }

    if ('starred' in body) {
      updateData.starred = body.starred
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update notification_recipients record (correct table for broadcast notifications)
    const { data: updated, error: updateError } = await supabase
      .from('notification_recipients')
      .update(updateData)
      .eq('id', recipientId)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (updateError || !updated) {
      return NextResponse.json(
        { error: 'Notification not found or update failed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: body.is_read === true
        ? 'Notification marked as read'
        : body.is_read === false
          ? 'Notification marked as unread'
          : body.is_archived
            ? 'Notification archived'
            : 'Notification updated',
    })
  } catch (error) {
    apiLogger.error('Error updating notification', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications/[id]
 * Update notification (mark read/unread, archive, star)
 * Body: { is_read?: boolean, is_archived?: boolean, starred?: boolean }
 * Access: Owner only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return updateNotificationRecipient(request, params.id)
}

/**
 * PUT /api/notifications/[id]
 * Update notification (same as PATCH for backward compatibility)
 * Body: { is_read?: boolean, is_archived?: boolean, starred?: boolean }
 * Access: Owner only
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return updateNotificationRecipient(request, params.id)
}

/**
 * DELETE /api/notifications/[id]
 * Soft-delete (archive) a notification
 * Access: Owner only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const recipientId = params.id

    // Soft delete by archiving on notification_recipients (correct table)
    const { data: updated, error: archiveError } = await supabase
      .from('notification_recipients')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('id', recipientId)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (archiveError || !updated) {
      return NextResponse.json(
        { error: 'Notification not found or archive failed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Notification archived successfully',
    })
  } catch (error) {
    apiLogger.error('Error archiving notification', error)
    return NextResponse.json(
      { error: 'Failed to archive notification' },
      { status: 500 }
    )
  }
}
