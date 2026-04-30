import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'


const automationSchema = z.object({
  callLogId: z.string().uuid(),
  contactPhone: z.string().min(10).max(15),
  customerName: z.string().min(1).max(200),
  contactType: z.enum(['contact', 'positive_contact', 'lead']),
  entityId: z.string().uuid(),
  aiSummary: z.string().max(500).optional(),
  channels: z.enum(['sms', 'whatsapp', 'both']).default('both'),
})

/**
 * POST /api/cro/post-call-automation
 * Triggers automatic post-call messaging (SMS + WhatsApp) to the customer.
 * Creates a customer_cro_link with a unique token for the contact-back URL.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const parsed = automationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const data = parsed.data
    const userId = user.id

    // Fetch CRO profile for name and phone
    const { data: croProfile } = await supabase
      .from('employee_profile')
      .select('first_name, last_name, phone')
      .eq('user_id', userId)
      .maybeSingle()

    const croName = croProfile
      ? `${croProfile.first_name || ''} ${croProfile.last_name || ''}`.trim()
      : 'Your LOANZ 360 advisor'
    const croPhone = croProfile?.phone || ''

    // Create or reuse customer_cro_link
    const { data: existingLink } = await supabase
      .from('customer_cro_links')
      .select('id, token')
      .eq('cro_id', userId)
      .eq('customer_phone', data.contactPhone)
      .eq('is_active', true)
      .maybeSingle()

    let linkToken: string
    if (existingLink) {
      linkToken = existingLink.token
      // Update the link with latest call info
      await supabase
        .from('customer_cro_links')
        .update({
          call_log_id: data.callLogId,
          ai_summary: data.aiSummary || null,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existingLink.id)
    } else {
      const { data: newLink, error: linkError } = await supabase
        .from('customer_cro_links')
        .insert({
          cro_id: userId,
          customer_phone: data.contactPhone,
          customer_name: data.customerName,
          contact_type: data.contactType,
          entity_id: data.entityId,
          call_log_id: data.callLogId,
          ai_summary: data.aiSummary || null,
        })
        .select('token')
        .maybeSingle()

      if (linkError || !newLink) {
        apiLogger.error('Failed to create customer_cro_link:', linkError)
        return NextResponse.json({ success: false, error: 'Failed to create contact link' }, { status: 500 })
      }
      linkToken = newLink.token
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.loanz360.com'
    const chatLink = `${baseUrl}/chat/${linkToken}`

    // Build the summary text
    const summaryText = data.aiSummary
      ? data.aiSummary.substring(0, 200)
      : `Thank you for speaking with ${croName} about your loan requirements.`

    // Prepare message content
    const smsMessage = `Hi ${data.customerName}, ${summaryText} Reach us anytime: ${chatLink} - ${croName}, LOANZ 360${croPhone ? ` | ${croPhone}` : ''}`

    const whatsappMessage = `Hi ${data.customerName}!

Thank you for your time on the call with *${croName}* from *LOANZ 360*.

${summaryText}

You can reach us anytime through this link:
${chatLink}

${croPhone ? `Or call us: ${croPhone}` : ''}

We look forward to helping you with your loan needs!`

    // Track delivery
    let smsStatus = 'skipped'
    let whatsappStatus = 'skipped'
    let smsTransactionId: string | null = null
    let whatsappMessageId: string | null = null
    let errorDetails: string | null = null

    // Send SMS (best effort)
    if (data.channels === 'sms' || data.channels === 'both') {
      try {
        const smsResponse = await fetch(`${baseUrl}/api/communications/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            to: data.contactPhone,
            message: smsMessage,
            type: 'post_call_summary',
          }),
        })
        const smsResult = await smsResponse.json()
        if (smsResult.success) {
          smsStatus = 'sent'
          smsTransactionId = smsResult.transactionId || null
        } else {
          smsStatus = 'failed'
          errorDetails = `SMS: ${smsResult.error || 'Unknown error'}`
        }
      } catch (err) {
        smsStatus = 'failed'
        errorDetails = `SMS: ${err instanceof Error ? err.message : 'Send failed'}`
      }
    }

    // Send WhatsApp (best effort)
    if (data.channels === 'whatsapp' || data.channels === 'both') {
      try {
        const waResponse = await fetch(`${baseUrl}/api/communications/send-whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            to: data.contactPhone,
            message: whatsappMessage,
            type: 'post_call_summary',
          }),
        })
        const waResult = await waResponse.json()
        if (waResult.success) {
          whatsappStatus = 'sent'
          whatsappMessageId = waResult.messageId || null
        } else {
          whatsappStatus = 'failed'
          const waError = `WhatsApp: ${waResult.error || 'Unknown error'}`
          errorDetails = errorDetails ? `${errorDetails}; ${waError}` : waError
        }
      } catch (err) {
        whatsappStatus = 'failed'
        const waError = `WhatsApp: ${err instanceof Error ? err.message : 'Send failed'}`
        errorDetails = errorDetails ? `${errorDetails}; ${waError}` : waError
      }
    }

    // Log delivery attempt
    await supabase.from('post_call_delivery_log').insert({
      call_log_id: data.callLogId,
      cro_id: userId,
      customer_phone: data.contactPhone,
      customer_name: data.customerName,
      channel: data.channels,
      sms_status: smsStatus,
      whatsapp_status: whatsappStatus,
      sms_transaction_id: smsTransactionId,
      whatsapp_message_id: whatsappMessageId,
      chat_link: chatLink,
      error_details: errorDetails,
    }).then(() => {}).catch(() => { /* Non-critical side effect */ }) // Non-critical logging

    return NextResponse.json({
      success: true,
      data: {
        chatLink,
        linkToken,
        smsStatus,
        whatsappStatus,
      },
      message: `Post-call message${smsStatus === 'sent' || whatsappStatus === 'sent' ? ' sent' : ' attempted'} successfully`,
    })
  } catch (error) {
    apiLogger.error('Post-call automation error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
