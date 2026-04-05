export const dynamic = 'force-dynamic'

import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange') || 'this_month'
    const loanType = searchParams.get('loanType')

    // Return empty analytics structure - real implementation requires leads table aggregation
    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalLeads: 0,
          newLeadsToday: 0,
          conversionRate: 0,
          avgDealSize: 0,
          pipelineValue: 0,
          slaCompliance: 0,
          avgResponseTime: 0
        },
        trends: { leads: [], conversions: [], revenue: [] },
        conversionFunnel: [],
        sourceBreakdown: [],
        performanceByLoanType: [],
        topPerformers: [],
        slaMetrics: { overall: 0, byStage: [], breachCount: 0, atRiskCount: 0 },
        qualityDistribution: [],
      },
      meta: { dateRange, loanType, generatedAt: new Date().toISOString() }
    })
  } catch (error) {
    apiLogger.error('Error fetching analytics', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
