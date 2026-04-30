import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/support/canned-responses - Get all canned responses for HR/Super Admin
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is HR or Super Admin
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only HR and Super Admin can access canned responses' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const active = searchParams.get('active')

    // Build query
    let query = supabase
      .from('ticket_canned_responses')
      .select('*')
      .order('usage_count', { ascending: false })

    // Apply filters
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    } else {
      // By default, only show active responses
      query = query.eq('is_active', true)
    }

    const { data: responses, error } = await query

    if (error) {
      apiLogger.error('Error fetching canned responses', error)
      return NextResponse.json(
        { error: 'Failed to fetch canned responses' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      responses: responses || [],
      count: responses?.length || 0
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/support/canned-responses', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/support/canned-responses - Create new canned response
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is HR or Super Admin
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only HR and Super Admin can create canned responses' },
        { status: 403 }
      )
    }

    // Parse request body
    const bodySchema = z.object({

      title: z.string().optional(),

      category: z.string().optional(),

      response_text: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { title, category, response_text } = body

    // Validate required fields
    if (!title || !response_text) {
      return NextResponse.json(
        { error: 'Missing required fields: title, response_text' },
        { status: 400 }
      )
    }

    // Create canned response
    const { data: response, error: createError } = await supabase
      .from('ticket_canned_responses')
      .insert({
        title,
        category: category || 'general',
        response_text,
        created_by: user.id,
        created_by_type: isSuperAdmin ? 'super_admin' : 'hr',
        is_active: true,
        usage_count: 0
      })
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating canned response', createError)
      return NextResponse.json(
        { error: 'Failed to create canned response' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      response,
      message: 'Canned response created successfully'
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/support/canned-responses', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
