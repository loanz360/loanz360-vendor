import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


interface CommissionResult {
  general_percentage: number
  partner_percentage: number
  commission_amount: number
  effective_from: string
  effective_to: string | null
  version: number
  conditions: string[]
  specific_conditions: string | null
  multiplier: number
}

/**
 * GET /api/commissions/calculate
 * Calculate commission amount based on rate effective at disbursement date
 *
 * Query Parameters:
 * - bank_name (required): Name of the bank
 * - location (required): Location/region
 * - loan_type (required): Type of loan
 * - amount (required): Disbursement amount
 * - partner_type (required): 'BA' | 'BP' | 'CP'
 * - disbursement_date (optional): Date to get rate for (defaults to today)
 * - include_team (optional): For BP, include team commission in response
 */
export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await calculateCommissionHandler(req)
  })
}

async function calculateCommissionHandler(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Extract parameters
    const bankName = searchParams.get('bank_name')
    const location = searchParams.get('location')
    const loanType = searchParams.get('loan_type')
    const amountStr = searchParams.get('amount')
    const partnerType = searchParams.get('partner_type')?.toUpperCase()
    const disbursementDateStr = searchParams.get('disbursement_date')
    const includeTeam = searchParams.get('include_team') === 'true'

    // Validate required parameters
    if (!bankName) {
      return NextResponse.json(
        { success: false, error: 'bank_name is required' },
        { status: 400 }
      )
    }

    if (!location) {
      return NextResponse.json(
        { success: false, error: 'location is required' },
        { status: 400 }
      )
    }

    if (!loanType) {
      return NextResponse.json(
        { success: false, error: 'loan_type is required' },
        { status: 400 }
      )
    }

    if (!amountStr) {
      return NextResponse.json(
        { success: false, error: 'amount is required' },
        { status: 400 }
      )
    }

    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      )
    }

    if (!partnerType || !['BA', 'BP', 'CP'].includes(partnerType)) {
      return NextResponse.json(
        { success: false, error: 'partner_type must be BA, BP, or CP' },
        { status: 400 }
      )
    }

    // Parse disbursement date
    let disbursementDate = new Date()
    if (disbursementDateStr) {
      disbursementDate = new Date(disbursementDateStr)
      if (isNaN(disbursementDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid disbursement_date format. Use YYYY-MM-DD' },
          { status: 400 }
        )
      }
    }

    const dateStr = disbursementDate.toISOString().split('T')[0]

    // Get the commission rate effective at the disbursement date
    const { data: generalRate, error: generalError } = await supabase
      .from('payout_general_percentages')
      .select('*')
      .eq('bank_name', bankName)
      .eq('location', location)
      .eq('loan_type', loanType)
      .lte('effective_from', dateStr)
      .or(`effective_to.is.null,effective_to.gt.${dateStr}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (generalError) {
      apiLogger.error('Error fetching general rate', generalError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch commission rate' },
        { status: 500 }
      )
    }

    if (!generalRate) {
      return NextResponse.json(
        {
          success: false,
          error: 'No commission rate found for the specified bank, location, and loan type',
          suggestion: 'Please verify the bank name, location, and loan type are correct'
        },
        { status: 404 }
      )
    }

    // Get the partner-specific rate
    let partnerRate: number
    let teamRate: number | null = null
    let multiplier: number

    if (partnerType === 'BA') {
      // Get BA settings and percentage
      const { data: baSettings } = await supabase
        .from('payout_ba_settings')
        .select('ba_percentage_multiplier')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      multiplier = baSettings?.ba_percentage_multiplier || 70

      const { data: baRate } = await supabase
        .from('payout_ba_percentages')
        .select('ba_commission_percentage, is_manual_override')
        .eq('general_percentage_id', generalRate.id)
        .maybeSingle()

      partnerRate = baRate?.ba_commission_percentage ||
        (generalRate.commission_percentage * multiplier / 100)

    } else if (partnerType === 'BP') {
      // Get BP settings and percentage
      const { data: bpSettings } = await supabase
        .from('payout_bp_settings')
        .select('bp_percentage_multiplier, bp_team_percentage_multiplier')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      multiplier = bpSettings?.bp_percentage_multiplier || 50
      const teamMultiplier = bpSettings?.bp_team_percentage_multiplier || 10

      const { data: bpRate } = await supabase
        .from('payout_bp_percentages')
        .select('bp_commission_percentage, bp_team_commission_percentage, is_bp_manual_override, is_team_manual_override')
        .eq('general_percentage_id', generalRate.id)
        .maybeSingle()

      partnerRate = bpRate?.bp_commission_percentage ||
        (generalRate.commission_percentage * multiplier / 100)

      if (includeTeam) {
        teamRate = bpRate?.bp_team_commission_percentage ||
          (generalRate.commission_percentage * teamMultiplier / 100)
      }

    } else {
      // CP
      const { data: cpSettings } = await supabase
        .from('payout_cp_settings')
        .select('cp_percentage_multiplier')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      multiplier = cpSettings?.cp_percentage_multiplier || 60

      const { data: cpRate } = await supabase
        .from('payout_cp_percentages')
        .select('cp_commission_percentage, is_manual_override')
        .eq('general_percentage_id', generalRate.id)
        .maybeSingle()

      partnerRate = cpRate?.cp_commission_percentage ||
        (generalRate.commission_percentage * multiplier / 100)
    }

    // Calculate commission amount
    const commissionAmount = Math.round((amount * partnerRate / 100) * 100) / 100
    const teamCommissionAmount = teamRate
      ? Math.round((amount * teamRate / 100) * 100) / 100
      : null

    // Get payout conditions
    const { data: conditions } = await supabase
      .from('payout_conditions')
      .select('condition_text')
      .eq('is_active', true)
      .contains('applies_to', [partnerType])
      .order('condition_order', { ascending: true })

    const conditionTexts = conditions?.map(c =>
      c.condition_text.replace('{bank_name}', bankName)
    ) || []

    // Build response
    const result: CommissionResult = {
      general_percentage: generalRate.commission_percentage,
      partner_percentage: partnerRate,
      commission_amount: commissionAmount,
      effective_from: generalRate.effective_from,
      effective_to: generalRate.effective_to,
      version: generalRate.version || 1,
      conditions: conditionTexts,
      specific_conditions: generalRate.specific_conditions,
      multiplier: multiplier
    }

    const response: Record<string, unknown> = {
      success: true,
      data: result,
      calculation: {
        disbursement_amount: amount,
        partner_type: partnerType,
        disbursement_date: dateStr,
        formula: `${amount} × ${partnerRate}% = ${commissionAmount}`
      }
    }

    // Add team commission for BP if requested
    if (partnerType === 'BP' && includeTeam && teamRate !== null) {
      response.team_commission = {
        percentage: teamRate,
        amount: teamCommissionAmount,
        formula: `${amount} × ${teamRate}% = ${teamCommissionAmount}`
      }
      response.total_bp_earning = {
        amount: commissionAmount + (teamCommissionAmount || 0),
        breakdown: `Direct: ₹${commissionAmount.toLocaleString('en-IN')} + Team: ₹${(teamCommissionAmount || 0).toLocaleString('en-IN')}`
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    apiLogger.error('Error in commission calculation', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/commissions/calculate
 * Calculate commission for multiple entries at once (batch calculation)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bodySchema = z.object({

      calculations: z.array(z.unknown()).optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { calculations } = body

    if (!calculations || !Array.isArray(calculations)) {
      return NextResponse.json(
        { success: false, error: 'calculations array is required' },
        { status: 400 }
      )
    }

    if (calculations.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 calculations per request' },
        { status: 400 }
      )
    }

    const results = []

    for (const calc of calculations) {
      const {
        bank_name,
        location,
        loan_type,
        amount,
        partner_type,
        disbursement_date
      } = calc

      // Skip invalid entries
      if (!bank_name || !location || !loan_type || !amount || !partner_type) {
        results.push({
          ...calc,
          success: false,
          error: 'Missing required fields'
        })
        continue
      }

      // Parse date
      let dateStr = new Date().toISOString().split('T')[0]
      if (disbursement_date) {
        const date = new Date(disbursement_date)
        if (!isNaN(date.getTime())) {
          dateStr = date.toISOString().split('T')[0]
        }
      }

      // Get rate
      const { data: generalRate } = await supabase
        .from('payout_general_percentages')
        .select('id, commission_percentage, effective_from, version')
        .eq('bank_name', bank_name)
        .eq('location', location)
        .eq('loan_type', loan_type)
        .lte('effective_from', dateStr)
        .or(`effective_to.is.null,effective_to.gt.${dateStr}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!generalRate) {
        results.push({
          ...calc,
          success: false,
          error: 'No rate found for this combination'
        })
        continue
      }

      // Get partner rate based on type
      let partnerRate: number
      const pt = partner_type.toUpperCase()

      if (pt === 'BA') {
        const { data: baSettings } = await supabase
          .from('payout_ba_settings')
          .select('ba_percentage_multiplier')
          .limit(1)
          .maybeSingle()
        partnerRate = generalRate.commission_percentage * (baSettings?.ba_percentage_multiplier || 70) / 100
      } else if (pt === 'BP') {
        const { data: bpSettings } = await supabase
          .from('payout_bp_settings')
          .select('bp_percentage_multiplier')
          .limit(1)
          .maybeSingle()
        partnerRate = generalRate.commission_percentage * (bpSettings?.bp_percentage_multiplier || 50) / 100
      } else {
        const { data: cpSettings } = await supabase
          .from('payout_cp_settings')
          .select('cp_percentage_multiplier')
          .limit(1)
          .maybeSingle()
        partnerRate = generalRate.commission_percentage * (cpSettings?.cp_percentage_multiplier || 60) / 100
      }

      const commissionAmount = Math.round((amount * partnerRate / 100) * 100) / 100

      results.push({
        ...calc,
        success: true,
        general_percentage: generalRate.commission_percentage,
        partner_percentage: partnerRate,
        commission_amount: commissionAmount,
        effective_from: generalRate.effective_from,
        version: generalRate.version
      })
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: calculations.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total_commission: results
          .filter(r => r.success)
          .reduce((sum, r) => sum + (r.commission_amount || 0), 0)
      }
    })

  } catch (error) {
    apiLogger.error('Error in batch commission calculation', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
