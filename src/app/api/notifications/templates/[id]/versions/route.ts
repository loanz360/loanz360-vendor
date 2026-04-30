import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

// Template Version History API
// GET: Get all versions of a template
// POST: Restore a specific version

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/notifications/templates/[id]/versions
 * Get version history for a template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get current template info
    const { data: template } = await supabase
      .from('notification_templates')
      .select('id, name, version')
      .eq('id', id)
      .maybeSingle()

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    // Get all versions
    const { data: versions, error } = await supabase
      .from('notification_template_versions')
      .select(`
        id,
        version,
        name,
        title,
        message,
        notification_type,
        priority,
        comment,
        created_at,
        created_by
      `)
      .eq('template_id', id)
      .order('version', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching versions', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch versions' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      template_id: id,
      current_version: template.version || 1,
      versions: versions || []
    })
  } catch (error) {
    apiLogger.error('Error fetching template versions', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/notifications/templates/[id]/versions
 * Restore a specific version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = employee?.role === 'super_admin'
    const isHR = employee?.role === 'hr' || employee?.role === 'HR'

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const bodySchema = z.object({


      version_id: z.string().uuid().optional(),


      version_number: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { version_id, version_number } = body

    if (!version_id && !version_number) {
      return NextResponse.json(
        { error: 'version_id or version_number is required' },
        { status: 400 }
      )
    }

    // Get the version to restore
    let query = supabase
      .from('notification_template_versions')
      .select('*')
      .eq('template_id', id)

    if (version_id) {
      query = query.eq('id', version_id)
    } else {
      query = query.eq('version', version_number)
    }

    const { data: versionToRestore, error: versionError } = await query.maybeSingle()

    if (versionError || !versionToRestore) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 })
    }

    // Get current template to save as version
    const { data: currentTemplate } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!currentTemplate) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    const currentVersion = currentTemplate.version || 1

    // Save current version to history
    await supabase
      .from('notification_template_versions')
      .insert({
        template_id: id,
        version: currentVersion,
        name: currentTemplate.name,
        description: currentTemplate.description,
        title: currentTemplate.title,
        message: currentTemplate.message,
        notification_type: currentTemplate.notification_type,
        priority: currentTemplate.priority,
        target_category: currentTemplate.target_category,
        created_by: currentTemplate.updated_by || currentTemplate.created_by,
        comment: `Saved before restoring to version ${versionToRestore.version}`,
        created_at: currentTemplate.updated_at || currentTemplate.created_at
      })

    // Restore the selected version
    const { data: restoredTemplate, error: restoreError } = await supabase
      .from('notification_templates')
      .update({
        name: versionToRestore.name,
        description: versionToRestore.description,
        title: versionToRestore.title,
        message: versionToRestore.message,
        notification_type: versionToRestore.notification_type,
        priority: versionToRestore.priority,
        target_category: versionToRestore.target_category,
        version: currentVersion + 1,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (restoreError) {
      apiLogger.error('Error restoring version', restoreError)
      return NextResponse.json({ success: false, error: 'Failed to restore version' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Restored to version ${versionToRestore.version}`,
      template: restoredTemplate,
      new_version: currentVersion + 1
    })
  } catch (error) {
    apiLogger.error('Error restoring template version', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
