import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


interface PayoutRow {
  loan_type: string
  ba_commission_percentage?: number
  bp_commission_percentage?: number
  cp_commission_percentage?: number
  general_commission_percentage?: number
  commission_percentage?: number
}

/**
 * GET /api/partners/commission-estimate
 * Returns estimated commission range for a loan type + partner type.
 * Since bank_name/location aren't known at lead submission time,
 * this returns min/max/avg rates across all banks for that loan type.
 *
 * Query Parameters:
 * - loan_type (required): The loan subcategory name (e.g., "New Personal Loan")
 * - partner_type (required): 'BA' | 'BP' | 'CP'
 * - amount (optional): Loan amount for calculating estimated commission in rupees
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const loanType = searchParams.get('loan_type')
    const partnerType = searchParams.get('partner_type')?.toUpperCase()
    const amountStr = searchParams.get('amount')

    if (!loanType) {
      return NextResponse.json(
        { success: false, error: 'loan_type is required' },
        { status: 400 }
      )
    }

    if (!partnerType || !['BA', 'BP', 'CP'].includes(partnerType)) {
      return NextResponse.json(
        { success: false, error: 'partner_type must be BA, BP, or CP' },
        { status: 400 }
      )
    }

    const amount = amountStr ? parseFloat(amountStr) : null

    // Determine which payout table to query
    const tableMap: Record<string, string> = {
      'BA': 'payout_ba_percentages',
      'BP': 'payout_bp_percentages',
      'CP': 'payout_cp_percentages',
    }
    const percentageColumn: Record<string, string> = {
      'BA': 'ba_commission_percentage',
      'BP': 'bp_commission_percentage',
      'CP': 'cp_commission_percentage',
    }

    const table = tableMap[partnerType]
    const column = percentageColumn[partnerType]

    // Query all rates for this loan type across all banks/locations
    const { data: rates, error: ratesError } = await supabase
      .from(table)
      .select(`loan_type, ${column}, general_commission_percentage`)
      .ilike('loan_type', `%${loanType}%`)

    if (ratesError) {
      apiLogger.error('Commission estimate: failed to fetch rates', ratesError)

      // Fallback: try the general percentages table
      const { data: generalRates, error: generalError } = await supabase
        .from('payout_general_percentages')
        .select('loan_type, commission_percentage')
        .ilike('loan_type', `%${loanType}%`)
        .eq('is_current', true)

      if (generalError || !generalRates || generalRates.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            hasRates: false,
            message: 'Commission rates will be determined after bank matching',
          }
        })
      }

      // Use general rates with default multipliers
      const multipliers: Record<string, number> = { 'BA': 70, 'BP': 50, 'CP': 60 }
      const multiplier = multipliers[partnerType]
      const percentages = generalRates.map((r: PayoutRow) => (r.commission_percentage || 0) * multiplier / 100)
      const minRate = Math.min(...percentages)
      const maxRate = Math.max(...percentages)
      const avgRate = percentages.reduce((a: number, b: number) => a + b, 0) / percentages.length

      return NextResponse.json({
        success: true,
        data: {
          hasRates: true,
          minPercentage: Math.round(minRate * 100) / 100,
          maxPercentage: Math.round(maxRate * 100) / 100,
          avgPercentage: Math.round(avgRate * 100) / 100,
          rateCount: generalRates.length,
          ...(amount ? {
            estimatedMinCommission: Math.round(amount * minRate / 100),
            estimatedMaxCommission: Math.round(amount * maxRate / 100),
            estimatedAvgCommission: Math.round(amount * avgRate / 100),
          } : {}),
          source: 'general_with_multiplier',
        }
      })
    }

    if (!rates || rates.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasRates: false,
          message: 'Commission rates will be determined after bank matching',
        }
      })
    }

    // Calculate min/max/avg from partner-specific rates
    const percentages = rates.map((r: PayoutRow) => {
      const val = r[column as keyof PayoutRow]
      return typeof val === 'number' ? val : 0
    }).filter((v: number) => v > 0)

    if (percentages.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasRates: false,
          message: 'Commission rates will be determined after bank matching',
        }
      })
    }

    const minRate = Math.min(...percentages)
    const maxRate = Math.max(...percentages)
    const avgRate = percentages.reduce((a: number, b: number) => a + b, 0) / percentages.length

    return NextResponse.json({
      success: true,
      data: {
        hasRates: true,
        minPercentage: Math.round(minRate * 100) / 100,
        maxPercentage: Math.round(maxRate * 100) / 100,
        avgPercentage: Math.round(avgRate * 100) / 100,
        rateCount: percentages.length,
        ...(amount ? {
          estimatedMinCommission: Math.round(amount * minRate / 100),
          estimatedMaxCommission: Math.round(amount * maxRate / 100),
          estimatedAvgCommission: Math.round(amount * avgRate / 100),
        } : {}),
        source: 'partner_specific',
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Commission estimate: unexpected error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
