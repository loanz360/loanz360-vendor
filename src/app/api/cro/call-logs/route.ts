import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { maskRecord, maskDataForRole } from '@/lib/utils/data-masking'
import { apiLogger } from '@/lib/utils/logger'


// Validation schema for creating a call log
const createCallLogSchema = z.object({
  contact_type: z.enum(['contact', 'positive_contact', 'lead']),
  entity_table_id: z.string().uuid(),
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().min(10).max(15),
  call_type: z.enum(['outbound', 'inbound']).default('outbound'),
  call_duration_seconds: z.number().int().min(0).default(0),
  call_outcome: z.enum([
    'connected', 'busy', 'no_answer', 'wrong_number',
    'not_interested', 'interested', 'callback_requested', 'switched_off'
  ]),
  disposition_notes: z.string().max(2000).optional(),
  interest_level: z.enum(['high', 'medium', 'low', 'none']).optional(),
  next_followup_at: z.string().datetime().optional(),
  call_started_at: z.string().datetime().optional(),
})

// Query params schema for GET
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  outcome: z.string().optional(),
  contact_type: z.enum(['contact', 'positive_contact', 'lead']).optional(),
  sort_by: z.enum(['call_started_at', 'call_duration_seconds', 'created_at']).default('call_started_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * POST /api/cro/call-logs
 * Create a new call log entry after a SIM-based call
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    const body = await request.json()
    const parsed = createCallLogSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const data = parsed.data
    const userId = user.id

    // Insert call log
    const { data: callLog, error: insertError } = await supabase
      .from('cro_call_logs')
      .insert({
        cro_id: userId,
        contact_type: data.contact_type,
        entity_table_id: data.entity_table_id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        call_type: data.call_type,
        call_duration_seconds: data.call_duration_seconds,
        call_outcome: data.call_outcome,
        disposition_notes: data.disposition_notes || null,
        interest_level: data.interest_level || null,
        next_followup_at: data.next_followup_at || null,
        call_started_at: data.call_started_at || new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Failed to create call log:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create call log' }, { status: 500 })
    }

    // Update call count on the entity (best effort, don't fail if this errors)
    try {
      const tableMap: Record<string, string> = {
        contact: 'crm_contacts',
        positive_contact: 'positive_contacts',
        lead: 'crm_leads',
      }
      const table = tableMap[data.contact_type]
      if (table) {
        await supabase.rpc('increment_field', {
          table_name: table,
          row_id: data.entity_table_id,
          field_name: 'call_count',
          increment_by: 1,
        }).then(() => {}).catch(() => { /* Non-critical side effect */ })
      }
    } catch {
      // Non-critical: call count increment failed
    }

    // Auto-append call log note to entity's notes_timeline
    try {
      const tableMap: Record<string, string> = {
        contact: 'crm_contacts',
        positive_contact: 'positive_contacts',
        lead: 'crm_leads',
      }
      const table = tableMap[data.contact_type]
      if (table) {
        const { data: entity } = await supabase
          .from(table)
          .select('notes_timeline')
          .eq('id', data.entity_table_id)
          .maybeSingle()

        const existingNotes = Array.isArray(entity?.notes_timeline) ? entity.notes_timeline : []
        const callNote = {
          id: callLog.id,
          type: 'call_log',
          timestamp: new Date().toISOString(),
          content: `${data.call_outcome === 'interested' ? '★ ' : ''}Call (${data.call_type}) - ${data.call_outcome.replace(/_/g, ' ')}${data.call_duration_seconds > 0 ? ` (${Math.floor(data.call_duration_seconds / 60)}m ${data.call_duration_seconds % 60}s)` : ''}${data.disposition_notes ? `: ${data.disposition_notes}` : ''}`,
          created_by: userId,
          created_at: new Date().toISOString(),
          is_editable: false,
        }

        await supabase
          .from(table)
          .update({ notes_timeline: [...existingNotes, callNote] })
          .eq('id', data.entity_table_id)
      }
    } catch {
      // Non-critical: notes timeline update failed
    }

    // If next_followup_at provided, create a follow-up entry (best effort)
    if (data.next_followup_at && data.contact_type === 'lead') {
      try {
        await supabase.from('crm_followups').insert({
          lead_id: data.entity_table_id,
          scheduled_at: data.next_followup_at,
          title: `Follow-up after ${data.call_outcome} call`,
          status: 'Pending',
          owner_id: userId,
        })
      } catch {
        // Non-critical
      }
    }

    // Mask PII for CRO role
    const maskRole = user.user_metadata?.sub_role || user.user_metadata?.role || 'CRO'
    const maskedLog = maskRecord(callLog as Record<string, unknown>, !['SUPER_ADMIN', 'ADMIN'].includes(maskRole))

    return NextResponse.json({
      success: true,
      data: maskedLog,
      message: 'Call log created successfully',
    })
  } catch (error) {
    apiLogger.error('Error creating call log:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/cro/call-logs
 * List call logs for the authenticated CRO with pagination and filters
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => { params[key] = value })
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const { page, limit, date_from, date_to, outcome, contact_type, sort_by, sort_order } = parsed.data
    const userId = user.id
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('cro_call_logs')
      .select('*', { count: 'exact' })
      .eq('cro_id', userId)

    if (date_from) {
      query = query.gte('call_started_at', date_from)
    }
    if (date_to) {
      query = query.lte('call_started_at', date_to)
    }
    if (outcome) {
      query = query.eq('call_outcome', outcome)
    }
    if (contact_type) {
      query = query.eq('contact_type', contact_type)
    }

    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: callLogs, count, error } = await query

    if (error) {
      apiLogger.error('Error fetching call logs:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch call logs' }, { status: 500 })
    }

    // Mask PII for CRO role
    const maskRole2 = user.user_metadata?.sub_role || user.user_metadata?.role || 'CRO'
    const maskedLogs = maskDataForRole(
      (callLogs || []) as Record<string, unknown>[],
      maskRole2
    )

    return NextResponse.json({
      success: true,
      data: maskedLogs,
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
    apiLogger.error('Error fetching call logs:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
