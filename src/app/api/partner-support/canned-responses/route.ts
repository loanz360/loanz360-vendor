import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


// GET: Fetch all canned responses (filtered by access)
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data to check role
    const { data: userData } = await supabase
      .from('users')
      .select('role, employee_sub_role')
      .eq('id', user.id)
      .maybeSingle()

    // Only employees can access canned responses
    if (userData?.role !== 'EMPLOYEE' && userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const department = searchParams.get('department')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('partner_support_canned_responses')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })

    // Filter by category
    if (category) {
      query = query.eq('category', category)
    }

    // Filter by department
    if (department) {
      query = query.or(`department.eq.${department},department.is.null`)
    }

    // Search in title and content
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
    }

    const { data: responses, error } = await query

    if (error) throw error

    return NextResponse.json({ responses: responses || [] })
  } catch (error: unknown) {
    apiLogger.error('Error fetching canned responses', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Failed to fetch canned responses' },
      { status: 500 }
    )
  }
}

// POST: Create new canned response
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user data to check role
    const { data: userData } = await supabase
      .from('users')
      .select('role, employee_sub_role')
      .eq('id', user.id)
      .maybeSingle()

    // Only employees can create canned responses
    if (userData?.role !== 'EMPLOYEE' && userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { title, content, category, department, is_global } = body

    // Validation
    if (!title || title.trim().length < 3) {
      return NextResponse.json({ success: false, error: 'Title must be at least 3 characters' }, { status: 400 })
    }

    if (!content || content.trim().length < 10) {
      return NextResponse.json({ success: false, error: 'Content must be at least 10 characters' }, { status: 400 })
    }

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 })
    }

    // Only Super Admin can create global responses
    const isGlobal = userData?.role === 'SUPER_ADMIN' && is_global === true

    // Create canned response
    const { data: newResponse, error } = await supabase
      .from('partner_support_canned_responses')
      .insert({
        title: title.trim(),
        content: content.trim(),
        category,
        department: department || null,
        is_global: isGlobal,
        created_by_employee_id: user.id
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ response: newResponse }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error creating canned response', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Failed to create canned response' },
      { status: 500 }
    )
  }
}
