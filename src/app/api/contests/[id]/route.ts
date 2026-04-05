export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import { sanitizeUuid } from '@/lib/security/sanitization'

/**
 * Normalize contest data to handle both old and new schema formats
 */
function normalizeContestData(contest: any): any {
  const statusMap: Record<string, string> = {
    'completed': 'expired',
    'active': 'active',
    'scheduled': 'scheduled',
  }

  return {
    ...contest,
    contest_title: contest.contest_title || contest.title || 'Untitled Contest',
    contest_description: contest.contest_description || contest.description || null,
    contest_image_url: contest.contest_image_url || contest.banner_url || null,
    contest_type: contest.contest_type || 'performance',
    target_category: contest.target_category || 'partner',
    target_all_partners: contest.target_all_partners ?? true,
    status: statusMap[contest.status] || contest.status || 'draft',
    winner_count: contest.winner_count || 1,
    enable_leaderboard: contest.enable_leaderboard ?? true,
    is_active: contest.is_active ?? true,
  }
}

/**
 * GET /api/contests/:id
 * Get contest details by ID
 * Access: Authenticated users with CONTEST_READ permission
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

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.CONTEST_READ)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
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

    // Fetch contest with related data
    const { data: contest, error } = await supabase
      .from('contests')
      .select(`
        *,
        contest_target_audience (
          id,
          subrole:contest_partner_subroles (
            id,
            subrole_code,
            subrole_name
          )
        ),
        contest_geography_filters (
          id,
          geography_type,
          state_id,
          city_id,
          custom_region_name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      logger.error(`Error fetching contest ${id}`, error)

      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
      }

      // Handle schema mismatch errors gracefully
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        // Try fetching with basic query
        const { data: basicContest, error: basicError } = await supabase
          .from('contests')
          .select('*')
          .eq('id', id)
          .maybeSingle()

        if (basicError || !basicContest) {
          return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          data: normalizeContestData(basicContest),
          warning: 'Database schema needs to be updated. Some features may be limited.',
        })
      }

      throw error
    }

    // Normalize the data to handle both old and new schema formats
    return NextResponse.json({
      success: true,
      data: normalizeContestData(contest),
    })
  } catch (error) {
    logger.error('Error in GET /api/contests/:id', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchContest' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to fetch contest',
      message: errorMessage,
    }, { status: 500 })
  }
}

/**
 * PATCH /api/contests/:id
 * Update contest details
 * Access: Users with CONTEST_UPDATE permission
 */
