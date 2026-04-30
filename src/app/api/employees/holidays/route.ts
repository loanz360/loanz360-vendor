import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has an employee profile (authorization check)
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Employee profile not found.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year') || new Date().getFullYear().toString()
    const year = parseInt(yearParam, 10)

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, error: 'Invalid year parameter' },
        { status: 400 }
      )
    }

    // Fetch holidays for the year
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const { data: holidays, error } = await adminClient
      .from('holidays')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: holidays || []
    }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' }
    })

  } catch (error) {
    apiLogger.error('Fetch holidays error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch holidays' },
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

    // Get current user
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
        { success: false, error: 'Only HR and Super Admin can create holidays' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { name, date, type, description, is_mandatory } = body

    // Validate required fields
    if (!name || !date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name and date are required' },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      )
    }

    // Validate name length
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Holiday name must be between 1 and 200 characters' },
        { status: 400 }
      )
    }

    // Create holiday
    const { data: holiday, error } = await adminClient
      .from('holidays')
      .insert({
        name,
        date,
        type: type || 'national',
        description: description || null,
        is_mandatory: is_mandatory !== undefined ? is_mandatory : true,
        created_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'holiday',
        entity_id: holiday.id,
        description: `Created holiday: ${name} on ${date}`,
        details: { name, date, type: type || 'national', is_mandatory }
      })
    } catch { /* audit log failure should not block response */ }

    return NextResponse.json({
      success: true,
      data: holiday
    })

  } catch (error) {
    apiLogger.error('Create holiday error', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json(
      { success: false, error: 'Failed to create holiday' },
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
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json({ success: false, error: 'Only HR and Super Admin can update holidays' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { id, name, date, type, description, is_mandatory } = body

    if (!id || !name || !date) {
      return NextResponse.json({ success: false, error: 'Missing required fields: id, name, and date are required' }, { status: 400 })
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const { data: holiday, error } = await adminClient
      .from('holidays')
      .update({
        name,
        date,
        type: type || 'national',
        description: description || null,
        is_mandatory: is_mandatory !== undefined ? is_mandatory : true
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'holiday',
        entity_id: id,
        description: `Updated holiday: ${name} on ${date}`,
        details: { id, name, date, type: type || 'national', is_mandatory }
      })
    } catch { /* audit log failure should not block response */ }

    return NextResponse.json({ success: true, data: holiday })
  } catch (error) {
    apiLogger.error('Update holiday error', error)
    logApiError(error as Error, request, { action: 'update' })
    return NextResponse.json({ success: false, error: 'Failed to update holiday' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
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
        { success: false, error: 'Only HR and Super Admin can delete holidays' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Holiday ID is required' },
        { status: 400 }
      )
    }

    const { error } = await adminClient
      .from('holidays')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'holiday',
        entity_id: id,
        description: `Deleted holiday with ID: ${id}`,
      })
    } catch { /* audit log failure should not block response */ }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    apiLogger.error('Delete holiday error', error)
    logApiError(error as Error, request, { action: 'delete' })
    return NextResponse.json(
      { success: false, error: 'Failed to delete holiday' },
      { status: 500 }
    )
  }
}
