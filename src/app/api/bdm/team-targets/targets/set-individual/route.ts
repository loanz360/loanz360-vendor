/**
 * BDM Team Targets - Set Individual BDE Target API
 * Allows BDM to set/update target for a single BDE
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
    return await setIndividualTargetHandler(req)
  })
}

async function setIndividualTargetHandler(request: NextRequest) {
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

    const body = await request.json()
    const {
      bdeId,
      month,
      year,
      dailyConversionTarget,
      monthlyConversionTarget,
      monthlyRevenueTarget,
      incentiveMultiplier,
      targetRationale,
      notes,
    } = body

    // Validate required fields
    if (!bdeId || !month || !year || !monthlyConversionTarget || !monthlyRevenueTarget) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: bdeId, month, year, monthlyConversionTarget, monthlyRevenueTarget',
        },
        { status: 400 }
      )
    }

    // Validate month and year
    if (month < 1 || month > 12) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid month. Must be between 1 and 12',
        },
        { status: 400 }
      )
    }

    if (year < 2020 || year > 2100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid year',
        },
        { status: 400 }
      )
    }

    // =====================================================
    // 3. VERIFY BDE IS IN BDM'S TEAM
    // =====================================================

    const { data: bdeData, error: bdeError } = await supabase
      .from('users')
      .select('id, name, manager_id')
      .eq('id', bdeId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (bdeError || !bdeData) {
      return NextResponse.json(
        {
          success: false,
          error: 'BDE not found or not in your team',
        },
        { status: 404 }
      )
    }

    // Verify the BDE reports to this BDM
    if (bdeData.manager_id !== bdmUserId && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: This BDE does not report to you',
        },
        { status: 403 }
      )
    }

    // =====================================================
    // 4. CALCULATE DAILY TARGET IF NOT PROVIDED
    // =====================================================

    const daysInMonth = new Date(year, month, 0).getDate()
    const calculatedDailyTarget = dailyConversionTarget || Math.ceil(monthlyConversionTarget / daysInMonth)

    // =====================================================
    // 5. UPSERT TARGET
    // =====================================================

    const targetData = {
      user_id: bdeId,
      target_type: 'BDE',
      month: month,
      year: year,
      daily_conversion_target: calculatedDailyTarget,
      monthly_conversion_target: monthlyConversionTarget,
      monthly_revenue_target: monthlyRevenueTarget,
      incentive_multiplier: incentiveMultiplier || 1.0,
      target_rationale: targetRationale || null,
      notes: notes || null,
      created_by: bdmUserId,
      updated_by: bdmUserId,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    const { data: target, error: targetError } = await supabase
      .from('team_targets')
      .upsert(targetData, {
        onConflict: 'user_id,month,year,target_type',
      })
      .select()
      .maybeSingle()

    if (targetError) {
      apiLogger.error('Error setting target', targetError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to set target',
          },
        { status: 500 }
      )
    }

    // =====================================================
    // 6. LOG ACTIVITY (Optional - if you have activity log table)
    // =====================================================

    // You can add activity logging here if needed

    // =====================================================
    // 7. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        target: {
          id: target.id,
          bdeId: bdeData.id,
          bdeName: bdeData.name,
          month,
          year,
          dailyConversionTarget: calculatedDailyTarget,
          monthlyConversionTarget,
          monthlyRevenueTarget,
          incentiveMultiplier: incentiveMultiplier || 1.0,
          targetRationale: targetRationale || null,
          notes: notes || null,
        },
        message: 'Target set successfully',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in setIndividualTargetHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
