
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/2fa/trusted-devices
 * Get all trusted devices for an admin
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
      .select('id, admin_unique_id, two_factor_enabled')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Get trusted devices
    const { data: devices, error: devicesError } = await supabase
      .from('admin_trusted_devices')
      .select('*')
      .eq('admin_id', id)
      .eq('is_active', true)
      .order('last_used_at', { ascending: false })

    if (devicesError) throw devicesError

    // Add current device indicator
    const currentIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const devicesWithStatus = devices?.map(device => ({
      ...device,
      is_current: device.ip_address === currentIP,
      expires_in_days: Math.ceil(
        (new Date(device.trusted_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    }))

    return NextResponse.json({
      success: true,
      data: {
        devices: devicesWithStatus || [],
        total: devices?.length || 0
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Trusted Devices API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin-management/[id]/2fa/trusted-devices
 * Revoke a trusted device or all trusted devices
 */
export async function DELETE(
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

    const deviceId = searchParams.get('device_id')
    const revokeAll = searchParams.get('revoke_all') === 'true'
    const revokedBy = searchParams.get('revoked_by')

    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    let revokedCount = 0

    if (revokeAll) {
      // Revoke all devices
      const { error: revokeError } = await supabase
        .from('admin_trusted_devices')
        .update({ is_active: false })
        .eq('admin_id', id)
        .eq('is_active', true)

      if (revokeError) throw revokeError

      // Count revoked
      const { count } = await supabase
        .from('admin_trusted_devices')
        .select('*', { count: 'exact', head: true })
        .eq('admin_id', id)
        .eq('is_active', false)

      revokedCount = count || 0

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: id,
        p_action_type: 'security_trusted_devices_revoked_all',
        p_action_description: `All trusted devices were revoked for admin ${admin.admin_unique_id}`,
        p_changes: JSON.stringify({ devices_revoked: revokedCount }),
        p_performed_by: revokedBy,
        p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        p_user_agent: request.headers.get('user-agent') || 'unknown'
      })
    } else if (deviceId) {
      // Revoke specific device
      const { error: revokeError } = await supabase.rpc('revoke_trusted_device', {
        p_device_id: deviceId
      })

      if (revokeError) throw revokeError

      revokedCount = 1

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: id,
        p_action_type: 'security_trusted_device_revoked',
        p_action_description: `A trusted device was revoked for admin ${admin.admin_unique_id}`,
        p_changes: JSON.stringify({ device_id: deviceId }),
        p_performed_by: revokedBy,
        p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        p_user_agent: request.headers.get('user-agent') || 'unknown'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Either device_id or revoke_all=true is required' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: revokeAll
        ? `All trusted devices (${revokedCount}) have been revoked`
        : 'Trusted device has been revoked',
      data: {
        revoked_count: revokedCount
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Revoke Trusted Device API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
