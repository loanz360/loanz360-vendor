import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

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

// Helper function to get DSM's team members with details
async function getTeamMembers(supabase: any, dsmUserId: string) {
  const { data: teamMembers, error } = await supabase
    .from('users')
    .select('id, full_name, email, employee_id')
    .eq('role', 'EMPLOYEE')
    .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
    .eq('manager_user_id', dsmUserId)

  if (error) {
    throw new Error('Failed to fetch team members')
  }

  return teamMembers || []
}

// GET - Get team analytics with DSE-wise breakdown
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const dseUserId = searchParams.get('dse_user_id') // Optional: filter by specific DSE

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate = now

    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'week':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case 'quarter':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 3)
        break
      case 'year':
        startDate = new Date(now)
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      default:
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
    }

    if (dateFrom) startDate = new Date(dateFrom)
    if (dateTo) endDate = new Date(dateTo)

    const startDateStr = startDate.toISOString()
    const endDateStr = endDate.toISOString()

    // Get team members
    const teamMembers = await getTeamMembers(supabase, user.id)

    if (teamMembers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          teamSummary: {
            totalMembers: 0,
            totalCustomers: 0,
            newCustomers: 0,
            totalLeads: 0,
            convertedLeads: 0,
            conversionRate: 0,
            totalPipelineValue: 0,
            wonValue: 0,
          },
          dseMetrics: [],
          trends: {},
          period: {
            start: startDateStr,
            end: endDateStr,
            type: period
          }
        }
      })
    }

    const teamMemberIds = teamMembers.map(m => m.id)
    const filterIds = dseUserId ? [dseUserId] : teamMemberIds

    // Get team-wide metrics
    const [
      { count: totalCustomers },
      { count: newCustomers },
      { count: totalLeads },
      { count: convertedLeads },
      { data: allLeads },
      { data: customersByStatus },
      { data: leadsBySource },
    ] = await Promise.all([
      // Total customers
      supabase
        .from('dse_customers')
        .select('*', { count: 'exact', head: true })
        .in('dse_user_id', filterIds)
        .eq('is_deleted', false),

      // New customers in period
      supabase
        .from('dse_customers')
        .select('*', { count: 'exact', head: true })
        .in('dse_user_id', filterIds)
        .eq('is_deleted', false)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr),

      // Total leads
      supabase
        .from('dse_leads')
        .select('*', { count: 'exact', head: true })
        .in('dse_user_id', filterIds)
        .eq('is_deleted', false),

      // Converted leads (Won)
      supabase
        .from('dse_leads')
        .select('*', { count: 'exact', head: true })
        .in('dse_user_id', filterIds)
        .eq('is_deleted', false)
        .eq('lead_stage', 'Won')
        .gte('converted_at', startDateStr)
        .lte('converted_at', endDateStr),

      // All leads with values
      supabase
        .from('dse_leads')
        .select('dse_user_id, lead_stage, estimated_value, probability_percentage')
        .in('dse_user_id', filterIds)
        .eq('is_deleted', false),

      // Customers by status
      supabase
        .from('dse_customers')
        .select('customer_status, dse_user_id')
        .in('dse_user_id', filterIds)
        .eq('is_deleted', false),

      // Leads by source
      supabase
        .from('dse_customers')
        .select('source, dse_user_id')
        .in('dse_user_id', filterIds)
        .eq('is_deleted', false),
    ])

    // Calculate pipeline values
    const totalPipelineValue = (allLeads || [])
      .filter((l: any) => !['Won', 'Lost'].includes(l.lead_stage))
      .reduce((sum: number, l: any) => sum + (l.estimated_value || 0), 0)

    const wonValue = (allLeads || [])
      .filter((l: any) => l.lead_stage === 'Won')
      .reduce((sum: number, l: any) => sum + (l.estimated_value || 0), 0)

    const conversionRate = totalLeads && totalLeads > 0
      ? parseFloat(((convertedLeads || 0) / totalLeads * 100).toFixed(1))
      : 0

    // Calculate DSE-wise metrics
    const dseMetrics = await Promise.all(
      teamMembers.map(async (dse) => {
        const [
          { count: dseCustomers },
          { count: dseNewCustomers },
          { count: dseLeads },
          { count: dseConvertedLeads },
          { data: dseLeadData },
        ] = await Promise.all([
          // Total customers for this DSE
          supabase
            .from('dse_customers')
            .select('*', { count: 'exact', head: true })
            .eq('dse_user_id', dse.id)
            .eq('is_deleted', false),

          // New customers for this DSE
          supabase
            .from('dse_customers')
            .select('*', { count: 'exact', head: true })
            .eq('dse_user_id', dse.id)
            .eq('is_deleted', false)
            .gte('created_at', startDateStr)
            .lte('created_at', endDateStr),

          // Total leads for this DSE
          supabase
            .from('dse_leads')
            .select('*', { count: 'exact', head: true })
            .eq('dse_user_id', dse.id)
            .eq('is_deleted', false),

          // Converted leads for this DSE
          supabase
            .from('dse_leads')
            .select('*', { count: 'exact', head: true })
            .eq('dse_user_id', dse.id)
            .eq('is_deleted', false)
            .eq('lead_stage', 'Won')
            .gte('converted_at', startDateStr)
            .lte('converted_at', endDateStr),

          // Lead pipeline data for this DSE
          supabase
            .from('dse_leads')
            .select('lead_stage, estimated_value')
            .eq('dse_user_id', dse.id)
            .eq('is_deleted', false),
        ])

        const dsePipelineValue = (dseLeadData || [])
          .filter((l: any) => !['Won', 'Lost'].includes(l.lead_stage))
          .reduce((sum: number, l: any) => sum + (l.estimated_value || 0), 0)

        const dseWonValue = (dseLeadData || [])
          .filter((l: any) => l.lead_stage === 'Won')
          .reduce((sum: number, l: any) => sum + (l.estimated_value || 0), 0)

        const dseConversionRate = dseLeads && dseLeads > 0
          ? parseFloat(((dseConvertedLeads || 0) / dseLeads * 100).toFixed(1))
          : 0

        return {
          dse_user_id: dse.id,
          dse_name: dse.full_name,
          dse_email: dse.email,
          dse_employee_id: dse.employee_id,
          metrics: {
            totalCustomers: dseCustomers || 0,
            newCustomers: dseNewCustomers || 0,
            totalLeads: dseLeads || 0,
            convertedLeads: dseConvertedLeads || 0,
            conversionRate: dseConversionRate,
            pipelineValue: dsePipelineValue,
            wonValue: dseWonValue,
          }
        }
      })
    )

    // Sort DSE metrics by pipeline value (descending)
    dseMetrics.sort((a, b) => b.metrics.pipelineValue - a.metrics.pipelineValue)

    // Process customer status distribution
    const statusDistribution: Record<string, number> = {}
    ;(customersByStatus || []).forEach((c: any) => {
      statusDistribution[c.customer_status] = (statusDistribution[c.customer_status] || 0) + 1
    })

    // Process source distribution
    const sourceDistribution: Record<string, number> = {}
    ;(leadsBySource || []).forEach((c: any) => {
      sourceDistribution[c.source] = (sourceDistribution[c.source] || 0) + 1
    })

    // Lead stage distribution
    const stageDistribution: Record<string, { count: number; value: number }> = {}
    const stages = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'On Hold', 'Nurturing']
    stages.forEach(stage => {
      stageDistribution[stage] = { count: 0, value: 0 }
    })
    ;(allLeads || []).forEach((l: any) => {
      if (stageDistribution[l.lead_stage]) {
        stageDistribution[l.lead_stage].count++
        stageDistribution[l.lead_stage].value += l.estimated_value || 0
      }
    })

    const pipelineData = stages.map(stage => ({
      stage,
      count: stageDistribution[stage].count,
      value: stageDistribution[stage].value
    }))

    return NextResponse.json({
      success: true,
      data: {
        teamSummary: {
          totalMembers: teamMembers.length,
          totalCustomers: totalCustomers || 0,
          newCustomers: newCustomers || 0,
          totalLeads: totalLeads || 0,
          convertedLeads: convertedLeads || 0,
          conversionRate,
          totalPipelineValue,
          wonValue,
        },
        dseMetrics,
        distributions: {
          byStatus: Object.entries(statusDistribution).map(([status, count]) => ({ status, count })),
          bySource: Object.entries(sourceDistribution).map(([source, count]) => ({ source, count })),
          byStage: pipelineData,
        },
        period: {
          start: startDateStr,
          end: endDateStr,
          type: period
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching team analytics', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
