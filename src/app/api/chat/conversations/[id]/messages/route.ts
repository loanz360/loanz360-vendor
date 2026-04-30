import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'


const sendMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  messageType: z.enum(['text', 'image', 'document']).default('text'),
  attachmentUrl: z.string().url().optional(),
  attachmentName: z.string().max(255).optional(),
})

/**
 * GET /api/chat/conversations/[id]/messages
 * Fetch messages for a conversation (CRO side)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id: conversationId } = await params
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify conversation belongs to this CRO
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id, cro_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (!conversation || conversation.cro_id !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit
    const before = searchParams.get('before') // cursor-based loading for older messages
    const search = searchParams.get('search') // text search within messages

    let query = supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_type, sender_id, message, message_type, attachment_url, attachment_type, attachment_name, is_read, read_at, created_at', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (before) {
      query = query.lt('created_at', before)
    }

    if (search) {
      query = query.ilike('message', `%${search}%`)
    }

    const { data: messages, count, error } = await query

    if (error) {
      apiLogger.error('Error fetching messages:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Mark customer messages as read
    await supabase
      .from('chat_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'customer')
      .eq('is_read', false)
      .then(() => {})
      .catch(() => { /* Non-critical side effect */ })

    // Reset CRO unread count
    await supabase
      .from('chat_conversations')
      .update({ unread_cro_count: 0 })
      .eq('id', conversationId)
      .then(() => {})
      .catch(() => { /* Non-critical side effect */ })

    return NextResponse.json({
      success: true,
      data: (messages || []).reverse(), // Reverse to chronological order
      meta: {
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching messages:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/chat/conversations/[id]/messages
 * Send a message in a conversation (CRO side)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id: conversationId } = await params
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify conversation belongs to this CRO
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id, cro_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (!conversation || conversation.cro_id !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const { data: msg, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'cro',
        sender_id: session.user.id,
        message: parsed.data.message,
        message_type: parsed.data.messageType,
        attachment_url: parsed.data.attachmentUrl || null,
        attachment_name: parsed.data.attachmentName || null,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error sending message:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: msg,
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error sending message:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
