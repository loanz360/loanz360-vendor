import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

interface AnalyticsSummary {
  total_disbursements: number
  total_commission_earned: number
  avg_commission_rate: number
  total_leads: number
  conversion_rate: number
  period_comparison: {
    current: {
      disbursements: number
      commission: number
      leads: number
    }
    previous: {
      disbursements: number
      commission: number
      leads: number
    }
    growth: {
      disbursements: number
      commission: number
      leads: number
    }
  }
}

interface AnalyticsByDimension {
  by_bank: {
    name: string
    disbursements: number
    commission: number
    lead_count: number
    avg_rate: number
  }[]
  by_loan_type: {
    name: string
    disbursements: number
    commission: number
    lead_count: number
    avg_rate: number
  }[]
  by_location: {
    name: string
    disbursements: number
    commission: number
    lead_count: number
  }[]
  by_month: {
    month: string
    disbursements: number
    commission: number
    lead_count: number
  }[]
}

export const dynamic = 'force-dynamic'

// GET - Fetch analytics for the partner
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

    // Get date range (default: last 12 months)
    const period = searchParams.get('period') || '12months'
    const endDate = new Date()
    let startDate = new Date()
    let previousStartDate = new Date()
    let previousEndDate = new Date()

    switch (period) {
      case '30days':
        startDate.setDate(startDate.getDate() - 30)
        previousEndDate.setDate(previousEndDate.getDate() - 30)
        previousStartDate.setDate(previousStartDate.getDate() - 60)
        break
      case '90days':
        startDate.setDate(startDate.getDate() - 90)
        previousEndDate.setDate(previousEndDate.getDate() - 90)
        previousStartDate.setDate(previousStartDate.getDate() - 180)
        break
      case '6months':
        startDate.setMonth(startDate.getMonth() - 6)
        previousEndDate.setMonth(previousEndDate.getMonth() - 6)
        previousStartDate.setMonth(previousStartDate.getMonth() - 12)
        break
      case '12months':
      default:
        startDate.setMonth(startDate.getMonth() - 12)
        previousEndDate.setMonth(previousEndDate.getMonth() - 12)
        previousStartDate.setMonth(previousStartDate.getMonth() - 24)
        break
    }

    // Fetch disbursements/commissions data
    // Note: This assumes there's a commissions or disbursements table
    // If not, we'll use mock/sample data for demonstration
    const { data: disbursements, error: disbursementsError } = await supabase
      .from('disbursements')
      .select(`
        id,
        bank_name,
        location,
        loan_type,
        loan_amount,
        commission_amount,
        commission_rate,
        disbursement_date,
        status
      `)
      .eq('partner_id', profile.id)
      .gte('disbursement_date', startDate.toISOString().split('T')[0])
      .lte('disbursement_date', endDate.toISOString().split('T')[0])
      .eq('status', 'completed')

    // Fetch leads count
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, status, created_at')
      .eq('partner_id', profile.id)
      .gte('created_at', startDate.toISOString())

    // Fetch previous period disbursements for comparison
    const { data: previousDisbursements } = await supabase
      .from('disbursements')
      .select('loan_amount, commission_amount')
      .eq('partner_id', profile.id)
      .gte('disbursement_date', previousStartDate.toISOString().split('T')[0])
      .lte('disbursement_date', previousEndDate.toISOString().split('T')[0])
      .eq('status', 'completed')

    const { data: previousLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('partner_id', profile.id)
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())

    // If disbursements table doesn't exist, return sample data
    if (disbursementsError?.code === '42P01') {
      // Table doesn't exist - return sample analytics
      return NextResponse.json({
        summary: getSampleSummary(),
        dimensions: getSampleDimensions(),
        period,
        message: 'Sample data - disbursements table not configured'
      })
    }

    // Calculate analytics
    const currentDisbursements = disbursements || []
    const currentLeads = leads || []
    const prevDisbursements = previousDisbursements || []
    const prevLeads = previousLeads || []

    const totalDisbursements = currentDisbursements.reduce((sum, d) => sum + (d.loan_amount || 0), 0)
    const totalCommission = currentDisbursements.reduce((sum, d) => sum + (d.commission_amount || 0), 0)
    const avgRate = currentDisbursements.length > 0
      ? currentDisbursements.reduce((sum, d) => sum + (d.commission_rate || 0), 0) / currentDisbursements.length
      : 0

    const convertedLeads = currentLeads.filter(l => l.status === 'converted' || l.status === 'disbursed').length
    const conversionRate = currentLeads.length > 0 ? (convertedLeads / currentLeads.length) * 100 : 0

    const prevTotalDisbursements = prevDisbursements.reduce((sum: number, d: any) => sum + (d.loan_amount || 0), 0)
    const prevTotalCommission = prevDisbursements.reduce((sum: number, d: any) => sum + (d.commission_amount || 0), 0)

    const summary: AnalyticsSummary = {
      total_disbursements: totalDisbursements,
      total_commission_earned: totalCommission,
      avg_commission_rate: avgRate,
      total_leads: currentLeads.length,
      conversion_rate: conversionRate,
      period_comparison: {
        current: {
          disbursements: totalDisbursements,
          commission: totalCommission,
          leads: currentLeads.length
        },
        previous: {
          disbursements: prevTotalDisbursements,
          commission: prevTotalCommission,
          leads: prevLeads.length
        },
        growth: {
          disbursements: prevTotalDisbursements > 0 ? ((totalDisbursements - prevTotalDisbursements) / prevTotalDisbursements) * 100 : 0,
          commission: prevTotalCommission > 0 ? ((totalCommission - prevTotalCommission) / prevTotalCommission) * 100 : 0,
          leads: prevLeads.length > 0 ? ((currentLeads.length - prevLeads.length) / prevLeads.length) * 100 : 0
        }
      }
    }

    // Calculate dimensions
    const dimensions = calculateDimensions(currentDisbursements)

    return NextResponse.json({
      summary,
      dimensions,
      period
    })
  } catch (error: unknown) {
    apiLogger.error('Error in analytics API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Calculate analytics by different dimensions
function calculateDimensions(disbursements: any[]): AnalyticsByDimension {
  // By Bank
  const bankMap = new Map<string, { disbursements: number; commission: number; lead_count: number; rates: number[] }>()
  // By Loan Type
  const loanTypeMap = new Map<string, { disbursements: number; commission: number; lead_count: number; rates: number[] }>()
  // By Location
  const locationMap = new Map<string, { disbursements: number; commission: number; lead_count: number }>()
  // By Month
  const monthMap = new Map<string, { disbursements: number; commission: number; lead_count: number }>()

  disbursements.forEach(d => {
    // Bank
    const bankData = bankMap.get(d.bank_name) || { disbursements: 0, commission: 0, lead_count: 0, rates: [] }
    bankData.disbursements += d.loan_amount || 0
    bankData.commission += d.commission_amount || 0
    bankData.lead_count += 1
    if (d.commission_rate) bankData.rates.push(d.commission_rate)
    bankMap.set(d.bank_name, bankData)

    // Loan Type
    const loanTypeData = loanTypeMap.get(d.loan_type) || { disbursements: 0, commission: 0, lead_count: 0, rates: [] }
    loanTypeData.disbursements += d.loan_amount || 0
    loanTypeData.commission += d.commission_amount || 0
    loanTypeData.lead_count += 1
    if (d.commission_rate) loanTypeData.rates.push(d.commission_rate)
    loanTypeMap.set(d.loan_type, loanTypeData)

    // Location
    const locationData = locationMap.get(d.location) || { disbursements: 0, commission: 0, lead_count: 0 }
    locationData.disbursements += d.loan_amount || 0
    locationData.commission += d.commission_amount || 0
    locationData.lead_count += 1
    locationMap.set(d.location, locationData)

    // Month
    const monthKey = d.disbursement_date?.substring(0, 7) || 'Unknown'
    const monthData = monthMap.get(monthKey) || { disbursements: 0, commission: 0, lead_count: 0 }
    monthData.disbursements += d.loan_amount || 0
    monthData.commission += d.commission_amount || 0
    monthData.lead_count += 1
    monthMap.set(monthKey, monthData)
  })

  return {
    by_bank: Array.from(bankMap.entries())
      .map(([name, data]) => ({
        name,
        disbursements: data.disbursements,
        commission: data.commission,
        lead_count: data.lead_count,
        avg_rate: data.rates.length > 0 ? data.rates.reduce((a, b) => a + b, 0) / data.rates.length : 0
      }))
      .sort((a, b) => b.commission - a.commission),

    by_loan_type: Array.from(loanTypeMap.entries())
      .map(([name, data]) => ({
        name,
        disbursements: data.disbursements,
        commission: data.commission,
        lead_count: data.lead_count,
        avg_rate: data.rates.length > 0 ? data.rates.reduce((a, b) => a + b, 0) / data.rates.length : 0
      }))
      .sort((a, b) => b.commission - a.commission),

    by_location: Array.from(locationMap.entries())
      .map(([name, data]) => ({
        name,
        disbursements: data.disbursements,
        commission: data.commission,
        lead_count: data.lead_count
      }))
      .sort((a, b) => b.commission - a.commission),

    by_month: Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        disbursements: data.disbursements,
        commission: data.commission,
        lead_count: data.lead_count
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }
}

// Sample data for demonstration when tables don't exist
function getSampleSummary(): AnalyticsSummary {
  return {
    total_disbursements: 125000000,
    total_commission_earned: 3125000,
    avg_commission_rate: 2.5,
    total_leads: 156,
    conversion_rate: 45.5,
    period_comparison: {
      current: {
        disbursements: 125000000,
        commission: 3125000,
        leads: 156
      },
      previous: {
        disbursements: 98000000,
        commission: 2450000,
        leads: 134
      },
      growth: {
        disbursements: 27.55,
        commission: 27.55,
        leads: 16.42
      }
    }
  }
}

function getSampleDimensions(): AnalyticsByDimension {
  return {
    by_bank: [
      { name: 'HDFC Bank', disbursements: 45000000, commission: 1125000, lead_count: 45, avg_rate: 2.5 },
      { name: 'SBI', disbursements: 35000000, commission: 875000, lead_count: 38, avg_rate: 2.5 },
      { name: 'ICICI Bank', disbursements: 25000000, commission: 625000, lead_count: 32, avg_rate: 2.5 },
      { name: 'Axis Bank', disbursements: 12000000, commission: 300000, lead_count: 25, avg_rate: 2.5 },
      { name: 'Kotak Mahindra', disbursements: 8000000, commission: 200000, lead_count: 16, avg_rate: 2.5 }
    ],
    by_loan_type: [
      { name: 'Home Loan', disbursements: 65000000, commission: 1300000, lead_count: 52, avg_rate: 2.0 },
      { name: 'Personal Loan', disbursements: 25000000, commission: 750000, lead_count: 45, avg_rate: 3.0 },
      { name: 'Business Loan', disbursements: 20000000, commission: 600000, lead_count: 28, avg_rate: 3.0 },
      { name: 'Car Loan', disbursements: 10000000, commission: 350000, lead_count: 22, avg_rate: 3.5 },
      { name: 'Gold Loan', disbursements: 5000000, commission: 125000, lead_count: 9, avg_rate: 2.5 }
    ],
    by_location: [
      { name: 'Mumbai', disbursements: 45000000, commission: 1125000, lead_count: 48 },
      { name: 'Delhi', disbursements: 30000000, commission: 750000, lead_count: 35 },
      { name: 'Bangalore', disbursements: 25000000, commission: 625000, lead_count: 32 },
      { name: 'Chennai', disbursements: 15000000, commission: 375000, lead_count: 25 },
      { name: 'Hyderabad', disbursements: 10000000, commission: 250000, lead_count: 16 }
    ],
    by_month: [
      { month: '2025-07', disbursements: 8000000, commission: 200000, lead_count: 12 },
      { month: '2025-08', disbursements: 9500000, commission: 237500, lead_count: 14 },
      { month: '2025-09', disbursements: 11000000, commission: 275000, lead_count: 15 },
      { month: '2025-10', disbursements: 10500000, commission: 262500, lead_count: 13 },
      { month: '2025-11', disbursements: 12000000, commission: 300000, lead_count: 16 },
      { month: '2025-12', disbursements: 14000000, commission: 350000, lead_count: 18 },
      { month: '2026-01', disbursements: 15000000, commission: 375000, lead_count: 20 }
    ]
  }
}
