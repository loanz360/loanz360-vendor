import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { csrfProtection } from '@/lib/middleware/csrf'
import { z, ZodError } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import { apiLogger } from '@/lib/utils/logger'

// Validation schema for leave request
const leaveRequestSchema = z.object({
  leave_type_id: z.string().uuid({ message: 'Invalid leave type ID' }),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason too long'),
  documents: z.array(z.string().url()).optional().nullable(),
  half_day: z.boolean().optional().default(false)
})

// Helper function to sanitize input
function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })
}

// Helper to convert date to UTC start of day
function toUTCDate(dateString: string): Date {
  const date = new Date(dateString)
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0))
}

// Helper to calculate working days (excluding weekends AND holidays)
async function calculateWorkingDays(
  fromDate: Date,
  toDate: Date,
  isHalfDay: boolean,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  if (isHalfDay) return 0.5

  // Fetch mandatory holidays in the date range
  const fromStr = fromDate.toISOString().split('T')[0]
  const toStr = toDate.toISOString().split('T')[0]

  let holidayDates = new Set<string>()
  try {
    const { data: holidays } = await supabase
      .from('holidays')
      .select('date')
      .gte('date', fromStr)
      .lte('date', toStr)
      .eq('is_mandatory', true)

    if (holidays) {
      holidayDates = new Set(holidays.map((h: { date: string }) => h.date))
    }
  } catch (err) {
    // If holidays table query fails, continue without holiday exclusion
  }

  let count = 0
  const current = new Date(fromDate)

  while (current <= toDate) {
    const dayOfWeek = current.getDay()
    const dateStr = current.toISOString().split('T')[0]

    // Exclude Saturday (6), Sunday (0), and mandatory holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

// GET - Fetch leave requests
export async function GET(request: NextRequest) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'pending', 'approved', 'rejected', 'cancelled'
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    // Build query
    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        leave_types (
          id,
          name,
          color,
          max_days_per_request
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    // Filter by year (from_date year)
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    query = query.gte('from_date', yearStart).lte('from_date', yearEnd)

    const { data: requests, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: requests || []
    })

  } catch (error: unknown) {
    apiLogger.error('Fetch leave requests error', error)
    logApiError(error instanceof Error ? error : new Error('Unknown error'), request, { action: 'get_leave_requests' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leave requests', errorCode: 'FETCH_FAILED' },
      { status: 500 }
    )
  }
}

// POST - Create new leave request
export async function POST(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  // Apply rate limiting (stricter for POST)
  try {
    const rateLimitResponse = await rateLimit(request, {
    ...RATE_LIMIT_CONFIGS.DEFAULT,
    maxRequests: 10, // Max 10 leave requests per hour
    windowMs: 60 * 60 * 1000
  })
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate with Zod
    const validatedData = leaveRequestSchema.parse(body)

    // Sanitize reason text
    const sanitizedReason = sanitizeInput(validatedData.reason)

    // Convert dates to UTC for consistent comparisons across timezones
    const fromDateUTC = toUTCDate(validatedData.from_date)
    const toDateUTC = toUTCDate(validatedData.to_date)
    // Using UTC start-of-day for date comparisons to avoid timezone issues
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // === VALIDATION 1: Date Range Validation ===
    if (fromDateUTC > toDateUTC) {
      return NextResponse.json(
        {
          success: false,
          error: 'From date cannot be after to date',
          errorCode: 'INVALID_DATE_RANGE'
        },
        { status: 400 }
      )
    }

    // Prevent backdated leave requests (more than 7 days in past)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    if (fromDateUTC < sevenDaysAgo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot apply for leave more than 7 days in the past',
          errorCode: 'BACKDATED_REQUEST'
        },
        { status: 400 }
      )
    }

    // Prevent requests too far in future (max 1 year)
    const oneYearFromNow = new Date(today)
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
    if (fromDateUTC > oneYearFromNow) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot apply for leave more than 1 year in advance',
          errorCode: 'FUTURE_DATE_EXCEEDED'
        },
        { status: 400 }
      )
    }

    // === VALIDATION 2: Check for overlapping leave requests ===
    const { data: hasOverlap, error: overlapError } = await supabase
      .rpc('check_overlapping_leaves', {
        p_user_id: user.id,
        p_from_date: validatedData.from_date,
        p_to_date: validatedData.to_date,
        p_exclude_request_id: null
      })

    if (overlapError) {
      apiLogger.error('Overlap check error', overlapError)

      // Fallback: Direct SQL query if RPC doesn't exist
      if (overlapError.code === '42883') {
        const { data: overlapping } = await supabase
          .from('leave_requests')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['pending', 'approved'])
          .lte('from_date', validatedData.to_date)
          .gte('to_date', validatedData.from_date)
          .limit(1)

        if (overlapping && overlapping.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'You already have a leave request for overlapping dates',
              errorCode: 'OVERLAPPING_DATES'
            },
            { status: 409 }
          )
        }
      } else {
        throw overlapError
      }
    }

    if (hasOverlap === true) {
      return NextResponse.json(
        {
          success: false,
          error: 'You already have a leave request for overlapping dates',
          errorCode: 'OVERLAPPING_DATES'
        },
        { status: 409 }
      )
    }

    // === VALIDATION 3: Calculate working days (excluding weekends AND holidays) ===
    const totalDays = await calculateWorkingDays(fromDateUTC, toDateUTC, validatedData.half_day || false, supabase)

    if (totalDays === 0 && !validatedData.half_day) {
      return NextResponse.json(
        {
          success: false,
          error: 'Selected date range contains no working days',
          errorCode: 'NO_WORKING_DAYS'
        },
        { status: 400 }
      )
    }

    // === VALIDATION 4: Check leave type constraints ===
    const { data: leaveType, error: leaveTypeError } = await supabase
      .from('leave_types')
      .select('name, max_days_per_request, requires_approval')
      .eq('id', validatedData.leave_type_id)
      .maybeSingle()

    if (leaveTypeError || !leaveType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid leave type',
          errorCode: 'INVALID_LEAVE_TYPE'
        },
        { status: 400 }
      )
    }

    if (leaveType.max_days_per_request && totalDays > leaveType.max_days_per_request) {
      return NextResponse.json(
        {
          success: false,
          error: `${leaveType.name} allows maximum ${leaveType.max_days_per_request} days per request`,
          errorCode: 'MAX_DAYS_EXCEEDED'
        },
        { status: 400 }
      )
    }

    // === VALIDATION 5: Check leave balance (with race condition protection) ===
    const year = fromDateUTC.getFullYear()

    // Use RPC function for atomic balance check and reserve
    const { data: balanceCheck, error: balanceError } = await supabase
      .rpc('check_and_reserve_leave_balance', {
        p_user_id: user.id,
        p_leave_type_id: validatedData.leave_type_id,
        p_year: year,
        p_days_requested: totalDays
      })

    if (balanceError) {
      apiLogger.error('Balance check error', balanceError)

      // Fallback to atomic check-and-reserve if RPC doesn't exist
      if (balanceError.code === '42883') { // Function not found
        const { data: balance } = await supabase
          .from('leave_balance')
          .select('id, available, pending')
          .eq('user_id', user.id)
          .eq('leave_type_id', validatedData.leave_type_id)
          .eq('year', year)
          .maybeSingle()

        const available = parseFloat(balance?.available) || 0
        const currentPending = parseFloat(balance?.pending) || 0

        if (!balance || available < totalDays) {
          return NextResponse.json(
            {
              success: false,
              error: 'Insufficient leave balance',
              errorCode: 'INSUFFICIENT_BALANCE',
              available: available,
              requested: totalDays
            },
            { status: 400 }
          )
        }

        // Atomic update: reserve balance by incrementing pending and reducing available
        const { error: reserveError } = await supabase
          .from('leave_balance')
          .update({
            pending: currentPending + totalDays,
            available: available - totalDays,
            updated_at: new Date().toISOString()
          })
          .eq('id', balance.id)
          .eq('available', balance.available) // Optimistic lock: only update if available hasn't changed

        if (reserveError) {
          return NextResponse.json(
            {
              success: false,
              error: 'Leave balance changed, please try again',
              errorCode: 'BALANCE_CONFLICT'
            },
            { status: 409 }
          )
        }
      } else {
        throw balanceError
      }
    } else if (balanceCheck === false) {
      // Balance check failed (insufficient balance)
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient leave balance',
          errorCode: 'INSUFFICIENT_BALANCE'
        },
        { status: 400 }
      )
    }

    // === VALIDATION 6: Get approver (manager or HR) ===
    const { data: employeeData } = await supabase
      .from('users')
      .select('reports_to, department')
      .eq('id', user.id)
      .maybeSingle()

    let currentApprover = employeeData?.reports_to || null

    // If no manager, route to HR department
    if (!currentApprover) {
      const { data: hrUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'EMPLOYEE')
        .eq('sub_role', 'hr_executive')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      currentApprover = hrUsers?.id || null
    }

    // === CREATE LEAVE REQUEST ===
    const { data: leaveRequest, error: createError } = await supabase
      .from('leave_requests')
      .insert({
        user_id: user.id,
        leave_type_id: validatedData.leave_type_id,
        from_date: validatedData.from_date,
        to_date: validatedData.to_date,
        total_days: totalDays,
        reason: sanitizedReason,
        documents: validatedData.documents || null,
        status: leaveType.requires_approval ? 'pending' : 'auto_approved',
        current_approver: leaveType.requires_approval ? currentApprover : null,
        applied_at: new Date().toISOString()
      })
      .select(`
        *,
        leave_types (
          name,
          color
        )
      `)
      .maybeSingle()

    if (createError) {
      // If creation fails, return reserved balance
      if (balanceCheck !== false) {
        await supabase.rpc('release_reserved_balance', {
          p_user_id: user.id,
          p_leave_type_id: validatedData.leave_type_id,
          p_year: year,
          p_days_to_release: totalDays
        }).catch(err => apiLogger.error('Failed to release balance', err))
      }
      throw createError
    }

    // Log success
    apiLogger.info(`Leave request created: ${leaveRequest.id} for user ${user.id}`)

    return NextResponse.json({
      success: true,
      data: leaveRequest,
      message: leaveType.requires_approval
        ? 'Leave request submitted successfully. Pending approval.'
        : 'Leave request auto-approved successfully.'
    }, { status: 201 })

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          errorCode: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    apiLogger.error('Create leave request error', error)
    logApiError(error instanceof Error ? error : new Error('Unknown error'), request, { action: 'create_leave_request' })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'CREATE_FAILED'
      },
      { status: 500 }
    )
  }
}

