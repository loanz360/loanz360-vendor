import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bdm/team-management/team-list
 * Fetch all BDEs reporting to the logged-in BDM with their workload and performance summary
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
    const search = searchParams.get('search') // Search by name/email
    const loanType = searchParams.get('loanType') // Filter by loan type
    const location = searchParams.get('location') // Filter by location
    const status = searchParams.get('status') // Filter by assignment status

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Business Development Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied. BDM role required.' }, { status: 403 })
    }

    // Build query for team members
    let teamQuery = supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        phone_number,
        employee_id,
        avatar_url,
        assigned_loan_type,
        assigned_pincode_ranges,
        location,
        department,
        designation,
        created_at
      `, { count: 'exact' })
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('manager_id', user.id)

    // Apply filters
    if (search) {
      teamQuery = teamQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`)
    }

    if (loanType) {
      teamQuery = teamQuery.eq('assigned_loan_type', loanType)
    }

    if (location) {
      teamQuery = teamQuery.eq('location', location)
    }

    // Apply pagination
    teamQuery = teamQuery.range(offset, offset + limit - 1).order('full_name', { ascending: true })

    const { data: teamMembers, error: teamError, count: totalCount } = await teamQuery

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        teamMembers: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      })
    }

    const teamMemberIds = teamMembers.map((m) => m.id)

    // Get assignment settings for team members
    const { data: assignmentSettings, error: settingsError } = await supabase
      .from('bde_assignment_settings')
      .select('*')
      .in('user_id', teamMemberIds)

    if (settingsError) {
      apiLogger.error('Error fetching assignment settings', settingsError)
    }

    // Get performance data (leads count, conversion rate, etc.)
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('assigned_to_bde, assignment_status, current_stage, disbursed_amount, created_at')
      .in('assigned_to_bde', teamMemberIds)

    if (leadsError) {
      apiLogger.error('Error fetching leads', leadsError)
    }

    // Get leave status (check if BDE is on leave today)
    const today = new Date().toISOString().split('T')[0]
    const { data: leaveRequests, error: leaveError } = await supabase
      .from('leave_requests')
      .select('user_id, status, start_date, end_date')
      .in('user_id', teamMemberIds)
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today)

    if (leaveError) {
      apiLogger.error('Error fetching leave requests', leaveError)
    }

    // Map settings and performance data to team members
    const teamMembersWithDetails = teamMembers.map((member) => {
      const settings = assignmentSettings?.find((s) => s.user_id === member.id) || {
        is_active_for_assignment: true,
        assignment_status: 'active',
        current_lead_count: 0,
        max_concurrent_leads: 25,
        last_assigned_at: null,
      }

      const memberLeads = leads?.filter((l) => l.assigned_to_bde === member.id) || []
      const convertedLeads = memberLeads.filter((l) => l.current_stage !== 'lead').length
      const disbursedLeads = memberLeads.filter((l) => l.assignment_status === 'disbursed')
      const disbursedValue = disbursedLeads.reduce((sum, l) => sum + (Number(l.disbursed_amount) || 0), 0)

      const isOnLeave = leaveRequests?.some((lr) => lr.user_id === member.id) || false

      // Determine real-time status
      let realTimeStatus = 'active'
      if (isOnLeave) {
        realTimeStatus = 'on_leave'
      } else if (settings.is_on_notice_period) {
        realTimeStatus = 'notice_period'
      } else if (!settings.is_active_for_assignment) {
        realTimeStatus = 'paused'
      } else if (settings.assignment_status !== 'active') {
        realTimeStatus = settings.assignment_status
      }

      // Calculate utilization
      const utilization = settings.max_concurrent_leads > 0
        ? (settings.current_lead_count / settings.max_concurrent_leads) * 100
        : 0

      return {
        id: member.id,
        fullName: member.full_name,
        email: member.email,
        phoneNumber: member.phone_number,
        employeeId: member.employee_id,
        avatarUrl: member.avatar_url,
        assignedLoanType: member.assigned_loan_type,
        assignedPincodeRanges: member.assigned_pincode_ranges,
        location: member.location,
        department: member.department,
        designation: member.designation,
        joinedDate: member.created_at,

        // Assignment Settings
        isActiveForAssignment: settings.is_active_for_assignment,
        assignmentStatus: settings.assignment_status,
        currentLeadCount: settings.current_lead_count,
        maxConcurrentLeads: settings.max_concurrent_leads,
        utilizationPercentage: Math.round(utilization * 100) / 100,
        lastAssignedAt: settings.last_assigned_at,

        // Performance Metrics
        totalLeadsAssigned: memberLeads.length,
        leadsConverted: convertedLeads,
        conversionRate: memberLeads.length > 0 ? (convertedLeads / memberLeads.length) * 100 : 0,
        disbursedCount: disbursedLeads.length,
        disbursedValue,

        // Real-time Status
        realTimeStatus,
        isOnLeave,

        // Workload Status
        workloadStatus: utilization === 0 ? 'idle'
          : utilization <= 70 ? 'optimal'
          : utilization <= 90 ? 'near_capacity'
          : utilization <= 100 ? 'at_capacity'
          : 'overloaded',
      }
    })

    // Apply status filter if provided
    let filteredMembers = teamMembersWithDetails
    if (status) {
      filteredMembers = teamMembersWithDetails.filter((m) => m.assignmentStatus === status)
    }

    return NextResponse.json({
      teamMembers: filteredMembers,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
      summary: {
        totalTeamMembers: teamMembers.length,
        activeForAssignment: filteredMembers.filter((m) => m.isActiveForAssignment).length,
        pausedMembers: filteredMembers.filter((m) => m.assignmentStatus === 'paused').length,
        onLeave: filteredMembers.filter((m) => m.isOnLeave).length,
        onNoticePeriod: filteredMembers.filter((m) => m.realTimeStatus === 'notice_period').length,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in team-list API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
