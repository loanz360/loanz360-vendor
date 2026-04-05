import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { validatePagination } from '@/lib/validations/dse-validation'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

export const dynamic = 'force-dynamic'

/**
 * GET - List all proposals (deals) for the logged-in DSE
 * These are deals that originated from leads the DSE converted
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

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = validatePagination(searchParams.get('page'), searchParams.get('limit'))
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const stage = searchParams.get('stage') || ''
    const loan_type = searchParams.get('loan_type') || ''
    const is_overdue = searchParams.get('is_overdue') || ''
    const sortBy = searchParams.get('sortBy') || 'updated_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Fetch stats across ALL deals (not just current page)
    const { data: allDealsForStats } = await supabase
      .from('crm_deals')
      .select('status, loan_amount, sanctioned_amount, disbursed_amount, last_updated_by_bde_at, assigned_at')
      .eq('source_employee_id', user.id)
      .eq('source_type', 'dse')

    const allDeals = allDealsForStats || []
    const now = new Date()
    const stats = {
      total: allDeals.length,
      in_progress: allDeals.filter(d => d.status === 'in_progress').length,
      sanctioned: allDeals.filter(d => d.status === 'sanctioned').length,
      disbursed: allDeals.filter(d => d.status === 'disbursed').length,
      dropped: allDeals.filter(d => d.status === 'dropped').length,
      overdue: allDeals.filter(d => {
        if (d.status !== 'in_progress') return false
        const lastActivity = d.last_updated_by_bde_at || d.assigned_at
        if (!lastActivity) return false
        return (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60) > 3
      }).length,
      total_loan_amount: allDeals.reduce((sum, d) => sum + (d.loan_amount || 0), 0),
      total_sanctioned_amount: allDeals.reduce((sum, d) => sum + (d.sanctioned_amount || 0), 0),
      total_disbursed_amount: allDeals.reduce((sum, d) => sum + (d.disbursed_amount || 0), 0),
    }

    // Build query for deals where this DSE is the source
    let query = supabase
      .from('crm_deals')
      .select(`
        id,
        customer_name,
        phone,
        email,
        location,
        loan_type,
        loan_amount,
        loan_purpose,
        business_name,
        stage,
        status,
        bde_id,
        assigned_at,
        last_updated_by_bde_at,
        sanctioned_amount,
        disbursed_amount,
        documents,
        source_type,
        source_lead_type,
        dse_lead_id,
        created_at,
        updated_at,
        sanctioned_at,
        disbursed_at,
        dropped_at,
        drop_reason
      `, { count: 'exact' })
      .eq('source_employee_id', user.id)
      .eq('source_type', 'dse')

    // Apply filters
    if (status) {
      const statusList = status.split(',')
      query = query.in('status', statusList)
    }

    if (stage) {
      const stageList = stage.split(',')
      query = query.in('stage', stageList)
    }

    if (loan_type) {
      query = query.eq('loan_type', loan_type)
    }

    if (search) {
      const sanitizedSearch = sanitizeSearchInput(search)
      if (sanitizedSearch) {
        query = query.or(`customer_name.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`)
      }
    }

    // Apply sorting
    const validSortColumns = ['updated_at', 'assigned_at', 'loan_amount', 'customer_name', 'stage', 'created_at']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'updated_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // If overdue filter is active, fetch all results (no DB pagination)
    // because overdue is computed in JS, not filterable at DB level
    if (!is_overdue) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data: deals, error: dealsError, count } = await query

    if (dealsError) {
      apiLogger.error('Error fetching DSE proposals', dealsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch proposals' }, { status: 500 })
    }

    // Fetch BDE names for assigned deals
    const bdeIds = [...new Set(deals?.filter(d => d.bde_id).map(d => d.bde_id) || [])]
    let bdeMap: Record<string, string> = {}

    if (bdeIds.length > 0) {
      const { data: bdes } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', bdeIds)

      if (bdes) {
        bdeMap = bdes.reduce((acc, bde) => {
          acc[bde.id] = bde.full_name
          return acc
        }, {} as Record<string, string>)
      }
    }

    // Fetch update counts and last updates in a single query (fix N+1)
    const dealIds = deals?.map(d => d.id) || []
    const updateCounts: Record<string, number> = {}
    const lastUpdates: Record<string, { notes: string; stage: string }> = {}

    if (dealIds.length > 0) {
      const { data: allUpdates } = await supabase
        .from('deal_updates')
        .select('deal_id, notes_original, stage_at_update, created_at')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })

      if (allUpdates) {
        const seen = new Set<string>()
        allUpdates.forEach(u => {
          updateCounts[u.deal_id] = (updateCounts[u.deal_id] || 0) + 1
          if (!seen.has(u.deal_id)) {
            seen.add(u.deal_id)
            lastUpdates[u.deal_id] = { notes: u.notes_original || '', stage: u.stage_at_update }
          }
        })
      }
    }

    // Transform deals to proposals format
    const proposals = deals?.map(deal => {
      const assignedAt = deal.assigned_at ? new Date(deal.assigned_at) : null
      const lastUpdateAt = deal.last_updated_by_bde_at ? new Date(deal.last_updated_by_bde_at) : null
      const currentTime = new Date()

      // Calculate days since assignment
      const daysSinceAssignment = assignedAt
        ? Math.floor((currentTime.getTime() - assignedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      // Check if overdue (no update in last 3 hours for in_progress deals)
      let isOverdue = false
      if (deal.status === 'in_progress') {
        const lastActivity = lastUpdateAt || assignedAt
        if (lastActivity) {
          const hoursSinceUpdate = (currentTime.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)
          isOverdue = hoursSinceUpdate > 3
        }
      }

      return {
        deal_id: deal.id,
        customer_name: deal.customer_name,
        phone: deal.phone,
        email: deal.email,
        location: deal.location,
        loan_type: deal.loan_type,
        loan_amount: deal.loan_amount,
        loan_purpose: deal.loan_purpose,
        business_name: deal.business_name,
        current_stage: deal.stage,
        current_status: deal.status,
        bde_id: deal.bde_id,
        bde_name: deal.bde_id ? bdeMap[deal.bde_id] || 'Unassigned' : 'Not Assigned',
        assigned_at: deal.assigned_at,
        last_update_at: deal.last_updated_by_bde_at,
        last_update_notes: lastUpdates[deal.id]?.notes || null,
        last_update_stage: lastUpdates[deal.id]?.stage || null,
        sanctioned_amount: deal.sanctioned_amount,
        disbursed_amount: deal.disbursed_amount,
        documents: deal.documents || [],
        total_updates: updateCounts[deal.id] || 0,
        days_since_assignment: daysSinceAssignment,
        is_overdue: isOverdue,
        source_lead_type: deal.source_lead_type,
        dse_lead_id: deal.dse_lead_id,
        created_at: deal.created_at,
        sanctioned_at: deal.sanctioned_at,
        disbursed_at: deal.disbursed_at,
        dropped_at: deal.dropped_at,
        drop_reason: deal.drop_reason
      }
    }) || []

    // Filter by overdue if requested, then manually paginate
    let filteredProposals = proposals
    let totalForPagination = count || 0

    if (is_overdue === 'true') {
      filteredProposals = proposals.filter(p => p.is_overdue)
      totalForPagination = filteredProposals.length
      filteredProposals = filteredProposals.slice(offset, offset + limit)
    } else if (is_overdue === 'false') {
      filteredProposals = proposals.filter(p => !p.is_overdue)
      totalForPagination = filteredProposals.length
      filteredProposals = filteredProposals.slice(offset, offset + limit)
    }

    return NextResponse.json({
      success: true,
      data: {
        proposals: filteredProposals,
        stats,
        pagination: {
          page,
          limit,
          total: totalForPagination,
          total_pages: Math.ceil(totalForPagination / limit),
          has_more: offset + limit < totalForPagination
        }
      }
    })

  } catch (error) {
    apiLogger.error('Error in DSE proposals GET', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
