import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logger } from '@/lib/utils/logger'

// Safe JSON parse helper
function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    logger.warn('Failed to parse JSON in moderation route', { json: json?.substring(0, 100) })
    return fallback
  }
}

interface Violation {
  severity?: string
  type?: string
  message?: string
}

/**
 * GET - Get Pending Content Reviews or Check Content
 *
 * Query Parameters:
 * @param check - 'true' to check content without saving
 * @param text - Text to check (when check=true)
 * @param field - Field name (when check=true)
 * @param limit - Results per page (default: 20, max: 100)
 * @param offset - Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const check = searchParams.get('check') === 'true'
    const text = searchParams.get('text')
    const field = searchParams.get('field') || 'content'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // CHECK CONTENT MODE (no save)
    if (check && text) {
      const { data, error } = await supabase.rpc('check_content_violations', {
        p_text: text,
        p_field_name: field
      })

      if (error) throw error

      const result = data?.[0] || { has_violations: false, violations: [] }

      // Safely parse violations with proper error handling
      const parsedViolations = safeJsonParse<Violation[]>(result.violations, [])

      return NextResponse.json({
        success: true,
        has_violations: result.has_violations,
        violations: result.violations || [],
        violation_count: parsedViolations.length,
        should_block: parsedViolations.some((v: Violation) => v.severity === 'critical')
      })
    }

    // GET PENDING REVIEWS MODE
    // Only admins can view pending reviews
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData?.role || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Only admins can view pending reviews' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase.rpc('get_pending_content_reviews', {
      p_limit: limit,
      p_offset: offset
    })

    if (error) throw error

    // Get statistics
    const { data: stats } = await supabase
      .from('flagged_content')
      .select('severity, status')
      .eq('status', 'pending')

    interface StatItem {
      severity: string
      status: string
    }

    const typedStats = (stats || []) as StatItem[]
    const summary = {
      total_pending: data?.length || 0,
      critical: typedStats.filter((s) => s.severity === 'critical').length,
      high: typedStats.filter((s) => s.severity === 'high').length,
      medium: typedStats.filter((s) => s.severity === 'medium').length
    }

    return NextResponse.json({
      success: true,
      pending_reviews: data || [],
      count: data?.length || 0,
      summary,
      pagination: {
        limit,
        offset,
        has_more: (data?.length || 0) === limit
      }
    })

  } catch (error: unknown) {
    logger.error('Error in content moderation', error as Error)
    logApiError(error as Error, request, { action: 'get_moderation' })
    const errorMessage = error instanceof Error ? error.message : 'Failed to process moderation request'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * POST - Review Flagged Content or Moderate Offer
 *
 * Body for Review:
 * @param action - 'review'
 * @param flagged_id - UUID of flagged content
 * @param review_action - 'approve' | 'reject' | 'modify' | 'dismiss'
 * @param notes - Reviewer notes
 * @param modified_content - Modified content (if review_action='modify')
 *
 * Body for Moderate:
 * @param action - 'moderate'
 * @param offer_id - UUID of offer
 * @param offer_title - Title to check
 * @param description - Description to check
 * @param rolled_out_by - Bank name to check
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { action } = body

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      )
    }

    // REVIEW FLAGGED CONTENT
    if (action === 'review') {
      const { flagged_id, review_action, notes, modified_content } = body

      if (!flagged_id || !review_action) {
        return NextResponse.json(
          { error: 'flagged_id and review_action are required' },
          { status: 400 }
        )
      }

      // Check if user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (!userData?.role || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
        return NextResponse.json(
          { error: 'Only admins can review flagged content' },
          { status: 403 }
        )
      }

      // Review the content
      const { data, error } = await supabase.rpc('review_flagged_content', {
        p_flagged_id: flagged_id,
        p_reviewer_id: user.id,
        p_action: review_action,
        p_notes: notes || null,
        p_modified_content: modified_content || null
      })

      if (error) throw error

      return NextResponse.json({
        success: true,
        ...data,
        reviewer_name: userData.full_name,
        timestamp: new Date().toISOString()
      })
    }

    // MODERATE OFFER CONTENT
    if (action === 'moderate') {
      const { offer_id, offer_title, description, rolled_out_by } = body

      if (!offer_id || !offer_title) {
        return NextResponse.json(
          { error: 'offer_id and offer_title are required' },
          { status: 400 }
        )
      }

      // Moderate the content
      const { data, error } = await supabase.rpc('moderate_offer_content', {
        p_offer_id: offer_id,
        p_offer_title: offer_title,
        p_description: description || '',
        p_rolled_out_by: rolled_out_by || ''
      })

      if (error) throw error

      const result = data?.[0] || {
        has_violations: false,
        should_block: false,
        violations: [],
        flagged_count: 0,
        message: 'Content approved'
      }

      return NextResponse.json({
        success: !result.should_block,
        moderation_result: result,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json(
      { error: `Invalid action: ${action}` },
      { status: 400 }
    )

  } catch (error: unknown) {
    apiLogger.error('Error processing moderation action', error)
    logApiError(error as Error, request, { action: 'moderation_action' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update Moderation Dictionary or Rules
 * Super Admin only
 *
 * Body:
 * @param type - 'dictionary' | 'rule'
 * @param word - Word to add/update (for dictionary)
 * @param word_type - 'profanity' | 'blacklist' | 'whitelist' (for dictionary)
 * @param rule_id - Rule ID to update (for rule)
 * @param is_active - Activate/deactivate
 */
export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if user is Super Admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admins can modify moderation settings' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { type, word, word_type, severity, rule_id, is_active } = body

    if (type === 'dictionary' && word) {
      // Add/update dictionary word
      const { data, error } = await supabase
        .from('moderation_dictionary')
        .upsert({
          word: word.toLowerCase(),
          word_type: word_type || 'blacklist',
          severity: severity || 'medium',
          is_active: is_active !== false,
          created_by: user.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'word'
        })
        .select()
        .maybeSingle()

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Dictionary updated',
        word: data
      })
    }

    if (type === 'rule' && rule_id) {
      // Update rule status
      const { error } = await supabase
        .from('content_moderation_rules')
        .update({
          is_active: is_active !== false,
          updated_at: new Date().toISOString()
        })
        .eq('id', rule_id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Rule updated'
      })
    }

    return NextResponse.json(
      { error: 'Invalid parameters' },
      { status: 400 }
    )

  } catch (error: unknown) {
    apiLogger.error('Error updating moderation settings', error)
    logApiError(error as Error, request, { action: 'update_moderation_settings' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
