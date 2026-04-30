import { parseBody } from '@/lib/utils/parse-body'

/**
 * Employee Email Messages API
 * List emails from local cache, perform bulk actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

// GET - Get emails from a folder
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') || 'inbox'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const label = searchParams.get('label')

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError) {
      if (accountError.code === '42P01' || accountError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Email system is being set up. Please check back later.',
          code: 'EMAIL_NOT_CONFIGURED',
        }, { status: 503 })
      }
    }

    if (!account) {
      return NextResponse.json({
        success: false,
        error: 'No email account found',
        code: 'NO_EMAIL_ACCOUNT',
      }, { status: 404 })
    }

    // Query email_messages table with filters
    const offset = (page - 1) * limit

    let query = serviceClient
      .from('email_messages')
      .select('*', { count: 'exact' })
      .eq('email_account_id', account.id)
      .eq('is_deleted', false)

    // Filter by folder
    if (folder === 'starred') {
      query = query.eq('is_starred', true)
    } else {
      query = query.eq('folder', folder)
    }

    // Filter by label
    if (label) {
      query = query.contains('labels', [label])
    }

    // Order and paginate
    query = query
      .order('received_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: messages, error: messagesError, count } = await query

    if (messagesError) {
      if (messagesError.code === '42P01' || messagesError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Email system is being set up. Please check back later.',
          code: 'EMAIL_NOT_CONFIGURED',
        }, { status: 503 })
      }
      throw messagesError
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    // Transform messages to frontend format
    const formattedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      message_id: msg.message_id,
      thread_id: msg.thread_id,
      from: msg.from_address || { name: '', email: '' },
      to: msg.to_addresses || [],
      cc: msg.cc_addresses || [],
      subject: msg.subject || '(No subject)',
      snippet: msg.snippet || (msg.body_text ? msg.body_text.substring(0, 120) : ''),
      date: msg.received_at || msg.sent_at || msg.created_at,
      is_read: msg.is_read,
      is_starred: msg.is_starred,
      has_attachments: msg.has_attachments,
      labels: msg.labels || [],
      folder: msg.folder,
    }))

    return NextResponse.json({
      success: true,
      data: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      folder,
      label,
    })
  } catch (error) {
    apiLogger.error('Get emails error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Bulk actions on messages
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { action, message_ids, target_folder, label_id } = body

    if (!action || !message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Perform the actual database operations
    switch (action) {
      case 'mark_read':
      case 'mark_all_read':
        await serviceClient
          .from('email_messages')
          .update({ is_read: true })
          .eq('email_account_id', account.id)
          .in('id', message_ids)
        break

      case 'mark_unread':
        await serviceClient
          .from('email_messages')
          .update({ is_read: false })
          .eq('email_account_id', account.id)
          .in('id', message_ids)
        break

      case 'star':
        await serviceClient
          .from('email_messages')
          .update({ is_starred: true })
          .eq('email_account_id', account.id)
          .in('id', message_ids)
        break

      case 'unstar':
        await serviceClient
          .from('email_messages')
          .update({ is_starred: false })
          .eq('email_account_id', account.id)
          .in('id', message_ids)
        break

      case 'move':
        if (!target_folder) {
          return NextResponse.json({ success: false, error: 'Target folder is required' }, { status: 400 })
        }
        await serviceClient
          .from('email_messages')
          .update({ folder: target_folder })
          .eq('email_account_id', account.id)
          .in('id', message_ids)
        break

      case 'archive':
        await serviceClient
          .from('email_messages')
          .update({ folder: 'archive' })
          .eq('email_account_id', account.id)
          .in('id', message_ids)
        break

      case 'delete':
        await serviceClient
          .from('email_messages')
          .update({ is_deleted: true, deleted_at: new Date().toISOString(), folder: 'trash' })
          .eq('email_account_id', account.id)
          .in('id', message_ids)
        break

      case 'add_label':
        if (!label_id) {
          return NextResponse.json({ success: false, error: 'Label ID is required' }, { status: 400 })
        }
        // Fetch current labels for each message, then append
        for (const msgId of message_ids) {
          const { data: msg } = await serviceClient
            .from('email_messages')
            .select('labels')
            .eq('id', msgId)
            .eq('email_account_id', account.id)
            .maybeSingle()
          if (msg) {
            const currentLabels: string[] = msg.labels || []
            if (!currentLabels.includes(label_id)) {
              await serviceClient
                .from('email_messages')
                .update({ labels: [...currentLabels, label_id] })
                .eq('id', msgId)
            }
          }
        }
        break

      case 'remove_label':
        if (!label_id) {
          return NextResponse.json({ success: false, error: 'Label ID is required' }, { status: 400 })
        }
        for (const msgId of message_ids) {
          const { data: msg } = await serviceClient
            .from('email_messages')
            .select('labels')
            .eq('id', msgId)
            .eq('email_account_id', account.id)
            .maybeSingle()
          if (msg) {
            const currentLabels: string[] = msg.labels || []
            await serviceClient
              .from('email_messages')
              .update({ labels: currentLabels.filter((l: string) => l !== label_id) })
              .eq('id', msgId)
          }
        }
        break

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    // Log the action
    await serviceClient
      .from('email_activity_logs')
      .insert({
        email_account_id: account.id,
        action,
        details: { message_ids, target_folder, label_id, count: message_ids.length },
      })
      .then(() => {}) // ignore log errors

    return NextResponse.json({
      success: true,
      message: `${action} completed for ${message_ids.length} message(s)`,
    })
  } catch (error) {
    apiLogger.error('Bulk action error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
