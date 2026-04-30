import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { csrfProtection } from '@/lib/middleware/csrf'
import { apiLogger } from '@/lib/utils/logger'
import { z, ZodError } from 'zod'
import {
  generateCompOffCredit,
  isCompOffEligible
} from '@/lib/utils/attendance-enhancements'

// ── Validation Schemas ───────────────────────────────────────────────────────

const compOffRequestSchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason must not exceed 500 characters')
})

// ── GET: List comp-off credits ───────────────────────────────────────────────

/**
 * GET /api/employees/attendance/comp-off
 *
 * Lists the authenticated user's comp-off credits.
 * Query params:
 *   - status: 'available' | 'used' | 'expired' | 'all' (default: 'all')
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 50)
 */
export async function GET(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('comp_off_credits')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('work_date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply status filter
    if (statusFilter !== 'all') {
      const validStatuses = ['available', 'used', 'expired']
      if (validStatuses.includes(statusFilter)) {
        query = query.eq('status', statusFilter)
      }
    }

    const { data: credits, error, count } = await query

    if (error) {
      throw error
    }

    // Calculate summary
    const today = new Date().toISOString().split('T')[0]

    // Fetch summary counts separately for accuracy (not affected by pagination)
    const { data: allCredits } = await supabase
      .from('comp_off_credits')
      .select('status, credit_type, expires_at')
      .eq('user_id', user.id)

    const summary = {
      available: 0,
      used: 0,
      expired: 0,
      availableFullDays: 0,
      availableHalfDays: 0,
      nearingExpiry: 0
    }

    if (allCredits) {
      for (const credit of allCredits) {
        if (credit.status === 'available') {
          summary.available++
          if (credit.credit_type === 'full_day') summary.availableFullDays++
          else if (credit.credit_type === 'half_day') summary.availableHalfDays++

          // Check if expiring within 7 days
          if (credit.expires_at) {
            const expiresAt = new Date(credit.expires_at)
            const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
              summary.nearingExpiry++
            }
          }
        } else if (credit.status === 'used') {
          summary.used++
        } else if (credit.status === 'expired') {
          summary.expired++
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        credits: credits || [],
        summary,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error) {
    apiLogger.error('Comp-off list error', error)
    logApiError(error as Error, request, { action: 'get_comp_off_credits' })

    return NextResponse.json(
      { success: false, error: 'Failed to fetch comp-off credits' },
      { status: 500 }
    )
  }
}

// ── POST: Request comp-off credit ────────────────────────────────────────────

/**
 * POST /api/employees/attendance/comp-off
 *
 * Request a comp-off credit for working on a holiday or weekend.
 * Validates that:
 * 1. The date was a weekend or holiday
 * 2. The user actually checked in on that date
 * 3. No duplicate comp-off exists for the same date
 * 4. Minimum hours threshold is met (4 hours)
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = compOffRequestSchema.parse(body)

    const workDate = validatedData.work_date
    const today = new Date().toISOString().split('T')[0]

    // ── Validation 1: Date must be in the past or today ──────────────────────
    if (workDate > today) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot request comp-off for a future date',
          errorCode: 'FUTURE_DATE'
        },
        { status: 400 }
      )
    }

    // ── Validation 2: Date must not be too old (max 30 days) ─────────────────
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    if (workDate < thirtyDaysAgoStr) {
      return NextResponse.json(
        {
          success: false,
          error: 'Comp-off can only be requested for dates within the last 30 days',
          errorCode: 'DATE_TOO_OLD'
        },
        { status: 400 }
      )
    }

    // ── Validation 3: Must be a weekend or holiday ───────────────────────────
    const workDateObj = new Date(workDate + 'T00:00:00Z')
    const dayOfWeek = workDateObj.getUTCDay()

    // Check if it's a holiday
    const { data: holidayRecord } = await supabase
      .from('holidays')
      .select('id, name')
      .eq('date', workDate)
      .maybeSingle()

    const isHoliday = !!holidayRecord

    if (!isCompOffEligible(dayOfWeek, isHoliday)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Comp-off is only available for work done on weekends or holidays',
          errorCode: 'NOT_ELIGIBLE_DAY'
        },
        { status: 400 }
      )
    }

    // ── Validation 4: User must have an attendance record for that date ──────
    const { data: attendanceRecord, error: attendanceError } = await supabase
      .from('attendance')
      .select('id, check_in, check_out, total_hours, status')
      .eq('user_id', user.id)
      .eq('date', workDate)
      .maybeSingle()

    if (attendanceError && attendanceError.code !== 'PGRST116') {
      throw attendanceError
    }

    if (!attendanceRecord || !attendanceRecord.check_in) {
      return NextResponse.json(
        {
          success: false,
          error: 'No check-in found for this date. You must have a valid attendance record to request comp-off.',
          errorCode: 'NO_ATTENDANCE_RECORD'
        },
        { status: 400 }
      )
    }

    // ── Validation 5: Minimum hours check ────────────────────────────────────
    const hoursWorked = attendanceRecord.total_hours || 0

    if (hoursWorked < 4) {
      return NextResponse.json(
        {
          success: false,
          error: `Minimum 4 hours of work required for comp-off. You worked ${hoursWorked.toFixed(1)} hours on ${workDate}.`,
          errorCode: 'INSUFFICIENT_HOURS'
        },
        { status: 400 }
      )
    }

    // ── Validation 6: No duplicate comp-off for same date ────────────────────
    const { data: existingCompOff } = await supabase
      .from('comp_off_credits')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('work_date', workDate)
      .maybeSingle()

    if (existingCompOff) {
      return NextResponse.json(
        {
          success: false,
          error: `A comp-off request already exists for ${workDate} (status: ${existingCompOff.status})`,
          errorCode: 'DUPLICATE_REQUEST'
        },
        { status: 409 }
      )
    }

    // ── Generate and insert comp-off credit ──────────────────────────────────
    const compOffData = generateCompOffCredit(user.id, workDate, hoursWorked)

    if (!compOffData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to generate comp-off credit. Minimum 4 hours required.',
          errorCode: 'GENERATION_FAILED'
        },
        { status: 400 }
      )
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[dayOfWeek]
    const holidayInfo = isHoliday ? ` (Holiday: ${holidayRecord?.name})` : ''

    const { data: insertedCredit, error: insertError } = await supabase
      .from('comp_off_credits')
      .insert({
        user_id: user.id,
        work_date: workDate,
        hours_worked: hoursWorked,
        credit_type: compOffData.creditType,
        expires_at: compOffData.expiresAt,
        status: 'available',
        reason: validatedData.reason,
        day_type: isHoliday ? 'holiday' : 'weekend',
        attendance_id: attendanceRecord.id
      })
      .select()
      .single()

    if (insertError) {
      apiLogger.error('Failed to insert comp-off credit', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      data: {
        compOff: insertedCredit,
        summary: {
          workDate,
          dayName,
          dayType: isHoliday ? `Holiday${holidayInfo}` : `Weekend (${dayName})`,
          hoursWorked: hoursWorked.toFixed(1),
          creditType: compOffData.creditType === 'full_day' ? 'Full Day' : 'Half Day',
          expiresAt: compOffData.expiresAt
        }
      },
      message: `Comp-off ${compOffData.creditType === 'full_day' ? 'full day' : 'half day'} credit created for ${dayName}, ${workDate}${holidayInfo}. Expires on ${compOffData.expiresAt}.`
    }, { status: 201 })

  } catch (error) {
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

    apiLogger.error('Comp-off request error', error)
    logApiError(error as Error, request, { action: 'post_comp_off_request' })

    return NextResponse.json(
      { success: false, error: 'Failed to process comp-off request' },
      { status: 500 }
    )
  }
}
