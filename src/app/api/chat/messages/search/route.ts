import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/messages/search?q=searchTerm
 * Search messages across all conversations belonging to the authenticated CRO
 * Returns matching messages with conversation context
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const rawQuery = searchParams.get('q') || ''
    const safeQuery = sanitizeSearchInput(rawQuery)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    if (!safeQuery || safeQuery.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const userId = session.user.id

    // First get all conversation IDs for this CRO
    const { data: conversations, error: convoError } = await supabase
      .from('chat_conversations')
      .select('id, customer_name, customer_phone')
      .eq('cro_id', userId)

    if (convoError || !conversations || conversations.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const convoIds = conversations.map(c => c.id)
    const convoMap = new Map(conversations.map(c => [c.id, c]))

    // Search messages within those conversations
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_type, message, message_type, created_at')
      .in('conversation_id', convoIds)
      .ilike('message', `%${safeQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (msgError) {
      apiLogger.error('Message search error:', msgError)
      return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 })
    }

    // Enrich messages with conversation context
    const results = (messages || []).map(msg => {
      const convo = convoMap.get(msg.conversation_id)
      return {
        ...msg,
        customer_name: convo?.customer_name || 'Unknown',
        customer_phone: convo?.customer_phone || '',
      }
    })

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    apiLogger.error('Message search error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
