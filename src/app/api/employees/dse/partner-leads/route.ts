import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'
import { buildSearchFilter } from '@/lib/utils/search-sanitizer'


/**
 * GET /api/employees/dse/partner-leads
 * Returns leads submitted by partners recruited by this DSE.
 *
 * Security: Field filtering applied — DSE cannot see customer PII or documents.
 * DSE can only see: customer first name, loan type, amount, stage, status, partner info.
 *
 * FIX: Pipeline summary now computed from ALL leads (separate query), not just current page.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const stage = searchParams.get('stage') || ''
    const loanType = searchParams.get('loan_type') || ''
    const partnerId = searchParams.get('partner_id') || ''

    // Get partner IDs recruited by this DSE
    const { data: myPartners, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, full_name, partner_type')
      .eq('recruited_by_cpe', userId)

    if (partnerError) {
      apiLogger.error('DSE partner-leads: failed to get partners', partnerError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch data', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    if (!myPartners || myPartners.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pipeline: {},
        meta: { page, limit, total: 0, totalPages: 0 },
      })
    }

    const partnerIds = myPartners.map((p: { id: string }) => p.id)
    const partnerMap = new Map(
      myPartners.map((p: { id: string; partner_id: string; full_name: string; partner_type: string }) => [p.id, p])
    )

    // FIX: Run pipeline summary from ALL data (separate query) + paginated results in parallel
    const [pipelineResult, paginatedResult] = await Promise.all([
      // Pipeline summary across ALL partner leads (not paginated)
      supabase
        .from('partner_leads')
        .select('lead_status, required_loan_amount')
        .in('partner_id', partnerIds)
        .eq('is_active', true),

      // Paginated leads with filters — only select FILTERED fields (no PII)
      (async () => {
        let query = supabase
          .from('partner_leads')
          .select(`
            id, lead_number, partner_id, partner_type,
            customer_name, customer_city,
            loan_type, required_loan_amount,
            lead_status, form_status, form_completion_percentage,
            assigned_bde_id, assigned_bde_name,
            cam_status, lead_priority,
            created_at, updated_at, form_submitted_at
          `, { count: 'exact' })
          .in('partner_id', partnerIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (stage) query = query.eq('lead_status', stage)
        if (loanType) query = query.eq('loan_type', loanType)
        if (partnerId) query = query.eq('partner_id', partnerId)

        // Sanitized search — only customer first name and lead number (no mobile/email)
        const searchFilter = buildSearchFilter(search, ['customer_name', 'lead_number'])
        if (searchFilter) {
          query = query.or(searchFilter)
        }

        query = query.range(offset, offset + limit - 1)
        return query
      })(),
    ])

    // Build pipeline summary from ALL leads
    const pipeline: Record<string, { count: number; value: number }> = {}
    if (pipelineResult.data) {
      pipelineResult.data.forEach((lead: Record<string, unknown>) => {
        const st = (lead.lead_status as string) || 'Unknown'
        if (!pipeline[st]) pipeline[st] = { count: 0, value: 0 }
        pipeline[st].count++
        pipeline[st].value += (lead.required_loan_amount as number) || 0
      })
    }

    const { data: leads, error: leadsError, count } = paginatedResult

    if (leadsError) {
      apiLogger.error('DSE partner-leads: query error', leadsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leads', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    // Enrich leads with partner info and mask customer PII
    const enrichedLeads = (leads || []).map((lead: Record<string, unknown>) => {
      const partner = partnerMap.get(lead.partner_id as string) as
        { partner_id: string; full_name: string; partner_type: string } | undefined

      // Mask customer name to first name only
      const fullName = (lead.customer_name as string) || ''
      const firstName = fullName.split(' ')[0] || fullName

      return {
        id: lead.id,
        lead_number: lead.lead_number,
        customer_first_name: firstName,
        customer_city: lead.customer_city,
        loan_type: lead.loan_type,
        loan_amount: lead.required_loan_amount,
        lead_status: lead.lead_status,
        form_status: lead.form_status,
        form_completion: lead.form_completion_percentage,
        cam_status: lead.cam_status,
        priority: lead.lead_priority,
        assigned_bde: lead.assigned_bde_name,
        partner_name: partner?.full_name || 'Unknown',
        partner_id_display: partner?.partner_id || '',
        partner_type: partner?.partner_type || lead.partner_type,
        submitted_at: lead.form_submitted_at || lead.created_at,
        last_updated: lead.updated_at,
        is_read_only: true,
      }
    })

    // Collect unique loan types for filter dropdown
    const loanTypes = [...new Set(
      (pipelineResult.data || [])
        .map((l: Record<string, unknown>) => l.loan_type as string)
        .filter(Boolean)
    )].sort()

    return NextResponse.json({
      success: true,
      data: enrichedLeads,
      pipeline,
      loan_types: loanTypes,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('DSE partner-leads error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
