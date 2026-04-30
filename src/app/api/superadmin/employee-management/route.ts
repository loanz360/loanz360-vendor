import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission } from '@/lib/auth/employee-mgmt-auth'
import { logEmployeeActivity } from '@/lib/services/employee-audit'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeText } from '@/lib/validations/input-sanitization'
import crypto from 'crypto'

/**
 * Generate a cryptographically secure temporary password
 * Ensures at least one uppercase, lowercase, digit, and special character
 */
function generateTemporaryPassword(): string {
  const length = 12
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const special = '!@#$%^&*'
  const allChars = uppercase + lowercase + digits + special

  // Ensure at least one of each required character type
  let password = ''
  password += uppercase[crypto.randomInt(0, uppercase.length)]
  password += lowercase[crypto.randomInt(0, lowercase.length)]
  password += digits[crypto.randomInt(0, digits.length)]
  password += special[crypto.randomInt(0, special.length)]

  // Fill remaining characters
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)]
  }

  // Shuffle using Fisher-Yates
  const arr = password.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/employee-management
 * Fetch all employees with advanced filtering
 * Permissions: Super Admin (full), HR (department-based), Admin (read-only)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    // Check permission
    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_EMPLOYEES')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Filters
    const department = searchParams.get('department')
    const subRole = searchParams.get('sub_role')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const isActive = searchParams.get('is_active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const supabase = createSupabaseAdmin()

    // Build query
    let query = supabase
      .from('employees')
      .select(`
        *,
        departments:department_id (
          id,
          name,
          code,
          department_type
        )
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply filters
    if (department) {
      query = query.eq('department_id', department)
    }

    if (subRole) {
      query = query.eq('sub_role', subRole)
    }

    if (status) {
      query = query.eq('employee_status', status)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    if (search) {
      // H3 FIX: Sanitize search input to prevent wildcard injection
      const sanitizedSearch = search.replace(/[%_'";\\\[\]{}()]/g, '')
      if (sanitizedSearch.length > 0) {
        query = query.or(`full_name.ilike.%${sanitizedSearch}%,employee_id.ilike.%${sanitizedSearch}%,work_email.ilike.%${sanitizedSearch}%,mobile_number.ilike.%${sanitizedSearch}%`)
      }
    }

    // HR role - limit to their department(s)
    if (auth.role === 'HR') {
      const { data: hrProfile } = await supabase
        .from('employees')
        .select('department_id')
        .eq('user_id', auth.userId)
        .maybeSingle()

      if (hrProfile?.department_id) {
        query = query.eq('department_id', hrProfile.department_id)
      }
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: employees, error, count } = await query

    if (error) {
      logger.error('Error fetching employees:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employees' },
        { status: 500 }
      )
    }

    // Get additional stats
    const { data: stats } = await supabase
      .from('employees')
      .select('employee_status, is_active')
      .is('deleted_at', null)

    const totalActive = stats?.filter(s => s.is_active).length || 0
    const totalInactive = stats?.filter(s => !s.is_active).length || 0
    const statusBreakdown = stats?.reduce((acc: any, curr) => {
      acc[curr.employee_status] = (acc[curr.employee_status] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        employees: employees,
        total_count: count || 0,
        page: page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit)
      },
      stats: {
        totalActive,
        totalInactive,
        statusBreakdown
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/employee-management
 * Create new employee with auto-generated Employee ID (EF1, EF2, etc.)
 * Creates Supabase Auth user + employees record + login credentials
 * Permissions: Super Admin (all roles), HR (except Admin/HR roles)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    // Check permission
    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'ADD_EMPLOYEE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to add employees' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate required fields
    const requiredFields = [
      'full_name',
      'mobile_number',
      'work_email',
      'personal_email',
      'present_address',
      'permanent_address',
      'department_id',
      'sub_role',
      'date_of_joining'
    ]

    const missingFields = requiredFields.filter(field => !body[field])
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // HR restriction - cannot add Admin or HR roles
    if (auth.role === 'HR') {
      const restrictedRoles = ['ADMIN_EXECUTIVE', 'ADMIN_MANAGER', 'HR_EXECUTIVE', 'HR_MANAGER']
      if (restrictedRoles.includes(body.sub_role)) {
        return NextResponse.json(
          { success: false, error: 'HR users cannot create Admin or HR roles' },
          { status: 403 }
        )
      }
    }

    const supabase = createSupabaseAdmin()

    // Check for duplicate email or mobile
    const { data: existing } = await supabase
      .from('employees')
      .select('id, work_email, personal_email, mobile_number')
      .or(`work_email.eq.${body.work_email},personal_email.eq.${body.personal_email},mobile_number.eq.${body.mobile_number}`)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      if (existing.work_email === body.work_email) {
        return NextResponse.json(
          { success: false, error: 'Work email already exists' },
          { status: 409 }
        )
      }
      if (existing.personal_email === body.personal_email) {
        return NextResponse.json(
          { success: false, error: 'Personal email already exists' },
          { status: 409 }
        )
      }
      if (existing.mobile_number === body.mobile_number) {
        return NextResponse.json(
          { success: false, error: 'Mobile number already exists' },
          { status: 409 }
        )
      }
    }

    // Also check if work_email exists in Supabase Auth
    const { data: existingAuthUsers } = await supabase.auth.admin.listUsers()
    const authEmailExists = existingAuthUsers?.users?.some(
      (u) => u.email?.toLowerCase() === body.work_email.toLowerCase().trim()
    )
    if (authEmailExists) {
      return NextResponse.json(
        { success: false, error: 'An account with this work email already exists in the auth system' },
        { status: 409 }
      )
    }

    // Validate mobile number format (India)
    const mobileRegex = /^[6-9]\d{9}$/
    if (!mobileRegex.test(body.mobile_number.replace(/[\s-]/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format. Must be valid Indian mobile number' },
        { status: 400 }
      )
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.work_email) || !emailRegex.test(body.personal_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // ─── Step 1: Generate temporary password ───
    const temporaryPassword = generateTemporaryPassword()

    // ─── Step 2: Create Supabase Auth user ───
    const workEmail = body.work_email.toLowerCase().trim()
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: workEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name.trim(),
        role: 'EMPLOYEE',
        sub_role: body.sub_role,
      },
    })

    if (authError || !authUser.user) {
      logger.error('Error creating Supabase Auth user:', authError)
      return NextResponse.json(
        { success: false, error: `Failed to create auth account: ${authError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    const authUserId = authUser.user.id

    // ─── Step 3: Insert employee record (sanitize text inputs) ───
    const employeeData = {
      // Link to auth user
      user_id: authUserId,

      // Basic Info
      full_name: sanitizeText(body.full_name.trim()),
      mobile_number: body.mobile_number.replace(/[\s-]/g, ''),
      work_email: workEmail,
      personal_email: body.personal_email.toLowerCase().trim(),

      // Address (correct column names matching DB schema)
      present_address: sanitizeText(body.present_address?.trim() || ''),
      permanent_address: sanitizeText(body.permanent_address?.trim() || ''),
      city: sanitizeText(body.city?.trim() || ''),
      state: sanitizeText(body.state?.trim() || ''),
      pincode: body.pincode?.trim() || '',

      // Employment
      department_id: body.department_id,
      sub_role: body.sub_role,
      employee_status: 'PENDING_ONBOARDING',
      date_of_joining: body.date_of_joining,
      probation_end_date: body.probation_end_date || null,

      // Reporting
      reporting_manager_id: body.reporting_manager_id || null,

      // Profile
      password_reset_required: true,
      profile_completed: false,
      first_login_completed: false,

      // Additional
      emergency_contact_name: sanitizeText(body.emergency_contact_name || ''),
      emergency_contact_number: body.emergency_contact_number || '',
      emergency_contact_relation: body.emergency_contact_relation ? sanitizeText(body.emergency_contact_relation) : null,
      qualification: body.qualification ? sanitizeText(body.qualification) : null,
      experience_years: body.experience_years ? parseInt(body.experience_years) : null,
      previous_company: body.previous_company ? sanitizeText(body.previous_company) : null,

      // System
      is_active: true,
      created_by: auth.userId
    }

    const { data: newEmployee, error: insertError } = await supabase
      .from('employees')
      .insert(employeeData)
      .select(`
        *,
        departments:department_id (
          id,
          name,
          code
        )
      `)
      .maybeSingle()

    if (insertError) {
      logger.error('Error creating employee record:', insertError)
      // Rollback: delete the auth user we just created
      await supabase.auth.admin.deleteUser(authUserId)
      logger.info(`Rolled back auth user ${authUserId} after employee insert failure`)
      return NextResponse.json(
        { success: false, error: 'Failed to create employee record' },
        { status: 500 }
      )
    }

    // ─── Step 4: Log activity (SECURITY: temporary_password must NEVER be logged) ───
    await logEmployeeActivity({
      employeeId: newEmployee.id,
      action: 'EMPLOYEE_CREATED',
      actionDetails: {
        employee_id: newEmployee.employee_id,
        full_name: newEmployee.full_name,
        sub_role: newEmployee.sub_role,
        auth_user_created: true,
        temporary_password: '[REDACTED]',
      },
      performedBy: auth.userId!,
      performedByRole: auth.role!
    })

    // ─── Step 5: Send welcome email (non-blocking) ───
    const departmentName = (newEmployee.departments as any)?.name || 'N/A'
    try {
      const { sendEmployeeWelcomeEmail, EMAIL_CONFIG } = await import('@/lib/services/employee-email-service')

      await sendEmployeeWelcomeEmail({
        employee: {
          employee_id: newEmployee.employee_id,
          full_name: newEmployee.full_name,
          work_email: newEmployee.work_email,
          personal_email: newEmployee.personal_email,
          department: departmentName,
          sub_role: newEmployee.sub_role,
          joining_date: newEmployee.date_of_joining
        },
        credentials: {
          username: newEmployee.work_email,
          temporary_password: temporaryPassword,
          login_url: EMAIL_CONFIG.LOGIN_URL
        }
      })

      logger.info(`Welcome email sent to ${newEmployee.personal_email}`)
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError)
      // Don't fail employee creation if email fails
    }

    logger.info(`Employee created successfully: ${newEmployee.employee_id} (auth: ${authUserId})`)

    return NextResponse.json({
      success: true,
      data: {
        ...newEmployee,
        temporary_password: temporaryPassword, // Shown once in the UI for HR/Admin to share
      },
      message: `Employee ${newEmployee.employee_id} created successfully with login credentials.`
    }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/superadmin/employee-management:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
