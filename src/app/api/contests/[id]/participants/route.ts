
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import { sanitizeUuid, sanitizeEnum, sanitizePaginationParams } from '@/lib/security/sanitization'

/**
 * GET /api/contests/:id/participants
 * Get all participants for a contest
 * Access: Users with PARTICIPANT_VIEW permission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Sanitize and validate ID
    const { id } = params
    try {
      sanitizeUuid(id)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid contest ID format' },
        { status: 400 }
      )
    }

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.PARTICIPANT_VIEW)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    // Parse and sanitize query parameters
    const { searchParams } = new URL(request.url)
    const { limit, offset } = sanitizePaginationParams(
      searchParams.get('limit'),
      searchParams.get('offset')
    )

    let status: string | undefined
    if (searchParams.get('status')) {
      try {
        status = sanitizeEnum(
          searchParams.get('status')!,
          ['eligible', 'participating', 'disqualified', 'winner', 'completed'],
          'Status'
        )
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid status value' },
          { status: 400 }
        )
      }
    }

    const adminSupabase = createSupabaseAdmin()

    // Build query
    let query = adminSupabase
      .from('contest_participants')
      .select(`
        *,
        partner:auth.users!contest_participants_partner_id_fkey (
          id,
          email
        )
      `, { count: 'exact' })
      .eq('contest_id', id)
      .order('current_rank', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1)

    // Apply status filter
    if (status) {
      query = query.eq('participation_status', status)
    }

    const { data: participants, error, count } = await query

    if (error) {
      logger.error(`Error fetching participants for contest ${id}`, error)
      throw new Error(`Failed to fetch participants: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: participants || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    logger.error('Error in GET /api/contests/:id/participants', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchParticipants' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to fetch participants',
      message: errorMessage,
    }, { status: 500 })
  }
}

/**
 * POST /api/contests/:id/participants
 * Add participants to a contest manually
 * Access: Users with PARTICIPANT_ADD permission
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Sanitize and validate ID
    const { id } = params
    try {
      sanitizeUuid(id)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid contest ID format' },
        { status: 400 }
      )
    }

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.PARTICIPANT_ADD)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { partner_ids } = body // Array of partner user IDs

    // Validate input
    if (!partner_ids || !Array.isArray(partner_ids) || partner_ids.length === 0) {
      return NextResponse.json(
        { error: 'partner_ids array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (partner_ids.length > 100) {
      return NextResponse.json(
        { error: 'Cannot add more than 100 participants at once' },
        { status: 400 }
      )
    }

    // Validate all UUIDs
    for (const partnerId of partner_ids) {
      try {
        sanitizeUuid(partnerId)
      } catch (error) {
        return NextResponse.json(
          { error: `Invalid partner ID format: ${partnerId}` },
          { status: 400 }
        )
      }
    }

    const adminSupabase = createSupabaseAdmin()

    // Check if contest exists
    const { data: contest, error: contestError } = await adminSupabase
      .from('contests')
      .select('id, contest_title, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (contestError || !contest) {
      return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
    }

    // Create participant records
    const participants = partner_ids.map((partner_id: string) => ({
      contest_id: id,
      partner_id,
      is_eligible: true,
      eligibility_checked_at: new Date().toISOString(),
      enrollment_type: 'manual',
      participation_status: contest.status === 'active' ? 'participating' : 'eligible',
      current_score: 0,
      progress_percentage: 0,
      joined_at: new Date().toISOString(),
    }))

    // Insert participants (on conflict, do nothing)
    const { data: insertedParticipants, error: insertError } = await adminSupabase
      .from('contest_participants')
      .upsert(participants, { onConflict: 'contest_id,partner_id', ignoreDuplicates: true })
      .select()

    if (insertError) {
      logger.error(`Error adding participants to contest ${id}`, insertError)
      throw new Error(`Failed to add participants: ${insertError.message}`)
    }

    // Log audit event
    const { logContestAction, ContestAuditAction, getClientIp, getUserAgent } = await import('@/lib/audit/contest-audit')
    await logContestAction({
      contest_id: id,
      action: ContestAuditAction.PARTICIPANT_ADDED,
      changed_by: user.id,
      metadata: {
        contest_title: contest.contest_title,
        participants_added: insertedParticipants?.length || 0,
        partner_ids: partner_ids,
      },
      ip_address: getClientIp(request),
      user_agent: getUserAgent(request),
    })

    logger.info(`Added ${insertedParticipants?.length || 0} participants to contest ${id} by ${user.id}`)

    return NextResponse.json({
      success: true,
      data: insertedParticipants,
      message: `Successfully added ${insertedParticipants?.length || 0} participants`,
    })
  } catch (error) {
    logger.error('Error in POST /api/contests/:id/participants', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'addParticipants' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to add participants',
      message: errorMessage,
    }, { status: 500 })
  }
}
