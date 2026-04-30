import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { csrfProtection } from '@/lib/middleware/csrf'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'

const shiftSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
  end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
  grace_period_minutes: z.number().min(0).max(60).default(15),
  required_hours: z.number().min(0).max(24).default(8.0)
})

// GET - Fetch all shift definitions
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: shifts, error, count } = await adminClient
      .from('shift_definitions')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('name')
      .range(from, to)

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: shifts || [],
      meta: { page, page_size: pageSize, total: count ?? 0 }
    })

  } catch (error: unknown) {
    apiLogger.error('Fetch shifts error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch shifts' },
      { status: 500 }
    )
  }
}

// POST - Create new shift
export async function POST(request: NextRequest) {
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or Super Admin
    const { data: userData } = await adminClient
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = userData?.sub_role === 'hr_executive' || userData?.sub_role === 'hr_manager'
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN'

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = shiftSchema.parse(body)

    // Validate shift times: for non-overnight shifts, start must be before end
    // Overnight shifts (e.g. 22:00 - 06:00) are valid when start > end
    const startMinutes = parseInt(validatedData.start_time.split(':')[0]) * 60 + parseInt(validatedData.start_time.split(':')[1])
    const endMinutes = parseInt(validatedData.end_time.split(':')[0]) * 60 + parseInt(validatedData.end_time.split(':')[1])
    if (startMinutes === endMinutes) {
      return NextResponse.json(
        { success: false, error: 'Start time and end time cannot be the same' },
        { status: 400 }
      )
    }

    // Check name uniqueness
    const { data: existingShift } = await adminClient
      .from('shift_definitions')
      .select('id')
      .eq('name', validatedData.name)
      .eq('is_active', true)
      .maybeSingle()

    if (existingShift) {
      return NextResponse.json(
        { success: false, error: 'A shift with this name already exists' },
        { status: 409 }
      )
    }

    const { data: shift, error } = await adminClient
      .from('shift_definitions')
      .insert({
        ...validatedData,
        created_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: shift,
      message: 'Shift created successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    apiLogger.error('Create shift error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create shift' },
      { status: 500 }
    )
  }
}
