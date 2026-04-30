import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * Lead Deduplication API
 * Provides endpoints for detecting and managing duplicate leads
 *
 * Rate Limits:
 * - GET: 60 requests per minute (read operation)
 * - POST: 30 requests per minute (write operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/admin/leads/duplicates
 * Get list of all detected duplicate leads
 */
export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getDuplicatesHandler(req)
  })
}

async function getDuplicatesHandler(request: NextRequest) {
  try {
    // Verify Super Admin (FIXED: Unified Auth)
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Super Admin access required.' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const minConfidence = parseFloat(searchParams.get('min_confidence') || '0.8')
    const actionFilter = searchParams.get('action') || null

    // Call database function to get duplicate report
    const { data: duplicates, error } = await supabase.rpc('get_duplicate_report', {
      p_min_confidence: minConfidence,
      p_action_filter: actionFilter
    })

    if (error) {
      apiLogger.error('Error fetching duplicates', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch duplicates' },
        { status: 500 }
      )
    }

    // Group by confidence level
    const grouped = {
      high_confidence: duplicates?.filter((d: Record<string, unknown>) => d.confidence >= 0.95) || [],
      medium_confidence: duplicates?.filter((d: Record<string, unknown>) => d.confidence >= 0.8 && d.confidence < 0.95) || [],
      low_confidence: duplicates?.filter((d: Record<string, unknown>) => d.confidence < 0.8) || [],
    }

    return NextResponse.json({
      success: true,
      data: {
        total: duplicates?.length || 0,
        pending: duplicates?.filter((d: Record<string, unknown>) => d.action_taken === 'flagged').length || 0,
        resolved: duplicates?.filter((d: Record<string, unknown>) => d.action_taken !== 'flagged').length || 0,
        grouped,
        all: duplicates || []
      }
    })

  } catch (error: unknown) {
    apiLogger.error('[Duplicates API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/leads/duplicates/check
 * Check if a specific lead has duplicates
 */
export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await checkDuplicatesHandler(req)
  })
}

async function checkDuplicatesHandler(request: NextRequest) {
  try {
    // Verify authentication (FIXED: Unified Auth)
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = createSupabaseAdmin()

    const bodySchema = z.object({


      customer_name: z.string().optional(),


      customer_mobile: z.string().optional(),


      customer_email: z.string().email().optional(),


      exclude_system: z.string().optional(),


      exclude_lead_id: z.string().uuid().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { customer_name, customer_mobile, customer_email, exclude_system, exclude_lead_id } = body

    if (!customer_name && !customer_mobile && !customer_email) {
      return NextResponse.json(
        { success: false, error: 'At least one search criteria required' },
        { status: 400 }
      )
    }

    // Call database function to find duplicates
    const { data: duplicates, error } = await supabase.rpc('find_duplicate_leads', {
      p_customer_name: customer_name || null,
      p_customer_mobile: customer_mobile || null,
      p_customer_email: customer_email || null,
      p_exclude_system: exclude_system || null,
      p_exclude_lead_id: exclude_lead_id || null
    })

    if (error) {
      apiLogger.error('Error checking duplicates', error)
      return NextResponse.json(
        { success: false, error: 'Failed to check duplicates' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      has_duplicates: (duplicates?.length || 0) > 0,
      count: duplicates?.length || 0,
      duplicates: duplicates || [],
      warning: (duplicates?.length || 0) > 0 ?
        `Found ${duplicates?.length} potential duplicate(s). Please review before proceeding.` :
        null
    })

  } catch (error: unknown) {
    apiLogger.error('[Duplicate Check API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
