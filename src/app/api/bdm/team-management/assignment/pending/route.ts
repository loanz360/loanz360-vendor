import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/bdm/team-management/assignment/pending
 * Get all unassigned leads pending assignment with match analysis
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Filters
    const loanType = searchParams.get('loanType')
    const leadSource = searchParams.get('leadSource')
    const priority = searchParams.get('priority')

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a BDM
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied. BDM role required.' }, { status: 403 })
    }

    // Build query for pending leads
    let pendingQuery = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .is('assigned_to_bde', null)
      .eq('current_stage', 'NEW')
      .order('created_at', { ascending: true })

    // Apply filters
    if (loanType) {
      pendingQuery = pendingQuery.eq('loan_type', loanType)
    }

    if (leadSource) {
      pendingQuery = pendingQuery.eq('lead_source', leadSource)
    }

    // Apply pagination
    pendingQuery = pendingQuery.range(offset, offset + limit - 1)

    const { data: pendingLeads, error: leadsError, count: totalCount } = await pendingQuery

    if (leadsError) {
      apiLogger.error('Error fetching pending leads', leadsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch pending leads' }, { status: 500 })
    }

    if (!pendingLeads || pendingLeads.length === 0) {
      return NextResponse.json({
        pendingLeads: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        statistics: {
          totalPending: 0,
          byLoanType: {},
          byLeadSource: {},
          byPriority: {},
          oldestLeadAge: 0,
        },
        assignability: {
          fullyAssignable: 0,
          partiallyAssignable: 0,
          notAssignable: 0,
        },
      })
    }

    // For each pending lead, check for matching BDEs
    const enrichedLeads = await Promise.all(
      pendingLeads.map(async (lead: unknown) => {
        // Find matching BDEs
        const { data: matchingBDEs, error: matchError } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            email,
            assigned_loan_type,
            assigned_pincode_ranges,
            bde_assignment_settings!inner(
              is_active_for_assignment,
              assignment_status,
              max_concurrent_leads,
              current_lead_count
            )
          `)
          .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
          .eq('manager_id', user.id)
          .eq('assigned_loan_type', lead.loan_type)
          .eq('bde_assignment_settings.is_active_for_assignment', true)
          .eq('bde_assignment_settings.assignment_status', 'active')

        // Filter by pincode match
        const pincodeMatches = matchingBDEs?.filter((bde: unknown) => {
          const pincodes = bde.assigned_pincode_ranges || []
          return pincodes.includes(lead.pincode)
        }) || []

        // Filter by capacity
        const availableBDEs = pincodeMatches.filter((bde: unknown) => {
          const settings = bde.bde_assignment_settings
          return settings.current_lead_count < settings.max_concurrent_leads
        })

        // Calculate lead age
        const createdDate = new Date(lead.created_at)
        const now = new Date()
        const ageInDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
        const ageInHours = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60))

        // Determine assignability status
        let assignabilityStatus: 'assignable' | 'partially_assignable' | 'not_assignable'
        let assignabilityReason: string

        if (availableBDEs.length > 0) {
          assignabilityStatus = 'assignable'
          assignabilityReason = `${availableBDEs.length} BDE(s) available`
        } else if (pincodeMatches.length > 0) {
          assignabilityStatus = 'partially_assignable'
          assignabilityReason = 'BDEs match but at capacity'
        } else if (matchingBDEs && matchingBDEs.length > 0) {
          assignabilityStatus = 'not_assignable'
          assignabilityReason = 'No BDEs cover this pincode'
        } else {
          assignabilityStatus = 'not_assignable'
          assignabilityReason = 'No BDEs for this loan type'
        }

        // Determine priority
        let leadPriority: 'urgent' | 'high' | 'medium' | 'low' = 'medium'
        if (ageInDays > 3) {
          leadPriority = 'urgent'
        } else if (ageInDays > 1) {
          leadPriority = 'high'
        } else if (ageInHours > 6) {
          leadPriority = 'medium'
        } else {
          leadPriority = 'low'
        }

        return {
          ...lead,
          leadAge: {
            days: ageInDays,
            hours: ageInHours,
            formatted: formatAge(ageInDays, ageInHours),
          },
          priority: leadPriority,
          assignability: {
            status: assignabilityStatus,
            reason: assignabilityReason,
            matchingBDEs: availableBDEs.length,
            totalMatches: pincodeMatches.length,
          },
          suggestedBDEs: availableBDEs.slice(0, 3).map((bde: unknown) => ({
            id: bde.id,
            name: bde.full_name,
            email: bde.email,
            currentWorkload: bde.bde_assignment_settings.current_lead_count,
            maxCapacity: bde.bde_assignment_settings.max_concurrent_leads,
            utilizationPercentage: Math.round(
              (bde.bde_assignment_settings.current_lead_count / bde.bde_assignment_settings.max_concurrent_leads) * 100
            ),
          })),
        }
      })
    )

    // Calculate statistics
    const statistics = calculateStatistics(enrichedLeads)

    // Calculate assignability summary
    const assignability = {
      fullyAssignable: enrichedLeads.filter(l => l.assignability.status === 'assignable').length,
      partiallyAssignable: enrichedLeads.filter(l => l.assignability.status === 'partially_assignable').length,
      notAssignable: enrichedLeads.filter(l => l.assignability.status === 'not_assignable').length,
    }

    return NextResponse.json({
      pendingLeads: enrichedLeads,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
      statistics,
      assignability,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in pending queue API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Calculate statistics for pending leads
function calculateStatistics(leads: unknown[]): unknown {
  const byLoanType: Record<string, number> = {}
  const byLeadSource: Record<string, number> = {}
  const byPriority: Record<string, number> = {}

  let oldestAge = 0

  leads.forEach(lead => {
    // By loan type
    byLoanType[lead.loan_type] = (byLoanType[lead.loan_type] || 0) + 1

    // By lead source
    byLeadSource[lead.lead_source] = (byLeadSource[lead.lead_source] || 0) + 1

    // By priority
    byPriority[lead.priority] = (byPriority[lead.priority] || 0) + 1

    // Oldest age
    if (lead.leadAge.days > oldestAge) {
      oldestAge = lead.leadAge.days
    }
  })

  return {
    totalPending: leads.length,
    byLoanType,
    byLeadSource,
    byPriority,
    oldestLeadAge: oldestAge,
  }
}

// Format age display
function formatAge(days: number, hours: number): string {
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    return 'Just now'
  }
}
