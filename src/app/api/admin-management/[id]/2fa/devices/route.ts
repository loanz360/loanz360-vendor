import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { uuidParamSchema, formatValidationErrors } from '@/lib/validation/admin-validation'
import { handleApiError, parseSupabaseError } from '@/lib/errors/api-errors'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/2fa/devices
 * Get trusted devices for an admin
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

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data

    // Get trusted devices
    const { data: devices, error: devicesError } = await supabase
      .from('admin_2fa_trusted_devices')
      .select('*')
      .eq('admin_id', id)
      .eq('is_trusted', true)
      .gt('expires_at', new Date().toISOString())
      .order('last_used_at', { ascending: false })

    if (devicesError) {
      throw parseSupabaseError(devicesError)
    }

    return NextResponse.json({
      success: true,
      data: {
        devices: devices || [],
        count: devices?.length || 0,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA Devices API] Get devices error', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}

/**
 * DELETE /api/admin-management/[id]/2fa/devices
 * Revoke a trusted device
 *
 * Request body: { deviceId: string }
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

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data
    const bodySchema = z.object({

      deviceId: z.string().uuid(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { deviceId } = body

    if (!deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Device ID is required',
        },
        { status: 400 }
      )
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Revoke device
    const { error: revokeError } = await supabase
      .from('admin_2fa_trusted_devices')
      .update({
        is_trusted: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', deviceId)
      .eq('admin_id', id)

    if (revokeError) {
      throw parseSupabaseError(revokeError)
    }

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: '2fa_device_revoked',
      p_action_description: 'Trusted device revoked',
      p_changes: JSON.stringify({
        event: '2fa_device_revoked',
        device_id: deviceId,
      }),
      p_performed_by: null,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    })

    return NextResponse.json({
      success: true,
      message: 'Trusted device revoked successfully',
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA Devices API] Revoke device error', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}
