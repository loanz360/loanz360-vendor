import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // Parse pagination params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: contacts, error: contactsError, count } = await supabase
      .from('crm_contacts')
      .select('id, master_contact_id, name, phone, email, location, city, state, status, call_count, last_called_at, notes_timeline, loan_type, loan_amount, business_name, business_type, created_at, updated_at', { count: 'exact' })
      .or(`cro_id.eq.${user.id},assigned_to_cro.eq.${user.id}`)
      .eq('status', 'positive')
      .is('deleted_at', null)
      .order('last_called_at', { ascending: false })
      .range(from, to)

    if (contactsError) {
      logApiError(contactsError as Error, request, { action: 'get_positive_contacts', requestId })
      return createErrorResponse('Failed to fetch positive contacts', 500, requestId)
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { requestId, page, limit, total: count || 0 },
      })
    }

    // Batch fetch call logs with IN clause instead of N+1 per-contact queries
    const contactIds = contacts.map(c => c.id)

    const { data: callLogs } = await supabase
      .from('cro_call_logs')
      .select('id, entity_table_id, customer_name, customer_phone, call_outcome, call_duration_seconds, interest_level, ai_summary, ai_rating, ai_sentiment, ai_coaching_feedback, ai_positive_points, ai_improvement_points, ai_extracted_data, transcript, call_started_at, created_at')
      .in('entity_table_id', contactIds)
      .eq('cro_id', user.id)
      .order('created_at', { ascending: false })

    // Also check legacy call_logs table as fallback (filter by CRO ownership)
    const { data: legacyCallLogs } = await supabase
      .from('call_logs')
      .select('*')
      .in('contact_id', contactIds)
      .eq('cro_id', user.id)
      .order('created_at', { ascending: false })

    // Group call logs by contact ID (take latest per contact)
    // Process NEW call logs FIRST (higher priority), then legacy as fallback
    const callLogMap = new Map<string, Record<string, unknown>>()

    // Add new call logs first (higher priority) with field name mapping
    callLogs?.forEach(log => {
      if (!callLogMap.has(log.entity_table_id)) {
        callLogMap.set(log.entity_table_id, {
          outcome: log.call_outcome,
          duration: log.call_duration_seconds,
          sentiment: log.ai_sentiment,
          ai_rating: log.ai_rating,
          interest_level: log.interest_level,
          coaching_feedback: log.ai_coaching_feedback,
          positive_points: log.ai_positive_points,
          improvement_points: log.ai_improvement_points,
          transcript: log.transcript,
          ai_summary: log.ai_summary,
          call_started_at: log.call_started_at,
          created_at: log.created_at,
        })
      }
    })

    // Add legacy logs only for contacts NOT already in the map
    legacyCallLogs?.forEach(log => {
      if (!callLogMap.has(log.contact_id)) {
        callLogMap.set(log.contact_id, log)
      }
    })

    // Attach latest call log to each contact
    const contactsWithCallLogs = contacts.map(contact => ({
      ...contact,
      latestCall: callLogMap.get(contact.id) || null,
    }))

    return NextResponse.json({
      success: true,
      data: contactsWithCallLogs,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        total: count || contactsWithCallLogs.length,
        page,
        limit,
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'get_positive_contacts', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
