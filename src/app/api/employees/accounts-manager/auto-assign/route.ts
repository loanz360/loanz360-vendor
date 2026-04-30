import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


type Strategy = 'round_robin' | 'least_loaded' | 'skill_based'

interface AssignmentResult {
  member_id: string
  member_name: string
  assigned_ids: string[]
}

/**
 * POST /api/employees/accounts-manager/auto-assign
 * Auto-assign pending applications to Accounts Executive team members.
 *
 * Body: { strategy, application_ids?, partner_type? }
 * Strategies: round_robin | least_loaded | skill_based
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // --- Auth ---
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

    // --- Parse body ---
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { strategy, application_ids, partner_type } = body as {
      strategy: Strategy
      application_ids?: string[]
      partner_type?: string
    }

    if (!strategy || !['round_robin', 'least_loaded', 'skill_based'].includes(strategy)) {
      return NextResponse.json(
        { success: false, error: 'Invalid strategy. Must be round_robin, least_loaded, or skill_based.' },
        { status: 400 }
      )
    }

    // --- Fetch active AE team members ---
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name, status')
      .eq('role', 'EMPLOYEE')
      .eq('sub_role', 'ACCOUNTS_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (teamError) {
      logger.error('Failed to fetch team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active Accounts Executives available for assignment.' },
        { status: 400 }
      )
    }

    // --- Fetch current workload per member ---
    const workloadMap: Record<string, number> = {}
    const skillMap: Record<string, Record<string, number>> = {}

    for (const member of teamMembers) {
      workloadMap[member.id] = 0
      skillMap[member.id] = {}
    }

    // Count CP applications in verification per member
    const { data: cpLoads } = await supabase
      .from('cp_applications')
      .select('assigned_to, partner_type')
      .eq('status', 'ACCOUNTS_VERIFICATION')
      .in('assigned_to', teamMembers.map(m => m.id))

    if (cpLoads) {
      for (const row of cpLoads) {
        if (row.assigned_to && workloadMap[row.assigned_to] !== undefined) {
          workloadMap[row.assigned_to]++
          const pt = row.partner_type || 'UNKNOWN'
          skillMap[row.assigned_to][pt] = (skillMap[row.assigned_to][pt] || 0) + 1
        }
      }
    }

    // Count partner payout applications in verification per member
    const { data: payoutLoads } = await supabase
      .from('partner_payout_applications')
      .select('assigned_to, partner_type')
      .eq('status', 'ACCOUNTS_VERIFICATION')
      .in('assigned_to', teamMembers.map(m => m.id))

    if (payoutLoads) {
      for (const row of payoutLoads) {
        if (row.assigned_to && workloadMap[row.assigned_to] !== undefined) {
          workloadMap[row.assigned_to]++
          const pt = row.partner_type || 'UNKNOWN'
          skillMap[row.assigned_to][pt] = (skillMap[row.assigned_to][pt] || 0) + 1
        }
      }
    }

    // --- Fetch applications to assign ---
    let cpToAssign: { id: string; partner_type: string }[] = []
    let payoutToAssign: { id: string; partner_type: string }[] = []

    if (application_ids && application_ids.length > 0) {
      // Assign specific applications
      const { data: cpApps } = await supabase
        .from('cp_applications')
        .select('id, partner_type')
        .in('id', application_ids)
        .eq('status', 'PENDING')

      const { data: payoutApps } = await supabase
        .from('partner_payout_applications')
        .select('id, partner_type')
        .in('id', application_ids)
        .eq('status', 'PENDING')

      cpToAssign = cpApps || []
      payoutToAssign = payoutApps || []
    } else {
      // Auto-assign all PENDING
      let cpQuery = supabase
        .from('cp_applications')
        .select('id, partner_type')
        .eq('status', 'PENDING')

      let payoutQuery = supabase
        .from('partner_payout_applications')
        .select('id, partner_type')
        .eq('status', 'PENDING')

      if (partner_type) {
        cpQuery = cpQuery.eq('partner_type', partner_type)
        payoutQuery = payoutQuery.eq('partner_type', partner_type)
      }

      const { data: cpApps } = await cpQuery
      const { data: payoutApps } = await payoutQuery

      cpToAssign = cpApps || []
      payoutToAssign = payoutApps || []
    }

    const allToAssign = [
      ...cpToAssign.map(a => ({ ...a, table: 'cp_applications' as const })),
      ...payoutToAssign.map(a => ({ ...a, table: 'partner_payout_applications' as const })),
    ]

    if (allToAssign.length === 0) {
      return NextResponse.json({
        success: true,
        data: { assigned: 0, assignments: [] },
        message: 'No pending applications to assign.',
      })
    }

    // --- Determine assignment order based on strategy ---
    const sortedMembers = [...teamMembers]

    if (strategy === 'least_loaded') {
      sortedMembers.sort((a, b) => (workloadMap[a.id] || 0) - (workloadMap[b.id] || 0))
    }
    // round_robin uses members in their natural order, rotating index
    // skill_based sorts per-application below

    const resultMap: Record<string, AssignmentResult> = {}
    for (const member of teamMembers) {
      resultMap[member.id] = {
        member_id: member.id,
        member_name: member.full_name || 'Unknown',
        assigned_ids: [],
      }
    }

    let rrIndex = 0

    for (const app of allToAssign) {
      let targetMember: typeof teamMembers[0]

      if (strategy === 'round_robin') {
        targetMember = sortedMembers[rrIndex % sortedMembers.length]
        rrIndex++
      } else if (strategy === 'least_loaded') {
        // Pick the member with the current least load (dynamically updated)
        sortedMembers.sort((a, b) => (workloadMap[a.id] || 0) - (workloadMap[b.id] || 0))
        targetMember = sortedMembers[0]
      } else {
        // skill_based: find the member who has handled the most of this partner_type
        const pt = app.partner_type || 'UNKNOWN'
        let bestMember = sortedMembers[0]
        let bestScore = -1

        for (const member of sortedMembers) {
          const score = skillMap[member.id]?.[pt] || 0
          // Tie-break by lower workload
          if (score > bestScore || (score === bestScore && (workloadMap[member.id] || 0) < (workloadMap[bestMember.id] || 0))) {
            bestScore = score
            bestMember = member
          }
        }
        targetMember = bestMember
      }

      // Update application
      const { error: updateError } = await supabase
        .from(app.table)
        .update({ assigned_to: targetMember.id, status: 'ACCOUNTS_VERIFICATION' })
        .eq('id', app.id)

      if (!updateError) {
        resultMap[targetMember.id].assigned_ids.push(app.id)
        workloadMap[targetMember.id] = (workloadMap[targetMember.id] || 0) + 1
        // Update skill map for subsequent skill_based picks
        const pt = app.partner_type || 'UNKNOWN'
        skillMap[targetMember.id][pt] = (skillMap[targetMember.id][pt] || 0) + 1
      } else {
        logger.error(`Failed to assign application ${app.id}`, updateError)
      }
    }

    const assignments = Object.values(resultMap)
      .filter(r => r.assigned_ids.length > 0)
      .map(r => ({ member_name: r.member_name, count: r.assigned_ids.length }))

    const totalAssigned = assignments.reduce((sum, a) => sum + a.count, 0)

    logger.info(`Auto-assignment complete: ${totalAssigned} items assigned via ${strategy}`)

    return NextResponse.json({
      success: true,
      data: {
        assigned: totalAssigned,
        assignments,
      },
      message: `Successfully assigned ${totalAssigned} application(s) using ${strategy.replace('_', ' ')} strategy.`,
    })
  } catch (error) {
    logger.error('Auto-assign error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
