import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * BDM Team Targets - Set Bulk Targets API
 * Allows BDM to set targets for multiple BDEs at once
 * BDM access only
 *
 * Rate Limit: 30 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await setBulkTargetsHandler(req)
  })
}

async function setBulkTargetsHandler(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // =====================================================
    // 2. PARSE REQUEST BODY
    // =====================================================

    const bodySchema = z.object({


      targets: z.array(z.unknown()).optional(),


      month: z.number().optional(),


      year: z.number().optional(),


      applyToAll: z.string().optional(),


      baseTarget: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { targets, month, year, applyToAll, baseTarget } = body

    // Validate required fields
    if (!month || !year) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: month, year',
        },
        { status: 400 }
      )
    }

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Targets array is required and must not be empty',
        },
        { status: 400 }
      )
    }

    // =====================================================
    // 3. GET ALL TEAM BDEs
    // =====================================================

    const { data: teamBDEs, error: bdeError } = await supabase
      .from('users')
      .select('id, name, manager_id')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (bdeError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch team members',
        },
        { status: 500 }
      )
    }

    const teamBDEIds = new Set(teamBDEs?.map((bde) => bde.id) || [])

    // =====================================================
    // 4. VALIDATE ALL BDE IDS
    // =====================================================

    const invalidBDEs = targets.filter((t) => !teamBDEIds.has(t.bdeId))
    if (invalidBDEs.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Some BDEs are not in your team',
          invalidBDEs: invalidBDEs.map((b) => b.bdeId),
        },
        { status: 400 }
      )
    }

    // =====================================================
    // 5. PREPARE TARGET DATA
    // =====================================================

    const daysInMonth = new Date(year, month, 0).getDate()
    const targetRecords = targets.map((target) => {
      const dailyTarget = target.dailyConversionTarget || Math.ceil(target.monthlyConversionTarget / daysInMonth)

      return {
        user_id: target.bdeId,
        target_type: 'BDE',
        month: month,
        year: year,
        daily_conversion_target: dailyTarget,
        monthly_conversion_target: target.monthlyConversionTarget,
        monthly_revenue_target: target.monthlyRevenueTarget,
        incentive_multiplier: target.incentiveMultiplier || 1.0,
        target_rationale: target.targetRationale || null,
        notes: target.notes || null,
        created_by: bdmUserId,
        updated_by: bdmUserId,
        is_active: true,
        updated_at: new Date().toISOString(),
      }
    })

    // =====================================================
    // 6. BULK UPSERT TARGETS
    // =====================================================

    const { data: insertedTargets, error: insertError } = await supabase
      .from('team_targets')
      .upsert(targetRecords, {
        onConflict: 'user_id,month,year,target_type',
      })
      .select()

    if (insertError) {
      apiLogger.error('Error setting bulk targets', insertError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to set targets',
          },
        { status: 500 }
      )
    }

    // =====================================================
    // 7. BUILD RESPONSE WITH SUMMARY
    // =====================================================

    const summary = {
      totalTargetsSet: insertedTargets?.length || 0,
      month,
      year,
      bdes: insertedTargets?.map((t) => {
        const bde = teamBDEs?.find((b) => b.id === t.user_id)
        return {
          bdeId: t.user_id,
          bdeName: bde?.name || 'Unknown',
          dailyConversionTarget: t.daily_conversion_target,
          monthlyConversionTarget: t.monthly_conversion_target,
          monthlyRevenueTarget: t.monthly_revenue_target,
        }
      }),
    }

    return NextResponse.json({
      success: true,
      data: summary,
      message: `Successfully set targets for ${summary.totalTargetsSet} BDEs`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in setBulkTargetsHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
