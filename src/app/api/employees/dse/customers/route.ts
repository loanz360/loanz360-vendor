import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { validatePagination } from '@/lib/validations/dse-validation'


// Maximum number of keys allowed in custom_fields
const MAX_CUSTOM_FIELDS_KEYS = 20

// Validation schema for creating/updating customer
const customerSchema = z.object({
  full_name: z.string().min(2).max(255),
  company_name: z.string().max(255).optional().nullable(),
  designation: z.string().max(150).optional().nullable(),
  department: z.string().max(150).optional().nullable(),
  primary_mobile: z.string().min(10).max(15),
  alternate_mobile: z.string().max(15).optional().nullable(),
  whatsapp_number: z.string().max(15).optional().nullable(),
  email: z.string().email().optional().nullable(),
  alternate_email: z.string().email().optional().nullable(),
  landline: z.string().max(20).optional().nullable(),
  address_line1: z.string().max(500).optional().nullable(),
  address_line2: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  country: z.string().max(100).default('India'),
  business_type: z.enum([
    'Individual', 'Proprietorship', 'Partnership', 'LLP', 'Private Limited',
    'Public Limited', 'Government', 'NGO', 'Trust', 'Other'
  ]).optional().nullable(),
  industry: z.string().max(150).optional().nullable(),
  company_size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional().nullable(),
  annual_turnover: z.number().optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  linkedin_profile: z.string().max(500).optional().nullable(),
  visit_location: z.string().max(500).optional().nullable(),
  visit_latitude: z.number().optional().nullable(),
  visit_longitude: z.number().optional().nullable(),
  visit_address: z.string().optional().nullable(),
  source: z.enum([
    'Field Visit', 'Visiting Card', 'Referral', 'Cold Call', 'Exhibition',
    'Seminar', 'Digital Campaign', 'Walk-in', 'Partner Referral', 'Other'
  ]).default('Field Visit'),
  referral_source: z.string().max(255).optional().nullable(),
  campaign_name: z.string().max(255).optional().nullable(),
  customer_status: z.enum([
    'New', 'Active', 'Prospect', 'Hot Lead', 'Warm Lead', 'Cold Lead',
    'Customer', 'Inactive', 'Lost', 'DNC'
  ]).default('New'),
  tags: z.array(z.string()).optional().nullable(),
  custom_fields: z.record(z.string(), z.unknown()).optional().nullable().refine(
    (val) => !val || Object.keys(val).length <= MAX_CUSTOM_FIELDS_KEYS,
    { message: `custom_fields cannot have more than ${MAX_CUSTOM_FIELDS_KEYS} keys` }
  ),
  customer_rating: z.number().min(1).max(5).optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  potential_value: z.number().optional().nullable(),
})

// GET - List customers with filtering, pagination, and search
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = validatePagination(searchParams.get('page'), searchParams.get('limit'))
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const source = searchParams.get('source') || ''
    const priority = searchParams.get('priority') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build query with specific columns instead of select('*')
    let query = supabase
      .from('dse_customers')
      .select('id, customer_id, full_name, company_name, designation, department, primary_mobile, alternate_mobile, whatsapp_number, email, alternate_email, landline, address_line1, address_line2, city, state, pincode, country, business_type, industry, company_size, annual_turnover, website, linkedin_profile, visit_location, visit_latitude, visit_longitude, visit_address, source, referral_source, campaign_name, customer_status, tags, custom_fields, customer_rating, priority, potential_value, first_visit_date, last_visit_date, total_visits, notes_count, meetings_count, dse_user_id, visiting_card_front_url, visiting_card_back_url, visiting_card_captured_at, created_at, updated_at', { count: 'exact' })
      .eq('dse_user_id', user.id)
      .eq('is_deleted', false)

    // Apply search filter
    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`full_name.ilike.%${safeSearch}%,company_name.ilike.%${safeSearch}%,primary_mobile.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`)
      }
    }

    // Apply status filter
    if (status) {
      query = query.eq('customer_status', status)
    }

    // Apply source filter
    if (source) {
      query = query.eq('source', source)
    }

    // Apply priority filter
    if (priority) {
      query = query.eq('priority', priority)
    }

    // Apply date range filter with date validation
    if (dateFrom) {
      const parsedFrom = new Date(dateFrom)
      if (!isNaN(parsedFrom.getTime())) {
        query = query.gte('created_at', dateFrom)
      }
    }
    if (dateTo) {
      const parsedTo = new Date(dateTo)
      if (!isNaN(parsedTo.getTime())) {
        query = query.lte('created_at', dateTo)
      }
    }

    // Apply sorting
    const validSortColumns = ['created_at', 'full_name', 'company_name', 'customer_status', 'last_visit_date', 'priority']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: customers, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        customers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching customers', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = customerSchema.parse(body)

    // Check for duplicate mobile number
    const { data: existing } = await supabase
      .from('dse_customers')
      .select('id, customer_id')
      .eq('dse_user_id', user.id)
      .eq('primary_mobile', validatedData.primary_mobile)
      .eq('is_deleted', false)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'A customer with this mobile number already exists',
          errorCode: 'DUPLICATE_MOBILE',
          existingCustomerId: existing.customer_id
        },
        { status: 409 }
      )
    }

    // Create customer
    const { data: customer, error: createError } = await supabase
      .from('dse_customers')
      .insert({
        ...validatedData,
        dse_user_id: user.id,
        first_visit_date: new Date().toISOString().split('T')[0],
        last_visit_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .maybeSingle()

    if (createError) {
      throw createError
    }

    if (!customer) {
      apiLogger.error('Customer insert returned null despite no error')
      return NextResponse.json(
        { success: false, error: 'Failed to create customer' },
        { status: 500 }
      )
    }

    // Create audit log
    const { error: auditError } = await supabase.from('dse_audit_log').insert({
      entity_type: 'Customer',
      entity_id: customer.id,
      action: 'Created',
      new_values: customer,
      user_id: user.id,
      changes_summary: `Created new customer: ${customer.full_name}`
    })

    if (auditError) {
      apiLogger.error('Failed to create audit log for customer creation', auditError)
    }

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer created successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    apiLogger.error('Error creating customer', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
