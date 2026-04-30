import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { CLVSummary } from '@/lib/types/dse-enhanced-performance.types'


/**
 * GET /api/performance/dse/clv
 * Returns Customer Lifetime Value analytics for the authenticated DSE.
 * Includes quality scores, NPA tracking, repeat business, and referrals.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const adminClient = createSupabaseAdmin()
    const { data: profile } = await adminClient
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch CLV data
    const { data: clvData, error: clvError } = await adminClient
      .from('dse_customer_clv')
      .select('*')
      .eq('dse_user_id', user.id)
      .order('lifetime_value', { ascending: false })

    if (clvError) {
      apiLogger.error('Error fetching CLV data', clvError)
      return NextResponse.json({ error: 'Failed to fetch CLV data' }, { status: 500 })
    }

    const customers = clvData || []
    const totalCustomers = customers.length

    // Calculate summary
    const npaCustomers = customers.filter((c) => c.is_npa)
    const totalLTV = customers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0)
    const avgEmiRate = customers.length > 0
      ? customers.reduce((sum, c) => sum + (c.emi_collection_rate || 100), 0) / customers.length
      : 100
    const repeatCount = customers.filter((c) => c.repeat_business_count > 0).length
    const referralCount = customers.filter((c) => c.referrals_generated > 0).length
    const avgQuality = customers.length > 0
      ? customers.reduce((sum, c) => sum + (c.quality_score || 100), 0) / customers.length
      : 100

    const summary: CLVSummary = {
      total_customers: totalCustomers,
      average_clv: totalCustomers > 0 ? totalLTV / totalCustomers : 0,
      total_lifetime_value: totalLTV,
      npa_count: npaCustomers.length,
      npa_rate: totalCustomers > 0 ? (npaCustomers.length / totalCustomers) * 100 : 0,
      average_emi_collection_rate: Number(avgEmiRate.toFixed(1)),
      repeat_business_rate: totalCustomers > 0 ? (repeatCount / totalCustomers) * 100 : 0,
      referral_rate: totalCustomers > 0 ? (referralCount / totalCustomers) * 100 : 0,
      quality_score: Number(avgQuality.toFixed(1)),
    }

    // Top customers by LTV
    const topCustomers = customers.slice(0, 10).map((c) => ({
      customer_name: c.customer_name,
      total_loans: c.total_loans_sourced,
      total_disbursed: c.total_disbursed_amount,
      emi_collection_rate: c.emi_collection_rate,
      lifetime_value: c.lifetime_value,
      is_npa: c.is_npa,
      referrals: c.referrals_generated,
      repeat_business: c.repeat_business_count,
    }))

    // NPA customers (needs attention)
    const npaDetails = npaCustomers.slice(0, 10).map((c) => ({
      customer_name: c.customer_name,
      npa_amount: c.npa_amount,
      total_disbursed: c.total_disbursed_amount,
      emi_collection_rate: c.emi_collection_rate,
      first_loan_date: c.first_loan_date,
    }))

    // Quality score trend note
    let qualityNote = ''
    if (avgQuality >= 90) qualityNote = 'Excellent portfolio quality. Your customers are reliable payers.'
    else if (avgQuality >= 75) qualityNote = 'Good portfolio quality. A few customers need monitoring.'
    else if (avgQuality >= 60) qualityNote = 'Portfolio quality needs improvement. Focus on customer qualification.'
    else qualityNote = 'Portfolio quality is below standard. Risk of incentive hold due to NPA rate.'

    return NextResponse.json({
      summary,
      top_customers: topCustomers,
      npa_details: npaDetails,
      quality_note: qualityNote,
      quality_gates: {
        incentive_eligible: avgQuality >= 60,
        npa_threshold: 5,
        current_npa_rate: summary.npa_rate,
        is_npa_within_threshold: summary.npa_rate <= 5,
      },
    })
  } catch (error) {
    apiLogger.error('Error in CLV API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
