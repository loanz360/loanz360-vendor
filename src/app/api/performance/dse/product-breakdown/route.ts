import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { DSEProductPerformance, ProductMixAnalysis } from '@/lib/types/dse-enhanced-performance.types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/dse/product-breakdown
 * Returns product-wise performance breakdown for the authenticated DSE.
 * Shows revenue, conversions, approval rates, and incentive earned per loan product.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

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

    // Validate params
    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }

    // Fetch product performance data
    const { data: productData, error: productError } = await adminClient
      .from('dse_product_performance')
      .select('*')
      .eq('dse_user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .order('revenue_generated', { ascending: false })

    if (productError) {
      apiLogger.error('Error fetching product performance', productError)
      return NextResponse.json({ error: 'Failed to fetch product data' }, { status: 500 })
    }

    const products: DSEProductPerformance[] = productData || []

    // Calculate totals
    const totalRevenue = products.reduce((sum, p) => sum + (p.revenue_generated || 0), 0)
    const totalLeads = products.reduce((sum, p) => sum + (p.leads_count || 0), 0)
    const totalConversions = products.reduce((sum, p) => sum + (p.conversions_count || 0), 0)

    // Generate product mix analysis with optimization suggestions
    const mixAnalysis: ProductMixAnalysis[] = products.map((p) => {
      const revenueShare = totalRevenue > 0 ? (p.revenue_generated / totalRevenue) * 100 : 0
      const volumeShare = totalLeads > 0 ? (p.leads_count / totalLeads) * 100 : 0

      // Simple recommendation logic based on conversion rates and revenue
      let recommendation = ''
      if (p.conversion_rate > 25 && revenueShare < 20) {
        recommendation = `High conversion rate (${p.conversion_rate.toFixed(1)}%) but low revenue share. Consider allocating more leads to ${p.product_type}.`
      } else if (p.conversion_rate < 10 && volumeShare > 30) {
        recommendation = `Low conversion rate on ${p.product_type}. Focus on lead qualification before field visits.`
      } else if (p.approval_rate > 80) {
        recommendation = `Excellent bank approval rate. This is a strong product for you.`
      } else if (p.approval_rate < 50 && p.applications_filed > 5) {
        recommendation = `Low approval rate. Review rejection reasons and improve application quality.`
      } else {
        recommendation = 'Performance is on track for this product.'
      }

      return {
        product_type: p.product_type,
        revenue_share_pct: Number(revenueShare.toFixed(1)),
        volume_share_pct: Number(volumeShare.toFixed(1)),
        incentive_rate: p.revenue_generated > 0 ? (p.incentive_earned / p.revenue_generated) * 100 : 0,
        current_incentive_earned: p.incentive_earned,
        potential_incentive: p.incentive_earned * (100 / Math.max(p.conversion_rate, 1)),
        recommendation,
      }
    })

    return NextResponse.json({
      products,
      mix_analysis: mixAnalysis,
      totals: {
        total_revenue: totalRevenue,
        total_leads: totalLeads,
        total_conversions: totalConversions,
        overall_conversion_rate: totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0,
        total_incentive_earned: products.reduce((sum, p) => sum + (p.incentive_earned || 0), 0),
      },
      period: { month, year },
    })
  } catch (error) {
    apiLogger.error('Error in product breakdown API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