export async function PATCH(
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

    // Get current contest to check status and for audit log
    const adminSupabase = createSupabaseAdmin()
    const { data: existingContest, error: fetchError } = await adminSupabase
      .from('contests')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !existingContest) {
      return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
    }

    // Check permission based on contest status
    const isActive = existingContest.status === 'active'
    const requiredPermission = isActive
      ? Permission.CONTEST_EDIT_ACTIVE
      : Permission.CONTEST_UPDATE

    const permissionCheck = await requirePermission(user.id, requiredPermission)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: isActive
            ? 'You do not have permission to edit active contests'
            : permissionCheck.error,
        },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Sanitize and validate updatable fields
    const {
      sanitizeContestTitle,
      sanitizeContestDescription,
      sanitizeContestRules,
      sanitizeUrl,
      sanitizeEnum,
      sanitizeDate,
      sanitizeInteger,
      sanitizeBoolean,
      sanitizeJson,
    } = await import('@/lib/security/sanitization')

    const updateData: any = {
      updated_by: user.id,
    }

    try {
      // Sanitize each field if provided
      if (body.contest_title !== undefined) {
        updateData.contest_title = sanitizeContestTitle(body.contest_title)
      }

      if (body.contest_description !== undefined) {
        updateData.contest_description = sanitizeContestDescription(body.contest_description)
      }

      if (body.contest_rules !== undefined) {
        updateData.contest_rules = sanitizeContestRules(body.contest_rules)
      }

      if (body.contest_image_url !== undefined) {
        updateData.contest_image_url = body.contest_image_url ? sanitizeUrl(body.contest_image_url) : null
      }

      if (body.contest_type !== undefined) {
        updateData.contest_type = sanitizeEnum(
          body.contest_type,
          ['performance', 'sales', 'engagement', 'custom'],
          'Contest type'
        )
      }

      if (body.start_date !== undefined) {
        updateData.start_date = sanitizeDate(body.start_date)
      }

      if (body.end_date !== undefined) {
        updateData.end_date = sanitizeDate(body.end_date)
      }

      // Validate date range if both provided
      if (updateData.start_date && updateData.end_date) {
        if (new Date(updateData.end_date) <= new Date(updateData.start_date)) {
          return NextResponse.json(
            { error: 'End date must be after start date' },
            { status: 400 }
          )
        }
      }

      if (body.evaluation_criteria !== undefined) {
        updateData.evaluation_criteria = sanitizeJson(body.evaluation_criteria)
      }

      if (body.evaluation_frequency !== undefined) {
        updateData.evaluation_frequency = sanitizeEnum(
          body.evaluation_frequency,
          ['realtime', 'hourly', 'daily'],
          'Evaluation frequency'
        )
      }

      if (body.auto_evaluate !== undefined) {
        updateData.auto_evaluate = sanitizeBoolean(body.auto_evaluate)
      }

      if (body.reward_details !== undefined) {
        updateData.reward_details = sanitizeJson(body.reward_details)
      }

      if (body.winner_count !== undefined) {
        updateData.winner_count = sanitizeInteger(body.winner_count, 1, 1000)
      }

      if (body.reward_tiers !== undefined) {
        updateData.reward_tiers = sanitizeJson(body.reward_tiers)
      }

      if (body.enable_leaderboard !== undefined) {
        updateData.enable_leaderboard = sanitizeBoolean(body.enable_leaderboard)
      }

      if (body.leaderboard_visibility !== undefined) {
        updateData.leaderboard_visibility = sanitizeEnum(
          body.leaderboard_visibility,
          ['public', 'private', 'rank_only'],
          'Leaderboard visibility'
        )
      }

      if (body.show_scores !== undefined) {
        updateData.show_scores = sanitizeBoolean(body.show_scores)
      }

      if (body.notification_enabled !== undefined) {
        updateData.notification_enabled = sanitizeBoolean(body.notification_enabled)
      }

      if (body.status !== undefined) {
        updateData.status = sanitizeEnum(
          body.status,
          ['draft', 'scheduled', 'active', 'expired', 'disabled'],
          'Status'
        )
      }

      if (body.is_active !== undefined) {
        updateData.is_active = sanitizeBoolean(body.is_active)
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Validation error',
        },
        { status: 400 }
      )
    }

    // Update contest in database
    const { data: contest, error: updateError } = await adminSupabase
      .from('contests')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error(`Error updating contest ${id}`, updateError)

      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
      }

      throw new Error(`Failed to update contest: ${updateError.message}`)
    }

    // Update target audiences if provided
    if (body.target_subroles !== undefined) {
      const target_subroles = body.target_subroles

      // Delete existing audiences
      await adminSupabase
        .from('contest_target_audience')
        .delete()
        .eq('contest_id', id)

      // Insert new audiences
      if (Array.isArray(target_subroles) && target_subroles.length > 0) {
        const targetAudiences = target_subroles.map((subrole_id: string) => ({
          contest_id: id,
          subrole_id,
        }))

        await adminSupabase
          .from('contest_target_audience')
          .insert(targetAudiences)
      }
    }

    // Update geography filters if provided
    if (body.geography_filters !== undefined) {
      const geography_filters = body.geography_filters

      // Delete existing filters
      await adminSupabase
        .from('contest_geography_filters')
        .delete()
        .eq('contest_id', id)

      // Insert new filters
      if (Array.isArray(geography_filters) && geography_filters.length > 0) {
        const geoFilters = geography_filters.map((filter: any) => ({
          contest_id: id,
          geography_type: filter.geography_type,
          state_id: filter.state_id || null,
          city_id: filter.city_id || null,
          custom_region_name: filter.custom_region_name || null,
        }))

        await adminSupabase
          .from('contest_geography_filters')
          .insert(geoFilters)
      }
    }

    // Log audit event
    const { logContestUpdated, getClientIp, getUserAgent } = await import('@/lib/audit/contest-audit')
    await logContestUpdated(
      id,
      user.id,
      existingContest,
      { ...existingContest, ...updateData },
      {
        ip: getClientIp(request),
        userAgent: getUserAgent(request),
      }
    )

    // Log status change if status was updated
    if (updateData.status && updateData.status !== existingContest.status) {
      const { logContestStatusChanged } = await import('@/lib/audit/contest-audit')
      await logContestStatusChanged(
        id,
        user.id,
        existingContest.status,
        updateData.status,
        {
          ip: getClientIp(request),
          userAgent: getUserAgent(request),
        }
      )
    }

    logger.info(`Contest updated: ${id} by ${user.id}`)

    return NextResponse.json({
      success: true,
      data: contest,
      message: 'Contest updated successfully',
    })
  } catch (error) {
    logger.error('Error in PATCH /api/contests/:id', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'updateContest' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to update contest',
      message: errorMessage,
    }, { status: 500 })
  }
}

/**
 * DELETE /api/contests/:id
 * Soft delete a contest (marks as deleted, doesn't remove from database)
 * Access: Users with CONTEST_DELETE permission (Super Admin only by default)
 */
export async function DELETE(
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
    const permissionCheck = await requirePermission(user.id, Permission.CONTEST_DELETE)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    const adminSupabase = createSupabaseAdmin()

    // Check if contest exists and not already deleted
    const { data: contest, error: fetchError } = await adminSupabase
      .from('contests')
      .select('id, contest_title, status, is_active, deleted_at')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !contest) {
      return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
    }

    if (contest.deleted_at) {
      return NextResponse.json(
        { error: 'Contest already deleted' },
        { status: 400 }
      )
    }

    // Prevent deletion of active contests
    if (contest.status === 'active' && contest.is_active) {
      return NextResponse.json(
        { error: 'Cannot delete active contest. Please disable it first.' },
        { status: 400 }
      )
    }

    // Soft delete: Mark as deleted instead of removing from database
    const { error: deleteError } = await adminSupabase
      .from('contests')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        is_active: false,
      })
      .eq('id', id)

    if (deleteError) {
      logger.error(`Error deleting contest ${id}`, deleteError)
      throw new Error(`Failed to delete contest: ${deleteError.message}`)
    }

    // Log audit event
    const { logContestDeleted, getClientIp, getUserAgent } = await import('@/lib/audit/contest-audit')
    await logContestDeleted(
      id,
      user.id,
      contest.contest_title,
      {
        ip: getClientIp(request),
        userAgent: getUserAgent(request),
      }
    )

    logger.info(`Contest soft deleted: ${id} by ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Contest deleted successfully',
    })
  } catch (error) {
    logger.error('Error in DELETE /api/contests/:id', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'deleteContest' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to delete contest',
      message: errorMessage,
    }, { status: 500 })
  }
}
