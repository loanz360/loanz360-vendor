import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


interface QueueItem {
  id: string
  app_id: string
  partner_type: 'CP' | 'BA' | 'BP'
  customer_name: string
  bank_name: string | null
  amount: number
  status: string
  created_at: string
  days_pending: number
  priority_score: number
  age_score: number
  amount_score: number
  tier_score: number
}

/**
 * Calculate priority score for an application.
 * age_score (0-40) + amount_score (0-35) + tier_score (0-25) = 0-100
 */
function calculatePriority(
  daysPending: number,
  amount: number,
  partnerType: 'CP' | 'BA' | 'BP'
): { priority_score: number; age_score: number; amount_score: number; tier_score: number } {
  // Age score: days_pending / 14 * 40, capped at 40
  const age_score = Math.min(Math.round((daysPending / 14) * 40 * 100) / 100, 40)

  // Amount score: min(amount / 500000 * 35, 35)
  const amount_score = Math.min(Math.round((amount / 500000) * 35 * 100) / 100, 35)

  // Tier score: CP=25, BA=15, BP=20
  const tierMap: Record<string, number> = { CP: 25, BA: 15, BP: 20 }
  const tier_score = tierMap[partnerType] || 15

  const priority_score = Math.round((age_score + amount_score + tier_score) * 100) / 100

  return { priority_score, age_score, amount_score, tier_score }
}

/**
 * GET /api/employees/accounts-manager/priority-queue
 * Returns prioritized queue of pending applications across all partner types.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const partnerType = searchParams.get('partner_type') || 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const sortBy = searchParams.get('sort_by') || 'priority'

    const now = new Date()
    const queue: QueueItem[] = []

    // Pending statuses to include
    const pendingStatuses = ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION', 'ON_HOLD']

    // Fetch CP applications
    if (partnerType === 'all' || partnerType === 'CP') {
      const { data: cpApps, error: cpError } = await supabase
        .from('cp_applications')
        .select('id, app_id, customer_name, bank_name, expected_payout_amount, status, created_at')
        .in('status', pendingStatuses)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (cpError) {
        logger.error('Error fetching CP applications for priority queue:', { error: cpError })
      } else if (cpApps) {
        for (const app of cpApps) {
          const daysPending = Math.max(0, Math.floor((now.getTime() - new Date(app.created_at).getTime()) / (1000 * 60 * 60 * 24)))
          const amount = app.expected_payout_amount || 0
          const scores = calculatePriority(daysPending, amount, 'CP')

          queue.push({
            id: app.id,
            app_id: app.app_id,
            partner_type: 'CP',
            customer_name: app.customer_name || 'Unknown',
            bank_name: app.bank_name || null,
            amount,
            status: app.status,
            created_at: app.created_at,
            days_pending: daysPending,
            ...scores,
          })
        }
      }
    }

    // Fetch BA/BP applications
    if (partnerType === 'all' || partnerType === 'BA' || partnerType === 'BP') {
      let query = supabase
        .from('partner_payout_applications')
        .select('id, app_id, customer_name, bank_name, expected_commission_amount, partner_type, status, created_at')
        .in('status', pendingStatuses)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (partnerType === 'BA' || partnerType === 'BP') {
        query = query.eq('partner_type', partnerType)
      }

      const { data: partnerApps, error: partnerError } = await query

      if (partnerError) {
        logger.error('Error fetching partner applications for priority queue:', { error: partnerError })
      } else if (partnerApps) {
        for (const app of partnerApps) {
          const daysPending = Math.max(0, Math.floor((now.getTime() - new Date(app.created_at).getTime()) / (1000 * 60 * 60 * 24)))
          const amount = app.expected_commission_amount || 0
          const pt = (app.partner_type as 'BA' | 'BP') || 'BA'
          const scores = calculatePriority(daysPending, amount, pt)

          queue.push({
            id: app.id,
            app_id: app.app_id,
            partner_type: pt,
            customer_name: app.customer_name || 'Unknown',
            bank_name: app.bank_name || null,
            amount,
            status: app.status,
            created_at: app.created_at,
            days_pending: daysPending,
            ...scores,
          })
        }
      }
    }

    // Sort based on sort_by param
    if (sortBy === 'age') {
      queue.sort((a, b) => b.days_pending - a.days_pending)
    } else if (sortBy === 'amount') {
      queue.sort((a, b) => b.amount - a.amount)
    } else {
      // Default: priority score descending
      queue.sort((a, b) => b.priority_score - a.priority_score)
    }

    // Trim to limit
    const trimmedQueue = queue.slice(0, limit)

    // Summary stats
    const totalScore = trimmedQueue.reduce((sum, item) => sum + item.priority_score, 0)
    const avgPriority = trimmedQueue.length > 0 ? Math.round((totalScore / trimmedQueue.length) * 100) / 100 : 0
    const criticalCount = trimmedQueue.filter(item => item.priority_score >= 80).length

    // Counts by partner type
    const cpCount = trimmedQueue.filter(i => i.partner_type === 'CP').length
    const baCount = trimmedQueue.filter(i => i.partner_type === 'BA').length
    const bpCount = trimmedQueue.filter(i => i.partner_type === 'BP').length

    return NextResponse.json({
      success: true,
      data: {
        queue: trimmedQueue,
        total: trimmedQueue.length,
        counts: { cp: cpCount, ba: baCount, bp: bpCount },
        summary: {
          avg_priority: avgPriority,
          critical_count: criticalCount,
        },
      },
    })

  } catch (error) {
    logger.error('Priority queue error:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
