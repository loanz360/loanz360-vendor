import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Direct Sales Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'DIRECT_SALES_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '6months'

    // Calculate date range based on period
    const endDate = new Date()
    const startDate = new Date()
    if (period === '3months') {
      startDate.setMonth(startDate.getMonth() - 3)
    } else if (period === '6months') {
      startDate.setMonth(startDate.getMonth() - 6)
    } else if (period === '12months') {
      startDate.setMonth(startDate.getMonth() - 12)
    }

    // Get team members (Direct Sales Executives reporting to this manager)
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('reporting_manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    const teamMemberIds = teamMembers?.map((m) => m.id) || []

    // Performance metrics - defaults until real deal/revenue tracking is implemented
    const metrics = {
      totalExecutives: teamMembers?.length || 0,
      activeExecutives: teamMembers?.length || 0,
      totalDeals: 0,
      closedDeals: 0,
      conversionRate: 0,
      totalRevenue: 0,
      avgDealSize: 0,
      mtdProgress: 0,
    }

    // Generate monthly performance data
    const monthlyPerformance = []
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    for (let i = 0; i < (period === '3months' ? 3 : period === '6months' ? 6 : 12); i++) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)

      monthlyPerformance.unshift({
        month: monthNames[date.getMonth()],
        deals: 0,
        revenue: '0.0',
        conversion: '0.0',
        activeExecutives: teamMembers?.length || 0,
      })
    }

    return NextResponse.json({
      metrics,
      monthlyPerformance,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in analytics API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
