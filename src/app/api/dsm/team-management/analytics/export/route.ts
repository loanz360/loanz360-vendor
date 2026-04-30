import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function POST(request: NextRequest) {
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { period } = body

    // Generate CSV content
    const csvHeader = 'Month,Deals Closed,Revenue (₹),Conversion Rate (%),Active Executives\n'

    // Default empty data - TODO: fetch actual analytics from database
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const csvRows = monthNames
      .map(
        (month) =>
          `${month},0,0.00,0.00,0`
      )
      .join('\n')

    const csvContent = csvHeader + csvRows

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=team-analytics-${new Date().toISOString().split('T')[0]}.csv`,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in analytics export API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
