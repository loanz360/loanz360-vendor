import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { adminsToCSV } from '@/lib/utils/bulk-operations'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/bulk/export
 * Export admins to CSV with filters
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const bodySchema = z.object({

      status: z.string().optional(),

      location: z.string().optional(),

      created_after: z.string().optional(),

      created_before: z.string().optional(),

      has_2fa: z.string().optional(),

      include_modules: z.boolean().optional().default(false),

      exported_by_user_id: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      status,
      location,
      created_after,
      created_before,
      has_2fa,
      include_modules = false,
      exported_by_user_id
    } = body

    // Build query
    let query = supabase
      .from('admins')
      .select('*')
      .eq('is_deleted', false)

    if (status) {
      query = query.eq('status', status)
    }

    if (location) {
      query = query.eq('location', location)
    }

    if (created_after) {
      query = query.gte('created_at', created_after)
    }

    if (created_before) {
      query = query.lte('created_at', created_before)
    }

    if (has_2fa !== undefined) {
      query = query.eq('two_factor_enabled', has_2fa)
    }

    const { data: admins, error: adminsError } = await query
      .order('created_at', { ascending: false })
      .limit(10000) // Safety limit

    if (adminsError) throw adminsError

    if (!admins || admins.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No admins found matching the criteria' },
        { status: 404 }
      )
    }

    // If include_modules, fetch module permissions
    let adminsWithModules = admins
    if (include_modules) {
      adminsWithModules = await Promise.all(
        admins.map(async (admin) => {
          const { data: permissions } = await supabase
            .from('admin_module_permissions')
            .select('module_key')
            .eq('admin_id', admin.id)
            .eq('is_enabled', true)

          return {
            ...admin,
            enabled_modules: permissions?.map(p => p.module_key) || []
          }
        })
      )
    }

    // Convert to CSV
    const csvContent = adminsToCSV(adminsWithModules, include_modules)

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: exported_by_user_id,
      p_action_type: 'bulk_export',
      p_action_description: `Exported ${admins.length} admin(s) to CSV`,
      p_changes: JSON.stringify({
        count: admins.length,
        filters: { status, location, created_after, created_before, has_2fa }
      }),
      p_performed_by: exported_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    const filename = `admins_export_${new Date().toISOString().split('T')[0]}.csv`

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': csvContent.length.toString()
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Bulk Export API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
