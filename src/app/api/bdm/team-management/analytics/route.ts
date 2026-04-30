import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/bdm/team-management/analytics
 * Fetch real-time team performance KPIs for BDM dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Get date range from query params
    const dateFrom = searchParams.get('dateFrom') || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
    const dateTo = searchParams.get('dateTo') || new Date().toISOString().split('T')[0]
    const loanType = searchParams.get('loanType') // Optional filter
    const bdeId = searchParams.get('bdeId') // Optional filter

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

    // Get team members (BDEs reporting to this BDM)
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name, email, employee_id, assigned_loan_type')
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        teamSize: 0,
        kpis: {
          totalLeadsAssigned: 0,
          totalLeadsConverted: 0,
          conversionRate: 0,
          totalLoanValue: 0,
          totalDisbursedValue: 0,
          avgTAT: 0,
          targetAchievement: 0,
        },
        bdePerformance: [],
        trends: [],
        loanTypeDistribution: [],
        conversionFunnel: {},
      })
    }

    const teamMemberIds = teamMembers.map((m) => m.id)

    // Build query for leads with filters
    let leadsQuery = supabase
      .from('leads')
      .select('*')
      .in('assigned_to_bde', teamMemberIds)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)

    if (loanType) {
      leadsQuery = leadsQuery.eq('loan_type', loanType)
    }

    if (bdeId) {
      leadsQuery = leadsQuery.eq('assigned_to_bde', bdeId)
    }

    const { data: leads, error: leadsError } = await leadsQuery

    if (leadsError) {
      apiLogger.error('Error fetching leads', leadsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch leads data' }, { status: 500 })
    }

    // Calculate KPIs
    const totalLeadsAssigned = leads?.length || 0
    const totalLeadsConverted = leads?.filter((l) => l.current_stage === 'converted' || l.assignment_status !== 'pending').length || 0
    const conversionRate = totalLeadsAssigned > 0 ? (totalLeadsConverted / totalLeadsAssigned) * 100 : 0

    const totalLoanValue = leads?.reduce((sum, l) => sum + (Number(l.loan_amount) || 0), 0) || 0
    const totalDisbursedValue = leads?.filter((l) => l.assignment_status === 'disbursed').reduce((sum, l) => sum + (Number(l.disbursed_amount) || 0), 0) || 0

    const disbursedLeads = leads?.filter((l) => l.assigned_at && l.disbursed_at) || []
    const avgTAT = disbursedLeads.length > 0
      ? disbursedLeads.reduce((sum, l) => {
          const assignedDate = new Date(l.assigned_at)
          const disbursedDate = new Date(l.disbursed_at)
          const days = Math.floor((disbursedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }, 0) / disbursedLeads.length
      : 0

    // Calculate target achievement from team_targets table
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const { data: targets } = await supabase
      .from('team_targets')
      .select('monthly_lead_target, monthly_revenue_target')
      .eq('bdm_user_id', user.id)
      .eq('target_month', currentMonth)
      .maybeSingle()

    const targetAchievement = targets && targets.monthly_revenue_target > 0
      ? Math.round((totalDisbursedValue / targets.monthly_revenue_target) * 100 * 100) / 100
      : 0

    // BDE Performance Comparison
    const bdePerformance = teamMembers.map((bde) => {
      const bdeLeads = leads?.filter((l) => l.assigned_to_bde === bde.id) || []
      const bdeConverted = bdeLeads.filter((l) => l.current_stage !== 'lead').length
      const bdeDisbursed = bdeLeads.filter((l) => l.assignment_status === 'disbursed').length
      const bdeValue = bdeLeads.reduce((sum, l) => sum + (Number(l.loan_amount) || 0), 0)

      return {
        bdeId: bde.id,
        bdeName: bde.full_name,
        employeeId: bde.employee_id,
        leadsAssigned: bdeLeads.length,
        leadsConverted: bdeConverted,
        conversionRate: bdeLeads.length > 0 ? (bdeConverted / bdeLeads.length) * 100 : 0,
        disbursedCount: bdeDisbursed,
        loanValue: bdeValue,
        rank: 0, // Will be calculated after sorting
      }
    })

    // Sort by conversion rate and assign ranks
    bdePerformance.sort((a, b) => b.conversionRate - a.conversionRate)
    bdePerformance.forEach((bde, index) => {
      bde.rank = index + 1
    })

    // Performance Trends (last 7 days)
    const trends = generateTrends(leads || [], 7)

    // Loan Type Distribution
    const loanTypeDistribution = calculateLoanTypeDistribution(leads || [])

    // Conversion Funnel
    const conversionFunnel = {
      leads: leads?.filter((l) => l.current_stage === 'lead').length || 0,
      converted: leads?.filter((l) => l.current_stage === 'converted').length || 0,
      inProgress: leads?.filter((l) => l.assignment_status === 'in_progress' || l.assignment_status === 'documentation').length || 0,
      submitted: leads?.filter((l) => l.assignment_status === 'submitted_to_bank').length || 0,
      sanctioned: leads?.filter((l) => l.assignment_status === 'sanctioned').length || 0,
      disbursed: leads?.filter((l) => l.assignment_status === 'disbursed').length || 0,
    }

    return NextResponse.json({
      teamSize: teamMembers.length,
      dateRange: { from: dateFrom, to: dateTo },
      kpis: {
        totalLeadsAssigned,
        totalLeadsConverted,
        conversionRate: Math.round(conversionRate * 100) / 100,
        totalLoanValue,
        totalDisbursedValue,
        avgTAT: Math.round(avgTAT * 100) / 100,
        targetAchievement,
      },
      bdePerformance,
      trends,
      loanTypeDistribution,
      conversionFunnel,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in analytics API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate trends
function generateTrends(leads: any[], days: number) {
  const trends = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const dayLeads = leads.filter((l) => l.created_at?.split('T')[0] === dateStr)
    const dayConverted = dayLeads.filter((l) => l.current_stage !== 'lead')

    trends.push({
      date: dateStr,
      leadsAssigned: dayLeads.length,
      leadsConverted: dayConverted.length,
    })
  }

  return trends
}

// Helper function to calculate loan type distribution
function calculateLoanTypeDistribution(leads: any[]) {
  const distribution: Record<string, number> = {}

  leads.forEach((lead) => {
    const loanType = lead.loan_type || 'unknown'
    distribution[loanType] = (distribution[loanType] || 0) + 1
  })

  return Object.entries(distribution).map(([loanType, count]) => ({
    loanType,
    count,
    percentage: leads.length > 0 ? (count / leads.length) * 100 : 0,
  }))
}

