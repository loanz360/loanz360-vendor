import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/bdm/team-management/assignment/workload
 * Get workload distribution across all BDEs in the team
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

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

    // Get all team members with their workload
    const { data: teamMembers, error: teamError } = await supabase
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
          current_lead_count,
          assignment_priority,
          assignment_weight,
          last_assigned_at,
          total_leads_assigned_lifetime,
          auto_pause_on_overload,
          overload_threshold
        )
      `)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        teamWorkload: [],
        summary: {
          totalBDEs: 0,
          activeBDEs: 0,
          pausedBDEs: 0,
          totalCapacity: 0,
          totalUtilized: 0,
          utilizationRate: 0,
          averageWorkload: 0,
        },
        recommendations: [],
      })
    }

    // For each BDE, get their lead distribution by stage
    const teamWorkload = await Promise.all(
      teamMembers.map(async (bde: any) => {
        const settings = bde.bde_assignment_settings

        // Get lead distribution by stage
        const { data: leadsByStage } = await supabase
          .from('leads')
          .select('current_stage')
          .eq('assigned_to_bde', bde.id)
          .not('current_stage', 'in', '(CLOSED,CANCELLED,REJECTED,DISBURSED)')

        const stageDistribution: Record<string, number> = {}
        leadsByStage?.forEach((lead: any) => {
          const stage = lead.current_stage || 'UNKNOWN'
          stageDistribution[stage] = (stageDistribution[stage] || 0) + 1
        })

        // Calculate workload percentage
        const workloadPercentage = settings.max_concurrent_leads > 0
          ? Math.round((settings.current_lead_count / settings.max_concurrent_leads) * 100)
          : 0

        // Determine capacity status
        let capacityStatus: 'available' | 'moderate' | 'near_capacity' | 'at_capacity' | 'overloaded' = 'available'
        if (workloadPercentage >= 100) {
          capacityStatus = 'at_capacity'
        } else if (workloadPercentage >= 90) {
          capacityStatus = 'near_capacity'
        } else if (workloadPercentage >= 70) {
          capacityStatus = 'moderate'
        } else {
          capacityStatus = 'available'
        }

        // Check if overloaded
        if (settings.auto_pause_on_overload && settings.current_lead_count >= settings.overload_threshold) {
          capacityStatus = 'overloaded'
        }

        return {
          bdeId: bde.id,
          bdeName: bde.full_name,
          bdeEmail: bde.email,
          loanType: bde.assigned_loan_type,
          territorySize: bde.assigned_pincode_ranges?.length || 0,
          assignmentStatus: settings.assignment_status,
          isActive: settings.is_active_for_assignment,
          workload: {
            current: settings.current_lead_count,
            max: settings.max_concurrent_leads,
            available: Math.max(0, settings.max_concurrent_leads - settings.current_lead_count),
            percentage: workloadPercentage,
            status: capacityStatus,
          },
          stageDistribution,
          performance: {
            lifetimeAssigned: settings.total_leads_assigned_lifetime || 0,
            lastAssignedAt: settings.last_assigned_at,
            priority: settings.assignment_priority,
            weight: settings.assignment_weight,
          },
          alerts: generateBDEAlerts(settings, workloadPercentage),
        }
      })
    )

    // Calculate summary statistics
    const totalBDEs = teamWorkload.length
    const activeBDEs = teamWorkload.filter(bde => bde.isActive).length
    const pausedBDEs = teamWorkload.filter(bde => bde.assignmentStatus === 'paused').length
    const totalCapacity = teamWorkload.reduce((sum, bde) => sum + bde.workload.max, 0)
    const totalUtilized = teamWorkload.reduce((sum, bde) => sum + bde.workload.current, 0)
    const utilizationRate = totalCapacity > 0 ? Math.round((totalUtilized / totalCapacity) * 100) : 0
    const averageWorkload = totalBDEs > 0 ? Math.round(totalUtilized / totalBDEs) : 0

    // Generate recommendations
    const recommendations = generateRecommendations(teamWorkload)

    // Sort by workload percentage (most loaded first)
    teamWorkload.sort((a, b) => b.workload.percentage - a.workload.percentage)

    return NextResponse.json({
      teamWorkload,
      summary: {
        totalBDEs,
        activeBDEs,
        pausedBDEs,
        totalCapacity,
        totalUtilized,
        availableCapacity: totalCapacity - totalUtilized,
        utilizationRate,
        averageWorkload,
      },
      recommendations,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in workload API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Generate alerts for individual BDE
function generateBDEAlerts(settings: any, workloadPercentage: number): string[] {
  const alerts: string[] = []

  if (settings.assignment_status === 'paused') {
    alerts.push(`⏸️ Paused: ${settings.pause_reason || 'No reason provided'}`)
  }

  if (settings.assignment_status === 'on_leave') {
    alerts.push('🏖️ Currently on leave')
  }

  if (settings.assignment_status === 'notice_period') {
    alerts.push('👋 On notice period - not receiving new leads')
  }

  if (workloadPercentage >= 100) {
    alerts.push('🔴 At maximum capacity')
  } else if (workloadPercentage >= 90) {
    alerts.push('🟡 Near capacity (90%+)')
  }

  if (settings.auto_pause_on_overload && settings.current_lead_count >= settings.overload_threshold) {
    alerts.push(`⚠️ Overloaded (${settings.current_lead_count}/${settings.overload_threshold})`)
  }

  if (!settings.last_assigned_at) {
    alerts.push('🆕 Never received a lead')
  } else {
    const daysSinceLastAssignment = Math.floor(
      (new Date().getTime() - new Date(settings.last_assigned_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceLastAssignment > 7 && settings.is_active_for_assignment) {
      alerts.push(`⏰ No leads assigned in ${daysSinceLastAssignment} days`)
    }
  }

  return alerts
}

// Generate team-level recommendations
function generateRecommendations(teamWorkload: any[]): any[] {
  const recommendations: any[] = []

  // Check for workload imbalance
  const workloads = teamWorkload.map(bde => bde.workload.percentage)
  const maxWorkload = Math.max(...workloads)
  const minWorkload = Math.min(...workloads.filter(w => w > 0))

  if (maxWorkload - minWorkload > 30) {
    const overloaded = teamWorkload.filter(bde => bde.workload.percentage > 80)
    const underutilized = teamWorkload.filter(bde => bde.workload.percentage < 50 && bde.isActive)

    if (overloaded.length > 0 && underutilized.length > 0) {
      recommendations.push({
        type: 'rebalance',
        severity: 'high',
        title: 'Workload Imbalance Detected',
        description: `${overloaded.length} BDE(s) are overloaded while ${underutilized.length} have capacity`,
        action: 'Consider reassigning leads to balance workload',
        affectedBDEs: {
          overloaded: overloaded.map(bde => bde.bdeName),
          underutilized: underutilized.map(bde => bde.bdeName),
        },
      })
    }
  }

  // Check for paused BDEs with capacity
  const pausedWithCapacity = teamWorkload.filter(
    bde => bde.assignmentStatus === 'paused' && bde.workload.current < bde.workload.max * 0.7
  )

  if (pausedWithCapacity.length > 0) {
    recommendations.push({
      type: 'resume',
      severity: 'medium',
      title: 'Paused BDEs with Available Capacity',
      description: `${pausedWithCapacity.length} paused BDE(s) have less than 70% workload`,
      action: 'Consider resuming them to handle new leads',
      affectedBDEs: pausedWithCapacity.map(bde => bde.bdeName),
    })
  }

  // Check overall capacity
  const totalCapacity = teamWorkload.reduce((sum, bde) => sum + bde.workload.max, 0)
  const totalUtilized = teamWorkload.reduce((sum, bde) => sum + bde.workload.current, 0)
  const utilizationRate = totalCapacity > 0 ? (totalUtilized / totalCapacity) * 100 : 0

  if (utilizationRate > 85) {
    recommendations.push({
      type: 'capacity',
      severity: 'high',
      title: 'Team Nearing Capacity',
      description: `Overall team utilization is at ${Math.round(utilizationRate)}%`,
      action: 'Consider increasing max concurrent leads or adding team members',
    })
  }

  // Check for inactive BDEs
  const activeBDEs = teamWorkload.filter(bde => bde.isActive)
  const inactiveBDEs = teamWorkload.filter(bde => !bde.isActive)

  if (inactiveBDEs.length > activeBDEs.length * 0.3) {
    recommendations.push({
      type: 'inactive',
      severity: 'medium',
      title: 'High Percentage of Inactive BDEs',
      description: `${inactiveBDEs.length} out of ${teamWorkload.length} BDEs are inactive`,
      action: 'Review inactive BDEs and resume if appropriate',
    })
  }

  return recommendations
}
