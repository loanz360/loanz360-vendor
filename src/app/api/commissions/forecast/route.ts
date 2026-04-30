import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'


interface LeadData {
  id: string
  bank_name: string
  location: string
  loan_type: string
  loan_amount: number
  expected_disbursement_date: string
  probability: number // 0-100
  status: string
}

interface ForecastResult {
  lead_id: string
  bank_name: string
  location: string
  loan_type: string
  loan_amount: number
  expected_disbursement_date: string
  probability: number
  commission_rate: number
  expected_commission: number
  weighted_commission: number // commission * probability
}

interface ForecastSummary {
  total_pipeline_value: number
  total_expected_commission: number
  total_weighted_commission: number
  by_month: {
    month: string
    pipeline_value: number
    expected_commission: number
    weighted_commission: number
    lead_count: number
  }[]
  by_bank: {
    bank_name: string
    pipeline_value: number
    expected_commission: number
    lead_count: number
  }[]
  by_loan_type: {
    loan_type: string
    pipeline_value: number
    expected_commission: number
    lead_count: number
  }[]
}

// GET - Forecast commissions for a partner's pipeline
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    // Get partner profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, sub_role')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Map sub_role to partner type
    const partnerTypeMap: Record<string, string> = {
      'BUSINESS_ASSOCIATE': 'BA',
      'BUSINESS_PARTNER': 'BP',
      'CHANNEL_PARTNER': 'CP'
    }
    const partnerType = partnerTypeMap[profile.sub_role || ''] || (profile.role === 'PARTNER' ? 'BA' : null)

    if (!partnerType && !auth.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Invalid partner type' }, { status: 400 })
    }

    // Get date range for forecast (default: next 6 months)
    const monthsAhead = parseInt(searchParams.get('months') || '6')
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + monthsAhead)

    // Get active leads for this partner
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select(`
        id,
        bank_name,
        location,
        loan_type,
        loan_amount,
        expected_disbursement_date,
        probability,
        status
      `)
      .eq('partner_id', profile.id)
      .in('status', ['new', 'in_progress', 'documents_pending', 'approved', 'sanctioned'])
      .gte('expected_disbursement_date', startDate.toISOString().split('T')[0])
      .lte('expected_disbursement_date', endDate.toISOString().split('T')[0])
      .order('expected_disbursement_date', { ascending: true })

    if (leadsError) {
      apiLogger.error('Error fetching leads', leadsError)
      // If leads table doesn't exist or other error, return empty forecast
      return NextResponse.json({
        forecasts: [],
        summary: {
          total_pipeline_value: 0,
          total_expected_commission: 0,
          total_weighted_commission: 0,
          by_month: [],
          by_bank: [],
          by_loan_type: []
        }
      })
    }

    // If no leads, return empty forecast
    if (!leads || leads.length === 0) {
      return NextResponse.json({
        forecasts: [],
        summary: {
          total_pipeline_value: 0,
          total_expected_commission: 0,
          total_weighted_commission: 0,
          by_month: [],
          by_bank: [],
          by_loan_type: []
        }
      })
    }

    // Get commission rates for each unique combination
    const forecasts: ForecastResult[] = []
    const commissionRateCache: Record<string, number> = {}

    // Determine the table to use based on partner type
    const tableName = `payout_${partnerType.toLowerCase()}_percentages`

    for (const lead of leads) {
      const cacheKey = `${lead.bank_name}|${lead.location}|${lead.loan_type}`
      let commissionRate = commissionRateCache[cacheKey]

      if (commissionRate === undefined) {
        // Fetch commission rate from database
        const { data: rateData } = await supabase
          .from(tableName)
          .select('commission_percentage')
          .eq('bank_name', lead.bank_name)
          .eq('location', lead.location)
          .eq('loan_type', lead.loan_type)
          .eq('is_current', true)
          .maybeSingle()

        commissionRate = rateData?.commission_percentage || 0
        commissionRateCache[cacheKey] = commissionRate
      }

      const probability = lead.probability || 50 // Default 50% if not set
      const expectedCommission = (lead.loan_amount * commissionRate) / 100
      const weightedCommission = (expectedCommission * probability) / 100

      forecasts.push({
        lead_id: lead.id,
        bank_name: lead.bank_name,
        location: lead.location,
        loan_type: lead.loan_type,
        loan_amount: lead.loan_amount,
        expected_disbursement_date: lead.expected_disbursement_date,
        probability,
        commission_rate: commissionRate,
        expected_commission: expectedCommission,
        weighted_commission: weightedCommission
      })
    }

    // Generate summary
    const summary: ForecastSummary = {
      total_pipeline_value: forecasts.reduce((sum, f) => sum + f.loan_amount, 0),
      total_expected_commission: forecasts.reduce((sum, f) => sum + f.expected_commission, 0),
      total_weighted_commission: forecasts.reduce((sum, f) => sum + f.weighted_commission, 0),
      by_month: [],
      by_bank: [],
      by_loan_type: []
    }

    // Group by month
    const monthMap = new Map<string, {
      pipeline_value: number
      expected_commission: number
      weighted_commission: number
      lead_count: number
    }>()

    forecasts.forEach(f => {
      const date = new Date(f.expected_disbursement_date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      const existing = monthMap.get(monthKey) || {
        pipeline_value: 0,
        expected_commission: 0,
        weighted_commission: 0,
        lead_count: 0
      }

      monthMap.set(monthKey, {
        pipeline_value: existing.pipeline_value + f.loan_amount,
        expected_commission: existing.expected_commission + f.expected_commission,
        weighted_commission: existing.weighted_commission + f.weighted_commission,
        lead_count: existing.lead_count + 1
      })
    })

    summary.by_month = Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Group by bank
    const bankMap = new Map<string, {
      pipeline_value: number
      expected_commission: number
      lead_count: number
    }>()

    forecasts.forEach(f => {
      const existing = bankMap.get(f.bank_name) || {
        pipeline_value: 0,
        expected_commission: 0,
        lead_count: 0
      }

      bankMap.set(f.bank_name, {
        pipeline_value: existing.pipeline_value + f.loan_amount,
        expected_commission: existing.expected_commission + f.expected_commission,
        lead_count: existing.lead_count + 1
      })
    })

    summary.by_bank = Array.from(bankMap.entries())
      .map(([bank_name, data]) => ({ bank_name, ...data }))
      .sort((a, b) => b.expected_commission - a.expected_commission)

    // Group by loan type
    const loanTypeMap = new Map<string, {
      pipeline_value: number
      expected_commission: number
      lead_count: number
    }>()

    forecasts.forEach(f => {
      const existing = loanTypeMap.get(f.loan_type) || {
        pipeline_value: 0,
        expected_commission: 0,
        lead_count: 0
      }

      loanTypeMap.set(f.loan_type, {
        pipeline_value: existing.pipeline_value + f.loan_amount,
        expected_commission: existing.expected_commission + f.expected_commission,
        lead_count: existing.lead_count + 1
      })
    })

    summary.by_loan_type = Array.from(loanTypeMap.entries())
      .map(([loan_type, data]) => ({ loan_type, ...data }))
      .sort((a, b) => b.expected_commission - a.expected_commission)

    return NextResponse.json({
      forecasts,
      summary
    })
  } catch (error: unknown) {
    apiLogger.error('Error in forecast API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Manual forecast calculation (for what-if scenarios)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyUnifiedAuth(request)

    if (!authResult.authorized) {
      return NextResponse.json({ success: false, error: authResult.error || 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseAdmin()

    // Get partner profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, sub_role')
      .eq('id', authResult.userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    const partnerTypeMap: Record<string, string> = {
      'BUSINESS_ASSOCIATE': 'BA',
      'BUSINESS_PARTNER': 'BP',
      'CHANNEL_PARTNER': 'CP'
    }
    const partnerType = partnerTypeMap[profile.sub_role || ''] || (profile.role === 'PARTNER' ? 'BA' : null)

    if (!partnerType && !authResult.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Invalid partner type' }, { status: 400 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { scenarios } = body

    if (!scenarios || !Array.isArray(scenarios)) {
      return NextResponse.json({ success: false, error: 'scenarios array is required' }, { status: 400 })
    }

    const tableName = `payout_${partnerType.toLowerCase()}_percentages`
    const results = []

    for (const scenario of scenarios) {
      const { bank_name, location, loan_type, loan_amount, probability = 100 } = scenario

      if (!bank_name || !location || !loan_type || !loan_amount) {
        results.push({
          ...scenario,
          error: 'Missing required fields'
        })
        continue
      }

      // Fetch commission rate
      const { data: rateData } = await supabase
        .from(tableName)
        .select('commission_percentage')
        .eq('bank_name', bank_name)
        .eq('location', location)
        .eq('loan_type', loan_type)
        .eq('is_current', true)
        .maybeSingle()

      const commissionRate = rateData?.commission_percentage || 0
      const expectedCommission = (loan_amount * commissionRate) / 100
      const weightedCommission = (expectedCommission * probability) / 100

      results.push({
        ...scenario,
        commission_rate: commissionRate,
        expected_commission: expectedCommission,
        weighted_commission: weightedCommission
      })
    }

    return NextResponse.json({ results })
  } catch (error: unknown) {
    apiLogger.error('Error in forecast POST', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
