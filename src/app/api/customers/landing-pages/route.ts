
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { logger } from '@/lib/utils/logger'

type PageType = 'MY_PROFILE' | 'ADD_PROFILE'
type ActionType = 'VIEWED' | 'SKIPPED' | 'PROCEEDED'

interface LandingPageRequest {
  page_type: PageType
  action: ActionType
}

/**
 * POST /api/customers/landing-pages
 * Track landing page views and actions
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || !auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: LandingPageRequest = await request.json()
    const { page_type, action } = body

    // Validate page_type
    if (!page_type || !['MY_PROFILE', 'ADD_PROFILE'].includes(page_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid page_type. Must be MY_PROFILE or ADD_PROFILE' },
        { status: 400 }
      )
    }

    // Validate action
    if (!action || !['VIEWED', 'SKIPPED', 'PROCEEDED'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be VIEWED, SKIPPED, or PROCEEDED' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if landing_page_views table exists
    // If it doesn't exist, we'll just log and return success (table creation is optional)
    try {
      const { error: insertError } = await supabase
        .from('landing_page_views')
        .insert({
          user_id: auth.userId,
          page_type,
          action
        })

      if (insertError) {
        // Table might not exist - log but don't fail
        logger.debug('Could not insert landing page view (table may not exist)', {
          context: 'landing-pages-POST',
          error: insertError.message,
          userId: auth.userId,
          page_type,
          action
        })
      }
    } catch (dbError) {
      // Table doesn't exist - log but don't fail
      logger.debug('Landing page tracking skipped (table not available)', {
        context: 'landing-pages-POST',
        userId: auth.userId,
        page_type,
        action
      })
    }

    // Log the action for analytics (even if DB insert fails)
    logger.info('Landing page action tracked', {
      context: 'landing-pages-POST',
      userId: auth.userId,
      page_type,
      action
    })

    return NextResponse.json({
      success: true,
      message: 'Landing page action tracked'
    })
  } catch (error) {
    logger.error('Error tracking landing page action', error instanceof Error ? error : undefined, {
      context: 'landing-pages-POST'
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/customers/landing-pages
 * Get landing page stats for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || !auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Get user's landing page views
    const { data, error } = await supabase
      .from('landing_page_views')
      .select('page_type, action, created_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })

    if (error) {
      // Table might not exist
      logger.debug('Could not fetch landing page views (table may not exist)', {
        context: 'landing-pages-GET',
        error: 'Internal server error',
        userId: auth.userId
      })

      return NextResponse.json({
        success: true,
        data: {
          my_profile: { viewed: false, skipped: false, proceeded: false },
          add_profile: { viewed: false, skipped: false, proceeded: false }
        }
      })
    }

    // Process data to determine status for each page
    const myProfileViews = data?.filter(v => v.page_type === 'MY_PROFILE') || []
    const addProfileViews = data?.filter(v => v.page_type === 'ADD_PROFILE') || []

    const result = {
      my_profile: {
        viewed: myProfileViews.some(v => v.action === 'VIEWED'),
        skipped: myProfileViews.some(v => v.action === 'SKIPPED'),
        proceeded: myProfileViews.some(v => v.action === 'PROCEEDED'),
        last_action: myProfileViews[0]?.action || null,
        last_action_at: myProfileViews[0]?.created_at || null
      },
      add_profile: {
        viewed: addProfileViews.some(v => v.action === 'VIEWED'),
        skipped: addProfileViews.some(v => v.action === 'SKIPPED'),
        proceeded: addProfileViews.some(v => v.action === 'PROCEEDED'),
        last_action: addProfileViews[0]?.action || null,
        last_action_at: addProfileViews[0]?.created_at || null
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('Error fetching landing page stats', error instanceof Error ? error : undefined, {
      context: 'landing-pages-GET'
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
