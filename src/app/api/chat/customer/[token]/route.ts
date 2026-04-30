import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'


const sendMessageSchema = z.object({
  message: z.string().min(1).max(5000),
})

/**
 * Validate token and get link + CRO profile + conversation.
 */
async function validateToken(token: string) {
  if (!token || token.length < 16) return null

  const supabase = await createClient()

  const { data: link, error: linkError } = await supabase
    .from('customer_cro_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (linkError || !link || !link.is_active) return null
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null

  return { link, supabase }
}

/**
 * GET /api/chat/customer/[token]
 * Public: Validates token, returns CRO info, conversation, and messages.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { token } = await params
    const result = await validateToken(token)

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'This link is not valid or has expired.',
        code: 'LINK_NOT_FOUND',
      }, { status: 404 })
    }

    const { link, supabase } = result

    // Fetch CRO profile
    const { data: croProfile } = await supabase
      .from('employee_profile')
      .select('first_name, last_name, phone, email, designation, profile_picture_url, status')
      .eq('user_id', link.cro_id)
      .maybeSingle()

    const croActive = croProfile?.status === 'ACTIVE'

    // Check for reassigned CRO if inactive
    let reassignedCro = null
    if (!croActive) {
      const { data: newLink } = await supabase
        .from('customer_cro_links')
        .select('cro_id')
        .eq('entity_id', link.entity_id)
        .eq('contact_type', link.contact_type)
        .eq('is_active', true)
        .neq('cro_id', link.cro_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (newLink) {
        const { data: newCroProfile } = await supabase
          .from('employee_profile')
          .select('first_name, last_name, phone, email, designation, profile_picture_url')
          .eq('user_id', newLink.cro_id)
          .maybeSingle()

        if (newCroProfile) {
          reassignedCro = {
            name: `${newCroProfile.first_name || ''} ${newCroProfile.last_name || ''}`.trim(),
            phone: newCroProfile.phone,
            designation: newCroProfile.designation,
            profilePicture: newCroProfile.profile_picture_url,
          }
        }
      }
    }

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('cro_id', link.cro_id)
      .eq('customer_phone', link.customer_phone)
      .eq('status', 'active')
      .maybeSingle()

    if (!conversation) {
      const { data: newConvo } = await supabase
        .from('chat_conversations')
        .insert({
          cro_id: link.cro_id,
          customer_phone: link.customer_phone,
          customer_name: link.customer_name,
          contact_type: link.contact_type,
          entity_id: link.entity_id,
          customer_cro_link_id: link.id,
        })
        .select('id')
        .maybeSingle()
      conversation = newConvo
    }

    // Fetch messages
    let messages: unknown[] = []
    if (conversation) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id, sender_type, message, message_type, attachment_url, attachment_name, is_read, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(100)

      messages = msgs || []

      // Mark CRO messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('sender_type', 'cro')
        .eq('is_read', false)
        .then(() => {}).catch(() => { /* Non-critical side effect */ })

      await supabase
        .from('chat_conversations')
        .update({ unread_customer_count: 0 })
        .eq('id', conversation.id)
        .then(() => {}).catch(() => { /* Non-critical side effect */ })
    }

    // Update last_used_at
    await supabase
      .from('customer_cro_links')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', link.id)
      .then(() => {}).catch(() => { /* Non-critical side effect */ })

    return NextResponse.json({
      success: true,
      data: {
        customerName: link.customer_name,
        conversationId: conversation?.id || null,
        cro: {
          name: croProfile
            ? `${croProfile.first_name || ''} ${croProfile.last_name || ''}`.trim()
            : 'Your LOANZ 360 Advisor',
          phone: croProfile?.phone || null,
          email: croProfile?.email || null,
          designation: croProfile?.designation || 'Loan Advisor',
          profilePicture: croProfile?.profile_picture_url || null,
          isActive: croActive,
        },
        reassignedCro,
        aiSummary: link.ai_summary,
        contactType: link.contact_type,
        messages,
      },
    })
  } catch (error) {
    apiLogger.error('Chat token GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/chat/customer/[token]
 * Public: Customer sends a message via their token link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { token } = await params
    const result = await validateToken(token)

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'This link is not valid or has expired.',
      }, { status: 404 })
    }

    const { link, supabase } = result

    // Find conversation
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('cro_id', link.cro_id)
      .eq('customer_phone', link.customer_phone)
      .eq('status', 'active')
      .maybeSingle()

    if (!conversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found. Please refresh the page.',
      }, { status: 404 })
    }

    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Message is required (max 5000 characters)',
      }, { status: 400 })
    }

    const { data: msg, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'customer',
        sender_id: link.customer_phone,
        message: parsed.data.message,
        message_type: 'text',
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error sending customer message:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: msg,
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Customer chat POST error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
