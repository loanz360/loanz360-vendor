import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { calculateLeadScore, validatePagination } from '@/lib/validations/dse-validation'


// Validation schema for lead
const leadSchema = z.object({
  customer_name: z.string().min(2).max(255),
  company_name: z.string().max(255).optional().nullable(),
  designation: z.string().max(150).optional().nullable(),
  mobile: z.string().min(10).max(15),
  email: z.string().email().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  lead_type: z.enum([
    'Business Loan', 'Personal Loan', 'Home Loan', 'Auto Loan',
    'Education Loan', 'Mortgage', 'Insurance', 'Investment', 'Other'
  ]),
  product_interest: z.string().max(255).optional().nullable(),
  estimated_value: z.number().optional().nullable(),
  probability_percentage: z.number().min(0).max(100).default(50),
  expected_close_date: z.string().optional().nullable(),
  lead_stage: z.enum([
    'New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation',
    'Won', 'Lost', 'On Hold', 'Nurturing'
  ]).default('New'),
  requirements: z.string().optional().nullable(),
  pain_points: z.string().optional().nullable(),
  budget_range: z.string().max(100).optional().nullable(),
  decision_timeline: z.string().max(100).optional().nullable(),
  decision_makers: z.string().optional().nullable(),
  competitors: z.array(z.string()).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
})

// GET - List leads with filtering
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    // Parse query parameters with validated pagination
    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = validatePagination(
      searchParams.get('page'),
      searchParams.get('limit')
    )
    const search = searchParams.get('search') || ''
    const stage = searchParams.get('stage') || ''
    const leadType = searchParams.get('leadType') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build query
    let query = supabase
      .from('dse_leads')
      .select('*, dse_customers(full_name, company_name, primary_mobile)', { count: 'exact' })
      .eq('dse_user_id', user.id)
      .eq('is_deleted', false)

    // Apply search
    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`customer_name.ilike.%${safeSearch}%,company_name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%`)
      }
    }

    // Apply stage filter
    if (stage) {
      query = query.eq('lead_stage', stage)
    }

    // Apply lead type filter
    if (leadType) {
      query = query.eq('lead_type', leadType)
    }

    // Apply sorting
    const validSortColumns = ['created_at', 'customer_name', 'lead_stage', 'estimated_value', 'expected_close_date', 'probability_percentage']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: leads, error, count } = await query

    if (error) throw error

    // Get pipeline summary using grouped counts instead of fetching all rows
    // We query each stage's count and sum separately to avoid loading all leads into memory
    const stages = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'On Hold', 'Nurturing']
    const stageQueries = stages.map(s =>
      supabase
        .from('dse_leads')
        .select('estimated_value', { count: 'exact' })
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)
        .eq('lead_stage', s)
    )

    const stageResults = await Promise.all(stageQueries)

    const stageStats: Record<string, { count: number; value: number }> = {}
    stages.forEach((s, i) => {
      const result = stageResults[i]
      const stageCount = result.count || 0
      if (stageCount > 0) {
        const totalValue = (result.data || []).reduce((sum: number, row: { estimated_value: number | null }) => sum + (row.estimated_value || 0), 0)
        stageStats[s] = { count: stageCount, value: totalValue }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        leads,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        pipelineStats: stageStats
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching leads', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new lead (standalone, not from customer)
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role using shared utility
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = leadSchema.parse(body)

    const { mobile, email, city, estimated_value, source } = validatedData

    // Check for duplicate lead with the same mobile for this DSE
    const { data: existingLead } = await supabase
      .from('dse_leads')
      .select('id, lead_id, customer_name, lead_stage')
      .eq('dse_user_id', user.id)
      .eq('mobile', mobile)
      .eq('is_deleted', false)
      .maybeSingle()

    if (existingLead) {
      return NextResponse.json({
        success: false,
        error: 'A lead with this mobile number already exists',
        existingLead: { id: existingLead.id, lead_id: existingLead.lead_id, customer_name: existingLead.customer_name, lead_stage: existingLead.lead_stage }
      }, { status: 409 })
    }

    // Calculate dynamic lead score instead of hardcoded value
    const leadScore = calculateLeadScore({
      has_name: true,
      has_mobile: true,
      has_email: !!email,
      has_location: !!city,
      has_employment_details: false,
      has_documents: false,
      response_time_hours: null,
      total_interactions: 0,
      customer_initiated_contact: false,
      document_submission_speed_days: null,
      loan_amount: estimated_value ?? null,
      product_min_amount: null,
      product_max_amount: null,
      source_type: source || 'DSE',
      days_since_creation: 0,
    })

    // Create lead
    const { data: lead, error: insertError } = await supabase
      .from('dse_leads')
      .insert({
        ...validatedData,
        dse_user_id: user.id,
        lead_score: leadScore,
      })
      .select()
      .maybeSingle()

    // Null check after insert
    if (insertError || !lead) {
      apiLogger.error('Failed to create lead', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create lead' }, { status: 500 })
    }

    // Create stage history with error checking
    const { error: stageHistoryError } = await supabase.from('dse_lead_stage_history').insert({
      lead_id: lead.id,
      to_stage: lead.lead_stage,
      changed_by: user.id,
      reason: 'Lead created'
    })

    if (stageHistoryError) {
      apiLogger.error('Failed to create stage history for lead', { leadId: lead.id, error: stageHistoryError })
    }

    // Create audit log with error checking
    const { error: auditError } = await supabase.from('dse_audit_log').insert({
      entity_type: 'Lead',
      entity_id: lead.id,
      action: 'Created',
      new_values: lead,
      user_id: user.id,
      changes_summary: `Created lead: ${lead.customer_name}`
    })

    if (auditError) {
      apiLogger.error('Failed to create audit log for lead', { leadId: lead.id, error: auditError })
    }

    return NextResponse.json({
      success: true,
      data: lead,
      message: 'Lead created successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    apiLogger.error('Error creating lead', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
