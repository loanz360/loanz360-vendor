import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * PATCH /api/superadmin/payout-management/cp-percentages/settings
 * Update CP global multiplier and recalculate all CP commissions
 *
 * FIX ISSUE #BP-3: Added unified auth verification
 * FIX ISSUE #BP-4: Added rate limiting (30 requests/min)
 */
export async function PATCH(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await updateCPSettingsHandler(req)
  })
}

async function updateCPSettingsHandler(request: NextRequest) {
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

    const { cp_percentage_multiplier } = body

    if (cp_percentage_multiplier === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: cp_percentage_multiplier' },
        { status: 400 }
      )
    }

    if (cp_percentage_multiplier < 0 || cp_percentage_multiplier > 100) {
      return NextResponse.json(
        { error: 'CP percentage multiplier must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Update CP settings (no need to get user for Super Admin)
    const { data: settingsData, error: settingsError } = await supabase
      .from('payout_cp_settings')
      .update({
        cp_percentage_multiplier
      })
      .eq('id', (await supabase.from('payout_cp_settings').select('id').limit(1).maybeSingle()).data?.id)
      .select()
      .maybeSingle()

    if (settingsError) {
      apiLogger.error('Error updating CP settings', settingsError)
      return NextResponse.json({ success: false, error: settingsError.message }, { status: 500 })
    }

    // Recalculate all CP commissions that are NOT manually overridden
    // Get all non-overridden CP percentages
    const { data: cpPercentages, error: fetchError } = await supabase
      .from('payout_cp_percentages')
      .select('id, general_commission_percentage, is_manual_override')
      .eq('is_manual_override', false)

    if (fetchError) {
      apiLogger.error('Error fetching CP percentages', fetchError)
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    // Update each non-overridden entry
    if (cpPercentages && cpPercentages.length > 0) {
      for (const cp of cpPercentages) {
        const newCpCommission = parseFloat(
          ((cp.general_commission_percentage * cp_percentage_multiplier) / 100).toFixed(2)
        )

        await supabase
          .from('payout_cp_percentages')
          .update({ cp_commission_percentage: newCpCommission })
          .eq('id', cp.id)
      }
    }

    return NextResponse.json({
      message: 'CP multiplier updated and commissions recalculated successfully',
      data: settingsData
    })
  } catch (error) {
    apiLogger.error('Error in PATCH CP settings', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
