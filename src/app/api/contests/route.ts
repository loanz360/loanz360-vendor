
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission, isPartner } from '@/lib/auth/rbac'
import {
  sanitizeEnum,
  sanitizePaginationParams,
} from '@/lib/security/sanitization'

/**
 * Normalize contest data to handle both old and new schema formats
 * Old schema: title, description, applicable_roles, banner_url, status (active/completed/scheduled)
 * New schema: contest_title, contest_description, contest_type, contest_image_url, status (draft/scheduled/active/expired/disabled)
 */
function normalizeContestData(contest: any): any {
  // Map old status values to new values
  const statusMap: Record<string, string> = {
    'completed': 'expired',
    'active': 'active',
    'scheduled': 'scheduled',
  }

  // Use new field names, falling back to old ones
  return {
    id: contest.id,
    contest_title: contest.contest_title || contest.title || 'Untitled Contest',
    contest_description: contest.contest_description || contest.description || null,
    contest_image_url: contest.contest_image_url || contest.banner_url || null,
    contest_type: contest.contest_type || 'performance',
    target_category: contest.target_category || 'partner',
    target_all_partners: contest.target_all_partners ?? true,
    start_date: contest.start_date,
    end_date: contest.end_date,
    status: statusMap[contest.status] || contest.status || 'draft',
    winner_count: contest.winner_count || 1,
    enable_leaderboard: contest.enable_leaderboard ?? true,
    created_at: contest.created_at,
    updated_at: contest.updated_at,
    // Include original fields for backward compatibility
    title: contest.title || contest.contest_title,
    description: contest.description || contest.contest_description,
    banner_url: contest.banner_url || contest.contest_image_url,
    rewards: contest.rewards || (contest.reward_details ? JSON.stringify(contest.reward_details) : null),
    applicable_roles: contest.applicable_roles || [],
    // Additional new schema fields
    evaluation_criteria: contest.evaluation_criteria,
    reward_details: contest.reward_details,
    reward_tiers: contest.reward_tiers,
    is_active: contest.is_active ?? true,
  }
}

/**
 * GET /api/contests
 * Fetch all contests with optional filters
 * Access: Authenticated users with CONTEST_READ permission
 */
