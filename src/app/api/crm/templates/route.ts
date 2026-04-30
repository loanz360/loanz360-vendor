
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/crm/templates - List all templates
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')

    let query = supabase
      .from('crm_templates')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (type) {
      query = query.eq('template_type', type)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: templates, error } = await query

    if (error) {
      apiLogger.error('Error fetching templates', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: templates
    })
  } catch (error: unknown) {
    apiLogger.error('Templates API error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/crm/templates - Create new template
export async function POST(request: NextRequest) {
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

    // Only CROs and Super Admin can create templates
    if (profile.subrole !== 'cro' && profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only CRO and Super Admin can create templates' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, type, subject, body: templateBody, category } = body

    // Validate required fields
    if (!name || !type || !templateBody) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, body' },
        { status: 400 }
      )
    }

    // Validate type and convert to template_type format
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

    // Extract variables from template body
    const variableRegex = /\{\{(\w+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = variableRegex.exec(templateBody)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1])
      }
    }

    // Insert template (using template_type column name)
    const { data: template, error } = await supabase
      .from('crm_templates')
      .insert({
        name,
        template_type: templateType,
        subject: type === 'email' ? subject : null,
        body: templateBody,
        category: category || 'General',
        variables,
        created_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating template', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Template created successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Create template error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
