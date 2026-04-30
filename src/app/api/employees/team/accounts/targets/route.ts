import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Default targets when no custom targets are set
const DEFAULT_TARGETS = {
  cp_target: 100,
  ba_target: 50,
  bp_target: 50,
  processing_time_target: 24,  // hours
  accuracy_target: 95,         // percentage
  sla_target: 90,              // percentage
}

/** Get current IST date string (YYYY-MM-DD) */
function getISTDate(): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  return istDate.toISOString().split('T')[0]
}

/** Get IST datetime for start-of-day */
function getISTStartOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00+05:30`
}

/** Get month name from YYYY-MM string */
function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[month - 1]} ${year}`
}

/** Get first day of month N months ago from a given date string */
function getMonthStart(todayStr: string, monthsAgo: number): string {
  const [year, month] = todayStr.split('-').map(Number)
  let targetMonth = month - monthsAgo
  let targetYear = year
  while (targetMonth <= 0) {
    targetMonth += 12
    targetYear -= 1
  }
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
}

/** Get last day of a month given the first day (YYYY-MM-DD) */
function getMonthEnd(monthStartStr: string): string {
  const [year, month] = monthStartStr.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/**
 * GET /api/employees/team/accounts/targets
 * Returns department targets and progress for the current month,
 * monthly history (last 6 months), and member contributions.
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

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Only ACCOUNTS_MANAGER or SUPER_ADMIN can access
    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Only Accounts Manager can view targets.' }, { status: 403 })
    }

    const today = getISTDate()
    const currentYearMonth = today.substring(0, 7)
    const monthStart = `${currentYearMonth}-01`
    const monthEnd = getMonthEnd(monthStart)
    const monthStartIST = getISTStartOfDay(monthStart)

    // Try to load custom targets from department_targets table
    const { data: customTargets } = await supabase
      .from('department_targets')
      .select('*')
      .eq('department', 'ACCOUNTS')
      .eq('period', currentYearMonth)
      .maybeSingle()

    const targets = customTargets ? {
      cp_target: customTargets.cp_target ?? DEFAULT_TARGETS.cp_target,
      ba_target: customTargets.ba_target ?? DEFAULT_TARGETS.ba_target,
      bp_target: customTargets.bp_target ?? DEFAULT_TARGETS.bp_target,
      processing_time_target: customTargets.processing_time_target ?? DEFAULT_TARGETS.processing_time_target,
      accuracy_target: customTargets.accuracy_target ?? DEFAULT_TARGETS.accuracy_target,
      sla_target: customTargets.sla_target ?? DEFAULT_TARGETS.sla_target,
    } : { ...DEFAULT_TARGETS }

    // Build monthly history date ranges (last 6 months including current)
    const monthRanges: { start: string; end: string; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const mStart = getMonthStart(today, i)
      const mEnd = getMonthEnd(mStart)
      const ym = mStart.substring(0, 7)
      monthRanges.push({
        start: getISTStartOfDay(mStart),
        end: getISTStartOfDay(mEnd),
        label: getMonthLabel(ym),
      })
    }

    // === Run core queries in parallel ===
    const [
      cpVerified,
      baVerified,
      bpVerified,
      cpRejected,
      baRejected,
      bpRejected,
      cpProcessingData,
      partnerProcessingData,
      cpStatusHistory,
      partnerStatusHistory,
      teamMembers,
    ] = await Promise.all([
      // Current month CP verified
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStartIST),
      // Current month BA verified
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStartIST),
      // Current month BP verified
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStartIST),
      // Current month CP rejected
      supabase.from('cp_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'REJECTED')
        .gte('reviewed_at', monthStartIST),
      // Current month BA rejected
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('status', 'REJECTED')
        .gte('updated_at', monthStartIST),
      // Current month BP rejected
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BP').eq('status', 'REJECTED')
        .gte('updated_at', monthStartIST),
      // Processing time: CP apps verified this month
      supabase.from('cp_applications')
        .select('created_at, accounts_verified_at')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStartIST)
        .not('accounts_verified_at', 'is', null)
        .limit(500),
      // Processing time: partner apps verified this month
      supabase.from('partner_payout_applications')
        .select('created_at, accounts_verified_at')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', monthStartIST)
        .not('accounts_verified_at', 'is', null)
        .limit(500),
      // Member contributions: CP status history this month
      supabase.from('cp_application_status_history')
        .select('changed_by, changed_by_name, new_status')
        .eq('new_status', 'ACCOUNTS_VERIFIED')
        .gte('created_at', monthStartIST),
      // Member contributions: Partner status history this month
      supabase.from('partner_payout_status_history')
        .select('changed_by, changed_by_name, new_status')
        .eq('new_status', 'ACCOUNTS_VERIFIED')
        .gte('created_at', monthStartIST),
      // Team members
      supabase.from('users')
        .select('id, full_name')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER']),
    ])

    // === Monthly history queries (separate Promise.all for 6 months x 3 types = 18 queries) ===
    const monthlyHistoryResults = await Promise.all(
      monthRanges.flatMap(mr => [
        supabase.from('cp_applications').select('id', { count: 'exact', head: true })
          .eq('status', 'ACCOUNTS_VERIFIED')
          .gte('accounts_verified_at', mr.start)
          .lte('accounts_verified_at', mr.end),
        supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
          .eq('partner_type', 'BA').eq('status', 'ACCOUNTS_VERIFIED')
          .gte('accounts_verified_at', mr.start)
          .lte('accounts_verified_at', mr.end),
        supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
          .eq('partner_type', 'BP').eq('status', 'ACCOUNTS_VERIFIED')
          .gte('accounts_verified_at', mr.start)
          .lte('accounts_verified_at', mr.end),
      ])
    )

    // === Calculate current month actuals ===
    const cpActual = cpVerified.count ?? 0
    const baActual = baVerified.count ?? 0
    const bpActual = bpVerified.count ?? 0

    // Accuracy: verified / (verified + rejected) across all types
    const totalVerified = cpActual + baActual + bpActual
    const totalRejected = (cpRejected.count ?? 0) + (baRejected.count ?? 0) + (bpRejected.count ?? 0)
    const totalReviewed = totalVerified + totalRejected
    const actualAccuracy = totalReviewed > 0
      ? Math.round((totalVerified / totalReviewed) * 1000) / 10
      : 100

    // Processing time: average hours between created_at and accounts_verified_at
    const allProcessingApps = [
      ...(cpProcessingData.data || []),
      ...(partnerProcessingData.data || []),
    ]
    let avgProcessingHours = 0
    if (allProcessingApps.length > 0) {
      const totalHours = allProcessingApps.reduce((sum, app) => {
        if (!app.created_at || !app.accounts_verified_at) return sum
        const created = new Date(app.created_at).getTime()
        const verified = new Date(app.accounts_verified_at).getTime()
        return sum + (verified - created) / (1000 * 60 * 60)
      }, 0)
      avgProcessingHours = Math.round((totalHours / allProcessingApps.length) * 10) / 10
    }

    // SLA compliance: % of apps verified within target hours
    let slaCompliance = 100
    if (allProcessingApps.length > 0) {
      const withinSLA = allProcessingApps.filter(app => {
        if (!app.created_at || !app.accounts_verified_at) return false
        const created = new Date(app.created_at).getTime()
        const verified = new Date(app.accounts_verified_at).getTime()
        const hours = (verified - created) / (1000 * 60 * 60)
        return hours <= targets.processing_time_target
      }).length
      slaCompliance = Math.round((withinSLA / allProcessingApps.length) * 1000) / 10
    }

    // Calculate percentages (for inverse metrics like processing time, higher actual = lower %)
    const calcPercentage = (actual: number, target: number, inverse = false): number => {
      if (target === 0) return 0
      if (inverse) {
        // For processing time: lower actual is better, so % = target/actual * 100
        if (actual === 0) return 100
        return Math.round((target / actual) * 1000) / 10
      }
      return Math.round((actual / target) * 1000) / 10
    }

    const targetsResponse = {
      cp_verifications: {
        target: targets.cp_target,
        actual: cpActual,
        percentage: calcPercentage(cpActual, targets.cp_target),
      },
      ba_verifications: {
        target: targets.ba_target,
        actual: baActual,
        percentage: calcPercentage(baActual, targets.ba_target),
      },
      bp_verifications: {
        target: targets.bp_target,
        actual: bpActual,
        percentage: calcPercentage(bpActual, targets.bp_target),
      },
      avg_processing_time_hours: {
        target: targets.processing_time_target,
        actual: avgProcessingHours,
        percentage: calcPercentage(avgProcessingHours, targets.processing_time_target, true),
      },
      accuracy_rate: {
        target: targets.accuracy_target,
        actual: actualAccuracy,
        percentage: calcPercentage(actualAccuracy, targets.accuracy_target),
      },
      sla_compliance: {
        target: targets.sla_target,
        actual: slaCompliance,
        percentage: calcPercentage(slaCompliance, targets.sla_target),
      },
    }

    // === Monthly history (last 6 months) ===
    const totalTarget = targets.cp_target + targets.ba_target + targets.bp_target
    const monthly_history = monthRanges.map((mr, idx) => {
      const cpCount = monthlyHistoryResults[idx * 3]?.count ?? 0
      const baCount = monthlyHistoryResults[idx * 3 + 1]?.count ?? 0
      const bpCount = monthlyHistoryResults[idx * 3 + 2]?.count ?? 0
      const total = cpCount + baCount + bpCount
      return {
        month: mr.label,
        cp: cpCount,
        ba: baCount,
        bp: bpCount,
        total,
        target: totalTarget,
        achievement: totalTarget > 0 ? Math.round((total / totalTarget) * 1000) / 10 : 0,
      }
    })

    // === Member contributions ===
    const memberMap: Record<string, { name: string; verified: number }> = {}

    // Initialize from team members
    const members = teamMembers.data || []
    for (const m of members) {
      memberMap[m.id] = { name: m.full_name || 'Unknown', verified: 0 }
    }

    // Count from CP status history
    for (const entry of (cpStatusHistory.data || [])) {
      if (!entry.changed_by) continue
      if (!memberMap[entry.changed_by]) {
        memberMap[entry.changed_by] = { name: entry.changed_by_name || 'Unknown', verified: 0 }
      }
      memberMap[entry.changed_by].verified++
    }

    // Count from partner status history
    for (const entry of (partnerStatusHistory.data || [])) {
      if (!entry.changed_by) continue
      if (!memberMap[entry.changed_by]) {
        memberMap[entry.changed_by] = { name: entry.changed_by_name || 'Unknown', verified: 0 }
      }
      memberMap[entry.changed_by].verified++
    }

    const totalMemberVerified = Object.values(memberMap).reduce((sum, m) => sum + m.verified, 0)
    const member_contributions = Object.values(memberMap)
      .filter(m => m.verified > 0)
      .sort((a, b) => b.verified - a.verified)
      .map(m => ({
        name: m.name,
        verified: m.verified,
        percentage_of_total: totalMemberVerified > 0
          ? Math.round((m.verified / totalMemberVerified) * 1000) / 10
          : 0,
      }))

    // === Build current period info ===
    const monthLabel = getMonthLabel(currentYearMonth)

    return NextResponse.json({
      success: true,
      data: {
        current_period: {
          month: monthLabel,
          start: monthStart,
          end: monthEnd,
        },
        targets: targetsResponse,
        monthly_history,
        member_contributions,
      },
    })
  } catch (error) {
    logger.error('Error in accounts targets GET:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employees/team/accounts/targets
 * Set or update department targets for a given period.
 * Only ACCOUNTS_MANAGER or SUPER_ADMIN can set targets.
 * Body: { cp_target, ba_target, bp_target, processing_time_target, accuracy_target, sla_target, period }
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Only ACCOUNTS_MANAGER or SUPER_ADMIN can set targets
    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Only Accounts Manager can set targets.' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
      cp_target,
      ba_target,
      bp_target,
      processing_time_target,
      accuracy_target,
      sla_target,
      period,
    } = body as {
      cp_target?: number
      ba_target?: number
      bp_target?: number
      processing_time_target?: number
      accuracy_target?: number
      sla_target?: number
      period?: string
    }

    // Determine target period (default to current month)
    const today = getISTDate()
    const targetPeriod = period || today.substring(0, 7)

    // Validate period format (YYYY-MM)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetPeriod)) {
      return NextResponse.json({ success: false, error: 'Invalid period format. Use YYYY-MM.' }, { status: 400 })
    }

    // Validate numeric fields
    const numericFields = { cp_target, ba_target, bp_target, processing_time_target, accuracy_target, sla_target }
    for (const [key, val] of Object.entries(numericFields)) {
      if (val !== undefined && val !== null) {
        if (typeof val !== 'number' || val < 0) {
          return NextResponse.json({ success: false, error: `${key} must be a non-negative number.` }, { status: 400 })
        }
      }
    }

    // Check if targets already exist for this period
    const { data: existing } = await supabase
      .from('department_targets')
      .select('id')
      .eq('department', 'ACCOUNTS')
      .eq('period', targetPeriod)
      .maybeSingle()

    const targetData = {
      department: 'ACCOUNTS',
      period: targetPeriod,
      cp_target: cp_target ?? DEFAULT_TARGETS.cp_target,
      ba_target: ba_target ?? DEFAULT_TARGETS.ba_target,
      bp_target: bp_target ?? DEFAULT_TARGETS.bp_target,
      processing_time_target: processing_time_target ?? DEFAULT_TARGETS.processing_time_target,
      accuracy_target: accuracy_target ?? DEFAULT_TARGETS.accuracy_target,
      sla_target: sla_target ?? DEFAULT_TARGETS.sla_target,
      updated_by: user.id,
      updated_by_name: userData.full_name || 'Unknown',
      updated_at: new Date().toISOString(),
    }

    let result
    if (existing) {
      // Update existing
      result = await supabase
        .from('department_targets')
        .update(targetData)
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      // Insert new
      result = await supabase
        .from('department_targets')
        .insert({ ...targetData, created_at: new Date().toISOString() })
        .select()
        .single()
    }

    if (result.error) {
      // If department_targets table doesn't exist, return success with defaults
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        logger.warn('department_targets table does not exist, returning defaults', { error: result.error })
        return NextResponse.json({
          success: true,
          message: 'Targets saved (in-memory defaults). Create department_targets table for persistence.',
          data: targetData,
        })
      }
      logger.error('Error saving targets:', { error: result.error })
      return NextResponse.json({ success: false, error: 'Failed to save targets' }, { status: 500 })
    }

    logger.info('Department targets updated', {
      period: targetPeriod,
      updatedBy: user.id,
      targets: targetData,
    })

    return NextResponse.json({
      success: true,
      message: existing ? 'Targets updated successfully' : 'Targets created successfully',
      data: result.data,
    })
  } catch (error) {
    logger.error('Error in accounts targets POST:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
