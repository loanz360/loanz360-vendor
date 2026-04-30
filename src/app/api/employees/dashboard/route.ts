
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface DashboardStats {
  completedToday: number
  pendingTasks: number
  monthlyTarget: number
  currentProgress: number
  teamRanking: number
  totalAssigned: number
}

interface Task {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  due_date?: string
}

/**
 * GET /api/employees/dashboard
 *
 * Get dashboard stats for the logged-in employee
 * Returns role-specific metrics based on user's sub_role
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get employee profile
    const { data: employeeProfile, error: profileError } = await supabase
      .from('employee_profile')
      .select('id, subrole, department, employee_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !employeeProfile) {
      return NextResponse.json(
        { success: false, error: 'Employee profile not found' },
        { status: 404 }
      )
    }

    const subRole = employeeProfile.subrole
    const employeeId = employeeProfile.id

    // Get today's date range
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()

    // Get start of month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

    // Initialize stats
    let stats: DashboardStats = {
      completedToday: 0,
      pendingTasks: 0,
      monthlyTarget: 0,
      currentProgress: 0,
      teamRanking: 0,
      totalAssigned: 0,
    }

    let tasks: Task[] = []

    // Fetch role-specific metrics
    if (subRole === 'CHANNEL_PARTNER_EXECUTIVE') {
      // Get partner counts for CPE
      const { data: partnerStats, error: partnerError } = await supabase
        .from('partner_profile')
        .select('id, status, created_at', { count: 'exact' })
        .eq('recruited_by_cpe', user.id)

      if (!partnerError && partnerStats) {
        const activePartners = partnerStats.filter(p => p.status === 'active').length
        const thisMonthPartners = partnerStats.filter(p =>
          new Date(p.created_at) >= new Date(startOfMonth)
        ).length

        stats.totalAssigned = partnerStats.length
        stats.completedToday = thisMonthPartners
        stats.currentProgress = activePartners
      }

      // Get pending recruitment tracking
      const { data: pendingRecruits, error: recruitError } = await supabase
        .from('partner_recruitment_tracking')
        .select('id', { count: 'exact' })
        .eq('cpe_user_id', user.id)
        .eq('status', 'link_sent')

      if (!recruitError && pendingRecruits) {
        stats.pendingTasks = pendingRecruits.length
      }

      // Get targets
      const { data: targetData } = await supabase
        .from('employee_targets')
        .select('target_value, achieved_value')
        .eq('employee_id', employeeId)
        .eq('target_type', 'partner_recruitment')
        .gte('start_date', startOfMonth)
        .maybeSingle()

      if (targetData) {
        stats.monthlyTarget = targetData.target_value || 100
        stats.currentProgress = targetData.achieved_value || stats.currentProgress
      } else {
        stats.monthlyTarget = 100 // Default target
      }

    } else if (subRole === 'CRO' || subRole === 'BUSINESS_DEVELOPMENT_EXECUTIVE') {
      // Get leads/applications for sales roles
      const { data: leadsData, error: leadsError } = await supabase
        .from('loan_applications')
        .select('id, status, created_at', { count: 'exact' })
        .eq('assigned_to', user.id)

      if (!leadsError && leadsData) {
        const completedToday = leadsData.filter(l =>
          l.status === 'approved' &&
          new Date(l.created_at) >= new Date(startOfDay)
        ).length

        const pending = leadsData.filter(l =>
          ['pending', 'in_progress', 'document_verification'].includes(l.status)
        ).length

        stats.totalAssigned = leadsData.length
        stats.completedToday = completedToday
        stats.pendingTasks = pending
        stats.currentProgress = leadsData.filter(l => l.status === 'approved').length
      }

      stats.monthlyTarget = 150 // Default for sales roles

    } else if (subRole === 'FINANCE_EXECUTIVE' || subRole === 'FINANCE_MANAGER') {
      // Finance role — payout processing stats
      const [
        pendingProcessing, inProcessing, processedToday, processedMonth,
      ] = await Promise.all([
        supabase.rpc('get_finance_payout_count', { p_status: 'SA_APPROVED' }).maybeSingle(),
        supabase.rpc('get_finance_payout_count', { p_status: 'FINANCE_PROCESSING' }).maybeSingle(),
        // Fallback: count using direct queries if RPC doesn't exist
        supabase.from('cp_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PAYOUT_CREDITED')
          .gte('finance_processed_at', startOfDay),
        supabase.from('cp_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PAYOUT_CREDITED')
          .gte('finance_processed_at', startOfMonth),
      ])

      // Direct count queries for reliability (RPC may not exist yet)
      const [cpPending, partnerPending, cpInProcess, partnerInProcess, partnerProcessedToday, partnerProcessedMonth] = await Promise.all([
        supabase.from('cp_applications').select('id', { count: 'exact', head: true }).eq('status', 'SA_APPROVED'),
        supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('status', 'SA_APPROVED'),
        supabase.from('cp_applications').select('id', { count: 'exact', head: true }).eq('status', 'FINANCE_PROCESSING'),
        supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('status', 'FINANCE_PROCESSING'),
        supabase.from('partner_payout_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PAYOUT_CREDITED')
          .gte('finance_processed_at', startOfDay),
        supabase.from('partner_payout_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PAYOUT_CREDITED')
          .gte('finance_processed_at', startOfMonth),
      ])

      const totalPending = (cpPending.count || 0) + (partnerPending.count || 0)
      const totalInProcess = (cpInProcess.count || 0) + (partnerInProcess.count || 0)
      const totalProcessedToday = (processedToday.count || 0) + (partnerProcessedToday.count || 0)
      const totalProcessedMonth = (processedMonth.count || 0) + (partnerProcessedMonth.count || 0)

      stats.pendingTasks = totalPending
      stats.totalAssigned = totalPending + totalInProcess
      stats.completedToday = totalProcessedToday
      stats.currentProgress = totalProcessedMonth
      stats.monthlyTarget = 50 // Default target for finance

      // Get recent payout activity as tasks
      const { data: recentPayouts } = await supabase
        .from('cp_application_status_history')
        .select('id, application_id, new_status, changed_by_name, notes, created_at')
        .in('changed_by_role', ['FINANCE_EXECUTIVE', 'FINANCE_MANAGER'])
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentPayouts && recentPayouts.length > 0) {
        tasks = recentPayouts.map(p => ({
          id: p.id,
          title: `${p.new_status === 'PAYOUT_CREDITED' ? 'Credited' : 'Processing'}: ${p.notes || 'Payout update'}`,
          status: p.new_status === 'PAYOUT_CREDITED' ? 'completed' as const : 'in_progress' as const,
          priority: 'medium' as const,
          due_date: p.created_at,
        }))
      }

    } else {
      // Default stats for other roles - try to get from tasks table
      const { data: tasksData, error: tasksError } = await supabase
        .from('employee_tasks')
        .select('id, title, status, priority, due_date')
        .eq('assigned_to', user.id)
        .order('due_date', { ascending: true })
        .limit(10)

      if (!tasksError && tasksData) {
        stats.totalAssigned = tasksData.length
        stats.completedToday = tasksData.filter(t => t.status === 'completed').length
        stats.pendingTasks = tasksData.filter(t => t.status === 'pending').length

        tasks = tasksData.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority || 'medium',
          due_date: t.due_date,
        }))
      }

      stats.monthlyTarget = 100
      stats.currentProgress = Math.round((stats.completedToday / Math.max(stats.totalAssigned, 1)) * 100)
    }

    // Get team ranking based on peer count in same sub-role
    const { count: totalPeers } = await supabase
      .from('employee_profile')
      .select('id', { count: 'exact', head: true })
      .eq('subrole', subRole)

    // Calculate rank based on current progress relative to target
    const progressRatio = stats.monthlyTarget > 0
      ? stats.currentProgress / stats.monthlyTarget
      : 0
    const peerCount = totalPeers || 1
    // Estimate rank: higher progress = lower (better) rank number
    stats.teamRanking = Math.max(1, Math.ceil(peerCount * (1 - Math.min(progressRatio, 1))))

    // Get recent tasks
    if (tasks.length === 0) {
      const { data: recentTasks } = await supabase
        .from('employee_tasks')
        .select('id, title, status, priority, due_date')
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(5)

      if (recentTasks) {
        tasks = recentTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority || 'medium',
          due_date: t.due_date,
        }))
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        tasks,
        role: subRole,
        lastUpdated: new Date().toISOString(),
      },
    })

  } catch (error) {
    apiLogger.error('Error fetching dashboard data', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
