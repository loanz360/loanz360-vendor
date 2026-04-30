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

    const body = await request.json()
    const { date } = body

    // Generate CSV content
    const csvHeader =
      'Executive Name,Check In Time,Check Out Time,Working Hours,Total KM,Total Meetings,Status\n'

    // Mock data - replace with actual data fetching
    const csvRows = [
      'John Doe,09:15 AM,06:30 PM,8.5,45.2,6,completed',
      'Jane Smith,09:00 AM,06:45 PM,9.2,52.8,7,completed',
      'Mike Johnson,09:30 AM,-,5.5,28.4,4,active',
      'Sarah Williams,09:10 AM,06:20 PM,8.8,38.9,5,completed',
      'David Brown,-,-,0,0,0,on_leave',
    ].join('\n')

    const csvContent = csvHeader + csvRows

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=team-activity-${date}.csv`,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in activity export API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
