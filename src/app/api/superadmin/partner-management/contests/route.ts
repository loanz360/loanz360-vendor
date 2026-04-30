import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import logger from '@/lib/monitoring/logger'


/**
 * GET /api/superadmin/partner-management/contests
 * Fetch contests with leaderboard data
 *
 * Rate Limit: 60 requests per minute
 *
 * Query Parameters:
 * - partner_type: BUSINESS_ASSOCIATE | BUSINESS_PARTNER | CHANNEL_PARTNER
 * - status: draft | active | completed | cancelled
 * - month: YYYY-MM format
 * - state: State name
 */
export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getContestsHandler(req)
  })
}

async function getContestsHandler(request: NextRequest) {
  try {
    // Use unified auth to support both Supabase Auth and Super Admin sessions
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams

    const partnerType = searchParams.get('partner_type')
    const status = searchParams.get('status')
    const month = searchParams.get('month')
    const state = searchParams.get('state')

    // Use admin client for database queries
    const supabase = createSupabaseAdmin()

    // Build query for contests
    let query = supabase
      .from('partner_contests')
      .select('*')

    if (partnerType) {
      query = query.eq('target_partner_type', partnerType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (month) {
      const startDate = new Date(month + '-01')
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)

      query = query
        .gte('start_date', startDate.toISOString().split('T')[0])
        .lt('start_date', endDate.toISOString().split('T')[0])
    }

    if (state) {
      query = query.contains('target_geography_states', [state])
    }

    query = query.order('start_date', { ascending: false })

    const { data: contests, error: contestsError } = await query

    if (contestsError) {
      logger.error('Contests query error', { error: contestsError })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contests' },
        { status: 500 }
      )
    }

    // Fix N+1 query: Fetch all participants in a single query instead of one query per contest
    let allParticipants: unknown[] = []
    if (contests && contests.length > 0) {
      const contestIds = contests.map((c: unknown) => c.id)

      const { data: participantsData, error: participantsError } = await supabase
        .from('partner_contest_participants')
        .select('*')
        .in('contest_id', contestIds)
        .order('rank', { ascending: true })

      if (participantsError) {
        logger.error('Participants query error', { error: participantsError })
        // Continue without participants rather than failing entirely
        allParticipants = []
      } else {
        allParticipants = participantsData || []
      }
    }

    // Group participants by contest_id for efficient lookup
    const participantsByContest = allParticipants.reduce((acc: unknown, participant: unknown) => {
      if (!acc[participant.contest_id]) {
        acc[participant.contest_id] = []
      }
      // Limit to top 50 per contest
      if (acc[participant.contest_id].length < 50) {
        acc[participant.contest_id].push(participant)
      }
      return acc
    }, {})

    // Map contests with their leaderboard data
    const contestsWithLeaderboard = contests?.map((contest: unknown) => {
      const participants = participantsByContest[contest.id] || []

      return {
        id: contest.id,
        contest_id: contest.contest_id,
        title: contest.title,
        description: contest.description,
        image_url: contest.image_url,
        target_partner_type: contest.target_partner_type,
        target_geography_states: contest.target_geography_states,
        target_geography_cities: contest.target_geography_cities,
        start_date: contest.start_date,
        end_date: contest.end_date,
        contest_metrics: contest.contest_metrics,
        rules: contest.rules,
        terms_conditions: contest.terms_conditions,
        prizes: contest.prizes,
        total_prize_pool: parseFloat(contest.total_prize_pool || 0).toFixed(2),
        status: contest.status,
        total_participants: contest.total_participants || 0,
        created_at: contest.created_at,
        leaderboard: participants.map((p: unknown) => ({
          rank: p.rank,
          partner_id: p.partner_id,
          partner_name: p.partner_name,
          partner_type: p.partner_type,
          score: parseFloat(p.score || 0).toFixed(2),
          achievement_percentage: parseFloat(p.achievement_percentage || 0).toFixed(2),
          milestones_achieved: p.milestones_achieved || 0,
          prize_won: p.prize_won,
          prize_amount: p.prize_amount ? parseFloat(p.prize_amount).toFixed(2) : null,
          performance_data: p.performance_data
        }))
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        contests: contestsWithLeaderboard,
        total_contests: contestsWithLeaderboard.length
      },
      filters: {
        partner_type: partnerType,
        status,
        month,
        state
      }
    })

  } catch (error) {
    logger.error('Contests API error', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/partner-management/contests
 * Create a new contest
 *
 * Rate Limit: 30 requests per minute
 */
export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await createContestHandler(req)
  })
}

async function createContestHandler(request: NextRequest) {
  try {
    // Use unified auth to support both Supabase Auth and Super Admin sessions
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      title: z.string().optional(),


      description: z.string().optional(),


      target_partner_type: z.string().optional(),


      start_date: z.string().optional(),


      end_date: z.string().optional(),


      contest_metrics: z.string().optional(),


      prizes: z.string().optional(),


      total_prize_pool: z.string().optional(),


      image_url: z.string().optional(),


      target_geography_states: z.string().optional(),


      target_geography_cities: z.string().optional(),


      rules: z.string().optional(),


      terms_conditions: z.string().optional(),


      status: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Use admin client for database queries
    const supabase = createSupabaseAdmin()

    // Validate required fields
    const {
      title,
      description,
      target_partner_type,
      start_date,
      end_date,
      contest_metrics,
      prizes,
      total_prize_pool
    } = body

    if (!title || !target_partner_type || !start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate contest ID
    const { data: existingContests } = await supabase
      .from('partner_contests')
      .select('contest_id')
      .order('created_at', { ascending: false })
      .limit(1)

    let contestNumber = 1
    if (existingContests && existingContests.length > 0) {
      const lastId = existingContests[0].contest_id
      const match = lastId.match(/CNT(\d+)/)
      if (match) {
        contestNumber = parseInt(match[1]) + 1
      }
    }

    const contest_id = `CNT${contestNumber.toString().padStart(4, '0')}`

    // Create contest
    const { data: newContest, error: insertError } = await supabase
      .from('partner_contests')
      .insert({
        contest_id,
        title,
        description,
        image_url: body.image_url,
        target_partner_type,
        target_geography_states: body.target_geography_states || [],
        target_geography_cities: body.target_geography_cities || [],
        start_date,
        end_date,
        contest_metrics,
        rules: body.rules,
        terms_conditions: body.terms_conditions,
        prizes,
        total_prize_pool,
        status: body.status || 'draft',
        created_by: auth.userId
      })
      .select()
      .maybeSingle()

    if (insertError) {
      logger.error('Contest insert error', { error: insertError })
      return NextResponse.json(
        { success: false, error: 'Failed to create contest' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contest created successfully',
      data: newContest
    }, { status: 201 })

  } catch (error) {
    logger.error('Create contest API error', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
