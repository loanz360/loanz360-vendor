import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId } from '@/lib/bdm/bde-utils'
import { parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'


interface BankPerformance {
  bankId: string
  bankName: string
  bankLogo: string | null

  // Volume Metrics
  totalSubmissions: number
  approvedApplications: number
  rejectedApplications: number
  pendingApplications: number

  // Success Metrics
  approvalRate: number
  rejectionRate: number

  // TAT Metrics
  avgTAT: number
  minTAT: number
  maxTAT: number
  slaCompliance: number

  // Financial Metrics
  totalDisbursed: number
  formattedDisbursed: string
  avgLoanAmount: number
  formattedAvgLoan: string

  // Trends
  approvalRateTrend: 'up' | 'down' | 'neutral'
  approvalRateChange: number
  volumeTrend: 'up' | 'down' | 'neutral'
  volumeChange: number

  // Rankings
  approvalRank: number
  volumeRank: number
  tatRank: number
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const { range, startDate, endDate } = parseDateRangeParams(searchParams)
    const sortBy = searchParams.get('sortBy') || 'approvalRate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Get BDEs under this BDM
    const { data: bdeData } = await supabase
      .from('employee_profiles')
      .select('user_id')
      .eq('reporting_manager_id', bdmId)
      .eq('role', 'business_development_executive')

    const bdeIds = bdeData?.map(b => b.user_id) || []

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          banks: [],
          totalBanks: 0,
          teamMetrics: {
            totalSubmissions: 0,
            avgApprovalRate: 0,
            avgTAT: 0,
            totalDisbursed: 0,
            formattedTotalDisbursed: '₹0',
          },
        },
      })
    }

    // Get previous period for comparison
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevStartDate = new Date(startDate.getTime() - daysDiff * 24 * 60 * 60 * 1000)
    const prevEndDate = new Date(startDate.getTime() - 1)

    // Fetch bank performance data
    const { data: bankStats } = await supabase
      .from('loan_applications')
      .select(`
        id,
        bank_id,
        current_stage,
        loan_amount,
        created_at,
        updated_at,
        assigned_bde_id,
        banks (
          id,
          name,
          logo_url
        )
      `)
      .in('assigned_bde_id', bdeIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('bank_id', 'is', null)

    // Fetch previous period data for trends
    const { data: prevBankStats } = await supabase
      .from('loan_applications')
      .select('id, bank_id, current_stage')
      .in('assigned_bde_id', bdeIds)
      .gte('created_at', prevStartDate.toISOString())
      .lte('created_at', prevEndDate.toISOString())
      .not('bank_id', 'is', null)

    // Fetch bank SLA settings
    const { data: bankSLAs } = await supabase
      .from('bank_processing_sla')
      .select('*')

    const slaMap = new Map(bankSLAs?.map(s => [s.bank_id, s.target_tat_days]) || [])

    // Group by bank
    const bankMap = new Map<string, unknown>()

    bankStats?.forEach(app => {
      if (!app.bank_id || !app.banks) return

      if (!bankMap.has(app.bank_id)) {
        bankMap.set(app.bank_id, {
          bankId: app.bank_id,
          bankName: app.banks.name,
          bankLogo: app.banks.logo_url,
          submissions: [],
          approved: [],
          rejected: [],
          pending: [],
          tats: [],
          disbursedAmounts: [],
        })
      }

      const bank = bankMap.get(app.bank_id)
      bank.submissions.push(app)

      if (app.current_stage === 'DISBURSED') {
        bank.approved.push(app)
        bank.disbursedAmounts.push(app.loan_amount)

        // Calculate TAT
        const tat = Math.ceil(
          (new Date(app.updated_at).getTime() - new Date(app.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        )
        bank.tats.push(tat)
      } else if (app.current_stage === 'REJECTED') {
        bank.rejected.push(app)
      } else {
        bank.pending.push(app)
      }
    })

    // Group previous period by bank
    const prevBankMap = new Map<string, unknown>()
    prevBankStats?.forEach(app => {
      if (!app.bank_id) return
      if (!prevBankMap.has(app.bank_id)) {
        prevBankMap.set(app.bank_id, { submissions: 0, approved: 0 })
      }
      const bank = prevBankMap.get(app.bank_id)
      bank.submissions++
      if (app.current_stage === 'DISBURSED') bank.approved++
    })

    // Calculate metrics for each bank
    const banks: BankPerformance[] = []

    bankMap.forEach((bank, bankId) => {
      const totalSubmissions = bank.submissions.length
      const approvedCount = bank.approved.length
      const rejectedCount = bank.rejected.length
      const pendingCount = bank.pending.length

      const approvalRate = totalSubmissions > 0 ? (approvedCount / totalSubmissions) * 100 : 0
      const rejectionRate = totalSubmissions > 0 ? (rejectedCount / totalSubmissions) * 100 : 0

      const avgTAT = bank.tats.length > 0
        ? bank.tats.reduce((a: number, b: number) => a + b, 0) / bank.tats.length
        : 0
      const minTAT = bank.tats.length > 0 ? Math.min(...bank.tats) : 0
      const maxTAT = bank.tats.length > 0 ? Math.max(...bank.tats) : 0

      const targetTAT = slaMap.get(bankId) || 30
      const slaCompliance = bank.tats.length > 0
        ? (bank.tats.filter((t: number) => t <= targetTAT).length / bank.tats.length) * 100
        : 0

      const totalDisbursed = bank.disbursedAmounts.reduce((a: number, b: number) => a + b, 0)
      const avgLoanAmount = bank.disbursedAmounts.length > 0
        ? totalDisbursed / bank.disbursedAmounts.length
        : 0

      // Calculate trends
      const prevBank = prevBankMap.get(bankId) || { submissions: 0, approved: 0 }
      const prevApprovalRate = prevBank.submissions > 0
        ? (prevBank.approved / prevBank.submissions) * 100
        : 0
      const prevVolume = prevBank.submissions

      const approvalRateChange = prevApprovalRate > 0
        ? ((approvalRate - prevApprovalRate) / prevApprovalRate) * 100
        : 0
      const volumeChange = prevVolume > 0
        ? ((totalSubmissions - prevVolume) / prevVolume) * 100
        : 0

      // Format currency
      const formatCurrency = (amount: number) => {
        if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
        return `₹${amount.toLocaleString('en-IN')}`
      }

      banks.push({
        bankId,
        bankName: bank.bankName,
        bankLogo: bank.bankLogo,
        totalSubmissions,
        approvedApplications: approvedCount,
        rejectedApplications: rejectedCount,
        pendingApplications: pendingCount,
        approvalRate,
        rejectionRate,
        avgTAT,
        minTAT,
        maxTAT,
        slaCompliance,
        totalDisbursed,
        formattedDisbursed: formatCurrency(totalDisbursed),
        avgLoanAmount,
        formattedAvgLoan: formatCurrency(avgLoanAmount),
        approvalRateTrend: approvalRateChange > 2 ? 'up' : approvalRateChange < -2 ? 'down' : 'neutral',
        approvalRateChange: Math.abs(approvalRateChange),
        volumeTrend: volumeChange > 5 ? 'up' : volumeChange < -5 ? 'down' : 'neutral',
        volumeChange: Math.abs(volumeChange),
        approvalRank: 0,
        volumeRank: 0,
        tatRank: 0,
      })
    })

    // Calculate rankings
    banks.sort((a, b) => b.approvalRate - a.approvalRate)
    banks.forEach((bank, idx) => { bank.approvalRank = idx + 1 })

    banks.sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    banks.forEach((bank, idx) => { bank.volumeRank = idx + 1 })

    banks.sort((a, b) => a.avgTAT - b.avgTAT)
    banks.forEach((bank, idx) => { bank.tatRank = idx + 1 })

    // Apply requested sorting
    const sortFn = (a: BankPerformance, b: BankPerformance) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'approvalRate': return (b.approvalRate - a.approvalRate) * multiplier
        case 'totalSubmissions': return (b.totalSubmissions - a.totalSubmissions) * multiplier
        case 'avgTAT': return (a.avgTAT - b.avgTAT) * multiplier
        case 'totalDisbursed': return (b.totalDisbursed - a.totalDisbursed) * multiplier
        case 'bankName': return a.bankName.localeCompare(b.bankName) * multiplier
        default: return 0
      }
    }
    banks.sort(sortFn)

    // Calculate team metrics
    const teamMetrics = {
      totalSubmissions: banks.reduce((sum, b) => sum + b.totalSubmissions, 0),
      avgApprovalRate: banks.length > 0
        ? banks.reduce((sum, b) => sum + b.approvalRate, 0) / banks.length
        : 0,
      avgTAT: banks.length > 0
        ? banks.reduce((sum, b) => sum + b.avgTAT, 0) / banks.length
        : 0,
      totalDisbursed: banks.reduce((sum, b) => sum + b.totalDisbursed, 0),
      formattedTotalDisbursed: '',
    }

    const formatCurrency = (amount: number) => {
      if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
      if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
      return `₹${amount.toLocaleString('en-IN')}`
    }
    teamMetrics.formattedTotalDisbursed = formatCurrency(teamMetrics.totalDisbursed)

    return NextResponse.json({
      success: true,
      data: {
        banks,
        totalBanks: banks.length,
        teamMetrics,
      },
    })

  } catch (error) {
    apiLogger.error('Bank performance API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
