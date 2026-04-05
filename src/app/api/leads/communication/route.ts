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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')

    // Return empty communications - real implementation requires communication_log table
    return NextResponse.json({
      success: true,
      data: {
        communications: [],
        stats: {
          totalCalls: 0,
          totalEmails: 0,
          totalSms: 0,
          totalMeetings: 0,
          avgResponseTime: 0,
          callSuccessRate: 0,
          emailOpenRate: 0
        },
        pagination: { page, limit, total: 0, totalPages: 0 }
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching communications', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch communications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { leadId, type } = body

    if (!leadId || !type) {
      return NextResponse.json(
        { success: false, error: 'Lead ID and type are required' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: false,
      error: 'Communication logging not yet implemented',
    }, { status: 501 })
  } catch (error) {
    apiLogger.error('Error creating communication', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create communication' },
      { status: 500 }
    )
  }
}
