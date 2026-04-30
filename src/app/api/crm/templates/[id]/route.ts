import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/crm/templates/[id] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Only CROs and Super Admin can access templates
    if (profile.subrole !== 'cro' && profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only CRO and Super Admin can access templates' },
        { status: 403 }
      )
    }

    const { data: template, error } = await supabase
      .from('crm_templates')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      apiLogger.error('Error fetching template', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error: unknown) {
    apiLogger.error('Get template error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/crm/templates/[id] - Update template
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Only CROs and Super Admin can update templates
    if (profile.subrole !== 'cro' && profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only CRO and Super Admin can update templates' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      name: z.string().optional(),


      type: z.string().optional(),


      subject: z.string().optional(),


      category: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { name, type, subject, body: templateBody, category } = body

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (type !== undefined) {
      // Convert to template_type format
      const templateTypeMap: Record<string, string> = {
        'email': 'Email',
        'sms': 'SMS'
      }
      const templateType = templateTypeMap[type.toLowerCase()]
      if (!templateType) {
        return NextResponse.json(
          { error: 'Invalid type. Must be email or sms' },
          { status: 400 }
        )
      }
      updateData.template_type = templateType
    }
    if (subject !== undefined) updateData.subject = subject
    if (category !== undefined) updateData.category = category

    // If body is being updated, extract variables
    if (templateBody !== undefined) {
      updateData.body = templateBody

      const variableRegex = /\{\{(\w+)\}\}/g
      const variables: string[] = []
      let match

      while ((match = variableRegex.exec(templateBody)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1])
        }
      }

      updateData.variables = variables
    }

    updateData.updated_at = new Date().toISOString()

    // Update template
    const { data: template, error } = await supabase
      .from('crm_templates')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating template', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Template updated successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Update template error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/crm/templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Only CROs and Super Admin can delete templates
    if (profile.subrole !== 'cro' && profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only CRO and Super Admin can delete templates' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('crm_templates')
      .delete()
      .eq('id', params.id)

    if (error) {
      apiLogger.error('Error deleting template', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Delete template error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