// PATCH - Update leave request documents (only if pending, owner only)
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { request_id, documents } = body

    if (!request_id || !documents) {
      return NextResponse.json(
        { success: false, error: 'Request ID and documents required', errorCode: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // Validate document URLs
    if (!Array.isArray(documents)) {
      return NextResponse.json(
        { success: false, error: 'Documents must be an array of URLs', errorCode: 'INVALID_DOCUMENTS' },
        { status: 400 }
      )
    }

    const urlSchema = z.array(z.string().url('Each document must be a valid URL'))
    const urlValidation = urlSchema.safeParse(documents)
    if (!urlValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid document URLs provided',
          errorCode: 'INVALID_DOCUMENT_URLS',
          details: urlValidation.error.errors.map(e => e.message)
        },
        { status: 400 }
      )
    }

    // Verify ownership and pending status
    const { data: existing, error: fetchError } = await supabase
      .from('leave_requests')
      .select('id, status')
      .eq('id', request_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found', errorCode: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Can only update pending requests', errorCode: 'INVALID_STATUS' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({ documents, updated_at: new Date().toISOString() })
      .eq('id', request_id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, message: 'Documents attached successfully' })

  } catch (error: unknown) {
    apiLogger.error('Update leave request error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update leave request', errorCode: 'UPDATE_FAILED' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel leave request (only if pending)
export async function DELETE(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('id')

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'Request ID required', errorCode: 'MISSING_ID' },
        { status: 400 }
      )
    }

    // Get leave request details
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*, leave_type_id, total_days, from_date')
      .eq('id', requestId)
      .eq('user_id', user.id) // Ensure user owns this request
      .maybeSingle()

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found', errorCode: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Only pending requests can be cancelled
    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel ${leaveRequest.status} leave request`,
          errorCode: 'INVALID_STATUS'
        },
        { status: 400 }
      )
    }

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateError) {
      throw updateError
    }

    // Return reserved balance
    const year = new Date(leaveRequest.from_date).getFullYear()
    await supabase
      .rpc('return_leave_balance', {
        p_leave_request_id: requestId
      })
      .catch(err => apiLogger.error('Failed to return balance', err))

    return NextResponse.json({
      success: true,
      message: 'Leave request cancelled successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Cancel leave request error', error)
    logApiError(error instanceof Error ? error : new Error('Unknown error'), request, { action: 'cancel_leave_request' })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'CANCEL_FAILED'
      },
      { status: 500 }
    )
  }
}
