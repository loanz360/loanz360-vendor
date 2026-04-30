import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId } from '@/lib/bdm/bde-utils'
import { parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
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
    const bankIdsParam = searchParams.get('bankIds')

    if (!bankIdsParam) {
      return NextResponse.json(
        { success: false, error: 'Bank IDs required (comma-separated)' },
        { status: 400 }
      )
    }

    const bankIds = bankIdsParam.split(',').map(id => id.trim())

    if (bankIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 banks required for comparison' },
        { status: 400 }
      )
    }

    if (bankIds.length > 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 banks can be compared' },
        { status: 400 }
      )
    }

    const { range, startDate, endDate } = parseDateRangeParams(searchParams)

    // Get BDEs under this BDM
    const { data: bdeData } = await supabase
      .from('employee_profiles')
      .select('user_id')
      .eq('reporting_manager_id', bdmId)
      .eq('role', 'business_development_executive')

    const bdeIds = bdeData?.map(b => b.user_id) || []

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No BDEs found',
      }, { status: 404 })
    }

    // Get bank details
    const { data: banksData } = await supabase
      .from('banks')
      .select('*')
      .in('id', bankIds)

    const banksMap = new Map(banksData?.map(b => [b.id, b]) || [])

    // Get bank SLAs
    const { data: slasData } = await supabase
      .from('bank_processing_sla')
      .select('*')
      .in('bank_id', bankIds)

    const slaMap = new Map(slasData?.map(s => [s.bank_id, s.target_tat_days]) || [])

    // Fetch applications for all banks
    const { data: applications } = await supabase
      .from('loan_applications')
      .select(`
        id,
        bank_id,
        loan_amount,
        current_stage,
        created_at,
        updated_at
      `)
      .in('bank_id', bankIds)
      .in('assigned_bde_id', bdeIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Group by bank
    const bankStatsMap = new Map<string, any>()

    bankIds.forEach(bankId => {
      bankStatsMap.set(bankId, {
        bankId,
        bankName: banksMap.get(bankId)?.name || 'Unknown',
        bankLogo: banksMap.get(bankId)?.logo_url || null,
        targetTAT: slaMap.get(bankId) || 30,
        submissions: [],
        approved: [],
        rejected: [],
        pending: [],
        tats: [],
        disbursedAmounts: [],
      })
    })

    applications?.forEach(app => {
      if (!app.bank_id || !bankStatsMap.has(app.bank_id)) return

      const bank = bankStatsMap.get(app.bank_id)
      bank.submissions.push(app)

      if (app.current_stage === 'DISBURSED') {
        bank.approved.push(app)
        bank.disbursedAmounts.push(app.loan_amount)

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

    // Calculate comparison metrics
    const formatCurrency = (amount: number) => {
      if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
      if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
      return `₹${amount.toLocaleString('en-IN')}`
    }

    const comparisonData = Array.from(bankStatsMap.values()).map(bank => {
      const totalSubmissions = bank.submissions.length
      const approvedCount = bank.approved.length
      const rejectedCount = bank.rejected.length
      const pendingCount = bank.pending.length

      const approvalRate = totalSubmissions > 0
        ? (approvedCount / totalSubmissions) * 100
        : 0

      const rejectionRate = totalSubmissions > 0
        ? (rejectedCount / totalSubmissions) * 100
        : 0

      const avgTAT = bank.tats.length > 0
        ? bank.tats.reduce((a: number, b: number) => a + b, 0) / bank.tats.length
        : 0

      const slaCompliance = bank.tats.length > 0
        ? (bank.tats.filter((t: number) => t <= bank.targetTAT).length / bank.tats.length) * 100
        : 0

      const totalDisbursed = bank.disbursedAmounts.reduce((a: number, b: number) => a + b, 0)
      const avgLoanAmount = bank.disbursedAmounts.length > 0
        ? totalDisbursed / bank.disbursedAmounts.length
        : 0

      return {
        bankId: bank.bankId,
        bankName: bank.bankName,
        bankLogo: bank.bankLogo,
        targetTAT: bank.targetTAT,
        totalSubmissions,
        approvedApplications: approvedCount,
        rejectedApplications: rejectedCount,
        pendingApplications: pendingCount,
        approvalRate,
        rejectionRate,
        avgTAT,
        slaCompliance,
        totalDisbursed,
        formattedDisbursed: formatCurrency(totalDisbursed),
        avgLoanAmount,
        formattedAvgLoan: formatCurrency(avgLoanAmount),
      }
    })

    // Calculate comparative insights
    const insights = []

    // Find best/worst performers
    const byApprovalRate = [...comparisonData].sort((a, b) => b.approvalRate - a.approvalRate)
    const byTAT = [...comparisonData].sort((a, b) => a.avgTAT - b.avgTAT)
    const byVolume = [...comparisonData].sort((a, b) => b.totalSubmissions - a.totalSubmissions)
    const byRevenue = [...comparisonData].sort((a, b) => b.totalDisbursed - a.totalDisbursed)

    if (byApprovalRate.length > 0) {
      insights.push({
        type: 'metric',
        category: 'Approval Rate',
        best: {
          bankName: byApprovalRate[0].bankName,
          value: byApprovalRate[0].approvalRate.toFixed(1) + '%',
        },
        worst: {
          bankName: byApprovalRate[byApprovalRate.length - 1].bankName,
          value: byApprovalRate[byApprovalRate.length - 1].approvalRate.toFixed(1) + '%',
        },
        difference: (byApprovalRate[0].approvalRate - byApprovalRate[byApprovalRate.length - 1].approvalRate).toFixed(1) + '%',
      })
    }

    if (byTAT.length > 0 && byTAT[0].avgTAT > 0) {
      insights.push({
        type: 'metric',
        category: 'Processing Speed',
        best: {
          bankName: byTAT[0].bankName,
          value: byTAT[0].avgTAT.toFixed(1) + ' days',
        },
        worst: {
          bankName: byTAT[byTAT.length - 1].bankName,
          value: byTAT[byTAT.length - 1].avgTAT.toFixed(1) + ' days',
        },
        difference: (byTAT[byTAT.length - 1].avgTAT - byTAT[0].avgTAT).toFixed(1) + ' days slower',
      })
    }

    if (byVolume.length > 0 && byVolume[0].totalSubmissions > 0) {
      insights.push({
        type: 'metric',
        category: 'Application Volume',
        best: {
          bankName: byVolume[0].bankName,
          value: byVolume[0].totalSubmissions.toString() + ' applications',
        },
        worst: {
          bankName: byVolume[byVolume.length - 1].bankName,
          value: byVolume[byVolume.length - 1].totalSubmissions.toString() + ' applications',
        },
        difference: (byVolume[0].totalSubmissions - byVolume[byVolume.length - 1].totalSubmissions).toString() + ' more',
      })
    }

    // Recommendation
    let recommendation = null
    if (byApprovalRate.length > 0 && byApprovalRate[0].approvalRate > 50) {
      const best = byApprovalRate[0]
      recommendation = {
        bankId: best.bankId,
        bankName: best.bankName,
        reason: `${best.bankName} has the highest approval rate at ${best.approvalRate.toFixed(1)}% with an average TAT of ${best.avgTAT.toFixed(1)} days.`,
        score: best.approvalRate + (best.slaCompliance * 0.5) - (best.avgTAT * 0.5),
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        banks: comparisonData,
        insights,
        recommendation,
        comparisonMetrics: [
          'Approval Rate',
          'Processing Speed (TAT)',
          'SLA Compliance',
          'Application Volume',
          'Total Disbursed',
          'Average Loan Amount',
        ],
      },
    })

  } catch (error) {
    apiLogger.error('Bank comparison API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
