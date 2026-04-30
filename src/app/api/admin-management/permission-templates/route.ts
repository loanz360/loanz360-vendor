import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/permission-templates
 * Get all permission templates (roles)
 */
export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const includeInactive = searchParams.get('include_inactive') === 'true'
    const systemOnly = searchParams.get('system_only') === 'true'

    // Build query
    let query = supabase
      .from('admin_permission_templates')
      .select('*')

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (systemOnly) {
      query = query.eq('is_system_template', true)
    }

    const { data: templates, error: templatesError } = await query
      .order('is_system_template', { ascending: false })
      .order('created_at', { ascending: true })

    if (templatesError) throw templatesError

    // Get usage count for each template
    const templatesWithUsage = await Promise.all(
      (templates || []).map(async (template) => {
        const { count } = await supabase
          .from('admin_template_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('template_id', template.id)
          .eq('is_active', true)

        return {
          ...template,
          active_assignments: count || 0
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        templates: templatesWithUsage,
        total: templatesWithUsage.length,
        system_templates: templatesWithUsage.filter(t => t.is_system_template).length,
        custom_templates: templatesWithUsage.filter(t => !t.is_system_template).length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Permission Templates API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin-management/permission-templates
 * Create a new permission template (role)
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const {
      template_name,
      template_description,
      created_by_user_id
    } = body

    // Validate required fields
    if (!template_name) {
      return NextResponse.json(
        { success: false, error: 'template_name is required' },
        { status: 400 }
      )
    }

    // Validate name format (alphanumeric, spaces, hyphens, underscores only)
    const nameRegex = /^[a-zA-Z0-9_\-\s]+$/
    if (!nameRegex.test(template_name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template name can only contain letters, numbers, spaces, hyphens, and underscores'
        },
        { status: 400 }
      )
    }

    // Check if template name already exists
    const { data: existing } = await supabase
      .from('admin_permission_templates')
      .select('id')
      .eq('template_name', template_name)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A template with this name already exists' },
        { status: 409 }
      )
    }

    // Create template
    const { data: template, error: createError } = await supabase
      .from('admin_permission_templates')
      .insert({
        template_name,
        template_description,
        is_system_template: false,
        created_by: created_by_user_id
      })
      .select()
      .maybeSingle()

    if (createError) throw createError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: created_by_user_id,
      p_action_type: 'permission_template_created',
      p_action_description: `Created new permission template: ${template_name}`,
      p_changes: JSON.stringify({
        template_id: template.id,
        template_name,
        template_description
      }),
      p_performed_by: created_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Permission template created successfully',
      data: template
    })
  } catch (error: unknown) {
    apiLogger.error('[Create Permission Template API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin-management/permission-templates
 * Update a permission template
 */
export async function PUT(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const {
      template_id,
      template_name,
      template_description,
      is_active,
      updated_by_user_id
    } = body

    if (!template_id) {
      return NextResponse.json(
        { success: false, error: 'template_id is required' },
        { status: 400 }
      )
    }

    // Get existing template
    const { data: existing, error: existingError } = await supabase
      .from('admin_permission_templates')
      .select('*')
      .eq('id', template_id)
      .maybeSingle()

    if (existingError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Check if it's a system template
    if (existing.is_system_template && (template_name || is_active === false)) {
      return NextResponse.json(
        { success: false, error: 'System templates cannot be renamed or deactivated' },
        { status: 403 }
      )
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (template_name && template_name !== existing.template_name) {
      // Validate name format
      const nameRegex = /^[a-zA-Z0-9_\-\s]+$/
      if (!nameRegex.test(template_name)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Template name can only contain letters, numbers, spaces, hyphens, and underscores'
          },
          { status: 400 }
        )
      }

      // Check if new name already exists
      const { data: nameExists } = await supabase
        .from('admin_permission_templates')
        .select('id')
        .eq('template_name', template_name)
        .neq('id', template_id)
        .maybeSingle()

      if (nameExists) {
        return NextResponse.json(
          { success: false, error: 'A template with this name already exists' },
          { status: 409 }
        )
      }

      updates.template_name = template_name
    }

    if (template_description !== undefined) {
      updates.template_description = template_description
    }

    if (is_active !== undefined) {
      updates.is_active = is_active
    }

    // Update template
    const { data: updated, error: updateError } = await supabase
      .from('admin_permission_templates')
      .update(updates)
      .eq('id', template_id)
      .select()
      .maybeSingle()

    if (updateError) throw updateError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: updated_by_user_id,
      p_action_type: 'permission_template_updated',
      p_action_description: `Updated permission template: ${existing.template_name}`,
      p_changes: JSON.stringify({
        template_id,
        before: existing,
        after: updates
      }),
      p_performed_by: updated_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Permission template updated successfully',
      data: updated
    })
  } catch (error: unknown) {
    apiLogger.error('[Update Permission Template API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin-management/permission-templates
 * Delete a permission template (only custom templates)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const templateId = searchParams.get('template_id')
    const deletedBy = searchParams.get('deleted_by')

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'template_id is required' },
        { status: 400 }
      )
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('admin_permission_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle()

    if (templateError || !template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Check if it's a system template
    if (template.is_system_template) {
      return NextResponse.json(
        { success: false, error: 'System templates cannot be deleted' },
        { status: 403 }
      )
    }

    // Check if template is assigned to any admins
    const { count } = await supabase
      .from('admin_template_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', templateId)
      .eq('is_active', true)

    if (count && count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete template. It is currently assigned to ${count} admin(s). Please remove all assignments first.`
        },
        { status: 409 }
      )
    }

    // Delete template
    const { error: deleteError } = await supabase
      .from('admin_permission_templates')
      .delete()
      .eq('id', templateId)

    if (deleteError) throw deleteError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: deletedBy,
      p_action_type: 'permission_template_deleted',
      p_action_description: `Deleted permission template: ${template.template_name}`,
      p_changes: JSON.stringify({
        template_id: templateId,
        template_name: template.template_name
      }),
      p_performed_by: deletedBy,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Permission template deleted successfully',
      data: {
        template_id: templateId,
        template_name: template.template_name
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Delete Permission Template API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
