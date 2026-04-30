
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

interface RejectAction {
  reason: string
  comments?: string
}

/**
 * POST /api/notifications/drafts/[id]/reject
 * Reject a draft notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check for Super Admin session
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    let isSuperAdmin = false
    let superAdminId: string | null = null
    let approverName = 'Unknown'

    if (superAdminSession) {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: session } = await supabaseAdmin
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (session && new Date(session.expires_at) > new Date()) {
        isSuperAdmin = true
        superAdminId = session.super_admin_id

        // Get super admin name
        const { data: admin } = await supabaseAdmin
          .from('super_admins')
          .select('name, email')
          .eq('id', superAdminId)
          .maybeSingle()

        if (admin) {
          approverName = admin.name || admin.email || 'Super Admin'
        }
      }
    }

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only Super Admins can reject notifications' },
        { status: 403 }
      )
    }

    const body = await request.json() as RejectAction

    if (!body.reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Get the draft
    const { data: draft, error: fetchError } = await supabaseAdmin
      .from('notification_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    if (draft.approval_status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Draft is not pending approval' },
        { status: 400 }
      )
    }

    // Update approval chain
    const approvalChain = draft.approval_chain || []
    const rejectionEntry = {
      role: 'super_admin',
      user_id: superAdminId,
      user_name: approverName,
      status: 'rejected',
      reason: body.reason,
      timestamp: new Date().toISOString(),
      comments: body.comments || null
    }

    // Find and update existing entry or add new one
    const existingIndex = approvalChain.findIndex(
      (entry: { role: string }) => entry.role === 'super_admin'
    )
    if (existingIndex >= 0) {
      approvalChain[existingIndex] = rejectionEntry
    } else {
      approvalChain.push(rejectionEntry)
    }

    // Update the draft
    const { data: updatedDraft, error: updateError } = await supabaseAdmin
      .from('notification_drafts')
      .update({
        approval_status: 'rejected',
        approval_chain: approvalChain,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    // Create audit log
    await supabaseAdmin
      .from('notification_audit_logs')
      .insert({
        notification_draft_id: id,
        action: 'rejected',
        performed_by: superAdminId,
        performed_by_name: approverName,
        comments: `Reason: ${body.reason}${body.comments ? `. Comments: ${body.comments}` : ''}`,
        created_at: new Date().toISOString()
      })
      .catch(err => {
        apiLogger.error('Audit log insert failed (non-blocking):', err)
      })

    return NextResponse.json({
      success: true,
      draft: updatedDraft,
      message: 'Draft rejected successfully'
    })
  } catch (error) {
    apiLogger.error('Error rejecting draft', error)
    return NextResponse.json(
      { error: 'Failed to reject draft' },
      { status: 500 }
    )
  }
}
