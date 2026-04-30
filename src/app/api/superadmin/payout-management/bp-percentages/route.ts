import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/payout-management/bp-percentages
 * Fetch all BP payout percentages with pagination and search
 *
 * FIX ISSUE #BP-3: Added unified auth verification
 * FIX ISSUE #BP-4: Added rate limiting (60 requests/min)
 * FIX ISSUE #BP-2: Added SQL injection protection
 */
export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getBPPercentagesHandler(req)
  })
}

async function getBPPercentagesHandler(request: NextRequest) {
  try {
    // FIX ISSUE #BP-3: Verify Super Admin authentication using unified auth
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

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Build query
    let query = supabase
      .from('payout_bp_percentages')
      .select('*', { count: 'exact' })

    // FIX ISSUE #BP-2: Properly escape search to prevent SQL injection
    if (search) {
      const sanitizedSearch = search
        .replace(/[%_'";\\]/g, '') // Remove SQL wildcards and injection characters
        .substring(0, 100) // Limit search length
        .trim()

      if (sanitizedSearch.length > 0) {
        query = query.or(
          `bank_name.ilike.%${sanitizedSearch}%,` +
          `loan_type.ilike.%${sanitizedSearch}%,` +
          `location.ilike.%${sanitizedSearch}%`
        )
      }
    }

    // Execute query with pagination
    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching BP percentages', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Get summary statistics
    const { data: summaryData } = await supabase
      .from('payout_bp_percentages_summary')
      .select('*')
      .maybeSingle()

    // Get BP settings (global multipliers)
    const { data: settingsData } = await supabase
      .from('payout_bp_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      summary: summaryData || {},
      settings: settingsData || {
        bp_percentage_multiplier: 50.00,
        bp_team_percentage_multiplier: 10.00
      }
    })
  } catch (error) {
    apiLogger.error('Error in GET BP percentages', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/superadmin/payout-management/bp-percentages
 * Update BP or BP Team commission percentage (manual override)
 *
 * FIX ISSUE #BP-3: Added unified auth verification
 * FIX ISSUE #BP-4: Added rate limiting (30 requests/min)
 */
export async function PATCH(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await updateBPPercentagesHandler(req)
  })
}

async function updateBPPercentagesHandler(request: NextRequest) {
  try {
    // FIX ISSUE #BP-3: Verify Super Admin authentication using unified auth
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

    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { id, bp_commission_percentage, bp_team_commission_percentage, specific_conditions } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    // Validate BP commission if provided
    if (bp_commission_percentage !== undefined) {
      if (bp_commission_percentage < 0 || bp_commission_percentage > 100) {
        return NextResponse.json(
          { error: 'BP commission percentage must be between 0 and 100' },
          { status: 400 }
        )
      }
    }

    // Validate BP Team commission if provided
    if (bp_team_commission_percentage !== undefined) {
      if (bp_team_commission_percentage < 0 || bp_team_commission_percentage > 100) {
        return NextResponse.json(
          { error: 'BP Team commission percentage must be between 0 and 100' },
          { status: 400 }
        )
      }
    }

    // Build update object
    const updateData: any = {}

    if (bp_commission_percentage !== undefined) {
      updateData.bp_commission_percentage = bp_commission_percentage
      updateData.is_bp_manual_override = true
    }

    if (bp_team_commission_percentage !== undefined) {
      updateData.bp_team_commission_percentage = bp_team_commission_percentage
      updateData.is_team_manual_override = true
    }

    if (specific_conditions !== undefined) {
      updateData.specific_conditions = specific_conditions
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update BP percentage and mark as manual override
    const { data, error } = await supabase
      .from('payout_bp_percentages')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating BP percentage', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'BP percentage entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'BP percentage updated successfully',
      data
    })
  } catch (error) {
    apiLogger.error('Error in PATCH BP percentages', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
