export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyEmployee } from '@/lib/auth/verify-employee'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get online leads assigned to the employee
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const employee = await verifyEmployee(request)
    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('online_leads')
      .select('*, chatbots(id, name)', { count: 'exact' })
      .eq('assigned_to', employee.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: leads, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching leads', error)
      throw error
    }

    // Get stats for the employee
    const { data: statsData } = await supabase
      .from('online_leads')
      .select('status')
      .eq('assigned_to', employee.id)

    const stats = {
      total: statsData?.length || 0,
      new: statsData?.filter(l => l.status === 'new').length || 0,
      contacted: statsData?.filter(l => l.status === 'contacted').length || 0,
      qualified: statsData?.filter(l => l.status === 'qualified').length || 0,
      converted: statsData?.filter(l => l.status === 'converted').length || 0,
      not_interested: statsData?.filter(l => l.status === 'not_interested').length || 0,
      invalid: statsData?.filter(l => l.status === 'invalid').length || 0
    }

    return NextResponse.json({
      success: true,
      data: leads,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/employees/online-leads', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}
