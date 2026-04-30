
/**
 * Employee Email Search API
 * Search emails across folders using database queries
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

// GET - Search emails
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const folder = searchParams.get('folder') || 'all'
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const subject = searchParams.get('subject')
    const hasAttachment = searchParams.get('has_attachment') === 'true'
    const isStarred = searchParams.get('is_starred') === 'true'
    const isRead = searchParams.get('is_read')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)

    if (!query && !from && !to && !subject) {
      return NextResponse.json({
        success: false,
        error: 'At least one search criteria is required'
      }, { status: 400 })
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

    // Build search query against email_messages table
    const offset = (page - 1) * limit

    let dbQuery = serviceClient
      .from('email_messages')
      .select('*', { count: 'exact' })
      .eq('email_account_id', account.id)
      .eq('is_deleted', false)

    // Full-text search on subject and body
    if (query) {
      // Use ILIKE for flexible matching across subject and body_text
      dbQuery = dbQuery.or(
        `subject.ilike.%${query}%,body_text.ilike.%${query}%,snippet.ilike.%${query}%`
      )
    }

    // Filter by folder
    if (folder && folder !== 'all') {
      dbQuery = dbQuery.eq('folder', folder)
    }

    // Filter by from address (search in JSONB)
    if (from) {
      dbQuery = dbQuery.ilike('from_address->>email', `%${from}%`)
    }

    // Filter by subject
    if (subject) {
      dbQuery = dbQuery.ilike('subject', `%${subject}%`)
    }

    // Filter by has_attachment
    if (hasAttachment) {
      dbQuery = dbQuery.eq('has_attachments', true)
    }

    // Filter by starred
    if (isStarred) {
      dbQuery = dbQuery.eq('is_starred', true)
    }

    // Filter by read status
    if (isRead !== null && isRead !== undefined) {
      dbQuery = dbQuery.eq('is_read', isRead === 'true')
    }

    // Date range filters
    if (dateFrom) {
      dbQuery = dbQuery.gte('received_at', dateFrom)
    }
    if (dateTo) {
      dbQuery = dbQuery.lte('received_at', dateTo)
    }

    // Order and paginate
    dbQuery = dbQuery
      .order('received_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    const { data: messages, error: searchError, count } = await dbQuery

    if (searchError) {
      if (searchError.code === '42P01' || searchError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Email system is being set up. Please check back later.',
          code: 'EMAIL_NOT_CONFIGURED',
        }, { status: 503 })
      }
      throw searchError
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    // Transform to frontend format
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
      },
      query: {
        q: query,
        folder,
        from,
        to,
        subject,
        hasAttachment,
        isStarred,
        isRead,
        dateFrom,
        dateTo,
      },
    })
  } catch (error) {
    apiLogger.error('Search emails error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
