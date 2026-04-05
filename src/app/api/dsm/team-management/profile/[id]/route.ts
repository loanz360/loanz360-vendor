import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'DIRECT_SALES_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const dseId = params.id

    // Get DSE profile
    const { data: dseProfile, error: dseError } = await supabase
      .from('users')
      .select('*')
      .eq('id', dseId)
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('reporting_manager_id', user.id)
      .maybeSingle()

    if (dseError || !dseProfile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Monthly performance data - defaults until real tracking is implemented
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const monthlyPerformance = monthNames.map((month) => ({
      month,
      deals: 0,
      revenue: '0.0',
      target: '0.0',
    }))

    // Recent activities - empty until activity tracking is implemented
    const recentActivities: Array<{
      date: string
      type: string
      description: string
      status: string
    }> = []

    // Current location - defaults until real GPS tracking is integrated
    const currentLocation = {
      latitude: 0,
      longitude: 0,
      address: dseProfile.location || 'Not available',
      lastUpdated: new Date().toISOString(),
    }

    const profile = {
      id: dseProfile.id,
      name: dseProfile.full_name || 'Unknown',
      email: dseProfile.email || '',
      phone: dseProfile.phone || 'N/A',
      location: dseProfile.location || 'Not specified',
      avatar: dseProfile.avatar_url,
      designation: 'Direct Sales Executive',
      joiningDate: dseProfile.created_at,
      reportingTo: userData.full_name || 'Direct Sales Manager',
      rank: 0,
      totalDeals: 0,
      closedDeals: 0,
      revenue: 0,
      conversionRate: 0,
      targetAchievement: 0,
      monthlyPerformance,
      recentActivities,
      currentLocation,
    }

    return NextResponse.json({ profile })
  } catch (error: unknown) {
    apiLogger.error('Error in profile API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
