
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

/**
 * GET /api/admin-management/performance
 * Get performance metrics for an admin
 */
export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const adminId = searchParams.get('adminId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('admin_performance_metrics')
      .select('*')
      .eq('admin_id', adminId)
      .order('metric_date', { ascending: false })

    if (startDate) {
      query = query.gte('metric_date', startDate)
    }

    if (endDate) {
      query = query.lte('metric_date', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(
      {
        success: true,
        metrics: data || [],
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'fetch performance metrics')
  }
}