export async function GET(request: NextRequest) {
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

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.CONTEST_READ)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    // Parse and sanitize query parameters
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const typeParam = searchParams.get('type')
    const categoryParam = searchParams.get('category')

    // Sanitize pagination
    const { limit, offset } = sanitizePaginationParams(
      searchParams.get('limit'),
      searchParams.get('offset')
    )

    // Sanitize enum values if provided
    // Support both old and new status values
    let status: string | undefined
    if (statusParam) {
      try {
        // Map old status values to new ones for filtering
        const statusInput = statusParam === 'completed' ? 'expired' : statusParam
        status = sanitizeEnum(
          statusInput,
          ['draft', 'scheduled', 'active', 'expired', 'disabled', 'completed'],
          'Status'
        )
        // Convert 'completed' back to query both old and new format
        if (status === 'completed') status = 'expired'
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid status value' },
          { status: 400 }
        )
      }
    }

    let contestType: string | undefined
    if (typeParam) {
      try {
        contestType = sanitizeEnum(
          typeParam,
          ['performance', 'sales', 'engagement', 'custom'],
          'Contest type'
        )
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid contest type value' },
          { status: 400 }
        )
      }
    }

    const category = categoryParam || undefined

    // Check if user is partner - partners should only see eligible contests
    const userIsPartner = await isPartner(user.id)

    // Build query with proper filters
    let query = supabase
      .from('contests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Partners should only see published contests (not drafts)
    // Support both old ('active', 'completed', 'scheduled') and new status values
    if (userIsPartner) {
      query = query.in('status', ['scheduled', 'active', 'expired', 'completed'])
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (contestType) {
      query = query.eq('contest_type', contestType)
    }

    if (category) {
      query = query.eq('target_category', category)
    }

    const { data: contests, error, count } = await query

    if (error) {
      logger.error('Error fetching contests', error)

      // Check if it's a table not found error
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return NextResponse.json({ success: false, error: 'Database tables not found',
          message: 'The contest tables have not been created yet. Please run the database migration first.',
          details: 'See CONTEST_MANAGEMENT_MIGRATION.sql or 20260102_contest_schema_unification.sql for migration instructions',
        }, { status: 500 })
      }

      // Check if it's a column not found error (schema mismatch)
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        logger.warn('Schema mismatch detected, running with available columns')
        // Return empty array with helpful message
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
          warning: 'Database schema needs to be updated. Please run the 20260102_contest_schema_unification.sql migration.',
        })
      }

      throw error
    }

    // Normalize the data to handle both old and new schema formats
    const normalizedContests = (contests || []).map(normalizeContestData)

    return NextResponse.json({
      success: true,
      data: normalizedContests,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    logger.error('Error in GET /api/contests', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchContests' })

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch contests'

    return NextResponse.json({ success: false, error: 'Failed to fetch contests',
      message: errorMessage,
      hint: 'Check if database migration has been run and tables exist'
    }, { status: 500 })
  }
}

/**
 * POST /api/contests
 * Create a new contest
 * Access: Users with CONTEST_CREATE permission
 */
export async function POST(request: NextRequest) {
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

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.CONTEST_CREATE)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    // Parse and sanitize request body
    const body = await request.json()

    let sanitizedData
    try {
      const { sanitizeContestData } = await import('@/lib/security/sanitization')
      sanitizedData = sanitizeContestData(body)
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Validation error',
        },
        { status: 400 }
      )
    }

    const {
      contest_title,
      contest_description,
      contest_image_url,
      contest_rules,
      contest_type,
      target_category,
      target_all_partners,
      start_date,
      end_date,
      evaluation_criteria,
      evaluation_frequency,
      auto_evaluate,
      reward_details,
      winner_count,
      reward_tiers,
      enable_leaderboard,
      leaderboard_visibility,
      show_scores,
      notification_enabled,
      status,
    } = sanitizedData

    // Parse additional fields
    const target_subroles = body.target_subroles || []
    const geography_filters = body.geography_filters || []

    // Additional validation
    if (!target_all_partners && target_subroles.length === 0) {
      return NextResponse.json(
        { error: 'Either target_all_partners must be true or target_subroles must be provided' },
        { status: 400 }
      )
    }

    // Use admin client for insertions (temporary until RLS is properly configured)
    const adminSupabase = createSupabaseAdmin()

    // Import audit utilities
    const { logContestCreated, getClientIp, getUserAgent } = await import('@/lib/audit/contest-audit')

    let contest: any = null

    try {
      // Step 1: Insert contest
      const { data: contestData, error: insertError } = await adminSupabase
        .from('contests')
        .insert({
          contest_title,
          contest_description,
          contest_image_url,
          contest_rules,
          contest_type,
          target_category,
          target_all_partners,
          start_date,
          end_date,
          evaluation_criteria,
          evaluation_frequency,
          auto_evaluate,
          reward_details,
          winner_count,
          reward_tiers,
          enable_leaderboard,
          leaderboard_visibility,
          show_scores,
          notification_enabled,
          status,
          is_active: true,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .maybeSingle()

      if (insertError) {
        logger.error('Error inserting contest', insertError)
        throw new Error(`Failed to create contest: ${insertError.message}`)
      }

      contest = contestData

      // Step 2: Insert target audiences if not targeting all partners
      if (!target_all_partners && target_subroles.length > 0) {
        const targetAudiences = target_subroles.map((subrole_id: string) => ({
          contest_id: contest.id,
          subrole_id,
        }))

        const { error: audienceError } = await adminSupabase
          .from('contest_target_audience')
          .insert(targetAudiences)

        if (audienceError) {
          logger.error('Error inserting target audiences', audienceError)
          throw new Error(`Failed to set target audiences: ${audienceError.message}`)
        }
      }

      // Step 3: Insert geography filters if provided
      if (geography_filters.length > 0) {
        const geoFilters = geography_filters.map((filter: any) => ({
          contest_id: contest.id,
          geography_type: filter.geography_type,
          state_id: filter.state_id || null,
          city_id: filter.city_id || null,
          custom_region_name: filter.custom_region_name || null,
        }))

        const { error: geoError } = await adminSupabase
          .from('contest_geography_filters')
          .insert(geoFilters)

        if (geoError) {
          logger.error('Error inserting geography filters', geoError)
          throw new Error(`Failed to set geography filters: ${geoError.message}`)
        }
      }

      // Step 4: Create participants if status is active or scheduled
      if (status === 'active' || status === 'scheduled') {
        await createContestParticipants(adminSupabase, contest.id, target_all_partners, target_subroles, target_category)
      }

      // Step 5: Initialize analytics
      const { error: analyticsError } = await adminSupabase.from('contest_analytics').insert({
        contest_id: contest.id,
        total_eligible_partners: 0,
        total_active_participants: 0,
        participation_rate: 0,
      })

      if (analyticsError) {
        logger.warn('Failed to initialize analytics', analyticsError)
        // Don't fail the whole operation for analytics
      }

      // Step 6: Log audit event
      await logContestCreated(
        contest.id,
        user.id,
        {
          contest_title,
          contest_type,
          status,
          start_date,
          end_date,
        },
        {
          ip: getClientIp(request),
          userAgent: getUserAgent(request),
        }
      )

      logger.info(`Contest created successfully: ${contest.id} by ${user.id}`)

      return NextResponse.json({
        success: true,
        data: contest,
        message: 'Contest created successfully',
      }, { status: 201 })
    } catch (error) {
      // Rollback: Delete the contest if it was created
      if (contest?.id) {
        logger.warn(`Rolling back contest creation: ${contest.id}`)
        try {
          await adminSupabase.from('contests').delete().eq('id', contest.id)
        } catch (rollbackError) {
          logger.error('Failed to rollback contest creation', rollbackError instanceof Error ? rollbackError : undefined)
        }
      }

      throw error
    }
  } catch (error) {
    logger.error('Error in POST /api/contests', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'createContest' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to create contest',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    }, { status: 500 })
  }
}

/**
 * Helper function: Create participants for eligible partners
 */
async function createContestParticipants(
  supabase: any,
  contestId: string,
  targetAllPartners: boolean,
  targetSubroles: string[],
  targetCategory: string
) {
  try {
    let eligiblePartners: any[] = []

    // Fetch geography filters for this contest (if any)
    const { data: geoFilters } = await supabase
      .from('contest_geography_filters')
      .select('geography_type, state_id, city_id, custom_region_name')
      .eq('contest_id', contestId)

    if (targetAllPartners) {
      // Get all active partners regardless of type
      const { data: partners, error } = await supabase
        .from('partners')
        .select(`
          id,
          user_id,
          partner_type,
          status,
          users!inner (
            id,
            profiles (
              state,
              city
            )
          )
        `)
        .eq('status', 'ACTIVE')
        .limit(10000) // Safety limit for large partner bases

      if (error) {
        logger.warn('Could not fetch eligible partners', error)
        return
      }
      eligiblePartners = partners || []
    } else if (targetCategory) {
      // Map contest category to partner types
      // Categories: 'business_associate', 'business_partner', 'channel_partner', 'all'
      let partnerTypes: string[] = []

      if (targetCategory === 'all') {
        partnerTypes = ['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER']
      } else if (targetCategory === 'business_associate') {
        partnerTypes = ['BUSINESS_ASSOCIATE']
      } else if (targetCategory === 'business_partner') {
        partnerTypes = ['BUSINESS_PARTNER']
      } else if (targetCategory === 'channel_partner') {
        partnerTypes = ['CHANNEL_PARTNER']
      }

      if (partnerTypes.length > 0) {
        const { data: partners, error } = await supabase
          .from('partners')
          .select(`
            id,
            user_id,
            partner_type,
            status,
            users!inner (
              id,
              profiles (
                state,
                city
              )
            )
          `)
          .in('partner_type', partnerTypes)
          .eq('status', 'ACTIVE')
          .limit(10000)

        if (error) {
          logger.warn('Could not fetch partners by type', error)
          return
        }
        eligiblePartners = partners || []
      }
    }

    // Apply geography filters if any
    if (geoFilters && geoFilters.length > 0 && eligiblePartners.length > 0) {
      eligiblePartners = eligiblePartners.filter((partner) => {
        const profile = partner.users?.profiles
        if (!profile) return false

        // Check if partner matches any geography filter
        return geoFilters.some((filter: any) => {
          if (filter.geography_type === 'state' && filter.state_id) {
            return profile.state === filter.state_id
          } else if (filter.geography_type === 'city' && filter.city_id) {
            return profile.city === filter.city_id
          } else if (filter.geography_type === 'region') {
            // For custom regions, we'd need additional logic
            // For now, include all partners if region filter exists
            return true
          }
          return false
        })
      })
    }

    // Create participant records
    if (eligiblePartners.length > 0) {
      const participants = eligiblePartners.map((partner) => ({
        contest_id: contestId,
        partner_id: partner.user_id,
        is_eligible: true,
        eligibility_checked_at: new Date().toISOString(),
        enrollment_type: 'auto',
        participation_status: 'eligible',
        current_score: 0,
        progress_percentage: 0,
        joined_at: new Date().toISOString(),
      }))

      // Insert in batches to avoid hitting limits
      const batchSize = 500
      for (let i = 0; i < participants.length; i += batchSize) {
        const batch = participants.slice(i, i + batchSize)

        const { error: participantError } = await supabase
          .from('contest_participants')
          .upsert(batch, {
            onConflict: 'contest_id,partner_id',
            ignoreDuplicates: true,
          })

        if (participantError) {
          logger.error(`Error creating participant batch ${i / batchSize + 1}`, participantError)
          // Continue with next batch instead of failing completely
          continue
        }
      }

      logger.info(`Auto-enrolled ${participants.length} eligible partners for contest ${contestId}`)
    } else {
      logger.info(`No eligible partners found for contest ${contestId}`)
    }
  } catch (error) {
    logger.error('Error in createContestParticipants', error instanceof Error ? error : undefined)
    // Don't throw - participant creation failure shouldn't block contest creation
  }
}
