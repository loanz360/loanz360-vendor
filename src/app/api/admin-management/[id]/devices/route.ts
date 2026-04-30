import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/devices
 * Get device history for an admin
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

    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Get device history
    const { data: devices, error: devicesError } = await supabase
      .from('admin_device_history')
      .select('*')
      .eq('admin_id', id)
      .order('last_seen_at', { ascending: false })

    if (devicesError) throw devicesError

    // Enhance device data
    const devicesWithStatus = devices?.map(device => ({
      ...device,
      days_since_last_seen: Math.floor(
        (Date.now() - new Date(device.last_seen_at).getTime()) / 1000 / 60 / 60 / 24
      ),
      is_active: new Date(device.last_seen_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Active in last 7 days
    }))

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          admin_unique_id: admin.admin_unique_id,
          full_name: admin.full_name
        },
        devices: devicesWithStatus || [],
        summary: {
          total_devices: devices?.length || 0,
          trusted_devices: devices?.filter(d => d.is_trusted).length || 0,
          blocked_devices: devices?.filter(d => d.is_blocked).length || 0,
          active_devices: devicesWithStatus?.filter(d => d.is_active).length || 0
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Devices API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin-management/[id]/devices
 * Update device status (trust/block)
 */
export async function PATCH(
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { device_fingerprint, is_trusted, is_blocked, updated_by } = body

    if (!device_fingerprint) {
      return NextResponse.json(
        { success: false, error: 'device_fingerprint is required' },
        { status: 400 }
      )
    }

    // Update device
    const { data, error: updateError } = await supabase
      .from('admin_device_history')
      .update({
        is_trusted: is_trusted !== undefined ? is_trusted : undefined,
        is_blocked: is_blocked !== undefined ? is_blocked : undefined
      })
      .eq('admin_id', id)
      .eq('device_fingerprint', device_fingerprint)
      .select()
      .maybeSingle()

    if (updateError) throw updateError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'security_device_updated',
      p_action_description: `Device status updated: ${is_trusted ? 'trusted' : is_blocked ? 'blocked' : 'updated'}`,
      p_changes: JSON.stringify({ device_fingerprint, is_trusted, is_blocked }),
      p_performed_by: updated_by,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Device updated successfully',
      data
    })
  } catch (error: unknown) {
    apiLogger.error('[Update Device API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
