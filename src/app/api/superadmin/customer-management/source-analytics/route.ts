
/**
 * Source Analytics API
 * SuperAdmin endpoint for customer acquisition source analytics
 *
 * GET - Fetch source analytics with timeframe filter
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Source type definitions
const SOURCE_CONFIG = {
  BUSINESS_ASSOCIATE: { displayName: 'Business Associate', icon: 'Briefcase' },
  EMPLOYEE: { displayName: 'Employee', icon: 'User' },
  DIRECT: { displayName: 'Direct', icon: 'Globe' },
  REFERENCE: { displayName: 'Reference', icon: 'Share2' },
} as const

type SourceType = keyof typeof SOURCE_CONFIG

/**
 * GET /api/superadmin/customer-management/source-analytics
 * Fetch customer acquisition source analytics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && auth.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d'

    // Calculate date range
    const now = new Date()
    let dateFrom: Date
    switch (timeframe) {
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Get month start and week start for period stats
    const monthStart = new Date(now)
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Fetch customer data grouped by acquisition source
    const { data: customers } = await supabaseAdmin
      .from('customer_identities')
      .select('id, acquisition_source, created_at, user_status')
      .gte('created_at', dateFrom.toISOString())

    // Build source metrics
    const sourceTypes: SourceType[] = ['BUSINESS_ASSOCIATE', 'EMPLOYEE', 'DIRECT', 'REFERENCE']
    const sourceMetrics = sourceTypes.map(source => {
      const config = SOURCE_CONFIG[source]
      const sourceCustomers = customers?.filter(c => c.acquisition_source === source) || []
      const totalCustomers = sourceCustomers.length
      const newThisMonth = sourceCustomers.filter(c => new Date(c.created_at) >= monthStart).length
      const newThisWeek = sourceCustomers.filter(c => new Date(c.created_at) >= weekStart).length

      return {
        source,
        displayName: config.displayName,
        icon: config.icon,
        color: source === 'BUSINESS_ASSOCIATE' ? 'orange'
          : source === 'EMPLOYEE' ? 'blue'
          : source === 'DIRECT' ? 'green'
          : 'purple',
        totalCustomers,
        newThisMonth,
        newThisWeek,
        conversionRate: 0, // Placeholder until loan application data is integrated
        avgLoanAmount: 0,
        totalLoanAmount: 0,
        pendingApplications: 0,
        approvedApplications: 0,
        trend: totalCustomers > 0 ? 'up' as const : 'neutral' as const,
        trendPercent: 0,
      }
    })

    // Fetch top contributors (partners/employees who referred customers)
    const topContributors = [] as Array<{
      id: string
      name: string
      email: string
      source: SourceType
      customersReferred: number
      totalLoanAmount: number
      conversionRate: number
      commission: number
    }>

    // Timeline data - daily counts for the timeframe
    const timelineData = [] as Array<{
      date: string
      businessAssociate: number
      employee: number
      direct: number
      reference: number
    }>

    // Generate timeline data from actual customer records
    const dayMs = 24 * 60 * 60 * 1000
    const days = Math.min(Math.ceil((now.getTime() - dateFrom.getTime()) / dayMs), 90)

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * dayMs)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart.getTime() + dayMs)

      const dayCustomers = customers?.filter(c => {
        const d = new Date(c.created_at)
        return d >= dayStart && d < dayEnd
      }) || []

      timelineData.push({
        date: dayStart.toISOString().split('T')[0],
        businessAssociate: dayCustomers.filter(c => c.acquisition_source === 'BUSINESS_ASSOCIATE').length,
        employee: dayCustomers.filter(c => c.acquisition_source === 'EMPLOYEE').length,
        direct: dayCustomers.filter(c => c.acquisition_source === 'DIRECT').length,
        reference: dayCustomers.filter(c => c.acquisition_source === 'REFERENCE').length,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        sourceMetrics,
        topContributors,
        timelineData,
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    apiLogger.error('Source Analytics GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
