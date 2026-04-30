import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Helper function to verify DSM role
async function verifyDSMRole(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { isValid: false, error: 'User profile not found' }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_MANAGER') {
    return { isValid: false, error: 'Access denied. This feature is only available for Direct Sales Managers.' }
  }

  return { isValid: true, profile }
}

/**
 * GET - List all proposals (deals) for the DSM's team members (DSEs who report to this DSM)
 * Aggregates all proposals from all Direct Sales Executives in the team
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

    // Verify DSM role
    const roleCheck = await verifyDSMRole(supabase, user.id)
    if (!roleCheck.isValid) {
      return NextResponse.json({ success: false, error: roleCheck.error }, { status: 403 })
    }

    // Get all DSEs who report to this DSM
    const { data: teamMembers, error: teamError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('reporting_manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    // Filter team members to only include DSEs
    const teamMemberIds = teamMembers?.map(tm => tm.user_id) || []

    if (teamMemberIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          proposals: [],
          stats: {
            total: 0,
            in_progress: 0,
            sanctioned: 0,
            disbursed: 0,
            dropped: 0,
            overdue: 0,
            total_loan_amount: 0,
            total_sanctioned_amount: 0,
            total_disbursed_amount: 0
          },
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            total_pages: 0,
            has_more: false
          },
          team_members: []
        }
      })
    }

    // Verify which team members are DSEs
    const { data: dseUsers } = await supabase
      .from('users')
      .select('id, full_name, email, avatar_url')
      .in('id', teamMemberIds)
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')

    const dseIds = dseUsers?.map(u => u.id) || []

    if (dseIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          proposals: [],
          stats: {
            total: 0,
            in_progress: 0,
            sanctioned: 0,
            disbursed: 0,
            dropped: 0,
            overdue: 0,
            total_loan_amount: 0,
            total_sanctioned_amount: 0,
            total_disbursed_amount: 0
          },
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            total_pages: 0,
            has_more: false
          },
          team_members: []
        }
      })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const stage = searchParams.get('stage') || ''
    const loan_type = searchParams.get('loan_type') || ''
    const is_overdue = searchParams.get('is_overdue') || ''
    const dse_id = searchParams.get('dse_id') || '' // Filter by specific DSE
    const sortBy = searchParams.get('sortBy') || 'updated_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build query for deals where source_employee_id is any of the team DSEs
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
        source_employee_id,
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
      .in('source_employee_id', dseIds)
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

    if (dse_id && dseIds.includes(dse_id)) {
      query = query.eq('source_employee_id', dse_id)
    }

    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Apply sorting
    const validSortColumns = ['updated_at', 'assigned_at', 'loan_amount', 'customer_name', 'stage', 'created_at']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'updated_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: deals, error: dealsError, count } = await query

    if (dealsError) {
      apiLogger.error('Error fetching team proposals', dealsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team proposals' }, { status: 500 })
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

    // Create DSE map for names
    const dseMap: Record<string, { name: string; email: string }> = {}
    if (dseUsers) {
      dseUsers.forEach(dse => {
        dseMap[dse.id] = {
          name: dse.full_name || 'Unknown',
          email: dse.email || ''
        }
      })
    }

    // Fetch update counts for each deal
    const dealIds = deals?.map(d => d.id) || []
    let updateCounts: Record<string, number> = {}

    if (dealIds.length > 0) {
      const { data: counts } = await supabase
        .from('deal_updates')
        .select('deal_id')
        .in('deal_id', dealIds)

      if (counts) {
        updateCounts = counts.reduce((acc, item) => {
          acc[item.deal_id] = (acc[item.deal_id] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
    }

    // Fetch last update notes for each deal
    let lastUpdates: Record<string, { notes: string; stage: string }> = {}
    if (dealIds.length > 0) {
      const { data: updates } = await supabase
        .from('deal_updates')
        .select('deal_id, notes_original, stage_at_update, created_at')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })

      if (updates) {
        // Get only the latest update per deal
        const seen = new Set<string>()
        updates.forEach(u => {
          if (!seen.has(u.deal_id)) {
            seen.add(u.deal_id)
            lastUpdates[u.deal_id] = {
              notes: u.notes_original || '',
              stage: u.stage_at_update
            }
          }
        })
      }
    }

    // Transform deals to proposals format
    const proposals = deals?.map(deal => {
      const assignedAt = deal.assigned_at ? new Date(deal.assigned_at) : null
      const lastUpdateAt = deal.last_updated_by_bde_at ? new Date(deal.last_updated_by_bde_at) : null
      const now = new Date()

      // Calculate days since assignment
      const daysSinceAssignment = assignedAt
        ? Math.floor((now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      // Check if overdue (no update in last 3 hours for in_progress deals)
      let isOverdue = false
      if (deal.status === 'in_progress') {
        const lastActivity = lastUpdateAt || assignedAt
        if (lastActivity) {
          const hoursSinceUpdate = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)
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
        source_employee_id: deal.source_employee_id,
        dse_name: dseMap[deal.source_employee_id]?.name || 'Unknown DSE',
        dse_email: dseMap[deal.source_employee_id]?.email || '',
        created_at: deal.created_at,
        sanctioned_at: deal.sanctioned_at,
        disbursed_at: deal.disbursed_at,
        dropped_at: deal.dropped_at,
        drop_reason: deal.drop_reason
      }
    }) || []

    // Filter by overdue if requested
    let filteredProposals = proposals
    if (is_overdue === 'true') {
      filteredProposals = proposals.filter(p => p.is_overdue)
    } else if (is_overdue === 'false') {
      filteredProposals = proposals.filter(p => !p.is_overdue)
    }

    // Calculate summary statistics
    const stats = {
      total: count || 0,
      in_progress: proposals.filter(p => p.current_status === 'in_progress').length,
      sanctioned: proposals.filter(p => p.current_status === 'sanctioned').length,
      disbursed: proposals.filter(p => p.current_status === 'disbursed').length,
      dropped: proposals.filter(p => p.current_status === 'dropped').length,
      overdue: proposals.filter(p => p.is_overdue).length,
      total_loan_amount: proposals.reduce((sum, p) => sum + (p.loan_amount || 0), 0),
      total_sanctioned_amount: proposals.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0),
      total_disbursed_amount: proposals.reduce((sum, p) => sum + (p.disbursed_amount || 0), 0)
    }

    // Calculate per-DSE statistics
    const dseStats = dseUsers?.map(dse => {
      const dseProposals = proposals.filter(p => p.source_employee_id === dse.id)
      return {
        dse_id: dse.id,
        dse_name: dse.full_name,
        dse_email: dse.email,
        total_proposals: dseProposals.length,
        in_progress: dseProposals.filter(p => p.current_status === 'in_progress').length,
        sanctioned: dseProposals.filter(p => p.current_status === 'sanctioned').length,
        disbursed: dseProposals.filter(p => p.current_status === 'disbursed').length,
        dropped: dseProposals.filter(p => p.current_status === 'dropped').length,
        overdue: dseProposals.filter(p => p.is_overdue).length,
        total_loan_amount: dseProposals.reduce((sum, p) => sum + (p.loan_amount || 0), 0),
        total_sanctioned_amount: dseProposals.reduce((sum, p) => sum + (p.sanctioned_amount || 0), 0),
        total_disbursed_amount: dseProposals.reduce((sum, p) => sum + (p.disbursed_amount || 0), 0)
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        proposals: filteredProposals,
        stats,
        dse_stats: dseStats,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
          has_more: offset + limit < (count || 0)
        },
        team_members: dseUsers?.map(dse => ({
          id: dse.id,
          name: dse.full_name,
          email: dse.email,
          avatar_url: dse.avatar_url
        })) || []
      }
    })

  } catch (error) {
    apiLogger.error('Error in DSM team proposals GET', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
