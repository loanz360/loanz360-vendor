import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_SLA_POLICIES } from '@/lib/tickets/sla-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/sla/policies
 * Get all SLA policies
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission (Super Admin or Manager roles)
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || !['SUPER_ADMIN', 'EMPLOYEE'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const priority = searchParams.get('priority')
    const source = searchParams.get('source')
    const activeOnly = searchParams.get('active') !== 'false'

    let query = supabase
      .from('unified_sla_policies')
      .select('*')
      .order('priority', { ascending: true })

    if (priority) {
      query = query.eq('priority', priority)
    }

    if (source) {
      query = query.or(`ticket_source.eq.${source},ticket_source.is.null`)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: policies, error } = await query

    if (error) {
      apiLogger.error('Error fetching SLA policies', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ policies: policies || [] })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/sla/policies
 * Create a new SLA policy
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Super Admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const bodySchema = z.object({


      name: z.string().optional(),


      description: z.string().optional(),


      priority: z.string().optional(),


      ticket_source: z.string().optional(),


      first_response_hours: z.string().optional(),


      resolution_hours: z.string().optional(),


      business_hours_only: z.string().optional(),


      business_start_hour: z.string().optional(),


      business_end_hour: z.string().optional(),


      business_days: z.string().optional(),


      exclude_holidays: z.string().optional(),


      escalation_enabled: z.string().optional(),


      escalation_thresholds: z.string().optional(),


      is_active: z.boolean().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    const requiredFields = ['name', 'priority', 'first_response_hours', 'resolution_hours']
    for (const field of requiredFields) {
      if (body[field] === undefined) {
        return NextResponse.json({ success: false, error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const policyData = {
      name: body.name,
      description: body.description,
      priority: body.priority,
      ticket_source: body.ticket_source || null,
      first_response_hours: body.first_response_hours,
      resolution_hours: body.resolution_hours,
      business_hours_only: body.business_hours_only ?? true,
      business_start_hour: body.business_start_hour ?? 9,
      business_end_hour: body.business_end_hour ?? 18,
      business_days: body.business_days ?? [1, 2, 3, 4, 5],
      exclude_holidays: body.exclude_holidays ?? true,
      escalation_enabled: body.escalation_enabled ?? true,
      escalation_thresholds: body.escalation_thresholds ?? { warning_percent: 70, critical_percent: 85 },
      is_active: body.is_active ?? true,
      created_by: user.id
    }

    const { data: policy, error } = await supabase
      .from('unified_sla_policies')
      .insert(policyData)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating SLA policy', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ policy }, { status: 201 })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/sla/policies
 * Initialize default SLA policies
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Super Admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Check if policies already exist
    const { count } = await supabase
      .from('unified_sla_policies')
      .select('*', { count: 'exact', head: true })

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'SLA policies already exist. Use POST to add new ones or PATCH to update.' },
        { status: 409 }
      )
    }

    // Insert default policies
    const policiesToInsert = DEFAULT_SLA_POLICIES.map(policy => ({
      ...policy,
      created_by: user.id
    }))

    const { data: policies, error } = await supabase
      .from('unified_sla_policies')
      .insert(policiesToInsert)
      .select()

    if (error) {
      apiLogger.error('Error initializing SLA policies', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Default SLA policies initialized successfully',
      policies
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
