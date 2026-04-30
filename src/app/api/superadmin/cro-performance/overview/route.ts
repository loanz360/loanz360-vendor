
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - CRO Performance Overview for admin dashboard
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    // Get all CRO monthly summaries for the specified period
    const { data: summaries, error: summaryError } = await supabase
      .from('cro_monthly_summary')
      .select(`
        *,
        cro:users!cro_monthly_summary_cro_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('month', month)
      .eq('year', year)
      .order('performance_score', { ascending: false })

    if (summaryError) {
      apiLogger.error('Error fetching summaries', summaryError)
    }

    // Get total CROs
    const { count: totalCros } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .or('sub_role.eq.CRO,sub_role.eq.cro')
      .eq('status', 'ACTIVE')

    // Get targets assigned for the month
    const { count: targetsAssigned } = await supabase
      .from('cro_targets')
      .select('*', { count: 'exact', head: true })
      .eq('month', month)
      .eq('year', year)

    // Calculate averages
    const performanceData = summaries || []
    const avgScore = performanceData.length > 0
      ? performanceData.reduce((sum, s) => sum + (s.performance_score || 0), 0) / performanceData.length
      : 0

    const avgConversion = performanceData.length > 0
      ? performanceData.reduce((sum, s) => sum + (s.conversion_rate || 0), 0) / performanceData.length
      : 0

    const totalRevenue = performanceData.reduce((sum, s) => sum + (s.total_revenue || 0), 0)
    const totalDisbursements = performanceData.reduce((sum, s) => sum + (s.total_cases_disbursed || 0), 0)

    // Grade distribution
    const gradeDistribution = {
      'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0
    }
    performanceData.forEach((s: Record<string, any>) => {
      if (s.performance_grade && gradeDistribution.hasOwnProperty(s.performance_grade)) {
        gradeDistribution[s.performance_grade as keyof typeof gradeDistribution]++
      }
    })

    // Top performers
    const topPerformers = performanceData.slice(0, 5).map((s: Record<string, any>) => ({
      cro_id: s.cro_id,
      name: s.cro?.full_name || 'Unknown',
      score: s.performance_score,
      grade: s.performance_grade,
      revenue: s.total_revenue,
      conversions: s.total_leads_converted
    }))

    // Bottom performers (need attention)
    const needAttention = performanceData
      .filter(s => (s.performance_score || 0) < 60)
      .slice(0, 5)
      .map(s => ({
        cro_id: s.cro_id,
        name: s.cro?.full_name || 'Unknown',
        score: s.performance_score,
        grade: s.performance_grade,
        issues: []
      }))

    return NextResponse.json({
      success: true,
      data: {
        period: { month, year },
        summary: {
          total_cros: totalCros || 0,
          targets_assigned: targetsAssigned || 0,
          average_score: Math.round(avgScore * 100) / 100,
          average_conversion_rate: Math.round(avgConversion * 100) / 100,
          total_revenue: totalRevenue,
          total_disbursements: totalDisbursements
        },
        grade_distribution: gradeDistribution,
        top_performers: topPerformers,
        need_attention: needAttention,
        all_cros: performanceData.map((s: Record<string, any>) => ({
          cro_id: s.cro_id,
          name: s.cro?.full_name || 'Unknown',
          email: s.cro?.email || '',
          score: s.performance_score,
          grade: s.performance_grade,
          rank: s.company_rank,
          calls: s.total_calls_made,
          conversions: s.total_leads_converted,
          revenue: s.total_revenue,
          disbursed: s.total_cases_disbursed
        }))
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET /cro-performance/overview', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
