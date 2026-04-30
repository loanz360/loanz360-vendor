
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/notifications/[id]/replies
 * Get all replies for a notification
 *
 * Returns: Array of replies with user info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const notificationId = params.id

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is the notification sender or a recipient
    const { data: notification } = await supabase
      .from('system_notifications')
      .select('sent_by, allow_replies')
      .eq('id', notificationId)
      .maybeSingle()

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    if (!notification.allow_replies) {
      return NextResponse.json(
        { error: 'Replies are not enabled for this notification' },
        { status: 403 }
      )
    }

    // Check if user has access (is sender or recipient)
    const isSender = notification.sent_by === user.id

    if (!isSender) {
      const { data: recipient } = await supabase
        .from('notification_recipients')
        .select('id')
        .eq('notification_id', notificationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!recipient) {
        return NextResponse.json(
          { error: 'You do not have access to this notification' },
          { status: 403 }
        )
      }
    }

    // Fetch replies with user info
    const { data: replies, error } = await supabase
      .from('notification_replies')
      .select(`
        id,
        reply_text,
        reply_html,
        attachments,
        is_read,
        read_at,
        created_at,
        updated_at,
        user:users!inner(id, email)
      `)
      .eq('notification_id', notificationId)
      .order('created_at', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching replies', error)
      return NextResponse.json(
        { error: 'Failed to fetch replies' },
        { status: 500 }
      )
    }

    // Enhance replies with user names from employees/partners/customers
    const enhancedReplies = await Promise.all(
      (replies || []).map(async (reply) => {
        const userId = reply.user?.id

        // Try to get name from employees
        let { data: emp } = await supabase
          .from('employees')
          .select('full_name, avatar_url')
          .eq('user_id', userId)
          .maybeSingle()

        if (emp) {
          return {
            ...reply,
            user_name: emp.full_name,
            user_avatar: emp.avatar_url
          }
        }

        // Try partners
        let { data: partner } = await supabase
          .from('partners')
          .select('full_name')
          .eq('user_id', userId)
          .maybeSingle()

        if (partner) {
          return {
            ...reply,
            user_name: partner.full_name
          }
        }

        // Try customers
        let { data: customer } = await supabase
          .from('customers')
          .select('full_name')
          .eq('user_id', userId)
          .maybeSingle()

        return {
          ...reply,
          user_name: customer?.full_name || reply.user?.email || 'Unknown User'
        }
      })
    )

    return NextResponse.json({
      success: true,
      count: enhancedReplies.length,
      replies: enhancedReplies
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/notifications/[id]/replies', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications/[id]/replies
 * Submit a reply to a notification
 *
 * Body: {
 *   reply_text: string,
 *   reply_html?: string,
 *   attachments?: [{name, url, size, type}]
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const notificationId = params.id

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse body
    const { reply_text, reply_html, attachments } = await request.json()

    if (!reply_text || reply_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Reply text is required' },
        { status: 400 }
      )
    }

    // Check if notification exists and allows replies
    const { data: notification } = await supabase
      .from('system_notifications')
      .select('id, allow_replies, sent_by')
      .eq('id', notificationId)
      .maybeSingle()

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    if (!notification.allow_replies) {
      return NextResponse.json(
        { error: 'Replies are not enabled for this notification' },
        { status: 403 }
      )
    }

    // Check if user is a recipient
    const { data: recipient } = await supabase
      .from('notification_recipients')
      .select('id')
      .eq('notification_id', notificationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!recipient) {
      return NextResponse.json(
        { error: 'Only recipients can reply to this notification' },
        { status: 403 }
      )
    }

    // Create reply
    const { data: reply, error: replyError } = await supabase
      .from('notification_replies')
      .insert({
        notification_id: notificationId,
        user_id: user.id,
        reply_text: reply_text.trim(),
        reply_html,
        attachments
      })
      .select()
      .maybeSingle()

    if (replyError) {
      apiLogger.error('Error creating reply', replyError)
      return NextResponse.json(
        { error: 'Failed to create reply' },
        { status: 500 }
      )
    }

    // Update reply count on notification
    const { data: replyCountData } = await supabase
      .from('notification_replies')
      .select('id', { count: 'exact', head: true })
      .eq('notification_id', notificationId)

    await supabase
      .from('system_notifications')
      .update({ reply_count: replyCountData || 0 })
      .eq('id', notificationId)

    // Update analytics
    await supabase
      .from('notification_analytics')
      .update({
        replied_count: supabase.sql`replied_count + 1`
      })
      .eq('notification_id', notificationId)

    // Send notification to sender about new reply
    try {
      // Get sender info
      const senderId = notification.sent_by

      if (senderId && senderId !== user.id) {
        // Get replier's name
        let replierName = 'Someone'
        const { data: emp } = await supabase
          .from('employees')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle()

        if (emp?.full_name) {
          replierName = emp.full_name
        } else {
          const { data: partner } = await supabase
            .from('partners')
            .select('full_name')
            .eq('user_id', user.id)
            .maybeSingle()

          if (partner?.full_name) {
            replierName = partner.full_name
          }
        }

        // Create in-app notification to sender
        const { data: replyNotification } = await supabase
          .from('system_notifications')
          .insert({
            title: 'New Reply to Your Notification',
            message: `${replierName} replied to your notification: "${notification.title}"`,
            type: 'reply',
            priority: 'normal',
            sent_by: user.id,
            channel: 'in_app',
            allow_replies: false,
            metadata: {
              original_notification_id: notificationId,
              reply_id: reply.id,
              replier_name: replierName
            }
          })
          .select('id')
          .maybeSingle()

        if (replyNotification) {
          // Add sender as recipient
          await supabase
            .from('notification_recipients')
            .insert({
              notification_id: replyNotification.id,
              user_id: senderId,
              user_type: 'super_admin',
              status: 'unread'
            })
        }
      }
    } catch (replyNotifError) {
      // Log but don't fail the request if reply notification fails
      apiLogger.error('Failed to send reply notification', replyNotifError)
    }

    return NextResponse.json({
      success: true,
      message: 'Reply submitted successfully',
      reply
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/notifications/[id]/replies', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
