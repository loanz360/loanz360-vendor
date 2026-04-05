export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * PUT /api/notifications/templates/[id]
 * Update a notification template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Super Admin or HR
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = employee?.role === 'super_admin'
    const isHR = employee?.role === 'hr' || employee?.role === 'HR'

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      description,
      title,
      message,
      notification_type,
      priority,
      target_category,
      version_comment
    } = body

    // Get current template for versioning
    const { data: currentTemplate } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (!currentTemplate) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    // Save current version to history before updating
    const currentVersion = currentTemplate.version || 1
    await supabase
      .from('notification_template_versions')
      .insert({
        template_id: params.id,
        version: currentVersion,
        name: currentTemplate.name,
        description: currentTemplate.description,
        title: currentTemplate.title,
        message: currentTemplate.message,
        notification_type: currentTemplate.notification_type,
        priority: currentTemplate.priority,
        target_category: currentTemplate.target_category,
        created_by: currentTemplate.created_by,
        comment: version_comment || 'Auto-saved before update',
        created_at: currentTemplate.updated_at || currentTemplate.created_at
      })

    // Update template with new version number
    const { data: template, error } = await supabase
      .from('notification_templates')
      .update({
        name,
        description,
        title,
        message,
        notification_type,
        priority,
        target_category,
        version: currentVersion + 1,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ template, version: currentVersion + 1 })
  } catch (error) {
    apiLogger.error('Error updating template', error)
    logApiError(error as Error, request, { action: 'put' })
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/templates/[id]
 * Delete a notification template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Super Admin or HR
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = employee?.role === 'super_admin'
    const isHR = employee?.role === 'hr' || employee?.role === 'HR'

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Error deleting template', error)
    logApiError(error as Error, request, { action: 'put' })
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
