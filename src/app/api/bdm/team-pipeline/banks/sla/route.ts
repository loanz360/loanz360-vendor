import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId } from '@/lib/bdm/bde-utils'
import { parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

interface SLAMetrics {
  bankId: string
  bankName: string
  bankLogo: string | null
  targetTAT: number

  // Volume metrics
  totalApplications: number
  completedApplications: number

  // SLA compliance
  withinSLA: number
  breachedSLA: number
  slaComplianceRate: number

  // TAT breakdown
  avgTAT: number
  minTAT: number
  maxTAT: number
  medianTAT: number

  // Distribution
  tatDistribution: Array<{
    range: string
    count: number
    percentage: number
  }>

  // Trends
  trend: 'improving' | 'declining' | 'stable'
  monthlyCompliance: Array<{
    month: string
    complianceRate: number
    avgTAT: number
  }>

  // Risk indicators
  atRiskApplications: number
  escalatedApplications: number
}

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
        success: true,
        data: {
          slaMetrics: [],
          overallCompliance: 0,
          criticalBreaches: 0,
        },
      })
    }

    // Get all bank SLA configurations
    const { data: slaConfigs } = await supabase
      .from('bank_processing_sla')
      .select(`
        *,
        banks (
          id,
          name,
          logo_url
        )
      `)

    const slaMap = new Map(slaConfigs?.map(s => [
      s.bank_id,
      {
        targetTAT: s.target_tat_days,
        bankName: s.banks?.name || 'Unknown',
        bankLogo: s.banks?.logo_url || null,
      }
    ]) || [])

    // Fetch all completed applications
    const { data: applications } = await supabase
      .from('loan_applications')
      .select(`
        id,
        bank_id,
        current_stage,
        created_at,
        updated_at,
        priority
      `)
      .in('assigned_bde_id', bdeIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('bank_id', 'is', null)

    // Group by bank
    const bankMetricsMap = new Map<string, any>()

    applications?.forEach(app => {
      if (!app.bank_id) return

      const slaInfo = slaMap.get(app.bank_id)
      if (!slaInfo) return

      if (!bankMetricsMap.has(app.bank_id)) {
        bankMetricsMap.set(app.bank_id, {
          bankId: app.bank_id,
          bankName: slaInfo.bankName,
          bankLogo: slaInfo.bankLogo,
          targetTAT: slaInfo.targetTAT,
          allApplications: [],
          completedApplications: [],
          tats: [],
        })
      }

      const bank = bankMetricsMap.get(app.bank_id)
      bank.allApplications.push(app)

      if (app.current_stage === 'DISBURSED' || app.current_stage === 'REJECTED') {
        const tat = Math.ceil(
          (new Date(app.updated_at).getTime() - new Date(app.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        )

        bank.completedApplications.push(app)
        bank.tats.push({
          tat,
          withinSLA: tat <= slaInfo.targetTAT,
          priority: app.priority,
          completedDate: app.updated_at,
        })
      }
    })

    // Calculate metrics for each bank
    const slaMetrics: SLAMetrics[] = []

    bankMetricsMap.forEach((bank) => {
      const totalApplications = bank.allApplications.length
      const completedApplications = bank.completedApplications.length

      const withinSLA = bank.tats.filter((t: any) => t.withinSLA).length
      const breachedSLA = bank.tats.filter((t: any) => !t.withinSLA).length
      const slaComplianceRate = bank.tats.length > 0
        ? (withinSLA / bank.tats.length) * 100
        : 0

      const tatValues = bank.tats.map((t: any) => t.tat)
      const avgTAT = tatValues.length > 0
        ? tatValues.reduce((a: number, b: number) => a + b, 0) / tatValues.length
        : 0
      const minTAT = tatValues.length > 0 ? Math.min(...tatValues) : 0
      const maxTAT = tatValues.length > 0 ? Math.max(...tatValues) : 0

      // Calculate median
      const sorted = [...tatValues].sort((a, b) => a - b)
      const medianTAT = sorted.length > 0
        ? sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]
        : 0

      // TAT distribution
      const ranges = [
        { range: '0-7 days', min: 0, max: 7 },
        { range: '8-14 days', min: 8, max: 14 },
        { range: '15-21 days', min: 15, max: 21 },
        { range: '22-30 days', min: 22, max: 30 },
        { range: '30+ days', min: 31, max: Infinity },
      ]

      const tatDistribution = ranges.map(r => {
        const count = tatValues.filter((t: number) => t >= r.min && t <= r.max).length
        return {
          range: r.range,
          count,
          percentage: tatValues.length > 0 ? (count / tatValues.length) * 100 : 0,
        }
      })

      // Monthly compliance (last 3 months)
      const monthlyCompliance: Array<{
        month: string
        complianceRate: number
        avgTAT: number
      }> = []

      for (let i = 2; i >= 0; i--) {
        const monthStart = new Date(endDate)
        monthStart.setMonth(monthStart.getMonth() - i)
        monthStart.setDate(1)
        monthStart.setHours(0, 0, 0, 0)

        const monthEnd = new Date(monthStart)
        monthEnd.setMonth(monthEnd.getMonth() + 1)
        monthEnd.setDate(0)
        monthEnd.setHours(23, 59, 59, 999)

        const monthTats = bank.tats.filter((t: any) => {
          const date = new Date(t.completedDate)
          return date >= monthStart && date <= monthEnd
        })

        const monthWithinSLA = monthTats.filter((t: any) => t.withinSLA).length
        const monthComplianceRate = monthTats.length > 0
          ? (monthWithinSLA / monthTats.length) * 100
          : 0

        const monthAvgTAT = monthTats.length > 0
          ? monthTats.reduce((sum: number, t: any) => sum + t.tat, 0) / monthTats.length
          : 0

        monthlyCompliance.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          complianceRate: monthComplianceRate,
          avgTAT: monthAvgTAT,
        })
      }

      // Determine trend
      let trend: 'improving' | 'declining' | 'stable' = 'stable'
      if (monthlyCompliance.length >= 2) {
        const recent = monthlyCompliance[monthlyCompliance.length - 1].complianceRate
        const previous = monthlyCompliance[monthlyCompliance.length - 2].complianceRate
        const diff = recent - previous

        if (diff > 5) trend = 'improving'
        else if (diff < -5) trend = 'declining'
      }

      // At-risk applications (pending for > 70% of target TAT)
      const atRiskThreshold = bank.targetTAT * 0.7
      const now = new Date()
      const atRiskApplications = bank.allApplications.filter((app: any) => {
        if (app.current_stage === 'DISBURSED' || app.current_stage === 'REJECTED') return false
        const daysElapsed = Math.ceil(
          (now.getTime() - new Date(app.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        )
        return daysElapsed > atRiskThreshold
      }).length

      // Escalated (pending for > target TAT)
      const escalatedApplications = bank.allApplications.filter((app: any) => {
        if (app.current_stage === 'DISBURSED' || app.current_stage === 'REJECTED') return false
        const daysElapsed = Math.ceil(
          (now.getTime() - new Date(app.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        )
        return daysElapsed > bank.targetTAT
      }).length

      slaMetrics.push({
        bankId: bank.bankId,
        bankName: bank.bankName,
        bankLogo: bank.bankLogo,
        targetTAT: bank.targetTAT,
        totalApplications,
        completedApplications,
        withinSLA,
        breachedSLA,
        slaComplianceRate,
        avgTAT,
        minTAT,
        maxTAT,
        medianTAT,
        tatDistribution,
        trend,
        monthlyCompliance,
        atRiskApplications,
        escalatedApplications,
      })
    })

    // Sort by compliance rate
    slaMetrics.sort((a, b) => b.slaComplianceRate - a.slaComplianceRate)

    // Calculate overall metrics
    const overallCompliance = slaMetrics.length > 0
      ? slaMetrics.reduce((sum, m) => sum + m.slaComplianceRate, 0) / slaMetrics.length
      : 0

    const criticalBreaches = slaMetrics.reduce((sum, m) => sum + m.escalatedApplications, 0)

    return NextResponse.json({
      success: true,
      data: {
        slaMetrics,
        overallCompliance,
        criticalBreaches,
        totalBanks: slaMetrics.length,
        summary: {
          totalApplications: slaMetrics.reduce((sum, m) => sum + m.totalApplications, 0),
          completedApplications: slaMetrics.reduce((sum, m) => sum + m.completedApplications, 0),
          totalWithinSLA: slaMetrics.reduce((sum, m) => sum + m.withinSLA, 0),
          totalBreachedSLA: slaMetrics.reduce((sum, m) => sum + m.breachedSLA, 0),
          atRiskApplications: slaMetrics.reduce((sum, m) => sum + m.atRiskApplications, 0),
        },
      },
    })

  } catch (error) {
    apiLogger.error('Bank SLA API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
