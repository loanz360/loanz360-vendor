
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/[id]/2fa/disable
 * Disable 2FA for an admin
 */
export async function POST(
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
    const body = await request.json()

    const { disabled_by_user_id, reason } = body

    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Check if 2FA is enabled
    if (!admin.two_factor_enabled) {
      return NextResponse.json(
        { success: false, error: '2FA is not enabled for this admin' },
        { status: 400 }
      )
    }

    // Disable 2FA and clear secrets
    const { error: updateError } = await supabase
      .from('admins')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null,
        two_factor_enabled_at: null,
        two_factor_last_used_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Revoke all trusted devices
    await supabase
      .from('admin_trusted_devices')
      .update({ is_active: false })
      .eq('admin_id', id)

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'security_2fa_disabled',
      p_action_description: `Two-Factor Authentication was disabled for admin ${admin.admin_unique_id}${reason ? ` - Reason: ${reason}` : ''}`,
      p_changes: JSON.stringify({
        two_factor_enabled: false,
        reason: reason || 'Not specified'
      }),
      p_performed_by: disabled_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: '2FA has been disabled successfully',
      data: {
        two_factor_enabled: false,
        trusted_devices_revoked: true
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA Disable API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
