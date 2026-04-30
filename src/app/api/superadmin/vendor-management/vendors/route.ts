import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'
import { apiLogger } from '@/lib/utils/logger'
import { encodeHtmlEntities } from '@/lib/utils/sanitize'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/vendor-management/vendors
 * List/search vendors from vendor_profiles table
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

    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const serviceType = searchParams.get('service_type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('vendor_profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search) {
      const sanitizedSearch = search.replace(/[%_'";\\\[\]{}()]/g, '')
      if (sanitizedSearch.length > 0) {
        query = query.or(`full_name.ilike.%${sanitizedSearch}%,company_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`)
      }
    }

    if (serviceType) {
      query = query.eq('service_type', serviceType)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: vendors, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching vendors', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch vendors' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        vendors: vendors || [],
        total_count: count || 0,
        page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/superadmin/vendor-management/vendors', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/vendor-management/vendors
 * Create a new vendor profile
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { full_name, email, mobile_number, company_name, service_type, address, city, state, pincode, gst_number, pan_number, vendor_id } = body

    if (!full_name || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: full_name, email' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    const vendorData: Record<string, unknown> = {
      full_name: encodeHtmlEntities(full_name),
      email,
      mobile_number: mobile_number || null,
      company_name: company_name ? encodeHtmlEntities(company_name) : null,
      service_type: service_type ? encodeHtmlEntities(service_type) : null,
      address: address ? encodeHtmlEntities(address) : null,
      city: city ? encodeHtmlEntities(city) : null,
      state: state ? encodeHtmlEntities(state) : null,
      pincode: pincode || null,
      gst_number: gst_number || null,
      pan_number: pan_number || null,
      updated_at: new Date().toISOString(),
    }

    if (vendor_id) {
      vendorData.vendor_id = vendor_id
    }

    const { data: vendor, error } = await supabase
      .from('vendor_profiles')
      .insert(vendorData)
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A vendor with this email or ID already exists' },
          { status: 409 }
        )
      }
      apiLogger.error('Error creating vendor', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to create vendor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: vendor,
      message: 'Vendor created successfully',
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/superadmin/vendor-management/vendors', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
