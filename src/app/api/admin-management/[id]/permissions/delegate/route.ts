import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/[id]/permissions/delegate
 * Delegate permission from one admin to another
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
    const { id: delegatorId } = await params
    const bodySchema = z.object({

      delegatee_id: z.string().uuid().optional(),

      module_key: z.string().optional(),

      delegated_permissions: z.string().optional(),

      delegation_reason: z.string().optional(),

      delegation_days: z.number().optional().default(7),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      delegatee_id,
      module_key,
      delegated_permissions,
      delegation_reason,
      delegation_days = 7
    } = body

    // Validate required fields
    if (!delegatee_id || !module_key || !delegated_permissions || !delegation_reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'delegatee_id, module_key, delegated_permissions, and delegation_reason are required'
        },
        { status: 400 }
      )
    }

    // Get delegator admin
    const { data: delegator, error: delegatorError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name')
      .eq('id', delegatorId)
      .eq('is_deleted', false)
      .maybeSingle()

    if (delegatorError || !delegator) {
      return NextResponse.json(
        { success: false, error: 'Delegator admin not found' },
        { status: 404 }
      )
    }

    // Get delegatee admin
    const { data: delegatee, error: delegateeError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name')
      .eq('id', delegatee_id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (delegateeError || !delegatee) {
      return NextResponse.json(
        { success: false, error: 'Delegatee admin not found' },
        { status: 404 }
      )
    }

    // Check if trying to delegate to self
    if (delegatorId === delegatee_id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delegate permission to yourself' },
        { status: 400 }
      )
    }

    // Delegate permission using database function
    const { data: delegationId, error: delegateError } = await supabase
      .rpc('delegate_admin_permission', {
        p_delegator_id: delegatorId,
        p_delegatee_id: delegatee_id,
        p_module_key: module_key,
        p_delegated_permissions: delegated_permissions,
        p_delegation_reason: delegation_reason,
        p_delegation_days: delegation_days
      })

    if (delegateError) {
      // Check if error is because delegator doesn't have delegation rights
      if (delegateError.message.includes('delegation rights')) {
        return NextResponse.json(
          { success: false, error: 'You do not have delegation rights for this module' },
          { status: 403 }
        )
      }
      throw delegateError
    }

    // Create audit log for delegator
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: delegatorId,
      p_action_type: 'permission_delegated',
      p_action_description: `${delegator.full_name} delegated permissions for module ${module_key} to ${delegatee.full_name} for ${delegation_days} days`,
      p_changes: JSON.stringify({
        module_key,
        delegatee: {
          id: delegatee_id,
          admin_unique_id: delegatee.admin_unique_id,
          full_name: delegatee.full_name
        },
        delegated_permissions,
        delegation_days,
        reason: delegation_reason
      }),
      p_performed_by: delegatorId,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    // Create audit log for delegatee
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: delegatee_id,
      p_action_type: 'permission_received',
      p_action_description: `Received delegated permissions for module ${module_key} from ${delegator.full_name} for ${delegation_days} days`,
      p_changes: JSON.stringify({
        module_key,
        delegator: {
          id: delegatorId,
          admin_unique_id: delegator.admin_unique_id,
          full_name: delegator.full_name
        },
        delegated_permissions,
        delegation_days,
        reason: delegation_reason
      }),
      p_performed_by: delegatorId,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + delegation_days)

    return NextResponse.json({
      success: true,
      message: `Permission delegated successfully to ${delegatee.full_name} for ${delegation_days} days`,
      data: {
        delegation_id: delegationId,
        delegator: {
          id: delegatorId,
          admin_unique_id: delegator.admin_unique_id,
          full_name: delegator.full_name
        },
        delegatee: {
          id: delegatee_id,
          admin_unique_id: delegatee.admin_unique_id,
          full_name: delegatee.full_name
        },
        module_key,
        delegation_days,
        expires_at: expiresAt.toISOString()
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Delegate Permission API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin-management/[id]/permissions/delegate
 * Get all delegations (sent and received) for an admin
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

    const type = searchParams.get('type') // 'sent' or 'received'
    const activeOnly = searchParams.get('active_only') === 'true'

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

    let delegationsSent = []
    let delegationsReceived = []

    // Get delegations sent by this admin
    if (!type || type === 'sent') {
      let sentQuery = supabase
        .from('admin_permission_delegations')
        .select(`
          *,
          delegatee:delegatee_id(id, admin_unique_id, full_name, email),
          system_modules!inner(module_key, module_name, module_description)
        `)
        .eq('delegator_id', id)

      if (activeOnly) {
        sentQuery = sentQuery
          .eq('is_active', true)
          .gt('valid_until', new Date().toISOString())
      }

      const { data: sent } = await sentQuery.order('created_at', { ascending: false })
      delegationsSent = sent || []
    }

    // Get delegations received by this admin
    if (!type || type === 'received') {
      let receivedQuery = supabase
        .from('admin_permission_delegations')
        .select(`
          *,
          delegator:delegator_id(id, admin_unique_id, full_name, email),
          system_modules!inner(module_key, module_name, module_description)
        `)
        .eq('delegatee_id', id)

      if (activeOnly) {
        receivedQuery = receivedQuery
          .eq('is_active', true)
          .gt('valid_until', new Date().toISOString())
      }

      const { data: received } = await receivedQuery.order('created_at', { ascending: false })
      delegationsReceived = received || []
    }

    // Add computed fields
    const enrichDelegations = (delegations: unknown[]) => delegations.map(delegation => ({
      ...delegation,
      is_expired: new Date(delegation.valid_until) < new Date(),
      days_remaining: Math.ceil(
        (new Date(delegation.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
      status: delegation.was_revoked
        ? 'revoked'
        : new Date(delegation.valid_until) < new Date()
          ? 'expired'
          : delegation.is_active
            ? 'active'
            : 'inactive'
    }))

    const sentEnriched = enrichDelegations(delegationsSent)
    const receivedEnriched = enrichDelegations(delegationsReceived)

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          admin_unique_id: admin.admin_unique_id,
          full_name: admin.full_name
        },
        delegations_sent: sentEnriched,
        delegations_received: receivedEnriched,
        summary: {
          total_sent: sentEnriched.length,
          active_sent: sentEnriched.filter(d => d.status === 'active').length,
          total_received: receivedEnriched.length,
          active_received: receivedEnriched.filter(d => d.status === 'active').length
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Get Delegations API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin-management/[id]/permissions/delegate
 * Revoke a delegation
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

    const delegationId = searchParams.get('delegation_id')
    const revokedBy = searchParams.get('revoked_by')
    const reason = searchParams.get('reason') || 'Not specified'

    if (!delegationId) {
      return NextResponse.json(
        { success: false, error: 'delegation_id is required' },
        { status: 400 }
      )
    }

    // Get delegation details
    const { data: delegation, error: delegationError } = await supabase
      .from('admin_permission_delegations')
      .select('*, delegator:delegator_id(admin_unique_id), delegatee:delegatee_id(admin_unique_id)')
      .eq('id', delegationId)
      .maybeSingle()

    if (delegationError || !delegation) {
      return NextResponse.json(
        { success: false, error: 'Delegation not found' },
        { status: 404 }
      )
    }

    // Verify that the requester is the delegator
    if (delegation.delegator_id !== id) {
      return NextResponse.json(
        { success: false, error: 'Only the delegator can revoke this delegation' },
        { status: 403 }
      )
    }

    // Revoke delegation
    const { error: revokeError } = await supabase
      .from('admin_permission_delegations')
      .update({
        is_active: false,
        was_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_by: revokedBy,
        revocation_reason: reason
      })
      .eq('id', delegationId)

    if (revokeError) throw revokeError

    // Deactivate the delegated permission
    await supabase
      .from('admin_granular_permissions')
      .update({ is_active: false })
      .eq('admin_id', delegation.delegatee_id)
      .eq('module_key', delegation.module_key)
      .eq('delegated_by', delegation.delegator_id)

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'delegation_revoked',
      p_action_description: `Revoked delegation for module ${delegation.module_key} to admin ${delegation.delegatee.admin_unique_id}`,
      p_changes: JSON.stringify({
        delegation_id: delegationId,
        module_key: delegation.module_key,
        reason
      }),
      p_performed_by: revokedBy,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Delegation revoked successfully',
      data: {
        delegation_id: delegationId,
        module_key: delegation.module_key
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Revoke Delegation API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
