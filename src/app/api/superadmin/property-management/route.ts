import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/utils/api-response'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/property-management
 * List properties with pagination, search, and filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return apiUnauthorized(auth.error || 'Unauthorized')
    }

    // Only Super Admin can access property management
    if (auth.role !== 'SUPER_ADMIN') {
      return apiForbidden('Only Super Admin can access property management')
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const propertyType = searchParams.get('property_type')
    const search = searchParams.get('search')
    const city = searchParams.get('city')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit

    const supabase = createSupabaseAdmin()

    // Build query
    let query = supabase
      .from('properties')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (propertyType) {
      query = query.eq('property_type', propertyType)
    }

    if (city) {
      const sanitizedCity = city.replace(/[%_'";\\\[\]{}()]/g, '')
      if (sanitizedCity.length > 0) {
        query = query.ilike('city', `%${sanitizedCity}%`)
      }
    }

    if (search) {
      const sanitizedSearch = search.replace(/[%_'";\\\[\]{}()]/g, '')
      if (sanitizedSearch.length > 0) {
        query = query.or(
          `title.ilike.%${sanitizedSearch}%,address.ilike.%${sanitizedSearch}%,city.ilike.%${sanitizedSearch}%,posted_by.ilike.%${sanitizedSearch}%`
        )
      }
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: properties, error, count } = await query

    if (error) {
      logger.error('Error fetching properties:', error)
      return apiError('Failed to fetch properties', 500)
    }

    // Get stats
    const { data: allProperties } = await supabase
      .from('properties')
      .select('status, property_type, price')

    const stats = {
      total: allProperties?.length || 0,
      pending: allProperties?.filter(p => p.status === 'pending').length || 0,
      approved: allProperties?.filter(p => p.status === 'approved').length || 0,
      rejected: allProperties?.filter(p => p.status === 'rejected').length || 0,
      closed: allProperties?.filter(p => p.status === 'closed').length || 0,
      totalValue: allProperties?.reduce((sum, p) => sum + (Number(p.price) || 0), 0) || 0,
      approvedValue: allProperties
        ?.filter(p => p.status === 'approved')
        .reduce((sum, p) => sum + (Number(p.price) || 0), 0) || 0,
      byType: {
        residential: allProperties?.filter(p => p.property_type === 'residential').length || 0,
        commercial: allProperties?.filter(p => p.property_type === 'commercial').length || 0,
        industrial: allProperties?.filter(p => p.property_type === 'industrial').length || 0,
        land: allProperties?.filter(p => p.property_type === 'land').length || 0,
        mixed: allProperties?.filter(p => p.property_type === 'mixed').length || 0,
      },
    }

    return apiSuccess(
      {
        properties: properties || [],
        total_count: count || 0,
        page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
      undefined,
      { stats }
    )
  } catch (error) {
    logger.error('Error in GET /api/superadmin/property-management:', error)
    return apiError('Internal server error', 500)
  }
}

/**
 * POST /api/superadmin/property-management
 * Create a new property
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return apiUnauthorized(auth.error || 'Unauthorized')
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return apiForbidden('Only Super Admin can create properties')
    }

    const body = await request.json()

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return apiError('Title is required', 400, 'VALIDATION_ERROR')
    }

    if (body.property_type && !['residential', 'commercial', 'industrial', 'land', 'mixed'].includes(body.property_type)) {
      return apiError('Invalid property type', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseAdmin()

    const propertyData = {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      property_type: body.property_type || 'residential',
      status: 'pending',
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      state: body.state?.trim() || null,
      pincode: body.pincode?.trim() || null,
      area_sqft: body.area_sqft ? Number(body.area_sqft) : null,
      price: body.price ? Number(body.price) : null,
      images: body.images || [],
      posted_by: body.posted_by?.trim() || null,
      posted_by_id: body.posted_by_id || null,
      vendor_type: body.vendor_type?.trim() || null,
      metadata: body.metadata || {},
    }

    const { data: property, error } = await supabase
      .from('properties')
      .insert(propertyData)
      .select()
      .maybeSingle()

    if (error) {
      logger.error('Error creating property:', error)
      return apiError('Failed to create property', 500)
    }

    logger.info(`Property created: ${property?.id} by ${auth.userId}`)

    return NextResponse.json(
      { success: true, data: property, message: 'Property created successfully' },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Error in POST /api/superadmin/property-management:', error)
    return apiError('Internal server error', 500)
  }
}
