import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'
import { apiLogger } from '@/lib/utils/logger'


const createConversationSchema = z.object({
  customerPhone: z.string().min(10).max(15),
  customerName: z.string().min(1).max(200),
  contactType: z.enum(['contact', 'positive_contact', 'lead']),
  entityId: z.string().uuid(),
  customerCroLinkId: z.string().uuid().optional(),
})

/**
 * GET /api/chat/conversations
 * List all conversations for the authenticated CRO
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
    const status = searchParams.get('status') || 'active'
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    let query = supabase
      .from('chat_conversations')
      .select('*', { count: 'exact' })
      .eq('cro_id', session.user.id)
      .eq('status', status)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`customer_name.ilike.%${safeSearch}%,customer_phone.ilike.%${safeSearch}%`)
      }
    }

    const { data: conversations, count, error } = await query

    if (error) {
      apiLogger.error('Error fetching conversations:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch conversations' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: conversations || [],
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
    apiLogger.error('Error fetching conversations:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/chat/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createConversationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const data = parsed.data
    const userId = session.user.id

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('cro_id', userId)
      .eq('customer_phone', data.customerPhone)
      .eq('status', 'active')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: 'Conversation already exists',
      })
    }

    const { data: conversation, error: insertError } = await supabase
      .from('chat_conversations')
      .insert({
        cro_id: userId,
        customer_phone: data.customerPhone,
        customer_name: data.customerName,
        contact_type: data.contactType,
        entity_id: data.entityId,
        customer_cro_link_id: data.customerCroLinkId || null,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating conversation:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create conversation' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: conversation,
      message: 'Conversation created',
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error creating conversation:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
