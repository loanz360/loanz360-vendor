import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

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

    // Check if user is employee or super admin (only they can access canned responses)
    const { data: empData } = await supabase
      .from('employees')
      .select('id, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: saData } = !empData ? await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle() : { data: null }

    if (!empData && !saData) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const department = searchParams.get('department')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('customer_support_canned_responses')
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
    logApiError(error as Error, request, { action: 'listCustomerCannedResponses' })
    return NextResponse.json(
      { error: 'Failed to fetch canned responses' },
      { status: 500 }
    )
  }
}

// POST: Create new canned response
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is employee or super admin
    const { data: postEmpData } = await supabase
      .from('employees')
      .select('id, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: postSaData } = !postEmpData ? await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle() : { data: null }

    if (!postEmpData && !postSaData) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
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
    const isGlobal = !!postSaData && is_global === true

    // Create canned response
    const { data: newResponse, error } = await supabase
      .from('customer_support_canned_responses')
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
    logApiError(error as Error, request, { action: 'createCustomerCannedResponse' })
    return NextResponse.json(
      { error: 'Failed to create canned response' },
      { status: 500 }
    )
  }
}
