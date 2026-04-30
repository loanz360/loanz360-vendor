import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * PATCH /api/superadmin/payout-management/bp-percentages/settings
 * Update BP global multipliers and recalculate all BP commissions
 *
 * FIX ISSUE #BP-3: Added unified auth verification
 * FIX ISSUE #BP-4: Added rate limiting (30 requests/min)
 */
export async function PATCH(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await updateBPSettingsHandler(req)
  })
}

async function updateBPSettingsHandler(request: NextRequest) {
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
    const body = await request.json()

    const { bp_percentage_multiplier, bp_team_percentage_multiplier } = body

    // At least one multiplier must be provided
    if (bp_percentage_multiplier === undefined && bp_team_percentage_multiplier === undefined) {
      return NextResponse.json(
        { error: 'At least one multiplier must be provided' },
        { status: 400 }
      )
    }

    // Validate BP multiplier if provided
    if (bp_percentage_multiplier !== undefined) {
      if (bp_percentage_multiplier < 0 || bp_percentage_multiplier > 100) {
        return NextResponse.json(
          { error: 'BP percentage multiplier must be between 0 and 100' },
          { status: 400 }
        )
      }
    }

    // Validate BP Team multiplier if provided
    if (bp_team_percentage_multiplier !== undefined) {
      if (bp_team_percentage_multiplier < 0 || bp_team_percentage_multiplier > 100) {
        return NextResponse.json(
          { error: 'BP Team percentage multiplier must be between 0 and 100' },
          { status: 400 }
        )
      }
    }

    // Get current settings to build update
    const { data: currentSettings } = await supabase
      .from('payout_bp_settings')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (!currentSettings) {
      return NextResponse.json(
        { error: 'BP settings not found' },
        { status: 404 }
      )
    }

    // Build update object (no need to get user for Super Admin)
    const updateData: any = {}

    if (bp_percentage_multiplier !== undefined) {
      updateData.bp_percentage_multiplier = bp_percentage_multiplier
    }

    if (bp_team_percentage_multiplier !== undefined) {
      updateData.bp_team_percentage_multiplier = bp_team_percentage_multiplier
    }

    // Update BP settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('payout_bp_settings')
      .update(updateData)
      .eq('id', currentSettings.id)
      .select()
      .maybeSingle()

    if (settingsError) {
      apiLogger.error('Error updating BP settings', settingsError)
      return NextResponse.json({ success: false, error: settingsError.message }, { status: 500 })
    }

    // Get all non-overridden BP percentages for recalculation
    const { data: bpPercentages, error: fetchError } = await supabase
      .from('payout_bp_percentages')
      .select('id, general_commission_percentage, is_bp_manual_override, is_team_manual_override')

    if (fetchError) {
      apiLogger.error('Error fetching BP percentages', fetchError)
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    // Recalculate commissions for non-overridden entries
    if (bpPercentages && bpPercentages.length > 0) {
      for (const bp of bpPercentages) {
        const updateBpData: any = {}

        // Recalculate BP commission if not manually overridden and BP multiplier was updated
        if (!bp.is_bp_manual_override && bp_percentage_multiplier !== undefined) {
          const newBpCommission = parseFloat(
            ((bp.general_commission_percentage * bp_percentage_multiplier) / 100).toFixed(2)
          )
          updateBpData.bp_commission_percentage = newBpCommission
        }

        // Recalculate BP Team commission if not manually overridden and Team multiplier was updated
        if (!bp.is_team_manual_override && bp_team_percentage_multiplier !== undefined) {
          const newTeamCommission = parseFloat(
            ((bp.general_commission_percentage * bp_team_percentage_multiplier) / 100).toFixed(2)
          )
          updateBpData.bp_team_commission_percentage = newTeamCommission
        }

        // Update if there are changes
        if (Object.keys(updateBpData).length > 0) {
          await supabase
            .from('payout_bp_percentages')
            .update(updateBpData)
            .eq('id', bp.id)
        }
      }
    }

    return NextResponse.json({
      message: 'BP multipliers updated and commissions recalculated successfully',
      data: settingsData
    })
  } catch (error) {
    apiLogger.error('Error in PATCH BP settings', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
