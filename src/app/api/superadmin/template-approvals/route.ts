import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Template Approval Workflow API
 * Enterprise-grade template lifecycle management
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// =====================================================
// GET: Fetch templates pending approval
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify super admin
    const adminSupabase = createSupabaseAdmin()
    const { data: superAdmin } = await adminSupabase
      .from('super_admins')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending_review'
    const templateType = searchParams.get('type')

    // Fetch approvals with template data
    let query = adminSupabase
      .from('template_approvals')
      .select(`
        *,
        template:template_id (
          id,
          template_code,
          template_name,
          subject,
          content,
          content_html,
          template_type,
          variables,
          category
        ),
        submitter:submitted_by (
          id,
          email
        ),
        reviewer:reviewed_by (
          id,
          email
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (templateType) {
      query = query.eq('template_type', templateType)
    }

    const { data, error } = await query

    if (error) {
      apiLogger.error('[TemplateApprovals] GET error', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0
    })
  } catch (error: unknown) {
    apiLogger.error('[TemplateApprovals] GET error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// POST: Submit template for approval
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      templateId: z.string().uuid().optional(),


      templateType: z.string().optional(),


      approvalId: z.string().uuid().optional(),


      action: z.string().optional(),


      comments: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { templateId, templateType } = body

    if (!templateId || !templateType) {
      return NextResponse.json({
        success: false,
        error: 'templateId and templateType are required'
      }, { status: 400 })
    }

    const adminSupabase = createSupabaseAdmin()

    // Check if template exists
    const { data: template, error: templateError } = await adminSupabase
      .from('communication_templates')
      .select('id, version')
      .eq('id', templateId)
      .maybeSingle()

    if (templateError || !template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    // Check if there's already a pending approval
    const { data: existingApproval } = await adminSupabase
      .from('template_approvals')
      .select('id')
      .eq('template_id', templateId)
      .eq('status', 'pending_review')
      .maybeSingle()

    if (existingApproval) {
      return NextResponse.json({
        success: false,
        error: 'Template already has a pending approval request'
      }, { status: 400 })
    }

    // Create version snapshot
    const { data: templateData } = await adminSupabase
      .from('communication_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle()

    if (templateData) {
      await adminSupabase
        .from('template_versions')
        .insert({
          template_id: templateId,
          version: (template.version || 0) + 1,
          template_code: templateData.template_code,
          template_name: templateData.template_name,
          subject: templateData.subject,
          content: templateData.content,
          content_html: templateData.content_html,
          variables: templateData.variables,
          variable_descriptions: templateData.variable_descriptions,
          template_type: templateData.template_type,
          category: templateData.category,
          tags: templateData.tags,
          dlt_template_id: templateData.dlt_template_id,
          created_by: user.id,
          change_summary: 'Submitted for approval'
        })
    }

    // Create approval request
    const { data: approval, error: approvalError } = await adminSupabase
      .from('template_approvals')
      .insert({
        template_id: templateId,
        template_type: templateType,
        version: (template.version || 0) + 1,
        status: 'pending_review',
        submitted_by: user.id,
        submitted_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (approvalError) {
      apiLogger.error('[TemplateApprovals] POST error', approvalError)
      return NextResponse.json({ success: false, error: approvalError.message }, { status: 500 })
    }

    // Log audit event
    await adminSupabase
      .from('communication_audit_log')
      .insert({
        action: 'template_submitted_for_approval',
        entity_type: 'template',
        entity_id: templateId,
        performed_by: user.id,
        new_values: { approval_id: approval.id, version: approval.version }
      })

    return NextResponse.json({
      success: true,
      data: approval,
      message: 'Template submitted for approval'
    })
  } catch (error: unknown) {
    apiLogger.error('[TemplateApprovals] POST error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// PATCH: Approve/Reject template
// =====================================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema2 = z.object({


      approvalId: z.string().optional(),


      comments: z.string().optional(),


      action: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { approvalId, action, comments } = body

    if (!approvalId || !action) {
      return NextResponse.json({
        success: false,
        error: 'approvalId and action are required'
      }, { status: 400 })
    }

    if (!['approve', 'reject', 'request_changes'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Must be approve, reject, or request_changes'
      }, { status: 400 })
    }

    const adminSupabase = createSupabaseAdmin()

    // Verify super admin with approval permission
    const { data: superAdmin } = await adminSupabase
      .from('super_admins')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Get approval
    const { data: approval, error: approvalError } = await adminSupabase
      .from('template_approvals')
      .select('*')
      .eq('id', approvalId)
      .maybeSingle()

    if (approvalError || !approval) {
      return NextResponse.json({ success: false, error: 'Approval not found' }, { status: 404 })
    }

    if (approval.status !== 'pending_review') {
      return NextResponse.json({
        success: false,
        error: 'Approval is not in pending review status'
      }, { status: 400 })
    }

    // Process action
    const updateData: Record<string, unknown> = {
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_comments: comments,
      updated_at: new Date().toISOString()
    }

    switch (action) {
      case 'approve':
        updateData.status = 'approved'

        // Update template to active
        await adminSupabase
          .from('communication_templates')
          .update({
            is_active: true,
            version: approval.version,
            updated_at: new Date().toISOString()
          })
          .eq('id', approval.template_id)
        break

      case 'reject':
        updateData.status = 'rejected'
        break

      case 'request_changes':
        updateData.status = 'draft' // Send back to draft for changes
        break
    }

    // Update approval
    const { error: updateError } = await adminSupabase
      .from('template_approvals')
      .update(updateData)
      .eq('id', approvalId)

    if (updateError) {
      apiLogger.error('[TemplateApprovals] PATCH error', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // Log audit event
    await adminSupabase
      .from('communication_audit_log')
      .insert({
        action: `template_${action}d`,
        entity_type: 'template_approval',
        entity_id: approvalId,
        performed_by: user.id,
        old_values: { status: approval.status },
        new_values: { status: updateData.status, comments }
      })

    return NextResponse.json({
      success: true,
      message: `Template ${action}d successfully`
    })
  } catch (error: unknown) {
    apiLogger.error('[TemplateApprovals] PATCH error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
