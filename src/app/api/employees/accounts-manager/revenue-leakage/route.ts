import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


interface LeakageAlert {
  id: string
  type: 'low_commission' | 'unprocessed' | 'duplicate' | 'delayed'
  severity: 'critical' | 'warning' | 'info'
  app_id: string
  partner_type: string
  description: string
  amount: number
  expected_amount: number
  created_at: string
  recommended_action: string
}

/**
 * GET /api/employees/accounts-manager/revenue-leakage
 * Detect potential revenue leakage: low commissions, unprocessed payouts,
 * duplicate applications, and delayed processing.
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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const thirtyDaysAgo = new Date(istNow.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(istNow.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const sixtyDaysAgo = new Date(istNow.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

    // Run all detection queries in parallel
    const [
      cpAllApps,
      partnerAllApps,
      cpVerifiedUnprocessed,
      partnerVerifiedUnprocessed,
      cpRecentDuplicates,
      partnerRecentDuplicates,
    ] = await Promise.all([
      // All CP apps in last 60 days for commission analysis
      supabase.from('cp_applications')
        .select('id, app_id, customer_name, bank_name, loan_amount, expected_payout_amount, status, created_at')
        .gte('created_at', sixtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(500),

      // All partner apps in last 60 days for commission analysis
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, loan_amount, expected_commission_amount, partner_type, status, created_at')
        .gte('created_at', sixtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(500),

      // CP apps verified but not finance-processed (older than 30 days)
      supabase.from('cp_applications')
        .select('id, app_id, customer_name, bank_name, expected_payout_amount, status, accounts_verified_at, created_at')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .lt('accounts_verified_at', thirtyDaysAgo)
        .limit(100),

      // Partner apps verified but not processed (older than 30 days)
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, expected_commission_amount, partner_type, status, accounts_verified_at, created_at')
        .eq('status', 'ACCOUNTS_VERIFIED')
        .lt('accounts_verified_at', thirtyDaysAgo)
        .limit(100),

      // CP recent apps for duplicate detection (last 7 days)
      supabase.from('cp_applications')
        .select('id, app_id, customer_name, partner_id, loan_amount, expected_payout_amount, status, created_at')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(200),

      // Partner recent apps for duplicate detection (last 7 days)
      supabase.from('partner_payout_applications')
        .select('id, app_id, customer_name, partner_id, loan_amount, expected_commission_amount, partner_type, status, created_at')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    const alerts: LeakageAlert[] = []
    let alertCounter = 0

    // ---- 1. LOW COMMISSION DETECTION ----
    // Calculate average commission rates per loan amount range for CP
    const cpApps = (cpAllApps.data || []) as Array<{
      id: string; app_id: string; customer_name: string; bank_name: string;
      loan_amount: number; expected_payout_amount: number; status: string; created_at: string
    }>

    if (cpApps.length > 0) {
      const validCpApps = cpApps.filter(a => a.loan_amount > 0 && a.expected_payout_amount > 0)
      if (validCpApps.length > 3) {
        const avgRate = validCpApps.reduce((sum, a) => sum + (a.expected_payout_amount / a.loan_amount), 0) / validCpApps.length
        const threshold = avgRate * 0.5 // 50% below average

        for (const app of validCpApps) {
          const rate = app.expected_payout_amount / app.loan_amount
          if (rate < threshold && app.loan_amount > 100000) {
            const expectedAmount = Math.round(app.loan_amount * avgRate)
            alerts.push({
              id: `lc_cp_${++alertCounter}`,
              type: 'low_commission',
              severity: rate < threshold * 0.5 ? 'critical' : 'warning',
              app_id: app.app_id || app.id,
              partner_type: 'CP',
              description: `CP payout for ${app.customer_name || 'Unknown'} (${app.bank_name || 'Unknown Bank'}) is ${(rate * 100).toFixed(2)}% of loan amount, significantly below average ${(avgRate * 100).toFixed(2)}%`,
              amount: app.expected_payout_amount,
              expected_amount: expectedAmount,
              created_at: app.created_at,
              recommended_action: `Review payout rate. Expected ~${formatCurrency(expectedAmount)} but set at ${formatCurrency(app.expected_payout_amount)}. Verify with partner agreement.`,
            })
          }
        }
      }
    }

    // Same for partner apps
    const partnerApps = (partnerAllApps.data || []) as Array<{
      id: string; app_id: string; customer_name: string; bank_name: string;
      loan_amount: number; expected_commission_amount: number; partner_type: string;
      status: string; created_at: string
    }>

    if (partnerApps.length > 0) {
      for (const pType of ['BA', 'BP']) {
        const typedApps = partnerApps.filter(a => a.partner_type === pType && a.loan_amount > 0 && a.expected_commission_amount > 0)
        if (typedApps.length > 3) {
          const avgRate = typedApps.reduce((sum, a) => sum + (a.expected_commission_amount / a.loan_amount), 0) / typedApps.length
          const threshold = avgRate * 0.5

          for (const app of typedApps) {
            const rate = app.expected_commission_amount / app.loan_amount
            if (rate < threshold && app.loan_amount > 100000) {
              const expectedAmount = Math.round(app.loan_amount * avgRate)
              alerts.push({
                id: `lc_${pType.toLowerCase()}_${++alertCounter}`,
                type: 'low_commission',
                severity: rate < threshold * 0.5 ? 'critical' : 'warning',
                app_id: app.app_id || app.id,
                partner_type: pType,
                description: `${pType} commission for ${app.customer_name || 'Unknown'} (${app.bank_name || 'Unknown Bank'}) is ${(rate * 100).toFixed(2)}% of loan amount, significantly below average ${(avgRate * 100).toFixed(2)}%`,
                amount: app.expected_commission_amount,
                expected_amount: expectedAmount,
                created_at: app.created_at,
                recommended_action: `Review commission rate. Expected ~${formatCurrency(expectedAmount)} but set at ${formatCurrency(app.expected_commission_amount)}. Check partner tier.`,
              })
            }
          }
        }
      }
    }

    // ---- 2. UNPROCESSED VERIFIED APPLICATIONS ----
    const cpUnprocessed = (cpVerifiedUnprocessed.data || []) as Array<{
      id: string; app_id: string; customer_name: string; bank_name: string;
      expected_payout_amount: number; status: string; accounts_verified_at: string; created_at: string
    }>
    for (const app of cpUnprocessed) {
      alerts.push({
        id: `up_cp_${++alertCounter}`,
        type: 'unprocessed',
        severity: 'critical',
        app_id: app.app_id || app.id,
        partner_type: 'CP',
        description: `CP payout for ${app.customer_name || 'Unknown'} verified on ${new Date(app.accounts_verified_at).toLocaleDateString('en-IN')} but never sent to finance. Stuck for 30+ days.`,
        amount: app.expected_payout_amount || 0,
        expected_amount: app.expected_payout_amount || 0,
        created_at: app.created_at,
        recommended_action: 'Escalate to finance team immediately. Payout is overdue and may cause partner dissatisfaction.',
      })
    }

    const partnerUnprocessed = (partnerVerifiedUnprocessed.data || []) as Array<{
      id: string; app_id: string; customer_name: string; bank_name: string;
      expected_commission_amount: number; partner_type: string; status: string;
      accounts_verified_at: string; created_at: string
    }>
    for (const app of partnerUnprocessed) {
      alerts.push({
        id: `up_${app.partner_type?.toLowerCase()}_${++alertCounter}`,
        type: 'unprocessed',
        severity: 'critical',
        app_id: app.app_id || app.id,
        partner_type: app.partner_type || 'BA',
        description: `${app.partner_type} commission for ${app.customer_name || 'Unknown'} verified on ${new Date(app.accounts_verified_at).toLocaleDateString('en-IN')} but never processed. Stuck for 30+ days.`,
        amount: app.expected_commission_amount || 0,
        expected_amount: app.expected_commission_amount || 0,
        created_at: app.created_at,
        recommended_action: 'Escalate to finance team immediately. Commission payout is overdue.',
      })
    }

    // ---- 3. DUPLICATE DETECTION ----
    const cpRecent = (cpRecentDuplicates.data || []) as Array<{
      id: string; app_id: string; customer_name: string; partner_id: string;
      loan_amount: number; expected_payout_amount: number; status: string; created_at: string
    }>
    const cpDupMap = new Map<string, typeof cpRecent>()
    for (const app of cpRecent) {
      const key = `${app.partner_id}_${app.customer_name?.toLowerCase()}_${app.loan_amount}`
      if (!cpDupMap.has(key)) cpDupMap.set(key, [])
      cpDupMap.get(key)!.push(app)
    }
    for (const [, group] of cpDupMap) {
      if (group.length > 1) {
        for (let i = 1; i < group.length; i++) {
          alerts.push({
            id: `dup_cp_${++alertCounter}`,
            type: 'duplicate',
            severity: 'warning',
            app_id: group[i].app_id || group[i].id,
            partner_type: 'CP',
            description: `Possible duplicate: Same partner + customer "${group[i].customer_name || 'Unknown'}" + loan amount within 7 days. Original: ${group[0].app_id || group[0].id}`,
            amount: group[i].expected_payout_amount || 0,
            expected_amount: 0,
            created_at: group[i].created_at,
            recommended_action: `Compare with application ${group[0].app_id || group[0].id}. If duplicate, reject to prevent double payout.`,
          })
        }
      }
    }

    const partnerRecent = (partnerRecentDuplicates.data || []) as Array<{
      id: string; app_id: string; customer_name: string; partner_id: string;
      loan_amount: number; expected_commission_amount: number; partner_type: string;
      status: string; created_at: string
    }>
    const partnerDupMap = new Map<string, typeof partnerRecent>()
    for (const app of partnerRecent) {
      const key = `${app.partner_type}_${app.partner_id}_${app.customer_name?.toLowerCase()}_${app.loan_amount}`
      if (!partnerDupMap.has(key)) partnerDupMap.set(key, [])
      partnerDupMap.get(key)!.push(app)
    }
    for (const [, group] of partnerDupMap) {
      if (group.length > 1) {
        for (let i = 1; i < group.length; i++) {
          alerts.push({
            id: `dup_${group[i].partner_type?.toLowerCase()}_${++alertCounter}`,
            type: 'duplicate',
            severity: 'warning',
            app_id: group[i].app_id || group[i].id,
            partner_type: group[i].partner_type || 'BA',
            description: `Possible duplicate: Same partner + customer "${group[i].customer_name || 'Unknown'}" + loan amount within 7 days. Original: ${group[0].app_id || group[0].id}`,
            amount: group[i].expected_commission_amount || 0,
            expected_amount: 0,
            created_at: group[i].created_at,
            recommended_action: `Compare with application ${group[0].app_id || group[0].id}. If duplicate, reject to prevent double commission.`,
          })
        }
      }
    }

    // ---- 4. DELAYED PROCESSING (>2x average) ----
    // Calculate average processing time from all apps
    const allAppsWithTime = [...cpApps, ...partnerApps.map(a => ({
      ...a, expected_payout_amount: a.expected_commission_amount
    }))]
    const pendingStatuses = ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION']
    const pendingApps = allAppsWithTime.filter(a => pendingStatuses.includes(a.status))

    if (pendingApps.length > 0) {
      const ages = pendingApps.map(a => (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
      const avgAge = ages.reduce((s, a) => s + a, 0) / ages.length
      const delayThreshold = Math.max(avgAge * 2, 7) // At least 7 days

      for (const app of cpApps.filter(a => pendingStatuses.includes(a.status))) {
        const ageDays = (Date.now() - new Date(app.created_at).getTime()) / (1000 * 60 * 60 * 24)
        if (ageDays > delayThreshold) {
          alerts.push({
            id: `del_cp_${++alertCounter}`,
            type: 'delayed',
            severity: ageDays > delayThreshold * 1.5 ? 'critical' : 'info',
            app_id: app.app_id || app.id,
            partner_type: 'CP',
            description: `CP application for ${app.customer_name || 'Unknown'} pending for ${Math.round(ageDays)} days (avg: ${Math.round(avgAge)} days). Processing severely delayed.`,
            amount: app.expected_payout_amount || 0,
            expected_amount: app.expected_payout_amount || 0,
            created_at: app.created_at,
            recommended_action: `Investigate delay. Application is ${Math.round(ageDays / avgAge)}x slower than average. Reassign or escalate.`,
          })
        }
      }

      for (const app of partnerApps.filter(a => pendingStatuses.includes(a.status))) {
        const ageDays = (Date.now() - new Date(app.created_at).getTime()) / (1000 * 60 * 60 * 24)
        if (ageDays > delayThreshold) {
          alerts.push({
            id: `del_${app.partner_type?.toLowerCase()}_${++alertCounter}`,
            type: 'delayed',
            severity: ageDays > delayThreshold * 1.5 ? 'critical' : 'info',
            app_id: app.app_id || app.id,
            partner_type: app.partner_type || 'BA',
            description: `${app.partner_type} application for ${app.customer_name || 'Unknown'} pending for ${Math.round(ageDays)} days (avg: ${Math.round(avgAge)} days). Processing severely delayed.`,
            amount: app.expected_commission_amount || 0,
            expected_amount: app.expected_commission_amount || 0,
            created_at: app.created_at,
            recommended_action: `Investigate delay. Application is ${Math.round(ageDays / avgAge)}x slower than average. Reassign or escalate.`,
          })
        }
      }
    }

    // Sort alerts: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    const criticalCount = alerts.filter(a => a.severity === 'critical').length
    const warningCount = alerts.filter(a => a.severity === 'warning').length
    const potentialLeakage = alerts.reduce((sum, a) => {
      if (a.type === 'low_commission') return sum + Math.max(0, a.expected_amount - a.amount)
      if (a.type === 'unprocessed') return sum + a.amount
      if (a.type === 'duplicate') return sum + a.amount
      return sum
    }, 0)

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary: {
          total_alerts: alerts.length,
          potential_leakage_amount: potentialLeakage,
          critical_count: criticalCount,
          warning_count: warningCount,
        },
      },
    })
  } catch (error) {
    logger.error('Revenue leakage API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `Rs.${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `Rs.${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `Rs.${(amount / 1000).toFixed(1)} K`
  return `Rs.${amount.toLocaleString('en-IN')}`
}
