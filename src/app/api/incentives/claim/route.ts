import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { parsePaginationParams, getSupabaseRange, createPaginatedResponse } from '@/lib/utils/pagination'

/**
 * GET /api/incentives/claim
 * Fetch claim history (for employees) or all claims (for admin)
 * Access: All authenticated users
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role from users table (SUPER_ADMIN, ADMIN)
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = userData?.role === 'SUPER_ADMIN' || userData?.role === 'ADMIN'
    const isHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'ADMIN_EXECUTIVE', 'ADMIN_MANAGER'].includes(userData?.sub_role || '')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // pending, approved, rejected, paid

    // Get pagination params
    const { page, limit } = parsePaginationParams(searchParams)
    const [from, to] = getSupabaseRange(page, limit)

    let query = supabase
      .from('incentive_claims')
      .select(`
        *,
        user:employees!incentive_claims_user_id_fkey(id, full_name, email, sub_role),
        incentive:incentives(id, incentive_title, incentive_type, reward_amount),
        reviewed_by_user:employees!incentive_claims_reviewed_by_fkey(id, full_name, email)
      `, { count: 'exact' })
      .order('claimed_at', { ascending: false })
      .range(from, to)

    // Filter by user if not admin
    if (!isSuperAdmin && !isHR) {
      query = query.eq('user_id', user.id)
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('claim_status', status)
    }

    const { data: claims, error, count } = await query

    if (error) {
      logger.error('Error fetching claims', error)
      throw error
    }

    return NextResponse.json(
      createPaginatedResponse(claims || [], page, limit, count || 0)
    )
  } catch (error) {
    logger.error('Error in GET /api/incentives/claim', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchClaims' })
    return NextResponse.json({ success: false, error: 'Failed to fetch claims' }, { status: 500 })
  }
}

/**
 * POST /api/incentives/claim
 * Submit a claim for an earned incentive
 * Access: Employees with achieved allocations
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { allocation_id, claimed_amount, payment_method } = body

    if (!allocation_id || !claimed_amount) {
      return NextResponse.json({ success: false, error: 'Missing required fields: allocation_id, claimed_amount' }, { status: 400 })
    }

    // Fetch the allocation to verify eligibility
    const { data: allocation, error: allocError } = await supabase
      .from('incentive_allocations')
      .select('*, incentive:incentives(*)')
      .eq('id', allocation_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (allocError || !allocation) {
      return NextResponse.json({ success: false, error: 'Allocation not found or not authorized' }, { status: 404 })
    }

    // Check if allocation is in achieved status
    if (allocation.allocation_status !== 'achieved') {
      return NextResponse.json({ success: false, error: 'Cannot claim: Incentive not achieved' }, { status: 400 })
    }

    // Check if already claimed (FIXED: use maybeSingle instead of single)
    const { data: existingClaim, error: claimCheckError } = await supabase
      .from('incentive_claims')
      .select('id')
      .eq('allocation_id', allocation_id)
      .maybeSingle()

    if (claimCheckError) {
      logger.error('Error checking for existing claim', claimCheckError)
      return NextResponse.json({ success: false, error: 'Failed to verify claim status' }, { status: 500 })
    }

    if (existingClaim) {
      return NextResponse.json({ success: false, error: 'Claim already submitted for this allocation' }, { status: 400 })
    }

    // Validate claimed amount doesn't exceed earned amount
    if (parseFloat(claimed_amount) > parseFloat(allocation.earned_amount)) {
      return NextResponse.json(
        { error: `Claimed amount cannot exceed earned amount (${allocation.earned_amount})` },
        { status: 400 }
      )
    }

    // Create the claim
    const { data: claim, error: insertError } = await supabase
      .from('incentive_claims')
      .insert({
        allocation_id,
        user_id: user.id,
        incentive_id: allocation.incentive_id,
        claimed_amount,
        claim_status: 'pending',
        payment_method: payment_method || null,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      logger.error('Error creating claim', insertError)
      throw insertError
    }

    // Update allocation status to claimed
    await supabase
      .from('incentive_allocations')
      .update({ allocation_status: 'claimed' })
      .eq('id', allocation_id)

    logger.info(`Claim submitted: ${claim.id} by ${user.id} for incentive ${allocation.incentive_id}`)

    return NextResponse.json({
      success: true,
      data: claim,
      message: 'Claim submitted successfully. Pending review.',
    }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/incentives/claim', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'createClaim' })
    return NextResponse.json({ success: false, error: 'Failed to submit claim' }, { status: 500 })
  }
}

/**
 * PATCH /api/incentives/claim
 * Review and approve/reject a claim
 * Access: SuperAdmin, HR
 */
export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPDATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    // Check user role from users table (SUPER_ADMIN, ADMIN)
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = userData?.role === 'SUPER_ADMIN' || userData?.role === 'ADMIN'
    const isHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'ADMIN_EXECUTIVE', 'ADMIN_MANAGER'].includes(userData?.sub_role || '')

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only SuperAdmin or HR can review claims' }, { status: 403 })
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { claim_id, claim_status, review_notes, payment_reference } = body

    if (!claim_id || !claim_status) {
      return NextResponse.json({ success: false, error: 'Missing required fields: claim_id, claim_status' }, { status: 400 })
    }

    if (!['approved', 'rejected', 'paid'].includes(claim_status)) {
      return NextResponse.json({ success: false, error: 'Invalid claim_status. Must be: approved, rejected, or paid' }, { status: 400 })
    }

    // Fetch the claim
    const { data: claim, error: claimError } = await supabase
      .from('incentive_claims')
      .select('*')
      .eq('id', claim_id)
      .maybeSingle()

    if (claimError || !claim) {
      return NextResponse.json({ success: false, error: 'Claim not found' }, { status: 404 })
    }

    // Update the claim
    const updateData: any = {
      claim_status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || null,
    }

    if (claim_status === 'paid') {
      updateData.paid_at = new Date().toISOString()
      updateData.payment_reference = payment_reference || null
    }

    const { data: updatedClaim, error: updateError } = await supabase
      .from('incentive_claims')
      .update(updateData)
      .eq('id', claim_id)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating claim', updateError)
      throw updateError
    }

    logger.info(`Claim ${claim_id} updated to ${claim_status} by ${user.id}`)

    return NextResponse.json({
      success: true,
      data: updatedClaim,
      message: `Claim ${claim_status} successfully`,
    })
  } catch (error) {
    logger.error('Error in PATCH /api/incentives/claim', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'reviewClaim' })
    return NextResponse.json({ success: false, error: 'Failed to update claim' }, { status: 500 })
  }
}
