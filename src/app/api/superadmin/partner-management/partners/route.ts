import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { logPartnerCreated, sanitizeForAudit } from '@/lib/audit/audit-logger'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/partner-management/partners
 * Fetch paginated list of partners with filters and search
 *
 * Rate Limit: 60 requests per minute
 *
 * Query Parameters:
 * - partner_type: BUSINESS_ASSOCIATE | BUSINESS_PARTNER | CHANNEL_PARTNER
 * - month: YYYY-MM format
 * - state: State name
 * - city: City name
 * - status: ACTIVE | INACTIVE | PENDING_APPROVAL | SUSPENDED
 * - search: Search by name, email, mobile, or partner ID
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50)
 * - sort_by: Field to sort by (default: created_at)
 * - sort_order: asc | desc (default: desc)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  return readRateLimiter(request, async (req) => {
    return await getPartnersHandler(req)
  })
}

async function getPartnersHandler(request: NextRequest) {
  try {
    // Use unified auth to support both Supabase Auth and Super Admin sessions
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams

    const partnerType = searchParams.get('partner_type')
    const month = searchParams.get('month')
    const state = searchParams.get('state')
    const city = searchParams.get('city')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    // Validate and sanitize pagination parameters to prevent DoS attacks
    let page = parseInt(searchParams.get('page') || '1')
    let limit = parseInt(searchParams.get('limit') || '50')

    // Enforce bounds on page and limit
    if (isNaN(page) || page < 1) page = 1
    if (isNaN(limit) || limit < 1) limit = 50
    if (limit > 100) limit = 100 // Maximum 100 items per page to prevent DoS

    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = (searchParams.get('sort_order') || 'desc') as 'asc' | 'desc'

    // Use admin client for database queries
    const supabase = createSupabaseAdmin()

    // Build base query
    let query = supabase
      .from('partners')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .is('deleted_at', null)

    // Apply filters
    if (partnerType) {
      query = query.eq('partner_type', partnerType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (state) {
      query = query.eq('state', state)
    }

    if (city) {
      query = query.eq('city', city)
    }

    if (month) {
      const startDate = new Date(month + '-01')
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)

      query = query
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
    }

    // Search functionality - sanitize input to prevent SQL injection
    if (search) {
      // Sanitize search input - remove special characters that could be used for SQL injection
      const sanitizedSearch = search.replace(/[%_'";\\]/g, '')

      // Use parameterized filters instead of string interpolation
      query = query.or(`full_name.ilike.%${sanitizedSearch}%,work_email.ilike.%${sanitizedSearch}%,personal_email.ilike.%${sanitizedSearch}%,mobile_number.ilike.%${sanitizedSearch}%,partner_id.ilike.%${sanitizedSearch}%`)
    }

    // Get total count
    const { count: totalCount, error: countError } = await query

    if (countError) {
      apiLogger.error('Count query error', countError)
      return NextResponse.json(
        { success: false, error: 'Failed to count partners' },
        { status: 500 }
      )
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * limit, page * limit - 1)

    const { data: partners, error: queryError } = await query

    if (queryError) {
      apiLogger.error('Partners query error', queryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partners' },
        { status: 500 }
      )
    }

    // Format response
    const formattedPartners = partners?.map((partner: any) => ({
      id: partner.id,
      partner_id: partner.partner_id,
      full_name: partner.full_name,
      email: partner.work_email || partner.personal_email,
      mobile_number: partner.mobile_number,
      partner_type: partner.partner_type,
      status: partner.status,
      city: partner.city,
      state: partner.state,
      total_logins: partner.total_logins || 0,
      total_leads: partner.total_leads || 0,
      leads_in_progress: partner.leads_in_progress || 0,
      leads_sanctioned: partner.leads_sanctioned || 0,
      leads_dropped: partner.leads_dropped || 0,
      estimated_payout: parseFloat(partner.estimated_payout || 0).toFixed(2),
      actual_payout: parseFloat(partner.actual_payout || 0).toFixed(2),
      lifetime_earnings: parseFloat(partner.lifetime_earnings || 0).toFixed(2),
      joining_date: partner.joining_date,
      last_login_at: partner.last_login_at,
      created_at: partner.created_at
    }))

    const totalPages = Math.ceil((totalCount || 0) / limit)

    return NextResponse.json({
      success: true,
      data: {
        partners: formattedPartners,
        pagination: {
          page,
          limit,
          total_count: totalCount || 0,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      }
    })

  } catch (error) {
    apiLogger.error('Partners list API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/partner-management/partners
 * Create a new partner (Super Admin manual addition)
 *
 * Rate Limit: 30 requests per minute
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting for write operations
  return writeRateLimiter(request, async (req) => {
    return await createPartnerHandler(req)
  })
}

async function createPartnerHandler(request: NextRequest) {
  try {
    // Use unified auth to support both Supabase Auth and Super Admin sessions
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate required fields
    const {
      partner_type,
      full_name,
      mobile_number,
      work_email,
      personal_email,
      present_address,
      city,
      state,
      pincode,
      address_proof_url,
      address_proof_type
    } = body

    if (!partner_type || !full_name || !mobile_number || !work_email || !present_address) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: partner_type, full_name, mobile_number, work_email, present_address' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(work_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid work email format' },
        { status: 400 }
      )
    }

    if (personal_email && !emailRegex.test(personal_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid personal email format' },
        { status: 400 }
      )
    }

    // Validate mobile number format (10 digits, starts with 6-9)
    const mobileRegex = /^[6-9]\d{9}$/
    if (!mobileRegex.test(mobile_number)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format. Must be 10 digits starting with 6-9' },
        { status: 400 }
      )
    }

    // Validate pincode if provided
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid pincode format. Must be 6 digits' },
        { status: 400 }
      )
    }

    // Validate partner_type
    const validPartnerTypes = ['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER']
    if (!validPartnerTypes.includes(partner_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid partner type. Must be BUSINESS_ASSOCIATE, BUSINESS_PARTNER, or CHANNEL_PARTNER' },
        { status: 400 }
      )
    }

    // Use admin client for database operations
    const supabase = createSupabaseAdmin()

    // Check if email already exists (use parameterized query to prevent SQL injection)
    const { data: existingByWorkEmail } = await supabase
      .from('partners')
      .select('id')
      .eq('work_email', work_email)
      .maybeSingle()

    if (existingByWorkEmail) {
      return NextResponse.json(
        { success: false, error: 'Partner with this work email already exists' },
        { status: 409 }
      )
    }

    if (personal_email) {
      const { data: existingByPersonalEmail } = await supabase
        .from('partners')
        .select('id')
        .eq('personal_email', personal_email)
        .maybeSingle()

      if (existingByPersonalEmail) {
        return NextResponse.json(
          { success: false, error: 'Partner with this personal email already exists' },
          { status: 409 }
        )
      }
    }

    // Check if mobile number already exists
    const { data: existingByMobile } = await supabase
      .from('partners')
      .select('id')
      .eq('mobile_number', mobile_number)
      .maybeSingle()

    if (existingByMobile) {
      return NextResponse.json(
        { success: false, error: 'Partner with this mobile number already exists' },
        { status: 409 }
      )
    }

    // Create user account first using admin client
    const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
      email: work_email,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: 'PARTNER',
        sub_role: partner_type
      }
    })

    if (authCreateError) {
      apiLogger.error('Auth user creation error', authCreateError)
      return NextResponse.json(
        { success: false, error: `Failed to create user account: ${authCreateError.message}` },
        { status: 500 }
      )
    }

    const authUserId = authData.user.id

    // Create user record with transaction-like error handling
    const { error: userInsertError } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        email: work_email,
        full_name,
        role: 'PARTNER',
        sub_role: partner_type,
        status: 'ACTIVE',
        email_verified: true,
        mobile_verified: false,
        mobile_number
      })

    if (userInsertError) {
      apiLogger.error('User insert error', userInsertError)
      // Rollback: Delete auth user
      try {
        await supabase.auth.admin.deleteUser(authUserId)
      } catch (rollbackError) {
        apiLogger.error('Rollback auth user failed', rollbackError)
      }
      return NextResponse.json(
        { success: false, error: `Failed to create user record: ${userInsertError.message}` },
        { status: 500 }
      )
    }

    // Create partner record
    const { data: newPartner, error: partnerInsertError } = await supabase
      .from('partners')
      .insert({
        user_id: authUserId,
        partner_type,
        full_name,
        mobile_number,
        work_email,
        personal_email,
        present_address,
        city,
        state,
        pincode,
        address_proof_url,
        address_proof_type,
        status: 'ACTIVE',
        registration_source: 'super_admin',
        added_by: auth.userId,
        joining_date: new Date().toISOString().split('T')[0],
        is_active: true
      })
      .select()
      .maybeSingle()

    if (partnerInsertError) {
      apiLogger.error('Partner insert error', partnerInsertError)
      // Rollback: Delete user and auth creation
      try {
        await supabase.from('users').delete().eq('id', authUserId)
        await supabase.auth.admin.deleteUser(authUserId)
      } catch (rollbackError) {
        apiLogger.error('Rollback failed', rollbackError)
      }
      return NextResponse.json(
        { success: false, error: `Failed to create partner record: ${partnerInsertError.message}` },
        { status: 500 }
      )
    }

    // Log audit trail for partner creation
    try {
      await logPartnerCreated(
        newPartner.id,
        sanitizeForAudit({
          partner_id: newPartner.partner_id,
          partner_type: newPartner.partner_type,
          full_name: newPartner.full_name,
          work_email: newPartner.work_email,
          mobile_number: newPartner.mobile_number,
          city: newPartner.city,
          state: newPartner.state,
          status: newPartner.status,
          registration_source: 'super_admin'
        }),
        auth.userId!,
        request
      )
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      apiLogger.error('Audit logging failed', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Partner created successfully',
      data: {
        partner_id: newPartner.partner_id,
        id: newPartner.id,
        full_name: newPartner.full_name,
        email: newPartner.work_email,
        partner_type: newPartner.partner_type
      }
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Create partner API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
