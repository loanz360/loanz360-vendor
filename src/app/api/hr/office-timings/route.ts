
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'

export async function GET(request: Request) {
  // Apply rate limiting
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

    const access = await checkHRAccess(supabase)
    if (!access) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: timings, error, count } = await adminClient
      .from('office_timings')
      .select('*', { count: 'exact' })
      .order('is_default', { ascending: false })
      .range(from, to)

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: timings || [],
      meta: { page, page_size: pageSize, total: count ?? 0 }
    }, {
      headers: { 'Cache-Control': 'private, max-age=600, stale-while-revalidate=120' }
    })

  } catch (error) {
    apiLogger.error('Fetch office timings error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch office timings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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

    const access = await checkHRAccess(supabase)
    if (!access) {
      return NextResponse.json(
        { success: false, error: 'Only HR and Super Admin can manage office timings' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, check_in_time, check_out_time, grace_period_minutes, is_default } = body

    if (!name || !check_in_time || !check_out_time) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate timing format (HH:MM:SS or HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/
    if (!timeRegex.test(check_in_time) || !timeRegex.test(check_out_time)) {
      return NextResponse.json(
        { success: false, error: 'Invalid time format. Use HH:MM or HH:MM:SS (24-hour format)' },
        { status: 400 }
      )
    }

    // Check name uniqueness
    const { data: existingTiming } = await adminClient
      .from('office_timings')
      .select('id')
      .eq('name', name)
      .maybeSingle()

    if (existingTiming) {
      return NextResponse.json(
        { success: false, error: 'An office timing with this name already exists' },
        { status: 409 }
      )
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await adminClient
        .from('office_timings')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const { data: timing, error } = await adminClient
      .from('office_timings')
      .insert({
        name,
        check_in_time,
        check_out_time,
        grace_period_minutes: grace_period_minutes || 15,
        is_default: is_default || false
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: timing
    })

  } catch (error) {
    apiLogger.error('Create office timing error', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json(
      { success: false, error: 'Failed to create office timing' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
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

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Only HR and Super Admin can manage office timings' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, check_in_time, check_out_time, grace_period_minutes, is_default } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Office timing ID is required' },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await adminClient
        .from('office_timings')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', id)
    }

    const { data: timing, error } = await adminClient
      .from('office_timings')
      .update({
        name,
        check_in_time,
        check_out_time,
        grace_period_minutes,
        is_default,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: timing
    })

  } catch (error) {
    apiLogger.error('Update office timing error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to update office timing' },
      { status: 500 }
    )
  }
}
