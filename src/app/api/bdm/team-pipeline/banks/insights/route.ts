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
    const bankId = searchParams.get('bankId')

    if (!bankId) {
      return NextResponse.json(
        { success: false, error: 'Bank ID required' },
        { status: 400 }
      )
    }

    const { range, startDate, endDate } = parseDateRangeParams(searchParams)

    // Get BDEs under this BDM
    const { data: bdeData } = await supabase
      .from('employee_profiles')
      .select('user_id, full_name')
      .eq('reporting_manager_id', bdmId)
      .eq('role', 'business_development_executive')

    const bdeIds = bdeData?.map(b => b.user_id) || []
    const bdeMap = new Map(bdeData?.map(b => [b.user_id, b.full_name]) || [])

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No BDEs found',
      }, { status: 404 })
    }

    // Get bank details
    const { data: bankData } = await supabase
      .from('banks')
      .select('*')
      .eq('id', bankId)
      .maybeSingle()

    if (!bankData) {
      return NextResponse.json({
        success: false,
        error: 'Bank not found',
      }, { status: 404 })
    }

    // Get bank SLA
    const { data: slaData } = await supabase
      .from('bank_processing_sla')
      .select('*')
      .eq('bank_id', bankId)
      .maybeSingle()

    const targetTAT = slaData?.target_tat_days || 30

    // Fetch applications for this bank
    const { data: applications } = await supabase
      .from('loan_applications')
      .select(`
        id,
        customer_name,
        customer_phone,
        loan_type,
        loan_amount,
        current_stage,
        priority,
        created_at,
        updated_at,
        assigned_bde_id
      `)
      .eq('bank_id', bankId)
      .in('assigned_bde_id', bdeIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    // Process applications
    const approved = applications?.filter(a => a.current_stage === 'DISBURSED') || []
    const rejected = applications?.filter(a => a.current_stage === 'REJECTED') || []
    const pending = applications?.filter(a =>
      !['DISBURSED', 'REJECTED'].includes(a.current_stage)
    ) || []

    const totalSubmissions = applications?.length || 0
    const approvalRate = totalSubmissions > 0 ? (approved.length / totalSubmissions) * 100 : 0
    const rejectionRate = totalSubmissions > 0 ? (rejected.length / totalSubmissions) * 100 : 0

    // Calculate TAT metrics
    const tats = approved.map(app => {
      return Math.ceil(
        (new Date(app.updated_at).getTime() - new Date(app.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
      )
    })

    const avgTAT = tats.length > 0 ? tats.reduce((a, b) => a + b, 0) / tats.length : 0
    const minTAT = tats.length > 0 ? Math.min(...tats) : 0
    const maxTAT = tats.length > 0 ? Math.max(...tats) : 0
    const slaCompliant = tats.filter(t => t <= targetTAT).length
    const slaCompliance = tats.length > 0 ? (slaCompliant / tats.length) * 100 : 0

    // Revenue metrics
    const totalDisbursed = approved.reduce((sum, app) => sum + (app.loan_amount || 0), 0)
    const avgLoanAmount = approved.length > 0 ? totalDisbursed / approved.length : 0

    const formatCurrency = (amount: number) => {
      if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
      if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
      return `₹${amount.toLocaleString('en-IN')}`
    }

    // Loan type breakdown
    const loanTypeMap = new Map<string, number>()
    applications?.forEach(app => {
      const type = app.loan_type || 'UNKNOWN'
      loanTypeMap.set(type, (loanTypeMap.get(type) || 0) + 1)
    })

    const loanTypeBreakdown = Array.from(loanTypeMap.entries()).map(([type, count]) => ({
      loanType: type,
      loanTypeLabel: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      count,
      percentage: totalSubmissions > 0 ? (count / totalSubmissions) * 100 : 0,
    }))

    // BDE performance breakdown
    const bdeMap2 = new Map<string, unknown>()
    applications?.forEach(app => {
      if (!app.assigned_bde_id) return

      if (!bdeMap2.has(app.assigned_bde_id)) {
        bdeMap2.set(app.assigned_bde_id, {
          bdeId: app.assigned_bde_id,
          bdeName: bdeMap.get(app.assigned_bde_id) || 'Unknown',
          submissions: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
        })
      }

      const bde = bdeMap2.get(app.assigned_bde_id)
      bde.submissions++
      if (app.current_stage === 'DISBURSED') bde.approved++
      else if (app.current_stage === 'REJECTED') bde.rejected++
      else bde.pending++
    })

    const bdePerformance = Array.from(bdeMap2.values()).map(bde => ({
      ...bde,
      approvalRate: bde.submissions > 0 ? (bde.approved / bde.submissions) * 100 : 0,
    }))

    // Stage distribution
    const stageMap = new Map<string, number>()
    applications?.forEach(app => {
      const stage = app.current_stage || 'UNKNOWN'
      stageMap.set(stage, (stageMap.get(stage) || 0) + 1)
    })

    const stageBreakdown = Array.from(stageMap.entries()).map(([stage, count]) => ({
      stage,
      stageLabel: stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      count,
      percentage: totalSubmissions > 0 ? (count / totalSubmissions) * 100 : 0,
    }))

    // Recent applications
    const recentApplications = (applications || []).slice(0, 10).map(app => ({
      id: app.id,
      customerName: app.customer_name,
      customerPhone: app.customer_phone,
      loanType: app.loan_type,
      loanTypeLabel: app.loan_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '',
      loanAmount: app.loan_amount,
      formattedAmount: formatCurrency(app.loan_amount || 0),
      currentStage: app.current_stage,
      currentStageLabel: app.current_stage?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '',
      priority: app.priority,
      createdAt: app.created_at,
      createdAtFormatted: new Date(app.created_at).toLocaleDateString('en-IN'),
      bdeName: bdeMap.get(app.assigned_bde_id!) || 'Unknown',
    }))

    // Generate insights
    const insights = []

    if (approvalRate > 70) {
      insights.push({
        type: 'positive',
        title: 'High Approval Rate',
        description: `${bankData.name} has a ${approvalRate.toFixed(1)}% approval rate, which is excellent.`,
        priority: 'low',
      })
    } else if (approvalRate < 40) {
      insights.push({
        type: 'warning',
        title: 'Low Approval Rate',
        description: `${bankData.name} has a ${approvalRate.toFixed(1)}% approval rate. Consider reviewing submission criteria.`,
        priority: 'high',
      })
    }

    if (slaCompliance > 80) {
      insights.push({
        type: 'positive',
        title: 'Excellent SLA Compliance',
        description: `${slaCompliance.toFixed(1)}% of applications meet the ${targetTAT}-day SLA target.`,
        priority: 'low',
      })
    } else if (slaCompliance < 50) {
      insights.push({
        type: 'alert',
        title: 'SLA Compliance Issue',
        description: `Only ${slaCompliance.toFixed(1)}% of applications meet the SLA. Average TAT is ${avgTAT.toFixed(1)} days vs ${targetTAT} target.`,
        priority: 'high',
      })
    }

    if (pending.length > approved.length * 2) {
      insights.push({
        type: 'warning',
        title: 'High Pending Applications',
        description: `${pending.length} applications are pending with ${bankData.name}. Consider follow-ups.`,
        priority: 'medium',
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        bank: {
          id: bankData.id,
          name: bankData.name,
          logo: bankData.logo_url,
          description: bankData.description,
          targetTAT,
        },
        metrics: {
          totalSubmissions,
          approvedApplications: approved.length,
          rejectedApplications: rejected.length,
          pendingApplications: pending.length,
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
        },
        loanTypeBreakdown,
        stageBreakdown,
        bdePerformance,
        recentApplications,
        insights,
      },
    })

  } catch (error) {
    apiLogger.error('Bank insights API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
