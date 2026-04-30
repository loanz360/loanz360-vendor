
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/audit-logs
 * Get audit history for an admin with filters and pagination
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { id } = await params
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const action_type = searchParams.get('action_type') || ''
    const date_from = searchParams.get('date_from') || ''
    const date_to = searchParams.get('date_to') || ''

    // Calculate offset
    const offset = (page - 1) * limit

    // Check if admin exists
    const { data: admin } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name, email')
      .eq('id', id)
      .maybeSingle()

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found'
        },
        { status: 404 }
      )
    }

    // Build audit logs query
    let query = supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .eq('admin_id', id)

    // Apply filters
    if (action_type) {
      query = query.eq('action_type', action_type)
    }

    if (date_from) {
      query = query.gte('performed_at', date_from)
    }

    if (date_to) {
      query = query.lte('performed_at', date_to)
    }

    // Apply sorting and pagination
    query = query
      .order('performed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: auditLogs, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          admin_unique_id: admin.admin_unique_id,
          full_name: admin.full_name,
          email: admin.email
        },
        audit_logs: auditLogs || []
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error fetching audit logs', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
