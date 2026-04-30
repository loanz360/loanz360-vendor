
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET /api/hr/staff-skills - Get all HR staff skills
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR or Super Admin
    const { data: employee } = await adminClient
      .from('employees')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await adminClient
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. HR or Super Admin role required.' },
        { status: 403 }
      )
    }

    // Pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const offset = (page - 1) * limit

    // Get total count
    const { count: totalCount } = await adminClient
      .from('hr_staff_skills')
      .select('*', { count: 'exact', head: true })

    // Get all HR staff skills with employee details
    const { data: hrStaffSkills, error } = await adminClient
      .from('hr_staff_skills')
      .select(`
        *,
        employee:employees!hr_staff_skills_hr_user_id_fkey(
          id,
          full_name,
          email,
          role,
          sub_role,
          is_active
        )
      `)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      apiLogger.error('Error fetching HR staff skills', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch HR staff skills' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: hrStaffSkills,
      meta: {
        page,
        limit,
        total: totalCount ?? 0,
        totalPages: Math.ceil((totalCount ?? 0) / limit)
      }
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Error in GET /api/hr/staff-skills', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}

// POST /api/hr/staff-skills - Create or update HR staff skills
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Super Admin (only Super Admin can modify HR skills)
    const { data: superAdmin } = await adminClient
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super Admin role required.' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      hr_user_id,
      categories,
      languages,
      specializations,
      is_available,
      availability_status,
      max_tickets_per_day,
      max_pending_tickets,
      can_handle_urgent,
      can_handle_confidential,
      working_hours
    } = body

    // Validate required fields
    if (!hr_user_id) {
      return NextResponse.json(
        { success: false, error: 'HR user ID is required' },
        { status: 400 }
      )
    }

    // Validate skill data types
    if (categories !== undefined && !Array.isArray(categories)) {
      return NextResponse.json(
        { success: false, error: 'Categories must be an array' },
        { status: 400 }
      )
    }

    if (languages !== undefined && !Array.isArray(languages)) {
      return NextResponse.json(
        { success: false, error: 'Languages must be an array' },
        { status: 400 }
      )
    }

    if (specializations !== undefined && !Array.isArray(specializations)) {
      return NextResponse.json(
        { success: false, error: 'Specializations must be an array' },
        { status: 400 }
      )
    }

    if (max_tickets_per_day !== undefined && (typeof max_tickets_per_day !== 'number' || max_tickets_per_day < 0 || max_tickets_per_day > 1000)) {
      return NextResponse.json(
        { success: false, error: 'max_tickets_per_day must be a number between 0 and 1000' },
        { status: 400 }
      )
    }

    if (max_pending_tickets !== undefined && (typeof max_pending_tickets !== 'number' || max_pending_tickets < 0 || max_pending_tickets > 1000)) {
      return NextResponse.json(
        { success: false, error: 'max_pending_tickets must be a number between 0 and 1000' },
        { status: 400 }
      )
    }

    // Verify HR user exists and is HR role
    const { data: hrUser, error: hrUserError } = await adminClient
      .from('employees')
      .select('id, role')
      .eq('id', hr_user_id)
      .maybeSingle()

    if (hrUserError || !hrUser) {
      return NextResponse.json(
        { success: false, error: 'HR user not found' },
        { status: 404 }
      )
    }

    if (hrUser.role !== 'hr' && hrUser.role !== 'HR') {
      return NextResponse.json(
        { success: false, error: 'User is not an HR employee' },
        { status: 400 }
      )
    }

    // Upsert HR staff skills
    const { data: hrStaffSkill, error: upsertError } = await adminClient
      .from('hr_staff_skills')
      .upsert({
        hr_user_id,
        categories,
        languages,
        specializations,
        is_available,
        availability_status,
        max_tickets_per_day,
        max_pending_tickets,
        can_handle_urgent,
        can_handle_confidential,
        working_hours,
        updated_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (upsertError) {
      apiLogger.error('Error upserting HR staff skills', upsertError)
      return NextResponse.json(
        { success: false, error: 'Failed to save HR staff skills' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: hrStaffSkill,
      message: 'HR staff skills updated successfully'
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Error in POST /api/hr/staff-skills', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}
