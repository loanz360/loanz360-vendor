import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify user is Super Admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'today'

    const dateRange = getDateRange(range)

    // Get overview stats
    const { count: totalCROs } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'CRO')

    const { count: totalBDEs } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'BDE')

    const { count: totalContacts } = await supabase
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })

    const { count: totalLeads } = await supabase
      .from('crm_leads')
      .select('*', { count: 'exact', head: true })

    const { count: totalDeals } = await supabase
      .from('crm_deals')
      .select('*', { count: 'exact', head: true })

    const { count: totalCallsToday } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const { count: totalLeadsToday } = await supabase
      .from('crm_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    const { count: totalDealsToday } = await supabase
      .from('crm_deals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)

    // Get top CRO performers
    const { data: croMetrics } = await supabase
      .from('performance_metrics')
      .select('*, users!inner(full_name)')
      .eq('user_role', 'CRO')
      .gte('metric_date', dateRange.start)
      .lte('metric_date', dateRange.end)
      .order('ai_score', { ascending: false })
      .limit(5)

    const topCROs = croMetrics?.map((m: unknown) => ({
      id: m.user_id,
      name: m.users.full_name,
      callsMade: m.calls_made || 0,
      leadsCreated: m.leads_created || 0,
      avgAIRating: m.avg_ai_rating || 0,
      aiScore: m.ai_score || 0,
      grade: calculateGrade(m.ai_score || 0),
    })) || []

    // Get top BDE performers
    const { data: bdeMetrics } = await supabase
      .from('performance_metrics')
      .select('*, users!inner(full_name)')
      .eq('user_role', 'BDE')
      .gte('metric_date', dateRange.start)
      .lte('metric_date', dateRange.end)
      .order('deals_sanctioned', { ascending: false })
      .limit(5)

    const topBDEs = bdeMetrics?.map((m: unknown) => ({
      id: m.user_id,
      name: m.users.full_name,
      dealsInProgress: m.deals_in_progress || 0,
      dealsSanctioned: m.deals_sanctioned || 0,
      totalSanctionedAmount: m.total_sanctioned_amount || 0,
      conversionRate: m.conversion_rate || 0,
      grade: calculateGrade(
        calculateBDEScore(m.deals_sanctioned, m.conversion_rate, m.update_compliance)
      ),
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCROs: totalCROs || 0,
          totalBDEs: totalBDEs || 0,
          totalContacts: totalContacts || 0,
          totalLeads: totalLeads || 0,
          totalDeals: totalDeals || 0,
          totalCallsToday: totalCallsToday || 0,
          totalLeadsToday: totalLeadsToday || 0,
          totalDealsToday: totalDealsToday || 0,
        },
        croPerformance: {
          topPerformers: topCROs,
          avgMetrics: {
            callsPerDay: croMetrics?.reduce((sum, m) => sum + (m.calls_made || 0), 0) / (croMetrics?.length || 1) || 0,
            conversionRate: croMetrics?.reduce((sum, m) => sum + ((m.leads_converted || 0) / (m.leads_created || 1) * 100), 0) / (croMetrics?.length || 1) || 0,
            avgAIRating: croMetrics?.reduce((sum, m) => sum + (m.avg_ai_rating || 0), 0) / (croMetrics?.length || 1) || 0,
          },
        },
        bdePerformance: {
          topPerformers: topBDEs,
          avgMetrics: {
            avgDaysToSanction: bdeMetrics?.reduce((sum, m) => sum + (m.avg_days_to_sanction || 0), 0) / (bdeMetrics?.length || 1) || 0,
            avgConversionRate: bdeMetrics?.reduce((sum, m) => sum + (m.conversion_rate || 0), 0) / (bdeMetrics?.length || 1) || 0,
            totalSanctionedAmount: bdeMetrics?.reduce((sum, m) => sum + (m.total_sanctioned_amount || 0), 0) || 0,
          },
        },
      },
    })
  } catch (error) {
    apiLogger.error('Analytics error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, message: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

function getDateRange(range: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (range) {
    case 'today':
      return {
        start: today.toISOString(),
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }
    case 'week':
      const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      return {
        start: weekStart.toISOString(),
        end: today.toISOString(),
      }
    case 'month':
      const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      return {
        start: monthStart.toISOString(),
        end: today.toISOString(),
      }
    case 'quarter':
      const quarterStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
      return {
        start: quarterStart.toISOString(),
        end: today.toISOString(),
      }
    default:
      return {
        start: today.toISOString(),
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }
  }
}

function calculateGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

function calculateBDEScore(sanctioned: number, conversionRate: number, compliance: number): number {
  return Math.round(sanctioned * 5 * 0.4 + conversionRate * 0.3 + compliance * 0.3)
}
