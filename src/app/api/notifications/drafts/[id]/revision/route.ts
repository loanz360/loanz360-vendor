export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

interface RevisionRequest {
  feedback: string
  requested_changes?: string[]
}

/**
 * POST /api/notifications/drafts/[id]/revision
 * Request revision for a draft notification
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
    let reviewerName = 'Unknown'

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
          reviewerName = admin.name || admin.email || 'Super Admin'
        }
      }
    }

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only Super Admins can request revisions' },
        { status: 403 }
      )
    }

    const body = await request.json() as RevisionRequest

    if (!body.feedback) {
      return NextResponse.json(
        { error: 'Feedback is required when requesting revision' },
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

    // Update approval chain with revision request
    const approvalChain = draft.approval_chain || []
    const revisionEntry = {
      role: 'super_admin',
      user_id: superAdminId,
      user_name: reviewerName,
      status: 'revision_requested',
      feedback: body.feedback,
      requested_changes: body.requested_changes || [],
      timestamp: new Date().toISOString()
    }

    // Find and update existing entry or add new one
    const existingIndex = approvalChain.findIndex(
      (entry: { role: string }) => entry.role === 'super_admin'
    )
    if (existingIndex >= 0) {
      approvalChain[existingIndex] = revisionEntry
    } else {
      approvalChain.push(revisionEntry)
    }

    // Update the draft - set back to 'draft' status for revision
    const { data: updatedDraft, error: updateError } = await supabaseAdmin
      .from('notification_drafts')
      .update({
        approval_status: 'draft', // Set back to draft for editing
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
        action: 'revision_requested',
        performed_by: superAdminId,
        performed_by_name: reviewerName,
        comments: body.feedback,
        metadata: { requested_changes: body.requested_changes || [] },
        created_at: new Date().toISOString()
      })
      .catch(err => {
        apiLogger.error('Audit log insert failed (non-blocking):', err)
      })

    return NextResponse.json({
      success: true,
      draft: updatedDraft,
      message: 'Revision requested successfully. Draft has been sent back for editing.'
    })
  } catch (error) {
    apiLogger.error('Error requesting revision', error)
    return NextResponse.json(
      { error: 'Failed to request revision' },
      { status: 500 }
    )
  }
}
