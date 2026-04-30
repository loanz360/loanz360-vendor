import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/employee-management/targets/templates
 * Fetch all target templates
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_PERFORMANCE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const subRole = searchParams.get('sub_role')
    const departmentId = searchParams.get('department_id')
    const isActive = searchParams.get('is_active')

    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('target_templates')
      .select(`
        *,
        departments:department_id (
          id,
          name,
          code
        )
      `)
      .order('template_name', { ascending: true })

    if (subRole) {
      query = query.eq('sub_role', subRole)
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: templates, error } = await query

    if (error) {
      logger.error('Error fetching templates:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: templates
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/targets/templates:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/employee-management/targets/templates
 * Create new target template
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'ASSIGN_TARGETS')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      template_id: z.string().uuid().optional(),


      employee_ids: z.array(z.unknown()).optional(),


      target_period: z.string().optional(),


      start_date: z.string().optional(),


      end_date: z.string().optional(),


      template_name: z.string().optional(),


      sub_role: z.string().optional(),


      department_id: z.string().uuid().optional(),


      default_metrics: z.string().optional(),


      description: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate
    const requiredFields = ['template_name', 'sub_role', 'default_metrics']
    const missingFields = requiredFields.filter(field => !body[field])

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Check for duplicate template name
    const { data: existing } = await supabase
      .from('target_templates')
      .select('id')
      .eq('template_name', body.template_name)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Template name already exists' },
        { status: 409 }
      )
    }

    // Create template
    const templateData = {
      template_name: body.template_name,
      sub_role: body.sub_role,
      department_id: body.department_id || null,
      default_metrics: body.default_metrics,
      description: body.description || null,
      is_active: true,
      times_used: 0,
      created_by: auth.userId
    }

    const { data: newTemplate, error: insertError } = await supabase
      .from('target_templates')
      .insert(templateData)
      .select()
      .maybeSingle()

    if (insertError) {
      logger.error('Error creating template:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create template' },
        { status: 500 }
      )
    }

    logger.info(`Target template created: ${newTemplate.template_name}`)

    return NextResponse.json({
      success: true,
      data: newTemplate,
      message: 'Template created successfully'
    }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/superadmin/employee-management/targets/templates:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/employee-management/targets/templates
 * Apply template to employee(s)
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'ASSIGN_TARGETS')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const bodySchema2 = z.object({


      target_period: z.string().optional(),


      end_date: z.string().optional(),


      employee_ids: z.string().optional(),


      template_id: z.string().optional(),


      start_date: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { template_id, employee_ids, target_period, start_date, end_date } = body

    if (!template_id || !employee_ids || !Array.isArray(employee_ids)) {
      return NextResponse.json(
        { success: false, error: 'template_id and employee_ids (array) are required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('target_templates')
      .select('*')
      .eq('id', template_id)
      .eq('is_active', true)
      .maybeSingle()

    if (templateError || !template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Verify employees
    const { data: employees } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, sub_role')
      .in('id', employee_ids)
      .is('deleted_at', null)

    if (!employees || employees.length !== employee_ids.length) {
      return NextResponse.json(
        { success: false, error: 'One or more employees not found' },
        { status: 404 }
      )
    }

    // Create targets from template
    const targetsToInsert = employee_ids.map(empId => ({
      employee_id: empId,
      target_name: `${template.template_name} - ${target_period}`,
      target_period,
      start_date,
      end_date,
      target_metrics: template.default_metrics,
      achieved_metrics: {},
      achievement_percentage: 0,
      is_active: true,
      created_by: auth.userId,
      notes: `Applied from template: ${template.template_name}`
    }))

    const { data: createdTargets, error: insertError } = await supabase
      .from('employee_targets')
      .insert(targetsToInsert)
      .select()

    if (insertError) {
      logger.error('Error applying template:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to apply template' },
        { status: 500 }
      )
    }

    // Update template usage
    await supabase
      .from('target_templates')
      .update({
        times_used: template.times_used + employee_ids.length,
        last_used_at: new Date().toISOString()
      })
      .eq('id', template_id)

    return NextResponse.json({
      success: true,
      data: {
        targets_created: createdTargets?.length || 0,
        targets: createdTargets
      },
      message: `Template applied to ${employee_ids.length} employees successfully`
    })
  } catch (error) {
    logger.error('Error in PUT /api/superadmin/employee-management/targets/templates:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
