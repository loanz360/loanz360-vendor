import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/superadmin/sms-templates
 * Fetch all SMS templates with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Verify super admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('communication_templates')
      .select('*')
      .eq('template_type', 'sms')
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    if (search) {
      query = query.or(`template_name.ilike.%${search}%,template_code.ilike.%${search}%`)
    }

    const { data: templates, error } = await query

    if (error) {
      apiLogger.error('Error fetching SMS templates', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    apiLogger.error('SMS templates API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/sms-templates
 * Create new SMS template
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Verify super admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const bodySchema = z.object({

      template_code: z.string().optional(),

      template_name: z.string().optional(),

      content: z.string().optional(),

      variables: z.string().optional(),

      variable_descriptions: z.string().optional(),

      dlt_template_id: z.string().uuid().optional(),

      dlt_content_type: z.string().optional(),

      default_sender_id: z.string().uuid().optional(),

      category: z.string().optional(),

      tags: z.array(z.unknown()).optional(),

      description: z.string().optional(),

      id: z.string().uuid(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      template_code,
      template_name,
      content,
      variables,
      variable_descriptions,
      dlt_template_id,
      dlt_content_type,
      default_sender_id,
      category,
      tags,
      description
    } = body

    // Validation
    if (!template_code || !template_name || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: template_code, template_name, content' },
        { status: 400 }
      )
    }

    // Check for duplicate template_code
    const { data: existing } = await supabase
      .from('communication_templates')
      .select('id')
      .eq('template_code', template_code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Template code already exists' },
        { status: 400 }
      )
    }

    // Insert template
    const { data: newTemplate, error } = await supabase
      .from('communication_templates')
      .insert({
        template_code,
        template_name,
        template_type: 'sms',
        content,
        variables: variables || [],
        variable_descriptions: variable_descriptions || {},
        dlt_template_id,
        dlt_content_type,
        default_sender_id,
        category,
        tags: tags || [],
        description,
        is_active: true,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating SMS template', error)
      return NextResponse.json({ success: false, error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: newTemplate }, { status: 201 })
  } catch (error) {
    apiLogger.error('SMS template creation error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/sms-templates
 * Update existing SMS template
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()

    // Verify super admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const bodySchema2 = z.object({

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing template ID' },
        { status: 400 }
      )
    }

    // Update template
    const { data: updatedTemplate, error } = await supabase
      .from('communication_templates')
      .update({
        ...updates,
        updated_by: user.id
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating SMS template', error)
      return NextResponse.json({ success: false, error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: updatedTemplate })
  } catch (error) {
    apiLogger.error('SMS template update error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/sms-templates
 * Delete (deactivate) SMS template
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()

    // Verify super admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get template ID from query params
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing template ID' },
        { status: 400 }
      )
    }

    // Soft delete: Set is_active to false
    const { data: deletedTemplate, error } = await supabase
      .from('communication_templates')
      .update({
        is_active: false,
        updated_by: user.id
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error deleting SMS template', error)
      return NextResponse.json({ success: false, error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: deletedTemplate })
  } catch (error) {
    apiLogger.error('SMS template deletion error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
