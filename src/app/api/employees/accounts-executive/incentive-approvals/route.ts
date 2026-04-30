import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Allowed roles / sub-roles for this endpoint
const ALLOWED_ROLES = ['SUPER_ADMIN']
const ALLOWED_SUB_ROLES = ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER']

/**
 * Verify user has permission to access incentive approvals.
 * Returns the user row or a NextResponse error.
 */
async function authorizeUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, role, sub_role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (userError || !userData) {
    return NextResponse.json(
      { success: false, error: 'User not found' },
      { status: 404 },
    )
  }

  if (
    !ALLOWED_ROLES.includes(userData.role) &&
    !(userData.role === 'EMPLOYEE' && ALLOWED_SUB_ROLES.includes(userData.sub_role))
  ) {
    return NextResponse.json(
      { success: false, error: 'Access denied. Only Accounts team can access this resource.' },
      { status: 403 },
    )
  }

  return userData as { id: string; role: string; sub_role: string; full_name: string }
}

// ─── GET ────────────────────────────────────────────────────────────────────────
/**
 * GET /api/employees/accounts-executive/incentive-approvals
 * Fetch incentive claims with stats, filters, search, pagination
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Auth
    const authResult = await authorizeUser(supabase)
    if (authResult instanceof NextResponse) return authResult

    // Parse params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // ── Build claims query ──────────────────────────────────────────────────
    let query = supabase
      .from('incentive_claims')
      .select(`
        id,
        allocation_id,
        user_id,
        incentive_id,
        claimed_amount,
        claim_status,
        claimed_at,
        reviewed_by,
        reviewed_at,
        review_notes,
        payment_method,
        payment_reference,
        paid_at,
        created_at,
        updated_at,
        employee:users!incentive_claims_user_id_fkey (
          id,
          full_name,
          email,
          phone_number,
          sub_role
        ),
        incentive:incentives!incentive_claims_incentive_id_fkey (
          id,
          incentive_title,
          incentive_type,
          reward_amount,
          start_date,
          end_date,
          status
        ),
        allocation:incentive_allocations!incentive_claims_allocation_id_fkey (
          id,
          progress_percentage,
          allocation_status,
          earned_amount,
          current_progress
        ),
        reviewer:users!incentive_claims_reviewed_by_fkey (
          full_name
        )
      `, { count: 'exact' })
      .order('claimed_at', { ascending: false })

    // Status filter
    if (status !== 'all') {
      query = query.eq('claim_status', status)
    }

    // Date range filter
    if (dateFrom) {
      query = query.gte('claimed_at', `${dateFrom}T00:00:00`)
    }
    if (dateTo) {
      query = query.lte('claimed_at', `${dateTo}T23:59:59.999`)
    }

    // Search – we need to search across related tables, so use an OR on
    // the fields available in incentive_claims + related names via text search.
    // Supabase doesn't support ilike on joined columns directly, so we filter
    // by incentive_id or user_id separately if search is provided.
    if (search) {
      const sanitized = search.replace(/[%_\\(),."']/g, '')
      if (sanitized.length > 0) {
        // First, find matching user ids
        const { data: matchingUsers } = await supabase
          .from('users')
          .select('id')
          .ilike('full_name', `%${sanitized}%`)
          .limit(50)

        // Find matching incentive ids
        const { data: matchingIncentives } = await supabase
          .from('incentives')
          .select('id')
          .ilike('incentive_title', `%${sanitized}%`)
          .limit(50)

        const userIds = matchingUsers?.map(u => u.id) || []
        const incentiveIds = matchingIncentives?.map(i => i.id) || []

        if (userIds.length > 0 && incentiveIds.length > 0) {
          query = query.or(`user_id.in.(${userIds.join(',')}),incentive_id.in.(${incentiveIds.join(',')})`)
        } else if (userIds.length > 0) {
          query = query.in('user_id', userIds)
        } else if (incentiveIds.length > 0) {
          query = query.in('incentive_id', incentiveIds)
        } else {
          // No matches – return empty
          return NextResponse.json({
            success: true,
            claims: [],
            stats: await getStats(supabase),
            pagination: { page, limit, total: 0, totalPages: 0 },
          })
        }
      }
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: claims, error: claimsError, count: totalCount } = await query

    if (claimsError) {
      logger.error('Error fetching incentive claims:', { error: claimsError })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch incentive claims' },
        { status: 500 },
      )
    }

    // Stats
    const stats = await getStats(supabase)

    const total = totalCount || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      claims: claims || [],
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    logger.error('Error in incentive approvals GET:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────────
/**
 * PUT /api/employees/accounts-executive/incentive-approvals
 * Approve or reject an incentive claim
 * Body: { claimId, action: 'approve' | 'reject', reason?: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Auth
    const authResult = await authorizeUser(supabase)
    if (authResult instanceof NextResponse) return authResult
    const userData = authResult

    const bodySchema = z.object({


      claimId: z.string().uuid().optional(),


      action: z.string().optional(),


      reason: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { claimId, action, reason } = body

    // Validate input
    if (!claimId || !action) {
      return NextResponse.json(
        { success: false, error: 'claimId and action are required' },
        { status: 400 },
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "approve" or "reject".' },
        { status: 400 },
      )
    }

    if (action === 'reject' && (!reason || !reason.trim())) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
        { status: 400 },
      )
    }

    // Fetch existing claim with optimistic locking via updated_at
    const { data: claim, error: claimError } = await supabase
      .from('incentive_claims')
      .select('id, claim_status, updated_at, user_id, incentive_id, allocation_id, claimed_amount')
      .eq('id', claimId)
      .maybeSingle()

    if (claimError || !claim) {
      return NextResponse.json(
        { success: false, error: 'Claim not found' },
        { status: 404 },
      )
    }

    // Ensure claim is still in pending status (guard against double-processing)
    if (claim.claim_status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: `This claim has already been ${claim.claim_status}. Cannot modify.`,
          code: 'ALREADY_PROCESSED',
        },
        { status: 409 },
      )
    }

    const now = new Date().toISOString()
    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Optimistic lock: only update if updated_at matches what we read
    const { data: updated, error: updateError } = await supabase
      .from('incentive_claims')
      .update({
        claim_status: newStatus,
        reviewed_by: userData.id,
        reviewed_at: now,
        review_notes: action === 'reject' ? reason.trim() : (reason || null),
        updated_at: now,
      })
      .eq('id', claimId)
      .eq('updated_at', claim.updated_at) // optimistic lock
      .select('id, claim_status')
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating incentive claim:', { error: updateError, claimId, action })
      return NextResponse.json(
        { success: false, error: 'Failed to update claim' },
        { status: 500 },
      )
    }

    if (!updated) {
      // Optimistic lock failed – another user modified the record
      return NextResponse.json(
        {
          success: false,
          error: 'This claim was modified by another user. Please refresh and try again.',
          code: 'CONCURRENT_MODIFICATION',
        },
        { status: 409 },
      )
    }

    // If approved, also update the allocation status to 'claimed'
    if (action === 'approve' && claim.allocation_id) {
      await supabase
        .from('incentive_allocations')
        .update({
          allocation_status: 'claimed',
          updated_at: now,
        })
        .eq('id', claim.allocation_id)
    }

    logger.info('Incentive claim updated', {
      claimId,
      action,
      newStatus,
      reviewedBy: userData.id,
      reviewerName: userData.full_name,
    })

    return NextResponse.json({
      success: true,
      message: `Claim ${newStatus} successfully`,
      claim: updated,
    })
  } catch (error) {
    logger.error('Error in incentive approvals PUT:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// ─── Helper: compute stats ──────────────────────────────────────────────────────
async function getStats(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{
  pending_claims: number
  approved_today: number
  total_pending_amount: number
  monthly_approved_amount: number
}> {
  const today = new Date().toISOString().split('T')[0]
  const monthStart = `${today.slice(0, 7)}-01`

  const [
    pendingResult,
    approvedTodayResult,
    pendingAmountResult,
    monthlyApprovedResult,
  ] = await Promise.all([
    // Count of pending claims
    supabase
      .from('incentive_claims')
      .select('id', { count: 'exact', head: true })
      .eq('claim_status', 'pending'),

    // Count approved today
    supabase
      .from('incentive_claims')
      .select('id', { count: 'exact', head: true })
      .eq('claim_status', 'approved')
      .gte('reviewed_at', `${today}T00:00:00`)
      .lt('reviewed_at', `${today}T23:59:59.999`),

    // Sum of pending claim amounts
    supabase
      .from('incentive_claims')
      .select('claimed_amount')
      .eq('claim_status', 'pending'),

    // Sum of approved claim amounts this month
    supabase
      .from('incentive_claims')
      .select('claimed_amount')
      .eq('claim_status', 'approved')
      .gte('reviewed_at', `${monthStart}T00:00:00`),
  ])

  const totalPendingAmount = (pendingAmountResult.data || []).reduce(
    (sum, row) => sum + (Number(row.claimed_amount) || 0),
    0,
  )

  const monthlyApprovedAmount = (monthlyApprovedResult.data || []).reduce(
    (sum, row) => sum + (Number(row.claimed_amount) || 0),
    0,
  )

  return {
    pending_claims: pendingResult.count || 0,
    approved_today: approvedTodayResult.count || 0,
    total_pending_amount: totalPendingAmount,
    monthly_approved_amount: monthlyApprovedAmount,
  }
}
