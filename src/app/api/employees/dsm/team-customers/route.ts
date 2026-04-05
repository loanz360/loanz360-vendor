import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

// Validation schema for creating customer on behalf of DSE
const customerSchema = z.object({
  dse_user_id: z.string().uuid(),
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
  custom_fields: z.record(z.any()).optional().nullable(),
  customer_rating: z.number().min(1).max(5).optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  potential_value: z.number().optional().nullable(),
})

// Helper function to verify DSM role and get team members
async function verifyDSMRole(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { isValid: false, error: 'User profile not found' }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_MANAGER') {
    return { isValid: false, error: 'Access denied. This feature is only available for Direct Sales Managers.' }
  }

  return { isValid: true, profile }
}

// Helper function to get DSM's team member IDs
async function getTeamMemberIds(supabase: any, dsmUserId: string) {
  const { data: teamMembers, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'EMPLOYEE')
    .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
    .eq('manager_user_id', dsmUserId)

  if (error) {
    throw new Error('Failed to fetch team members')
  }

  return teamMembers?.map(member => member.id) || []
}

// GET - List team customers with filtering, pagination, and search
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSM role
    const roleCheck = await verifyDSMRole(supabase, user.id)
    if (!roleCheck.isValid) {
      return NextResponse.json({ success: false, error: roleCheck.error }, { status: 403 })
    }

    // Get team member IDs
    const teamMemberIds = await getTeamMemberIds(supabase, user.id)

    if (teamMemberIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          customers: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        }
      })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const dseUserId = searchParams.get('dse_user_id') || ''
    const status = searchParams.get('status') || ''
    const source = searchParams.get('source') || ''
    const priority = searchParams.get('priority') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build query - join with users table to get DSE name and email
    let query = supabase
      .from('dse_customers')
      .select(`
        *,
        dse:users!dse_customers_dse_user_id_fkey(
          id,
          full_name,
          email
        )
      `, { count: 'exact' })
      .in('dse_user_id', teamMemberIds)
      .eq('is_deleted', false)

    // Apply DSE filter if specified
    if (dseUserId) {
      query = query.eq('dse_user_id', dseUserId)
    }

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`)
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

    // Apply date range filter
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
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

    // Transform data to hide phone numbers and flatten DSE info
    const transformedCustomers = customers?.map((customer: any) => {
      const { dse, primary_mobile, alternate_mobile, whatsapp_number, landline, ...rest } = customer
      return {
        ...rest,
        primary_mobile: '***HIDDEN***', // Hide phone numbers from DSM
        dse_name: dse?.full_name || 'Unknown',
        dse_email: dse?.email || '',
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        customers: transformedCustomers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching team customers', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new customer on behalf of a DSE
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSM role
    const roleCheck = await verifyDSMRole(supabase, user.id)
    if (!roleCheck.isValid) {
      return NextResponse.json({ success: false, error: roleCheck.error }, { status: 403 })
    }

    // Get team member IDs
    const teamMemberIds = await getTeamMemberIds(supabase, user.id)

    // Parse and validate request body
    const body = await request.json()
    const validatedData = customerSchema.parse(body)

    // Verify the specified DSE is in the DSM's team
    if (!teamMemberIds.includes(validatedData.dse_user_id)) {
      return NextResponse.json(
        { success: false, error: 'The specified DSE is not in your team' },
        { status: 403 }
      )
    }

    // Check for duplicate mobile number for this DSE
    const { data: existingCustomer } = await supabase
      .from('dse_customers')
      .select('id, full_name')
      .eq('dse_user_id', validatedData.dse_user_id)
      .eq('primary_mobile', validatedData.primary_mobile)
      .eq('is_deleted', false)
      .maybeSingle()

    if (existingCustomer) {
      return NextResponse.json(
        {
          success: false,
          error: `A customer with this mobile number already exists: ${existingCustomer.full_name}`
        },
        { status: 409 }
      )
    }

    // Generate customer ID
    const customerId = `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Create customer
    const { data: newCustomer, error: createError } = await supabase
      .from('dse_customers')
      .insert([{
        customer_id: customerId,
        ...validatedData,
        total_visits: 0,
        is_converted_to_lead: false,
        is_deleted: false,
        created_by_dsm: true, // Flag to track DSM-created customers
        created_by_dsm_user_id: user.id,
      }])
      .select()
      .maybeSingle()

    if (createError) {
      throw createError
    }

    // Log audit trail
    await supabase
      .from('audit_logs')
      .insert([{
        user_id: user.id,
        action: 'CREATE_CUSTOMER_FOR_TEAM',
        resource_type: 'dse_customer',
        resource_id: newCustomer.id,
        details: {
          customer_id: customerId,
          dse_user_id: validatedData.dse_user_id,
          customer_name: validatedData.full_name,
          created_by: 'DSM'
        }
      }])

    return NextResponse.json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors
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
