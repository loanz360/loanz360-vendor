import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/hr/payroll/tax-declarations
// Fetch tax declarations (HR sees all, employees see their own)
export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminClient = createSupabaseAdmin()

    // Check user role
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHROrAdmin = profile && (profile.role === 'hr' || profile.role === 'superadmin')

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const financialYear = searchParams.get('financial_year')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = adminClient
      .from('tax_declarations')
      .select(`
        *,
        employee_profile!tax_declarations_user_id_fkey (
          first_name,
          last_name,
          employee_id,
          email,
          department,
          designation
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    // If not HR/Admin, only show own declarations
    if (!isHROrAdmin) {
      query = query.eq('user_id', user.id)
    } else if (employeeId) {
      // HR/Admin can filter by employee
      query = query.eq('user_id', employeeId)
    }

    // Filter by financial year
    if (financialYear) {
      query = query.eq('financial_year', financialYear)
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status)
    }

    const { data: declarations, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: declarations || [],
      meta: { page, page_size: pageSize, total: count ?? 0 }
    })

  } catch (error) {
    apiLogger.error('Fetch tax declarations error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tax declarations' },
      { status: 500 }
    )
  }
}

// POST /api/hr/payroll/tax-declarations
// Create or update tax declaration (employees for themselves, HR for any employee)
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

    // Check user role
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHROrAdmin = profile && (profile.role === 'hr' || profile.role === 'superadmin')

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      user_id,
      financial_year,
      section_80c,
      section_80d,
      section_80e,
      section_80g,
      section_80tta,
      hra_exemption,
      other_exemptions,
      remarks
    } = body

    // Validate required fields
    if (!financial_year) {
      return NextResponse.json(
        { success: false, error: 'Financial year is required' },
        { status: 400 }
      )
    }

    // Validate all declaration amounts are non-negative
    const amountFields = { section_80c, section_80d, section_80e, section_80g, section_80tta, hra_exemption, other_exemptions }
    for (const [field, value] of Object.entries(amountFields)) {
      if (value !== undefined && value !== null && (typeof value !== 'number' || value < 0)) {
        return NextResponse.json(
          { success: false, error: `${field.replace(/_/g, ' ')} must be a non-negative number` },
          { status: 400 }
        )
      }
    }

    // Determine target user
    const targetUserId = isHROrAdmin && user_id ? user_id : user.id

    // Check if declaration already exists for this financial year
    const { data: existing } = await adminClient
      .from('tax_declarations')
      .select('id, status')
      .eq('user_id', targetUserId)
      .eq('financial_year', financial_year)
      .maybeSingle()

    if (existing) {
      // Cannot update approved declarations
      if (existing.status === 'approved') {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot update approved declaration. Please contact HR.'
          },
          { status: 400 }
        )
      }

      // Update existing declaration
      const { data: updated, error: updateError } = await adminClient
        .from('tax_declarations')
        .update({
          section_80c: section_80c || 0,
          section_80d: section_80d || 0,
          section_80e: section_80e || 0,
          section_80g: section_80g || 0,
          section_80tta: section_80tta || 0,
          hra_exemption: hra_exemption || 0,
          other_exemptions: other_exemptions || 0,
          remarks,
          status: 'pending' // Reset to pending when updated
        })
        .eq('id', existing.id)
        .select()
        .maybeSingle()

      if (updateError) {
        throw updateError
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Tax declaration updated successfully'
      })
    }

    // Create new declaration
    const { data: declaration, error: createError } = await adminClient
      .from('tax_declarations')
      .insert({
        user_id: targetUserId,
        financial_year,
        section_80c: section_80c || 0,
        section_80d: section_80d || 0,
        section_80e: section_80e || 0,
        section_80g: section_80g || 0,
        section_80tta: section_80tta || 0,
        hra_exemption: hra_exemption || 0,
        other_exemptions: other_exemptions || 0,
        remarks,
        status: 'pending'
      })
      .select()
      .maybeSingle()

    if (createError) {
      throw createError
    }

    return NextResponse.json({
      success: true,
      data: declaration,
      message: 'Tax declaration submitted successfully'
    })

  } catch (error) {
    apiLogger.error('Create/update tax declaration error', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json(
      { success: false, error: 'Failed to save tax declaration' },
      { status: 500 }
    )
  }
}
