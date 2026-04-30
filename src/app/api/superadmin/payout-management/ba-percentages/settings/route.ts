import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// PATCH - Update BA global multiplier and recalculate all BA commissions
export async function PATCH(request: NextRequest) {
  try {
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    if (!superAdminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const bodySchema = z.object({

      ba_percentage_multiplier: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { ba_percentage_multiplier } = body

    if (ba_percentage_multiplier === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: ba_percentage_multiplier' },
        { status: 400 }
      )
    }

    if (ba_percentage_multiplier < 0 || ba_percentage_multiplier > 100) {
      return NextResponse.json(
        { error: 'BA percentage multiplier must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Update BA settings (no need to get user for Super Admin)
    const { data: settingsData, error: settingsError } = await supabase
      .from('payout_ba_settings')
      .update({
        ba_percentage_multiplier
      })
      .eq('id', (await supabase.from('payout_ba_settings').select('id').limit(1).maybeSingle()).data?.id)
      .select()
      .maybeSingle()

    if (settingsError) {
      apiLogger.error('Error updating BA settings', settingsError)
      return NextResponse.json({ success: false, error: settingsError.message }, { status: 500 })
    }

    // Recalculate all BA commissions that are NOT manually overridden
    const { error: recalcError } = await supabase.rpc('recalculate_ba_commissions', {
      new_multiplier: ba_percentage_multiplier
    })

    // If the RPC doesn't exist, do it manually
    if (recalcError) {
      // Get all non-overridden BA percentages
      const { data: baPercentages, error: fetchError } = await supabase
        .from('payout_ba_percentages')
        .select('id, general_commission_percentage, is_manual_override')
        .eq('is_manual_override', false)

      if (fetchError) {
        apiLogger.error('Error fetching BA percentages', fetchError)
        return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
      }

      // Update each non-overridden entry
      if (baPercentages && baPercentages.length > 0) {
        for (const ba of baPercentages) {
          const newBaCommission = parseFloat(
            ((ba.general_commission_percentage * ba_percentage_multiplier) / 100).toFixed(2)
          )

          await supabase
            .from('payout_ba_percentages')
            .update({ ba_commission_percentage: newBaCommission })
            .eq('id', ba.id)
        }
      }
    }

    return NextResponse.json({
      message: 'BA multiplier updated and commissions recalculated successfully',
      data: settingsData
    })
  } catch (error) {
    apiLogger.error('Error in PATCH BA settings', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
