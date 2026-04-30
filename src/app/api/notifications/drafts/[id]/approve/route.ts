
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

interface ApprovalAction {
  action: 'approve' | 'reject'
  comments?: string
}

/**
 * POST /api/notifications/drafts/[id]/approve
 * Approve or reject a draft notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

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
        { error: 'Only Super Admins can approve or reject notifications' },
        { status: 403 }
      )
    }

    const body = await request.json() as ApprovalAction

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
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
    const approvalEntry = {
      role: 'super_admin',
      user_id: superAdminId,
      user_name: approverName,
      status: body.action === 'approve' ? 'approved' : 'rejected',
      timestamp: new Date().toISOString(),
      comments: body.comments || null
    }

    // Find and update existing entry or add new one
    const existingIndex = approvalChain.findIndex(
      (entry: { role: string }) => entry.role === 'super_admin'
    )
    if (existingIndex >= 0) {
      approvalChain[existingIndex] = approvalEntry
    } else {
      approvalChain.push(approvalEntry)
    }

    const newStatus = body.action === 'approve' ? 'approved' : 'rejected'

    // Update the draft
    const { data: updatedDraft, error: updateError } = await supabaseAdmin
      .from('notification_drafts')
      .update({
        approval_status: newStatus,
        approval_chain: approvalChain,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    // If approved, optionally send the notification
    if (body.action === 'approve' && draft.settings?.auto_send_on_approval) {
      // Trigger notification send - this could be implemented to call the send API
      // For now, we'll just mark it as approved and let the user manually send
    }

    // Create audit log
    await supabaseAdmin
      .from('notification_audit_logs')
      .insert({
        notification_draft_id: id,
        action: body.action,
        performed_by: superAdminId,
        performed_by_name: approverName,
        comments: body.comments,
        created_at: new Date().toISOString()
      })
      .catch(err => {
        apiLogger.error('Audit log insert failed (non-blocking):', err)
      })

    return NextResponse.json({
      success: true,
      draft: updatedDraft,
      message: `Draft ${body.action === 'approve' ? 'approved' : 'rejected'} successfully`
    })
  } catch (error) {
    apiLogger.error('Error processing approval', error)
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    )
  }
}
